@echo off
chcp 65001 >nul
title AI Agency - 停止服务

echo.
echo 🛑 正在停止 AI Agency 服务...
echo.

REM 查找并终止 Node.js 进程（端口 3000 和 5173）
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo 正在终止进程 %%a (端口 3000^)
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo 正在终止进程 %%a (端口 5173^)
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo ✅ 服务已停止
echo.
pause
