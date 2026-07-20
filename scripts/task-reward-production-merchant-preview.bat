@echo off
setlocal
title TaskReward Production Merchant Preview

set "ROOT=F:\task-reward-miniapp"
set "MERCHANT_DIR=%ROOT%\merchant-admin"
set "API_URL=https://1455441725-f1qvv2j2lt.ap-guangzhou.tencentscf.com/api"
set "MERCHANT_URL=http://127.0.0.1:3010"

echo.
echo ===== TaskReward Production Merchant Preview =====
echo Merchant Admin: %MERCHANT_URL%
echo Production API: %API_URL%
echo.

if not exist "%MERCHANT_DIR%\package.json" (
  echo Merchant admin path not found: %MERCHANT_DIR%
  pause
  exit /b 1
)

echo Starting merchant admin preview on port 3010 with production API...
start "TaskReward Merchant Production 3010" cmd /k "pushd %MERCHANT_DIR% && call npm.cmd run dev -- --mode production --host 0.0.0.0 --port 3010"

echo.
echo Only merchant admin is started.
echo Local backend 3001 is NOT started by this script.
echo Open after startup:
echo %MERCHANT_URL%
echo.

start "" "%MERCHANT_URL%"

pause
endlocal
