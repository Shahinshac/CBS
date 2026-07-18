from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# SQLAlchemy instance
db = SQLAlchemy()

# Migration instance
migrate = Migrate()

def init_db(app):
    """Initialize database with Flask app."""
    db.init_app(app)
    migrate.init_app(app, db)

    with app.app_context():
        db.create_all()
