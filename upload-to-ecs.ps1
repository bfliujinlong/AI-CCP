param(
    [Parameter(Mandatory=$true)]
    [string]$EcsIP,
    
    [string]$EcsUser = "root",
    
    [string]$RemoteDir = "/opt/aicc",
    
    [string]$LocalDir = "."
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AICC Platform - 上传代码到 ECS" -ForegroundColor Cyan
Write-Host "  目标: $EcsUser@$EcsIP`:$RemoteDir" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$sshTest = ssh -o ConnectTimeout=5 -o BatchMode=yes "$EcsUser@$EcsIP" "echo ok" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] SSH 免密登录未配置，请先配置：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. 生成密钥（如果没有）：ssh-keygen -t ed25519" -ForegroundColor White
    Write-Host "  2. 复制到 ECS：ssh-copy-id $EcsUser@$EcsIP" -ForegroundColor White
    Write-Host ""
    Write-Host "或者使用密码方式（需要安装 sshpass 或手动 scp）" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] 在 ECS 上创建目录..." -ForegroundColor Green
ssh "$EcsUser@$EcsIP" "mkdir -p $RemoteDir/database $RemoteDir/deploy/nginx"

Write-Host "[2/3] 上传项目文件..." -ForegroundColor Green
$excludeArgs = @(
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=__pycache__",
    "--exclude=*.pyc",
    "--exclude=.env",
    "--exclude=dist",
    "--exclude=.venv",
    "--exclude=venv"
)

$hasRsync = Get-Command rsync -ErrorAction SilentlyContinue
if ($hasRsync) {
    Write-Host "  使用 rsync 上传（增量同步）..." -ForegroundColor Gray
    $rsyncCmd = "rsync -avz --progress $($excludeArgs -join ' ') $($LocalDir)/ $EcsUser@${EcsIP}:${RemoteDir}/"
    Invoke-Expression $rsyncCmd
} else {
    Write-Host "  使用 scp 上传（rsync 不可用）..." -ForegroundColor Gray
    scp -r "$LocalDir/backend" "$EcsUser@${EcsIP}:${RemoteDir}/"
    scp -r "$LocalDir/frontend" "$EcsUser@${EcsIP}:${RemoteDir}/"
    scp "$LocalDir/Dockerfile" "$EcsUser@${EcsIP}:${RemoteDir}/"
    scp "$LocalDir/docker-compose.ecs.yml" "$EcsUser@${EcsIP}:${RemoteDir}/"
    scp "$LocalDir/.env.ecs" "$EcsUser@${EcsIP}:${RemoteDir}/.env"
    scp "$LocalDir/deploy-ecs.sh" "$EcsUser@${EcsIP}:${RemoteDir}/"
    scp -r "$LocalDir/deploy" "$EcsUser@${EcsIP}:${RemoteDir}/"
    scp -r "$LocalDir/database" "$EcsUser@${EcsIP}:${RemoteDir}/"
    scp "$LocalDir/backend/alembic.ini" "$EcsUser@${EcsIP}:${RemoteDir}/backend/"
    scp -r "$LocalDir/backend/alembic" "$EcsUser@${EcsIP}:${RemoteDir}/backend/"
}

Write-Host "[3/3] 在 ECS 上启动部署..." -ForegroundColor Green
ssh "$EcsUser@$EcsIP" "cd $RemoteDir && chmod +x deploy-ecs.sh && bash deploy-ecs.sh $RemoteDir"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  访问地址: http://$EcsIP" -ForegroundColor Cyan
Write-Host "  默认账号: admin" -ForegroundColor Cyan
Write-Host "  默认密码: admin123" -ForegroundColor Cyan
