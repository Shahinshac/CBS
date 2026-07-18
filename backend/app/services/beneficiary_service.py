"""
Beneficiary management service - Business logic for managing transfer beneficiaries
"""
from app.models.base import Beneficiary
from app.models.account import Account
from app.models.user import User
from app.utils.validators import Validators
from app.utils.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    DuplicateResourceError,
)
from datetime import datetime


class BeneficiaryService:
    """Handle beneficiary operations"""

    @staticmethod
    def add_beneficiary(
        account_id: str,
        beneficiary_account_number: str,
        beneficiary_name: str,
    ) -> Beneficiary:
        """
        Add a new beneficiary for an account

        Args:
            account_id: Account ID adding the beneficiary
            beneficiary_account_number: Account number of beneficiary
            beneficiary_name: Name of beneficiary

        Returns:
            Created beneficiary object

        Raises:
            ResourceNotFoundError: If account not found
            ValidationError: If validation fails
            DuplicateResourceError: If beneficiary already exists
        """
        # Validate account exists
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        # Validate inputs
        Validators.validate_account_number(beneficiary_account_number)
        Validators.validate_name(beneficiary_name, "Beneficiary name")

        # Cannot add own account as beneficiary
        if account.account_number == beneficiary_account_number:
            raise ValidationError("Cannot add your own account as a beneficiary")

        # Check if beneficiary already exists
        existing = Beneficiary.objects(
            account_id=account_id,
            beneficiary_account_number=beneficiary_account_number,
        ).first()

        if existing:
            raise DuplicateResourceError(
                f"Beneficiary {beneficiary_account_number} already exists"
            )

        # Try to find beneficiary account (optional - for linking)
        beneficiary_account = Account.objects(
            account_number=beneficiary_account_number
        ).first()

        beneficiary = Beneficiary(
            account_id=account_id,
            beneficiary_account_number=beneficiary_account_number,
            beneficiary_name=beneficiary_name,
            beneficiary_account_id=beneficiary_account.id if beneficiary_account else None,
            is_approved=False,  # Requires approval
        )

        try:
            beneficiary.save()
        except Exception as e:
            raise ValidationError(f"Failed to add beneficiary: {str(e)}")

        return beneficiary

    @staticmethod
    def get_beneficiary(beneficiary_id: str) -> Beneficiary:
        """
        Get beneficiary by ID

        Args:
            beneficiary_id: Beneficiary ID

        Returns:
            Beneficiary object

        Raises:
            ResourceNotFoundError: If not found
        """
        try:
            beneficiary = Beneficiary.objects(id=beneficiary_id).first()
        except Exception:
            beneficiary = None

        if not beneficiary:
            raise ResourceNotFoundError(f"Beneficiary with ID {beneficiary_id} not found")

        return beneficiary

    @staticmethod
    def get_account_beneficiaries(
        account_id: str,
        approved_only: bool = False,
    ) -> list:
        """
        Get all beneficiaries for an account

        Args:
            account_id: Account ID
            approved_only: Return only approved beneficiaries

        Returns:
            List of beneficiaries

        Raises:
            ResourceNotFoundError: If account not found
        """
        # Validate account exists
        try:
            account = Account.objects(id=account_id).first()
        except Exception:
            account = None

        if not account:
            raise ResourceNotFoundError(f"Account with ID {account_id} not found")

        query_dict = {"account_id": account_id}

        if approved_only:
            query_dict["is_approved"] = True

        return list(Beneficiary.objects(**query_dict).order_by("-created_at"))

    @staticmethod
    def approve_beneficiary(beneficiary_id: str, approved_by_user_id: str) -> Beneficiary:
        """
        Approve a beneficiary (admin/staff only)

        Args:
            beneficiary_id: Beneficiary ID
            approved_by_user_id: User ID of approver

        Returns:
            Updated beneficiary

        Raises:
            ResourceNotFoundError: If not found
            ValidationError: If already approved
        """
        beneficiary = BeneficiaryService.get_beneficiary(beneficiary_id)

        if beneficiary.is_approved:
            raise ValidationError("Beneficiary is already approved")

        beneficiary.is_approved = True
        beneficiary.approved_by = approved_by_user_id
        beneficiary.approved_at = datetime.utcnow()
        beneficiary.updated_at = datetime.utcnow()

        beneficiary.save()

        return beneficiary

    @staticmethod
    def reject_beneficiary(beneficiary_id: str) -> Beneficiary:
        """
        Reject/delete a beneficiary

        Args:
            beneficiary_id: Beneficiary ID

        Returns:
            Deleted beneficiary

        Raises:
            ResourceNotFoundError: If not found
        """
        beneficiary = BeneficiaryService.get_beneficiary(beneficiary_id)

        beneficiary.delete()

        return beneficiary

    @staticmethod
    def delete_beneficiary(beneficiary_id: str) -> dict:
        """
        Delete a beneficiary

        Args:
            beneficiary_id: Beneficiary ID

        Returns:
            Confirmation message

        Raises:
            ResourceNotFoundError: If not found
        """
        beneficiary = BeneficiaryService.get_beneficiary(beneficiary_id)

        beneficiary.delete()

        return {
            "message": f"Beneficiary {beneficiary.beneficiary_account_number} deleted"
        }

    @staticmethod
    def is_approved(account_id: str, beneficiary_account_number: str) -> bool:
        """
        Check if a beneficiary is approved

        Args:
            account_id: Account ID
            beneficiary_account_number: Beneficiary account number

        Returns:
            True if approved, False otherwise
        """
        beneficiary = Beneficiary.objects(
            account_id=account_id,
            beneficiary_account_number=beneficiary_account_number,
            is_approved=True,
        ).first()

        return beneficiary is not None

    @staticmethod
    def check_if_approved(account_id: str, beneficiary_account_number: str) -> None:
        """
        Check if beneficiary is approved, raise error if not

        Args:
            account_id: Account ID
            beneficiary_account_number: Beneficiary account number

        Raises:
            ValidationError: If not approved or doesn't exist
        """
        beneficiary = Beneficiary.objects(
            account_id=account_id,
            beneficiary_account_number=beneficiary_account_number,
        ).first()

        if not beneficiary:
            raise ValidationError(
                f"Beneficiary {beneficiary_account_number} not found in your list"
            )

        if not beneficiary.is_approved:
            raise ValidationError(
                f"Beneficiary {beneficiary_account_number} is not approved yet"
            )

    @staticmethod
    def get_pending_beneficiaries() -> list:
        """
        Get all pending beneficiaries (admin/staff only)

        Returns:
            List of unapproved beneficiaries
        """
        return list(Beneficiary.objects(is_approved=False).order_by("created_at"))

    @staticmethod
    def get_beneficiary_statistics() -> dict:
        """
        Get beneficiary statistics (admin/staff only)

        Returns:
            Dictionary with stats
        """
        total = Beneficiary.objects.count()
        approved = Beneficiary.objects(is_approved=True).count()
        pending = total - approved

        return {
            "total_beneficiaries": total,
            "approved": approved,
            "pending": pending,
            "approval_rate": round(approved / total * 100, 2) if total > 0 else 0,
        }
