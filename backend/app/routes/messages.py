"""
Message/Support Ticket routes
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.message_service import MessageService
from app.utils.exceptions import ResourceNotFoundError, ValidationError
import logging

logger = logging.getLogger(__name__)

messages_bp = Blueprint("messages", __name__, url_prefix="/api/messages")


@messages_bp.route("", methods=["POST"])
@jwt_required()
def create_message():
    """
    Create a new support message/ticket
    
    Body:
        subject: str (required) - Message subject
        message: str (required) - Message content
        category: str (optional) - Message category (general, account, card, loan, etc.)
    
    Returns:
        201: Message created successfully
        400: Validation error
        404: User not found
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        subject = data.get("subject")
        message = data.get("message")
        category = data.get("category", "general")

        # Create message
        new_message = MessageService.create_message(
            user_id=user_id,
            subject=subject,
            message=message,
            category=category
        )

        logger.info(f"✅ Support ticket created by user {user_id}: {new_message.id}")

        return jsonify({
            "message": "Support ticket created successfully",
            "ticket": new_message.to_dict()
        }), 201

    except ValidationError as e:
        logger.warning(f"Validation error creating message: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except ResourceNotFoundError as e:
        logger.warning(f"Resource not found: {str(e)}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error creating message: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@messages_bp.route("", methods=["GET"])
@jwt_required()
def get_messages():
    """
    Get all messages for the current user
    
    Query params:
        status: str (optional) - Filter by status (open, in_progress, resolved, closed)
    
    Returns:
        200: List of messages
    """
    try:
        user_id = get_jwt_identity()
        status = request.args.get("status")

        messages = MessageService.get_user_messages(user_id=user_id, status=status)

        return jsonify({
            "user_id": user_id,
            "count": len(messages),
            "messages": [msg.to_dict() for msg in messages]
        }), 200

    except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@messages_bp.route("/<message_id>", methods=["GET"])
@jwt_required()
def get_message(message_id):
    """
    Get a specific message by ID
    
    Returns:
        200: Message details
        404: Message not found
    """
    try:
        user_id = get_jwt_identity()
        message = MessageService.get_message_by_id(message_id=message_id, user_id=user_id)

        return jsonify({
            "message": message.to_dict()
        }), 200

    except ResourceNotFoundError as e:
        logger.warning(f"Message not found: {str(e)}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error fetching message: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@messages_bp.route("/<message_id>", methods=["DELETE"])
@jwt_required()
def delete_message(message_id):
    """
    Delete (close) a message
    
    Returns:
        200: Message deleted successfully
        404: Message not found
    """
    try:
        user_id = get_jwt_identity()
        MessageService.delete_message(message_id=message_id, user_id=user_id)

        return jsonify({
            "message": "Support ticket closed successfully"
        }), 200

    except ResourceNotFoundError as e:
        logger.warning(f"Message not found: {str(e)}")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Error deleting message: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
