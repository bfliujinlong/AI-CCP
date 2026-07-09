param(
    [Parameter(Position=0)]
    [ValidateSet("build", "push", "deploy", "build-push-deploy", "destroy", "status", "help")]
    [string]$Action = "help",

    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod")]
    [string]$Env = "dev",

    [string]$Registry = "",
    [string]$Domain = "",
    [string]$KubeContext = "",
    [string]$ImageTag = "",
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent)
$DeployDir = Join-Path $ProjectRoot "deploy"
$K8sDir = Join-Path $DeployDir "k8s"

if (-not $ImageTag) {
    $ImageTag = if ($Env -eq "prod") { "v$(Get-Date -Format 'yyyyMMdd')" } else { "dev-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }
}

$Namespace = "aicc-$Env"

function Write-Step($msg) { Write-Host "`n==== $msg ====" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  [ERROR] $msg" -ForegroundColor Red }

function Get-EnvConfig {
    $envFile = Join-Path $DeployDir "env" ".env.$Env"
    if (-not (Test-Path $envFile)) {
        Write-Err ".env.$Env not found at $envFile"
        Write-Host "  Run: deploy-ack.ps1 help  to see setup instructions" -ForegroundColor Yellow
        exit 1
    }
    $config = @{}
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]*)=(.*)$") {
            $config[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    return $config
}

function Build-Images {
    param([string]$Reg, [string]$Tag)
    Write-Step "Building Docker images (tag: $Tag)"

    if (-not $Reg) {
        Write-Err "Registry not specified. Use -Registry parameter"
        Write-Host "  Alibaba Cloud ACR example: registry.cn-hangzhou.aliyuncs.com/your-namespace" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "  Building backend..."
    docker build -t "${Reg}/aicc-backend:${Tag}" -t "${Reg}/aicc-backend:latest" "$ProjectRoot\backend"
    if ($LASTEXITCODE -ne 0) { Write-Err "Backend build failed"; exit 1 }
    Write-Success "Backend image built"

    Write-Host "  Building frontend..."
    docker build --build-arg VITE_API_BASE_URL=/api/v1 -t "${Reg}/aicc-frontend:${Tag}" -t "${Reg}/aicc-frontend:latest" "$ProjectRoot\frontend"
    if ($LASTEXITCODE -ne 0) { Write-Err "Frontend build failed"; exit 1 }
    Write-Success "Frontend image built"

    Write-Host "`n  Images:" -ForegroundColor White
    Write-Host "    ${Reg}/aicc-backend:${Tag}"
    Write-Host "    ${Reg}/aicc-frontend:${Tag}"
}

function Push-Images {
    param([string]$Reg, [string]$Tag)
    Write-Step "Pushing images to ACR"

    if (-not $Reg) { Write-Err "Registry not specified"; exit 1 }

    Write-Host "  Checking ACR login..."
    docker push "${Reg}/aicc-backend:${Tag}" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Not logged in to ACR. Attempting login..."
        $acrDomain = $Reg.Split('/')[0]
        Write-Host "  Run manually: docker login $acrDomain" -ForegroundColor Yellow
        Write-Host "  Then re-run this script" -ForegroundColor Yellow
        exit 1
    }

    docker push "${Reg}/aicc-backend:${Tag}"
    docker push "${Reg}/aicc-backend:latest"
    docker push "${Reg}/aicc-frontend:${Tag}"
    docker push "${Reg}/aicc-frontend:latest"
    Write-Success "Images pushed to ACR"
}

function Deploy-K8s {
    param([string]$Reg, [string]$Tag, [string]$DomainName, [string]$KCtx)
    Write-Step "Deploying to ACK ($Env environment, namespace: $Namespace)"

    $config = Get-EnvConfig

    if ($KCtx) {
        Write-Host "  Switching kubectl context to $KCtx..."
        kubectl config use-context $KCtx
    }

    Write-Host "  Current context: $(kubectl config current-context)"

    $tempDir = Join-Path $K8sDir "_temp_$Env"
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempDir | Out-Null

    try {
        Write-Host "`n  [1/6] Creating namespace..."
        $nsYaml = @"
apiVersion: v1
kind: Namespace
metadata:
  name: $Namespace
  labels:
    app: aicc
    env: $Env
"@
        $nsYaml | Set-Content (Join-Path $tempDir "00-namespace.yaml")
        kubectl apply -f (Join-Path $tempDir "00-namespace.yaml")

        Write-Host "  [2/6] Creating secrets..."
        $dbPwd = if ($config["POSTGRES_PASSWORD"]) { $config["POSTGRES_PASSWORD"] } else { "aicc_$( -join ((65..90)+(97..122) | Get-Random -Count 16 | ForEach-Object { [char]$_ }))" }
        $jwtSecret = if ($config["JWT_SECRET"]) { $config["JWT_SECRET"] } else { "jwt_$( -join ((65..90)+(97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ }))" }
        $minioPwd = if ($config["MINIO_ROOT_PASSWORD"]) { $config["MINIO_ROOT_PASSWORD"] } else { "minio_$( -join ((65..90)+(97..122) | Get-Random -Count 16 | ForEach-Object { [char]$_ }))" }

        $secretsYaml = @"
apiVersion: v1
kind: Secret
metadata:
  name: aicc-secret
  namespace: $Namespace
type: Opaque
stringData:
  DATABASE_URL: "postgresql+asyncpg://aicc:${dbPwd}@aicc-postgres:5432/aicc"
  REDIS_URL: "redis://aicc-redis:6379/0"
  MINIO_ACCESS_KEY: "$($config["MINIO_ROOT_USER"] ?? "aicc_minio")"
  MINIO_SECRET_KEY: "$minioPwd"
  JWT_SECRET: "$jwtSecret"
  QWEN_API_KEY: "$($config["QWEN_API_KEY"] ?? "")"
---
apiVersion: v1
kind: Secret
metadata:
  name: aicc-db-secret
  namespace: $Namespace
type: Opaque
stringData:
  POSTGRES_DB: "aicc"
  POSTGRES_USER: "aicc"
  POSTGRES_PASSWORD: "$dbPwd"
---
apiVersion: v1
kind: Secret
metadata:
  name: aicc-minio-secret
  namespace: $Namespace
type: Opaque
stringData:
  MINIO_ROOT_USER: "$($config["MINIO_ROOT_USER"] ?? "aicc_minio")"
  MINIO_ROOT_PASSWORD: "$minioPwd"
"@
        $secretsYaml | Set-Content (Join-Path $tempDir "01-secrets.yaml")
        kubectl apply -f (Join-Path $tempDir "01-secrets.yaml")
        Write-Success "Secrets created"

        Write-Host "  [3/6] Creating configmap..."
        $corsOrigins = if ($DomainName) { "https://$DomainName,http://$DomainName" } else { "*" }
        $frontendUrl = if ($DomainName) { "https://$DomainName" } else { "http://localhost" }
        $cmYaml = @"
apiVersion: v1
kind: ConfigMap
metadata:
  name: aicc-config
  namespace: $Namespace
data:
  MINIO_ENDPOINT: "aicc-minio:9000"
  MINIO_BUCKET: "aicc-documents"
  MINIO_SECURE: "false"
  JWT_ALGORITHM: "HS256"
  JWT_EXPIRE_MINUTES: "$($config["JWT_EXPIRE_MINUTES"] ?? "1440")"
  QWEN_MODEL: "$($config["QWEN_MODEL"] ?? "qwen-plus")"
  CORS_ORIGINS: "$corsOrigins"
  FRONTEND_URL: "$frontendUrl"
  DATABASE_POOL_SIZE: "20"
  DATABASE_MAX_OVERFLOW: "10"
  APP_ENV: "$Env"
"@
        $cmYaml | Set-Content (Join-Path $tempDir "02-configmap.yaml")
        kubectl apply -f (Join-Path $tempDir "02-configmap.yaml")
        Write-Success "ConfigMap created"

        Write-Host "  [4/6] Deploying infrastructure (PostgreSQL, Redis, MinIO)..."
        $infraFiles = @("03-postgres.yaml", "04-redis.yaml", "05-minio.yaml")
        foreach ($f in $infraFiles) {
            $src = Join-Path $K8sDir $f
            if (Test-Path $src) {
                $content = Get-Content $src -Raw
                $content = $content -replace "namespace: aicc", "namespace: $Namespace"
                $content = $content -replace "claimName: aicc-postgres-pvc", "claimName: aicc-postgres-pvc"
                $dst = Join-Path $tempDir $f
                $content | Set-Content $dst
                kubectl apply -f $dst
            }
        }

        Write-Host "  Waiting for infrastructure pods..."
        Start-Sleep -Seconds 5
        kubectl wait --for=condition=ready pod -l app=aicc-postgres -n $Namespace --timeout=120s 2>$null
        kubectl wait --for=condition=ready pod -l app=aicc-redis -n $Namespace --timeout=120s 2>$null
        kubectl wait --for=condition=ready pod -l app=aicc-minio -n $Namespace --timeout=120s 2>$null
        Write-Success "Infrastructure ready"

        Write-Host "  [5/6] Deploying application (backend, frontend)..."
        $appFiles = @("06-backend.yaml", "07-frontend.yaml")
        foreach ($f in $appFiles) {
            $src = Join-Path $K8sDir $f
            if (Test-Path $src) {
                $content = Get-Content $src -Raw
                $content = $content -replace "namespace: aicc", "namespace: $Namespace"
                $content = $content -replace "YOUR_REGISTRY/aicc-backend:latest", "${Reg}/aicc-backend:${Tag}"
                $content = $content -replace "YOUR_REGISTRY/aicc-frontend:latest", "${Reg}/aicc-frontend:${Tag}"
                $content = $content -replace "image: YOUR_REGISTRY.*", "image: ${Reg}/aicc-$(if($f -match 'backend'){'backend'}else{'frontend'}):${Tag}"
                $dst = Join-Path $tempDir $f
                $content | Set-Content $dst
                kubectl apply -f $dst
            }
        }

        Write-Host "  Waiting for application pods..."
        kubectl wait --for=condition=ready pod -l app=aicc-backend -n $Namespace --timeout=180s 2>$null
        kubectl wait --for=condition=ready pod -l app=aicc-frontend -n $Namespace --timeout=120s 2>$null
        Write-Success "Application deployed"

        Write-Host "  [6/6] Configuring ingress / NodePort..."
        $devNodePort = 30080
        $prodNodePort = 31080
        $nodePort = if ($Env -eq "dev") { $devNodePort } else { $prodNodePort }

        $svcType = if ($DomainName) { "ClusterIP" } else { "NodePort" }

        $frontendSvcYaml = @"
apiVersion: v1
kind: Service
metadata:
  name: aicc-frontend
  namespace: $Namespace
spec:
  type: $svcType
  $(if ($svcType -eq "NodePort") { "nodePort: $nodePort" })
  selector:
    app: aicc-frontend
  ports:
    - port: 80
      targetPort: 80
      $(if ($svcType -eq "NodePort") { "nodePort: $nodePort" })
"@
        $frontendSvcYaml | Set-Content (Join-Path $tempDir "07-frontend-svc.yaml")
        kubectl apply -f (Join-Path $tempDir "07-frontend-svc.yaml")

        $backendNodePort = if ($Env -eq "dev") { 30800 } else { 31800 }
        $backendSvcYaml = @"
apiVersion: v1
kind: Service
metadata:
  name: aicc-backend
  namespace: $Namespace
spec:
  type: $svcType
  selector:
    app: aicc-backend
  ports:
    - port: 8000
      targetPort: 8000
      $(if ($svcType -eq "NodePort") { "nodePort: $backendNodePort" })
"@
        $backendSvcYaml | Set-Content (Join-Path $tempDir "06-backend-svc.yaml")
        kubectl apply -f (Join-Path $tempDir "06-backend-svc.yaml")

        if ($DomainName) {
            $ingressYaml = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aicc-ingress
  namespace: $Namespace
  annotations:
    kubernetes.io/ingress.class: nginx
    $(if ($Env -eq "prod") { "cert-manager.io/cluster-issuer: letsencrypt-prod" })
    nginx.ingress.kubernetes.io/ssl-redirect: "$(if ($Env -eq "prod") { "true" } else { "false" })"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
spec:
  $(if ($Env -eq "prod") { @"
  tls:
    - hosts:
        - $DomainName
      secretName: aicc-$Env-tls
"@ })
  rules:
    - host: $DomainName
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: aicc-backend
                port:
                  number: 8000
          - path: /health
            pathType: Prefix
            backend:
              service:
                name: aicc-backend
                port:
                  number: 8000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: aicc-frontend
                port:
                  number: 80
"@
            $ingressYaml | Set-Content (Join-Path $tempDir "08-ingress.yaml")
            kubectl apply -f (Join-Path $tempDir "08-ingress.yaml")
        }

        if ($Env -eq "prod") {
            $hpaSrc = Join-Path $K8sDir "09-hpa.yaml"
            if (Test-Path $hpaSrc) {
                $hpaContent = Get-Content $hpaSrc -Raw
                $hpaContent = $hpaContent -replace "namespace: aicc", "namespace: $Namespace"
                $hpaContent | Set-Content (Join-Path $tempDir "09-hpa.yaml")
                kubectl apply -f (Join-Path $tempDir "09-hpa.yaml")
            }
        }

        Write-Success "Deployment complete!"
        Write-Host "`n  ---- Access Information ----" -ForegroundColor Green
        if ($DomainName) {
            Write-Host "  Frontend:  https://$DomainName" -ForegroundColor White
            Write-Host "  Backend:   https://$DomainName/api/v1" -ForegroundColor White
            Write-Host "  Health:    https://$DomainName/health" -ForegroundColor White
        } else {
            $nodeIp = kubectl get nodes -o jsonpath="{.items[0].status.addresses[0].address}" 2>$null
            if (-not $nodeIp) { $nodeIp = "<NODE_IP>" }
            Write-Host "  Frontend:  http://${nodeIp}:$nodePort" -ForegroundColor White
            Write-Host "  Backend:   http://${nodeIp}:$backendNodePort" -ForegroundColor White
            Write-Host "  Health:    http://${nodeIp}:$backendNodePort/health" -ForegroundColor White
        }
        Write-Host "  Namespace: $Namespace" -ForegroundColor White
        Write-Host "  Image Tag: $Tag" -ForegroundColor White
        Write-Host "  Environment: $Env" -ForegroundColor White

    } finally {
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Destroy-Env {
    Write-Step "Destroying $Env environment (namespace: $Namespace)"
    $confirm = Read-Host "  Type 'yes' to confirm deletion of namespace $Namespace"
    if ($confirm -ne "yes") { Write-Host "  Cancelled"; return }
    kubectl delete namespace $Namespace
    Write-Success "Namespace $Namespace deleted"
}

function Show-Status {
    Write-Step "Status for $Env environment"
    Write-Host "  Namespace: $Namespace`n"
    kubectl get all -n $Namespace
    Write-Host "`n  Ingress:"
    kubectl get ingress -n $Namespace 2>$null
}

function Show-Help {
    Write-Host @"

===========================================
  AICC Platform - Alibaba Cloud ACK Deploy
===========================================

Usage:
  .\deploy-ack.ps1 <action> -Env <env> [options]

Actions:
  build              Build Docker images only
  push               Push images to ACR
  deploy             Deploy to ACK (apply K8s manifests)
  build-push-deploy  Full pipeline: build -> push -> deploy
  destroy            Delete the environment namespace
  status             Show deployment status
  help               Show this help

Parameters:
  -Env       Environment: dev | prod (default: dev)
  -Registry  ACR registry URL (e.g. registry.cn-hangzhou.aliyuncs.com/your-ns)
  -Domain    Custom domain (optional, uses NodePort if not set)
  -KubeContext  kubectl context name
  -ImageTag  Custom image tag (auto-generated if not set)

Examples:
  # Dev environment (NodePort 30080)
  .\deploy-ack.ps1 build-push-deploy -Env dev -Registry registry.cn-hangzhou.aliyuncs.com/myns

  # Prod environment with custom domain
  .\deploy-ack.ps1 build-push-deploy -Env prod -Registry registry.cn-hangzhou.aliyuncs.com/myns -Domain aicc.mycompany.com

  # Build only
  .\deploy-ack.ps1 build -Env dev -Registry registry.cn-hangzhou.aliyuncs.com/myns

  # Check status
  .\deploy-ack.ps1 status -Env dev

Port Mapping (NodePort mode):
  Dev:  Frontend=30080  Backend=30800
  Prod: Frontend=31080  Backend=31800

Prerequisites:
  1. Docker installed and logged in to ACR:
     docker login registry.cn-hangzhou.aliyuncs.com
  2. kubectl installed and kubeconfig configured for ACK
  3. Create deploy/env/.env.dev and deploy/env/.env.prod from templates

"@ -ForegroundColor White
}

switch ($Action) {
    "build"    { Build-Images -Reg $Registry -Tag $ImageTag }
    "push"     { Push-Images -Reg $Registry -Tag $ImageTag }
    "deploy"   { Deploy-K8s -Reg $Registry -Tag $ImageTag -DomainName $Domain -KCtx $KubeContext }
    "build-push-deploy" {
        Build-Images -Reg $Registry -Tag $ImageTag
        Push-Images -Reg $Registry -Tag $ImageTag
        Deploy-K8s -Reg $Registry -Tag $ImageTag -DomainName $Domain -KCtx $KubeContext
    }
    "destroy"  { Destroy-Env }
    "status"   { Show-Status }
    "help"     { Show-Help }
}
