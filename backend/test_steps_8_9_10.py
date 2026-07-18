"""Comprehensive tests for STEPS 8-10 (Scheduled Payments, Notifications, Analytics)"""
import pytest
from datetime import datetime, timedelta
from app import db, create_app
from app.models.user import User, Role
from app.models.account import Account
from app.models.base import ScheduledPayment, Notification
from app.services.scheduled_payment_service import ScheduledPaymentService
from app.services.notification_service import NotificationService
from app.utils.exceptions import ValidationError, ResourceNotFoundError


@pytest.fixture(scope="function")
def app():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        # Create default roles
        from app.models.user import Role
        for role_name in ["customer", "staff", "manager", "admin"]:
            if not Role.query.filter_by(name=role_name).first():
                role = Role(name=role_name, description=f"{role_name} role")
                db.session.add(role)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def user1_id(app):
    with app.app_context():
        from app.models.user import Role
        customer_role = Role.query.filter_by(name="customer").first()
        user = User(username="user1", email="user1@test.com", password_hash="hashed", first_name="User", last_name="One", phone_number="1234567890", role_id=customer_role.id)
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture
def user2_id(app):
    with app.app_context():
        from app.models.user import Role
        customer_role = Role.query.filter_by(name="customer").first()
        user = User(username="user2", email="user2@test.com", password_hash="hashed", first_name="User", last_name="Two", phone_number="0987654321", role_id=customer_role.id)
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture
def account1_id(app, user1_id):
    with app.app_context():
        account = Account(
            account_number="123456789012345678",
            account_type="savings",
            balance=10000,
            user_id=user1_id
        )
        db.session.add(account)
        db.session.commit()
        return account.id


@pytest.fixture
def account2_id(app, user2_id):
    with app.app_context():
        account = Account(
            account_number="987654321098765432",
            account_type="current",
            balance=5000,
            user_id=user2_id
        )
        db.session.add(account)
        db.session.commit()
        return account.id


class TestScheduledPayments:
    """Test STEP 8 - Scheduled Payments"""

    def test_schedule_payment_success(self, app, account1_id):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            payment = ScheduledPaymentService.schedule_payment(
                account_id=account1_id,
                recipient_account_number="987654321098765432",
                amount=500,
                scheduled_date=future_date,
                frequency="once",
                description="Test payment"
            )
            assert payment.id is not None
            assert payment.status == "active"
            assert payment.amount == 500

    def test_schedule_payment_invalid_account(self, app):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            with pytest.raises(ResourceNotFoundError):
                ScheduledPaymentService.schedule_payment(
                    account_id=9999,
                    recipient_account_number="987654321098765432",
                    amount=500,
                    scheduled_date=future_date,
                    frequency="once"
                )

    def test_schedule_payment_invalid_frequency(self, app, account1_id):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            with pytest.raises(ValidationError):
                ScheduledPaymentService.schedule_payment(
                    account_id=account1_id,
                    recipient_account_number="987654321098765432",
                    amount=500,
                    scheduled_date=future_date,
                    frequency="invalid"
                )

    def test_schedule_payment_negative_amount(self, app, account1_id):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            with pytest.raises(ValidationError):
                ScheduledPaymentService.schedule_payment(
                    account_id=account1_id,
                    recipient_account_number="987654321098765432",
                    amount=-100,
                    scheduled_date=future_date,
                    frequency="once"
                )

    def test_schedule_payment_past_date(self, app, account1_id):
        with app.app_context():
            past_date = datetime.utcnow() - timedelta(days=1)
            with pytest.raises(ValidationError):
                ScheduledPaymentService.schedule_payment(
                    account_id=account1_id,
                    recipient_account_number="987654321098765432",
                    amount=500,
                    scheduled_date=past_date,
                    frequency="once"
                )

    def test_get_scheduled_payment(self, app, account1_id):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            payment = ScheduledPaymentService.schedule_payment(
                account_id=account1_id,
                recipient_account_number="987654321098765432",
                amount=500,
                scheduled_date=future_date,
                frequency="once"
            )
            retrieved = ScheduledPaymentService.get_scheduled_payment(payment.id)
            assert retrieved.id == payment.id

    def test_get_nonexistent_payment(self, app):
        with app.app_context():
            with pytest.raises(ResourceNotFoundError):
                ScheduledPaymentService.get_scheduled_payment(9999)

    def test_get_account_scheduled_payments(self, app, account1_id):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            ScheduledPaymentService.schedule_payment(
                account_id=account1_id,
                recipient_account_number="987654321098765432",
                amount=500,
                scheduled_date=future_date,
                frequency="once"
            )
            payments = ScheduledPaymentService.get_account_scheduled_payments(account1_id)
            assert len(payments) == 1

    def test_cancel_payment(self, app, account1_id):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            payment = ScheduledPaymentService.schedule_payment(
                account_id=account1_id,
                recipient_account_number="987654321098765432",
                amount=500,
                scheduled_date=future_date,
                frequency="once"
            )
            cancelled = ScheduledPaymentService.cancel_payment(payment.id, "Not needed")
            assert cancelled.status == "cancelled"
            assert cancelled.cancellation_reason == "Not needed"

    def test_get_statistics(self, app, account1_id):
        with app.app_context():
            future_date = datetime.utcnow() + timedelta(days=7)
            ScheduledPaymentService.schedule_payment(
                account_id=account1_id,
                recipient_account_number="987654321098765432",
                amount=500,
                scheduled_date=future_date,
                frequency="once"
            )
            stats = ScheduledPaymentService.get_statistics()
            assert stats["total"] == 1
            assert stats["active"] == 1


class TestNotifications:
    """Test STEP 9 - Notifications"""

    def test_create_notification(self, app, user1_id):
        with app.app_context():
            notif = NotificationService.create_notification(
                user_id=user1_id,
                title="Test",
                message="Test message"
            )
            assert notif.id is not None
            assert notif.is_read == False

    def test_create_notification_invalid_user(self, app):
        with app.app_context():
            with pytest.raises(ResourceNotFoundError):
                NotificationService.create_notification(
                    user_id=9999,
                    title="Test",
                    message="Test message"
                )

    def test_get_notification(self, app, user1_id):
        with app.app_context():
            notif = NotificationService.create_notification(
                user_id=user1_id,
                title="Test",
                message="Test message"
            )
            retrieved = NotificationService.get_notification(notif.id)
            assert retrieved.id == notif.id

    def test_get_nonexistent_notification(self, app):
        with app.app_context():
            with pytest.raises(ResourceNotFoundError):
                NotificationService.get_notification(9999)

    def test_get_user_notifications(self, app, user1_id):
        with app.app_context():
            NotificationService.create_notification(
                user_id=user1_id,
                title="Test 1",
                message="Message 1"
            )
            NotificationService.create_notification(
                user_id=user1_id,
                title="Test 2",
                message="Message 2"
            )
            notifs = NotificationService.get_user_notifications(user1_id)
            assert len(notifs) == 2

    def test_get_unread_notifications(self, app, user1_id):
        with app.app_context():
            n1 = NotificationService.create_notification(
                user_id=user1_id,
                title="Test 1",
                message="Message 1"
            )
            NotificationService.create_notification(
                user_id=user1_id,
                title="Test 2",
                message="Message 2"
            )
            NotificationService.mark_as_read(n1.id)

            unread = NotificationService.get_user_notifications(user1_id, unread_only=True)
            assert len(unread) == 1

    def test_mark_as_read(self, app, user1_id):
        with app.app_context():
            notif = NotificationService.create_notification(
                user_id=user1_id,
                title="Test",
                message="Message"
            )
            NotificationService.mark_as_read(notif.id)
            retrieved = NotificationService.get_notification(notif.id)
            assert retrieved.is_read == True

    def test_mark_all_as_read(self, app, user1_id):
        with app.app_context():
            NotificationService.create_notification(
                user_id=user1_id,
                title="Test 1",
                message="Message 1"
            )
            NotificationService.create_notification(
                user_id=user1_id,
                title="Test 2",
                message="Message 2"
            )
            NotificationService.mark_all_as_read(user1_id)

            unread = NotificationService.get_user_notifications(user1_id, unread_only=True)
            assert len(unread) == 0

    def test_delete_notification(self, app, user1_id):
        with app.app_context():
            notif = NotificationService.create_notification(
                user_id=user1_id,
                title="Test",
                message="Message"
            )
            NotificationService.delete_notification(notif.id)

            with pytest.raises(ResourceNotFoundError):
                NotificationService.get_notification(notif.id)

    def test_get_notification_statistics(self, app, user1_id):
        with app.app_context():
            n1 = NotificationService.create_notification(
                user_id=user1_id,
                title="Test 1",
                message="Message 1"
            )
            NotificationService.create_notification(
                user_id=user1_id,
                title="Test 2",
                message="Message 2"
            )
            NotificationService.mark_as_read(n1.id)

            stats = NotificationService.get_statistics(user1_id)
            assert stats["total"] == 2
            assert stats["unread"] == 1
            assert stats["read"] == 1

    def test_send_transaction_notification(self, app, user1_id):
        with app.app_context():
            notif = NotificationService.send_transaction_notification(
                user_id=user1_id,
                transaction_type="deposit",
                amount=1000
            )
            assert notif.title == "Deposit Alert"

    def test_send_approval_notification(self, app, user1_id):
        with app.app_context():
            notif = NotificationService.send_approval_notification(
                user_id=user1_id,
                item_type="loan",
                status="approved"
            )
            assert notif.title == "Loan Approved"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
