#!/usr/bin/env python
"""
Create admin user directly without Flask CLI
Run: python create_admin_direct.py
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set environment before importing app
os.environ.setdefault("FLASK_ENV", "production")

# Now import and create app
from app import create_app, db
from app.models.user import User, Role
from app.utils.security import PasswordSecurity

def create_admin_user():
    """Create admin user directly"""
    app = create_app("production")

    with app.app_context():
        # Check if admin role exists
        admin_role = Role.query.filter_by(name="admin").first()
        if not admin_role:
            print("❌ Admin role not found. Initializing roles...")
            from app.services.auth_service import initialize_roles
            try:
                initialize_roles()
                admin_role = Role.query.filter_by(name="admin").first()
            except Exception as e:
                print(f"❌ Error initializing roles: {e}")
                return False

        # Check if admin user already exists
        existing_admin = User.query.filter_by(username="shahinsha").first()
        if existing_admin:
            print("⚠️ Admin user 'shahinsha' already exists.")
            return True

        # Create admin user
        try:
            admin_user = User(
                username="shahinsha",
                email="admin@26-07-reserve.bank",
                password_hash=PasswordSecurity.hash_password("262007"),
                first_name="Admin",
                last_name="User",
                phone_number="+91-9876543210",
                role_id=admin_role.id,
                is_active=True,
                is_verified=True,
                is_first_login=False
            )

            db.session.add(admin_user)
            db.session.commit()

            print("✅ Admin user created successfully!")
            print(f"   Username: shahinsha")
            print(f"   Password: 262007")
            print(f"   Email: admin@26-07-reserve.bank")
            print(f"   Role: admin")
            return True
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error creating admin user: {e}")
            return False

if __name__ == "__main__":
    success = create_admin_user()
    sys.exit(0 if success else 1)
