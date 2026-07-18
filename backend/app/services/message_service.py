"""
Message/Support Ticket service - Business logic for user messages
"""
from app.models.base import Message
from app.models.user import User
from app.utils.exceptions import ResourceNotFoundError, ValidationError
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class MessageService:
    """Handle user messages and support tickets"""

    @staticmethod
    def create_message(
        user_id: str,
        subject: str,
        message: str,
        category: str = 'general'
    ) -> Message:
        """
        Create a new support message/ticket

        Args:
            user_id: User ID
            subject: Message subject
            message: Message content
            category: Message category (general, account, card, loan, etc.)

        Returns:
            Message object

        Raises:
            ResourceNotFoundError: If user not found
            ValidationError: If validation fails
        """
        # Validate user exists
        try:
            user = User.objects(id=user_id).first()
        except Exception:
            user = None

        if not user:
            raise ResourceNotFoundError(f"User with ID {user_id} not found")

        # Validate inputs
        if not subject or not subject.strip():
            raise ValidationError("Subject is required")

        if not message or not message.strip():
            raise ValidationError("Message content is required")

        # Validate category
        valid_categories = ['general', 'account', 'card', 'loan', 'transaction', 'technical', 'other']
        if category not in valid_categories:
            category = 'general'

        # Create message
        new_message = Message(
            user_id=user,
            subject=subject.strip(),
            message=message.strip(),
            category=category,
            status='open',
            priority='normal'
        )

        try:
            new_message.save()
            logger.info(f"✅ Support ticket created: {new_message.id} by user {user_id}")
            return new_message
        except Exception as e:
            logger.error(f"Failed to create message: {str(e)}")
            raise ValidationError(f"Failed to create message: {str(e)}")

    @staticmethod
    def get_user_messages(user_id: str, status: str = None) -> list:
        """
        Get all messages for a user

        Args:
            user_id: User ID
            status: Filter by status (optional)

        Returns:
            List of Message objects
        """
        try:
            query = Message.objects(user_id=user_id)
            
            if status:
                query = query.filter(status=status)
            
            return list(query.order_by("-created_at"))
        except Exception as e:
            logger.error(f"Failed to fetch messages for user {user_id}: {str(e)}")
            return []

    @staticmethod
    def get_message_by_id(message_id: str, user_id: str = None) -> Message:
        """
        Get a specific message by ID

        Args:
            message_id: Message ID
            user_id: User ID (for authorization check)

        Returns:
            Message object

        Raises:
            ResourceNotFoundError: If message not found
        """
        try:
            query = {"id": message_id}
            if user_id:
                query["user_id"] = user_id
            
            message = Message.objects(**query).first()
            
            if not message:
                raise ResourceNotFoundError(f"Message with ID {message_id} not found")
            
            return message
        except ResourceNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch message {message_id}: {str(e)}")
            raise ResourceNotFoundError(f"Message with ID {message_id} not found")

    @staticmethod
    def update_message_status(message_id: str, status: str, admin_reply: str = None) -> Message:
        """
        Update message status (for admin use)

        Args:
            message_id: Message ID
            status: New status
            admin_reply: Optional admin reply

        Returns:
            Updated Message object

        Raises:
            ResourceNotFoundError: If message not found
            ValidationError: If validation fails
        """
        message = MessageService.get_message_by_id(message_id)

        valid_statuses = ['open', 'in_progress', 'resolved', 'closed']
        if status not in valid_statuses:
            raise ValidationError(f"Invalid status. Valid: {', '.join(valid_statuses)}")

        message.status = status
        message.updated_at = datetime.utcnow()

        if admin_reply:
            message.admin_reply = admin_reply

        if status in ['resolved', 'closed']:
            message.resolved_at = datetime.utcnow()

        try:
            message.save()
            logger.info(f"✅ Message {message_id} status updated to {status}")
            return message
        except Exception as e:
            logger.error(f"Failed to update message {message_id}: {str(e)}")
            raise ValidationError(f"Failed to update message: {str(e)}")

    @staticmethod
    def delete_message(message_id: str, user_id: str) -> bool:
        """
        Delete a message (soft delete by closing)

        Args:
            message_id: Message ID
            user_id: User ID (for authorization)

        Returns:
            True if deleted

        Raises:
            ResourceNotFoundError: If message not found
        """
        message = MessageService.get_message_by_id(message_id, user_id)
        
        try:
            # Instead of deleting, we close the ticket
            message.status = 'closed'
            message.updated_at = datetime.utcnow()
            message.save()
            logger.info(f"✅ Message {message_id} closed by user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to close message {message_id}: {str(e)}")
            raise ValidationError(f"Failed to close message: {str(e)}")
