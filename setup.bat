@echo off
title RadioLive - Setup
color 0F

echo.
echo  ================================
echo   RadioLive - Windows Setup
echo  ================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo Download from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

:: Check npm
for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
echo [OK] npm %NPM_VER%

:: Install pnpm
echo.
echo Installing pnpm...
call npm install -g pnpm 2>nul
echo [OK] pnpm installed

:: Install dependencies
echo.
echo Installing project dependencies...
call pnpm install
echo [OK] Dependencies installed

:: Copy .env if not exists
if not exist .env (
    copy .env.example .env >nul
    echo [OK] Created .env from .env.example
) else (
    echo [OK] .env already exists
)

:: Start database
echo.
echo Starting PostgreSQL and Redis via Docker...
docker compose up -d database redis 2>nul
if %errorlevel% equ 0 (
    echo [OK] Docker services started
    echo Waiting for PostgreSQL to be ready...
    timeout /t 5 /nobreak >nul
) else (
    echo [WARN] Docker not found or not running
    echo Install Docker Desktop: https://docker.com
    echo.
    echo You can also install PostgreSQL and Redis manually:
    echo   PostgreSQL: https://postgresql.org
    echo   Redis: https://redis.io
)

:: Run migrations
echo.
echo Running database migrations...
set DATABASE_URL=postgresql://radio:radio_secret@localhost:5432/radiolive
cd services/api
call npx tsx src/db/migrate.ts
echo [OK] Migrations complete

:: Seed database
echo.
echo Seeding database...
call npx tsx src/db/seed.ts
echo [OK] Database seeded
cd ..

echo.
echo  ================================
echo   Setup Complete!
echo  ================================
echo.
echo  Next steps:
echo    1. Run start.bat to launch the app
echo    2. Open http://localhost:3000
echo    3. Login: admin@radiolive.dev / admin123
echo.
pause
