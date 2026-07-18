"""
Beneficiary management API routes
"""
from flask import Blueprint, request, jsonify
from app.services.beneficiary_service import BeneficiaryService
from app.utils.exceptions import BankingException
from app.middleware.rbac import require_role, require_authentication, get_current_user

# Create blueprint
beneficiaries_bp = Blueprint("beneficiaries", __name__, url_prefix="/api/beneficiaries")


@beneficiaries_bp.route("", methods=["POST"])
@require_authentication
def add_beneficiary():
    """
    Add a new beneficiary to account

    Request body:
        {
            "account_id": "str_id",
            "beneficiary_account_number": "982677845009883129",
            "beneficiary_name": "John Doe"
        }

    Returns:
        201: Beneficiary added (pending approval)
        400: Validation error
        404: Account not found
        409: Beneficiary already exists
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        required = ["account_id", "beneficiary_account_number", "beneficiary_name"]
        if not all(field in data for field in required):
            return jsonify({"error": "account_id, beneficiary_account_number, and beneficiary_name are required"}), 400

        account_id = data.get("account_id")
        beneficiary_account_number = data.get("beneficiary_account_number")
        beneficiary_name = data.get("beneficiary_name")

        # Check authorization
        from app.services.account_service import AccountService
        account = AccountService.get_account_by_id(account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only add beneficiaries to your own accounts"}), 403

        # Add beneficiary
        beneficiary = BeneficiaryService.add_beneficiary(
            account_id=account_id,
            beneficiary_account_number=beneficiary_account_number,
            beneficiary_name=beneficiary_name,
        )

        return jsonify({
            "message": "Beneficiary added successfully (pending approval)",
            "beneficiary": beneficiary.to_dict(),
        }), 201

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.route("", methods=["GET"])
@require_authentication
def list_beneficiaries():
    """
    List beneficiaries for account

    Query parameters:
        account_id: Account ID (required, must be own account or staff+)
        approved_only: Return only approved (default: false)

    Returns:
        200: List of beneficiaries
        400: Missing account_id
        403: Unauthorized
        404: Account not found
    """
    try:
        current_user = get_current_user()

        account_id = request.args.get("account_id")
        if not account_id:
            return jsonify({"error": "account_id is required"}), 400

        approved_only = request.args.get("approved_only", "false").lower() == "true"

        # Check authorization
        from app.services.account_service import AccountService
        account = AccountService.get_account_by_id(account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only view your own beneficiaries"}), 403

        beneficiaries = BeneficiaryService.get_account_beneficiaries(
            account_id=account_id,
            approved_only=approved_only,
        )

        return jsonify({
            "account_id": account_id,
            "count": len(beneficiaries),
            "approved_only": approved_only,
            "beneficiaries": [b.to_dict() for b in beneficiaries],
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.route("/<beneficiary_id>", methods=["GET"])
@require_authentication
def get_beneficiary(beneficiary_id):
    """
    Get specific beneficiary details

    Returns:
        200: Beneficiary details
        404: Not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        beneficiary = BeneficiaryService.get_beneficiary(beneficiary_id)

        # Check authorization
        from app.services.account_service import AccountService
        account = AccountService.get_account_by_id(beneficiary.account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only view your own beneficiaries"}), 403

        return jsonify(beneficiary.to_dict()), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.route("/<beneficiary_id>/approve", methods=["POST"])
@require_role("admin", "manager", "staff")
def approve_beneficiary(beneficiary_id):
    """
    Approve a beneficiary (Admin/Manager/Staff only)

    Returns:
        200: Beneficiary approved
        400: Already approved or other validation error
        404: Not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()

        beneficiary = BeneficiaryService.approve_beneficiary(
            beneficiary_id,
            approved_by_user_id=current_user["user_id"],
        )

        return jsonify({
            "message": "Beneficiary approved successfully",
            "beneficiary": beneficiary.to_dict(),
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.route("/<beneficiary_id>/reject", methods=["POST"])
@require_role("admin", "manager", "staff")
def reject_beneficiary(beneficiary_id):
    """
    Reject a beneficiary (Remove pending approval)

    Returns:
        200: Beneficiary rejected
        404: Not found
        403: Unauthorized
    """
    try:
        beneficiary = BeneficiaryService.reject_beneficiary(beneficiary_id)

        return jsonify({
            "message": f"Beneficiary {beneficiary.beneficiary_account_number} rejected",
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.route("/<beneficiary_id>", methods=["DELETE"])
@require_authentication
def delete_beneficiary(beneficiary_id):
    """
    Delete a beneficiary

    Returns:
        200: Beneficiary deleted
        404: Not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        beneficiary = BeneficiaryService.get_beneficiary(beneficiary_id)

        # Check authorization
        from app.services.account_service import AccountService
        account = AccountService.get_account_by_id(beneficiary.account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only delete your own beneficiaries"}), 403

        result = BeneficiaryService.delete_beneficiary(beneficiary_id)

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.route("/pending", methods=["GET"])
@require_role("admin", "manager", "staff")
def get_pending_beneficiaries():
    """
    Get all pending beneficiaries (Admin/Manager/Staff only)

    Returns:
        200: List of pending beneficiaries
        403: Unauthorized
    """
    try:
        beneficiaries = BeneficiaryService.get_pending_beneficiaries()

        return jsonify({
            "count": len(beneficiaries),
            "beneficiaries": [b.to_dict() for b in beneficiaries],
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.route("/statistics", methods=["GET"])
@require_role("admin", "manager", "staff")
def get_statistics():
    """
    Get beneficiary statistics (Admin/Manager/Staff only)

    Returns:
        200: Statistics
        403: Unauthorized
    """
    try:
        stats = BeneficiaryService.get_beneficiary_statistics()
        return jsonify(stats), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@beneficiaries_bp.errorhandler(BankingException)
def handle_banking_exception(error):
    """Handle custom banking exceptions"""
    return jsonify({"error": error.message}), error.status_code
