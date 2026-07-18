"""
Flask application factory and initialization
MongoDB Configuration
"""
from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
import os
import logging

from flask_sqlalchemy import SQLAlchemy

# Initialize extensions
jwt = JWTManager()
db = SQLAlchemy()


def create_app(config_name=None):
    """
    Application factory pattern

    Args:
        config_name: Configuration environment (development, testing, production)

    Returns:
        Configured Flask application
    """
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    # Import config
    from config import config

    # Create app
    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config["default"]))

    # Configure SQLAlchemy database URI fallback
    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///bankmanagement.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Initialize DB
    db.init_app(app)

    with app.app_context():
        # Import models to register them
        from app.models.user import User, Role
        from app.models.account import Account
        from app.models.transaction import Transaction
        db.create_all()

    # Initialize JWT
    jwt.init_app(app)

    # Configure CORS with environment-based origins
    cors_origins = app.config.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    CORS(app, resources={r"/api/*": {"origins": cors_origins}})

    # Setup logging
    _setup_logging(app)

    # Register error handlers
    _register_error_handlers(app)

    # Register blueprints
    _register_blueprints(app)

    app.logger.info(f"Application initialized in {config_name} mode")

    return app


def _setup_logging(app):
    """Configure logging"""
    if not app.debug:
        if not os.path.exists("logs"):
            os.makedirs("logs")

        file_handler = logging.FileHandler("logs/banking_system.log")
        file_handler.setLevel(logging.INFO)

        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        file_handler.setFormatter(formatter)
        app.logger.addHandler(file_handler)


def _register_error_handlers(app):
    """Register global error handlers"""
    from app.utils.exceptions import BankingException

    @app.errorhandler(400)
    def bad_request(error):
        return {"error": "Bad request", "message": str(error)}, 400

    @app.errorhandler(404)
    def not_found(error):
        return {"error": "Not found", "message": str(error)}, 404

    @app.errorhandler(500)
    def internal_error(error):
        return {"error": "Internal server error", "message": str(error)}, 500

    @app.errorhandler(BankingException)
    def handle_banking_exception(error):
        """Handle custom banking exceptions"""
        return {"error": error.message}, error.status_code


def _register_blueprints(app):
    """Register API blueprints"""
    from app.routes.auth_secure import auth_bp
    from app.routes.users import users_bp
    from app.routes.accounts import accounts_bp
    from app.routes.transactions import transactions_bp
    from app.routes.loans import loans_bp
    from app.routes.beneficiaries import beneficiaries_bp
    from app.routes.cards import cards_bp, atm_bp
    from app.routes.scheduled_payments import scheduled_payments_bp
    from app.routes.bills import bills_bp
    from app.routes.notifications import notifications_bp
    from app.routes.analytics import analytics_bp
    from app.routes.admin import admin_bp
    from app.routes.messages import messages_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(loans_bp)
    app.register_blueprint(beneficiaries_bp)
    app.register_blueprint(cards_bp)
    app.register_blueprint(atm_bp)
    app.register_blueprint(scheduled_payments_bp)
    app.register_blueprint(bills_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(messages_bp)
