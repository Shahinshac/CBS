"""
Card and ATM API routes
"""
from flask import Blueprint, request, jsonify
from app.services.card_service import CardService, ATMService
from app.utils.exceptions import BankingException
from app.middleware.rbac import require_authentication, get_current_user, require_role

# Create blueprints
cards_bp = Blueprint("cards", __name__, url_prefix="/api/cards")
atm_bp = Blueprint("atm", __name__, url_prefix="/api/atm")


# ===== CARDS ROUTES =====

@cards_bp.route("", methods=["POST"])
@require_role("admin", "staff")
def generate_card():
    """
    Generate a new debit card (Admin/Staff only)

    Request body:
        {
            "account_id": "str_id"
        }

    Returns:
        201: Card generated (user must set PIN)
        400: Validation error
        404: Account not found
        403: Unauthorized
    """
    try:
        data = request.get_json()

        if "account_id" not in data:
            return jsonify({"error": "account_id is required"}), 400

        account_id = data.get("account_id")

        card = CardService.generate_card(account_id)

        return jsonify({
            "message": "Card generated successfully. Please set your PIN.",
            "card": card.to_dict(),
            "note": "Default PIN is 0000. Please change it immediately.",
        }), 201

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@cards_bp.route("", methods=["GET"])
@require_authentication
def list_cards():
    """
    List debit cards for account

    Query parameters:
        account_id: Account ID (required)

    Returns:
        200: List of cards
        400: Missing account_id
        403: Unauthorized
        404: Account not found
    """
    try:
        current_user = get_current_user()

        account_id = request.args.get("account_id")
        if not account_id:
            return jsonify({"error": "account_id is required"}), 400

        # Check authorization
        from app.services.account_service import AccountService

        account = AccountService.get_account_by_id(account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only view your own cards"}), 403

        cards = CardService.get_account_cards(account_id)

        return jsonify({
            "account_id": account_id,
            "count": len(cards),
            "cards": [c.to_dict() for c in cards],
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@cards_bp.route("/<card_id>", methods=["GET"])
@require_authentication
def get_card_details(card_id):
    """
    Get card details

    Returns:
        200: Card details (masked card number)
        404: Card not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        card = CardService.get_card(card_id)

        # Check authorization
        from app.services.account_service import AccountService

        account = AccountService.get_account_by_id(card.account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only view your own cards"}), 403

        return jsonify(card.to_dict()), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@cards_bp.route("/<card_id>/set-pin", methods=["POST"])
@require_authentication
def set_pin(card_id):
    """
    Set or change card PIN

    Request body:
        {
            "pin": "1234"
        }

    Returns:
        200: PIN set successfully
        400: Invalid PIN format
        404: Card not found
        403: Unauthorized
    """
    try:
        current_user = get_current_user()
        data = request.get_json()

        if "pin" not in data:
            return jsonify({"error": "pin is required"}), 400

        pin = data.get("pin")

        card = CardService.get_card(card_id)

        # Check authorization
        from app.services.account_service import AccountService

        account = AccountService.get_account_by_id(card.account_id)
        if (
            current_user["role"] not in ["admin", "manager", "staff"]
            and account.user_id != current_user["user_id"]
        ):
            return jsonify({"error": "You can only modify your own cards"}), 403

        updated_card = CardService.set_pin(card_id, pin)

        return jsonify({
            "message": "PIN set successfully",
            "card": updated_card.to_dict(),
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@cards_bp.route("/<card_id>/block", methods=["POST"])
@require_role("admin", "manager", "staff")
def block_card(card_id):
    """
    Block card (disable transactions)

    Returns:
        200: Card blocked
        400: Already blocked
        404: Card not found
        403: Unauthorized
    """
    try:
        updated_card = CardService.block_card(card_id)

        return jsonify({
            "message": "Card blocked successfully",
            "card": updated_card.to_dict(),
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@cards_bp.route("/<card_id>/unblock", methods=["POST"])
@require_role("admin", "manager", "staff")
def unblock_card(card_id):
    """
    Unblock card (enable transactions)

    Returns:
        200: Card unblocked
        400: Not blocked
        404: Card not found
        403: Unauthorized
    """
    try:
        updated_card = CardService.unblock_card(card_id)

        return jsonify({
            "message": "Card unblocked successfully",
            "card": updated_card.to_dict(),
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== ATM ROUTES =====

@atm_bp.route("/login", methods=["POST"])
def atm_login():
    """
    ATM login with card and PIN

    Request body:
        {
            "card_number": "4532825795063790",
            "pin": "1234"
        }

    Returns:
        200: Login successful with account info
        400: Validation error
        401: Invalid credentials
    """
    try:
        data = request.get_json()

        if not data.get("card_number") or not data.get("pin"):
            return jsonify({"error": "card_number and pin are required"}), 400

        card_number = data.get("card_number")
        pin = data.get("pin")

        result = ATMService.atm_login(card_number, pin)

        return jsonify({
            "message": "ATM login successful",
            "session": result,
        }), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@atm_bp.route("/balance/<card_id>", methods=["GET"])
def check_balance(card_id):
    """
    Check account balance via ATM

    Note: In real ATM, user would be authenticated via PIN first

    Returns:
        200: Balance information
        404: Card not found
    """
    try:
        balance_info = ATMService.atm_check_balance(card_id)
        return jsonify(balance_info), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@atm_bp.route("/withdraw/<card_id>", methods=["POST"])
def atm_withdraw(card_id):
    """
    Withdraw money via ATM

    Request body:
        {
            "amount": 5000
        }

    Returns:
        200: Withdrawal successful
        400: Validation error or insufficient balance
        404: Card not found
    """
    try:
        data = request.get_json()

        if "amount" not in data:
            return jsonify({"error": "amount is required"}), 400

        amount = data.get("amount")

        result = ATMService.atm_withdraw(card_id, amount)

        return jsonify(result), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@atm_bp.route("/mini-statement/<card_id>", methods=["GET"])
def mini_statement(card_id):
    """
    Get mini statement (last transactions) via ATM

    Query parameters:
        num_transactions: Number of transactions to show (default: 5)

    Returns:
        200: Mini statement
        404: Card not found
    """
    try:
        num_transactions = request.args.get("num_transactions", 5, type=int)

        statement = ATMService.atm_mini_statement(card_id, num_transactions)

        return jsonify(statement), 200

    except BankingException as e:
        return jsonify({"error": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@cards_bp.errorhandler(BankingException)
def handle_banking_exception_cards(error):
    """Handle custom banking exceptions"""
    return jsonify({"error": error.message}), error.status_code


@atm_bp.errorhandler(BankingException)
def handle_banking_exception_atm(error):
    """Handle custom banking exceptions"""
    return jsonify({"error": error.message}), error.status_code
