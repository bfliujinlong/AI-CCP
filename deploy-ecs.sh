#!/bin/bash
# ============================================================
# AICC Platform - 腾讯云 ECS Docker 一键部署脚本
# 适用环境: 腾讯云 CVM (Ubuntu 20.04/22.04 or CentOS 7/8)
# 运行方式: bash deploy-ecs.sh
# ============================================================

set -e

# ─── 配置区（部署前请修改以下变量）─────────────────────────────
APP_DIR="/opt/aicc"                   # 应用部署目录
DOMAIN=""                             # 可选，填写你的域名，如 aicc.example.com
QWEN_API_KEY=""                       # 通义千问 API Key（可后填）
POSTGRES_PASSWORD="$(openssl rand -hex 16)"   # 随机生成强密码
MINIO_PASSWORD="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"
# ─────────────────────────────────────────────────────────────

echo "======================================"
echo "  AICC Platform ECS 部署脚本"
echo "======================================"

# 1. 检查 Docker & Docker Compose
echo "[1/6] 检查 Docker 环境..."
if ! command -v docker &>/dev/null; then
    echo "  → 安装 Docker..."
    curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
    systemctl enable docker && systemctl start docker
else
    echo "  ✓ Docker 已安装: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
    echo "  → 安装 Docker Compose plugin..."
    apt-get install -y docker-compose-plugin 2>/dev/null || \
    yum install -y docker-compose-plugin 2>/dev/null || \
    pip3 install docker-compose
else
    echo "  ✓ Docker Compose 已安装: $(docker compose version)"
fi

# 2. 创建部署目录 & 上传代码
echo "[2/6] 准备部署目录: $APP_DIR"
mkdir -p "$APP_DIR"

# 如果脚本在项目根目录运行，则同步代码
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/docker-compose.prod.yml" ]; then
    echo "  → 从本地同步代码..."
    rsync -av --exclude='.git' --exclude='node_modules' --exclude='frontend/dist' \
        --exclude='__pycache__' --exclude='*.pyc' \
        "$SCRIPT_DIR/" "$APP_DIR/"
else
    echo "  ✗ 请将项目代码上传到 $APP_DIR 后重新运行"
    echo "    scp -r ./ai-cloud-consulting-platform root@YOUR_ECS_IP:$APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# 3. 生成生产环境配置
echo "[3/6] 生成 .env.production..."
CORS_ORIGINS="http://localhost"
if [ -n "$DOMAIN" ]; then
    CORS_ORIGINS="https://$DOMAIN,http://$DOMAIN"
fi

cat > "$APP_DIR/.env.production" <<EOF
POSTGRES_DB=aicc
POSTGRES_USER=aicc
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
MINIO_ROOT_USER=aicc_minio
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRE_MINUTES=480
QWEN_API_KEY=${QWEN_API_KEY}
QWEN_MODEL=qwen-plus
CORS_ORIGINS=${CORS_ORIGINS}
FRONTEND_URL=http://localhost
EOF

echo "  ✓ .env.production 生成完毕"
echo ""
echo "  ⚠️  请保存以下密钥（仅显示一次）："
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"
echo "  MINIO_PASSWORD:    ${MINIO_PASSWORD}"
echo "  JWT_SECRET:        ${JWT_SECRET}"
echo ""

# 4. 构建并启动
echo "[4/6] 构建 Docker 镜像（首次构建约 5-10 分钟）..."
docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache

echo "[5/6] 启动服务..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 5. 健康检查
echo "[6/6] 等待服务就绪..."
MAX_WAIT=120
WAITED=0
until curl -sf http://localhost:8000/health >/dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "  ✗ 后端服务启动超时，请检查日志:"
        docker compose -f docker-compose.prod.yml logs backend --tail 50
        exit 1
    fi
    printf "."
    sleep 3
    WAITED=$((WAITED+3))
done
echo ""
echo "  ✓ 后端 API 健康检查通过"

until curl -sf http://localhost/ >/dev/null 2>&1; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "  ✗ 前端服务启动超时"
        exit 1
    fi
    printf "."
    sleep 3
    WAITED=$((WAITED+3))
done
echo ""
echo "  ✓ 前端服务健康检查通过"

# 6. 显示访问地址
SERVER_IP=$(curl -s --max-time 3 http://metadata.tencentyun.com/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "======================================"
echo "  🎉 部署成功！"
echo "======================================"
echo ""
echo "  平台地址:    http://${SERVER_IP}"
echo "  API 文档:    http://${SERVER_IP}:8000/docs"
echo "  MinIO 控制台: http://${SERVER_IP}:9001"
echo ""
echo "  默认管理员账号: admin / admin123"
echo "  ⚠️  登录后请立即修改管理员密码！"
echo ""
echo "  常用命令:"
echo "  查看日志:  docker compose -f $APP_DIR/docker-compose.prod.yml logs -f"
echo "  重启服务:  docker compose -f $APP_DIR/docker-compose.prod.yml restart"
echo "  停止服务:  docker compose -f $APP_DIR/docker-compose.prod.yml down"
echo "======================================"
