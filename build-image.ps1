param(
    [Parameter(Position=0)]
    [ValidateSet("build", "save", "load", "push", "all", "help")]
    [string]$Action = "help",

    [string]$ImageName = "aicc-platform",
    [string]$ImageTag = "latest",
    [string]$Registry = "",
    [string]$OutputDir = "./dist"
)

$ErrorActionPreference = "Stop"
$ImageFull = "${ImageName}:${ImageTag}"

function Write-Step($msg) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Build-Image {
    Write-Step "Building Docker Image: $ImageFull"
    docker build -t $ImageFull -f Dockerfile .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed!"
        exit 1
    }
    Write-Host "[OK] Image built: $ImageFull" -ForegroundColor Green
    docker images $ImageName
}

function Save-Image {
    Write-Step "Saving Image to Tar File"
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }
    $tarFile = Join-Path $OutputDir "${ImageName}-${ImageTag}.tar"
    $gzFile = "${tarFile}.gz"

    Write-Host "Saving to: $tarFile"
    docker save -o $tarFile $ImageFull
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Save failed!"
        exit 1
    }

    $sizeMB = [math]::Round((Get-Item $tarFile).Length / 1MB, 1)
    Write-Host "[OK] Tar saved: $tarFile ($sizeMB MB)" -ForegroundColor Green

    Write-Host "Compressing with gzip..."
    if (Get-Command gzip -ErrorAction SilentlyContinue) {
        gzip -f $tarFile
        $gzSizeMB = [math]::Round((Get-Item $gzFile).Length / 1MB, 1)
        Write-Host "[OK] Gzipped: $gzFile ($gzSizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "[SKIP] gzip not found, tar file is ready for upload" -ForegroundColor Yellow
    }
}

function Load-Image {
    Write-Step "Loading Image from Tar File"
    $tarFile = Join-Path $OutputDir "${ImageName}-${ImageTag}.tar"
    $gzFile = "${tarFile}.gz"

    if (Test-Path $gzFile) {
        Write-Host "Decompressing $gzFile..."
        if (Get-Command gunzip -ErrorAction SilentlyContinue) {
            gunzip -k $gzFile
        } else {
            Write-Error "gunzip not found. Please decompress $gzFile manually first."
            exit 1
        }
    }

    if (-not (Test-Path $tarFile)) {
        Write-Error "Tar file not found: $tarFile"
        exit 1
    }

    docker load -i $tarFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Load failed!"
        exit 1
    }
    Write-Host "[OK] Image loaded: $ImageFull" -ForegroundColor Green
}

function Push-Image {
    if (-not $Registry) {
        Write-Error "Registry is required for push. Use -Registry <registry-url>"
        Write-Host "Example: .\build-image.ps1 push -Registry registry.cn-hangzhou.aliyuncs.com/your-namespace"
        exit 1
    }

    Write-Step "Pushing Image to Registry: $Registry"
    $remoteImage = "${Registry}/${ImageName}:${ImageTag}"

    docker tag $ImageFull $remoteImage
    Write-Host "Tagged: $remoteImage"
    Write-Host "Pushing (login may be required)..."
    docker push $remoteImage
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Push failed! Try: docker login $Registry"
        exit 1
    }
    Write-Host "[OK] Pushed: $remoteImage" -ForegroundColor Green
}

switch ($Action) {
    "build" { Build-Image }
    "save"  { Save-Image }
    "load"  { Load-Image }
    "push"  { Push-Image }
    "all"   {
        Build-Image
        Save-Image
        Write-Step "All Done!"
        Write-Host ""
        Write-Host "Next steps for ECS deployment:" -ForegroundColor Yellow
        Write-Host "  1. Upload the tar file to ECS:" -ForegroundColor White
        Write-Host "     scp ./dist/${ImageName}-${ImageTag}.tar* root@<ECS_IP>:/opt/aicc/" -ForegroundColor Gray
        Write-Host "  2. On ECS, load the image:" -ForegroundColor White
        Write-Host "     docker load -i /opt/aicc/${ImageName}-${ImageTag}.tar" -ForegroundColor Gray
        Write-Host "  3. Copy docker-compose.ecs.yml and .env.ecs to ECS" -ForegroundColor White
        Write-Host "  4. On ECS, start services:" -ForegroundColor White
        Write-Host "     docker compose -f docker-compose.ecs.yml --env-file .env.ecs up -d" -ForegroundColor Gray
    }
    "help" {
        Write-Host ""
        Write-Host "AICC Platform - Docker Image Build Tool" -ForegroundColor Cyan
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage: .\build-image.ps1 <action> [options]" -ForegroundColor White
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor Yellow
        Write-Host "  build   - Build Docker image" -ForegroundColor White
        Write-Host "  save    - Save image to tar file (for manual upload)" -ForegroundColor White
        Write-Host "  load    - Load image from tar file" -ForegroundColor White
        Write-Host "  push    - Push image to container registry" -ForegroundColor White
        Write-Host "  all     - Build + Save (recommended)" -ForegroundColor White
        Write-Host "  help    - Show this help" -ForegroundColor White
        Write-Host ""
        Write-Host "Options:" -ForegroundColor Yellow
        Write-Host "  -ImageName    Image name (default: aicc-platform)" -ForegroundColor White
        Write-Host "  -ImageTag     Image tag (default: latest)" -ForegroundColor White
        Write-Host "  -Registry     Container registry URL (for push)" -ForegroundColor White
        Write-Host "  -OutputDir    Output directory for tar (default: ./dist)" -ForegroundColor White
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor Yellow
        Write-Host "  .\build-image.ps1 all" -ForegroundColor Gray
        Write-Host "  .\build-image.ps1 build -ImageTag v1.0.0" -ForegroundColor Gray
        Write-Host "  .\build-image.ps1 push -Registry registry.cn-hangzhou.aliyuncs.com/ns" -ForegroundColor Gray
    }
}
