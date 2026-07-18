"""
Bill payment service - Business logic for bill payments
"""
from app.models.account import Account
from app.models.bill import Bill, BillPayment, BillTypeEnum, BillPaymentStatusEnum
from app.models.transaction import Transaction, TransactionTypeEnum, TransactionStatusEnum
from app.models.user import User
from app.utils.generators import Generators
from app.utils.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    InsufficientBalanceError,
)
from datetime import datetime
from decimal import Decimal


class BillService:
    """Handle bill payment operations"""

    @staticmethod
    def pay_bill(
        account_id: str,
        bill_type: str,
        amount: float,
        recipient_identifier: str,
        recipient_name: str = "",
        description: str = ""
    ) -> dict:
        """
        Pay a bill (mobile recharge, electricity, internet)

        Args:
            account_id: Account ID from which to deduct amount
            bill_type: Type of bill (mobile_recharge, electricity, internet)
            amount: Bill amount
            recipient_identifier: Phone number or account number
            recipient_name: Name of recipient/beneficiary
            description: Optional description

        Returns:
            Dictionary with bill payment details and transaction info

        Raises:
            ResourceNotFoundError: If account not found
            ValidationError: If validation fails
            InsufficientBalanceError: If insufficient balance
        """
        # Validate account exists
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        # Validate bill type
        if bill_type not in [e.value for e in BillTypeEnum]:
            valid_types = ", ".join([e.value for e in BillTypeEnum])
            raise ValidationError(f"Invalid bill type. Valid types: {valid_types}")

        # Validate amount
        if amount <= 0:
            raise ValidationError("Bill amount must be greater than 0")

        # Validate recipient identifier
        if not recipient_identifier or len(recipient_identifier.strip()) == 0:
            raise ValidationError("Recipient identifier (phone/account number) is required")

        # Check balance
        if account.balance < Decimal(str(amount)):
            raise InsufficientBalanceError(
                f"Insufficient balance. Available: {account.balance}, Required: {amount}"
            )

        # Generate IDs
        bill_id = Generators.generate_transaction_reference()  # Reuse reference generator
        payment_id = Generators.generate_transaction_reference()

        # Get bill type display name for description
        bill_type_display = bill_type.replace("_", " ").title()
        if not description:
            description = f"{bill_type_display} payment to {recipient_identifier}"

        try:
            # Create transaction record (atomic with account update)
            transaction = Transaction(
                reference_id=bill_id,
                transaction_type=TransactionTypeEnum.BILL_PAYMENT.value,
                status=TransactionStatusEnum.SUCCESS.value,
                amount=Decimal(str(amount)),
                description=description,
                account_id=account_id,
                user_id=account.user_id,
            )

            # Create bill record
            bill = Bill(
                bill_id=bill_id,
                bill_type=bill_type,
                status=BillPaymentStatusEnum.SUCCESS.value,
                amount=Decimal(str(amount)),
                description=description,
                recipient_identifier=recipient_identifier,
                recipient_name=recipient_name or recipient_identifier,
                account_id=account_id,
                user_id=account.user_id,
                transaction_id=transaction,
            )

            # Create bill payment history record
            bill_payment = BillPayment(
                payment_id=payment_id,
                bill_type=bill_type,
                status=BillPaymentStatusEnum.SUCCESS.value,
                amount=Decimal(str(amount)),
                description=description,
                recipient_identifier=recipient_identifier,
                recipient_name=recipient_name or recipient_identifier,
                account_id=account_id,
                user_id=account.user_id,
                transaction_id=transaction,
            )

            # Update account balance (deduct payment)
            account.balance -= Decimal(str(amount))
            account.updated_at = datetime.utcnow()

            # Save all (atomic operation)
            transaction.save()
            bill.save()
            bill_payment.save()
            account.save()

            return {
                "status": "success",
                "message": f"Bill payment successful",
                "bill": bill.to_dict(),
                "transaction": transaction.to_dict(),
                "account_balance": float(account.balance),
            }

        except Exception as e:
            # Create failed bill payment record
            try:
                failed_bill_payment = BillPayment(
                    payment_id=payment_id,
                    bill_type=bill_type,
                    status=BillPaymentStatusEnum.FAILED.value,
                    amount=Decimal(str(amount)),
                    description=description,
                    recipient_identifier=recipient_identifier,
                    recipient_name=recipient_name or recipient_identifier,
                    account_id=account_id,
                    user_id=account.user_id,
                    error_message=str(e),
                )
                failed_bill_payment.save()
            except Exception:
                pass  # Silently fail if we can't even save the failure record

            raise ValidationError(f"Bill payment failed: {str(e)}")

    @staticmethod
    def get_bill_payment_history(
        account_id: str,
        bill_type: str = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        """
        Get bill payment history for account

        Args:
            account_id: Account ID
            bill_type: Optional filter by bill type
            page: Page number
            per_page: Items per page

        Returns:
            Dictionary with bill payment history

        Raises:
            ResourceNotFoundError: If account not found
        """
        # Validate account exists
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        # Build query
        query_dict = {"account_id": account_id}

        # Apply bill type filter if provided
        if bill_type:
            if bill_type not in [e.value for e in BillTypeEnum]:
                valid_types = ", ".join([e.value for e in BillTypeEnum])
                raise ValidationError(f"Invalid bill type. Valid types: {valid_types}")
            query_dict["bill_type"] = bill_type

        # Calculate pagination
        skip = (page - 1) * per_page
        bill_payments = BillPayment.objects(**query_dict).order_by("-created_at").skip(skip).limit(per_page)
        total = BillPayment.objects(**query_dict).count()
        pages = (total + per_page - 1) // per_page

        return {
            "account_id": str(account_id),
            "account_number": account.account_number,
            "bill_type_filter": bill_type,
            "total": total,
            "pages": pages,
            "current_page": page,
            "bill_payments": [bp.to_dict() for bp in bill_payments],
        }

    @staticmethod
    def get_user_bill_history(
        user_id: str,
        bill_type: str = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        """
        Get all bill payments for a user

        Args:
            user_id: User ID
            bill_type: Optional filter by bill type
            page: Page number
            per_page: Items per page

        Returns:
            Dictionary with bill payment history

        Raises:
            ResourceNotFoundError: If user not found
        """
        # Validate user exists
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            raise ResourceNotFoundError(f"User with ID {user_id} not found")

        # Build query
        query_dict = {"user_id": user_id}

        # Apply bill type filter if provided
        if bill_type:
            if bill_type not in [e.value for e in BillTypeEnum]:
                valid_types = ", ".join([e.value for e in BillTypeEnum])
                raise ValidationError(f"Invalid bill type. Valid types: {valid_types}")
            query_dict["bill_type"] = bill_type

        # Calculate pagination
        skip = (page - 1) * per_page
        bill_payments = BillPayment.objects(**query_dict).order_by("-created_at").skip(skip).limit(per_page)
        total = BillPayment.objects(**query_dict).count()
        pages = (total + per_page - 1) // per_page

        return {
            "user_id": str(user_id),
            "bill_type_filter": bill_type,
            "total": total,
            "pages": pages,
            "current_page": page,
            "bill_payments": [bp.to_dict() for bp in bill_payments],
        }

    @staticmethod
    def get_bill_statistics(account_id: str, bill_type: str = None) -> dict:
        """
        Get bill payment statistics for account

        Args:
            account_id: Account ID
            bill_type: Optional filter by bill type

        Returns:
            Dictionary with statistics

        Raises:
            ResourceNotFoundError: If account not found
        """
        # Validate account exists
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        # Build query
        query_dict = {"account_id": account_id, "status": BillPaymentStatusEnum.SUCCESS.value}

        if bill_type:
            if bill_type not in [e.value for e in BillTypeEnum]:
                valid_types = ", ".join([e.value for e in BillTypeEnum])
                raise ValidationError(f"Invalid bill type. Valid types: {valid_types}")
            query_dict["bill_type"] = bill_type

        # Get all successful payments
        bill_payments = BillPayment.objects(**query_dict)

        # Calculate statistics by type
        total_paid = sum(bp.amount for bp in bill_payments)
        payment_count = len(list(bill_payments))

        stats_by_type = {}
        for bill_type_enum in BillTypeEnum:
            type_payments = BillPayment.objects(
                account_id=account_id,
                bill_type=bill_type_enum.value,
                status=BillPaymentStatusEnum.SUCCESS.value
            )
            if type_payments.count() > 0:
                stats_by_type[bill_type_enum.value] = {
                    "count": type_payments.count(),
                    "total": float(sum(bp.amount for bp in type_payments)),
                    "average": float(sum(bp.amount for bp in type_payments) / type_payments.count()),
                }

        return {
            "account_id": str(account_id),
            "account_number": account.account_number,
            "total_payments": payment_count,
            "total_paid": float(total_paid),
            "average_payment": float(total_paid / payment_count) if payment_count > 0 else 0.0,
            "by_type": stats_by_type,
        }
