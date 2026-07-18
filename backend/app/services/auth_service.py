"""
Authentication service - Business logic for user authentication
"""
from app.models.user import User, Role, RoleEnum
from app.utils.security import PasswordSecurity, TokenManager
from app.utils.validators import Validators
from app.utils.exceptions import (
    AuthenticationError,
    UserAlreadyExistsError,
    ValidationError,
    ResourceNotFoundError,
)
from datetime import datetime
from app import db


class AuthService:
    """Handle user authentication logic"""

    @staticmethod
    def register_user(
        username: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        phone_number: str,
        role: str = "customer",
    ) -> dict:
        """
        Register a new user

        Args:
            username: Unique username
            email: Unique email address
            password: Plain text password
            first_name: First name
            last_name: Last name
            phone_number: Phone number
            role: User role (default: customer)

        Returns:
            Dictionary with user data

        Raises:
            UserAlreadyExistsError: If user already exists
            ValidationError: If input validation fails
        """
        # Validate inputs
        Validators.validate_username(username)
        Validators.validate_email(email)
        Validators.validate_password(password)
        Validators.validate_name(first_name, "First name")
        Validators.validate_name(last_name, "Last name")
        Validators.validate_phone(phone_number)

        # Check if user already exists
        existing_user = User.query.filter(
            (User.username == username) |
            (User.email == email) |
            (User.phone_number == phone_number)
        ).first()

        if existing_user:
            raise UserAlreadyExistsError(
                "User with this email, username, or phone number already exists"
            )

        # Get role object
        role_obj = Role.query.filter_by(name=role).first()
        if not role_obj:
            # Default to customer role if not found
            role_obj = Role.query.filter_by(name=RoleEnum.CUSTOMER.value).first()

        # Create new user
        password_hash = PasswordSecurity.hash_password(password)
        try:
            user = User(
                username=username,
                email=email,
                password_hash=password_hash,
                first_name=first_name,
                last_name=last_name,
                phone_number=phone_number,
                role_id=role_obj.id,
            )
            db.session.add(user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise ValidationError(f"Failed to register user: {str(e)}")

        return user.to_dict()

    @staticmethod
    def login(username: str, password: str) -> dict:
        """
        Login user and return authentication tokens

        Args:
            username: Username or email
            password: Plain text password

        Returns:
            Dictionary with tokens and user data

        Raises:
            AuthenticationError: If credentials are invalid or user not found
        """
        # Find user by username or email
        user = User.query.filter((User.username == username) | (User.email == username)).first()

        if not user:
            raise AuthenticationError("Invalid credentials")

        if not user.is_active:
            raise AuthenticationError("Account is disabled")

        # Verify password
        if not PasswordSecurity.verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid credentials")

        # Update last login
        user.last_login = datetime.utcnow()
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Create tokens
        tokens = TokenManager.create_tokens(str(user.id), user.username, user.role.name)

        return {
            "user": user.to_dict(),
            "tokens": tokens,
        }

    @staticmethod
    def refresh_access_token(user_id: str) -> dict:
        """
        Refresh access token using refresh token

        Args:
            user_id: User ID from refresh token

        Returns:
            Dictionary with new access token

        Raises:
            ResourceNotFoundError: If user not found
        """
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            raise ResourceNotFoundError("User not found")

        if not user.is_active:
            raise AuthenticationError("Account is disabled")

        # Create new access token only
        access_token = TokenManager.create_tokens(
            str(user.id), user.username, user.role.name
        )["access_token"]

        return {
            "access_token": access_token,
            "token_type": "Bearer",
        }

    @staticmethod
    def get_user_by_id(user_id: str) -> User:
        """
        Get user by ID

        Args:
            user_id: User ID

        Returns:
            User object

        Raises:
            ResourceNotFoundError: If user not found
        """
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            raise ResourceNotFoundError("User not found")

        return user

    @staticmethod
    def change_password(user_id: str, old_password: str, new_password: str) -> dict:
        """
        Change user password

        Args:
            user_id: User ID
            old_password: Current password
            new_password: New password

        Returns:
            Success message

        Raises:
            AuthenticationError: If old password is incorrect
            ValidationError: If new password doesn't meet requirements
        """
        user = AuthService.get_user_by_id(user_id)

        # Verify old password
        if not PasswordSecurity.verify_password(old_password, user.password_hash):
            raise AuthenticationError("Current password is incorrect")

        # Validate new password
        Validators.validate_password(new_password)

        # Update password
        user.password_hash = PasswordSecurity.hash_password(new_password)
        user.save()

        return {"message": "Password changed successfully"}


def initialize_roles():
    """
    Initialize default roles in database
    Call this during app startup
    """
    roles_data = [
        {"name": RoleEnum.ADMIN.value, "description": "Administrator with full access"},
        {"name": RoleEnum.MANAGER.value, "description": "Manager can approve loans/accounts"},
        {"name": RoleEnum.STAFF.value, "description": "Staff can create accounts and handle queries"},
        {"name": RoleEnum.CUSTOMER.value, "description": "Regular customer"},
    ]

    for role_data in roles_data:
        existing_role = Role.objects(name=role_data["name"]).first()
        if not existing_role:
            try:
                role = Role(name=role_data["name"], description=role_data["description"])
                role.save()
            except Exception as e:
                raise Exception(f"Failed to initialize roles: {str(e)}")
