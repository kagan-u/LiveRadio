@echo off
title RadioLive - Stop
color 0C

echo.
echo  Stopping RadioLive services...
echo.

taskkill /F /IM node.exe >nul 2>nul
echo [OK] Node.js processes stopped

docker compose stop >nul 2>nul
echo [OK] Docker services stopped

echo.
echo  All services stopped.
echo.
timeout /t 2 /nobreak >nul
