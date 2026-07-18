"""
Quick test to verify authentication system structure
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from app import create_app
    print("✓ App factory imported successfully")

    from app.models.user import User, Role
    print("✓ User and Role models imported")

    from app.models.account import Account
    print("✓ Account model imported")

    from app.models.transaction import Transaction
    print("✓ Transaction model imported")

    from app.utils.security import PasswordSecurity, TokenManager, PINSecurity
    print("✓ Security utilities imported")

    from app.utils.validators import Validators
    print("✓ Validators imported")

    from app.utils.generators import Generators
    print("✓ Generators imported")

    from app.utils.exceptions import BankingException, AuthenticationError
    print("✓ Exceptions imported")

    from app.services.auth_service import AuthService
    print("✓ Auth service imported")

    from app.middleware.rbac import require_role, require_authentication
    print("✓ RBAC middleware imported")

    from app.routes.auth import auth_bp
    print("✓ Auth routes imported")

    # Test the app factory
    app = create_app("testing")
    print("✓ App created successfully in testing mode")

    # Test password hashing
    password = "TestPass123"
    hashed = PasswordSecurity.hash_password(password)
    verified = PasswordSecurity.verify_password(password, hashed)
    assert verified, "Password verification failed"
    print("✓ Password hashing/verification working")

    # Test validators
    Validators.validate_email("test@example.com")
    Validators.validate_password("SecurePass123")
    Validators.validate_username("test_user")
    Validators.validate_phone("+91-9876543210")
    print("✓ Input validators working")

    # Test generators
    account_num = Generators.generate_account_number()
    assert len(account_num) == 18, "Account number should be 18 digits"
    print(f"✓ Account number generator working: {account_num}")

    txn_ref = Generators.generate_transaction_reference()
    assert txn_ref.startswith("TXN"), "Transaction reference should start with TXN"
    print(f"✓ Transaction reference generator working: {txn_ref}")

    card_num = Generators.generate_card_number()
    assert card_num.startswith("4532"), "Card number should start with 4532"
    print(f"✓ Card number generator working: {card_num}")

    print("\n✅ All authentication system tests passed!")

except Exception as e:
    print(f"\n❌ Test failed: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
