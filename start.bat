@echo off
chcp 65001 >nul
title AI Agency - 智能公司管理平台

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║       AI Agency - 智能公司管理平台                        ║
echo ║       多智能体协作办公系统                                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM 切换到项目目录
cd /d "%~dp0"

REM 检查 Node.js
echo [1/5] 检查 Node.js 环境...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 18 或更高版本
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VER=%%a
echo ✅ Node.js 版本: %NODE_VER%

REM 检查 .env 文件
echo.
echo [2/5] 检查配置文件...
if not exist .env (
    echo ⚠️  .env 文件不存在，正在创建...
    copy .env.example .env >nul
    echo ✅ 已创建 .env 文件
    echo.
    echo 📝 提示: 请编辑 .env 文件配置你的 API Key
    echo    - DEEPSEEK_API_KEY (推荐，国内可直接访问)
    echo    - OPENAI_API_KEY
    echo    - ANTHROPIC_API_KEY
    echo.
    notepad .env
) else (
    echo ✅ .env 文件已存在
)

REM 创建必要目录
if not exist data mkdir data
if not exist logs mkdir logs

REM 检查依赖
echo.
echo [3/5] 检查依赖...
if not exist node_modules (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 依赖已安装
)

REM 构建项目（首次运行或代码更新后）
echo.
echo [4/5] 构建项目...
if not exist packages\server\dist\index.js (
    echo 🔨 正在构建...
    call npm run build
    if errorlevel 1 (
        echo ❌ 构建失败
        pause
        exit /b 1
    )
) else if not exist packages\web\dist\index.html (
    echo 🔨 前端未构建，正在构建...
    call npm run build -w packages/web
    if errorlevel 1 (
        echo ❌ 前端构建失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 项目已构建
)

REM 启动服务
echo.
echo [5/5] 启动服务...
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║   🌐 访问地址: http://localhost:3000                       ║
echo ║                                                            ║
echo ║   📖 API 文档:  http://localhost:3000/api/health           ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 💡 提示: 浏览器将自动打开，如未打开请手动访问上述地址
echo.
echo 按 Ctrl+C 停止服务
echo.

REM 延迟 3 秒后打开浏览器
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

call npm start
