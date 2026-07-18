#!/usr/bin/env pwsh
# CoreBank — One-Click Setup Script
# Prerequisites: Internet connection + admin rights (for PostgreSQL installer)

$ErrorActionPreference = "Stop"
$banner = @"
╔══════════════════════════════════════════════════════════════════╗
║           CoreBank Enterprise CBS — Setup Wizard                ║
╚══════════════════════════════════════════════════════════════════╝
"@

Write-Host $banner -ForegroundColor Cyan

# ─── 1. Check if Docker Desktop is installed ──────────────────────────────
Write-Host "`n[1/5] Checking Docker..." -ForegroundColor Yellow

$dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$dockerExists = Test-Path $dockerPath

if (-not $dockerExists) {
    Write-Host "Docker Desktop not found. Attempting to download and install..." -ForegroundColor Yellow
    $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
    
    Write-Host "Downloading Docker Desktop (~550 MB)..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" `
            -OutFile $dockerInstaller -UseBasicParsing
        
        Write-Host "Installing Docker Desktop (this may take a few minutes)..." -ForegroundColor Cyan
        Start-Process -FilePath $dockerInstaller -ArgumentList "install", "--quiet" -Wait
        
        Write-Host "Docker Desktop installed. Please restart your computer, then run this script again." -ForegroundColor Green
        Write-Host "After restart, Docker will start automatically." -ForegroundColor Green
        exit 0
    } catch {
        Write-Host "Could not auto-install Docker. Please install Docker Desktop manually:" -ForegroundColor Red
        Write-Host "https://www.docker.com/products/docker-desktop/" -ForegroundColor Blue
        Write-Host "`nAlternatively, install PostgreSQL 15 directly:" -ForegroundColor Yellow
        Write-Host "https://www.postgresql.org/download/windows/" -ForegroundColor Blue
        Write-Host "`nAfter installing PostgreSQL:" -ForegroundColor Yellow
        Write-Host "  1. Open pgAdmin or psql"
        Write-Host "  2. Create database: corebanking"
        Write-Host "  3. Create user: bankadmin with password: banksecurepassword2026"
        Write-Host "  4. Grant all privileges to bankadmin on corebanking"
        Write-Host "`nThen run:  cd backend; npm run prisma:migrate; npm run prisma:seed" -ForegroundColor Cyan
        exit 1
    }
}

# ─── 2. Start Docker ───────────────────────────────────────────────────────
Write-Host "`n[2/5] Starting Docker Desktop..." -ForegroundColor Yellow

$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    Start-Process $dockerPath
    Write-Host "Waiting for Docker to initialize (30s)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 30
}

# Wait for docker daemon
$tries = 0
while ($tries -lt 10) {
    try {
        $null = & docker info 2>&1
        if ($LASTEXITCODE -eq 0) { break }
    } catch {}
    $tries++
    Write-Host "Waiting for Docker daemon... ($tries/10)" -ForegroundColor Gray
    Start-Sleep -Seconds 6
}

if ($tries -ge 10) {
    Write-Host "Docker daemon did not start in time. Please start Docker Desktop manually and re-run." -ForegroundColor Red
    exit 1
}

Write-Host "Docker is running!" -ForegroundColor Green

# ─── 3. Start docker-compose ──────────────────────────────────────────────
Write-Host "`n[3/5] Starting PostgreSQL + Redis containers..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker compose up -d

Write-Host "Waiting 10s for PostgreSQL to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# ─── 4. Run Prisma Migrate + Seed ────────────────────────────────────────
Write-Host "`n[4/5] Running database migrations..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
npx prisma migrate dev --name enterprise_cbs_init

Write-Host "`nRunning database seed..." -ForegroundColor Yellow
npx ts-node prisma/seed.ts

Write-Host "`n✅ Database ready with seed data!" -ForegroundColor Green

# ─── 5. Start servers ─────────────────────────────────────────────────────
Write-Host "`n[5/5] Starting servers..." -ForegroundColor Yellow

Write-Host "`nStarting backend (http://localhost:5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run start:dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Starting frontend (http://localhost:5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host @"

╔══════════════════════════════════════════════════════════════════╗
║                 CoreBank CBS — READY!                           ║
║                                                                  ║
║  Frontend:  http://localhost:5173                               ║
║  Backend:   http://localhost:5000                               ║
║  API Docs:  http://localhost:5000/api                           ║
║                                                                  ║
║  LOGIN CREDENTIALS                                               ║
║  ────────────────                                                ║
║  Super Admin:  superadmin / Admin@1234                          ║
║  Branch Mgr:   mgr_mumbai / Manager@123                         ║
║  Teller:       teller_sunita / Teller@123                       ║
║  Loan Officer: loan_officer_ananya / Loan@1234                  ║
║  Customer:     aditya_rao / Customer@123                        ║
║  Customer:     meera_nair / Customer@123                        ║
╚══════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

Start-Process "http://localhost:5173/login/admin"
