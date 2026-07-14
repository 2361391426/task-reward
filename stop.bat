@echo off
chcp 65001 >nul
title Stop Task Reward Platform

echo Stopping node processes...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo All local services stopped.
pause
