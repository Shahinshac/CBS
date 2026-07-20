import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log('🏦 Seeding Enterprise Core Banking Database (Clean Mode)...');

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

  console.log('✅ Default Branch created');

  // ─── Super Admin ──────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.create({
    data: {
      username: 'shahinsha',
      email: 'shahinsha@corebank.in',
      password_hash: await hashPassword('262007'),
      first_name: 'Shahinsha',
      last_name: 'Admin',
      role: 'super_admin',
      phone_number: '+91-9900001234',
      date_of_birth: new Date('2000-01-01'),
      address: 'Head Office',
      city: 'Mumbai',
      is_active: true,
      is_verified: true,
      kyc_status: 'verified',
      branch_id: branch1.id,
    },
  });

  console.log('✅ Super Admin created');
  console.log('\n🎉 Database cleared and seeded successfully!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('📋 LOGIN CREDENTIALS');
  console.log('═══════════════════════════════════════════════════');
  console.log('Super Admin    → shahinsha / 262007');
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
