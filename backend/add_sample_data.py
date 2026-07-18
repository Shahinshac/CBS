#!/usr/bin/env python
"""
Test and populate MongoDB with sample data for admin user
"""
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Initialize MongoDB connection
from mongoengine import connect
from app.models.user import User, Role, RoleEnum
from app.models.account import Account
from app.models.transaction import Transaction, TransactionTypeEnum, TransactionStatusEnum
from datetime import datetime, timedelta
from decimal import Decimal

mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/bankmanagement")
mongodb_db = os.getenv("MONGODB_DB", "bankmanagement")

try:
    connect(db=mongodb_db, host=mongodb_uri)
    print("✓ Connected to MongoDB")
except Exception as e:
    print(f"✗ Failed to connect: {e}")
    sys.exit(1)

# Find admin user
admin = User.objects(username="shahinsha").first()
if not admin:
    print("✗ Admin user not found!")
    sys.exit(1)

print(f"✓ Found admin user: {admin.username} ({admin.email})")
print(f"  ID: {admin.id}")

# Create sample accounts
try:
    account1 = Account.objects(user_id=admin.id, account_number="ACC-001").first()
    if not account1:
        account1 = Account(
            account_number="ACC-001",
            account_type="savings",
            balance=Decimal("50000.00"),
            status="active",
            user_id=admin
        )
        account1.save()
        print(f"✓ Created Savings Account: ACC-001 (₹50,000)")
    else:
        print(f"✓ Account exists: ACC-001")

    account2 = Account.objects(user_id=admin.id, account_number="ACC-002").first()
    if not account2:
        account2 = Account(
            account_number="ACC-002",
            account_type="current",
            balance=Decimal("100000.00"),
            status="active",
            user_id=admin
        )
        account2.save()
        print(f"✓ Created Current Account: ACC-002 (₹100,000)")
    else:
        print(f"✓ Account exists: ACC-002")

except Exception as e:
    print(f"✗ Failed to create accounts: {e}")
    sys.exit(1)

# Create sample transactions
try:
    now = datetime.utcnow()

    # Transaction 1: Deposit
    tx1 = Transaction.objects(reference_id="TXN-001").first()
    if not tx1:
        tx1 = Transaction(
            reference_id="TXN-001",
            transaction_type=TransactionTypeEnum.DEPOSIT.value,
            status=TransactionStatusEnum.SUCCESS.value,
            amount=Decimal("25000.00"),
            description="Initial deposit",
            account_id=account1,
            user_id=admin,
            created_at=now - timedelta(days=5)
        )
        tx1.save()
        print(f"✓ Created transaction: TXN-001 (Deposit ₹25,000)")
    else:
        print(f"✓ Transaction exists: TXN-001")

    # Transaction 2: Withdrawal
    tx2 = Transaction.objects(reference_id="TXN-002").first()
    if not tx2:
        tx2 = Transaction(
            reference_id="TXN-002",
            transaction_type=TransactionTypeEnum.WITHDRAWAL.value,
            status=TransactionStatusEnum.SUCCESS.value,
            amount=Decimal("5000.00"),
            description="ATM withdrawal",
            account_id=account1,
            user_id=admin,
            created_at=now - timedelta(days=3)
        )
        tx2.save()
        print(f"✓ Created transaction: TXN-002 (Withdrawal ₹5,000)")
    else:
        print(f"✓ Transaction exists: TXN-002")

    # Transaction 3: Transfer
    tx3 = Transaction.objects(reference_id="TXN-003").first()
    if not tx3:
        tx3 = Transaction(
            reference_id="TXN-003",
            transaction_type=TransactionTypeEnum.TRANSFER.value,
            status=TransactionStatusEnum.SUCCESS.value,
            amount=Decimal("15000.00"),
            description="Transfer to current account",
            account_id=account1,
            recipient_account_id=account2,
            user_id=admin,
            created_at=now - timedelta(days=1)
        )
        tx3.save()
        print(f"✓ Created transaction: TXN-003 (Transfer ₹15,000)")
    else:
        print(f"✓ Transaction exists: TXN-003")

except Exception as e:
    print(f"✗ Failed to create transactions: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "="*50)
print("✓ All sample data created successfully!")
print("="*50)
print("\nYour admin account now has:")
print(f"  • 2 Bank Accounts (Savings + Current)")
print(f"  • 3 Sample Transactions")
print(f"\nLogin with credentials:")
print(f"  Username: shahinsha")
print(f"  Password: 262007")
print(f"\nThe dashboard will now show accounts and transactions!")
