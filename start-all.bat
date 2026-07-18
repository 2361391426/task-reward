@echo off
chcp 65001 >nul
title Task Reward Platform

echo [1/2] Starting backend on port 3001...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>&1
start "Task Reward Backend" cmd /k "cd /d F:\task-reward-miniapp\task-reward-backend && npm run start:local"
timeout /t 4 /nobreak >nul

curl.exe --fail --silent --show-error http://127.0.0.1:3001/api/health >nul 2>&1
if errorlevel 1 (
  echo Backend failed to start. Check the backend window.
  pause
  exit /b 1
)

echo [2/2] Starting merchant admin on port 3000...
start "Merchant Admin" cmd /k "cd /d F:\task-reward-miniapp\merchant-admin && npm run dev"

echo.
echo Backend: http://localhost:3001
echo Merchant Admin: http://localhost:3000
echo Build mini program with npm run build:mp-weixin
pause
