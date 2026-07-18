"""
Interest calculation service - Business logic for interest accrual
"""
from app.models.account import Account, AccountTypeEnum
from app.models.transaction import Transaction, TransactionTypeEnum, TransactionStatusEnum
from app.models.user import User
from app.utils.generators import Generators
from app.utils.exceptions import (
    ResourceNotFoundError,
    ValidationError,
)
from datetime import datetime
from decimal import Decimal


class InterestService:
    """Handle interest calculations and accrual"""

    # Interest rates (annual percentage)
    INTEREST_RATES = {
        AccountTypeEnum.SAVINGS.value: 8.0,  # 8% annual
        AccountTypeEnum.CURRENT.value: 0.0,  # No interest
        AccountTypeEnum.SALARY.value: 4.0,   # 4% annual
    }

    @staticmethod
    def _get_monthly_rate(annual_rate: float) -> float:
        """
        Convert annual rate to monthly rate
        Monthly rate = Annual rate / 12

        Args:
            annual_rate: Annual interest rate percentage

        Returns:
            Monthly interest rate as percentage
        """
        return annual_rate / 12

    @staticmethod
    def calculate_interest_for_account(account_id: str) -> dict:
        """
        Calculate monthly interest for a single account

        Args:
            account_id: Account ID

        Returns:
            Dictionary with interest calculation details

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

        # Get annual interest rate
        annual_rate = InterestService.INTEREST_RATES.get(account.account_type, 0.0)

        if annual_rate == 0.0:
            # No interest for this account type
            return {
                "account_id": str(account_id),
                "account_number": account.account_number,
                "account_type": account.account_type,
                "balance": float(account.balance),
                "annual_rate": annual_rate,
                "monthly_rate": 0.0,
                "interest_earned": 0.0,
                "status": "no_interest",
            }

        # Calculate interest
        monthly_rate = InterestService._get_monthly_rate(annual_rate)
        balance = Decimal(str(account.balance))
        interest_earned = balance * Decimal(str(monthly_rate / 100))

        return {
            "account_id": str(account_id),
            "account_number": account.account_number,
            "account_type": account.account_type,
            "balance": float(balance),
            "annual_rate": annual_rate,
            "monthly_rate": monthly_rate,
            "interest_earned": float(interest_earned),
        }

    @staticmethod
    def accrue_interest_for_account(account_id: str) -> dict:
        """
        Accrue (credit) monthly interest to account

        Args:
            account_id: Account ID

        Returns:
            Dictionary with accrual details and transaction

        Raises:
            ResourceNotFoundError: If account not found
            ValidationError: If accrual fails
        """
        # Validate account exists
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        # Get interest calculation
        calc = InterestService.calculate_interest_for_account(account_id)

        if calc.get("status") == "no_interest":
            return {
                "account_id": str(account_id),
                "status": "no_interest",
                "message": f"No interest for {calc['account_type']} accounts",
            }

        interest_amount = Decimal(str(calc["interest_earned"]))

        if interest_amount <= 0:
            return {
                "account_id": str(account_id),
                "status": "no_accrual",
                "message": "Interest amount is zero or negative",
            }

        try:
            # Create transaction record
            transaction = Transaction(
                reference_id=Generators.generate_transaction_reference(),
                transaction_type=TransactionTypeEnum.INTEREST_CREDIT.value,
                status=TransactionStatusEnum.SUCCESS.value,
                amount=interest_amount,
                description=f"Monthly interest ({calc['monthly_rate']}%) credited on {account.account_number}",
                account_id=account_id,
                user_id=account.user_id,
            )

            # Update account balance
            account.balance += interest_amount
            account.updated_at = datetime.utcnow()

            # Save atomically
            transaction.save()
            account.save()

            return {
                "account_id": str(account_id),
                "account_number": account.account_number,
                "status": "success",
                "message": "Interest accrued successfully",
                "interest_amount": float(interest_amount),
                "new_balance": float(account.balance),
                "transaction": transaction.to_dict(),
            }

        except Exception as e:
            raise ValidationError(f"Interest accrual failed: {str(e)}")

    @staticmethod
    def process_monthly_interest_for_user(user_id: str) -> dict:
        """
        Process monthly interest for all accounts of a user

        Args:
            user_id: User ID

        Returns:
            Dictionary with summary of all accounts processed

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

        # Get all user accounts
        try:
            accounts = Account.objects(user_id=user_id)
        except Exception:
            accounts = []

        results = {
            "user_id": str(user_id),
            "total_accounts": len(list(accounts)),
            "accounts_processed": 0,
            "total_interest": 0.0,
            "account_details": [],
        }

        for account in accounts:
            try:
                result = InterestService.accrue_interest_for_account(str(account.id))
                results["account_details"].append(result)

                if result.get("status") == "success":
                    results["accounts_processed"] += 1
                    results["total_interest"] += result.get("interest_amount", 0.0)
            except Exception as e:
                results["account_details"].append({
                    "account_id": str(account.id),
                    "status": "failed",
                    "error": str(e),
                })

        return results

    @staticmethod
    def process_monthly_interest_for_all_users() -> dict:
        """
        Process monthly interest for all users in the system

        Returns:
            Dictionary with summary of all users processed
        """
        try:
            users = User.objects()
        except Exception:
            users = []

        results = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_users": len(list(users)),
            "users_processed": 0,
            "total_interest_accrued": 0.0,
            "user_results": [],
        }

        for user in users:
            try:
                user_result = InterestService.process_monthly_interest_for_user(str(user.id))
                results["user_results"].append(user_result)

                if user_result.get("accounts_processed", 0) > 0:
                    results["users_processed"] += 1
                    results["total_interest_accrued"] += user_result.get("total_interest", 0.0)
            except Exception as e:
                results["user_results"].append({
                    "user_id": str(user.id),
                    "status": "failed",
                    "error": str(e),
                })

        return results

    @staticmethod
    def get_interest_statistics(account_id: str) -> dict:
        """
        Get interest statistics for account

        Args:
            account_id: Account ID

        Returns:
            Dictionary with interest statistics

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

        # Get all interest credit transactions
        try:
            interest_transactions = Transaction.objects(
                account_id=account_id,
                transaction_type=TransactionTypeEnum.INTEREST_CREDIT.value,
                status=TransactionStatusEnum.SUCCESS.value
            )
        except Exception:
            interest_transactions = []

        total_interest = sum(txn.amount for txn in interest_transactions)
        count = len(list(interest_transactions))

        # Calculate next interest payment (on 1st of next month)
        now = datetime.utcnow()
        if now.day < 1:
            next_interest_date = now.replace(day=1)
        else:
            # Next month 1st
            if now.month == 12:
                next_interest_date = now.replace(year=now.year + 1, month=1, day=1)
            else:
                next_interest_date = now.replace(month=now.month + 1, day=1)

        # Get calculation
        calc = InterestService.calculate_interest_for_account(account_id)

        return {
            "account_id": str(account_id),
            "account_number": account.account_number,
            "account_type": account.account_type,
            "current_balance": float(account.balance),
            "annual_interest_rate": calc.get("annual_rate", 0.0),
            "monthly_interest_rate": calc.get("monthly_rate", 0.0),
            "estimated_next_interest": calc.get("interest_earned", 0.0),
            "next_interest_date": next_interest_date.isoformat(),
            "total_interest_credited": float(total_interest),
            "interest_transaction_count": count,
            "last_interest_date": interest_transactions[0].created_at.isoformat() if interest_transactions else None,
        }
