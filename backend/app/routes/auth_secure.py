"""
Authentication API routes - Enterprise Banking Security
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.services.auth_service import AuthService
from app.utils.exceptions import BankingException, UserAlreadyExistsError, ValidationError
from app.utils.security import TokenManager, PasswordSecurity
from app.middleware.rbac import require_authentication, require_role, get_current_user
from app.models.user import User

# Create blueprint
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
@require_authentication
def register():
    """
    Register a new user account

    - Public users: Can only register as 'customer'
    - Admin users: Can register users with any role (admin, staff, customer)

    Request body:
        {
            "username": "john_doe",
            "email": "john@example.com",
            "password": "SecurePass123",
            "first_name": "John",
            "last_name": "Doe",
            "phone_number": "+1-234-567-8900",  # optional
            "role": "customer"  # optional, admin-only for non-customer roles
        }

    Returns:
        201: Registration successful with user info
        400: Validation error
        409: User already exists
        403: Unauthorized (for non-admin assigning non-customer roles)
    """
    try:
        data = request.get_json()
        current_user = get_current_user()

        # Validate required fields
        required_fields = ["username", "email", "password", "first_name", "last_name"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"{field.replace('_', ' ').title()} is required"}), 400

        # Determine role
        requested_role = data.get("role", "customer")

        # Non-admin users can only create 'customer' accounts
        if current_user["role"] != "admin" and requested_role != "customer":
            return jsonify({"error": "Only admins can create non-customer accounts"}), 403

        # Generate default phone if not provided
        phone_number = data.get("phone_number", "")
        if not phone_number:
            import uuid
            phone_num = str(uuid.uuid4()).replace('-', '')[:10]
            phone_number = f"+1-{phone_num[:3]}-{phone_num[3:6]}-{phone_num[6:10]}"

        # Register user
        user = AuthService.register_user(
            username=data["username"],
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            phone_number=phone_number,
            role=requested_role
        )

        return jsonify({
            "message": "User registered successfully",
            "user": user
        }), 201

    except UserAlreadyExistsError as e:
        return jsonify({"error": str(e.message)}), 409
    except ValidationError as e:
        return jsonify({"error": str(e.message)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Login user and get authentication tokens

    Works for ALL roles: admin, staff, customer

    Request body:
        {
            "username": "john_doe",  # Can also use email
            "password": "SecurePass123"
        }

    Returns:
        200: Login successful with tokens and user info
        401: Invalid credentials
        400: Validation error
    """
    try:
        data = request.get_json()

        if not data.get("username") or not data.get("password"):
            return jsonify({"error": "Username and password are required"}), 400

        # Call service for login
        result = AuthService.login(data["username"], data["password"])

        # Flatten response to match frontend expectations
        return jsonify({
            "user": result["user"],
            "access_token": result["tokens"]["access_token"],
            "refresh_token": result["tokens"]["refresh_token"]
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/change-password-first-login", methods=["POST"])
@jwt_required()
def change_password_first_login():
    """
    Change password on first login (no old password required)

    MUST be called after first login if is_first_login = true

    Request body:
        {
            "new_password": "NewSecurePassword123"
        }

    Returns:
        200: Password changed successfully
        400: Validation error
        401: Unauthorized
    """
    try:
        user_id = get_jwt()["sub"]
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        new_password = data.get("new_password")

        if not new_password:
            return jsonify({"error": "New password is required"}), 400

        # Validate password strength
        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        if not any(c.isupper() for c in new_password):
            return jsonify({"error": "Password must contain uppercase letters"}), 400

        if not any(c.islower() for c in new_password):
            return jsonify({"error": "Password must contain lowercase letters"}), 400

        if not any(c.isdigit() for c in new_password):
            return jsonify({"error": "Password must contain numbers"}), 400

        # Change password
        user.password_hash = PasswordSecurity.hash_password(new_password)
        user.is_first_login = False  # Mark first login as complete

        user.save()

        return jsonify({
            "message": "Password changed successfully",
            "user": user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """
    Change password (requires old password for security)

    Request body:
        {
            "old_password": "CurrentPassword123",
            "new_password": "NewSecurePassword123"
        }

    Returns:
        200: Password changed successfully
        400: Invalid old password or validation error
        401: Unauthorized
    """
    try:
        user_id = get_jwt()["sub"]
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        old_password = data.get("old_password")
        new_password = data.get("new_password")

        if not old_password or not new_password:
            return jsonify({"error": "Old and new passwords are required"}), 400

        # Verify old password
        if not PasswordSecurity.verify_password(old_password, user.password_hash):
            return jsonify({"error": "Old password is incorrect"}), 400

        # Validate new password strength
        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        if not any(c.isupper() for c in new_password):
            return jsonify({"error": "Password must contain uppercase letters"}), 400

        if not any(c.islower() for c in new_password):
            return jsonify({"error": "Password must contain lowercase letters"}), 400

        if not any(c.isdigit() for c in new_password):
            return jsonify({"error": "Password must contain numbers"}), 400

        # Prevent same password
        if old_password == new_password:
            return jsonify({"error": "New password must be different from current password"}), 400

        # Change password
        user.password_hash = PasswordSecurity.hash_password(new_password)
        user.save()

        return jsonify({
            "message": "Password changed successfully"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh_token():
    """
    Refresh access token using refresh token

    Headers:
        Authorization: Bearer <refresh_token>

    Returns:
        200: New access token
        401: Invalid refresh token
    """
    try:
        user_id = get_jwt()["sub"]
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user or not user.is_active:
            return jsonify({"error": "User not found or is inactive"}), 401

        # Generate new access token
        access_token = TokenManager.create_tokens(
            str(user.id), user.username, user.role.name
        )["access_token"]

        return jsonify({
            "access_token": access_token,
            "token_type": "Bearer"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user_info():
    """
    Get current logged-in user information

    Headers:
        Authorization: Bearer <access_token>

    Returns:
        200: Current user information
        401: Unauthorized
    """
    try:
        user_id = get_jwt()["sub"]
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify(user.to_dict()), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    Logout user (token is invalidated via logout)

    In a production system, you would add token to a blacklist
    For now, simply instructing client to discard token

    Returns:
        200: Logout successful
    """
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route("/set-mpin", methods=["POST"])
@jwt_required()
def set_mpin():
    """
    Set 6-digit MPIN for first time after login

    Headers:
        Authorization: Bearer <access_token>

    Request body:
        {
            "mpin": "123456"  # 6 digits only
        }

    Returns:
        200: MPIN set successfully
        400: Invalid MPIN format
        401: Unauthorized
    """
    try:
        user_id = get_jwt()["sub"]
        data = request.get_json()

        # Validate MPIN
        mpin = data.get("mpin", "").strip()
        if not mpin or len(mpin) != 6 or not mpin.isdigit():
            return jsonify({"error": "MPIN must be exactly 6 digits"}), 400

        # Get user
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Hash and set MPIN
        mpin_hash = PasswordSecurity.hash_password(mpin)
        user.mpin_hash = mpin_hash
        user.mpin_set = True
        user.save()

        return jsonify({"message": "MPIN set successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/verify-mpin", methods=["POST"])
@jwt_required()
def verify_mpin():
    """
    Verify MPIN before performing transactions

    Headers:
        Authorization: Bearer <access_token>

    Request body:
        {
            "mpin": "123456"  # User's 6-digit MPIN
        }

    Returns:
        200: MPIN verified successfully
        400: Invalid MPIN
        401: MPIN not set
    """
    try:
        user_id = get_jwt()["sub"]
        data = request.get_json()

        mpin = data.get("mpin", "")
        if not mpin:
            return jsonify({"error": "MPIN is required"}), 400

        # Get user
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check if MPIN is set
        if not user.mpin_set or not user.mpin_hash:
            return jsonify({"error": "MPIN not set. Please set MPIN first."}), 401

        # Verify MPIN
        if not PasswordSecurity.verify_password(mpin, user.mpin_hash):
            return jsonify({"error": "Invalid MPIN"}), 400

        return jsonify({"message": "MPIN verified successfully", "verified": True}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
