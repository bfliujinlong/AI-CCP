param(
    [Parameter(Position=0)]
    [ValidateSet("build", "push", "deploy-k8s", "deploy-compose", "destroy", "help")]
    [string]$Action = "help",

    [string]$Registry = "",
    [string]$Namespace = "aicc",
    [string]$KubeContext = "",
    [string]$Domain = "aicc.yourdomain.com"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ImageTag = if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "latest" }

function Write-Step($msg) {
    Write-Host "`n==== $msg ====" -ForegroundColor Cyan
}

function Build-Images {
    Write-Step "Building Docker images"
    
    if (-not $Registry) {
        Write-Host "Registry not specified. Usage: deploy.ps1 build -Registry <your-registry>" -ForegroundColor Red
        Write-Host "  Alibaba Cloud: registry.cn-hangzhou.aliyuncs.com/<namespace>" -ForegroundColor Yellow
        Write-Host "  Tencent Cloud: ccr.ccs.tencentyun.com/<namespace>" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "Building backend image..."
    docker build -t "${Registry}/aicc-backend:${ImageTag}" "${ProjectRoot}\backend"
    
    Write-Host "Building frontend image..."
    docker build -t "${Registry}/aicc-frontend:${ImageTag}" "${ProjectRoot}\frontend"
    
    Write-Host "Images built successfully:" -ForegroundColor Green
    Write-Host "  ${Registry}/aicc-backend:${ImageTag}"
    Write-Host "  ${Registry}/aicc-frontend:${ImageTag}"
}

function Push-Images {
    Write-Step "Pushing Docker images to registry"
    
    if (-not $Registry) {
        Write-Host "Registry not specified." -ForegroundColor Red
        exit 1
    }

    docker push "${Registry}/aicc-backend:${ImageTag}"
    docker push "${Registry}/aicc-frontend:${ImageTag}"
    
    Write-Host "Images pushed successfully." -ForegroundColor Green
}

function Deploy-K8s {
    Write-Step "Deploying to Kubernetes"
    
    if ($KubeContext) {
        kubectl config use-context $KubeContext
    }

    $k8sDir = "${ProjectRoot}\deploy\k8s"
    
    $tempDir = "${ProjectRoot}\deploy\k8s\_temp"
    if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir | Out-Null }
    
    Get-ChildItem -Path $k8sDir -Filter "*.yaml" | Where-Object { $_.Name -match "^\d+" } | Sort-Object Name | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $content = $content -replace "YOUR_REGISTRY", $Registry
        $content = $content -replace "aicc\.yourdomain\.com", $Domain
        $tempFile = "${tempDir}\$($_.Name)"
        $content | Set-Content $tempFile -NoNewline
        kubectl apply -f $tempFile -n $Namespace
    }
    
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "`nWaiting for pods to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l app=aicc-backend -n $Namespace --timeout=120s 2>$null
    kubectl wait --for=condition=ready pod -l app=aicc-frontend -n $Namespace --timeout=120s 2>$null
    
    Write-Host "`nDeployment complete!" -ForegroundColor Green
    Write-Host "Check status: kubectl get pods -n $Namespace" -ForegroundColor Yellow
    Write-Host "Get ingress:  kubectl get ingress -n $Namespace" -ForegroundColor Yellow
}

function Deploy-Compose {
    Write-Step "Deploying with Docker Compose (production)"
    
    if (-not (Test-Path "${ProjectRoot}\.env.production")) {
        Write-Host ".env.production not found! Creating from template..." -ForegroundColor Yellow
        Copy-Item "${ProjectRoot}\.env.production" "${ProjectRoot}\.env.production" -ErrorAction SilentlyContinue
    }
    
    docker compose -f "${ProjectRoot}\docker-compose.prod.yml" --env-file "${ProjectRoot}\.env.production" up -d --build
    
    Write-Host "`nDeployment complete!" -ForegroundColor Green
    Write-Host "Frontend: http://localhost" -ForegroundColor Yellow
    Write-Host "Backend:  http://localhost:8000" -ForegroundColor Yellow
    Write-Host "MinIO:    http://localhost:9001" -ForegroundColor Yellow
}

function Destroy {
    Write-Step "Destroying deployment"
    
    $confirm = Read-Host "Are you sure? This will delete all resources (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        return
    }
    
    $k8sDir = "${ProjectRoot}\deploy\k8s"
    Get-ChildItem -Path $k8sDir -Filter "*.yaml" | Where-Object { $_.Name -match "^\d+" } | Sort-Object Name -Descending | ForEach-Object {
        kubectl delete -f $_.FullName -n $Namespace --ignore-not-found
    }
    
    Write-Host "Resources destroyed." -ForegroundColor Green
}

function Show-Help {
    Write-Host @"
AICC Platform Deployment Script
================================

Usage: .\deploy\deploy.ps1 <action> [options]

Actions:
  build           Build Docker images
  push            Push images to registry
  deploy-k8s      Deploy to Kubernetes (ACK/TKE)
  deploy-compose  Deploy with Docker Compose (standalone)
  destroy         Remove K8s deployment
  help            Show this help

Options:
  -Registry       Container registry URL (required for build/push/deploy-k8s)
  -Namespace      K8s namespace (default: aicc)
  -KubeContext    Kubectl context to use
  -Domain         Custom domain (default: aicc.yourdomain.com)

Examples:
  # Build and push to Alibaba Cloud ACR
  .\deploy\deploy.ps1 build -Registry registry.cn-hangzhou.aliyuncs.com/myteam
  .\deploy\deploy.ps1 push -Registry registry.cn-hangzhou.aliyuncs.com/myteam

  # Deploy to Alibaba Cloud ACK
  .\deploy\deploy.ps1 deploy-k8s -Registry registry.cn-hangzhou.aliyuncs.com/myteam -Domain aicc.mycompany.com

  # Deploy to Tencent Cloud TKE
  .\deploy\deploy.ps1 deploy-k8s -Registry ccr.ccs.tencentyun.com/myteam -Domain aicc.mycompany.com

  # Deploy standalone with Docker Compose
  .\deploy\deploy.ps1 deploy-compose

Environment Variables:
  IMAGE_TAG       Image tag (default: latest)

"@
}

switch ($Action) {
    "build"    { Build-Images }
    "push"     { Push-Images }
    "deploy-k8s"    { Deploy-K8s }
    "deploy-compose" { Deploy-Compose }
    "destroy"  { Destroy }
    "help"     { Show-Help }
}
