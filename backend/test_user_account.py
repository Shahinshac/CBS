"""
Tests for user and account management
"""
import pytest
from app import create_app, db
from app.models.user import User, Role, RoleEnum
from app.models.account import Account
from app.services.user_service import UserService
from app.services.account_service import AccountService
from app.services.auth_service import AuthService, initialize_roles


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
def admin_user(app):
    """Create an admin user"""
    with app.app_context():
        admin_role = Role.query.filter_by(name="admin").first()
        user = User(
            username="admin",
            email="admin@test.com",
            password_hash="hashed_password",
            first_name="Admin",
            last_name="User",
            phone_number="+91-9999999999",
            role_id=admin_role.id,
        )
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture
def customer_user(app):
    """Create a customer user"""
    with app.app_context():
        customer_role = Role.query.filter_by(name="customer").first()
        user = User(
            username="customer",
            email="customer@test.com",
            password_hash="hashed_password",
            first_name="Customer",
            last_name="User",
            phone_number="+91-8888888888",
            role_id=customer_role.id,
        )
        db.session.add(user)
        db.session.commit()
        return user.id


class TestUserService:
    """Test user service operations"""

    def test_get_all_users(self, app, admin_user, customer_user):
        """Test retrieving all users"""
        with app.app_context():
            result = UserService.get_all_users(page=1, per_page=20)
            assert result["total"] == 2
            assert len(result["users"]) == 2

    def test_get_user_by_id(self, app, admin_user):
        """Test getting user by ID"""
        with app.app_context():
            user = UserService.get_user_by_id(admin_user)
            assert user.username == "admin"

    def test_get_user_by_id_not_found(self, app):
        """Test getting non-existent user"""
        with app.app_context():
            with pytest.raises(Exception):
                UserService.get_user_by_id(999)

    def test_get_user_by_username(self, app, admin_user):
        """Test getting user by username"""
        with app.app_context():
            user = UserService.get_user_by_username("admin")
            assert user.email == "admin@test.com"

    def test_get_user_by_email(self, app, admin_user):
        """Test getting user by email"""
        with app.app_context():
            user = UserService.get_user_by_email("admin@test.com")
            assert user.username == "admin"

    def test_update_user(self, app, customer_user):
        """Test updating user information"""
        with app.app_context():
            updated = UserService.update_user(
                customer_user,
                first_name="Updated",
                last_name="User"
            )
            assert updated.first_name == "Updated"
            assert updated.last_name == "User"

    def test_assign_role(self, app, customer_user):
        """Test assigning role to user"""
        with app.app_context():
            updated = UserService.assign_role(customer_user, "staff")
            assert updated.role.name == "staff"

    def test_assign_invalid_role(self, app, customer_user):
        """Test assigning invalid role"""
        with app.app_context():
            with pytest.raises(Exception):
                UserService.assign_role(customer_user, "invalid_role")

    def test_deactivate_user(self, app, customer_user):
        """Test deactivating user"""
        with app.app_context():
            updated = UserService.deactivate_user(customer_user)
            assert updated.is_active is False

    def test_activate_user(self, app, customer_user):
        """Test activating user"""
        with app.app_context():
            UserService.deactivate_user(customer_user)
            updated = UserService.activate_user(customer_user)
            assert updated.is_active is True

    def test_search_users_by_username(self, app, customer_user):
        """Test searching users by username"""
        with app.app_context():
            results = UserService.search_users("cust", search_type="username")
            assert len(results) == 1
            assert results[0].username == "customer"

    def test_search_users_by_email(self, app, customer_user):
        """Test searching users by email"""
        with app.app_context():
            results = UserService.search_users("customer@", search_type="email")
            assert len(results) == 1


class TestAccountService:
    """Test account service operations"""

    def test_create_account(self, app, customer_user):
        """Test creating account"""
        with app.app_context():
            account = AccountService.create_account(
                user_id=customer_user,
                account_type="savings",
                initial_balance=5000.0
            )
            assert account.account_type == "savings"
            assert float(account.balance) == 5000.0
            assert account.status == "active"

    def test_create_account_unique_number(self, app, customer_user):
        """Test that account numbers are unique"""
        with app.app_context():
            acc1 = AccountService.create_account(customer_user)
            acc2 = AccountService.create_account(customer_user)
            assert acc1.account_number != acc2.account_number

    def test_create_account_invalid_type(self, app, customer_user):
        """Test creating account with invalid type"""
        with app.app_context():
            with pytest.raises(Exception):
                AccountService.create_account(
                    customer_user,
                    account_type="invalid"
                )

    def test_create_account_negative_balance(self, app, customer_user):
        """Test creating account with negative balance"""
        with app.app_context():
            with pytest.raises(Exception):
                AccountService.create_account(
                    customer_user,
                    initial_balance=-100
                )

    def test_get_account_by_id(self, app, customer_user):
        """Test getting account by ID"""
        with app.app_context():
            created = AccountService.create_account(customer_user)
            retrieved = AccountService.get_account_by_id(created.id)
            assert retrieved.id == created.id

    def test_get_account_by_number(self, app, customer_user):
        """Test getting account by account number"""
        with app.app_context():
            created = AccountService.create_account(customer_user)
            retrieved = AccountService.get_account_by_number(created.account_number)
            assert retrieved.account_number == created.account_number

    def test_get_user_accounts(self, app, customer_user):
        """Test getting all accounts for user"""
        with app.app_context():
            AccountService.create_account(customer_user)
            AccountService.create_account(customer_user, account_type="current")

            accounts = AccountService.get_user_accounts(customer_user)
            assert len(accounts) == 2

    def test_get_account_balance(self, app, customer_user):
        """Test getting account balance"""
        with app.app_context():
            account = AccountService.create_account(
                customer_user,
                initial_balance=1000
            )
            balance_info = AccountService.get_account_balance(account.id)
            assert balance_info["balance"] == 1000.0

    def test_update_balance_add(self, app, customer_user):
        """Test adding to account balance"""
        with app.app_context():
            account = AccountService.create_account(
                customer_user,
                initial_balance=1000
            )
            updated = AccountService.update_balance(account.id, 500, "add")
            assert float(updated.balance) == 1500.0

    def test_update_balance_deduct(self, app, customer_user):
        """Test deducting from account balance"""
        with app.app_context():
            account = AccountService.create_account(
                customer_user,
                initial_balance=1000
            )
            updated = AccountService.update_balance(account.id, 300, "deduct")
            assert float(updated.balance) == 700.0

    def test_update_balance_insufficient(self, app, customer_user):
        """Test insufficient balance error"""
        with app.app_context():
            account = AccountService.create_account(
                customer_user,
                initial_balance=100
            )
            with pytest.raises(Exception):
                AccountService.update_balance(account.id, 500, "deduct")

    def test_freeze_account(self, app, customer_user):
        """Test freezing account"""
        with app.app_context():
            account = AccountService.create_account(customer_user)
            frozen = AccountService.freeze_account(account.id)
            assert frozen.status == "frozen"

    def test_unfreeze_account(self, app, customer_user):
        """Test unfreezing account"""
        with app.app_context():
            account = AccountService.create_account(customer_user)
            AccountService.freeze_account(account.id)
            unfrozen = AccountService.unfreeze_account(account.id)
            assert unfrozen.status == "active"

    def test_close_account_with_zero_balance(self, app, customer_user):
        """Test closing account with zero balance"""
        with app.app_context():
            account = AccountService.create_account(
                customer_user,
                initial_balance=0
            )
            closed = AccountService.close_account(account.id)
            assert closed.status == "closed"

    def test_close_account_with_balance(self, app, customer_user):
        """Test closing account with non-zero balance"""
        with app.app_context():
            account = AccountService.create_account(
                customer_user,
                initial_balance=100
            )
            with pytest.raises(Exception):
                AccountService.close_account(account.id)

    def test_get_account_status(self, app, customer_user):
        """Test getting account status"""
        with app.app_context():
            account = AccountService.create_account(customer_user)
            status = AccountService.get_account_status(account.id)
            assert status["is_active"] is True
            assert status["is_frozen"] is False
            assert status["is_closed"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
