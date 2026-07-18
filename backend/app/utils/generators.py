"""
Generators for unique identifiers
"""
import secrets
import string
from datetime import datetime


class Generators:
    """Generate unique identifiers for various entities"""

    @staticmethod
    def generate_account_number() -> str:
        """
        Generate 16-digit unique account number
        Format: CCYY + 12 random digits
        (CC=Country, YY=Year)

        Returns:
            16-digit account number
        """
        year = str(datetime.utcnow().year)[2:]  # Last 2 digits of year
        random_digits = "".join(secrets.choice(string.digits) for _ in range(14))
        return f"98{year}{random_digits}"

    @staticmethod
    def generate_transaction_reference() -> str:
        """
        Generate unique transaction reference ID
        Format: TXN + timestamp + random alphanumeric

        Returns:
            Unique transaction reference
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        random_part = "".join(
            secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8)
        )
        return f"TXN{timestamp}{random_part}"

    @staticmethod
    def generate_card_number() -> str:
        """
        Generate 16-digit debit card number
        Format: 4532 + 12 random digits (Visa-like)

        Returns:
            16-digit card number
        """
        # Start with Visa prefix (4532)
        card_number = "4532"
        random_digits = "".join(secrets.choice(string.digits) for _ in range(12))
        return card_number + random_digits

    @staticmethod
    def generate_card_expiry() -> str:
        """
        Generate card expiry date (5 years from now)
        Format: MM/YY

        Returns:
            Card expiry date in MM/YY format
        """
        from datetime import datetime, timedelta
        future_date = datetime.utcnow() + timedelta(days=365 * 5)
        return future_date.strftime("%m/%y")

    @staticmethod
    def generate_loan_reference() -> str:
        """
        Generate unique loan reference ID
        Format: LOAN + timestamp + random alphanumeric

        Returns:
            Unique loan reference
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        random_part = "".join(
            secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)
        )
        return f"LOAN{timestamp}{random_part}"

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """
        Generate secure random token

        Args:
            length: Token length

        Returns:
            Secure random token
        """
        return secrets.token_urlsafe(length)
