"""
SMS notification service - Send SMS alerts via AWS SNS
"""
import boto3
import re
import os
import logging
from app.utils.exceptions import ValidationError

logger = logging.getLogger(__name__)


class SMSService:
    """Handle SMS notifications using AWS SNS (Simple Notification Service)"""

    # AWS SNS client (initialized on first use)
    _sns_client = None

    @classmethod
    def _get_sns_client(cls):
        """Get or initialize SNS client (lazy initialization)"""
        if cls._sns_client is None:
            try:
                aws_key = os.getenv("AWS_ACCESS_KEY_ID", "")
                aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY", "")
                aws_region = os.getenv("AWS_SNS_REGION", "us-east-1")

                if not aws_key or not aws_secret:
                    logger.warning("⚠️ AWS credentials not configured, SMS disabled")
                    return None

                cls._sns_client = boto3.client(
                    "sns",
                    region_name=aws_region,
                    aws_access_key_id=aws_key,
                    aws_secret_access_key=aws_secret,
                )
                logger.info(f"✅ SNS client initialized (region: {aws_region})")
            except Exception as e:
                logger.error(f"❌ Failed to initialize SNS client: {str(e)}")
                return None

        return cls._sns_client

    @staticmethod
    def _validate_phone(phone_number: str) -> bool:
        """
        Validate phone number format

        Accepts formats like:
        - +919876543210 (with country code)
        - 919876543210 (without +)
        - 9876543210 (10 digits)
        """
        if not phone_number:
            return False

        # Remove all non-digit characters except leading +
        cleaned = re.sub(r"[^\d+]", "", str(phone_number))

        # Must have country code or at least 10 digits
        if cleaned.startswith("+"):
            return len(cleaned) >= 11  # +CC + 10 digits minimum
        else:
            return len(cleaned) >= 10  # At least 10 digits

    @staticmethod
    def _format_phone(phone_number: str) -> str:
        """
        Format phone number for AWS SNS

        Returns phone with country code in format: +[CC][NUMBER]
        """
        phone_region = os.getenv("AWS_SNS_PHONE_REGION", "+91")  # Default: India

        # Remove all non-digit characters
        cleaned = re.sub(r"\D", "", str(phone_number))

        # Already has country code (11+ digits for international)
        if len(cleaned) >= 11:
            return f"+{cleaned}"

        # Add country code (assuming default region)
        country_code = phone_region.lstrip("+")
        return f"+{country_code}{cleaned}"

    @staticmethod
    def send_card_alert(
        phone_number: str, customer_name: str, account_number: str, card_last_4: str
    ) -> bool:
        """
        Send SMS alert when card is generated

        Args:
            phone_number: Customer phone number
            customer_name: Full name of customer
            account_number: Bank account number
            card_last_4: Last 4 digits of card

        Returns:
            True if SMS sent successfully, False if skipped/failed gracefully

        Raises:
            ValidationError: Only if phone format is completely invalid
        """
        try:
            # Check if SMS is enabled
            if not os.getenv("ENABLE_SMS_NOTIFICATIONS", "true").lower() == "true":
                logger.info("ℹ️ SMS notifications disabled")
                return False

            # Validate phone number
            if not SMSService._validate_phone(phone_number):
                logger.warning(f"⚠️ SMS skipped: Invalid phone number format ({phone_number})")
                return False

            # Get SNS client
            sns_client = SMSService._get_sns_client()
            if not sns_client:
                logger.warning("⚠️ SMS skipped: AWS credentials not configured")
                return False

            # Format phone for SNS
            formatted_phone = SMSService._format_phone(phone_number)

            # Build SMS message (keep under 160 chars for single SMS)
            message = (
                f"Hi {customer_name[:10]}, Your ATM Card generated!\n"
                f"A/c: {account_number[-6:]}, Card: ****{card_last_4}\n"
                f"Set PIN at app. -26-07 Bank"
            )

            # Ensure message is not too long
            if len(message) > 160:
                message = (
                    f"Hi {customer_name[:5]}, Card ****{card_last_4} generated.\n"
                    f"Set PIN at app. -26-07 Bank"
                )

            # Send SMS via SNS
            response = sns_client.publish(
                PhoneNumber=formatted_phone,
                Message=message,
                MessageAttributes={
                    "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "BANK26"},
                    "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
                },
            )

            # Log success
            message_id = response.get("MessageId", "unknown")
            logger.info(f"✅ SMS sent to {formatted_phone} (MessageID: {message_id})")
            return True

        except Exception as e:
            # Log error but don't raise (graceful failure)
            logger.warning(f"⚠️ SMS sending failed: {str(e)}")
            return False

    @staticmethod
    def send_mpin_alert(phone_number: str, customer_name: str, status: str = "set") -> bool:
        """
        Send SMS alert for MPIN setup/changes (optional)

        Args:
            phone_number: Customer phone number
            customer_name: Customer name
            status: "set" or "changed"

        Returns:
            True if sent successfully
        """
        try:
            if not SMSService._validate_phone(phone_number):
                logger.warning(f"⚠️ MPIN SMS skipped: Invalid phone ({phone_number})")
                return False

            sns_client = SMSService._get_sns_client()
            if not sns_client:
                return False

            formatted_phone = SMSService._format_phone(phone_number)

            status_text = "setup" if status == "set" else "changed"
            message = f"Hi {customer_name[:10]}, MPIN {status_text} successfully. -26-07 Bank"

            response = sns_client.publish(
                PhoneNumber=formatted_phone,
                Message=message,
                MessageAttributes={
                    "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "BANK26"},
                    "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
                },
            )

            logger.info(f"✅ MPIN SMS sent to {formatted_phone}")
            return True

        except Exception as e:
            logger.warning(f"⚠️ MPIN SMS failed: {str(e)}")
            return False

    @staticmethod
    def send_transaction_alert(
        phone_number: str, customer_name: str, transaction_type: str, amount: float, balance: float
    ) -> bool:
        """
        Send SMS alert for transactions (optional future feature)

        Args:
            phone_number: Customer phone number
            customer_name: Customer name
            transaction_type: "withdrawal", "transfer", "deposit"
            amount: Transaction amount
            balance: New account balance

        Returns:
            True if sent successfully
        """
        try:
            if not SMSService._validate_phone(phone_number):
                return False

            sns_client = SMSService._get_sns_client()
            if not sns_client:
                return False

            formatted_phone = SMSService._format_phone(phone_number)
            message = (
                f"{customer_name[:10]}, {transaction_type} of ₹{amount:.0f} done.\n"
                f"Balance: ₹{balance:.0f} -26-07 Bank"
            )

            response = sns_client.publish(
                PhoneNumber=formatted_phone,
                Message=message,
                MessageAttributes={
                    "AWS.SNS.SMS.SenderID": {"DataType": "String", "StringValue": "BANK26"},
                    "AWS.SNS.SMS.SMSType": {"DataType": "String", "StringValue": "Transactional"},
                },
            )

            logger.info(f"✅ Transaction SMS sent to {formatted_phone}")
            return True

        except Exception as e:
            logger.warning(f"⚠️ Transaction SMS failed: {str(e)}")
            return False
