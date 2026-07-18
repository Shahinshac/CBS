#!/bin/bash
# Replit initialization script for Banking System backend

set -e

echo "==================================="
echo "Banking System - Replit Setup"
echo "==================================="

# 1. Initialize PostgreSQL
echo ""
echo "📊 Initializing PostgreSQL..."
if ! pg_isready -h localhost > /dev/null 2>&1; then
    mkdir -p "$PGDATA"
    initdb
    echo "✓ PostgreSQL initialized"
else
    echo "✓ PostgreSQL already running"
fi

# Start PostgreSQL
pg_ctl start || true
sleep 2

# 2. Create database and user
echo ""
echo "🗄️ Setting up database..."
psql -U postgres -tc "SELECT 1 FROM pg_user WHERE usename = 'bankuser'" | grep -q 1 || psql -U postgres -c "CREATE USER bankuser WITH PASSWORD 'bankpass123' CREATEDB"
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'bankmanagement'" | grep -q 1 || psql -U postgres -c "CREATE DATABASE bankmanagement OWNER bankuser"
echo "✓ Database ready"

# 3. Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip install -q -r requirements.txt
echo "✓ Dependencies installed"

# 4. Initialize database schema
echo ""
echo "🔧 Initializing database schema..."
python -c "
from flask import Flask
from app import create_app, db
import os

app = create_app('production')
with app.app_context():
    db.create_all()
    print('✓ Database schema initialized')
" || echo "⚠️ Schema may already exist"

# 5. Generate secure keys
echo ""
echo "🔐 Checking environment variables..."
if [ ! -f ".env" ]; then
    echo "Creating .env file with secure keys..."
    python -c "
import secrets
import os

secret_key = secrets.token_urlsafe(32)
jwt_secret = secrets.token_urlsafe(32)

# Default CORS origins (local development)
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')

with open('.env', 'w') as f:
    f.write(f'''FLASK_ENV=production
FLASK_APP=run.py
DATABASE_URL=postgresql://bankuser:bankpass123@localhost:5432/bankmanagement
SECRET_KEY={secret_key}
JWT_SECRET_KEY={jwt_secret}
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=604800
CORS_ORIGINS={cors_origins}
BCRYPT_LOG_ROUNDS=12
DEBUG=False
''')
    "
    echo "✓ .env file created with secure keys"
else
    echo "✓ .env file already exists"
fi

# 6. Start Flask app
echo ""
echo "🚀 Starting Flask application..."
echo "    API URL: http://localhost:5000"
echo "    Docs:    http://localhost:5000/api/docs"
echo ""
python run.py
