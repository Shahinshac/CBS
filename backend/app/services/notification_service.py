"""Notification Service - Handle in-app notifications"""
from app.models.base import Notification
from app.models.user import User
from app.utils.exceptions import ResourceNotFoundError
from datetime import datetime

class NotificationService:
    @staticmethod
    def create_notification(user_id: str, title: str, message: str):
        """Create a notification"""
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            is_read=False,
        )
        notif.save()
        return notif

    @staticmethod
    def get_notification(notif_id: str):
        """Get notification by ID"""
        try:
            notif = Notification.objects(id=notif_id).first()
        except Exception:
            notif = None

        if not notif:
            raise ResourceNotFoundError(f"Notification {notif_id} not found")
        return notif

    @staticmethod
    def get_user_notifications(user_id: str, unread_only: bool = False):
        """Get user's notifications"""
        query_dict = {"user_id": user_id}
        if unread_only:
            query_dict["is_read"] = False
        return list(Notification.objects(**query_dict).order_by("-created_at"))

    @staticmethod
    def mark_as_read(notif_id: str):
        """Mark notification as read"""
        notif = NotificationService.get_notification(notif_id)
        notif.is_read = True
        notif.save()
        return notif

    @staticmethod
    def mark_all_as_read(user_id: str):
        """Mark all notifications as read"""
        notifications = Notification.objects(user_id=user_id, is_read=False)
        for notif in notifications:
            notif.is_read = True
            notif.save()
        return {"message": "All marked as read"}

    @staticmethod
    def delete_notification(notif_id: str):
        """Delete a notification"""
        notif = NotificationService.get_notification(notif_id)
        notif.delete()
        return {"message": "Deleted"}

    @staticmethod
    def get_statistics(user_id: str):
        """Get notification stats"""
        total = Notification.objects(user_id=user_id).count()
        unread = Notification.objects(user_id=user_id, is_read=False).count()
        return {
            "total": total,
            "unread": unread,
            "read": total - unread
        }

    @staticmethod
    def send_transaction_notification(user_id: str, transaction_type: str, amount: float, account_number: str = None):
        """Send transaction notification"""
        title = f"{transaction_type.title()} Alert"
        message = f"Transaction of {amount} completed"
        if account_number:
            message += f" on account {account_number[-4:]}"
        return NotificationService.create_notification(user_id, title, message)

    @staticmethod
    def send_approval_notification(user_id: str, item_type: str, status: str):
        """Send approval notification"""
        title = f"{item_type.title()} {status.title()}"
        message = f"Your {item_type} has been {status}"
        return NotificationService.create_notification(user_id, title, message)
