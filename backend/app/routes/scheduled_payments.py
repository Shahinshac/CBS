"""Scheduled Payments routes"""
from flask import Blueprint, request, jsonify
from app.services.scheduled_payment_service import ScheduledPaymentService
from app.middleware.rbac import require_role, get_current_user
from app.utils.exceptions import ValidationError
from datetime import datetime

scheduled_payments_bp = Blueprint("scheduled_payments", __name__, url_prefix="/api/scheduled-payments")

@scheduled_payments_bp.route("", methods=["POST"])
@require_role("customer", "staff", "manager", "admin")
def schedule_payment():
    """Schedule a payment"""
    user = get_current_user()
    data = request.get_json()

    try:
        scheduled_date = datetime.fromisoformat(data.get("scheduled_date"))
        payment = ScheduledPaymentService.schedule_payment(
            account_id=data.get("account_id"),
            recipient_account_number=data.get("recipient_account_number"),
            amount=data.get("amount"),
            scheduled_date=scheduled_date,
            frequency=data.get("frequency", "once"),
            max_executions=data.get("max_executions"),
            description=data.get("description"),
        )
        return jsonify(payment.to_dict()), 201
    except ValidationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@scheduled_payments_bp.route("", methods=["GET"])
@require_role("customer", "staff", "manager", "admin")
def list_payments():
    """List scheduled payments"""
    account_id = request.args.get("account_id")
    status = request.args.get("status")

    if not account_id:
        return jsonify({"error": "account_id required"}), 400

    payments = ScheduledPaymentService.get_account_scheduled_payments(account_id, status)
    return jsonify([p.to_dict() for p in payments]), 200

@scheduled_payments_bp.route("/<payment_id>", methods=["GET"])
@require_role("customer", "staff", "manager", "admin")
def get_payment(payment_id):
    """Get payment details"""
    try:
        payment = ScheduledPaymentService.get_scheduled_payment(payment_id)
        return jsonify(payment.to_dict()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 404

@scheduled_payments_bp.route("/<payment_id>/execute", methods=["POST"])
@require_role("customer", "staff", "manager", "admin")
def execute_payment(payment_id):
    """Execute payment manually"""
    try:
        payment = ScheduledPaymentService.execute_payment(payment_id)
        return jsonify({"message": "Payment executed", "payment": payment.to_dict()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@scheduled_payments_bp.route("/<payment_id>/cancel", methods=["POST"])
@require_role("customer", "staff", "manager", "admin")
def cancel_payment(payment_id):
    """Cancel scheduled payment"""
    try:
        reason = request.get_json().get("reason") if request.is_json else None
        payment = ScheduledPaymentService.cancel_payment(payment_id, reason)
        return jsonify(payment.to_dict()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@scheduled_payments_bp.route("/statistics", methods=["GET"])
@require_role("staff", "manager", "admin")
def statistics():
    """Get statistics"""
    stats = ScheduledPaymentService.get_statistics()
    return jsonify(stats), 200
