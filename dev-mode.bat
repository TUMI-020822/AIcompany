@echo off
chcp 65001 >nul
title AI Agency - 开发模式

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║       AI Agency - 开发模式                                ║
echo ║       热重载 + 实时编译                                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM 切换到项目目录
cd /d "%~dp0"

REM 检查 Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 18 或更高版本
    pause
    exit /b 1
)

REM 检查 .env
if not exist .env (
    copy .env.example .env >nul
    echo ✅ 已创建 .env 文件，请配置 API Key 后重新运行
    notepad .env
    exit /b 0
)

REM 检查依赖
if not exist node_modules (
    echo 📦 安装依赖...
    call npm install
)

REM 创建目录
if not exist data mkdir data
if not exist logs mkdir logs

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║   🌐 前端页面: http://localhost:5173                       ║
echo ║   🔧 后端服务: http://localhost:3000                       ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 💡 提示: 浏览器将自动打开前端页面
echo.
echo 按 Ctrl+C 停止服务
echo.

REM 延迟 3 秒后打开浏览器
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

call npm run dev
