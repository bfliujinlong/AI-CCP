#!/bin/bash
############################################################
# AICCP + Ollama 一键部署脚本
# 在 ECS 上执行：安装 Ollama、拉模型、更新配置、重启服务
#
# 用法:
#   chmod +x deploy-ollama.sh
#   sudo ./deploy-ollama.sh
#
# 可选参数:
#   sudo ./deploy-ollama.sh --model qwen3.5:9b    # 指定模型
#   sudo ./deploy-ollama.sh --skip-pull            # 跳过模型下载
############################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

MODEL="qwen3.5:4b"
SKIP_PULL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --model) MODEL="$2"; shift 2 ;;
        --skip-pull) SKIP_PULL=true; shift ;;
        --help|-h)
            echo "用法: sudo ./deploy-ollama.sh [--model qwen3.5:4b] [--skip-pull]"
            exit 0 ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
done

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }

# 检查 root
if [[ $EUID -ne 0 ]]; then
    log_error "请使用 root 运行: sudo ./deploy-ollama.sh"
    exit 1
fi

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════╗"
echo "║   AICCP + Ollama 一键部署               ║"
echo "║   本地模型 + 云端回退 混合模式           ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# ========== 步骤 1: 硬件检测 ==========
log_step "步骤 1/5: 检测硬件配置"

CPU_CORES=$(nproc)
TOTAL_MEM_GB=$(($(free -m | awk '/^Mem:/{print $2}') / 1024))
DISK_AVAIL_GB=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')

log_info "CPU: ${CPU_CORES} 核"
log_info "内存: ${TOTAL_MEM_GB} GB"
log_info "磁盘可用: ${DISK_AVAIL_GB} GB"

# 内存检查
if [[ $TOTAL_MEM_GB -lt 6 ]]; then
    log_error "内存不足 6GB (${TOTAL_MEM_GB}GB)，无法运行本地模型"
    log_error "请先升级 ECS 配置到至少 4核 16GB"
    exit 1
fi

# 根据内存自动调整模型
if [[ "$MODEL" == "qwen3.5:4b" && $TOTAL_MEM_GB -ge 16 ]]; then
    MODEL="qwen3.5:9b"
    log_info "内存 >= 16GB，自动升级模型为: $MODEL"
fi

log_info "选定模型: $MODEL"

# ========== 步骤 2: 安装 Ollama ==========
log_step "步骤 2/5: 安装 Ollama"

if command -v ollama &>/dev/null; then
    log_info "Ollama 已安装: $(ollama --version 2>/dev/null || echo 'unknown')"
else
    log_info "正在安装 Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    log_info "Ollama 安装完成"
fi

# 配置 Ollama 服务
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf << 'SVC_EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_NUM_PARALLEL=1"
SVC_EOF

systemctl daemon-reload
systemctl restart ollama
sleep 3

if systemctl is-active --quiet ollama; then
    log_info "Ollama 服务运行中"
else
    log_error "Ollama 服务启动失败"
    systemctl status ollama --no-pager
    exit 1
fi

# ========== 步骤 3: 拉取模型 ==========
log_step "步骤 3/5: 拉取模型: $MODEL"

if $SKIP_PULL; then
    log_info "跳过模型下载（--skip-pull）"
else
    log_info "正在下载模型（可能需要几分钟）..."
    ollama pull "$MODEL"
    log_info "模型下载完成"
fi

# 验证
if curl -s http://localhost:11434/api/tags | grep -q "$MODEL"; then
    log_info "模型验证通过"
else
    log_warn "模型可能仍在加载中"
fi

# ========== 步骤 4: 更新 AICCP 配置 ==========
log_step "步骤 4/5: 更新 AICCP 配置"

cd /opt/aicc

# 更新 .env.production
if [[ -f .env.production ]]; then
    # 备份
    cp .env.production .env.production.bak.$(date +%Y%m%d%H%M%S)
    log_info "已备份 .env.production"
fi

# 添加/更新 Ollama 配置
if grep -q "OLLAMA_ENABLED" .env.production 2>/dev/null; then
    sed -i "s/OLLAMA_ENABLED=.*/OLLAMA_ENABLED=true/" .env.production
    sed -i "s/OLLAMA_MODEL=.*/OLLAMA_MODEL=$MODEL/" .env.production
else
    cat >> .env.production << ENV_EOF

# Ollama 本地模型配置
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://ollama:11434/v1
OLLAMA_MODEL=$MODEL
OLLAMA_TIMEOUT=120
ENV_EOF
fi

log_info ".env.production 已更新"
log_info "  OLLAMA_ENABLED=true"
log_info "  OLLAMA_MODEL=$MODEL"

# ========== 步骤 5: 重启 AICCP 服务 ==========
log_step "步骤 5/5: 重启 AICCP 服务"

log_info "重新构建并启动容器..."
docker compose -f docker-compose.prod.yml up -d --build

log_info "等待服务就绪..."
sleep 10

# 验证
echo ""
echo -e "${CYAN}┌─────────────────────────────────────┐${NC}"
echo -e "${CYAN}│         部署验证                    │${NC}"
echo -e "${CYAN}├─────────────────────────────────────┤${NC}"

# Ollama
echo -ne "│  Ollama 服务........"
if systemctl is-active --quiet ollama; then
    echo -e "${GREEN}运行中${NC}           │"
else
    echo -e "${RED}未运行${NC}           │"
fi

# 模型
echo -ne "│  本地模型............"
if curl -s http://localhost:11434/api/tags 2>/dev/null | grep -q "$MODEL"; then
    echo -e "${GREEN}$MODEL${NC}  │"
else
    echo -e "${YELLOW}加载中${NC}           │"
fi

# Docker 容器
for container in aicc-postgres aicc-redis aicc-minio aicc-ollama aicc-backend aicc-frontend; do
    echo -ne "│  $container"
    # 补齐空格
    local padding=$((20 - ${#container}))
    printf "%*s" $padding
    if docker ps --format '{{.Names}}' | grep -q "^$container$"; then
        echo -e "${GREEN}运行中${NC}  │"
    else
        echo -e "${RED}未运行${NC}  │"
    fi
done

echo -e "${CYAN}└─────────────────────────────────────┘${NC}"

# 快速推理测试
echo ""
log_info "测试本地模型推理..."
TEST_RESP=$(curl -s --max-time 120 http://localhost:11434/v1/chat/completions     -H "Content-Type: application/json"     -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"说你好\"}],\"max_tokens\":20}" 2>/dev/null)

if echo "$TEST_RESP" | grep -q "content"; then
    REPLY=$(echo "$TEST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'][:50])" 2>/dev/null || echo "OK")
    log_info "推理测试成功 → \"$REPLY\""
else
    log_warn "推理测试超时（模型可能仍在加载，稍后重试）"
fi

# AICCP 后端健康检查
log_info "检查 AICCP 后端..."
BACKEND_HEALTH=$(curl -s --max-time 10 http://localhost:8000/docs 2>/dev/null | head -1)
if [[ -n "$BACKEND_HEALTH" ]]; then
    log_info "AICCP 后端运行正常"
else
    log_warn "AICCP 后端可能仍在启动中"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ 部署完成！                           ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                         ║${NC}"
echo -e "${GREEN}║  AICCP 平台:  http://8.153.148.69       ║${NC}"
echo -e "${GREEN}║  API 文档:    http://8.153.148.69:8000/docs ║${NC}"
echo -e "${GREEN}║  Ollama API:  http://localhost:11434    ║${NC}"
echo -e "${GREEN}║                                         ║${NC}"
echo -e "${GREEN}║  本地模型:    $MODEL                   ║${NC}"
echo -e "${GREEN}║  云端回退:    Qwen API (需配置 Key)     ║${NC}"
echo -e "${GREEN}║                                         ║${NC}"
echo -e "${GREEN}║  常用命令:                              ║${NC}"
echo -e "${GREEN}║    ollama list          查看模型        ║${NC}"
echo -e "${GREEN}║    ollama ps            运行中模型      ║${NC}"
echo -e "${GREEN}║    docker ps            查看容器        ║${NC}"
echo -e "${GREEN}║    docker logs aicc-backend  后端日志   ║${NC}"
echo -e "${GREEN}║                                         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
