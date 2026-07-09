param(
    [Parameter(Mandatory=$true)]
    [string]$EcsIP,
    
    [string]$EcsUser = "root",
    
    [string]$RemoteDir = "/opt/aicc"
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackDir = Join-Path $ProjectDir ".deploy-pack"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AICC Platform - 一键打包上传部署" -ForegroundColor Cyan
Write-Host "  目标: $EcsUser@$EcsIP`:$RemoteDir" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============ Step 1: 精简打包 ============
Write-Host "[1/3] 精简打包中..." -ForegroundColor Green

if (Test-Path $PackDir) { Remove-Item $PackDir -Recurse -Force }
New-Item -ItemType Directory -Path $PackDir -Force | Out-Null

# 后端（排除 venv、__pycache__、.env）
$backendSrc = Join-Path $ProjectDir "backend"
$backendDst = Join-Path $PackDir "backend"
New-Item -ItemType Directory -Path $backendDst -Force | Out-Null
Copy-Item "$backendSrc\app" "$backendDst\app" -Recurse -Force
Copy-Item "$backendSrc\alembic" "$backendDst\alembic" -Recurse -Force
Copy-Item "$backendSrc\alembic.ini" "$backendDst\" -Force
Copy-Item "$backendSrc\requirements.txt" "$backendDst\" -Force
Get-ChildItem $backendDst -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem $backendDst -Recurse -File -Filter "*.pyc" | Remove-Item -Force

# 前端（排除 node_modules、dist）
$frontendSrc = Join-Path $ProjectDir "frontend"
$frontendDst = Join-Path $PackDir "frontend"
New-Item -ItemType Directory -Path $frontendDst -Force | Out-Null
Copy-Item "$frontendSrc\src" "$frontendDst\src" -Recurse -Force
Copy-Item "$frontendSrc\public" "$frontendDst\public" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$frontendSrc\package.json" "$frontendDst\" -Force
Copy-Item "$frontendSrc\package-lock.json" "$frontendDst\" -Force
Copy-Item "$frontendSrc\vite.config.js" "$frontendDst\" -Force
Copy-Item "$frontendSrc\index.html" "$frontendDst\" -Force
Copy-Item "$frontendSrc\auto-imports.d.ts" "$frontendDst\" -Force -ErrorAction SilentlyContinue
Copy-Item "$frontendSrc\components.d.ts" "$frontendDst\" -Force -ErrorAction SilentlyContinue

# 部署文件
Copy-Item "$ProjectDir\Dockerfile" "$PackDir\" -Force
Copy-Item "$ProjectDir\docker-compose.ecs.yml" "$PackDir\" -Force
Copy-Item "$ProjectDir\.env.ecs" "$PackDir\.env" -Force
Copy-Item "$ProjectDir\deploy-ecs.sh" "$PackDir\" -Force
Copy-Item "$ProjectDir\deploy" "$PackDir\deploy" -Recurse -Force
Copy-Item "$ProjectDir\database" "$PackDir\database" -Recurse -Force

# 统计大小
$sizeMB = [math]::Round((Get-ChildItem $PackDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Write-Host "  打包完成: $sizeMB MB" -ForegroundColor Gray

# ============ Step 2: 上传到 ECS ============
Write-Host "[2/3] 上传到 ECS..." -ForegroundColor Green

ssh "$EcsUser@$EcsIP" "rm -rf $RemoteDir && mkdir -p $RemoteDir"

# 用 scp 逐项上传
$items = @(
    @{Src="$PackDir\backend"; Dst="$RemoteDir/backend"},
    @{Src="$PackDir\frontend"; Dst="$RemoteDir/frontend"},
    @{Src="$PackDir\deploy"; Dst="$RemoteDir/deploy"},
    @{Src="$PackDir\database"; Dst="$RemoteDir/database"},
    @{Src="$PackDir\Dockerfile"; Dst="$RemoteDir/Dockerfile"},
    @{Src="$PackDir\docker-compose.ecs.yml"; Dst="$RemoteDir/docker-compose.ecs.yml"},
    @{Src="$PackDir\.env"; Dst="$RemoteDir/.env"},
    @{Src="$PackDir\deploy-ecs.sh"; Dst="$RemoteDir/deploy-ecs.sh"}
)

$total = $items.Count
$i = 0
foreach ($item in $items) {
    $i++
    $name = Split-Path $item.Src -Leaf
    Write-Host "  ($i/$total) 上传 $name ..." -ForegroundColor Gray -NoNewline
    scp -r $item.Src "$EcsUser@${EcsIP}:$($item.Dst)" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        exit 1
    }
}

# 清理本地临时包
Remove-Item $PackDir -Recurse -Force

# ============ Step 3: 远程部署 ============
Write-Host "[3/3] 远程部署启动..." -ForegroundColor Green

ssh "$EcsUser@$EcsIP" "cd $RemoteDir && chmod +x deploy-ecs.sh && bash deploy-ecs.sh $RemoteDir"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  访问: http://$EcsIP" -ForegroundColor Cyan
Write-Host "  账号: admin / admin123" -ForegroundColor Cyan
