@echo off
title RadioLive - Running
color 0F

echo.
echo  ================================
echo   RadioLive - Starting Services
echo  ================================
echo.

:: Kill existing processes
taskkill /F /IM node.exe >nul 2>nul

:: Check if Docker is running
docker ps >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Docker is running
    docker compose up -d database redis icecast 2>nul
    echo [OK] Docker services started
    echo Waiting for services...
    timeout /t 5 /nobreak >nul
) else (
    echo [WARN] Docker not running, starting without Docker
    echo Make sure PostgreSQL, Redis, and Icecast are running manually
)

echo.
echo Starting API server...
set DATABASE_URL=postgresql://radio:radio_secret@localhost:5432/radiolive
set REDIS_URL=redis://localhost:6379
set JWT_SECRET=dev-jwt-secret-change-in-production
set CORS_ORIGIN=http://localhost:3000
set API_PORT=4000

cd services/api
start "RadioLive API" cmd /c "npx tsx src/index.ts"
cd ..

echo Starting Web server...
set NEXT_PUBLIC_API_URL=http://localhost:4000
set NEXT_PUBLIC_WS_URL=ws://localhost:4000
set NEXT_PUBLIC_STREAM_URL=http://localhost:8000/live

cd apps/web
start "RadioLive Web" cmd /c "npx next dev --port 3000"
cd ..

echo.
echo  ================================
echo   RadioLive is running!
echo  ================================
echo.
echo  Web:     http://localhost:3000
echo  API:     http://localhost:4000
echo  Icecast: http://localhost:8000
echo.
echo  Login: admin@radiolive.dev / admin123
echo.
echo  Press any key to stop all services...
pause >nul

echo.
echo Stopping services...
taskkill /F /IM node.exe >nul 2>nul
docker compose stop database redis icecast >nul 2>nul
echo [OK] All services stopped
timeout /t 2 /nobreak >nul
