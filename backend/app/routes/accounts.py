"""
Account management API routes
"""
from flask import Blueprint, request, jsonify
from app.services.account_service import AccountService
from app.services.user_service import UserService
from app.utils.exceptions import BankingException
from app.middleware.rbac import require_role, require_authentication, get_current_user

# Create blueprint
accounts_bp = Blueprint("accounts", __name__, url_prefix="/api/accounts")


def verify_account_access(account, current_user):
    """
    Verify if current user has access to account
    Returns True if user has access, False otherwise
    """
    if current_user["role"] in ["admin", "manager", "staff"]:
        return True

    # Compare user IDs as strings (account.user_id is MongoEngine reference)
    account_owner_id = str(account.user_id.id) if hasattr(account.user_id, 'id') else str(account.user_id)
    current_user_id = str(current_user["user_id"])

    return account_owner_id == current_user_id


@accounts_bp.route("", methods=["POST"])
@require_authentication
def create_account():
    """
    Create a new bank account

    - Authenticated users can create accounts for themselves (no user_id required)
    - Admin/Staff can create accounts for other users by providing user_id

    Request body:
        {
            "account_type": "savings",  # savings, current, salary
            "initial_balance": 1000.00,
            "user_id": "str_id"  # Optional - Admin/Staff only, for creating accounts for others
        }

    Returns:
        201: Account created (with auto-generated ATM card)
        400: Validation error
        403: Unauthorized
    """
    try:
        data = request.get_json()
        current_user = get_current_user()

        # Determine which user to create account for
        user_id = data.get("user_id")

        # If no user_id provided, use current user's ID
        if not user_id:
            user_id = current_user["user_id"]
        # If user_id differs from current user, only allow admin/staff
        elif user_id != current_user["user_id"]:
            if current_user["role"] not in ["admin", "staff"]:
                return jsonify({"error": "Only admin/staff can create accounts for other users"}), 403

        account_type = data.get("account_type", "savings")
        initial_balance = data.get("initial_balance", 0.0)

        # Create account and auto-generate ATM card
        account, card = AccountService.create_account(
            user_id=user_id,
            account_type=account_type,
            initial_balance=initial_balance
        )

        # Build response with card info if card was generated
        response_data = {
            "message": "Account created successfully. ATM card auto-generated.",
            "account": account.to_dict()
        }

        # Include card info if it was created
        if card:
            response_data["card"] = {
                "id": str(card.id),
                "card_number": f"****{card.card_number[-4:]}",  # Masked
                "expiry_date": card.expiry_date,
                "message": "Your ATM card is ready. Please set your PIN before first use."
            }

        return jsonify(response_data), 201

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("", methods=["GET"])
@require_authentication
def list_user_accounts():
    """
    Get all accounts for current user

    Query parameters:
        user_id: User ID (Admin/Staff only, otherwise uses current user)

    Returns:
        200: List of accounts
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        user_id = request.args.get("user_id")

        # Authorization check
        if user_id and current_user["role"] not in ["admin", "manager", "staff"]:
            return jsonify({"error": "Only admin/manager/staff can view other users' accounts"}), 403

        # Use requested user_id or current user
        target_user_id = user_id if user_id else current_user["user_id"]

        accounts = AccountService.get_user_accounts(target_user_id)

        return jsonify({
            "user_id": target_user_id,
            "count": len(accounts),
            "accounts": [account.to_dict() for account in accounts]
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>", methods=["GET"])
@require_authentication
def get_account(account_id):
    """
    Get account details with optional card information

    Authorization:
        - Account owner can view
        - Admin/Manager/Staff can view any account

    Returns:
        200: Account details with associated card
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account = AccountService.get_account_by_id(account_id)

        # Check authorization
        if not verify_account_access(account, current_user):
            return jsonify({"error": "You can only view your own accounts"}), 403

        # Get associated card if exists
        from app.models.base import Card
        card = Card.objects(account_id=account_id).first()

        response = {
            "account": account.to_dict(),
            "owner": account.user.to_dict()
        }

        # Include card info if card exists
        if card:
            response["card"] = card.to_dict()

        return jsonify(response), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/balance", methods=["GET"])
@require_authentication
def get_account_balance(account_id):
    """
    Get account balance

    Returns:
        200: Balance information
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account = AccountService.get_account_by_id(account_id)

        # Check authorization
        if not verify_account_access(account, current_user):
            return jsonify({"error": "Unauthorized"}), 403

        balance = AccountService.get_account_balance(account_id)

        return jsonify(balance), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/freeze", methods=["POST"])
@require_role("admin", "manager")
def freeze_account(account_id):
    """
    Freeze account (block transactions) - Admin/Manager only

    Returns:
        200: Account frozen
        400: Invalid operation
        404: Account not found
        403: Unauthorized
    """
    try:
        account = AccountService.freeze_account(account_id)

        return jsonify({
            "message": "Account frozen successfully",
            "account": account.to_dict()
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/unfreeze", methods=["POST"])
@require_role("admin", "manager")
def unfreeze_account(account_id):
    """
    Unfreeze account (allow transactions) - Admin/Manager only

    Returns:
        200: Account unfrozen
        400: Invalid operation
        404: Account not found
        403: Unauthorized
    """
    try:
        account = AccountService.unfreeze_account(account_id)

        return jsonify({
            "message": "Account unfrozen successfully",
            "account": account.to_dict()
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/close", methods=["POST"])
@require_role("admin")
def close_account(account_id):
    """
    Close account permanently - Admin only

    Requirements:
        - Account balance must be 0
        - Account status will be CLOSED

    Returns:
        200: Account closed
        400: Cannot close (has balance or already closed)
        404: Account not found
        403: Unauthorized
    """
    try:
        account = AccountService.close_account(account_id)

        return jsonify({
            "message": "Account closed successfully",
            "account": account.to_dict()
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/status", methods=["GET"])
@require_authentication
def get_account_status(account_id):
    """
    Get account status details

    Returns:
        200: Status information
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account = AccountService.get_account_by_id(account_id)

        # Check authorization
        if not verify_account_access(account, current_user):
            return jsonify({"error": "Unauthorized"}), 403

        status = AccountService.get_account_status(account_id)

        return jsonify(status), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/interest/calculate", methods=["GET"])
@require_authentication
def calculate_interest(account_id):
    """
    Calculate estimated monthly interest for account

    Authorization:
        - Account owner can view
        - Admin/Manager/Staff can view any account

    Query parameters:
        None

    Returns:
        200: Interest calculation details
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account = AccountService.get_account_by_id(account_id)

        # Check authorization
        if not verify_account_access(account, current_user):
            return jsonify({"error": "Unauthorized"}), 403

        from app.services.interest_service import InterestService
        result = InterestService.calculate_interest_for_account(account_id)

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/interest/accrue", methods=["POST"])
@require_role("admin", "manager", "staff")
def accrue_interest(account_id):
    """
    Manually accrue (credit) monthly interest to account (Admin/Manager/Staff only)

    Authorization:
        - Admin/Manager/Staff only

    Returns:
        200: Interest accrued successfully
        400: Interest accrual failed
        404: Account not found
        403: Unauthorized
    """
    try:
        from app.services.interest_service import InterestService
        result = InterestService.accrue_interest_for_account(account_id)

        if result.get("status") == "success":
            return jsonify(result), 200
        else:
            return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>/interest/statistics", methods=["GET"])
@require_authentication
def get_interest_statistics(account_id):
    """
    Get interest statistics for account

    Authorization:
        - Account owner can view
        - Admin/Manager/Staff can view any account

    Returns:
        200: Interest statistics
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account = AccountService.get_account_by_id(account_id)

        # Check authorization
        if not verify_account_access(account, current_user):
            return jsonify({"error": "Unauthorized"}), 403

        from app.services.interest_service import InterestService
        result = InterestService.get_interest_statistics(account_id)

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/interest/process-all", methods=["POST"])
@require_role("admin")
def process_interest_all_users():
    """
    Process monthly interest for all users in the system (Admin only)

    This should typically be scheduled to run on the 1st of each month

    Authorization:
        - Admin only

    Returns:
        200: Interest processing complete
        403: Unauthorized
    """
    try:
        from app.services.interest_service import InterestService
        result = InterestService.process_monthly_interest_for_all_users()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/interest/process-user", methods=["POST"])
@require_role("admin", "manager")
def process_interest_user():
    """
    Process monthly interest for a specific user (Admin/Manager only)

    Request body:
        {
            "user_id": "str_id"
        }

    Returns:
        200: Interest processing complete
        400: Validation error
        403: Unauthorized
    """
    try:
        data = request.get_json()

        if "user_id" not in data:
            return jsonify({"error": "user_id is required"}), 400

        user_id = data.get("user_id")

        from app.services.interest_service import InterestService
        result = InterestService.process_monthly_interest_for_user(user_id)

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accounts_bp.route("/<account_id>", methods=["DELETE"])
@require_authentication
def delete_account(account_id):
    """
    Delete an account

    Authorization:
        - Customer can only delete their own accounts
        - Admin/Manager/Staff can delete any account

    Returns:
        200: Account deleted successfully
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account = AccountService.get_account_by_id(account_id)

        # Check authorization - compare user IDs as strings
        account_owner_id = str(account.user_id.id) if hasattr(account.user_id, 'id') else str(account.user_id)
        current_user_id = str(current_user["user_id"])

        if (current_user["role"] not in ["admin", "manager", "staff"] and
                account_owner_id != current_user_id):
            return jsonify({"error": "You can only delete your own accounts"}), 403

        # Delete associated card first
        from app.models.base import Card
        Card.objects(account_id=account_id).delete()

        # Delete account
        account.delete()

        return jsonify({
            "message": "Account deleted successfully",
            "account_id": account_id
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@accounts_bp.errorhandler(BankingException)
def handle_banking_exception(error):
    """Handle custom banking exceptions"""
    return jsonify({"error": error.message}), error.status_code
