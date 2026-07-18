"""
Bill payment API routes
"""
from flask import Blueprint, request, jsonify
from app.services.bill_service import BillService
from app.utils.exceptions import BankingException
from app.middleware.rbac import require_authentication, get_current_user

# Create blueprint
bills_bp = Blueprint("bills", __name__, url_prefix="/api/bills")


@bills_bp.route("/mobile", methods=["POST"])
@require_authentication
def pay_mobile_bill():
    """
    Pay mobile recharge bill

    Request body:
        {
            "account_id": "str_id",
            "amount": 500.00,
            "phone_number": "03001234567",
            "description": "Optional description"
        }

    Returns:
        200: Payment successful
        400: Validation error
        403: Unauthorized/Insufficient balance
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        if "account_id" not in data:
            return jsonify({"error": "account_id is required"}), 400
        if "amount" not in data:
            return jsonify({"error": "amount is required"}), 400
        if "phone_number" not in data:
            return jsonify({"error": "phone_number is required"}), 400

        account_id = data.get("account_id")
        amount = data.get("amount")
        phone_number = data.get("phone_number")
        description = data.get("description", "")

        # Check authorization - user can only pay from their own accounts
        from app.models.account import Account
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account or str(account.user_id.id) != current_user["user_id"]:
            return jsonify({"error": "Unauthorized - account does not belong to current user"}), 403

        result = BillService.pay_bill(
            account_id=account_id,
            bill_type="mobile_recharge",
            amount=amount,
            recipient_identifier=phone_number,
            recipient_name=f"Mobile - {phone_number}",
            description=description or f"Mobile recharge to {phone_number}"
        )

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bills_bp.route("/electricity", methods=["POST"])
@require_authentication
def pay_electricity_bill():
    """
    Pay electricity bill

    Request body:
        {
            "account_id": "str_id",
            "amount": 2500.00,
            "account_number": "123456789",
            "consumer_name": "Consumer name",
            "description": "Optional description"
        }

    Returns:
        200: Payment successful
        400: Validation error
        403: Unauthorized/Insufficient balance
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        if "account_id" not in data:
            return jsonify({"error": "account_id is required"}), 400
        if "amount" not in data:
            return jsonify({"error": "amount is required"}), 400
        if "account_number" not in data:
            return jsonify({"error": "account_number is required"}), 400

        account_id = data.get("account_id")
        amount = data.get("amount")
        account_number = data.get("account_number")
        consumer_name = data.get("consumer_name", f"Account {account_number}")
        description = data.get("description", "")

        # Check authorization
        from app.models.account import Account
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account or str(account.user_id.id) != current_user["user_id"]:
            return jsonify({"error": "Unauthorized - account does not belong to current user"}), 403

        result = BillService.pay_bill(
            account_id=account_id,
            bill_type="electricity",
            amount=amount,
            recipient_identifier=account_number,
            recipient_name=consumer_name,
            description=description or f"Electricity bill for {account_number}"
        )

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bills_bp.route("/internet", methods=["POST"])
@require_authentication
def pay_internet_bill():
    """
    Pay internet bill

    Request body:
        {
            "account_id": "str_id",
            "amount": 1500.00,
            "account_number": "123456789",
            "isp_name": "Internet Service Provider name",
            "description": "Optional description"
        }

    Returns:
        200: Payment successful
        400: Validation error
        403: Unauthorized/Insufficient balance
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        if "account_id" not in data:
            return jsonify({"error": "account_id is required"}), 400
        if "amount" not in data:
            return jsonify({"error": "amount is required"}), 400
        if "account_number" not in data:
            return jsonify({"error": "account_number is required"}), 400

        account_id = data.get("account_id")
        amount = data.get("amount")
        account_number = data.get("account_number")
        isp_name = data.get("isp_name", f"Account {account_number}")
        description = data.get("description", "")

        # Check authorization
        from app.models.account import Account
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account or str(account.user_id.id) != current_user["user_id"]:
            return jsonify({"error": "Unauthorized - account does not belong to current user"}), 403

        result = BillService.pay_bill(
            account_id=account_id,
            bill_type="internet",
            amount=amount,
            recipient_identifier=account_number,
            recipient_name=isp_name,
            description=description or f"Internet bill for {account_number}"
        )

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bills_bp.route("/history", methods=["GET"])
@require_authentication
def get_bill_history():
    """
    Get bill payment history for current user

    Query parameters:
        account_id: Filter by specific account (optional)
        bill_type: Filter by bill type (mobile_recharge, electricity, internet) (optional)
        page: Page number (default 1)
        per_page: Items per page (default 20)

    Returns:
        200: Bill payment history
        400: Validation error
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account_id = request.args.get("account_id")
        bill_type = request.args.get("bill_type")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        if account_id:
            # Get history for specific account
            from app.models.account import Account
            try:
                account = Account.objects(id=account_id).first()
            except Exception:
                account = None

            if not account or str(account.user_id.id) != current_user["user_id"]:
                return jsonify({"error": "Unauthorized - account does not belong to current user"}), 403

            result = BillService.get_bill_payment_history(
                account_id=account_id,
                bill_type=bill_type,
                page=page,
                per_page=per_page
            )
        else:
            # Get history for all user accounts
            result = BillService.get_user_bill_history(
                user_id=current_user["user_id"],
                bill_type=bill_type,
                page=page,
                per_page=per_page
            )

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bills_bp.route("/statistics", methods=["GET"])
@require_authentication
def get_bill_statistics():
    """
    Get bill payment statistics for account

    Query parameters:
        account_id: Account ID (required)
        bill_type: Filter by bill type (optional)

    Returns:
        200: Bill statistics
        400: Validation error
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        account_id = request.args.get("account_id")

        if not account_id:
            return jsonify({"error": "account_id is required"}), 400

        # Check authorization
        from app.models.account import Account
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account or str(account.user_id.id) != current_user["user_id"]:
            return jsonify({"error": "Unauthorized - account does not belong to current user"}), 403

        bill_type = request.args.get("bill_type")

        result = BillService.get_bill_statistics(
            account_id=account_id,
            bill_type=bill_type
        )

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500
