@echo off
setlocal
title TaskReward Production Build

set "ROOT=F:\task-reward-miniapp"
set "API_URL=https://1455441725-f1qvv2j2lt.ap-guangzhou.tencentscf.com/api"
set "BACKEND_ZIP=%ROOT%\task-reward-backend\dist-scf\taskreward-scf.zip"
set "MINIAPP_DIST=%ROOT%\dist\build\mp-weixin"
set "MERCHANT_DIST=%ROOT%\merchant-admin\dist"

echo.
echo ===== TaskReward Production Build =====
echo API: %API_URL%
echo.

if not exist "%ROOT%\package.json" (
  echo Project path not found: %ROOT%
  pause
  exit /b 1
)

echo [1/3] Build Tencent SCF backend package...
pushd "%ROOT%\task-reward-backend"
call npm.cmd run build:scf
if errorlevel 1 (
  echo Backend package build failed.
  popd
  pause
  exit /b 1
)
popd

echo.
echo [2/3] Build WeChat miniapp release package...
pushd "%ROOT%"
call npm.cmd run build:mp-weixin:release
if errorlevel 1 (
  echo Miniapp release build failed.
  popd
  pause
  exit /b 1
)
popd

echo.
echo [3/3] Build merchant admin production package...
pushd "%ROOT%\merchant-admin"
call npm.cmd run build
if errorlevel 1 (
  echo Merchant admin build failed.
  popd
  pause
  exit /b 1
)
popd

echo.
echo ===== Build Finished =====
echo Backend SCF zip: %BACKEND_ZIP%
echo Miniapp release: %MINIAPP_DIST%
echo Merchant admin dist: %MERCHANT_DIST%
echo Health check: %API_URL%/health
echo.
echo Next:
echo 1. Upload backend zip to Tencent SCF and publish.
echo 2. Import miniapp release folder into WeChat DevTools and upload.
echo 3. Upload merchant admin dist to your hosting service.
echo.

if exist "%BACKEND_ZIP%" explorer.exe /select,"%BACKEND_ZIP%"
if exist "%MINIAPP_DIST%" start "" "%MINIAPP_DIST%"
if exist "%MERCHANT_DIST%" start "" "%MERCHANT_DIST%"

pause
endlocal
