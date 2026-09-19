@echo off
title RadioLive - Docker Setup
color 0B

echo.
echo  ================================
echo   RadioLive - Docker Setup
echo  ================================
echo.

:: Check Docker
docker --version >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker not found!
    echo Install Docker Desktop: https://docker.com
    pause
    exit /b 1
)

echo [OK] Docker found
echo.

:: Build and start
echo Building and starting all services...
docker compose up -d --build

echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Checking services...
docker compose ps

echo.
echo  ================================
echo   Services running!
echo  ================================
echo.
echo  PostgreSQL: localhost:5432
echo  Redis:      localhost:6379
echo  Icecast:    localhost:8000
echo.
echo  Run 'start.bat' to launch API and Web
echo.
pause
