"""
Loan API routes
"""
from flask import Blueprint, request, jsonify
from app.services.loan_service import LoanService
from app.utils.exceptions import BankingException
from app.middleware.rbac import require_authentication, get_current_user, require_role

# Create blueprint
loans_bp = Blueprint("loans", __name__, url_prefix="/api/loans")


# ===== LOAN APPLICATION & MANAGEMENT =====


@loans_bp.route("", methods=["POST"])
@require_authentication
def apply_for_loan():
    """
    Apply for new loan

    Request body:
        {
            "account_id": "str_id",
            "loan_amount": 100000,
            "loan_type": "personal",
            "tenure_months": 12
        }

    Returns:
        201: Loan application created
        400: Validation error
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        required = ["account_id", "loan_amount", "loan_type", "tenure_months"]
        if not all(f in data for f in required):
            return jsonify({"error": "Missing required fields"}), 400

        loan = LoanService.apply_for_loan(
            user_id=current_user["user_id"],
            account_id=data["account_id"],
            loan_amount=data["loan_amount"],
            loan_type=data["loan_type"],
            tenure_months=data["tenure_months"],
        )

        return jsonify({
            "message": "Loan application submitted successfully",
            "loan": loan.to_dict(),
        }), 201

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.route("", methods=["GET"])
@require_authentication
def list_loans():
    """
    List user's loans

    Query parameters:
        status: Filter by status (pending, approved, active, closed, rejected)

    Returns:
        200: List of loans
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        status = request.args.get("status")

        loans = LoanService.get_user_loans(current_user["user_id"], status=status)

        return jsonify({
            "count": len(loans),
            "status_filter": status,
            "loans": [l.to_dict() for l in loans],
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.route("/<loan_id>", methods=["GET"])
@require_authentication
def get_loan_details(loan_id):
    """
    Get loan details

    Returns:
        200: Loan details
        404: Loan not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        loan = LoanService.get_loan(loan_id)

        # Check authorization
        if current_user["role"] not in ["admin", "manager", "staff"] and loan.user_id != current_user["user_id"]:
            return jsonify({"error": "You can only view your own loans"}), 403

        return jsonify(loan.to_dict()), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== APPROVAL & DISBURSEMENT =====


@loans_bp.route("/<loan_id>/approve", methods=["POST"])
@require_role("admin", "manager", "staff")
def approve_loan(loan_id):
    """
    Approve pending loan application

    Request body:
        {
            "disburse": true  # Optional, whether to disburse immediately
        }

    Returns:
        200: Loan approved
        400: Already processed
        404: Loan not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json() or {}
        disburse = data.get("disburse", True)

        loan = LoanService.approve_loan(
            loan_id=loan_id,
            approved_by_user_id=current_user["user_id"],
            disburse=disburse,
        )

        return jsonify({
            "message": "Loan approved successfully",
            "loan": loan.to_dict(),
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.route("/<loan_id>/reject", methods=["POST"])
@require_role("admin", "manager", "staff")
def reject_loan(loan_id):
    """
    Reject pending loan application

    Request body:
        {
            "rejection_reason": "Credit score too low"
        }

    Returns:
        200: Loan rejected
        400: Not pending
        404: Loan not found
        403: Unauthorized
    """
    try:
        data = request.get_json() or {}
        reason = data.get("rejection_reason", "No reason provided")

        loan = LoanService.reject_loan(loan_id, reason)

        return jsonify({
            "message": "Loan rejected",
            "loan": loan.to_dict(),
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.route("/<loan_id>/disburse", methods=["POST"])
@require_role("admin", "manager", "staff")
def disburse_loan_endpoint(loan_id):
    """
    Disburse approved loan amount to account

    Returns:
        200: Loan disbursed
        400: Not approved
        404: Loan not found
        403: Unauthorized
    """
    try:
        loan = LoanService.disburse_loan(loan_id)

        return jsonify({
            "message": "Loan disbursed successfully",
            "loan": loan.to_dict(),
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== EMI PAYMENTS =====


@loans_bp.route("/<loan_id>/pay-emi", methods=["POST"])
@require_authentication
def pay_emi(loan_id):
    """
    Pay EMI for loan

    Request body:
        {
            "account_id": "str_id",
            "amount": 5000
        }

    Returns:
        200: EMI paid
        400: Validation error
        404: Loan not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        if "account_id" not in data or "amount" not in data:
            return jsonify({"error": "account_id and amount required"}), 400

        result = LoanService.pay_emi(
            loan_id=loan_id,
            account_id=data["account_id"],
            amount=data["amount"],
        )

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.route("/<loan_id>/emi-schedule", methods=["GET"])
@require_authentication
def get_emi_schedule(loan_id):
    """
    Get EMI payment schedule for loan

    Returns:
        200: EMI schedule
        404: Loan not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        loan = LoanService.get_loan(loan_id)

        # Check authorization
        if current_user["role"] not in ["admin", "manager", "staff"] and loan.user_id != current_user["user_id"]:
            return jsonify({"error": "You can only view your own loan schedule"}), 403

        payments = LoanService.get_emi_schedule(loan_id)

        return jsonify({
            "loan_id": loan_id,
            "total_emis": len(payments),
            "schedule": [p.to_dict() for p in payments],
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.route("/<loan_id>/summary", methods=["GET"])
@require_authentication
def get_loan_summary_endpoint(loan_id):
    """
    Get comprehensive loan summary with KPIs

    Returns:
        200: Loan summary
        404: Loan not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        loan = LoanService.get_loan(loan_id)

        # Check authorization
        if current_user["role"] not in ["admin", "manager", "staff"] and loan.user_id != current_user["user_id"]:
            return jsonify({"error": "You can only view your own loan summary"}), 403

        summary = LoanService.get_loan_summary(loan_id)

        return jsonify(summary), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== ADMIN OPERATIONS =====


@loans_bp.route("/pending", methods=["GET"])
@require_role("admin", "manager", "staff")
def get_pending_approvals():
    """
    Get all pending loan applications (admin queue)

    Returns:
        200: Pending loans
        403: Unauthorized
    """
    try:
        loans = LoanService.get_pending_approvals()

        return jsonify({
            "count": len(loans),
            "loans": [l.to_dict() for l in loans],
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.route("/statistics", methods=["GET"])
@require_role("admin", "manager", "staff")
def get_statistics():
    """
    Get loan system statistics

    Returns:
        200: Loan statistics
        403: Unauthorized
    """
    try:
        stats = LoanService.get_loan_statistics()

        return jsonify(stats), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@loans_bp.errorhandler(BankingException)
def handle_banking_exception_loans(error):
    """Handle custom banking exceptions"""
    return jsonify({"error": error.message}), error.status_code
