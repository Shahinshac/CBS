import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

function randomAccount() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

function randomCard() {
  return '4111' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
}

async function main() {
  console.log('🏦 Seeding Enterprise Core Banking Database...');

  // ─── Clean existing data ───────────────────────────────────────────────────
  await prisma.$transaction([
    prisma.announcement.deleteMany(),
    prisma.cashDrawer.deleteMany(),
    prisma.chequeStop.deleteMany(),
    prisma.chequebookRequest.deleteMany(),
    prisma.bill.deleteMany(),
    prisma.scheduledPayment.deleteMany(),
    prisma.beneficiary.deleteMany(),
    prisma.loanRepayment.deleteMany(),
    prisma.loan.deleteMany(),
    prisma.card.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.account.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.supportTicket.deleteMany(),
    prisma.user.deleteMany(),
    prisma.branch.deleteMany(),
  ]);

  // ─── Branches ─────────────────────────────────────────────────────────────
  const branch1 = await prisma.branch.create({
    data: {
      name: 'Head Office — Mumbai Main',
      code: 'MUM001',
      address: '14, Nariman Point, Fort',
      city: 'Mumbai',
      phone: '+91-22-6600-1000',
      email: 'headoffice@corebank.in',
      is_active: true,
    },
  });

  const branch2 = await prisma.branch.create({
    data: {
      name: 'Delhi Connaught Place',
      code: 'DEL001',
      address: 'Block A, Connaught Place',
      city: 'New Delhi',
      phone: '+91-11-2341-5678',
      email: 'delhi.cp@corebank.in',
      is_active: true,
    },
  });

  const branch3 = await prisma.branch.create({
    data: {
      name: 'Bangalore Koramangala',
      code: 'BLR001',
      address: '5th Block, Koramangala',
      city: 'Bangalore',
      phone: '+91-80-4612-3456',
      email: 'blr.koramangala@corebank.in',
      is_active: true,
    },
  });

  console.log('✅ Branches created');

  // ─── Super Admin ──────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.create({
    data: {
      username: 'superadmin',
      email: 'admin@corebank.in',
      password_hash: await hashPassword('Admin@1234'),
      first_name: 'Rajesh',
      last_name: 'Gupta',
      role: 'super_admin',
      phone_number: '+91-9900001234',
      date_of_birth: new Date('1975-03-15'),
      address: '14, Nariman Point, Fort',
      city: 'Mumbai',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch1.id,
    },
  });

  // ─── Branch Managers ──────────────────────────────────────────────────────
  const manager1 = await prisma.user.create({
    data: {
      username: 'mgr_mumbai',
      email: 'manager.mumbai@corebank.in',
      password_hash: await hashPassword('Manager@123'),
      first_name: 'Priya',
      last_name: 'Sharma',
      role: 'branch_manager',
      phone_number: '+91-9900002001',
      date_of_birth: new Date('1980-07-22'),
      address: '14, Nariman Point',
      city: 'Mumbai',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch1.id,
    },
  });

  const manager2 = await prisma.user.create({
    data: {
      username: 'mgr_delhi',
      email: 'manager.delhi@corebank.in',
      password_hash: await hashPassword('Manager@123'),
      first_name: 'Arvind',
      last_name: 'Kumar',
      role: 'branch_manager',
      phone_number: '+91-9900002002',
      date_of_birth: new Date('1978-11-05'),
      address: 'Block A, Connaught Place',
      city: 'New Delhi',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch2.id,
    },
  });

  // Update branches with manager IDs
  await prisma.branch.update({ where: { id: branch1.id }, data: { manager_id: manager1.id } });
  await prisma.branch.update({ where: { id: branch2.id }, data: { manager_id: manager2.id } });

  // ─── Tellers ─────────────────────────────────────────────────────────────
  const teller1 = await prisma.user.create({
    data: {
      username: 'teller_sunita',
      email: 'teller1@corebank.in',
      password_hash: await hashPassword('Teller@123'),
      first_name: 'Sunita',
      last_name: 'Verma',
      role: 'teller',
      phone_number: '+91-9900003001',
      date_of_birth: new Date('1992-04-18'),
      city: 'Mumbai',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch1.id,
    },
  });

  const teller2 = await prisma.user.create({
    data: {
      username: 'teller_ramesh',
      email: 'teller2@corebank.in',
      password_hash: await hashPassword('Teller@123'),
      first_name: 'Ramesh',
      last_name: 'Patel',
      role: 'teller',
      phone_number: '+91-9900003002',
      date_of_birth: new Date('1990-09-30'),
      city: 'New Delhi',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch2.id,
    },
  });

  // ─── Loan Officers ────────────────────────────────────────────────────────
  const loanOfficer = await prisma.user.create({
    data: {
      username: 'loan_officer_ananya',
      email: 'loanoffice@corebank.in',
      password_hash: await hashPassword('Loan@1234'),
      first_name: 'Ananya',
      last_name: 'Singh',
      role: 'loan_officer',
      phone_number: '+91-9900004001',
      date_of_birth: new Date('1988-02-14'),
      city: 'Mumbai',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch1.id,
    },
  });

  // ─── Customer Support ─────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      username: 'support_rahul',
      email: 'support@corebank.in',
      password_hash: await hashPassword('Support@123'),
      first_name: 'Rahul',
      last_name: 'Mehta',
      role: 'customer_support',
      phone_number: '+91-9900005001',
      date_of_birth: new Date('1995-06-20'),
      city: 'Mumbai',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch1.id,
    },
  });

  // ─── Auditor ──────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      username: 'auditor_neha',
      email: 'audit@corebank.in',
      password_hash: await hashPassword('Audit@1234'),
      first_name: 'Neha',
      last_name: 'Joshi',
      role: 'auditor',
      phone_number: '+91-9900006001',
      date_of_birth: new Date('1985-12-10'),
      city: 'Mumbai',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch1.id,
    },
  });

  console.log('✅ Staff users created');

  // ─── Customers ────────────────────────────────────────────────────────────
  const customerData = [
    {
      first_name: 'Aditya', last_name: 'Rao',
      email: 'aditya.rao@gmail.com', phone: '+91-9876543210',
      dob: new Date('1990-05-15'), city: 'Mumbai',
      branch_id: branch1.id, username: 'aditya_rao',
    },
    {
      first_name: 'Meera', last_name: 'Nair',
      email: 'meera.nair@gmail.com', phone: '+91-9876543211',
      dob: new Date('1985-08-22'), city: 'Mumbai',
      branch_id: branch1.id, username: 'meera_nair',
    },
    {
      first_name: 'Vikram', last_name: 'Bose',
      email: 'vikram.bose@gmail.com', phone: '+91-9876543212',
      dob: new Date('1978-12-01'), city: 'New Delhi',
      branch_id: branch2.id, username: 'vikram_bose',
    },
    {
      first_name: 'Prithvi', last_name: 'Reddy',
      email: 'prithvi.reddy@gmail.com', phone: '+91-9876543213',
      dob: new Date('1995-03-17'), city: 'Bangalore',
      branch_id: branch3.id, username: 'prithvi_reddy',
    },
    {
      first_name: 'Shreya', last_name: 'Kapoor',
      email: 'shreya.kapoor@gmail.com', phone: '+91-9876543214',
      dob: new Date('1992-11-30'), city: 'Mumbai',
      branch_id: branch1.id, username: 'shreya_kapoor',
    },
  ];

  const customers = [];
  for (const c of customerData) {
    const user = await prisma.user.create({
      data: {
        username: c.username,
        email: c.email,
        password_hash: await hashPassword('Customer@123'),
        first_name: c.first_name,
        last_name: c.last_name,
        role: 'customer',
        phone_number: c.phone,
        date_of_birth: c.dob,
        address: `${Math.floor(Math.random() * 100) + 1}, Sample Street`,
        city: c.city,
        is_active: true,
        is_verified: true,
        kyc_status: 'verified',
        branch_id: c.branch_id,
      },
    });
    customers.push(user);
  }

  console.log('✅ Customers created');

  // ─── Accounts ─────────────────────────────────────────────────────────────
  const accountBalances = [125000, 87500, 245000, 34000, 562000];
  const createdAccounts = [];

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const accNum = randomAccount();
    const balance = accountBalances[i];

    const account = await prisma.account.create({
      data: {
        account_number: accNum,
        account_type: 'savings',
        balance: balance,
        status: 'active',
        interest_rate: 3.5,
        minimum_balance: 1000,
        user_id: customer.id,
        branch_id: customer.branch_id,
      },
    });
    createdAccounts.push(account);

    // ATM/Debit card for each account
    const cardNum = randomCard();
    await prisma.card.create({
      data: {
        card_number: cardNum,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        expiry_date: '12/30',
        card_holder: `${customer.first_name.toUpperCase()} ${customer.last_name.toUpperCase()}`,
        card_type: 'debit',
        card_status: 'active',
        is_blocked: false,
        daily_limit: 50000,
        account_id: account.id,
      },
    });

    // Welcome notification
    await prisma.notification.create({
      data: {
        user_id: customer.id,
        title: 'Welcome to CoreBank!',
        message: `Your savings account ${accNum} has been activated. Download the app or use Net Banking to manage your finances.`,
        type: 'success',
      },
    });
  }

  // Create a current account for customer[0]
  const currentAccNum = randomAccount();
  const currentAccount = await prisma.account.create({
    data: {
      account_number: currentAccNum,
      account_type: 'current',
      balance: 500000,
      status: 'active',
      interest_rate: 2.5,
      minimum_balance: 10000,
      user_id: customers[0].id,
      branch_id: branch1.id,
    },
  });
  createdAccounts.push(currentAccount);

  // FD account for customer[1]
  const fdAccNum = 'FD' + Math.floor(10000000 + Math.random() * 90000000);
  await prisma.account.create({
    data: {
      account_number: fdAccNum,
      account_type: 'fd',
      balance: 200000,
      status: 'active',
      interest_rate: 7.25,
      fd_tenure_months: 12,
      fd_maturity_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      user_id: customers[1].id,
      branch_id: branch1.id,
    },
  });

  console.log('✅ Accounts and cards created');

  // ─── Transactions (historical) ────────────────────────────────────────────
  const txTypes = [
    { type: 'deposit', desc: 'Salary Credit', amount: 85000, to_idx: 0 },
    { type: 'deposit', desc: 'Cash Deposit', amount: 15000, to_idx: 0 },
    { type: 'withdrawal', desc: 'ATM Withdrawal', amount: 10000, from_idx: 0 },
    { type: 'transfer', desc: 'NEFT Transfer', amount: 25000, from_idx: 0, to_idx: 1 },
    { type: 'deposit', desc: 'Salary Credit', amount: 65000, to_idx: 1 },
    { type: 'withdrawal', desc: 'Bill Payment', amount: 3500, from_idx: 1 },
    { type: 'deposit', desc: 'Business Income', amount: 120000, to_idx: 2 },
    { type: 'transfer', desc: 'Fund Transfer', amount: 50000, from_idx: 2, to_idx: 3 },
    { type: 'deposit', desc: 'Salary Credit', amount: 42000, to_idx: 3 },
    { type: 'withdrawal', desc: 'ATM Withdrawal', amount: 5000, from_idx: 3 },
    { type: 'deposit', desc: 'Salary Credit', amount: 155000, to_idx: 4 },
    { type: 'withdrawal', desc: 'Online Shopping', amount: 12000, from_idx: 4 },
  ];

  for (const tx of txTypes) {
    await prisma.transaction.create({
      data: {
        amount: tx.amount,
        transaction_type: tx.type,
        status: 'success',
        description: tx.desc,
        channel: tx.type === 'deposit' ? 'branch' : tx.type === 'withdrawal' ? 'atm' : 'net_banking',
        from_account_id: tx.from_idx !== undefined ? createdAccounts[tx.from_idx].id : null,
        to_account_id: tx.to_idx !== undefined ? createdAccounts[tx.to_idx].id : null,
        performed_by: teller1.id,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('✅ Transaction history created');

  // ─── Loans ────────────────────────────────────────────────────────────────
  const loan1 = await prisma.loan.create({
    data: {
      amount: 500000,
      approved_amount: 500000,
      duration_months: 60,
      rate: 9.5,
      loan_type: 'home',
      status: 'disbursed',
      purpose: 'Home renovation',
      credit_score: 750,
      approved_by: loanOfficer.id,
      disbursed_amount: 500000,
      disbursed_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      user_id: customers[0].id,
    },
  });

  // Generate repayment schedule for loan1
  const emi = ((500000 * 9.5/100/12) * Math.pow(1 + 9.5/100/12, 60)) / (Math.pow(1 + 9.5/100/12, 60) - 1);
  let outstanding = 500000;
  for (let m = 1; m <= 12; m++) {
    const interest = outstanding * (9.5/100/12);
    const principal = emi - interest;
    outstanding -= principal;
    const dueDate = new Date(Date.now() - (90 - m * 30) * 24 * 60 * 60 * 1000);
    await prisma.loanRepayment.create({
      data: {
        loan_id: loan1.id,
        emi_amount: Math.round(emi),
        principal: Math.round(principal),
        interest: Math.round(interest),
        due_date: dueDate,
        paid_date: m <= 3 ? dueDate : null,
        status: m <= 3 ? 'paid' : m <= 4 ? 'pending' : 'pending',
      },
    });
  }

  const loan2 = await prisma.loan.create({
    data: {
      amount: 200000,
      duration_months: 36,
      rate: 11.5,
      loan_type: 'personal',
      status: 'pending',
      purpose: 'Medical expenses',
      credit_score: 680,
      user_id: customers[2].id,
    },
  });

  const loan3 = await prisma.loan.create({
    data: {
      amount: 750000,
      duration_months: 84,
      rate: 8.75,
      loan_type: 'vehicle',
      status: 'under_review',
      purpose: 'Car purchase',
      credit_score: 720,
      user_id: customers[3].id,
    },
  });

  // Loan notifications
  await prisma.notification.create({
    data: {
      user_id: customers[0].id,
      title: 'Home Loan Disbursed',
      message: `Your home loan of ₹5,00,000 has been disbursed to your account. EMI of ₹${Math.round(emi).toLocaleString('en-IN')} will be debited on the 5th of every month.`,
      type: 'success',
    },
  });

  await prisma.notification.create({
    data: {
      user_id: customers[2].id,
      title: 'Loan Application Received',
      message: 'Your personal loan application of ₹2,00,000 is under review. We will notify you within 3 business days.',
      type: 'info',
    },
  });

  console.log('✅ Loans and repayments created');

  // ─── Beneficiaries ────────────────────────────────────────────────────────
  await prisma.beneficiary.create({
    data: {
      name: 'Meera Nair',
      account_number: createdAccounts[1].account_number,
      bank_name: 'CoreBank',
      ifsc_code: 'CRBN0001001',
      nickname: 'Meera',
      user_id: customers[0].id,
    },
  });

  await prisma.beneficiary.create({
    data: {
      name: 'Vikram Bose',
      account_number: createdAccounts[2].account_number,
      bank_name: 'CoreBank',
      ifsc_code: 'CRBN0001002',
      nickname: 'Vikram',
      user_id: customers[0].id,
    },
  });

  // ─── Bills ────────────────────────────────────────────────────────────────
  await prisma.bill.create({
    data: {
      biller_name: 'Electricity Board Mumbai',
      biller_category: 'utility',
      consumer_number: 'MH123456789',
      amount: 2450,
      due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'pending',
      account_id: createdAccounts[0].id,
    },
  });

  await prisma.bill.create({
    data: {
      biller_name: 'Airtel Mobile',
      biller_category: 'mobile',
      consumer_number: '9876543210',
      amount: 599,
      due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'pending',
      account_id: createdAccounts[0].id,
    },
  });

  // ─── Announcements ────────────────────────────────────────────────────────
  await prisma.announcement.create({
    data: {
      title: 'System Maintenance — Sunday 2 AM to 4 AM',
      content: 'CoreBank systems will undergo scheduled maintenance this Sunday from 2:00 AM to 4:00 AM IST. Net Banking and mobile services will be unavailable during this period.',
      target_roles: 'all',
      is_active: true,
      created_by: superAdmin.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.announcement.create({
    data: {
      title: 'New Fixed Deposit Rates Effective August 1, 2026',
      content: 'Revised FD interest rates: 1 year — 7.50%, 2 years — 7.75%, 3 years — 8.00%. Senior citizens get an additional 0.25% p.a.',
      target_roles: 'customer',
      is_active: true,
      created_by: superAdmin.id,
    },
  });

  // ─── Support Tickets ─────────────────────────────────────────────────────
  await prisma.supportTicket.create({
    data: {
      subject: 'Unable to download statement',
      description: 'I am trying to download my account statement for June 2026 but the download button is not working.',
      priority: 'medium',
      status: 'open',
      category: 'account',
      user_id: customers[1].id,
    },
  });

  await prisma.supportTicket.create({
    data: {
      subject: 'Card blocked by mistake',
      description: 'My debit card got blocked. I need it unblocked urgently for an online purchase.',
      priority: 'high',
      status: 'in_progress',
      category: 'card',
      user_id: customers[2].id,
    },
  });

  // ─── Audit Logs ───────────────────────────────────────────────────────────
  const auditActions = [
    { user_id: superAdmin.id, role: 'super_admin', action: 'System initialized — seed data loaded', module: 'system' },
    { user_id: manager1.id, role: 'branch_manager', action: 'Branch dashboard accessed', module: 'dashboard' },
    { user_id: teller1.id, role: 'teller', action: `Deposit ₹85,000 to account ${createdAccounts[0].account_number}`, module: 'transactions' },
    { user_id: teller1.id, role: 'teller', action: `New customer onboarded: ${customers[0].first_name} ${customers[0].last_name}`, module: 'customers' },
    { user_id: loanOfficer.id, role: 'loan_officer', action: `Home loan ₹5,00,000 approved for ${customers[0].first_name} ${customers[0].last_name}`, module: 'loans' },
    { user_id: customers[0].id, role: 'customer', action: 'Net Banking login', module: 'auth' },
    { user_id: customers[0].id, role: 'customer', action: `Fund transfer ₹25,000 to ${customers[1].first_name} ${customers[1].last_name}`, module: 'transactions' },
  ];

  for (const a of auditActions) {
    await prisma.auditLog.create({
      data: {
        user_id: a.user_id,
        role: a.role,
        action: a.action,
        module: a.module,
        ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        status: 'success',
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('✅ Audit logs created');

  // ─── Cash Drawer ──────────────────────────────────────────────────────────
  await prisma.cashDrawer.create({
    data: {
      teller_id: teller1.id,
      branch_id: branch1.id,
      opening_balance: 200000,
      closing_balance: 185000,
      denominations: JSON.stringify({ '2000': 10, '500': 50, '200': 50, '100': 100, '50': 100, '20': 50, '10': 100 }),
      opened_at: new Date(new Date().setHours(9, 0, 0, 0)),
      closed_at: new Date(new Date().setHours(17, 0, 0, 0)),
      status: 'closed',
    },
  });

  // ─── Cheque Book Request ──────────────────────────────────────────────────
  await prisma.chequebookRequest.create({
    data: {
      account_id: createdAccounts[0].id,
      leaves: 25,
      status: 'dispatched',
      address: '14, Sample Street, Mumbai - 400001',
      tracking_no: 'TRACK123456789',
    },
  });

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('📋 LOGIN CREDENTIALS');
  console.log('═══════════════════════════════════════════════════');
  console.log('Super Admin    → superadmin / Admin@1234');
  console.log('Branch Manager → mgr_mumbai / Manager@123');
  console.log('Branch Manager → mgr_delhi / Manager@123');
  console.log('Teller         → teller_sunita / Teller@123');
  console.log('Loan Officer   → loan_officer_ananya / Loan@1234');
  console.log('Customer       → aditya_rao / Customer@123');
  console.log('Customer       → meera_nair / Customer@123');
  console.log('Customer       → vikram_bose / Customer@123');
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
