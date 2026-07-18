"""
Entry point for the Flask application
MongoDB + MongoEngine
"""
import os
import sys

# Add current directory to path for config imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from app import create_app

# Load environment variables from .env file
load_dotenv()

# Set environment
os.environ.setdefault("FLASK_ENV", "development")
app = create_app(os.getenv("FLASK_ENV", "development"))


if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"], host="0.0.0.0", port=5000)
