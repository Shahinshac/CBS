"""Scheduled Payment Service - Handle recurring and future transfers"""
from app.models.base import ScheduledPayment
from app.models.account import Account
from app.services.transaction_service import TransactionService
from app.utils.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    InsufficientBalanceError,
)
from datetime import datetime, timedelta
from decimal import Decimal

class ScheduledPaymentService:
    @staticmethod
    def schedule_payment(account_id: str, recipient_account_number: str, amount: float, scheduled_date: datetime, frequency: str = "once", max_executions: int = None, description: str = None):
        """Schedule a payment for future execution"""
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account {account_id} not found")

        if frequency.upper() not in ["ONCE", "WEEKLY", "MONTHLY", "YEARLY"]:
            raise ValidationError("Invalid frequency")
        if amount <= 0:
            raise ValidationError("Amount must be > 0")
        if scheduled_date <= datetime.utcnow():
            raise ValidationError("Scheduled date must be in future")

        payment = ScheduledPayment(
            account_id=account_id,
            recipient_account_number=recipient_account_number,
            amount=Decimal(str(amount)),
            frequency=frequency.upper(),
            scheduled_date=scheduled_date,
            next_execution=scheduled_date,
            status="active",
            max_executions=max_executions,
            description=description,
            execution_count=0,
            failure_count=0,
        )
        payment.save()
        return payment

    @staticmethod
    def get_scheduled_payment(payment_id: str):
        """Get scheduled payment"""
        try:
            payment = ScheduledPayment.objects(id=payment_id).first()
        except Exception:
            payment = None

        if not payment:
            raise ResourceNotFoundError(f"Payment {payment_id} not found")
        return payment

    @staticmethod
    def get_account_scheduled_payments(account_id: str, status: str = None):
        """Get account scheduled payments"""
        query_dict = {"account_id": account_id}
        if status:
            query_dict["status"] = status
        return list(ScheduledPayment.objects(**query_dict).order_by("scheduled_date"))

    @staticmethod
    def execute_payment(payment_id: str):
        """Execute scheduled payment manually or automatically"""
        payment = ScheduledPaymentService.get_scheduled_payment(payment_id)

        if payment.status == "cancelled":
            raise ValidationError("Cannot execute cancelled payment")

        try:
            TransactionService.transfer(
                from_account_id=payment.account_id,
                to_account_id=payment.recipient_account_number,
                amount=float(payment.amount),
                description=f"Scheduled: {payment.description or 'Payment'}"
            )

            payment.last_executed = datetime.utcnow()
            payment.execution_count += 1
            payment.failure_count = 0
            payment.last_failure_reason = None

            if payment.frequency == "ONCE":
                payment.status = "completed"
            elif payment.frequency == "WEEKLY":
                payment.next_execution = datetime.utcnow() + timedelta(days=7)
            elif payment.frequency == "MONTHLY":
                payment.next_execution = datetime.utcnow() + timedelta(days=30)
            elif payment.frequency == "YEARLY":
                payment.next_execution = datetime.utcnow() + timedelta(days=365)

            if payment.max_executions and payment.execution_count >= payment.max_executions:
                payment.status = "completed"

            payment.save()
            return payment
        except Exception as e:
            payment.failure_count += 1
            payment.last_failure_reason = str(e)
            payment.save()
            raise

    @staticmethod
    def cancel_payment(payment_id: str, reason: str = None):
        """Cancel a scheduled payment"""
        payment = ScheduledPaymentService.get_scheduled_payment(payment_id)
        if payment.status == "completed":
            raise ValidationError("Cannot cancel completed payment")

        payment.status = "cancelled"
        payment.cancellation_reason = reason
        payment.save()
        return payment

    @staticmethod
    def process_due_payments():
        """Process all due payments (called by scheduler)"""
        now = datetime.utcnow()
        due = ScheduledPayment.objects(
            next_execution__lte=now,
            status__in=["active", "pending"]
        )

        executed, failed = [], []
        for p in due:
            try:
                ScheduledPaymentService.execute_payment(str(p.id))
                executed.append(str(p.id))
            except:
                failed.append(str(p.id))

        return {"executed": executed, "failed": failed}

    @staticmethod
    def get_statistics():
        """Get statistics"""
        all_p = list(ScheduledPayment.objects())
        return {
            "total": len(all_p),
            "active": len([p for p in all_p if p.status == "active"]),
            "completed": len([p for p in all_p if p.status == "completed"]),
            "cancelled": len([p for p in all_p if p.status == "cancelled"]),
        }
