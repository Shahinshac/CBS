from datetime import datetime
from enum import Enum
from app import db


class RoleEnum(Enum):
    """User roles in the banking system"""
    SUPER_ADMIN = "super_admin"
    BRANCH_MANAGER = "branch_manager"
    TELLER = "teller"
    LOAN_OFFICER = "loan_officer"
    CUSTOMER_SUPPORT = "customer_support"
    AUDITOR = "auditor"
    CUSTOMER = "customer"


class Role(db.Model):
    """Role model for RBAC"""
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class User(db.Model):
    """User model"""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    # Personal Information
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)

    # Account Status
    is_active = db.Column(db.Boolean, default=True)
    is_verified = db.Column(db.Boolean, default=False)
    is_first_login = db.Column(db.Boolean, default=True)

    # MPIN Security
    mpin_hash = db.Column(db.String(255))
    mpin_set = db.Column(db.Boolean, default=False)

    # Role Reference
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    role = db.relationship("Role", backref=db.backref("users", lazy=True))

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    def to_dict(self, include_sensitive=False):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "username": self.username,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "phone_number": self.phone_number,
            "role": self.role.name if self.role else None,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "is_first_login": self.is_first_login,
            "mpin_set": self.mpin_set,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }
