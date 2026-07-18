@echo off
chcp 65001 >nul
title Task Reward Mini Program

set "ROOT=F:\task-reward-miniapp"

echo Building mini program...
pushd "%ROOT%"
call npm run build:mp-weixin
if errorlevel 1 (
  echo Build failed. Check the error above.
  popd
  pause
  exit /b 1
)
popd

echo Stopping old backend on port 3001...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>&1

echo Starting backend...
start "Task Reward Backend" cmd /k "cd /d %ROOT%\task-reward-backend && npm run start:local"
timeout /t 4 /nobreak >nul

curl.exe --fail --silent --show-error http://127.0.0.1:3001/api/health >nul 2>&1
if errorlevel 1 (
  echo Backend failed to start. Check the backend window.
  pause
  exit /b 1
)

echo.
echo Backend: http://localhost:3001
echo LAN API for real device: http://192.168.3.22:3001
echo Mini program output: dist\build\mp-weixin
echo Import this output directory in WeChat DevTools.
echo Enable "Do not verify legal domain" for local testing.
pause
