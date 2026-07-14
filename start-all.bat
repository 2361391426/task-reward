@echo off
chcp 65001 >nul
title Task Reward Platform

echo [1/2] Starting backend on port 3001...
start "Task Reward Backend" cmd /k "cd /d F:\task-reward-miniapp\task-reward-backend && npm run start:local"

echo [2/2] Starting merchant admin on port 3000...
start "Merchant Admin" cmd /k "cd /d F:\task-reward-miniapp\merchant-admin && npm run dev"

echo.
echo Backend: http://localhost:3001
echo Merchant Admin: http://localhost:3000
echo Mini program: run `npm run dev:mp-weixin` from the repo root
timeout /t 3 /nobreak >nul
