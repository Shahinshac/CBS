"""
Card and ATM service - Business logic for debit cards and ATM operations
"""
from app.models.base import Card
from app.models.account import Account
from app.models.transaction import Transaction, TransactionTypeEnum
from app.utils.generators import Generators
from app.utils.security import PINSecurity
from app.utils.validators import Validators
from app.utils.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    AuthenticationError,
    InsufficientBalanceError,
)
from datetime import datetime
from decimal import Decimal


class CardService:
    """Handle debit card operations"""

    @staticmethod
    def generate_card(account_id: str) -> Card:
        """
        Generate a new debit card for account

        Args:
            account_id: Account ID

        Returns:
            New card object

        Raises:
            ResourceNotFoundError: If account not found
            ValidationError: If card generation fails
        """
        # Validate account exists
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        # Generate card details
        card_number = Generators.generate_card_number()
        expiry_date = Generators.generate_card_expiry()

        # Generate initial PIN (will be overridden by user)
        initial_pin = "0000"  # Temporary - user must set their own
        pin_hash = PINSecurity.hash_pin(initial_pin)

        card = Card(
            card_number=card_number,
            card_type="debit",
            pin_hash=pin_hash,
            expiry_date=expiry_date,
            is_active=True,
            is_blocked=False,
            account_id=account_id,
            user_id=account.user_id,
        )

        try:
            card.save()
        except Exception as e:
            raise ValidationError(f"Failed to generate card: {str(e)}")

        return card

    @staticmethod
    def get_card(card_id: str) -> Card:
        """
        Get card by ID

        Args:
            card_id: Card ID

        Returns:
            Card object

        Raises:
            ResourceNotFoundError: If card not found
        """
        try:
            card = Card.objects(id=card_id).first()
        except Exception:
            card = None

        if not card:
            raise ResourceNotFoundError(f"Card with ID {card_id} not found")

        return card

    @staticmethod
    def get_card_by_number(card_number: str) -> Card:
        """
        Get card by card number

        Args:
            card_number: Card number

        Returns:
            Card object

        Raises:
            ResourceNotFoundError: If card not found
        """
        card = Card.objects(card_number=card_number).first()

        if not card:
            raise ResourceNotFoundError(f"Card not found")

        return card

    @staticmethod
    def get_account_cards(account_id: str) -> list:
        """
        Get all cards for account

        Args:
            account_id: Account ID

        Returns:
            List of cards

        Raises:
            ResourceNotFoundError: If account not found
        """
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        return list(Card.objects(account_id=account_id).order_by("-created_at"))

    @staticmethod
    def set_pin(card_id: str, pin: str) -> Card:
        """
        Set or update card PIN

        Args:
            card_id: Card ID
            pin: 4-digit PIN

        Returns:
            Updated card

        Raises:
            ResourceNotFoundError: If card not found
            ValidationError: If PIN invalid
        """
        card = CardService.get_card(card_id)

        # Validate PIN
        Validators.validate_pin(pin)

        # Hash and store PIN
        card.pin_hash = PINSecurity.hash_pin(pin)
        card.updated_at = datetime.utcnow()

        card.save()

        return card

    @staticmethod
    def verify_pin(card_number: str, pin: str) -> Card:
        """
        Verify card PIN for ATM login

        Args:
            card_number: Card number
            pin: PIN to verify

        Returns:
            Card object if PIN correct

        Raises:
            AuthenticationError: If PIN incorrect or card not found
            ValidationError: If card inactive or blocked
        """
        card = CardService.get_card_by_number(card_number)

        # Check card status
        if not card.is_active:
            raise AuthenticationError("Card is not active")

        if card.is_blocked:
            raise AuthenticationError("Card is blocked")

        # Verify PIN
        if not PINSecurity.verify_pin(pin, card.pin_hash):
            raise AuthenticationError("Invalid PIN")

        return card

    @staticmethod
    def block_card(card_id: str) -> Card:
        """
        Block card (disable transactions)

        Args:
            card_id: Card ID

        Returns:
            Updated card

        Raises:
            ResourceNotFoundError: If card not found
        """
        card = CardService.get_card(card_id)

        if card.is_blocked:
            raise ValidationError("Card is already blocked")

        card.is_blocked = True
        card.updated_at = datetime.utcnow()

        card.save()

        return card

    @staticmethod
    def unblock_card(card_id: str) -> Card:
        """
        Unblock card (enable transactions)

        Args:
            card_id: Card ID

        Returns:
            Updated card

        Raises:
            ResourceNotFoundError: If card not found
        """
        card = CardService.get_card(card_id)

        if not card.is_blocked:
            raise ValidationError("Card is not blocked")

        card.is_blocked = False
        card.updated_at = datetime.utcnow()

        card.save()

        return card


class ATMService:
    """Handle ATM-related operations"""

    @staticmethod
    def atm_login(card_number: str, pin: str) -> dict:
        """
        ATM login with card and PIN

        Args:
            card_number: Card number
            pin: 4-digit PIN

        Returns:
            Dictionary with account and card info

        Raises:
            AuthenticationError: If credentials invalid
        """
        # Verify card and PIN
        card = CardService.verify_pin(card_number, pin)

        # Get account
        try:
            account = Account.objects(id=card.account_id).first()
        except Exception:
            account = None

        return {
            "card_id": str(card.id),
            "account_number": account.account_number,
            "account_id": str(account.id),
            "card_number": f"****{card.card_number[-4:]}",
            "balance": float(account.balance),
        }

    @staticmethod
    def atm_check_balance(card_id: str) -> dict:
        """
        Check account balance via ATM

        Args:
            card_id: Card ID

        Returns:
            Balance information

        Raises:
            ResourceNotFoundError: If card not found
        """
        card = CardService.get_card(card_id)
        try:
            account = Account.objects(id=card.account_id).first()
        except Exception:
            account = None

        return {
            "account_number": account.account_number,
            "balance": float(account.balance),
            "currency": "INR",
        }

    @staticmethod
    def atm_withdraw(card_id: str, amount: float) -> dict:
        """
        Withdraw money via ATM

        Args:
            card_id: Card ID
            amount: Amount to withdraw

        Returns:
            Transaction details

        Raises:
            ResourceNotFoundError: If card not found
            ValidationError: If amount invalid
            InsufficientBalanceError: If insufficient balance
        """
        card = CardService.get_card(card_id)
        try:
            account = Account.objects(id=card.account_id).first()
        except Exception:
            account = None

        # Validate amount
        if amount <= 0:
            raise ValidationError("Withdrawal amount must be greater than 0")

        if amount > 100000:
            raise ValidationError("Withdrawal limit exceeded")

        # Check balance
        if account.balance < Decimal(str(amount)):
            raise InsufficientBalanceError(
                f"Insufficient balance. Available: {account.balance}"
            )

        # Create transaction record
        from app.services.transaction_service import TransactionService

        transaction = TransactionService.withdraw(
            account_id=account.id,
            amount=amount,
            description=f"ATM Withdrawal - {card.card_number[-4:]}",
        )

        return {
            "message": "Withdrawal successful",
            "transaction_id": str(transaction.id),
            "reference_id": transaction.reference_id,
            "amount": float(transaction.amount),
            "new_balance": float(account.balance),
            "timestamp": transaction.created_at.isoformat(),
        }

    @staticmethod
    def atm_mini_statement(card_id: str, num_transactions: int = 5) -> dict:
        """
        Get mini statement (last N transactions) via ATM

        Args:
            card_id: Card ID
            num_transactions: Number of transactions to show

        Returns:
            Mini statement with transactions

        Raises:
            ResourceNotFoundError: If card not found
        """
        card = CardService.get_card(card_id)
        try:
            account = Account.objects(id=card.account_id).first()
        except Exception:
            account = None

        # Get recent transactions
        transactions = list(
            Transaction.objects(account_id=account.id)
            .order_by("-created_at")
            .limit(num_transactions)
        )

        return {
            "account_number": account.account_number,
            "account_type": account.account_type,
            "current_balance": float(account.balance),
            "statement_date": datetime.utcnow().isoformat(),
            "transactions": [t.to_dict() for t in transactions],
            "transaction_count": len(transactions),
        }
