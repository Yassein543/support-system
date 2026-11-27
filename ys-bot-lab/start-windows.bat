@echo off
cd /d "%~dp0"
node --version >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or later is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
node server.js
pause
