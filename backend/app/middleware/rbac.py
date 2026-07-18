"""
Role-Based Access Control (RBAC) middleware
"""
from functools import wraps
from flask import current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from app.utils.exceptions import AuthorizationError


def require_role(*allowed_roles):
    """
    Decorator to enforce role-based access control

    Args:
        allowed_roles: One or more role names that are allowed

    Usage:
        @require_role('admin')
        @require_role('admin', 'manager')
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Verify JWT token
            verify_jwt_in_request()

            # Get claims from JWT
            claims = get_jwt()
            user_role = claims.get("role")

            # Check if user's role is in allowed roles
            if user_role not in allowed_roles:
                raise AuthorizationError(
                    f"This action requires one of these roles: {', '.join(allowed_roles)}"
                )

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_authentication(fn):
    """
    Decorator to require valid JWT token (any authenticated user)

    Usage:
        @require_authentication
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        return fn(*args, **kwargs)

    return wrapper


def get_current_user():
    """
    Get current authenticated user info from JWT

    Returns:
        Dictionary with user_id, username, role

    Raises:
        AuthenticationError: If JWT is invalid
    """
    verify_jwt_in_request()
    claims = get_jwt()

    return {
        "user_id": claims.get("sub"),
        "username": claims.get("username"),
        "role": claims.get("role"),
    }


# Role constants for use in decorators
ADMIN_ONLY = ("super_admin", "admin")
ADMIN_MANAGER = ("super_admin", "admin", "branch_manager", "manager")
ADMIN_MANAGER_STAFF = ("super_admin", "admin", "branch_manager", "manager", "teller", "staff", "loan_officer", "customer_support")
ANYONE = ("super_admin", "admin", "branch_manager", "manager", "teller", "staff", "loan_officer", "customer_support", "auditor", "customer")
AUDITOR_ONLY = ("super_admin", "admin", "auditor")
LOAN_OFFICER_ONLY = ("super_admin", "admin", "branch_manager", "manager", "loan_officer")
