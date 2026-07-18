"""
Security utilities for password hashing and JWT token management
"""
import bcrypt
import secrets
import string
from datetime import datetime, timedelta
from flask_jwt_extended import create_access_token, create_refresh_token


class PasswordSecurity:
    """Password hashing and verification"""

    @staticmethod
    def hash_password(password: str, rounds: int = 12) -> str:
        """
        Hash password using bcrypt

        Args:
            password: Plain text password
            rounds: Bcrypt rounds (higher = slower but more secure)

        Returns:
            Hashed password
        """
        salt = bcrypt.gensalt(rounds=rounds)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """
        Verify password against hash

        Args:
            password: Plain text password to verify
            password_hash: Stored password hash

        Returns:
            True if password matches, False otherwise
        """
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


class TokenManager:
    """JWT token creation and management"""

    @staticmethod
    def create_tokens(user_id: int, username: str, role: str) -> dict:
        """
        Create access and refresh tokens

        Args:
            user_id: User ID
            username: Username
            role: User role

        Returns:
            Dictionary with access_token and refresh_token
        """
        additional_claims = {"username": username, "role": role}

        access_token = create_access_token(
            identity=user_id,
            additional_claims=additional_claims
        )
        refresh_token = create_refresh_token(identity=user_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
        }

    @staticmethod
    def get_token_claims(decoded_token: dict) -> dict:
        """
        Extract claims from decoded JWT

        Args:
            decoded_token: Decoded JWT token

        Returns:
            Dictionary with user_id, username, role
        """
        return {
            "user_id": decoded_token.get("sub"),
            "username": decoded_token.get("username"),
            "role": decoded_token.get("role"),
        }


class PINSecurity:
    """PIN hashing for cards and ATM"""

    @staticmethod
    def hash_pin(pin: str) -> str:
        """
        Hash PIN using bcrypt

        Args:
            pin: 4-digit PIN

        Returns:
            Hashed PIN
        """
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(pin.encode("utf-8"), salt).decode("utf-8")

    @staticmethod
    def verify_pin(pin: str, pin_hash: str) -> bool:
        """
        Verify PIN against hash

        Args:
            pin: Plain text PIN
            pin_hash: Stored PIN hash

        Returns:
            True if PIN matches, False otherwise
        """
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
