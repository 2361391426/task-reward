@echo off
chcp 65001 >nul
title Task Reward Mini Program

echo Starting backend...
start "Task Reward Backend" cmd /k "cd /d F:\task-reward-miniapp\task-reward-backend && npm run start:local"
timeout /t 3 /nobreak >nul

echo Starting mini program compiler...
start "Mini Program Build" cmd /k "cd /d F:\task-reward-miniapp && npm run dev:mp-weixin"

echo.
echo Backend: http://localhost:3001
echo Build output: dist\dev\mp-weixin
echo
echo Next steps:
echo 1. Open WeChat DevTools
echo 2. Import dist\dev\mp-weixin
echo 3. Enable "Do not verify legal domain"
echo.
echo Merchant demo account:
echo   username: admin
echo   password: admin123
pause
