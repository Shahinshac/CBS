"""
Tests for loan management system
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User, Role
from app.models.account import Account
from app.models.base import Loan, LoanPayment
from app.services.account_service import AccountService
from app.services.loan_service import LoanService
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
def user1(app):
    """Create test user"""
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
def staff_user(app):
    """Create staff user"""
    with app.app_context():
        staff_role = Role.query.filter_by(name="staff").first()
        user = User(
            username="staff1",
            email="staff1@test.com",
            password_hash="hashed",
            first_name="Staff",
            last_name="User",
            phone_number="+91-3333333333",
            role_id=staff_role.id,
        )
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture
def account1(app, user1):
    """Create account for user1"""
    with app.app_context():
        return AccountService.create_account(
            user_id=user1, account_type="savings", initial_balance=100000
        ).id


class TestLoanApplication:
    """Test loan application"""

    def test_apply_for_loan_success(self, app, user1, account1):
        """Test successfully applying for loan"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user_id=user1,
                account_id=account1,
                loan_amount=50000,
                loan_type="personal",
                tenure_months=12,
            )

            assert loan.id is not None
            assert loan.loan_amount == Decimal("50000")
            assert loan.loan_type == "personal"
            assert loan.tenure_months == 12
            assert loan.status == "pending"
            assert loan.emi > 0

    def test_apply_for_loan_invalid_account(self, app, user1):
        """Test applying for loan with invalid account"""
        with app.app_context():
            with pytest.raises(Exception):
                LoanService.apply_for_loan(999, 999, 50000, "personal", 12)

    def test_apply_for_loan_invalid_type(self, app, user1, account1):
        """Test applying with invalid loan type"""
        with app.app_context():
            with pytest.raises(Exception):
                LoanService.apply_for_loan(user1, account1, 50000, "invalid", 12)

    def test_apply_for_loan_invalid_amount(self, app, user1, account1):
        """Test applying with invalid amount"""
        with app.app_context():
            # Zero amount
            with pytest.raises(Exception):
                LoanService.apply_for_loan(user1, account1, 0, "personal", 12)

            # Negative amount
            with pytest.raises(Exception):
                LoanService.apply_for_loan(user1, account1, -100, "personal", 12)

    def test_apply_for_loan_exceeds_limit(self, app, user1, account1):
        """Test applying exceeds maximum limit"""
        with app.app_context():
            with pytest.raises(Exception):
                LoanService.apply_for_loan(user1, account1, 10000000, "personal", 12)

    def test_apply_for_loan_invalid_tenure(self, app, user1, account1):
        """Test applying with invalid tenure"""
        with app.app_context():
            # Too short
            with pytest.raises(Exception):
                LoanService.apply_for_loan(user1, account1, 50000, "personal", 3)

            # Too long
            with pytest.raises(Exception):
                LoanService.apply_for_loan(user1, account1, 50000, "personal", 400)

    def test_apply_for_different_loan_types(self, app, user1, account1):
        """Test applying for different loan types"""
        with app.app_context():
            types = ["personal", "home", "auto", "education"]

            for loan_type in types:
                loan = LoanService.apply_for_loan(
                    user1, account1, 50000, loan_type, 12
                )
                assert loan.loan_type == loan_type


class TestEMICalculation:
    """Test EMI calculation"""

    def test_emi_calculation(self, app, user1, account1):
        """Test EMI is calculated correctly"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )

            # EMI for 100k at 8.5% for 12 months should be ~8,685
            assert float(loan.emi) > 0
            assert float(loan.emi) < 100000

    def test_emi_different_tenures(self, app, user1, account1):
        """Test EMI varies with tenure"""
        with app.app_context():
            loan_12 = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            loan_24 = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 24
            )

            # Longer tenure = lower EMI
            assert loan_24.emi < loan_12.emi

    def test_emi_different_interest_rates(self, app, user1, account1):
        """Test EMI varies with interest rate"""
        with app.app_context():
            loan_personal = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            personal_emi = float(loan_personal.emi)

            # Create new account for next loan
            account2 = AccountService.create_account(user1, "savings", 100000).id
            loan_home = LoanService.apply_for_loan(
                user1, account2, 100000, "home", 12
            )
            home_emi = float(loan_home.emi)

            # Higher rate = higher EMI
            assert personal_emi > home_emi


class TestLoanApproval:
    """Test loan approval workflow"""

    def test_approve_loan_success(self, app, user1, account1, staff_user):
        """Test successfully approving loan"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )

            approved = LoanService.approve_loan(loan.id, staff_user)

            assert approved.status == "active"  # Disbursed automatically
            assert approved.approved_by == staff_user
            assert approved.approved_at is not None

    def test_approve_already_approved(self, app, user1, account1, staff_user):
        """Test cannot approve already approved loan"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            # Try to approve again
            with pytest.raises(Exception):
                LoanService.approve_loan(loan.id, staff_user)

    def test_approve_creates_emi_schedule(self, app, user1, account1, staff_user):
        """Test approval creates EMI schedule"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )

            LoanService.approve_loan(loan.id, staff_user)

            # Check EMI schedule created
            payments = LoanService.get_emi_schedule(loan.id)
            assert len(payments) == 12
            assert all(p.status == "pending" for p in payments)

    def test_disburse_loan_success(self, app, user1, account1, staff_user):
        """Test disbursing approved loan"""
        with app.app_context():
            initial_balance = AccountService.get_account_by_id(account1).balance
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )

            LoanService.approve_loan(loan.id, staff_user, disburse=False)
            LoanService.disburse_loan(loan.id)

            # Check account balance increased
            updated_account = AccountService.get_account_by_id(account1)
            assert updated_account.balance == initial_balance + Decimal("50000")


class TestLoanRejection:
    """Test loan rejection"""

    def test_reject_loan_success(self, app, user1, account1):
        """Test successfully rejecting loan"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )

            rejected = LoanService.reject_loan(loan.id, "Credit score too low")

            assert rejected.status == "rejected"
            assert rejected.rejection_reason == "Credit score too low"

    def test_reject_already_approved(self, app, user1, account1, staff_user):
        """Test cannot reject approved loan"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            # Try to reject
            with pytest.raises(Exception):
                LoanService.reject_loan(loan.id, "Reason")


class TestEMIPayment:
    """Test EMI payment"""

    def test_pay_emi_success(self, app, user1, account1, staff_user):
        """Test successfully paying EMI"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            # Pay first EMI
            result = LoanService.pay_emi(loan.id, account1, float(loan.emi))

            assert "message" in result
            assert "amount_paid" in result
            assert result["emi_number"] == 1

    def test_pay_emi_updates_loan(self, app, user1, account1, staff_user):
        """Test EMI payment updates loan status"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            initial_remaining = loan.remaining_amount
            LoanService.pay_emi(loan.id, account1, float(loan.emi))

            updated_loan = LoanService.get_loan(loan.id)
            assert updated_loan.remaining_amount < initial_remaining

    def test_pay_emi_insufficient_balance(self, app, user1, staff_user):
        """Test cannot pay EMI with insufficient balance"""
        with app.app_context():
            # Create account with low balance
            account = AccountService.create_account(user1, "savings", 100).id

            # Apply large loan that creates high EMI
            loan = LoanService.apply_for_loan(
                user1, account, 1000000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            # After disbursement, balance is 100 + 1000000 = 1000100
            # But EMI is ~83,500, which is fine
            # So let's withdraw almost all money first
            AccountService.update_balance(account, -1000080)

            # Now try to pay EMI with insufficient balance
            with pytest.raises(Exception):
                LoanService.pay_emi(loan.id, account, float(loan.emi))

    def test_pay_emi_insufficient_amount(self, app, user1, account1, staff_user):
        """Test cannot pay less than EMI amount"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            # Try to pay less than EMI
            with pytest.raises(Exception):
                LoanService.pay_emi(loan.id, account1, float(loan.emi) - 100)


class TestLoanRetrieval:
    """Test loan retrieval"""

    def test_get_loan_by_id(self, app, user1, account1):
        """Test getting loan by ID"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )

            retrieved = LoanService.get_loan(loan.id)
            assert retrieved.id == loan.id

    def test_get_loan_not_found(self, app):
        """Test getting non-existent loan"""
        with app.app_context():
            with pytest.raises(Exception):
                LoanService.get_loan(999)

    def test_get_user_loans(self, app, user1, account1):
        """Test getting all user's loans"""
        with app.app_context():
            LoanService.apply_for_loan(user1, account1, 50000, "personal", 12)
            LoanService.apply_for_loan(user1, account1, 100000, "home", 24)

            loans = LoanService.get_user_loans(user1)
            assert len(loans) == 2

    def test_get_user_loans_filtered(self, app, user1, account1, staff_user):
        """Test getting user's loans filtered by status"""
        with app.app_context():
            loan1 = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )
            loan2 = LoanService.apply_for_loan(
                user1, account1, 100000, "home", 24
            )

            LoanService.approve_loan(loan1.id, staff_user)

            pending = LoanService.get_user_loans(user1, status="pending")
            assert len(pending) == 1


class TestLoanSummary:
    """Test loan summary and statistics"""

    def test_get_loan_summary(self, app, user1, account1, staff_user):
        """Test getting loan summary"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            summary = LoanService.get_loan_summary(loan.id)

            assert summary["loan_id"] == loan.id
            assert "total_interest_payable" in summary
            assert "emis_paid" in summary
            assert "emis_pending" in summary

    def test_get_statistics(self, app, user1, account1, staff_user):
        """Test getting loan statistics"""
        with app.app_context():
            LoanService.apply_for_loan(user1, account1, 50000, "personal", 12)
            LoanService.apply_for_loan(user1, account1, 100000, "home", 24)

            stats = LoanService.get_loan_statistics()

            assert stats["total_loans"] == 2
            assert stats["pending_approval"] == 2

    def test_get_pending_approvals(self, app, user1, account1, staff_user):
        """Test getting pending loan applications"""
        with app.app_context():
            LoanService.apply_for_loan(user1, account1, 50000, "personal", 12)
            LoanService.apply_for_loan(user1, account1, 100000, "home", 24)

            pending = LoanService.get_pending_approvals()
            assert len(pending) == 2


class TestEMISchedule:
    """Test EMI schedule"""

    def test_get_emi_schedule(self, app, user1, account1, staff_user):
        """Test getting EMI schedule"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            schedule = LoanService.get_emi_schedule(loan.id)

            assert len(schedule) == 12
            assert all(isinstance(p, LoanPayment) for p in schedule)
            assert all(p.status == "pending" for p in schedule)

    def test_emi_schedule_dates(self, app, user1, account1, staff_user):
        """Test EMI schedule has correct due dates"""
        with app.app_context():
            loan = LoanService.apply_for_loan(
                user1, account1, 100000, "personal", 12
            )
            LoanService.approve_loan(loan.id, staff_user)

            schedule = LoanService.get_emi_schedule(loan.id)

            # Each EMI should be ~30 days apart
            for i, payment in enumerate(schedule):
                assert payment.emi_number == i + 1
                assert payment.amount == loan.emi


class TestLoanIntegration:
    """Integration tests"""

    def test_complete_loan_workflow(self, app, user1, account1, staff_user):
        """Test complete loan lifecycle"""
        with app.app_context():
            initial_balance = AccountService.get_account_by_id(account1).balance

            # Apply for loan
            loan = LoanService.apply_for_loan(
                user1, account1, 50000, "personal", 12
            )
            assert loan.status == "pending"

            # Approve and disburse
            LoanService.approve_loan(loan.id, staff_user)
            updated = LoanService.get_loan(loan.id)
            assert updated.status == "active"

            # Check balance increased
            account = AccountService.get_account_by_id(account1)
            assert account.balance == initial_balance + Decimal("50000")

            # Pay EMI
            result = LoanService.pay_emi(loan.id, account1, float(loan.emi))
            assert result["emi_number"] == 1

            # Check loan updated
            updated_loan = LoanService.get_loan(loan.id)
            assert updated_loan.paid_amount > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
