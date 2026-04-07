@echo off
chcp 65001 >nul
echo 🚀 AI Agency - Development Mode
echo ================================
echo.

REM Check .env
if not exist .env (
    echo ⚠️  .env not found, creating from .env.example...
    copy .env.example .env
)

REM Check node_modules
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
)

REM Create data directory
if not exist data mkdir data

echo.
echo Starting development servers...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.

call npm run dev
