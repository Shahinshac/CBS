#!/bin/bash
# Quick setup script for local development

set -e

echo "======================================"
echo "Banking System - Local Setup"
echo "======================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11+"
    exit 1
fi
echo "✓ Python $(python3 --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js 18+"
    exit 1
fi
echo "✓ npm $(npm --version)"

if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Backend will use SQLite for testing."
else
    echo "✓ PostgreSQL installed"
fi

echo ""
echo "Setting up backend..."
cd backend || exit 1

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
source venv/bin/activate || . venv/Scripts/activate || true

# Install dependencies
echo "Installing Python dependencies..."
pip install -q -r requirements.txt
echo "✓ Backend dependencies installed"

# Create .env from example
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✓ Created .env file (configure as needed)"
fi

cd ..

echo ""
echo "Setting up frontend..."
cd frontend || exit 1

# Install Node dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
    echo "✓ Frontend dependencies installed"
else
    echo "✓ Node modules already installed"
fi

# Create .env from example
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || echo "REACT_APP_API_URL=http://localhost:5000" > .env
    echo "✓ Created frontend .env file"
fi

cd ..

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Terminal 1 - Start Backend:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python run.py"
echo ""
echo "2. Terminal 2 - Start Frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "3. Open browser:"
echo "   http://localhost:5173"
echo ""
echo "4. Run tests (Terminal 3):"
echo "   cd backend"
echo "   pytest test_*.py"
echo ""
