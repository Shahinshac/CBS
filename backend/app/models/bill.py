from datetime import datetime
from enum import Enum
from app import db


class BillTypeEnum(Enum):
    """Bill types for payment"""
    MOBILE_RECHARGE = "mobile_recharge"
    ELECTRICITY = "electricity"
    INTERNET = "internet"


class BillPaymentStatusEnum(Enum):
    """Bill payment status"""
    SUCCESS = "success"
    PENDING = "pending"
    FAILED = "failed"


class Bill(db.Model):
    """Bill payment record"""
    __tablename__ = "bills"

    id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.String(50), unique=True, nullable=False)
    bill_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default=BillPaymentStatusEnum.SUCCESS.value, nullable=False)

    # Amount and Description
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    description = db.Column(db.String(255))
    recipient_identifier = db.Column(db.String(50), nullable=False)
    recipient_name = db.Column(db.String(255))

    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    account = db.relationship("Account", foreign_keys=[account_id])

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", foreign_keys=[user_id])

    transaction_id = db.Column(db.Integer, db.ForeignKey("transactions.id"))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "bill_id": self.bill_id,
            "bill_type": self.bill_type,
            "status": self.status,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "description": self.description,
            "recipient_identifier": self.recipient_identifier,
            "recipient_name": self.recipient_name,
            "account_id": str(self.account_id) if self.account_id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "transaction_id": str(self.transaction_id) if self.transaction_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class BillPayment(db.Model):
    """Bill payment history"""
    __tablename__ = "bill_payments"

    id = db.Column(db.Integer, primary_key=True)
    payment_id = db.Column(db.String(50), unique=True, nullable=False)
    bill_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default=BillPaymentStatusEnum.SUCCESS.value, nullable=False)

    amount = db.Column(db.Numeric(15, 2), nullable=False)
    description = db.Column(db.String(255))
    recipient_identifier = db.Column(db.String(50), nullable=False)
    recipient_name = db.Column(db.String(255))

    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    account = db.relationship("Account", foreign_keys=[account_id])

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", foreign_keys=[user_id])

    transaction_id = db.Column(db.Integer, db.ForeignKey("transactions.id"))
    error_message = db.Column(db.String(500))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "payment_id": self.payment_id,
            "bill_type": self.bill_type,
            "status": self.status,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "description": self.description,
            "recipient_identifier": self.recipient_identifier,
            "recipient_name": self.recipient_name,
            "account_id": str(self.account_id) if self.account_id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "transaction_id": str(self.transaction_id) if self.transaction_id else None,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
