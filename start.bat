@echo off
set "PATH=C:\Program Files\PostgreSQL\16\bin;%PATH%"
set "PGPASSWORD=262007"

echo ==========================================================
echo        CoreBank Enterprise CBS - Quick Start
echo ==========================================================
echo.

where psql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] psql CLI not found in PATH.
    echo Please verify C:\Program Files\PostgreSQL\16\bin exists.
    pause
    exit /b 1
)

echo [OK] PostgreSQL CLI found.
echo.
echo [Step 1/4] Setting up PostgreSQL database...
echo.

psql -h localhost -p 5432 -U postgres -c "CREATE USER bankadmin WITH PASSWORD 'banksecurepassword2026';" 2>nul
psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE corebanking OWNER bankadmin;" 2>nul
psql -h localhost -p 5432 -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE corebanking TO bankadmin;" 2>nul

echo [OK] Database setup checks completed.
echo.
echo [Step 2/4] Running database migrations...
cd backend
call npx prisma migrate dev --name init

echo.
echo [Step 3/4] Seeding database...
call npx ts-node prisma/seed.ts

echo.
echo [Step 4/4] Starting servers...
start "CoreBank Backend" cmd /k "cd /d %~dp0backend && npm run start:dev"
timeout /t 3 /nobreak >nul
start "CoreBank Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 /nobreak >nul

echo ==========================================================
echo                 CoreBank CBS - RUNNING!
echo ==========================================================
start http://localhost:5173/login/admin
