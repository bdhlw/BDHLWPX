@echo off
chcp 65001 >nul
title Course Board
cd /d "%~dp0"

set PORT=8088
set HOST=0.0.0.0

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Please install Node.js LTS from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=1" %%b in ("%%a") do set LANIP=%%b
)

echo Starting course board ...
echo   local   http://127.0.0.1:%PORT%
if defined LANIP echo   LAN     http://%LANIP%:%PORT%
echo Keep this window open. Close it to stop the server.
echo.

start "" "http://127.0.0.1:%PORT%"
node server.js

echo.
echo Server stopped.
pause
