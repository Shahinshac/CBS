from datetime import datetime
from app import db


class Card(db.Model):
    """Debit Card model"""
    __tablename__ = "cards"

    id = db.Column(db.Integer, primary_key=True)
    card_number = db.Column(db.String(20), unique=True, nullable=False)
    card_type = db.Column(db.String(20), default="debit", nullable=False)
    pin_hash = db.Column(db.String(255), nullable=False)
    expiry_date = db.Column(db.String(5), nullable=False)
    cvv_hash = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    is_blocked = db.Column(db.Boolean, default=False)

    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    account = db.relationship("Account", foreign_keys=[account_id])
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", foreign_keys=[user_id])

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_sensitive=False):
        """Convert to dictionary"""
        data = {
            "id": str(self.id),
            "card_number": f"****{self.card_number[-4:]}" if self.card_number else "",
            "card_type": self.card_type,
            "expiry_date": self.expiry_date,
            "is_active": self.is_active,
            "is_blocked": self.is_blocked,
            "account_id": str(self.account_id) if self.account_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_sensitive:
            data["full_card_number"] = self.card_number
        return data


class Beneficiary(db.Model):
    """Beneficiary model for transfers"""
    __tablename__ = "beneficiaries"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    account = db.relationship("Account", foreign_keys=[account_id])

    beneficiary_account_number = db.Column(db.String(20), nullable=False)
    beneficiary_name = db.Column(db.String(120), nullable=False)
    beneficiary_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"))

    is_approved = db.Column(db.Boolean, default=False)
    approved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    approved_at = db.Column(db.DateTime)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "account_id": str(self.account_id) if self.account_id else None,
            "beneficiary_account_number": self.beneficiary_account_number,
            "beneficiary_name": self.beneficiary_name,
            "is_approved": self.is_approved,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Loan(db.Model):
    """Loan model - Complete loan lifecycle tracking"""
    __tablename__ = "loans"

    id = db.Column(db.Integer, primary_key=True)
    loan_amount = db.Column(db.Numeric(15, 2), nullable=False)
    loan_type = db.Column(db.String(50), nullable=False)
    interest_rate = db.Column(db.Numeric(5, 2), nullable=False)
    tenure_months = db.Column(db.Integer, nullable=False)
    emi = db.Column(db.Numeric(15, 2), nullable=False)

    disbursed_amount = db.Column(db.Numeric(15, 2), default=0.00)
    disbursed_at = db.Column(db.DateTime)

    remaining_amount = db.Column(db.Numeric(15, 2), nullable=False)
    paid_amount = db.Column(db.Numeric(15, 2), default=0.00)
    next_due_date = db.Column(db.DateTime)
    status = db.Column(db.String(20), default="pending", nullable=False)

    approved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    approved_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.String(255))

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", foreign_keys=[user_id])
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    account = db.relationship("Account", foreign_keys=[account_id])

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "loan_amount": float(self.loan_amount) if self.loan_amount is not None else 0.0,
            "loan_type": self.loan_type,
            "interest_rate": float(self.interest_rate) if self.interest_rate is not None else 0.0,
            "tenure_months": self.tenure_months,
            "emi": float(self.emi) if self.emi is not None else 0.0,
            "disbursed_amount": float(self.disbursed_amount) if self.disbursed_amount is not None else 0.0,
            "remaining_amount": float(self.remaining_amount) if self.remaining_amount is not None else 0.0,
            "paid_amount": float(self.paid_amount) if self.paid_amount is not None else 0.0,
            "status": self.status,
            "account_id": str(self.account_id) if self.account_id else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "next_due_date": self.next_due_date.isoformat() if self.next_due_date else None,
            "disbursed_at": self.disbursed_at.isoformat() if self.disbursed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoanPayment(db.Model):
    """Loan Payment model - EMI payment tracking"""
    __tablename__ = "loan_payments"

    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey("loans.id"), nullable=False)
    loan = db.relationship("Loan", backref=db.backref("payments", lazy=True))

    emi_number = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    due_date = db.Column(db.DateTime, nullable=False)
    paid_on = db.Column(db.DateTime)
    status = db.Column(db.String(20), default="pending", nullable=False)
    transaction_id = db.Column(db.Integer, db.ForeignKey("transactions.id"))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "loan_id": str(self.loan_id) if self.loan_id else None,
            "emi_number": self.emi_number,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "paid_on": self.paid_on.isoformat() if self.paid_on else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Notification(db.Model):
    """Notification model"""
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", backref=db.backref("notifications", lazy=True))

    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Message(db.Model):
    """Support Message/Ticket model"""
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", backref=db.backref("messages", lazy=True))

    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), default="general", nullable=False)
    status = db.Column(db.String(20), default="open", nullable=False)
    priority = db.Column(db.String(20), default="normal")
    admin_reply = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "subject": self.subject,
            "message": self.message,
            "category": self.category,
            "status": self.status,
            "priority": self.priority,
            "admin_reply": self.admin_reply,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class ScheduledPayment(db.Model):
    """Scheduled Payment model"""
    __tablename__ = "scheduled_payments"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    account = db.relationship("Account", foreign_keys=[account_id], backref=db.backref("scheduled_payments", lazy=True))

    recipient_account_number = db.Column(db.String(20), nullable=False)
    recipient_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"))
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    description = db.Column(db.String(255))
    frequency = db.Column(db.String(20), default="once", nullable=False)
    scheduled_date = db.Column(db.DateTime, nullable=False)
    next_execution = db.Column(db.DateTime)
    last_executed = db.Column(db.DateTime)

    max_executions = db.Column(db.Integer)
    execution_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default="pending", nullable=False)
    cancellation_reason = db.Column(db.String(255))

    failure_count = db.Column(db.Integer, default=0)
    last_failure_reason = db.Column(db.String(255))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "account_id": str(self.account_id) if self.account_id else None,
            "recipient_account_number": self.recipient_account_number,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "description": self.description,
            "frequency": self.frequency,
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "next_execution": self.next_execution.isoformat() if self.next_execution else None,
            "last_executed": self.last_executed.isoformat() if self.last_executed else None,
            "status": self.status,
            "execution_count": self.execution_count,
            "max_executions": self.max_executions,
            "failure_count": self.failure_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
