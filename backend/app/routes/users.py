"""
User management API routes
"""
from flask import Blueprint, request, jsonify
from app.services.user_service import UserService
from app.utils.exceptions import BankingException
from app.middleware.rbac import require_role, require_authentication, get_current_user

# Create blueprint
users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.route("", methods=["GET"])
@require_role("admin", "manager")
def list_users():
    """
    List all users (Admin/Manager only)

    Query parameters:
        page: Page number (default: 1)
        per_page: Items per page (default: 20)

    Returns:
        200: List of users with pagination
        403: Unauthorized
    """
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        result = UserService.get_all_users(page=page, per_page=per_page)

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.route("/<user_id>", methods=["GET"])
@require_authentication
def get_user(user_id):
    """
    Get user details

    Restrictions:
        - Admin/Manager: Can view any user
        - Customer: Can only view own profile

    Returns:
        200: User details
        404: User not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()

        # Check authorization
        if current_user["role"] not in ["admin", "manager"] and current_user["user_id"] != user_id:
            return jsonify({"error": "You can only view your own profile"}), 403

        user = UserService.get_user_by_id(user_id)

        return jsonify({
            "user": user.to_dict(),
            "role": user.role.name
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.route("/<user_id>", methods=["PUT"])
@require_role("admin")
def update_user(user_id):
    """
    Update user information (Admin only)

    Request body:
        {
            "first_name": "John",
            "last_name": "Doe",
            "phone_number": "+91-9876543210",
            "is_active": true,
            "is_verified": true
        }

    Returns:
        200: Updated user
        400: Validation error
        404: User not found
        403: Unauthorized
    """
    try:
        data = request.get_json()

        user = UserService.update_user(user_id, **data)

        return jsonify({
            "message": "User updated successfully",
            "user": user.to_dict()
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.route("/<user_id>/assign-role", methods=["POST"])
@require_role("admin")
def assign_role(user_id):
    """
    Assign role to user (Admin only)

    Request body:
        {
            "role": "manager"
        }

    Valid roles: admin, manager, staff, customer

    Returns:
        200: User with new role
        400: Invalid role
        404: User not found
        403: Unauthorized
    """
    try:
        data = request.get_json()

        if not data.get("role"):
            return jsonify({"error": "Role is required"}), 400

        user = UserService.assign_role(user_id, data["role"])

        return jsonify({
            "message": "Role assigned successfully",
            "user": user.to_dict(),
            "role": user.role.name
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.route("/<user_id>/deactivate", methods=["POST"])
@require_role("admin")
def deactivate_user(user_id):
    """
    Deactivate user account (Admin only)

    Returns:
        200: User deactivated
        404: User not found
        403: Unauthorized
    """
    try:
        user = UserService.deactivate_user(user_id)

        return jsonify({
            "message": "User deactivated successfully",
            "user": user.to_dict()
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.route("/<user_id>/activate", methods=["POST"])
@require_role("admin")
def activate_user(user_id):
    """
    Activate user account (Admin only)

    Returns:
        200: User activated
        404: User not found
        403: Unauthorized
    """
    try:
        user = UserService.activate_user(user_id)

        return jsonify({
            "message": "User activated successfully",
            "user": user.to_dict()
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.route("/<user_id>", methods=["DELETE"])
@require_role("admin")
def delete_user(user_id):
    """
    Delete user account (Admin only)

    WARNING: This will permanently delete the user and all associated data

    Returns:
        200: User deleted
        404: User not found
        403: Unauthorized
        400: Cannot delete self
    """
    try:
        current_user = get_current_user()

        # Prevent deleting oneself
        if current_user["user_id"] == user_id:
            return jsonify({"error": "You cannot delete your own account"}), 400

        user = UserService.get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Delete user
        user.delete()

        return jsonify({
            "message": "User deleted successfully",
            "deleted_user_id": user_id
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.route("/search", methods=["GET"])
@require_role("admin", "manager", "staff")
def search_users():
    """
    Search users by username, email, or phone

    Query parameters:
        q: Search query (required)
        type: Search type - username, email, phone (default: username)

    Returns:
        200: List of matching users
        400: Bad request
        403: Unauthorized
    """
    try:
        query = request.args.get("q")
        search_type = request.args.get("type", "username")

        if not query:
            return jsonify({"error": "Query parameter 'q' is required"}), 400

        users = UserService.search_users(query, search_type)

        return jsonify({
            "query": query,
            "type": search_type,
            "count": len(users),
            "users": [user.to_dict() for user in users]
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@users_bp.errorhandler(BankingException)
def handle_banking_exception(error):
    """Handle custom banking exceptions"""
    return jsonify({"error": error.message}), error.status_code
