"""
Transaction API routes
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from app.services.transaction_service import TransactionService
from app.utils.exceptions import BankingException
from app.middleware.rbac import require_authentication, get_current_user

# Create blueprint
transactions_bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")


@transactions_bp.route("/deposit", methods=["POST"])
@require_authentication
def deposit():
    """
    Deposit money into account

    Request body:
        {
            "account_id": "str_id",
            "amount": 5000.00,
            "description": "Monthly salary"  # Optional
        }

    Returns:
        201: Transaction completed
        400: Validation error
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        if "account_id" not in data or "amount" not in data:
            return jsonify({"error": "account_id and amount are required"}), 400

        account_id = data.get("account_id")
        amount = data.get("amount")
        description = data.get("description", "")

        # Check authorization (own account or staff/admin)
        from app.services.account_service import AccountService

        account = AccountService.get_account_by_id(account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only deposit to your own accounts"}), 403

        # Process deposit
        transaction = TransactionService.deposit(account_id, amount, description)

        return (
            jsonify({
                "message": "Deposit successful",
                "transaction": transaction.to_dict(),
                "new_balance": float(account.balance),
            }),
            201,
        )

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@transactions_bp.route("/withdraw", methods=["POST"])
@require_authentication
def withdraw():
    """
    Withdraw money from account

    Request body:
        {
            "account_id": "str_id",
            "amount": 1000.00,
            "description": "ATM withdrawal"  # Optional
        }

    Returns:
        201: Transaction completed
        400: Validation error or insufficient balance
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        if "account_id" not in data or "amount" not in data:
            return jsonify({"error": "account_id and amount are required"}), 400

        account_id = data.get("account_id")
        amount = data.get("amount")
        description = data.get("description", "")

        # Check authorization
        from app.services.account_service import AccountService

        account = AccountService.get_account_by_id(account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only withdraw from your own accounts"}), 403

        # Process withdrawal
        transaction = TransactionService.withdraw(account_id, amount, description)

        return (
            jsonify({
                "message": "Withdrawal successful",
                "transaction": transaction.to_dict(),
                "new_balance": float(account.balance),
            }),
            201,
        )

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@transactions_bp.route("/transfer", methods=["POST"])
@require_authentication
def transfer():
    """
    Transfer money between accounts

    Request body:
        {
            "from_account_id": "str_id",
            "to_account_id": "str_id",
            "amount": 5000.00,
            "description": "Payment to John"  # Optional
        }

    Returns:
        201: Transfer completed
        400: Validation error or insufficient balance
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        # Validate required fields
        required = ["from_account_id", "to_account_id", "amount"]
        if not all(field in data for field in required):
            return (
                jsonify({
                    "error": "from_account_id, to_account_id, and amount are required"
                }),
                400,
            )

        from_account_id = data.get("from_account_id")
        to_account_id = data.get("to_account_id")
        amount = data.get("amount")
        description = data.get("description", "")

        # Check authorization (can only transfer from own account)
        from app.services.account_service import AccountService

        from_account = AccountService.get_account_by_id(from_account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and from_account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only transfer from your own accounts"}), 403

        # Process transfer
        result = TransactionService.transfer(from_account_id, to_account_id, amount, description)

        return (
            jsonify({
                "message": "Transfer successful",
                "reference_id": result["reference_id"],
                "from_transaction": result["from_transaction"],
                "to_transaction": result["to_transaction"],
                "status": result["status"],
            }),
            201,
        )

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@transactions_bp.route("", methods=["GET"])
@require_authentication
def get_transactions():
    """
    Get transaction history for current user (all accounts)

    Query parameters:
        type: Filter by transaction type (deposit, withdrawal, transfer)
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        account_id: Filter by specific account (optional)
        page: Page number (default: 1)
        per_page: Items per page (default: 20)

    Returns:
        200: List of transactions
        400: Invalid parameters
        403: Unauthorized
    """
    try:
        current_user = get_current_user()

        # Get parameters
        account_id = request.args.get("account_id")
        transaction_type = request.args.get("type")
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        # Parse dates
        start_date = None
        end_date = None
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Invalid start_date format. Use YYYY-MM-DD"}), 400

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
            except ValueError:
                return jsonify({"error": "Invalid end_date format. Use YYYY-MM-DD"}), 400

        # If filtering by account, check authorization
        if account_id:
            from app.services.account_service import AccountService

            account = AccountService.get_account_by_id(account_id)
            if (
                current_user["role"] not in ["admin", "manager", "staff"]
                and account.user_id != current_user["user_id"]
            ):
                return jsonify({"error": "You can only view your own transactions"}), 403

            # Get account transactions
            result = TransactionService.get_account_transactions(
                account_id=account_id,
                transaction_type=transaction_type,
                start_date=start_date,
                end_date=end_date,
                page=page,
                per_page=per_page,
            )
        else:
            # Get all user transactions
            result = TransactionService.get_user_transactions(
                user_id=current_user["user_id"],
                transaction_type=transaction_type,
                start_date=start_date,
                end_date=end_date,
                page=page,
                per_page=per_page,
            )

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@transactions_bp.route("/<transaction_id>", methods=["GET"])
@require_authentication
def get_transaction(transaction_id):
    """
    Get specific transaction details

    Returns:
        200: Transaction details
        404: Transaction not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        transaction = TransactionService.get_transaction(transaction_id)

        # Check authorization
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and transaction.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only view your own transactions"}), 403

        return jsonify(transaction.to_dict()), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@transactions_bp.route("/summary/<account_id>", methods=["GET"])
@require_authentication
def get_transaction_summary(account_id):
    """
    Get transaction summary for account

    Query parameters:
        days: Number of days to include (default: 30)

    Returns:
        200: Summary statistics
        404: Account not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        days = request.args.get("days", 30, type=int)

        # Check authorization
        from app.services.account_service import AccountService

        account = AccountService.get_account_by_id(account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only view your own account summary"}), 403

        # Get summary
        summary = TransactionService.get_transaction_summary(account_id, days)

        return jsonify(summary), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@transactions_bp.errorhandler(BankingException)
def handle_banking_exception(error):
    """Handle custom banking exceptions"""
    return jsonify({"error": error.message}), error.status_code
