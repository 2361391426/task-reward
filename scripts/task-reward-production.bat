@echo off
chcp 65001 >nul
setlocal
title 诺斯马丁生产发布构建

set "ROOT=F:\task-reward-miniapp"
set "API_URL=https://1455441725-f1qvv2j2lt.ap-guangzhou.tencentscf.com/api"
set "BACKEND_ZIP=%ROOT%\task-reward-backend\dist-scf\taskreward-scf.zip"
set "MINIAPP_DIST=%ROOT%\dist\build\mp-weixin"
set "MERCHANT_DIST=%ROOT%\merchant-admin\dist"

echo.
echo ===== 诺斯马丁生产发布构建 =====
echo 接口地址: %API_URL%
echo.

if not exist "%ROOT%\package.json" (
  echo 未找到项目目录: %ROOT%
  pause
  exit /b 1
)

echo [1/4] 校验小程序发布配置...
pushd "%ROOT%"
call npm.cmd run check:release
if errorlevel 1 (
  echo 小程序发布配置校验失败。
  popd
  pause
  exit /b 1
)
popd

echo.
echo [2/4] 构建腾讯云函数后端包...
pushd "%ROOT%\task-reward-backend"
call npm.cmd run build:scf
if errorlevel 1 (
  echo 后端云函数包构建失败。
  popd
  pause
  exit /b 1
)
popd

echo.
echo [3/4] 构建微信小程序正式包...
pushd "%ROOT%"
call npm.cmd run build:mp-weixin:release
if errorlevel 1 (
  echo 微信小程序正式包构建失败。
  popd
  pause
  exit /b 1
)
popd

echo.
echo [4/4] 构建商家后台生产包...
pushd "%ROOT%\merchant-admin"
call npm.cmd run build
if errorlevel 1 (
  echo 商家后台构建失败。
  popd
  pause
  exit /b 1
)
popd

echo.
echo ===== 构建完成 =====
echo 后端云函数包: %BACKEND_ZIP%
echo 小程序正式包: %MINIAPP_DIST%
echo 商家后台包: %MERCHANT_DIST%
echo 健康检查: %API_URL%/health
echo.
echo 下一步:
echo 1. 如果已配置 GitHub Actions，推送代码后会自动发布后端。
echo 2. 微信开发者工具导入 %MINIAPP_DIST% 后上传体验版或正式版。
echo 3. 商家后台 dist 按当前托管方式发布。
echo 4. 发布后执行后端冒烟测试：cd /d "%ROOT%\task-reward-backend" && set API_BASE=%API_URL% && npm run smoke
echo.

if exist "%BACKEND_ZIP%" explorer.exe /select,"%BACKEND_ZIP%"
if exist "%MINIAPP_DIST%" start "" "%MINIAPP_DIST%"
if exist "%MERCHANT_DIST%" start "" "%MERCHANT_DIST%"

pause
endlocal
