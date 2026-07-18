"""
Input validation utilities
"""
import re
from app.utils.exceptions import ValidationError


class Validators:
    """Input validation helpers"""

    # Regex patterns
    EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    PHONE_PATTERN = r"^\+?1?\d{9,15}$"
    ACCOUNT_NUMBER_PATTERN = r"^\d{10,20}$"
    USERNAME_PATTERN = r"^[a-zA-Z0-9_]{3,30}$"

    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        if not email or len(email) > 120:
            raise ValidationError("Invalid email format")
        return bool(re.match(Validators.EMAIL_PATTERN, email))

    @staticmethod
    def validate_password(password: str) -> bool:
        """
        Validate password strength
        Requirements: minimum 8 characters, at least one uppercase, one lowercase, one digit
        """
        if not password or len(password) < 8:
            raise ValidationError(
                "Password must be at least 8 characters long"
            )

        if len(password) > 255:
            raise ValidationError("Password is too long")

        if not re.search(r"[A-Z]", password):
            raise ValidationError("Password must have at least one uppercase letter")

        if not re.search(r"[a-z]", password):
            raise ValidationError("Password must have at least one lowercase letter")

        if not re.search(r"\d", password):
            raise ValidationError("Password must have at least one digit")

        return True

    @staticmethod
    def validate_username(username: str) -> bool:
        """Validate username format"""
        if not username:
            raise ValidationError("Username is required")

        if not re.match(Validators.USERNAME_PATTERN, username):
            raise ValidationError(
                "Username must be 3-30 characters, alphanumeric and underscore only"
            )

        return True

    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number format"""
        if not phone:
            raise ValidationError("Phone number is required")

        # Remove spaces and hyphens
        phone_clean = phone.replace(" ", "").replace("-", "")

        if not re.match(Validators.PHONE_PATTERN, phone_clean):
            raise ValidationError("Invalid phone number format")

        return True

    @staticmethod
    def validate_name(name: str, field_name: str = "Name") -> bool:
        """Validate name field"""
        if not name or not isinstance(name, str):
            raise ValidationError(f"{field_name} is required")

        if len(name) < 2 or len(name) > 100:
            raise ValidationError(f"{field_name} must be 2-100 characters")

        if not re.match(r"^[a-zA-Z\s'-]+$", name):
            raise ValidationError(f"{field_name} contains invalid characters")

        return True

    @staticmethod
    def validate_account_number(account_number: str) -> bool:
        """Validate account number format"""
        if not account_number:
            raise ValidationError("Account number is required")

        if not re.match(Validators.ACCOUNT_NUMBER_PATTERN, account_number):
            raise ValidationError("Invalid account number format")

        return True

    @staticmethod
    def validate_amount(amount: float, min_amount: float = 0) -> bool:
        """Validate transaction amount"""
        if not isinstance(amount, (int, float)):
            raise ValidationError("Amount must be a number")

        if amount <= min_amount:
            raise ValidationError(f"Amount must be greater than {min_amount}")

        if amount > 999999999.99:
            raise ValidationError("Amount is too large")

        return True

    @staticmethod
    def validate_pin(pin: str) -> bool:
        """Validate ATM PIN (4 digits)"""
        if not pin or not isinstance(pin, str):
            raise ValidationError("PIN is required")

        if not re.match(r"^\d{4}$", pin):
            raise ValidationError("PIN must be exactly 4 digits")

        return True
