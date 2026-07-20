@echo off
setlocal
title TaskReward Local Merchant

set "ROOT=F:\task-reward-miniapp"
set "BACKEND_DIR=%ROOT%\task-reward-backend"
set "MERCHANT_DIR=%ROOT%\merchant-admin"
set "BACKEND_URL=http://127.0.0.1:3001/api"
set "MERCHANT_URL=http://127.0.0.1:3000"

echo.
echo ===== TaskReward Local Merchant =====
echo Backend API: %BACKEND_URL%
echo Merchant Admin: %MERCHANT_URL%
echo.

if not exist "%ROOT%\package.json" (
  echo Project path not found: %ROOT%
  pause
  exit /b 1
)

if not exist "%BACKEND_DIR%\package.json" (
  echo Backend path not found: %BACKEND_DIR%
  pause
  exit /b 1
)

if not exist "%MERCHANT_DIR%\package.json" (
  echo Merchant admin path not found: %MERCHANT_DIR%
  pause
  exit /b 1
)

echo Starting local backend on port 3001...
start "TaskReward Backend 3001" cmd /k "pushd %BACKEND_DIR% && call npm.cmd run start:local"

echo Starting merchant admin on port 3000...
start "TaskReward Merchant 3000" cmd /k "pushd %MERCHANT_DIR% && call npm.cmd run dev -- --host 0.0.0.0 --port 3000"

echo.
echo Two service windows have been opened.
echo Open merchant admin after startup:
echo %MERCHANT_URL%
echo.
echo For phone access, replace 127.0.0.1 with your computer LAN IP.
echo Miniapp real-device test should still use the HTTPS production API.
echo.

start "" "%MERCHANT_URL%"

pause
endlocal
