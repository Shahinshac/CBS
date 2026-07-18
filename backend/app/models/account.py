from datetime import datetime
from enum import Enum
from app import db


class AccountTypeEnum(Enum):
    """Bank account types"""
    SAVINGS = "savings"
    CURRENT = "current"
    SALARY = "salary"


class AccountStatusEnum(Enum):
    """Account status"""
    ACTIVE = "active"
    FROZEN = "frozen"
    CLOSED = "closed"


class Account(db.Model):
    """Bank Account model"""
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(db.String(20), unique=True, nullable=False)
    account_type = db.Column(db.String(20), default=AccountTypeEnum.SAVINGS.value, nullable=False)

    # Account Balance and Status
    balance = db.Column(db.Numeric(15, 2), default=0.00, nullable=False)
    status = db.Column(db.String(20), default=AccountStatusEnum.ACTIVE.value, nullable=False)

    # Foreign Key - User Reference
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", backref=db.backref("accounts", lazy=True))

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "account_number": self.account_number,
            "account_type": self.account_type,
            "balance": float(self.balance) if self.balance is not None else 0.0,
            "status": self.status,
            "user_id": str(self.user_id) if self.user_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
