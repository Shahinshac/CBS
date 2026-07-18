"""
Tests for transaction management system
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User, Role
from app.models.account import Account
from app.models.transaction import Transaction
from app.services.user_service import UserService
from app.services.account_service import AccountService
from app.services.transaction_service import TransactionService
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
    """Create account for user1 with initial balance"""
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


class TestDepositOperation:
    """Test deposit functionality"""

    def test_deposit_success(self, app, account1):
        """Test successful deposit"""
        with app.app_context():
            before_balance = float(AccountService.get_account_by_id(account1).balance)
            transaction = TransactionService.deposit(account1, 1000, "Test deposit")
            after_balance = float(AccountService.get_account_by_id(account1).balance)

            assert transaction.transaction_type == "deposit"
            assert float(transaction.amount) == 1000
            assert after_balance == before_balance + 1000

    def test_deposit_multiple_times(self, app, account1):
        """Test multiple deposits"""
        with app.app_context():
            TransactionService.deposit(account1, 1000)
            TransactionService.deposit(account1, 2000)
            TransactionService.deposit(account1, 500)

            account = AccountService.get_account_by_id(account1)
            assert float(account.balance) == 13500

    def test_deposit_zero_amount(self, app, account1):
        """Test deposit with zero amount"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.deposit(account1, 0)

    def test_deposit_negative_amount(self, app, account1):
        """Test deposit with negative amount"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.deposit(account1, -1000)

    def test_deposit_invalid_account(self, app):
        """Test deposit to non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.deposit(999, 1000)

    def test_deposit_creates_transaction_record(self, app, account1):
        """Test that deposit creates transaction record"""
        with app.app_context():
            transaction = TransactionService.deposit(account1, 1000)

            retrieved = Transaction.query.get(transaction.id)
            assert retrieved is not None
            assert retrieved.transaction_type == "deposit"
            assert retrieved.status == "success"


class TestWithdrawOperation:
    """Test withdrawal functionality"""

    def test_withdraw_success(self, app, account1):
        """Test successful withdrawal"""
        with app.app_context():
            before_balance = float(AccountService.get_account_by_id(account1).balance)
            transaction = TransactionService.withdraw(account1, 2000, "Test withdrawal")
            after_balance = float(AccountService.get_account_by_id(account1).balance)

            assert transaction.transaction_type == "withdrawal"
            assert float(transaction.amount) == 2000
            assert after_balance == before_balance - 2000

    def test_withdraw_insufficient_balance(self, app, account1):
        """Test withdrawal with insufficient balance"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.withdraw(account1, 50000)

    def test_withdraw_exact_balance(self, app, account1):
        """Test withdrawing exact account balance"""
        with app.app_context():
            account = AccountService.get_account_by_id(account1)
            current_balance = float(account.balance)

            transaction = TransactionService.withdraw(account1, current_balance)
            after_balance = float(AccountService.get_account_by_id(account1).balance)

            assert after_balance == 0

    def test_withdraw_zero_amount(self, app, account1):
        """Test withdrawal with zero amount"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.withdraw(account1, 0)

    def test_withdraw_negative_amount(self, app, account1):
        """Test withdrawal with negative amount"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.withdraw(account1, -1000)

    def test_withdraw_invalid_account(self, app):
        """Test withdrawal from non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.withdraw(999, 1000)


class TestTransferOperation:
    """Test transfer between accounts"""

    def test_transfer_success(self, app, account1, account2):
        """Test successful transfer"""
        with app.app_context():
            before_from = float(AccountService.get_account_by_id(account1).balance)
            before_to = float(AccountService.get_account_by_id(account2).balance)

            result = TransactionService.transfer(account1, account2, 1000)

            after_from = float(AccountService.get_account_by_id(account1).balance)
            after_to = float(AccountService.get_account_by_id(account2).balance)

            assert result["status"] == "completed"
            assert after_from == before_from - 1000
            assert after_to == before_to + 1000

    def test_transfer_creates_two_transactions(self, app, account1, account2):
        """Test that transfer creates two transaction records"""
        with app.app_context():
            result = TransactionService.transfer(account1, account2, 1000)

            # Both transactions should exist
            debit_txn = Transaction.query.get(result["from_transaction"]["id"])
            credit_txn = Transaction.query.get(result["to_transaction"]["id"])

            assert debit_txn is not None
            assert credit_txn is not None
            assert debit_txn.reference_id == credit_txn.reference_id

    def test_transfer_insufficient_balance(self, app, account1, account2):
        """Test transfer with insufficient balance"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.transfer(account1, account2, 50000)

    def test_transfer_to_same_account(self, app, account1):
        """Test transfer to same account"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.transfer(account1, account1, 1000)

    def test_transfer_zero_amount(self, app, account1, account2):
        """Test transfer with zero amount"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.transfer(account1, account2, 0)

    def test_transfer_invalid_from_account(self, app, account2):
        """Test transfer from non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.transfer(999, account2, 1000)

    def test_transfer_invalid_to_account(self, app, account1):
        """Test transfer to non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.transfer(account1, 999, 1000)

    def test_multiple_transfers(self, app, account1, account2):
        """Test multiple sequential transfers"""
        with app.app_context():
            TransactionService.transfer(account1, account2, 1000)
            TransactionService.transfer(account1, account2, 2000)
            TransactionService.transfer(account2, account1, 500)

            acc1_balance = float(AccountService.get_account_by_id(account1).balance)
            acc2_balance = float(AccountService.get_account_by_id(account2).balance)

            assert acc1_balance == 10000 - 1000 - 2000 + 500
            assert acc2_balance == 5000 + 1000 + 2000 - 500

    def test_transfer_is_atomic(self, app, account1, account2):
        """Test that transfer is atomic (both succeed or fail)"""
        with app.app_context():
            AccountService.update_balance(account1, 10000, "deduct")  # Empty account1

            before_from = float(AccountService.get_account_by_id(account1).balance)
            before_to = float(AccountService.get_account_by_id(account2).balance)

            # Transfer should fail due to insufficient balance
            try:
                TransactionService.transfer(account1, account2, 1000)
            except Exception:
                pass

            # Balances should not change
            after_from = float(AccountService.get_account_by_id(account1).balance)
            after_to = float(AccountService.get_account_by_id(account2).balance)

            assert after_from == before_from
            assert after_to == before_to


class TestTransactionRetrieval:
    """Test transaction history and retrieval"""

    def test_get_transaction(self, app, account1):
        """Test retrieving specific transaction"""
        with app.app_context():
            transaction = TransactionService.deposit(account1, 1000)
            retrieved = TransactionService.get_transaction(transaction.id)

            assert retrieved.id == transaction.id
            assert retrieved.transaction_type == "deposit"

    def test_get_transaction_not_found(self, app):
        """Test retrieving non-existent transaction"""
        with app.app_context():
            with pytest.raises(Exception):
                TransactionService.get_transaction(999)

    def test_get_account_transactions(self, app, account1):
        """Test retrieving account transaction history"""
        with app.app_context():
            TransactionService.deposit(account1, 1000)
            TransactionService.deposit(account1, 2000)
            TransactionService.withdraw(account1, 500)

            result = TransactionService.get_account_transactions(account1)

            assert result["total"] == 3
            assert len(result["transactions"]) == 3
            assert result["account_id"] == account1

    def test_get_account_transactions_with_type_filter(self, app, account1):
        """Test transaction history with type filter"""
        with app.app_context():
            TransactionService.deposit(account1, 1000)
            TransactionService.deposit(account1, 2000)
            TransactionService.withdraw(account1, 500)

            result = TransactionService.get_account_transactions(
                account1, transaction_type="deposit"
            )

            assert result["total"] == 2
            assert all(t["transaction_type"] == "deposit" for t in result["transactions"])

    def test_get_account_transactions_with_date_filter(self, app, account1):
        """Test transaction history with date filter"""
        with app.app_context():
            TransactionService.deposit(account1, 1000)
            # Simulate old transaction (for testing, we can manually create one)
            start_date = datetime.utcnow() - timedelta(days=10)

            result = TransactionService.get_account_transactions(
                account1, start_date=start_date
            )

            assert result["total"] >= 1

    def test_get_user_transactions(self, app, user1, account1):
        """Test retrieving user's all transactions"""
        with app.app_context():
            TransactionService.deposit(account1, 1000)
            TransactionService.withdraw(account1, 200)

            result = TransactionService.get_user_transactions(user1)

            assert result["total"] == 2
            assert result["user_id"] == user1

    def test_get_transaction_summary(self, app, account1, account2):
        """Test transaction summary"""
        with app.app_context():
            TransactionService.deposit(account1, 1000)
            TransactionService.withdraw(account1, 200)
            TransactionService.transfer(account1, account2, 500)

            summary = TransactionService.get_transaction_summary(account1, days=30)

            assert summary["account_id"] == account1
            assert summary["transaction_count"] == 3
            assert summary["deposits"]["total"] == 1000
            assert summary["withdrawals"]["total"] == 200
            assert summary["transfers_outgoing"]["total"] == 500

    def test_transaction_pagination(self, app, account1):
        """Test transaction pagination"""
        with app.app_context():
            # Create 25 transactions
            for i in range(25):
                TransactionService.deposit(account1, 100 * (i + 1))

            # Get first page
            page1 = TransactionService.get_account_transactions(
                account1, page=1, per_page=10
            )
            assert len(page1["transactions"]) == 10
            assert page1["pages"] == 3

            # Get second page
            page2 = TransactionService.get_account_transactions(
                account1, page=2, per_page=10
            )
            assert len(page2["transactions"]) == 10

            # Get third page
            page3 = TransactionService.get_account_transactions(
                account1, page=3, per_page=10
            )
            assert len(page3["transactions"]) == 5


class TestTransactionIntegration:
    """Integration tests for complete transaction flows"""

    def test_complete_account_flow(self, app, user1, account1):
        """Test complete transaction flow"""
        with app.app_context():
            # Initial balance: 10000
            initial = float(AccountService.get_account_by_id(account1).balance)
            assert initial == 10000

            # Deposit 5000
            TransactionService.deposit(account1, 5000)
            assert float(AccountService.get_account_by_id(account1).balance) == 15000

            # Withdraw 3000
            TransactionService.withdraw(account1, 3000)
            assert float(AccountService.get_account_by_id(account1).balance) == 12000

            # Check transaction history
            history = TransactionService.get_account_transactions(account1)
            assert history["total"] == 2

    def test_simultaneous_transfers(self, app, user1, user2, account1, account2):
        """Test multiple transfers between accounts"""
        with app.app_context():
            # User1 transfers to User2
            TransactionService.transfer(account1, account2, 1000)

            # User2 transfers back to User1
            TransactionService.transfer(account2, account1, 500)

            # User1 transfers again
            TransactionService.transfer(account1, account2, 2000)

            acc1 = float(AccountService.get_account_by_id(account1).balance)
            acc2 = float(AccountService.get_account_by_id(account2).balance)

            assert acc1 == 10000 - 1000 + 500 - 2000
            assert acc2 == 5000 + 1000 - 500 + 2000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
