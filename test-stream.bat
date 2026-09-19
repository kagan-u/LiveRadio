@echo off
title RadioLive - Stream Test
color 0E

echo.
echo  ================================
echo   RadioLive - Audio Stream Test
echo  ================================
echo.
echo  This sends test audio to Icecast.
echo  Make sure Icecast is running on port 8000.
echo.

:: Check ffmpeg
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] FFmpeg not found!
    echo Download from: https://ffmpeg.org
    echo.
    pause
    exit /b 1
)

echo [OK] FFmpeg found
echo.
echo Stream key from DJ Panel: 
set /p STREAM_KEY="Enter stream key: "

if "%STREAM_KEY%"=="" (
    echo [ERROR] Stream key required
    pause
    exit /b 1
)

echo.
echo Starting test stream (sine wave)...
echo Open http://localhost:8000/live to listen
echo Press Ctrl+C to stop
echo.

ffmpeg -f lavfi -i "sine=frequency=440:duration=300" -f mp3 -b:a 192k -content_type audio/mpeg "http://source:%STREAM_KEY%@localhost:8000/live"
