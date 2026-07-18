"""Notifications routes"""
from flask import Blueprint, request, jsonify
from app.services.notification_service import NotificationService
from app.middleware.rbac import require_role, get_current_user

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

@notifications_bp.route("", methods=["GET"])
@require_role("customer", "staff", "manager", "admin")
def list_notifications():
    """List user's notifications"""
    user = get_current_user()
    unread_only = request.args.get("unread_only", "false").lower() == "true"

    notifs = NotificationService.get_user_notifications(user["user_id"], unread_only)
    return jsonify([{
        "id": str(n.id),
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat()
    } for n in notifs]), 200

@notifications_bp.route("/<notif_id>", methods=["GET"])
@require_role("customer", "staff", "manager", "admin")
def get_notification(notif_id):
    """Get specific notification"""
    try:
        notif = NotificationService.get_notification(notif_id)
        return jsonify({
            "id": str(notif.id),
            "title": notif.title,
            "message": notif.message,
            "is_read": notif.is_read,
            "created_at": notif.created_at.isoformat()
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 404

@notifications_bp.route("/<notif_id>/read", methods=["POST"])
@require_role("customer", "staff", "manager", "admin")
def mark_read(notif_id):
    """Mark notification as read"""
    try:
        NotificationService.mark_as_read(notif_id)
        return jsonify({"message": "Marked as read"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@notifications_bp.route("/mark-all-read", methods=["POST"])
@require_role("customer", "staff", "manager", "admin")
def mark_all_read():
    """Mark all as read"""
    user = get_current_user()
    NotificationService.mark_all_as_read(user["user_id"])
    return jsonify({"message": "All marked as read"}), 200

@notifications_bp.route("/<notif_id>", methods=["DELETE"])
@require_role("customer", "staff", "manager", "admin")
def delete_notification(notif_id):
    """Delete notification"""
    try:
        NotificationService.delete_notification(notif_id)
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@notifications_bp.route("/statistics", methods=["GET"])
@require_role("customer", "staff", "manager", "admin")
def statistics():
    """Get notification stats"""
    user = get_current_user()
    stats = NotificationService.get_statistics(user["user_id"])
    return jsonify(stats), 200
