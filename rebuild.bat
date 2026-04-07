@echo off
chcp 65001 >nul
title AI Agency - 重新构建

echo.
echo 🔨 AI Agency - 重新构建项目
echo.

cd /d "%~dp0"

echo [1/2] 清理旧构建...
if exist packages\server\dist rd /s /q packages\server\dist
if exist packages\web\dist rd /s /q packages\web\dist

echo [2/2] 重新构建...
call npm run build

if errorlevel 1 (
    echo.
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo.
echo ✅ 构建完成！
echo.
pause
