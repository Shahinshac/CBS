"""
Tests for card and ATM management system
"""
import pytest
from app import create_app, db
from app.models.user import User, Role
from app.models.account import Account
from app.models.base import Card
from app.models.transaction import Transaction, TransactionTypeEnum
from app.services.account_service import AccountService
from app.services.card_service import CardService, ATMService
from app.services.transaction_service import TransactionService
from app.services.auth_service import initialize_roles
from decimal import Decimal


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
def staff_user(app):
    """Create staff user for authorization tests"""
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
            user_id=user1, account_type="savings", initial_balance=10000
        ).id


@pytest.fixture
def account2(app, user2):
    """Create account for user2"""
    with app.app_context():
        return AccountService.create_account(
            user_id=user2, account_type="savings", initial_balance=5000
        ).id


class TestCardGeneration:
    """Test card generation"""

    def test_generate_card_success(self, app, account1):
        """Test successfully generating a card"""
        with app.app_context():
            card = CardService.generate_card(account1)

            assert card.id is not None
            assert card.account_id == account1
            assert card.card_number is not None
            assert len(card.card_number) == 16
            assert card.card_type == "debit"
            assert card.is_active is True
            assert card.is_blocked is False
            assert card.expiry_date is not None

    def test_generate_card_invalid_account(self, app):
        """Test generating card for non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                CardService.generate_card(999)

    def test_generate_card_unique_number(self, app, account1, account2):
        """Test that generated card numbers are unique"""
        with app.app_context():
            card1 = CardService.generate_card(account1)
            card2 = CardService.generate_card(account2)

            assert card1.card_number != card2.card_number

    def test_generate_multiple_cards_same_account(self, app, account1):
        """Test generating multiple cards for same account"""
        with app.app_context():
            card1 = CardService.generate_card(account1)
            card2 = CardService.generate_card(account1)

            assert card1.id != card2.id
            assert card1.card_number != card2.card_number
            # Both should be for same account
            assert card1.account_id == card2.account_id == account1

    def test_card_default_pin_is_0000(self, app, account1):
        """Test that default PIN is 0000"""
        with app.app_context():
            card = CardService.generate_card(account1)
            # Verify by attempting ATM login with default PIN
            result = ATMService.atm_login(card.card_number, "0000")
            assert result is not None


class TestPINManagement:
    """Test PIN setting and verification"""

    def test_set_pin_success(self, app, account1):
        """Test setting a valid PIN"""
        with app.app_context():
            card = CardService.generate_card(account1)
            updated_card = CardService.set_pin(card.id, "1234")

            assert updated_card.id == card.id
            # Verify new PIN works
            result = ATMService.atm_login(card.card_number, "1234")
            assert result is not None

    def test_set_pin_old_pin_invalid(self, app, account1):
        """Test that old PIN no longer works after change"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "1234")

            # Old PIN should fail
            with pytest.raises(Exception):
                ATMService.atm_login(card.card_number, "0000")

    def test_set_pin_invalid_format(self, app, account1):
        """Test setting PIN with invalid format"""
        with app.app_context():
            card = CardService.generate_card(account1)

            # PIN too short
            with pytest.raises(Exception):
                CardService.set_pin(card.id, "123")

            # PIN too long
            with pytest.raises(Exception):
                CardService.set_pin(card.id, "12345")

            # PIN with letters
            with pytest.raises(Exception):
                CardService.set_pin(card.id, "123a")

    def test_set_pin_card_not_found(self, app):
        """Test setting PIN for non-existent card"""
        with app.app_context():
            with pytest.raises(Exception):
                CardService.set_pin(999, "1234")

    def test_verify_pin_correct(self, app, account1):
        """Test verifying correct PIN"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "9876")

            verified_card = CardService.verify_pin(card.card_number, "9876")
            assert verified_card.id == card.id

    def test_verify_pin_incorrect(self, app, account1):
        """Test verifying incorrect PIN"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "9876")

            with pytest.raises(Exception) as exc_info:
                CardService.verify_pin(card.card_number, "1234")
            assert "Invalid PIN" in str(exc_info.value)

    def test_verify_pin_card_blocked(self, app, account1):
        """Test that verification fails for blocked card"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "1234")
            CardService.block_card(card.id)

            with pytest.raises(Exception) as exc_info:
                CardService.verify_pin(card.card_number, "1234")
            assert "blocked" in str(exc_info.value).lower()

    def test_verify_pin_card_inactive(self, app, account1):
        """Test that verification fails for inactive card"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "1234")

            # Manually deactivate card
            card.is_active = False
            db.session.commit()

            with pytest.raises(Exception) as exc_info:
                CardService.verify_pin(card.card_number, "1234")
            assert "not active" in str(exc_info.value).lower()


class TestATMLogin:
    """Test ATM login functionality"""

    def test_atm_login_success(self, app, account1):
        """Test successful ATM login"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "5555")

            result = ATMService.atm_login(card.card_number, "5555")

            assert "card_id" in result
            assert "account_number" in result
            assert "account_id" in result
            assert "balance" in result
            assert result["card_id"] == card.id
            assert result["account_id"] == account1
            # Card number should be masked
            assert result["card_number"].startswith("****")

    def test_atm_login_invalid_pin(self, app, account1):
        """Test ATM login with invalid PIN"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "5555")

            with pytest.raises(Exception):
                ATMService.atm_login(card.card_number, "0000")

    def test_atm_login_invalid_card(self, app):
        """Test ATM login with invalid card number"""
        with app.app_context():
            with pytest.raises(Exception):
                ATMService.atm_login("0000000000000000", "1234")

    def test_atm_login_with_default_pin(self, app, account1):
        """Test ATM login with default PIN 0000"""
        with app.app_context():
            card = CardService.generate_card(account1)

            result = ATMService.atm_login(card.card_number, "0000")
            assert result is not None


class TestATMBalance:
    """Test ATM balance check"""

    def test_check_balance_success(self, app, account1):
        """Test checking balance via ATM"""
        with app.app_context():
            card = CardService.generate_card(account1)
            account = AccountService.get_account_by_id(account1)

            balance_info = ATMService.atm_check_balance(card.id)

            assert "account_number" in balance_info
            assert "balance" in balance_info
            assert "currency" in balance_info
            assert balance_info["balance"] == float(account.balance)
            assert balance_info["currency"] == "INR"

    def test_check_balance_invalid_card(self, app):
        """Test checking balance for non-existent card"""
        with app.app_context():
            with pytest.raises(Exception):
                ATMService.atm_check_balance(999)


class TestATMWithdrawal:
    """Test ATM withdrawal"""

    def test_atm_withdraw_success(self, app, account1):
        """Test successful ATM withdrawal"""
        with app.app_context():
            card = CardService.generate_card(account1)
            initial_balance = AccountService.get_account_by_id(account1).balance

            result = ATMService.atm_withdraw(card.id, 1000)

            assert "message" in result
            assert "transaction_id" in result
            assert "amount" in result
            assert float(result["amount"]) == 1000
            assert float(result["new_balance"]) == float(initial_balance) - 1000

    def test_atm_withdraw_insufficient_balance(self, app, account1):
        """Test ATM withdrawal with insufficient balance"""
        with app.app_context():
            card = CardService.generate_card(account1)

            with pytest.raises(Exception):
                ATMService.atm_withdraw(card.id, 50000)

    def test_atm_withdraw_invalid_amount(self, app, account1):
        """Test ATM withdrawal with invalid amount"""
        with app.app_context():
            card = CardService.generate_card(account1)

            # Zero amount
            with pytest.raises(Exception):
                ATMService.atm_withdraw(card.id, 0)

            # Negative amount
            with pytest.raises(Exception):
                ATMService.atm_withdraw(card.id, -100)

    def test_atm_withdraw_exceeds_limit(self, app, account1):
        """Test ATM withdrawal exceeding daily limit"""
        with app.app_context():
            card = CardService.generate_card(account1)

            with pytest.raises(Exception):
                ATMService.atm_withdraw(card.id, 150000)  # Over 100k limit

    def test_atm_withdraw_creates_transaction(self, app, account1):
        """Test that ATM withdrawal creates transaction record"""
        with app.app_context():
            card = CardService.generate_card(account1)

            result = ATMService.atm_withdraw(card.id, 500)

            # Verify transaction exists
            transaction = TransactionService.get_transaction(result["transaction_id"])
            assert transaction.amount == Decimal("500")
            assert transaction.transaction_type in [TransactionTypeEnum.WITHDRAWAL, "withdrawal"]
            assert transaction.account_id == account1

    def test_atm_withdraw_invalid_card(self, app):
        """Test ATM withdrawal with invalid card"""
        with app.app_context():
            with pytest.raises(Exception):
                ATMService.atm_withdraw(999, 1000)


class TestATMMiniStatement:
    """Test ATM mini statement"""

    def test_mini_statement_success(self, app, account1):
        """Test getting mini statement"""
        with app.app_context():
            card = CardService.generate_card(account1)

            # Make some transactions
            ATMService.atm_withdraw(card.id, 100)
            ATMService.atm_withdraw(card.id, 200)

            statement = ATMService.atm_mini_statement(card.id, 5)

            assert "account_number" in statement
            assert "account_type" in statement
            assert "current_balance" in statement
            assert "statement_date" in statement
            assert "transactions" in statement
            assert "transaction_count" in statement
            assert statement["transaction_count"] == 2

    def test_mini_statement_limit(self, app, account1):
        """Test mini statement with transaction limit"""
        with app.app_context():
            card = CardService.generate_card(account1)

            # Create 10 transactions
            for _ in range(10):
                ATMService.atm_withdraw(card.id, 100)

            # Request only 5
            statement = ATMService.atm_mini_statement(card.id, 5)

            assert statement["transaction_count"] == 5

    def test_mini_statement_empty(self, app, account1):
        """Test mini statement with no transactions"""
        with app.app_context():
            card = CardService.generate_card(account1)

            statement = ATMService.atm_mini_statement(card.id, 5)

            assert statement["transaction_count"] == 0
            assert len(statement["transactions"]) == 0

    def test_mini_statement_invalid_card(self, app):
        """Test mini statement for non-existent card"""
        with app.app_context():
            with pytest.raises(Exception):
                ATMService.atm_mini_statement(999, 5)


class TestCardBlockUnblock:
    """Test card blocking and unblocking"""

    def test_block_card_success(self, app, account1):
        """Test successfully blocking a card"""
        with app.app_context():
            card = CardService.generate_card(account1)

            blocked_card = CardService.block_card(card.id)

            assert blocked_card.is_blocked is True

    def test_block_already_blocked_card(self, app, account1):
        """Test blocking a card that's already blocked"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.block_card(card.id)

            with pytest.raises(Exception):
                CardService.block_card(card.id)

    def test_unblock_card_success(self, app, account1):
        """Test successfully unblocking a card"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.block_card(card.id)

            unblocked_card = CardService.unblock_card(card.id)

            assert unblocked_card.is_blocked is False

    def test_unblock_non_blocked_card(self, app, account1):
        """Test unblocking a card that's not blocked"""
        with app.app_context():
            card = CardService.generate_card(account1)

            with pytest.raises(Exception):
                CardService.unblock_card(card.id)

    def test_atm_login_blocked_card(self, app, account1):
        """Test ATM login fails for blocked card"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "1234")
            CardService.block_card(card.id)

            with pytest.raises(Exception):
                ATMService.atm_login(card.card_number, "1234")

    def test_atm_withdraw_blocked_card(self, app, account1):
        """Test ATM withdrawal fails for blocked card"""
        with app.app_context():
            card = CardService.generate_card(account1)
            CardService.set_pin(card.id, "1234")
            CardService.block_card(card.id)

            # Cannot login with blocked card, so cannot withdraw
            with pytest.raises(Exception):
                ATMService.atm_login(card.card_number, "1234")


class TestCardRetrieval:
    """Test retrieving card information"""

    def test_get_card_by_id(self, app, account1):
        """Test getting card by ID"""
        with app.app_context():
            card = CardService.generate_card(account1)

            retrieved = CardService.get_card(card.id)

            assert retrieved.id == card.id
            assert retrieved.card_number == card.card_number

    def test_get_card_not_found(self, app):
        """Test getting non-existent card"""
        with app.app_context():
            with pytest.raises(Exception):
                CardService.get_card(999)

    def test_get_card_by_number(self, app, account1):
        """Test getting card by card number"""
        with app.app_context():
            card = CardService.generate_card(account1)

            retrieved = CardService.get_card_by_number(card.card_number)

            assert retrieved.id == card.id

    def test_get_card_by_number_not_found(self, app):
        """Test getting card by non-existent number"""
        with app.app_context():
            with pytest.raises(Exception):
                CardService.get_card_by_number("0000000000000000")

    def test_get_account_cards(self, app, account1):
        """Test getting all cards for account"""
        with app.app_context():
            card1 = CardService.generate_card(account1)
            card2 = CardService.generate_card(account1)

            cards = CardService.get_account_cards(account1)

            assert len(cards) == 2
            assert card1.id in [c.id for c in cards]
            assert card2.id in [c.id for c in cards]

    def test_get_account_cards_invalid_account(self, app):
        """Test getting cards for non-existent account"""
        with app.app_context():
            with pytest.raises(Exception):
                CardService.get_account_cards(999)


class TestCardToDict:
    """Test card to_dict conversion"""

    def test_to_dict_masks_card_number(self, app, account1):
        """Test that to_dict masks card number by default"""
        with app.app_context():
            card = CardService.generate_card(account1)

            data = card.to_dict()

            assert data["card_number"].startswith("****")
            assert len(data["card_number"]) == 8  # **** + last 4 digits

    def test_to_dict_includes_sensitive(self, app, account1):
        """Test that to_dict can include full card number"""
        with app.app_context():
            card = CardService.generate_card(account1)

            data = card.to_dict(include_sensitive=True)

            assert "full_card_number" in data
            assert data["full_card_number"] == card.card_number

    def test_to_dict_structure(self, app, account1):
        """Test to_dict includes all required fields"""
        with app.app_context():
            card = CardService.generate_card(account1)

            data = card.to_dict()

            assert "id" in data
            assert "card_number" in data
            assert "card_type" in data
            assert "expiry_date" in data
            assert "is_active" in data
            assert "is_blocked" in data
            assert "account_id" in data
            assert "created_at" in data


class TestCardIntegration:
    """Integration tests for card workflow"""

    def test_complete_card_workflow(self, app, account1):
        """Test complete card lifecycle"""
        with app.app_context():
            # Generate card
            card = CardService.generate_card(account1)
            assert card.is_active

            # Set PIN
            CardService.set_pin(card.id, "4444")

            # ATM login with new PIN
            login_result = ATMService.atm_login(card.card_number, "4444")
            assert login_result is not None

            # Check balance
            balance_info = ATMService.atm_check_balance(card.id)
            assert balance_info is not None

            # Withdraw
            withdrawal = ATMService.atm_withdraw(card.id, 500)
            assert withdrawal is not None

            # Mini statement
            statement = ATMService.atm_mini_statement(card.id, 5)
            assert len(statement["transactions"]) == 1

            # Block card
            CardService.block_card(card.id)

            # Verify login fails
            with pytest.raises(Exception):
                ATMService.atm_login(card.card_number, "4444")

            # Unblock card
            CardService.unblock_card(card.id)

            # Login should work again
            login_result = ATMService.atm_login(card.card_number, "4444")
            assert login_result is not None

    def test_multiple_cards_same_account(self, app, account1):
        """Test managing multiple cards for same account"""
        with app.app_context():
            card1 = CardService.generate_card(account1)
            card2 = CardService.generate_card(account1)

            CardService.set_pin(card1.id, "1111")
            CardService.set_pin(card2.id, "2222")

            # Both should work independently
            result1 = ATMService.atm_login(card1.card_number, "1111")
            result2 = ATMService.atm_login(card2.card_number, "2222")

            assert result1["card_id"] == card1.id
            assert result2["card_id"] == card2.id

            # Block one, other should still work
            CardService.block_card(card1.id)

            with pytest.raises(Exception):
                ATMService.atm_login(card1.card_number, "1111")

            result2_again = ATMService.atm_login(card2.card_number, "2222")
            assert result2_again is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
