#!/bin/bash
# AI Agency 启动脚本（开发模式）

set -e

echo "🚀 AI Agency - Development Mode"
echo "================================"
echo ""

# Check .env
if [ ! -f .env ]; then
    echo "⚠️  .env not found, creating from .env.example..."
    cp .env.example .env
fi

# Check node_modules
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create data directory
mkdir -p data

echo ""
echo "Starting development servers..."
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""

npm run dev
