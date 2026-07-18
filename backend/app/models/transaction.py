from datetime import datetime
from enum import Enum
from app import db


class TransactionTypeEnum(Enum):
    """Transaction types"""
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    TRANSFER = "transfer"
    BILL_PAYMENT = "bill_payment"
    LOAN_DISBURSEMENT = "loan_disbursement"
    LOAN_REPAYMENT = "loan_repayment"
    INTEREST_CREDIT = "interest_credit"


class TransactionStatusEnum(Enum):
    """Transaction status"""
    SUCCESS = "success"
    PENDING = "pending"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Transaction(db.Model):
    """Transaction model"""
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    reference_id = db.Column(db.String(50), nullable=False)
    transaction_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default=TransactionStatusEnum.SUCCESS.value, nullable=False)

    # Amount and Description
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    description = db.Column(db.String(255))

    # Account Information
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    account = db.relationship("Account", foreign_keys=[account_id], backref=db.backref("transactions", lazy=True))

    # For transfers - receiver account
    recipient_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"))
    recipient_account = db.relationship("Account", foreign_keys=[recipient_account_id])

    # For user-level transaction history
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", backref=db.backref("transactions", lazy=True))

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "reference_id": self.reference_id,
            "transaction_type": self.transaction_type,
            "status": self.status,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "description": self.description,
            "account_id": str(self.account_id) if self.account_id else None,
            "recipient_account_id": str(self.recipient_account_id) if self.recipient_account_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
