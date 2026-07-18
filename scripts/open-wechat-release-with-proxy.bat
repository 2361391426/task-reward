@echo off
setlocal
chcp 65001 >nul
title Task Reward Production Preview

set "PROJECT_ROOT=F:\task-reward-miniapp"
set "WECHAT_CLI=F:\微信web开发者工具\cli.bat"
set "PROXY_URL=http://127.0.0.1:7890"
set "RELEASE_DIR=%PROJECT_ROOT%\dist\build\mp-weixin"

netstat -ano | findstr ":7890" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Clash 未运行或 7890 端口未监听，请先启动 Clash。
  pause
  exit /b 1
)

echo 正在构建最新正式包...
pushd "%PROJECT_ROOT%"
call npm run build:mp-weixin:release
if errorlevel 1 (
  popd
  echo 正式包构建失败，请查看上方错误。
  pause
  exit /b 1
)
popd

set "HTTP_PROXY=%PROXY_URL%"
set "HTTPS_PROXY=%PROXY_URL%"
set "ALL_PROXY=%PROXY_URL%"
set "NO_PROXY=localhost,127.0.0.1,192.168.3.22"

echo 正在关闭旧的微信开发者工具实例...
call "%WECHAT_CLI%" quit >nul 2>&1
timeout /t 2 /nobreak >nul

echo 正在通过 Clash 打开最新正式包...
call "%WECHAT_CLI%" open --project "%RELEASE_DIR%" --lang zh
if errorlevel 1 (
  echo 微信开发者工具启动失败，请确认安装路径：%WECHAT_CLI%
  pause
  exit /b 1
)

echo.
echo 正式包目录：%RELEASE_DIR%
echo 开发者工具代理：%PROXY_URL%
echo 真机同一 Wi-Fi 测试代理：192.168.3.22:7890
echo.
echo 注意：手机仅测试时设置 Wi-Fi 手动代理，测试结束后请恢复为无代理。
pause
endlocal
