"""
Tests for beneficiary management system
"""
import pytest
from app import create_app, db
from app.models.user import User, Role
from app.models.account import Account
from app.models.base import Beneficiary
from app.services.account_service import AccountService
from app.services.beneficiary_service import BeneficiaryService
from app.services.auth_service import initialize_roles


@pytest.fixture(scope="function")
def app():
    """Create app for testing"""
    app = create_app("testing")

    with app.app_context():
        db.create_all()
        initialize_roles()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Test client"""
    return app.test_client()


@pytest.fixture
def user1(app):
    """Create first test user"""
    with app.app_context():
        customer_role = Role.query.filter_by(name="customer").first()
        user = User(
            username="user1",
            email="user1@test.com",
            password_hash="hashed",
            first_name="User",
            last_name="One",
            phone_number="+91-1111111111",
            role_id=customer_role.id,
        )
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture
def user2(app):
    """Create second test user"""
    with app.app_context():
        customer_role = Role.query.filter_by(name="customer").first()
        user = User(
            username="user2",
            email="user2@test.com",
            password_hash="hashed",
            first_name="User",
            last_name="Two",
            phone_number="+91-2222222222",
            role_id=customer_role.id,
        )
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture
def account1(app, user1):
    """Create account for user1"""
    with app.app_context():
        return AccountService.create_account(
            user_id=user1, account_type="savings", initial_balance=10000
        ).id


@pytest.fixture
def account2(app, user2):
    """Create account for user2"""
    with app.app_context():
        return AccountService.create_account(
            user_id=user2, account_type="savings", initial_balance=5000
        ).id


class TestBeneficiaryAddition:
    """Test adding beneficiaries"""

    def test_add_beneficiary_success(self, app, account1, account2):
        """Test successfully adding a beneficiary"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            assert beneficiary.account_id == account1
            assert beneficiary.beneficiary_account_number == account2_num
            assert beneficiary.is_approved is False

    def test_add_beneficiary_invalid_account(self, app):
        """Test adding beneficiary to non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                BeneficiaryService.add_beneficiary(999, "123456789", "Test User")

    def test_add_own_account_as_beneficiary(self, app, account1):
        """Test cannot add own account as beneficiary"""
        with app.app_context():
            account_num = AccountService.get_account_by_id(account1).account_number
            with pytest.raises(Exception):
                BeneficiaryService.add_beneficiary(
                    account_id=account1,
                    beneficiary_account_number=account_num,
                    beneficiary_name="Self",
                )

    def test_add_duplicate_beneficiary(self, app, account1, account2):
        """Test cannot add same beneficiary twice"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number

            BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            # Try to add same beneficiary again
            with pytest.raises(Exception):
                BeneficiaryService.add_beneficiary(
                    account_id=account1,
                    beneficiary_account_number=account2_num,
                    beneficiary_name="User Two Again",
                )

    def test_add_beneficiary_invalid_account_number(self, app, account1):
        """Test adding beneficiary with invalid account number format"""
        with app.app_context():
            with pytest.raises(Exception):
                BeneficiaryService.add_beneficiary(
                    account_id=account1,
                    beneficiary_account_number="invalid",
                    beneficiary_name="Test User",
                )

    def test_add_beneficiary_invalid_name(self, app, account1):
        """Test adding beneficiary with invalid name"""
        with app.app_context():
            with pytest.raises(Exception):
                BeneficiaryService.add_beneficiary(
                    account_id=account1,
                    beneficiary_account_number="123456789012345678",
                    beneficiary_name="",  # Empty name
                )


class TestBeneficiaryRetrieval:
    """Test retrieving beneficiaries"""

    def test_get_beneficiary_by_id(self, app, account1, account2):
        """Test getting beneficiary by ID"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            added = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            retrieved = BeneficiaryService.get_beneficiary(added.id)
            assert retrieved.id == added.id
            assert retrieved.beneficiary_account_number == account2_num

    def test_get_beneficiary_not_found(self, app):
        """Test getting non-existent beneficiary"""
        with app.app_context():
            with pytest.raises(Exception):
                BeneficiaryService.get_beneficiary(999)

    def test_list_account_beneficiaries(self, app, account1, account2):
        """Test listing beneficiaries for account"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number

            # Add multiple beneficiaries
            BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )
            BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number="111111111111111111",
                beneficiary_name="User Three",
            )

            beneficiaries = BeneficiaryService.get_account_beneficiaries(account1)
            assert len(beneficiaries) == 2

    def test_list_approved_beneficiaries_only(self, app, account1, account2):
        """Test listing only approved beneficiaries"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number

            ben1 = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )
            ben2 = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number="111111111111111111",
                beneficiary_name="User Three",
            )

            # Approve only one
            BeneficiaryService.approve_beneficiary(ben1.id, approved_by_user_id=1)

            approved = BeneficiaryService.get_account_beneficiaries(
                account1, approved_only=True
            )
            assert len(approved) == 1
            assert approved[0].id == ben1.id

    def test_list_beneficiaries_invalid_account(self, app):
        """Test listing beneficiaries for non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                BeneficiaryService.get_account_beneficiaries(999)


class TestBeneficiaryApproval:
    """Test beneficiary approval workflow"""

    def test_approve_beneficiary(self, app, account1, account2):
        """Test approving a beneficiary"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            approved = BeneficiaryService.approve_beneficiary(beneficiary.id, approved_by_user_id=1)

            assert approved.is_approved is True
            assert approved.approved_by == 1
            assert approved.approved_at is not None

    def test_cannot_approve_twice(self, app, account1, account2):
        """Test cannot approve already approved beneficiary"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            BeneficiaryService.approve_beneficiary(beneficiary.id, approved_by_user_id=1)

            # Try to approve again
            with pytest.raises(Exception):
                BeneficiaryService.approve_beneficiary(beneficiary.id, approved_by_user_id=1)

    def test_is_approved_check(self, app, account1, account2):
        """Test checking if beneficiary is approved"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            # Not approved yet
            assert (
                BeneficiaryService.is_approved(account1, account2_num) is False
            )

            # Approve and check again
            BeneficiaryService.approve_beneficiary(beneficiary.id, approved_by_user_id=1)
            assert BeneficiaryService.is_approved(account1, account2_num) is True

    def test_check_if_approved_raises_error(self, app, account1):
        """Test check_if_approved raises error when not approved"""
        with app.app_context():
            with pytest.raises(Exception):
                BeneficiaryService.check_if_approved(
                    account1, "111111111111111111"
                )


class TestBeneficiaryDeletion:
    """Test deleting beneficiaries"""

    def test_delete_beneficiary(self, app, account1, account2):
        """Test deleting a beneficiary"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            BeneficiaryService.delete_beneficiary(beneficiary.id)

            # Verify deleted
            with pytest.raises(Exception):
                BeneficiaryService.get_beneficiary(beneficiary.id)

    def test_reject_beneficiary(self, app, account1, account2):
        """Test rejecting a pending beneficiary"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            BeneficiaryService.reject_beneficiary(beneficiary.id)

            # Verify deleted
            with pytest.raises(Exception):
                BeneficiaryService.get_beneficiary(beneficiary.id)


class TestBeneficiaryStatistics:
    """Test beneficiary statistics"""

    def test_get_pending_beneficiaries(self, app, account1, account2):
        """Test getting pending beneficiaries"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number

            ben1 = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )
            ben2 = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number="111111111111111111",
                beneficiary_name="User Three",
            )

            # Approve only one
            BeneficiaryService.approve_beneficiary(ben1.id, approved_by_user_id=1)

            pending = BeneficiaryService.get_pending_beneficiaries()
            assert len(pending) == 1
            assert pending[0].id == ben2.id

    def test_get_statistics(self, app, account1, account2):
        """Test getting beneficiary statistics"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number

            ben1 = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )
            ben2 = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number="111111111111111111",
                beneficiary_name="User Three",
            )

            # Approve one
            BeneficiaryService.approve_beneficiary(ben1.id, approved_by_user_id=1)

            stats = BeneficiaryService.get_beneficiary_statistics()

            assert stats["total_beneficiaries"] == 2
            assert stats["approved"] == 1
            assert stats["pending"] == 1
            assert stats["approval_rate"] == 50.0


class TestBeneficiaryIntegration:
    """Integration tests"""

    def test_complete_beneficiary_workflow(self, app, account1, account2):
        """Test complete beneficiary workflow"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number

            # Add beneficiary
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            # Initially not approved
            assert beneficiary.is_approved is False
            assert (
                BeneficiaryService.is_approved(account1, account2_num) is False
            )

            # Approve
            BeneficiaryService.approve_beneficiary(beneficiary.id, approved_by_user_id=1)
            assert BeneficiaryService.is_approved(account1, account2_num) is True

            # Delete
            BeneficiaryService.delete_beneficiary(beneficiary.id)

            # No longer exists
            assert BeneficiaryService.is_approved(account1, account2_num) is False

    def test_to_dict_method(self, app, account1, account2):
        """Test beneficiary to_dict conversion"""
        with app.app_context():
            account2_num = AccountService.get_account_by_id(account2).account_number
            beneficiary = BeneficiaryService.add_beneficiary(
                account_id=account1,
                beneficiary_account_number=account2_num,
                beneficiary_name="User Two",
            )

            data = beneficiary.to_dict()

            assert "id" in data
            assert "account_id" in data
            assert "beneficiary_account_number" in data
            assert "beneficiary_name" in data
            assert "is_approved" in data
            assert "created_at" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
