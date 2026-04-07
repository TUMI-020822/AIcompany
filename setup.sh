#!/bin/bash
set -e

echo "🚀 AI Agency — 智能公司管理平台"
echo "================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy .env if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
fi

# Build frontend
echo ""
echo "🔨 Building frontend..."
npm run build -w packages/web

# Build backend
echo ""
echo "🔨 Building backend..."
npm run build -w packages/server

# Create data directory
mkdir -p data

echo ""
echo "================================"
echo "✅ Build complete!"
echo ""
echo "Start the application:"
echo "  npm start"
echo ""
echo "Or use Docker:"
echo "  docker-compose up -d"
echo ""
echo "The app will be available at http://localhost:3000"
