"""Analytics and Reporting routes - Admin dashboard"""
from flask import Blueprint, request, jsonify
from app.middleware.rbac import require_role, get_current_user
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.base import Card, Loan, ScheduledPayment, Notification
from datetime import datetime, timedelta

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")

@analytics_bp.route("/dashboard", methods=["GET"])
@require_role("manager", "admin")
def dashboard():
    """Get admin dashboard"""
    try:
        total_users = User.objects().count()
        total_accounts = Account.objects().count()
        total_transactions = Transaction.objects().count()
        total_loans = Loan.objects().count()

        active_accounts = Account.objects(status="active").count()
        frozen_accounts = Account.objects(status="frozen").count()

        return jsonify({
            "users": total_users,
            "accounts": total_accounts,
            "active_accounts": active_accounts,
            "frozen_accounts": frozen_accounts,
            "transactions": total_transactions,
            "loans": total_loans,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/users", methods=["GET"])
@require_role("manager", "admin")
def user_analytics():
    """User statistics"""
    try:
        total = User.objects().count()
        active = User.objects(is_active=True).count()
        verified = User.objects(is_verified=True).count()

        return jsonify({
            "total_users": total,
            "active_users": active,
            "verified_users": verified,
            "inactive_users": total - active,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/accounts", methods=["GET"])
@require_role("manager", "admin")
def account_analytics():
    """Account statistics"""
    try:
        total = Account.objects().count()
        savings = Account.objects(account_type="savings").count()
        current = Account.objects(account_type="current").count()
        salary = Account.objects(account_type="salary").count()

        # Calculate total balance
        all_accounts = list(Account.objects())
        total_balance = sum(float(acc.balance) for acc in all_accounts if acc.balance)

        return jsonify({
            "total_accounts": total,
            "savings_accounts": savings,
            "current_accounts": current,
            "salary_accounts": salary,
            "total_balance": total_balance,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/transactions", methods=["GET"])
@require_role("manager", "admin")
def transaction_analytics():
    """Transaction statistics"""
    try:
        days = request.args.get("days", 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)

        total = Transaction.objects(created_at__gte=start_date).count()
        deposits = Transaction.objects(
            created_at__gte=start_date,
            transaction_type="deposit"
        ).count()
        withdrawals = Transaction.objects(
            created_at__gte=start_date,
            transaction_type="withdrawal"
        ).count()
        transfers = Transaction.objects(
            created_at__gte=start_date,
            transaction_type="transfer"
        ).count()

        # Calculate total amount
        all_txns = list(Transaction.objects(created_at__gte=start_date))
        total_amount = sum(float(txn.amount) for txn in all_txns if txn.amount)

        return jsonify({
            "period_days": days,
            "total_transactions": total,
            "deposits": deposits,
            "withdrawals": withdrawals,
            "transfers": transfers,
            "total_amount": total_amount,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/loans", methods=["GET"])
@require_role("manager", "admin")
def loan_analytics():
    """Loan statistics"""
    try:
        total = Loan.objects().count()
        pending = Loan.objects(status="pending").count()
        approved = Loan.objects(status="approved").count()
        active = Loan.objects(status="active").count()
        closed = Loan.objects(status="closed").count()

        # Calculate total disbursed
        all_loans = list(Loan.objects())
        total_disbursed = sum(float(loan.disbursed_amount) for loan in all_loans if loan.disbursed_amount)

        return jsonify({
            "total_loans": total,
            "pending": pending,
            "approved": approved,
            "active": active,
            "closed": closed,
            "total_disbursed": total_disbursed,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/cards", methods=["GET"])
@require_role("manager", "admin")
def card_analytics():
    """Card statistics"""
    try:
        total = Card.objects().count()
        active = Card.objects(is_active=True, is_blocked=False).count()
        blocked = Card.objects(is_blocked=True).count()

        return jsonify({
            "total_cards": total,
            "active_cards": active,
            "blocked_cards": blocked,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/payments", methods=["GET"])
@require_role("manager", "admin")
def scheduled_payments_analytics():
    """Scheduled payments statistics"""
    try:
        total = ScheduledPayment.objects().count()
        active = ScheduledPayment.objects(status="active").count()
        completed = ScheduledPayment.objects(status="completed").count()
        cancelled = ScheduledPayment.objects(status="cancelled").count()

        return jsonify({
            "total_scheduled": total,
            "active": active,
            "completed": completed,
            "cancelled": cancelled,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/daily-report", methods=["GET"])
@require_role("manager", "admin")
def daily_report():
    """Daily transaction report"""
    try:
        today = datetime.utcnow().date()
        tomorrow = today + timedelta(days=1)

        txns = list(Transaction.objects(
            created_at__gte=datetime.combine(today, datetime.min.time()),
            created_at__lt=datetime.combine(tomorrow, datetime.min.time())
        ))

        return jsonify({
            "date": str(today),
            "total_transactions": len(txns),
            "total_volume": sum(float(t.amount) for t in txns if t.amount),
            "by_type": {
                "deposits": len([t for t in txns if t.transaction_type == "deposit"]),
                "withdrawals": len([t for t in txns if t.transaction_type == "withdrawal"]),
                "transfers": len([t for t in txns if t.transaction_type == "transfer"]),
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
