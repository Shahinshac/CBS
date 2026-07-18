"""
Admin-only endpoints for user and customer management
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app.middleware.rbac import require_role, get_current_user
from app.models.user import User, Role
from app.utils.exceptions import BankingException
from app.utils.security import PasswordSecurity
import secrets
import string

# Create blueprint
admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/customers", methods=["POST"])
@require_role("admin", "staff")
def create_customer():
    """
    Create a new customer account (ADMIN/STAFF ONLY)

    This is the ONLY way to create customer accounts.
    Public registration is disabled for security.

    Request body:
        {
            "email": "customer@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "phone_number": "+91-9876543210",
            "temporary_password": "TempPass123!" (optional - auto-generated if not provided)
        }

    Returns:
        201: Customer created with is_first_login=true
        400: Validation error
        409: User already exists
        403: Unauthorized (not admin/staff)
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        required_fields = ["email", "first_name", "last_name", "phone_number"]
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields: email, first_name, last_name, phone_number"}), 400

        email = data["email"].strip()
        first_name = data["first_name"].strip()
        last_name = data["last_name"].strip()
        phone_number = data["phone_number"].strip()

        # Validate email format
        if "@" not in email or "." not in email:
            return jsonify({"error": "Invalid email format"}), 400

        # Validate names
        if len(first_name) < 2 or len(first_name) > 100:
            return jsonify({"error": "First name must be 2-100 characters"}), 400

        if len(last_name) < 2 or len(last_name) > 100:
            return jsonify({"error": "Last name must be 2-100 characters"}), 400

        # Validate phone number
        if len(phone_number) < 9 or len(phone_number) > 15:
            return jsonify({"error": "Phone number must be 9-15 digits"}), 400

        # Check if user already exists
        if User.objects(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        if User.objects(phone_number=phone_number).first():
            return jsonify({"error": "Phone number already registered"}), 409

        # Generate username from email (username@domain → username)
        username = email.split("@")[0]

        # Ensure unique username
        counter = 1
        original_username = username
        while User.objects(username=username).first():
            username = f"{original_username}{counter}"
            counter += 1

        # Generate or use provided temporary password
        temporary_password = data.get("temporary_password")
        if not temporary_password:
            # Generate secure random password
            chars = string.ascii_letters + string.digits + "!@#$%^&*"
            temporary_password = "".join(secrets.choice(chars) for _ in range(12))

        # Validate password strength
        if len(temporary_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        # Get customer role
        customer_role = Role.objects(name="customer").first()
        if not customer_role:
            return jsonify({"error": "Customer role not found in system"}), 500

        # Create new customer
        new_customer = User(
            username=username,
            email=email,
            password_hash=PasswordSecurity.hash_password(temporary_password),
            first_name=first_name,
            last_name=last_name,
            phone_number=phone_number,
            role=customer_role,
            is_active=True,
            is_verified=False,  # Require email verification
            is_first_login=True  # Force password change on first login
        )

        new_customer.save()

        # Audit log
        print(f"[AUDIT] Admin {current_user['username']} created customer {new_customer.username}")

        return jsonify({
            "message": "Customer account created successfully",
            "customer": {
                "id": str(new_customer.id),
                "username": new_customer.username,
                "email": new_customer.email,
                "first_name": new_customer.first_name,
                "last_name": new_customer.last_name,
                "phone_number": new_customer.phone_number,
                "role": "customer",
                "is_first_login": True,
                "temporary_password": temporary_password,
                "note": "Customer must change password on first login. Share temporary password securely."
            }
        }), 201

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/customers/<customer_id>/reset-password", methods=["POST"])
@require_role("admin")
def reset_customer_password(customer_id):
    """
    Reset customer password (ADMIN ONLY)

    When a customer forgets their password, admin can reset it.
    Customer will receive temporary password and must change on next login.

    Request body:
        {}  (No body required)

    Returns:
        200: Password reset with new temporary password
        404: Customer not found
        403: Unauthorized (not admin)
    """
    try:
        current_user = get_current_user()
        try:
            customer = User.objects(id=customer_id).first()
        except Exception:
            customer = None

        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        if customer.role.name != "customer":
            return jsonify({"error": "User is not a customer"}), 400

        # Generate secure random password
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        temporary_password = "".join(secrets.choice(chars) for _ in range(12))

        # Update password and mark for first login
        customer.password_hash = PasswordSecurity.hash_password(temporary_password)
        customer.is_first_login = True

        customer.save()

        # Audit log
        print(f"[AUDIT] Admin {current_user['username']} reset password for customer {customer.username}")

        return jsonify({
            "message": "Password reset successfully",
            "customer": {
                "id": str(customer.id),
                "username": customer.username,
                "email": customer.email,
                "temporary_password": temporary_password,
                "note": "Customer must change password on first login"
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/customers/<customer_id>/deactivate", methods=["POST"])
@require_role("admin")
def deactivate_customer(customer_id):
    """
    Deactivate a customer account (ADMIN ONLY)

    Deactivated customers cannot login.

    Returns:
        200: Customer deactivated
        404: Customer not found
        403: Unauthorized
    """
    try:
        try:
            customer = User.objects(id=customer_id).first()
        except Exception:
            customer = None

        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        customer.is_active = False
        customer.save()

        return jsonify({
            "message": "Customer account deactivated",
            "customer": customer.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/customers/<customer_id>/activate", methods=["POST"])
@require_role("admin")
def activate_customer(customer_id):
    """
    Activate a customer account (ADMIN ONLY)

    Reactivates a deactivated customer.

    Returns:
        200: Customer activated
        404: Customer not found
        403: Unauthorized
    """
    try:
        try:
            customer = User.objects(id=customer_id).first()
        except Exception:
            customer = None

        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        customer.is_active = True
        customer.save()

        return jsonify({
            "message": "Customer account activated",
            "customer": customer.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/customers", methods=["GET"])
@require_role("admin", "staff")
def list_customers():
    """
    List all customers (ADMIN/STAFF ONLY)

    Query parameters:
        - page: Page number (default 1)
        - per_page: Results per page (default 20)

    Returns:
        200: List of customers
        403: Unauthorized
    """
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        customer_role = Role.objects(name="customer").first()
        if not customer_role:
            return jsonify({"error": "Customer role not found"}), 500

        skip = (page - 1) * per_page
        customers = list(User.objects(role=customer_role).skip(skip).limit(per_page))
        total = User.objects(role=customer_role).count()
        pages = (total + per_page - 1) // per_page

        return jsonify({
            "customers": [c.to_dict() for c in customers],
            "total": total,
            "pages": pages,
            "current_page": page
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
