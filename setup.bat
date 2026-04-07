@echo off
chcp 65001 >nul
echo 🚀 AI Agency - 智能公司管理平台
echo =================================
echo.

REM Check Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is required. Please install Node.js 18+ first.
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 18 (
    echo ❌ Node.js 18+ is required.
    exit /b 1
)

echo ✅ Node.js detected

REM Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    exit /b 1
)

REM Copy .env if not exists
if not exist .env (
    copy .env.example .env
    echo ✅ Created .env from .env.example
)

REM Create data directory
if not exist data mkdir data

REM Build frontend
echo.
echo 🔨 Building frontend...
call npm run build -w packages/web
if errorlevel 1 (
    echo ❌ Frontend build failed
    exit /b 1
)

REM Build backend
echo.
echo 🔨 Building backend...
call npm run build -w packages/server
if errorlevel 1 (
    echo ❌ Backend build failed
    exit /b 1
)

echo.
echo =================================
echo ✅ Build complete!
echo.
echo Start the application:
echo   npm start
echo.
echo Or use Docker:
echo   docker-compose up -d
echo.
echo The app will be available at http://localhost:3000
