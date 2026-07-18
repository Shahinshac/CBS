"""
Create admin user for the banking system using SQLAlchemy
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models.user import User, Role
from app.utils.security import PasswordSecurity

app = create_app()

with app.app_context():
    # Make sure all tables are created
    db.create_all()

    try:
        # Create roles if they don't exist
        roles = {
            'super_admin': 'Super Administrator with full control',
            'admin': 'Legacy Administrator',
            'branch_manager': 'Branch Manager with local verification authority',
            'teller': 'Teller/Cashier for transactions',
            'loan_officer': 'Loan Officer for processing credit/EMI',
            'customer_support': 'Support staff for ticketing and profile updates',
            'auditor': 'Auditor with read-only inspection access',
            'customer': 'Regular retail banking customer'
        }

        role_objs = {}
        for r_name, r_desc in roles.items():
            role_obj = Role.query.filter_by(name=r_name).first()
            if not role_obj:
                role_obj = Role(name=r_name, description=r_desc)
                db.session.add(role_obj)
                db.session.flush() # Populate ID
                print(f"✅ Created role: {r_name}")
            else:
                print(f"⚠️  Role {r_name} already exists")
            role_objs[r_name] = role_obj

        db.session.commit()

        # Create super_admin user
        super_admin = User.query.filter_by(username='shahinsha').first()
        if super_admin:
            print("\n⚠️  Super Admin user already exists")
        else:
            password_hash = PasswordSecurity.hash_password('262007')
            super_admin = User(
                username='shahinsha',
                email='admin@26-07-reserve.bank',
                first_name='Shahinsha',
                last_name='Admin',
                phone_number='+91-9999999999',
                password_hash=password_hash,
                role_id=role_objs['super_admin'].id,
                is_active=True,
                is_verified=True,
                is_first_login=False
            )
            db.session.add(super_admin)
            db.session.commit()
            print("\n✅ Super Admin user created successfully!")
            print("   Username: shahinsha")
            print("   Password: 262007")
            print("   Email: admin@26-07-reserve.bank")
            print("   Role: super_admin")

        print("\n✅ Database setup complete!")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        db.session.rollback()
        import traceback
        traceback.print_exc()
