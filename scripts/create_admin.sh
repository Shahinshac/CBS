#!/bin/bash
# Create initial admin user for 26-07 RESERVE BANK
# Usage: bash scripts/create_admin.sh

set -e

echo "🔧 Creating admin user for 26-07 RESERVE BANK..."
echo ""

# Navigate to backend directory
cd backend

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the Flask CLI command
python -m flask create-admin

echo ""
echo "✅ Admin setup complete!"
echo ""
echo "Login with:"
echo "   Username: shahinsha"
echo "   Password: 262007"
