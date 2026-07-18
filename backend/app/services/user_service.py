"""
User management service - Business logic for user operations
"""
from app.models.user import User, Role, RoleEnum
from app.utils.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    AuthorizationError,
)
from datetime import datetime


class UserService:
    """Handle user management operations"""

    @staticmethod
    def get_all_users(page: int = 1, per_page: int = 20) -> dict:
        """
        Get all users with pagination

        Args:
            page: Page number (1-indexed)
            per_page: Users per page

        Returns:
            Dictionary with users list and pagination info
        """
        skip = (page - 1) * per_page
        users = User.objects.order_by("-created_at").skip(skip).limit(per_page)
        total = User.objects.count()
        pages = (total + per_page - 1) // per_page

        return {
            "users": [user.to_dict() for user in users],
            "total": total,
            "pages": pages,
            "current_page": page,
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
            raise ResourceNotFoundError(f"User with ID {user_id} not found")

        return user

    @staticmethod
    def get_user_by_username(username: str) -> User:
        """
        Get user by username

        Args:
            username: Username

        Returns:
            User object

        Raises:
            ResourceNotFoundError: If user not found
        """
        user = User.objects(username=username).first()

        if not user:
            raise ResourceNotFoundError(f"User {username} not found")

        return user

    @staticmethod
    def get_user_by_email(email: str) -> User:
        """
        Get user by email

        Args:
            email: Email address

        Returns:
            User object

        Raises:
            ResourceNotFoundError: If user not found
        """
        user = User.objects(email=email).first()

        if not user:
            raise ResourceNotFoundError(f"User with email {email} not found")

        return user

    @staticmethod
    def update_user(user_id: str, **kwargs) -> User:
        """
        Update user information

        Args:
            user_id: User ID
            **kwargs: Fields to update (first_name, last_name, phone_number)

        Returns:
            Updated user object

        Raises:
            ResourceNotFoundError: If user not found
            ValidationError: If validation fails
        """
        user = UserService.get_user_by_id(user_id)

        # Allow updating these fields only
        allowed_fields = {"first_name", "last_name", "phone_number", "is_active", "is_verified"}
        update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields}

        if not update_fields:
            raise ValidationError("No valid fields to update")

        # Validate phone if being updated
        if "phone_number" in update_fields:
            from app.utils.validators import Validators
            Validators.validate_phone(update_fields["phone_number"])

            # Check if phone already exists
            existing = User.objects(
                phone_number=update_fields["phone_number"],
                id__ne=user_id
            ).first()

            if existing:
                raise ValidationError("Phone number already in use")

        # Validate names if being updated
        if "first_name" in update_fields:
            from app.utils.validators import Validators
            Validators.validate_name(update_fields["first_name"], "First name")

        if "last_name" in update_fields:
            from app.utils.validators import Validators
            Validators.validate_name(update_fields["last_name"], "Last name")

        # Update fields
        for field, value in update_fields.items():
            setattr(user, field, value)

        user.updated_at = datetime.utcnow()
        user.save()

        return user

    @staticmethod
    def assign_role(user_id: str, role_name: str) -> User:
        """
        Assign role to user

        Args:
            user_id: User ID
            role_name: Role name (admin, manager, staff, customer)

        Returns:
            Updated user object

        Raises:
            ResourceNotFoundError: If user or role not found
            ValidationError: If role invalid
        """
        user = UserService.get_user_by_id(user_id)

        # Validate role exists
        role = Role.objects(name=role_name).first()

        if not role:
            available_roles = ", ".join([r.name for r in Role.objects()])
            raise ValidationError(f"Invalid role. Available: {available_roles}")

        user.role = role
        user.updated_at = datetime.utcnow()
        user.save()

        return user

    @staticmethod
    def deactivate_user(user_id: str) -> User:
        """
        Deactivate user (disable account)

        Args:
            user_id: User ID

        Returns:
            Updated user object
        """
        user = UserService.get_user_by_id(user_id)

        user.is_active = False
        user.updated_at = datetime.utcnow()
        user.save()

        return user

    @staticmethod
    def activate_user(user_id: str) -> User:
        """
        Activate user (enable account)

        Args:
            user_id: User ID

        Returns:
            Updated user object
        """
        user = UserService.get_user_by_id(user_id)

        user.is_active = True
        user.updated_at = datetime.utcnow()
        user.save()

        return user

    @staticmethod
    def search_users(query: str, search_type: str = "username") -> list:
        """
        Search users by username, email, or phone

        Args:
            query: Search query string
            search_type: Search field (username, email, phone)

        Returns:
            List of matching users
        """
        if search_type == "username":
            users = User.objects(username__icontains=query)
        elif search_type == "email":
            users = User.objects(email__icontains=query)
        elif search_type == "phone":
            users = User.objects(phone_number__contains=query)
        else:
            raise ValidationError("Invalid search type")

        return list(users)
