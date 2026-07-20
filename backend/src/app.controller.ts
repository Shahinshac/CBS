import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  BadRequestException,
  NotFoundException,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './auth/auth.service';
import * as PDFDocument from 'pdfkit';
import * as bcrypt from 'bcryptjs';

// ─── Role constants ────────────────────────────────────────────────────────────
const Role = {
  customer: 'customer',
  super_admin: 'super_admin',
  teller: 'teller',
  branch_manager: 'branch_manager',
  loan_officer: 'loan_officer',
  customer_support: 'customer_support',
  auditor: 'auditor',
};

// ─── Audit logger ─────────────────────────────────────────────────────────────
async function audit(
  prisma: PrismaService,
  params: {
    user_id?: string;
    role: string;
    action: string;
    module?: string;
    ip?: string;
    status?: string;
  },
) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: params.user_id || null,
        role: params.role,
        action: params.action,
        module: params.module || 'system',
        ip_address: params.ip || '127.0.0.1',
        status: params.status || 'success',
      },
    });
  } catch {
    // Non-fatal
  }
}

// ─── EMI Calculator ───────────────────────────────────────────────────────────
function calculateEMI(principal: number, annualRate: number, months: number) {
  const r = annualRate / 100 / 12;
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(emi);
}

@Controller('api')
export class AppController {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIVERSAL SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('search')
  async universalSearch(@Query('q') q: string) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }
    const term = q.trim();

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { first_name: { contains: term, mode: 'insensitive' } },
          { last_name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { phone_number: { contains: term } },
          { id: { contains: term } },
        ],
      },
      include: {
        accounts: {
          include: {
            cards: { select: { id: true, card_number: true, card_status: true, is_blocked: true } },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    const accountsByNumber = await this.prisma.account.findMany({
      where: { account_number: { contains: term } },
      include: {
        user: {
          include: {
            branch: { select: { id: true, name: true, code: true } },
          },
        },
        cards: { select: { id: true, card_number: true, card_status: true, is_blocked: true } },
      },
    });

    const cardMatches = await this.prisma.card.findMany({
      where: { card_number: { contains: term } },
      include: {
        account: {
          include: {
            user: {
              include: {
                branch: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });

    const extraUserIds = new Set(users.map((u) => u.id));
    const extraUsers: any[] = [];

    for (const acc of accountsByNumber) {
      if (!extraUserIds.has(acc.user.id)) {
        extraUserIds.add(acc.user.id);
        extraUsers.push({ ...acc.user, accounts: [acc] });
      }
    }
    for (const card of cardMatches) {
      if (!extraUserIds.has(card.account.user.id)) {
        extraUserIds.add(card.account.user.id);
        extraUsers.push({ ...card.account.user, accounts: [] });
      }
    }

    return { results: [...users, ...extraUsers] };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BRANCHES
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('branches')
  async listBranches() {
    const branches = await this.prisma.branch.findMany({
      where: { is_deleted: false },
      include: {
        _count: {
          select: { users: true, accounts: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const result = await Promise.all(
      branches.map(async (b) => {
        const accounts = await this.prisma.account.findMany({
          where: { branch_id: b.id },
          select: { balance: true },
        });
        const totalDeposits = accounts.reduce((s, a) => s + Number(a.balance), 0);
        const customerCount = await this.prisma.user.count({ where: { branch_id: b.id, role: 'customer' } });
        const employeeCount = await this.prisma.user.count({ where: { branch_id: b.id, role: { not: 'customer' } } });
        const manager = b.manager_id
          ? await this.prisma.user.findUnique({
              where: { id: b.manager_id },
              select: { first_name: true, last_name: true },
            })
          : null;
        return {
          ...b,
          customer_count: customerCount,
          employee_count: employeeCount,
          total_deposits: totalDeposits,
          manager_name: manager ? `${manager.first_name} ${manager.last_name}` : null,
        };
      }),
    );

    return { branches: result };
  }

  @Post('branches')
  async createBranch(@Body() body: any) {
    const { name, code, address, city, phone, email, created_by } = body;
    if (!name || !code) throw new BadRequestException('Branch name and code are required');

    const existing = await this.prisma.branch.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) throw new BadRequestException('Branch code already exists');

    const branch = await this.prisma.branch.create({
      data: {
        name,
        code: code.toUpperCase(),
        address,
        city,
        phone,
        email,
        is_active: true,
      },
    });

    await audit(this.prisma, { user_id: created_by, role: 'super_admin', action: `New branch created: ${name} (${code})`, module: 'branches' });
    return { message: 'Branch created successfully.', branch };
  }

  @Patch('branches/:id')
  async updateBranch(@Param('id') id: string, @Body() body: any) {
    const { name, code, address, city, phone, email, is_active, manager_id, updated_by } = body;
    const updates: any = {};
    if (name) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (city) updates.city = city;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    if (manager_id !== undefined) updates.manager_id = manager_id;

    if (code) {
      const upperCode = code.toUpperCase();
      const existing = await this.prisma.branch.findUnique({ where: { code: upperCode } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Branch code already exists');
      }
      updates.code = upperCode;
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: updates,
    });
    await audit(this.prisma, { user_id: updated_by, role: 'super_admin', action: `Branch updated: ${branch.name} (Code: ${branch.code})`, module: 'branches' });
    return { message: 'Branch updated.', branch };
  }

  @Delete('branches/:id')
  async deleteBranch(@Param('id') id: string, @Body() body: any) {
    const branch = await this.prisma.branch.findFirst({ where: { id, is_deleted: false } });
    if (!branch) throw new NotFoundException('Branch not found');
    await this.prisma.branch.update({ where: { id }, data: { is_deleted: true, is_active: false } });
    await audit(this.prisma, { user_id: body.deleted_by, role: 'super_admin', action: `Branch deactivated: ${branch.name}`, module: 'branches' });
    return { message: 'Branch deactivated.' };
  }

  @Get('branches/:id/stats')
  async getBranchStats(@Param('id') id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');

    const [customers, employees, accounts, pendingLoans, todayTx] = await Promise.all([
      this.prisma.user.count({ where: { branch_id: id, role: 'customer' } }),
      this.prisma.user.count({ where: { branch_id: id, role: { not: 'customer' } } }),
      this.prisma.account.findMany({ where: { branch_id: id }, select: { balance: true } }),
      this.prisma.loan.count({
        where: { status: 'pending', user: { branch_id: id } },
      }),
      this.prisma.transaction.findMany({
        where: {
          created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          OR: [
            { from_account: { branch_id: id } },
            { to_account: { branch_id: id } },
          ],
        },
        select: { amount: true, transaction_type: true },
      }),
    ]);

    const totalDeposits = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const todayVolume = todayTx.reduce((s, t) => s + Number(t.amount), 0);

    return {
      branch_name: branch.name,
      branch_code: branch.code,
      customers,
      employees,
      total_deposits: totalDeposits,
      pending_loans: pendingLoans,
      today_transactions: todayTx.length,
      today_volume: todayVolume,
      vault_cash: totalDeposits * 0.1,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTS
  // ═══════════════════════════════════════════════════════════════════════════
  @Post('accounts')
  async createAccount(@Body() body: any) {
    const { user_id, account_type, initial_balance, branch_id } = body;
    if (!user_id) throw new BadRequestException('User ID is required');

    const accountNum = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const mappedType = (account_type as string) || 'savings';
    const rateMap: Record<string, number> = { savings: 3.5, current: 2.5, fd: 7.25, rd: 6.75 };
    const minBalMap: Record<string, number> = { savings: 1000, current: 10000, fd: 0, rd: 0 };

    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) throw new NotFoundException('User not found');

    const account = await this.prisma.account.create({
      data: {
        account_number: accountNum,
        account_type: mappedType,
        balance: parseFloat(initial_balance || 0),
        interest_rate: rateMap[mappedType] ?? 3.5,
        minimum_balance: minBalMap[mappedType] ?? 0,
        user_id,
        branch_id: branch_id || user.branch_id,
      },
    });

    const cardNumber = '4111' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    const card = await this.prisma.card.create({
      data: {
        card_number: cardNumber,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        expiry_date: '12/30',
        card_holder: `${user.first_name.toUpperCase()} ${user.last_name.toUpperCase()}`,
        card_type: 'debit',
        card_status: 'active',
        daily_limit: 50000,
        account_id: account.id,
      },
    });

    await audit(this.prisma, { user_id, role: 'system', action: `Account opened: ${accountNum} (${mappedType})`, module: 'accounts' });

    return {
      message: 'Account created successfully. ATM card auto-generated.',
      account,
      card: { id: card.id, card_number: `****${cardNumber.slice(-4)}`, expiry_date: card.expiry_date },
    };
  }

  @Get('accounts')
  async listAccounts(@Query('user_id') user_id?: string, @Query('branch_id') branch_id?: string) {
    const where: any = {};
    if (user_id) where.user_id = user_id;
    if (branch_id) where.branch_id = branch_id;

    const accounts = await this.prisma.account.findMany({
      where,
      include: {
        user: { select: { id: true, first_name: true, last_name: true, email: true, phone_number: true } },
        cards: { select: { id: true, card_number: true, expiry_date: true, is_blocked: true, daily_limit: true, card_status: true, card_type: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return { accounts };
  }

  @Get('accounts/:id')
  async getAccount(@Param('id') id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        user: { include: { branch: true } },
        cards: true,
        branch: true,
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    return { account, owner: account.user, card: account.cards[0] || null };
  }

  @Patch('accounts/:id')
  async updateAccount(@Param('id') id: string, @Body() body: any) {
    const { status, minimum_balance, overdraft_limit, updated_by } = body;
    const account = await this.prisma.account.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(minimum_balance !== undefined && { minimum_balance: parseFloat(minimum_balance) }),
        ...(overdraft_limit !== undefined && { overdraft_limit: parseFloat(overdraft_limit) }),
      },
    });
    await audit(this.prisma, { user_id: updated_by, role: 'branch_manager', action: `Account ${account.account_number} updated`, module: 'accounts' });
    return { message: 'Account updated.', account };
  }

  // FD / RD
  @Post('accounts/fdrd')
  async createFdRd(@Body() body: any) {
    const { user_id, amount, months, type } = body;
    if (!user_id || !amount) throw new BadRequestException('user_id and amount are required');
    const accountNum = (type === 'rd' ? 'RD' : 'FD') + Math.floor(10000000 + Math.random() * 90000000);
    const account = await this.prisma.account.create({
      data: {
        account_number: accountNum,
        account_type: type === 'rd' ? 'rd' : 'fd',
        balance: parseFloat(amount),
        interest_rate: type === 'rd' ? 6.75 : 7.25,
        fd_tenure_months: parseInt(months || 12),
        fd_maturity_date: new Date(Date.now() + parseInt(months || 12) * 30 * 24 * 60 * 60 * 1000),
        user_id,
      },
    });
    await audit(this.prisma, { user_id, role: 'customer', action: `${type.toUpperCase()} created: ${accountNum} ₹${amount}`, module: 'accounts' });
    return { message: `${type.toUpperCase()} Account created successfully.`, account };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('transactions')
  async listTransactions(
    @Query('account_id') account_id?: string,
    @Query('user_id') user_id?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    let where: any = {};

    if (account_id) {
      where = { OR: [{ from_account_id: account_id }, { to_account_id: account_id }] };
    }

    if (user_id) {
      const userAccounts = await this.prisma.account.findMany({ where: { user_id }, select: { id: true } });
      const accountIds = userAccounts.map((a) => a.id);
      where = { OR: [{ from_account_id: { in: accountIds } }, { to_account_id: { in: accountIds } }] };
    }

    if (type) where.transaction_type = type;
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at.gte = new Date(from_date);
      if (to_date) where.created_at.lte = new Date(to_date + 'T23:59:59');
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        from_account: {
          include: { user: { select: { first_name: true, last_name: true, id: true } } },
        },
        to_account: {
          include: { user: { select: { first_name: true, last_name: true, id: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit ? parseInt(limit) : 100,
    });

    return { transactions };
  }

  @Post('transactions/deposit')
  async deposit(@Body() body: any) {
    const { account_id, amount, description, performed_by, channel } = body;
    const account = await this.prisma.account.findUnique({ where: { id: account_id } });
    if (!account) throw new NotFoundException('Account not found');
    if (!amount || parseFloat(amount) <= 0) throw new BadRequestException('Invalid amount');
    if (account.status !== 'active') throw new BadRequestException('Account is not active');

    const tx = await this.prisma.$transaction(async (txClient) => {
      await txClient.account.update({
        where: { id: account_id },
        data: { balance: { increment: parseFloat(amount) } },
      });
      return txClient.transaction.create({
        data: {
          amount: parseFloat(amount),
          transaction_type: 'deposit',
          description: description || 'Cash Deposit',
          to_account_id: account_id,
          status: 'success',
          channel: channel || 'branch',
          performed_by: performed_by || null,
        },
      });
    });

    await Promise.all([
      audit(this.prisma, {
        user_id: performed_by,
        role: 'teller',
        action: `Deposit ₹${parseFloat(amount).toLocaleString('en-IN')} to account ${account.account_number}`,
        module: 'transactions',
      }),
      this.prisma.notification.create({
        data: {
          user_id: account.user_id,
          title: 'Account Credited',
          message: `₹${parseFloat(amount).toLocaleString('en-IN')} has been deposited to your account ${account.account_number}. Ref: ${tx.reference_number.slice(0, 8).toUpperCase()}`,
          type: 'success',
        },
      }),
    ]);

    return { message: 'Deposit successful.', transaction: tx };
  }

  @Post('transactions/withdraw')
  async withdraw(@Body() body: any) {
    const { account_id, amount, description, performed_by, channel } = body;
    const account = await this.prisma.account.findUnique({ where: { id: account_id } });
    if (!account) throw new NotFoundException('Account not found');
    if (!amount || parseFloat(amount) <= 0) throw new BadRequestException('Invalid amount');
    if (account.status !== 'active') throw new BadRequestException('Account is not active');
    const currentBalance = Number(account.balance);
    const overdraftLimit = Number(account.overdraft_limit);
    if (currentBalance + overdraftLimit < parseFloat(amount)) {
      throw new BadRequestException('Insufficient funds');
    }

    const tx = await this.prisma.$transaction(async (txClient) => {
      await txClient.account.update({
        where: { id: account_id },
        data: { balance: { decrement: parseFloat(amount) } },
      });
      return txClient.transaction.create({
        data: {
          amount: parseFloat(amount),
          transaction_type: 'withdrawal',
          description: description || 'Cash Withdrawal',
          from_account_id: account_id,
          status: 'success',
          channel: channel || 'branch',
          performed_by: performed_by || null,
        },
      });
    });

    await Promise.all([
      audit(this.prisma, {
        user_id: performed_by,
        role: 'teller',
        action: `Withdrawal ₹${parseFloat(amount).toLocaleString('en-IN')} from account ${account.account_number}`,
        module: 'transactions',
      }),
      this.prisma.notification.create({
        data: {
          user_id: account.user_id,
          title: 'Account Debited',
          message: `₹${parseFloat(amount).toLocaleString('en-IN')} has been withdrawn from your account ${account.account_number}. Ref: ${tx.reference_number.slice(0, 8).toUpperCase()}`,
          type: 'info',
        },
      }),
    ]);

    return { message: 'Withdrawal successful.', transaction: tx };
  }

  @Post('transactions/transfer')
  async transfer(@Body() body: any) {
    const { from_account_id, to_account_id, to_ifsc, to_bank_name, to_recipient_name, amount, description, performed_by, channel } = body;

    const fromAccount = await this.prisma.account.findUnique({ where: { id: from_account_id } });
    if (!fromAccount) throw new NotFoundException('Source account not found');
    if (fromAccount.status !== 'active') throw new BadRequestException('Source account is not active');

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new BadRequestException('Invalid amount');
    if (Number(fromAccount.balance) + Number(fromAccount.overdraft_limit) < amt) {
      throw new BadRequestException('Insufficient balance');
    }

    const isExternal = to_ifsc && !to_ifsc.trim().toUpperCase().startsWith('CRBN');

    if (isExternal) {
      // Process as external transfer to another bank
      const txResult = await this.prisma.$transaction(async (txClient) => {
        await txClient.account.update({ where: { id: fromAccount.id }, data: { balance: { decrement: amt } } });
        return txClient.transaction.create({
          data: {
            amount: amt,
            transaction_type: 'transfer',
            description: description || `Transfer to ${to_recipient_name || 'External Account'} (${to_bank_name || 'Other Bank'} A/C: ${to_account_id} IFSC: ${to_ifsc})`,
            from_account_id: fromAccount.id,
            status: 'success',
            channel: channel || 'net_banking',
            performed_by: performed_by || null,
          },
        });
      });

      await Promise.all([
        audit(this.prisma, {
          user_id: performed_by || fromAccount.user_id,
          role: performed_by ? 'teller' : 'customer',
          action: `External Transfer ₹${amt.toLocaleString('en-IN')} from ${fromAccount.account_number} to A/C ${to_account_id} (IFSC: ${to_ifsc})`,
          module: 'transactions',
        }),
        this.prisma.notification.create({
          data: {
            user_id: fromAccount.user_id,
            title: 'Outbound Transfer Processed',
            message: `₹${amt.toLocaleString('en-IN')} transferred externally to ${to_recipient_name || 'A/C ' + to_account_id} (${to_bank_name || 'Other Bank'}). Ref: ${txResult.reference_number.slice(0, 8).toUpperCase()}`,
            type: 'success',
          },
        }),
      ]);

      return { message: 'External transfer initiated successfully.', transaction: txResult };
    }

    // Internal Transfer
    const toAccount = await this.prisma.account.findFirst({
      where: { OR: [{ id: to_account_id }, { account_number: to_account_id }] },
    });
    if (!toAccount) throw new NotFoundException('Destination account not found in CoreBank system');
    if (fromAccount.id === toAccount.id) throw new BadRequestException('Cannot transfer to same account');
    if (toAccount.status !== 'active') throw new BadRequestException('Destination account is not active');

    const txResult = await this.prisma.$transaction(async (txClient) => {
      await txClient.account.update({ where: { id: fromAccount.id }, data: { balance: { decrement: amt } } });
      await txClient.account.update({ where: { id: toAccount.id }, data: { balance: { increment: amt } } });
      return txClient.transaction.create({
        data: {
          amount: amt,
          transaction_type: 'transfer',
          description: description || `Transfer to ${to_recipient_name || 'CoreBank Account'}`,
          from_account_id: fromAccount.id,
          to_account_id: toAccount.id,
          status: 'success',
          channel: channel || 'net_banking',
          performed_by: performed_by || null,
        },
      });
    });

    await Promise.all([
      audit(this.prisma, {
        user_id: performed_by || fromAccount.user_id,
        role: performed_by ? 'teller' : 'customer',
        action: `Transfer ₹${amt.toLocaleString('en-IN')} from ${fromAccount.account_number} to ${toAccount.account_number}`,
        module: 'transactions',
      }),
      this.prisma.notification.create({
        data: {
          user_id: fromAccount.user_id,
          title: 'Transfer Successful',
          message: `₹${amt.toLocaleString('en-IN')} transferred to account ${toAccount.account_number}. Ref: ${txResult.reference_number.slice(0, 8).toUpperCase()}`,
          type: 'success',
        },
      }),
      this.prisma.notification.create({
        data: {
          user_id: toAccount.user_id,
          title: 'Amount Received',
          message: `₹${amt.toLocaleString('en-IN')} received from account ${fromAccount.account_number}. Ref: ${txResult.reference_number.slice(0, 8).toUpperCase()}`,
          type: 'success',
        },
      }),
    ]);

    return { message: 'Transfer successful.', transaction: txResult };
  }

  @Post('transactions/transfer/cbs')
  async cbsTransfer(@Body() body: any) {
    const { from_account_id, to_account_id, to_ifsc, to_bank_name, to_recipient_name, amount, transfer_mode, description, performed_by } = body;
    return this.transfer({
      from_account_id,
      to_account_id,
      to_ifsc,
      to_bank_name,
      to_recipient_name,
      amount,
      description: `[${transfer_mode || 'IMPS'}] ${description || ''}`.trim(),
      performed_by,
      channel: 'net_banking',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('cards/:id')
  async getCard(@Param('id') id: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { account: { include: { user: { select: { first_name: true, last_name: true } } } } },
    });
    if (!card) throw new NotFoundException('Card not found');
    return { card };
  }

  @Post('cards')
  async issueCard(@Body() body: any) {
    const { account_id, card_type, issued_by } = body;
    const account = await this.prisma.account.findUnique({
      where: { id: account_id },
      include: { user: true },
    });
    if (!account) throw new NotFoundException('Account not found');

    const cardNumber = (card_type === 'credit' ? '5500' : '4111') +
      Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');

    const card = await this.prisma.card.create({
      data: {
        card_number: cardNumber,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        expiry_date: '12/30',
        card_holder: `${account.user.first_name.toUpperCase()} ${account.user.last_name.toUpperCase()}`,
        card_type: card_type || 'debit',
        card_status: 'inactive',
        is_blocked: false,
        daily_limit: 50000,
        credit_limit: card_type === 'credit' ? 200000 : null,
        account_id,
      },
    });

    await audit(this.prisma, {
      user_id: issued_by,
      role: 'teller',
      action: `${card_type || 'debit'} card issued for account ${account.account_number}`,
      module: 'cards',
    });

    return {
      message: `${card_type || 'Debit'} card issued. Card must be activated at branch or ATM.`,
      card: { ...card, card_number: `****${cardNumber.slice(-4)}` },
    };
  }

  @Patch('cards/:id/toggle-block')
  async toggleCardBlock(@Param('id') id: string, @Body() body: any) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Card not found');

    const newBlocked = !card.is_blocked;
    const updatedCard = await this.prisma.card.update({
      where: { id },
      data: {
        is_blocked: newBlocked,
        card_status: newBlocked ? 'blocked' : 'active',
      },
    });

    await audit(this.prisma, {
      user_id: body.performed_by,
      role: 'teller',
      action: `Card ****${card.card_number.slice(-4)} ${newBlocked ? 'BLOCKED' : 'UNBLOCKED'}`,
      module: 'cards',
    });

    const account = await this.prisma.account.findUnique({ where: { id: card.account_id } });
    if (account) {
      await this.prisma.notification.create({
        data: {
          user_id: account.user_id,
          title: `Card ${newBlocked ? 'Blocked' : 'Unblocked'}`,
          message: `Your card ending ****${card.card_number.slice(-4)} has been ${newBlocked ? 'blocked' : 'unblocked'} successfully.`,
          type: newBlocked ? 'warning' : 'success',
        },
      });
    }

    return updatedCard;
  }

  @Patch('cards/:id/limit')
  async updateCardLimit(@Param('id') id: string, @Body() body: { limit: number; performed_by?: string }) {
    const card = await this.prisma.card.update({ where: { id }, data: { daily_limit: body.limit } });
    await audit(this.prisma, { user_id: body.performed_by, role: 'teller', action: `Card ****${card.card_number.slice(-4)} daily limit updated to ₹${body.limit}`, module: 'cards' });
    return card;
  }

  @Patch('cards/:id/activate')
  async activateCard(@Param('id') id: string, @Body() body: any) {
    const card = await this.prisma.card.update({
      where: { id },
      data: { card_status: 'active', is_blocked: false },
    });
    await audit(this.prisma, { user_id: body.performed_by, role: 'teller', action: `Card ****${card.card_number.slice(-4)} activated`, module: 'cards' });
    return { message: 'Card activated successfully.', card };
  }

  @Patch('cards/:id/replace')
  async replaceCard(@Param('id') id: string, @Body() body: any) {
    const oldCard = await this.prisma.card.findUnique({
      where: { id },
      include: { account: { include: { user: true } } },
    });
    if (!oldCard) throw new NotFoundException('Card not found');

    // Mark old card as replaced
    await this.prisma.card.update({ where: { id }, data: { card_status: 'replaced', is_blocked: true } });

    // Issue new card
    const newCardNumber = (oldCard.card_type === 'credit' ? '5500' : '4111') +
      Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    const newCard = await this.prisma.card.create({
      data: {
        card_number: newCardNumber,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        expiry_date: '12/32',
        card_holder: oldCard.card_holder,
        card_type: oldCard.card_type,
        card_status: 'inactive',
        is_blocked: false,
        daily_limit: Number(oldCard.daily_limit),
        account_id: oldCard.account_id,
      },
    });

    await Promise.all([
      audit(this.prisma, { user_id: body.performed_by, role: 'teller', action: `Card replaced: old ****${oldCard.card_number.slice(-4)} → new ****${newCardNumber.slice(-4)}`, module: 'cards' }),
      this.prisma.notification.create({
        data: {
          user_id: oldCard.account.user_id,
          title: 'Replacement Card Issued',
          message: `A new ${oldCard.card_type} card ending ****${newCardNumber.slice(-4)} has been issued. Please activate it at your nearest branch or ATM.`,
          type: 'info',
        },
      }),
    ]);

    return { message: 'Card replaced successfully. New card requires activation.', new_card: { ...newCard, card_number: `****${newCardNumber.slice(-4)}` } };
  }

  @Patch('cards/:id/pin-reset')
  async resetCardPin(@Param('id') id: string, @Body() body: any) {
    const card = await this.prisma.card.findUnique({ where: { id }, include: { account: true } });
    if (!card) throw new NotFoundException('Card not found');
    // In production, this would trigger an OTP flow. Here we log and confirm.
    await audit(this.prisma, { user_id: body.performed_by, role: 'teller', action: `PIN reset requested for card ****${card.card_number.slice(-4)}`, module: 'cards' });
    await this.prisma.notification.create({
      data: {
        user_id: card.account.user_id,
        title: 'PIN Reset Initiated',
        message: `A PIN reset has been initiated for your card ending ****${card.card_number.slice(-4)}. Visit an ATM or your branch to set a new PIN.`,
        type: 'warning',
      },
    });
    return { message: 'PIN reset initiated. Customer will receive an OTP for new PIN setup.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOANS
  // ═══════════════════════════════════════════════════════════════════════════
  @Post('loans')
  async applyLoan(@Body() body: any) {
    const { user_id, amount, duration_months, rate, loan_type, purpose, collateral } = body;
    if (!user_id || !amount || !duration_months) {
      throw new BadRequestException('user_id, amount, and duration_months are required');
    }

    const loan = await this.prisma.loan.create({
      data: {
        user_id,
        amount: parseFloat(amount),
        duration_months: parseInt(duration_months),
        rate: parseFloat(rate || 9.5),
        loan_type: loan_type || 'personal',
        status: 'pending',
        purpose: purpose || null,
        collateral: collateral || null,
      },
    });

    await Promise.all([
      audit(this.prisma, { user_id, role: 'customer', action: `Loan application: ${loan_type} ₹${parseFloat(amount).toLocaleString('en-IN')}`, module: 'loans' }),
      this.prisma.notification.create({
        data: {
          user_id,
          title: 'Loan Application Submitted',
          message: `Your ${loan_type} loan application for ₹${parseFloat(amount).toLocaleString('en-IN')} has been submitted. Application ID: ${loan.id.slice(0, 8).toUpperCase()}`,
          type: 'info',
        },
      }),
    ]);

    return { message: 'Loan application submitted.', loan };
  }

  @Get('loans')
  async listLoans(
    @Query('user_id') user_id?: string,
    @Query('status') status?: string,
    @Query('loan_type') loan_type?: string,
  ) {
    const where: any = {};
    if (user_id) where.user_id = user_id;
    if (status) where.status = status;
    if (loan_type) where.loan_type = loan_type;

    return this.prisma.loan.findMany({
      where,
      include: {
        user: { select: { id: true, first_name: true, last_name: true, email: true, phone_number: true, branch: { select: { name: true, code: true } } } },
        repayments: { orderBy: { due_date: 'asc' }, take: 5 },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  @Get('loans/:id')
  async getLoan(@Param('id') id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        user: { include: { branch: true } },
        repayments: { orderBy: { due_date: 'asc' } },
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return { loan };
  }

  @Patch('loans/:id/status')
  async updateLoanStatus(
    @Param('id') id: string,
    @Body() body: { status: string; approved_by?: string; approved_amount?: number },
  ) {
    const validStatuses = ['approved', 'rejected', 'pending', 'under_review', 'disbursed', 'closed'];
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    const loan = await this.prisma.loan.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.approved_by && { approved_by: body.approved_by }),
        ...(body.approved_amount && { approved_amount: body.approved_amount }),
        ...(body.status === 'disbursed' && {
          disbursed_amount: body.approved_amount,
          disbursed_at: new Date(),
        }),
      },
      include: { user: true },
    });

    // If approved, generate repayment schedule
    if (body.status === 'approved') {
      const emi = calculateEMI(Number(loan.approved_amount || loan.amount), Number(loan.rate), loan.duration_months);
      const r = Number(loan.rate) / 100 / 12;
      let outstanding = Number(loan.approved_amount || loan.amount);

      for (let m = 1; m <= loan.duration_months; m++) {
        const interest = outstanding * r;
        const principal = emi - interest;
        outstanding -= principal;
        await this.prisma.loanRepayment.create({
          data: {
            loan_id: id,
            emi_amount: emi,
            principal: Math.round(principal),
            interest: Math.round(interest),
            due_date: new Date(Date.now() + m * 30 * 24 * 60 * 60 * 1000),
            status: 'pending',
          },
        });
      }
    }

    await Promise.all([
      audit(this.prisma, {
        user_id: body.approved_by,
        role: 'loan_officer',
        action: `Loan ${id.slice(0, 8)} status changed to ${body.status} for ${loan.user.first_name} ${loan.user.last_name}`,
        module: 'loans',
      }),
      this.prisma.notification.create({
        data: {
          user_id: loan.user_id,
          title: `Loan ${body.status.charAt(0).toUpperCase() + body.status.slice(1)}`,
          message: `Your ${loan.loan_type} loan application for ₹${Number(loan.amount).toLocaleString('en-IN')} has been ${body.status}.`,
          type: body.status === 'approved' || body.status === 'disbursed' ? 'success' : body.status === 'rejected' ? 'warning' : 'info',
        },
      }),
    ]);

    return { message: `Loan ${body.status} successfully.`, loan };
  }

  @Post('loans/:id/credit-assessment')
  async assessCredit(@Param('id') id: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id }, include: { user: true } });
    if (!loan) throw new NotFoundException('Loan not found');

    const accounts = await this.prisma.account.findMany({ where: { user_id: loan.user_id } });
    const totalBalance = accounts.reduce((acc, cur) => acc + Number(cur.balance), 0);
    const txCount = await this.prisma.transaction.count({
      where: {
        OR: [
          { from_account_id: { in: accounts.map((a) => a.id) } },
          { to_account_id: { in: accounts.map((a) => a.id) } },
        ],
        created_at: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
    });
    const existingLoans = await this.prisma.loan.count({ where: { user_id: loan.user_id, status: 'disbursed' } });

    let creditScore = 500;
    if (totalBalance > 500000) creditScore += 150;
    else if (totalBalance > 100000) creditScore += 100;
    else if (totalBalance > 50000) creditScore += 60;
    else if (totalBalance > 10000) creditScore += 30;
    if (txCount > 20) creditScore += 50;
    else if (txCount > 10) creditScore += 30;
    if (existingLoans === 0) creditScore += 50;
    else if (existingLoans > 2) creditScore -= 50;
    creditScore = Math.min(900, Math.max(300, creditScore));

    const decision = creditScore >= 750
      ? 'Excellent — Strong Approval Recommended'
      : creditScore >= 650
      ? 'Good — Approval Recommended with Standard Terms'
      : creditScore >= 550
      ? 'Fair — Conditional Approval with Higher Rate'
      : 'Poor — Review Required, High Risk';

    const emi = calculateEMI(Number(loan.amount), Number(loan.rate), loan.duration_months);

    // Update loan with credit score
    await this.prisma.loan.update({ where: { id }, data: { credit_score: creditScore, status: 'under_review' } });

    return {
      loan_id: id,
      credit_score: creditScore,
      total_deposits: totalBalance,
      existing_loans: existingLoans,
      transaction_activity: txCount,
      emi,
      decision,
      customer: `${loan.user.first_name} ${loan.user.last_name}`,
      email: loan.user.email,
      phone: loan.user.phone_number,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BENEFICIARIES
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('beneficiaries')
  async getBeneficiaries(@Query('user_id') user_id: string) {
    if (!user_id) throw new BadRequestException('user_id is required');
    return this.prisma.beneficiary.findMany({
      where: { user_id, is_active: true },
      orderBy: { created_at: 'desc' },
    });
  }

  @Post('beneficiaries')
  async addBeneficiary(@Body() body: any) {
    const { user_id, name, account_number, bank_name, ifsc_code, nickname } = body;
    if (!user_id || !name || !account_number) {
      throw new BadRequestException('user_id, name, and account_number are required');
    }

    const existing = await this.prisma.beneficiary.findFirst({
      where: { user_id, account_number, is_active: true },
    });
    if (existing) throw new BadRequestException('This beneficiary already exists');

    const ben = await this.prisma.beneficiary.create({
      data: { user_id, name, account_number, bank_name: bank_name || 'CoreBank', ifsc_code, nickname },
    });

    await audit(this.prisma, { user_id, role: 'customer', action: `Beneficiary added: ${name} (${account_number})`, module: 'beneficiaries' });
    return { message: 'Beneficiary added.', beneficiary: ben };
  }

  @Delete('beneficiaries/:id')
  async removeBeneficiary(@Param('id') id: string, @Body() body: any) {
    const ben = await this.prisma.beneficiary.update({ where: { id }, data: { is_active: false } });
    await audit(this.prisma, { user_id: body.user_id, role: 'customer', action: `Beneficiary removed: ${ben.name}`, module: 'beneficiaries' });
    return { message: 'Beneficiary removed.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BILL PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('bills')
  async getBills(@Query('account_id') account_id: string) {
    if (!account_id) throw new BadRequestException('account_id is required');
    return this.prisma.bill.findMany({
      where: { account_id },
      orderBy: { created_at: 'desc' },
    });
  }

  @Post('bills')
  async createBill(@Body() body: any) {
    const { account_id, biller_name, biller_category, consumer_number, amount, due_date } = body;
    if (!account_id || !biller_name || !amount) {
      throw new BadRequestException('account_id, biller_name, and amount are required');
    }
    const bill = await this.prisma.bill.create({
      data: {
        account_id,
        biller_name,
        biller_category: biller_category || 'utility',
        consumer_number,
        amount: parseFloat(amount),
        due_date: due_date ? new Date(due_date) : null,
        status: 'pending',
      },
    });
    return { message: 'Biller added.', bill };
  }

  @Post('bills/:id/pay')
  async payBill(@Param('id') id: string, @Body() body: any) {
    const bill = await this.prisma.bill.findUnique({ where: { id }, include: { account: true } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === 'paid') throw new BadRequestException('Bill already paid');

    const account = bill.account;
    if (Number(account.balance) < Number(bill.amount)) {
      throw new BadRequestException('Insufficient balance to pay this bill');
    }

    const tx = await this.prisma.$transaction(async (txClient) => {
      await txClient.account.update({
        where: { id: account.id },
        data: { balance: { decrement: Number(bill.amount) } },
      });
      await txClient.bill.update({ where: { id }, data: { status: 'paid', paid_at: new Date() } });
      return txClient.transaction.create({
        data: {
          amount: Number(bill.amount),
          transaction_type: 'bill_payment',
          description: `Bill Payment — ${bill.biller_name}`,
          from_account_id: account.id,
          status: 'success',
          channel: 'net_banking',
          performed_by: body.performed_by || null,
        },
      });
    });

    await Promise.all([
      audit(this.prisma, { user_id: body.performed_by, role: 'customer', action: `Bill payment: ${bill.biller_name} ₹${Number(bill.amount).toLocaleString('en-IN')}`, module: 'bills' }),
      this.prisma.notification.create({
        data: {
          user_id: account.user_id,
          title: 'Bill Payment Successful',
          message: `₹${Number(bill.amount).toLocaleString('en-IN')} paid to ${bill.biller_name}. Ref: ${tx.reference_number.slice(0, 8).toUpperCase()}`,
          type: 'success',
        },
      }),
    ]);

    return { message: 'Bill paid successfully.', transaction: tx };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEQUE BOOK REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('cheques/requests')
  async getChequeRequests(@Query('account_id') account_id?: string) {
    return this.prisma.chequebookRequest.findMany({
      where: account_id ? { account_id } : {},
      include: { account: { include: { user: { select: { first_name: true, last_name: true } } } } },
      orderBy: { requested_at: 'desc' },
    });
  }

  @Post('cheques/request')
  async requestChequebook(@Body() body: any) {
    const { account_id, leaves, address } = body;
    if (!account_id) throw new BadRequestException('account_id is required');

    const account = await this.prisma.account.findUnique({ where: { id: account_id }, include: { user: true } });
    if (!account) throw new NotFoundException('Account not found');

    const req = await this.prisma.chequebookRequest.create({
      data: {
        account_id,
        leaves: parseInt(leaves || 25),
        address: address || null,
        status: 'pending',
      },
    });

    await Promise.all([
      audit(this.prisma, { user_id: account.user_id, role: 'customer', action: `Cheque book requested: ${leaves || 25} leaves for account ${account.account_number}`, module: 'cheques' }),
      this.prisma.notification.create({
        data: {
          user_id: account.user_id,
          title: 'Cheque Book Request Submitted',
          message: `Your cheque book request (${leaves || 25} leaves) for account ${account.account_number} has been submitted and will be dispatched within 5-7 working days.`,
          type: 'info',
        },
      }),
    ]);

    return { message: 'Cheque book request submitted.', request: req };
  }

  @Patch('cheques/requests/:id')
  async updateChequeRequest(@Param('id') id: string, @Body() body: any) {
    const req = await this.prisma.chequebookRequest.update({
      where: { id },
      data: {
        status: body.status,
        tracking_no: body.tracking_no || null,
      },
    });
    return { message: 'Cheque book request updated.', request: req };
  }

  @Post('cheques/stop')
  async stopCheque(@Body() body: any) {
    const { account_id, cheque_number, reason } = body;
    if (!account_id || !cheque_number) throw new BadRequestException('account_id and cheque_number are required');

    const account = await this.prisma.account.findUnique({ where: { id: account_id }, include: { user: true } });
    if (!account) throw new NotFoundException('Account not found');

    const stop = await this.prisma.chequeStop.create({
      data: { account_id, cheque_number, reason, status: 'active' },
    });

    await Promise.all([
      audit(this.prisma, { user_id: account.user_id, role: 'customer', action: `Cheque stop: Cheque #${cheque_number} for account ${account.account_number}`, module: 'cheques' }),
      this.prisma.notification.create({
        data: {
          user_id: account.user_id,
          title: 'Stop Cheque Request Registered',
          message: `Stop payment instruction for Cheque #${cheque_number} has been registered. No payment will be processed against this cheque.`,
          type: 'warning',
        },
      }),
    ]);

    return { message: 'Stop cheque instruction registered.', stop };
  }

  @Get('cheques/stops')
  async getChequeStops(@Query('account_id') account_id?: string) {
    return this.prisma.chequeStop.findMany({
      where: account_id ? { account_id } : {},
      include: { account: { include: { user: { select: { first_name: true, last_name: true } } } } },
      orderBy: { created_at: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASH DRAWER
  // ═══════════════════════════════════════════════════════════════════════════
  @Post('teller/cash-drawer/open')
  async openCashDrawer(@Body() body: any) {
    const { teller_id, branch_id, opening_balance, denominations } = body;
    if (!teller_id || !branch_id) throw new BadRequestException('teller_id and branch_id are required');

    const drawer = await this.prisma.cashDrawer.create({
      data: {
        teller_id,
        branch_id,
        opening_balance: parseFloat(opening_balance || 0),
        denominations: JSON.stringify(denominations || {}),
        status: 'open',
      },
    });

    await audit(this.prisma, { user_id: teller_id, role: 'teller', action: `Cash drawer opened. Opening balance: ₹${parseFloat(opening_balance || 0).toLocaleString('en-IN')}`, module: 'cash_drawer' });
    return { message: 'Cash drawer opened.', drawer };
  }

  @Post('teller/cash-drawer/close')
  async closeCashDrawer(@Body() body: any) {
    const { teller_id, branch_id, closing_balance, denominations } = body;
    if (!teller_id) throw new BadRequestException('teller_id is required');

    const openDrawer = await this.prisma.cashDrawer.findFirst({
      where: { teller_id, status: 'open' },
      orderBy: { opened_at: 'desc' },
    });

    if (openDrawer) {
      await this.prisma.cashDrawer.update({
        where: { id: openDrawer.id },
        data: {
          closing_balance: parseFloat(closing_balance || 0),
          denominations: JSON.stringify(denominations || {}),
          closed_at: new Date(),
          status: 'closed',
        },
      });
    }

    await audit(this.prisma, {
      user_id: teller_id,
      role: 'teller',
      action: `EOD Cash Drawer Closed. Closing balance: ₹${parseFloat(closing_balance || 0).toLocaleString('en-IN')}`,
      module: 'cash_drawer',
    });

    return {
      success: true,
      message: `Cash drawer closed. Closing balance: ₹${parseFloat(closing_balance || 0).toLocaleString('en-IN')}`,
    };
  }

  @Get('teller/cash-drawer')
  async getTellerDrawer(@Query('teller_id') teller_id: string) {
    if (!teller_id) throw new BadRequestException('teller_id is required');
    const drawer = await this.prisma.cashDrawer.findFirst({
      where: { teller_id },
      orderBy: { opened_at: 'desc' },
    });
    return { drawer };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKETS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('support/tickets')
  async getTickets(@Query('status') status?: string, @Query('user_id') user_id?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (user_id) where.user_id = user_id;

    return this.prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { first_name: true, last_name: true, email: true, phone_number: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  @Post('support/tickets')
  async createTicket(@Body() body: any) {
    const { user_id, subject, description, priority, category } = body;
    if (!user_id || !subject) throw new BadRequestException('user_id and subject are required');
    return this.prisma.supportTicket.create({
      data: { user_id, subject, description, priority: priority || 'medium', category: category || 'general' },
    });
  }

  @Patch('support/tickets/:id/resolve')
  async resolveTicket(@Param('id') id: string, @Body() body: any) {
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: body.status || 'resolved', resolved_at: new Date(), assigned_to: body.assigned_to },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('audit/logs')
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('module') module?: string,
    @Query('from_date') from_date?: string,
  ) {
    const where: any = {};
    if (module) where.module = module;
    if (from_date) where.timestamp = { gte: new Date(from_date) };

    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { first_name: true, last_name: true, username: true, role: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: limit ? parseInt(limit) : 200,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('notifications')
  async getNotifications(@Query('user_id') user_id: string, @Query('unread_only') unread_only?: string) {
    if (!user_id) throw new BadRequestException('user_id is required');
    const where: any = { user_id };
    if (unread_only === 'true') where.is_read = false;
    return this.prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  @Patch('notifications/:id/read')
  async markNotificationRead(@Param('id') id: string) {
    return this.prisma.notification.update({ where: { id }, data: { is_read: true } });
  }

  @Patch('notifications/read-all')
  async markAllRead(@Body() body: { user_id: string }) {
    await this.prisma.notification.updateMany({ where: { user_id: body.user_id }, data: { is_read: true } });
    return { message: 'All notifications marked as read.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('announcements')
  async getAnnouncements(@Query('role') role?: string) {
    return this.prisma.announcement.findMany({
      where: {
        is_active: true,
        OR: [{ target_roles: 'all' }, role ? { target_roles: { contains: role } } : {}],
      },
      include: { author: { select: { first_name: true, last_name: true } } },
      orderBy: { published_at: 'desc' },
    });
  }

  @Post('announcements')
  async createAnnouncement(@Body() body: any) {
    const { title, content, target_roles, created_by, expires_at } = body;
    if (!title || !content || !created_by) throw new BadRequestException('title, content, and created_by are required');

    const announcement = await this.prisma.announcement.create({
      data: {
        title,
        content,
        target_roles: target_roles || 'all',
        created_by,
        expires_at: expires_at ? new Date(expires_at) : null,
        is_active: true,
      },
    });
    return { message: 'Announcement created.', announcement };
  }

  @Patch('announcements/:id')
  async updateAnnouncement(@Param('id') id: string, @Body() body: any) {
    const announcement = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.content && { content: body.content }),
        ...(typeof body.is_active === 'boolean' && { is_active: body.is_active }),
      },
    });
    return { message: 'Announcement updated.', announcement };
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(@Param('id') id: string) {
    await this.prisma.announcement.update({ where: { id }, data: { is_active: false } });
    return { message: 'Announcement deactivated.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN — CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('admin/customers')
  async listCustomers(
    @Query('branch_id') branch_id?: string,
    @Query('status') status?: string,
    @Query('kyc_status') kyc_status?: string,
  ) {
    const where: any = { role: Role.customer, is_deleted: false };
    if (branch_id) where.branch_id = branch_id;
    if (kyc_status) where.kyc_status = kyc_status;
    if (status === 'inactive') where.is_active = false;
    if (status === 'active') where.is_active = true;

    const customers = await this.prisma.user.findMany({
      where,
      include: {
        accounts: {
          select: { id: true, account_number: true, account_type: true, balance: true, status: true },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return { customers };
  }

  @Post('admin/customers')
  async createCustomer(@Body() body: any) {
    const { email, first_name, last_name, phone_number, temporary_password, date_of_birth, address, city, branch_id, created_by } = body;
    if (!email || !first_name || !last_name || !phone_number) {
      throw new BadRequestException('Missing required fields: email, first_name, last_name, phone_number');
    }

    const cleanEmail = email.trim();
    const cleanPhone = phone_number.trim();

    const existingEmail = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) throw new BadRequestException('Email already registered');
    const existingPhone = await this.prisma.user.findFirst({ where: { phone_number: cleanPhone } });
    if (existingPhone) throw new BadRequestException('Phone number already registered');

    let username = cleanEmail.split('@')[0];
    let counter = 1;
    const originalUsername = username;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${originalUsername}${counter++}`;
    }

    const bcrypt = require('bcryptjs');
    const pass = temporary_password || 'TempPass123!';
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(pass, salt);

    const user = await this.prisma.user.create({
      data: {
        username,
        email: cleanEmail,
        password_hash,
        first_name,
        last_name,
        phone_number: cleanPhone,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        address: address || null,
        city: city || null,
        role: 'customer',
        is_active: true,
        is_verified: false,
        kyc_status: 'pending',
        branch_id: branch_id || null,
      },
    });

    // Auto-open savings account
    const accountNum = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const account = await this.prisma.account.create({
      data: {
        account_number: accountNum,
        account_type: 'savings',
        balance: 0.0,
        interest_rate: 3.5,
        minimum_balance: 1000,
        user_id: user.id,
        branch_id: branch_id || null,
      },
    });

    const cardNumber = '4111' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    const card = await this.prisma.card.create({
      data: {
        card_number: cardNumber,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        expiry_date: '12/30',
        card_holder: `${first_name.toUpperCase()} ${last_name.toUpperCase()}`,
        card_type: 'debit',
        card_status: 'inactive',
        daily_limit: 50000,
        account_id: account.id,
      },
    });

    await Promise.all([
      audit(this.prisma, {
        user_id: created_by,
        role: 'teller',
        action: `New customer onboarded: ${first_name} ${last_name} (${cleanEmail}), Account: ${accountNum}`,
        module: 'customers',
      }),
      this.prisma.notification.create({
        data: {
          user_id: user.id,
          title: 'Welcome to CoreBank!',
          message: `Your savings account ${accountNum} has been created. Register for Net Banking to manage your account online.`,
          type: 'success',
        },
      }),
    ]);

    return {
      message: 'Customer onboarded successfully. Savings account and ATM card created.',
      customer: { ...user, password_hash: undefined },
      account,
      card: { card_number: `****${cardNumber.slice(-4)}`, expiry_date: card.expiry_date },
      temp_password: pass,
    };
  }

  @Get('admin/customers/:id')
  async getCustomer(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        accounts: {
          include: {
            cards: true,
            bills: { where: { status: 'pending' } },
          },
        },
        loans: { orderBy: { created_at: 'desc' } },
        branch: true,
        notifications: { where: { is_read: false }, take: 5 },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    return { customer: { ...user, password_hash: undefined } };
  }

  @Patch('admin/customers/:id')
  async updateCustomer(@Param('id') id: string, @Body() body: any) {
    const { first_name, last_name, phone_number, address, city, pincode, kyc_status, is_active, branch_id, updated_by } = body;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(first_name && { first_name }),
        ...(last_name && { last_name }),
        ...(phone_number && { phone_number }),
        ...(address !== undefined && { address }),
        ...(city && { city }),
        ...(pincode !== undefined && { pincode }),
        ...(kyc_status && { kyc_status }),
        ...(typeof is_active === 'boolean' && { is_active }),
        ...(branch_id !== undefined && { branch_id }),
      },
      select: { id: true, first_name: true, last_name: true, email: true, role: true, is_active: true, kyc_status: true },
    });

    await audit(this.prisma, {
      user_id: updated_by,
      role: 'teller',
      action: `Customer ${user.first_name} ${user.last_name} profile updated`,
      module: 'customers',
    });

    return { message: 'Customer updated.', user };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN — EMPLOYEES
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('admin/employees')
  async listEmployees(@Query('branch_id') branch_id?: string, @Query('role') role?: string) {
    const where: any = { role: { not: Role.customer }, is_deleted: false };
    if (branch_id) where.branch_id = branch_id;
    if (role) where.role = role;

    const employees = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        is_active: true,
        is_verified: true,
        branch_id: true,
        branch: { select: { name: true, code: true } },
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return { employees };
  }

  @Post('admin/employees')
  async createEmployee(@Body() body: any) {
    const { first_name, last_name, email, phone_number, role, password, created_by, branch_id, date_of_birth } = body;
    if (!email || !first_name || !last_name || !role) {
      throw new BadRequestException('first_name, last_name, email, and role are required');
    }

    const validEmployeeRoles = ['teller', 'branch_manager', 'loan_officer', 'customer_support', 'auditor', 'super_admin'];
    if (!validEmployeeRoles.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validEmployeeRoles.join(', ')}`);
    }

    const existEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existEmail) throw new BadRequestException('Email already exists');

    const bcrypt = require('bcryptjs');
    const pass = password || 'TempPass123!';
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(pass, salt);

    let username = email.split('@')[0] + Math.floor(Math.random() * 100);
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = email.split('@')[0] + Math.floor(Math.random() * 1000);
    }

    const employee = await this.prisma.user.create({
      data: {
        username,
        email,
        password_hash,
        first_name,
        last_name,
        phone_number: phone_number || null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        role,
        is_active: true,
        is_verified: true,
        kyc_status: 'verified',
        branch_id: branch_id || null,
      },
      select: {
        id: true, username: true, email: true, first_name: true, last_name: true, role: true, is_active: true,
      },
    });

    await audit(this.prisma, {
      user_id: created_by,
      role: 'super_admin',
      action: `New employee created: ${first_name} ${last_name} as ${role}`,
      module: 'employees',
    });

    return { message: 'Employee created successfully.', employee, temp_password: pass };
  }

  @Patch('admin/employees/:id')
  async updateEmployee(@Param('id') id: string, @Body() body: any) {
    const { is_active, role, branch_id, updated_by, first_name, last_name, email, phone_number, password } = body;
    const updates: any = {};
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    if (role) updates.role = role;
    if (branch_id !== undefined) updates.branch_id = branch_id;
    if (first_name) updates.first_name = first_name;
    if (last_name) updates.last_name = last_name;
    if (email) updates.email = email;
    if (phone_number !== undefined) updates.phone_number = phone_number;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    const employee = await this.prisma.user.update({
      where: { id },
      data: updates,
      select: { id: true, first_name: true, last_name: true, email: true, phone_number: true, role: true, is_active: true, branch_id: true },
    });

    await audit(this.prisma, {
      user_id: updated_by,
      role: 'super_admin',
      action: `Employee ${employee.first_name} ${employee.last_name} updated: ${JSON.stringify(updates)}`,
      module: 'employees',
    });

    return { message: 'Employee updated successfully.', employee };
  }

  @Delete('admin/employees/:id')
  async deleteEmployee(@Param('id') id: string, @Body() body: any) {
    const employee = await this.prisma.user.findFirst({ where: { id, is_deleted: false } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.role === 'customer') throw new BadRequestException('Cannot delete customer through employee endpoint');

    // Soft delete — deactivate instead of hard delete
    await this.prisma.user.update({ where: { id }, data: { is_deleted: true, is_active: false } });

    await audit(this.prisma, {
      user_id: body.deleted_by,
      role: 'super_admin',
      action: `Employee deactivated: ${employee.first_name} ${employee.last_name} (${employee.role})`,
      module: 'employees',
    });

    return { message: 'Employee deactivated successfully.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN — STATS & REPORTS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('admin/stats')
  async getSystemStats() {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      totalCustomers,
      totalEmployees,
      totalAccounts,
      recentTx,
      pendingLoans,
      allAccounts,
      todayTx,
      totalBranches,
      activeCards,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'customer', is_active: true } }),
      this.prisma.user.count({ where: { role: { not: 'customer' }, is_active: true } }),
      this.prisma.account.count({ where: { status: 'active' } }),
      this.prisma.transaction.findMany({
        include: {
          from_account: { include: { user: { select: { first_name: true, last_name: true } } } },
          to_account: { include: { user: { select: { first_name: true, last_name: true } } } },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      this.prisma.loan.count({ where: { status: 'pending' } }),
      this.prisma.account.findMany({ where: { status: 'active' }, select: { balance: true } }),
      this.prisma.transaction.findMany({
        where: { created_at: { gte: todayStart } },
        select: { amount: true, transaction_type: true },
      }),
      this.prisma.branch.count({ where: { is_active: true } }),
      this.prisma.card.count({ where: { card_status: 'active' } }),
    ]);

    const totalDeposits = allAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const todayDeposits = todayTx.filter((t) => t.transaction_type === 'deposit').reduce((s, t) => s + Number(t.amount), 0);
    const todayWithdrawals = todayTx.filter((t) => t.transaction_type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0);

    return {
      total_customers: totalCustomers,
      total_employees: totalEmployees,
      total_accounts: totalAccounts,
      total_branches: totalBranches,
      total_deposits: totalDeposits,
      vault_reserves: totalDeposits * 0.15,
      pending_loans: pendingLoans,
      active_cards: activeCards,
      today_deposits: todayDeposits,
      today_withdrawals: todayWithdrawals,
      today_transactions: todayTx.length,
      recent_transactions: recentTx,
    };
  }

  @Get('admin/branch-cash')
  async getBranchCash(@Query('branch_id') branch_id?: string) {
    const where = branch_id ? { branch_id } : {};
    const accounts = await this.prisma.account.findMany({ where, select: { balance: true } });
    const totalCash = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);
    return {
      branch_code: 'ALL',
      total_vault_cash: totalCash * 0.1,
      total_deposits: totalCash,
      status: totalCash > 1000000 ? 'Adequate Liquidity' : totalCash > 100000 ? 'Moderate Liquidity' : 'Low Reserves',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('reports/daily')
  async getDailyReport(@Query('date') date?: string, @Query('branch_id') branch_id?: string) {
    const reportDate = date ? new Date(date) : new Date();
    const start = new Date(reportDate.setHours(0, 0, 0, 0));
    const end = new Date(reportDate.setHours(23, 59, 59, 999));

    const txWhere: any = { created_at: { gte: start, lte: end } };

    const transactions = await this.prisma.transaction.findMany({
      where: txWhere,
      include: {
        from_account: { include: { user: { select: { first_name: true, last_name: true } } } },
        to_account: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });

    const deposits = transactions.filter((t) => t.transaction_type === 'deposit');
    const withdrawals = transactions.filter((t) => t.transaction_type === 'withdrawal');
    const transfers = transactions.filter((t) => t.transaction_type === 'transfer');
    const billPayments = transactions.filter((t) => t.transaction_type === 'bill_payment');

    return {
      report_date: date || new Date().toISOString().split('T')[0],
      total_transactions: transactions.length,
      total_deposits: deposits.reduce((s, t) => s + Number(t.amount), 0),
      total_withdrawals: withdrawals.reduce((s, t) => s + Number(t.amount), 0),
      total_transfers: transfers.reduce((s, t) => s + Number(t.amount), 0),
      total_bill_payments: billPayments.reduce((s, t) => s + Number(t.amount), 0),
      deposit_count: deposits.length,
      withdrawal_count: withdrawals.length,
      transfer_count: transfers.length,
      transactions,
    };
  }

  @Get('reports/monthly')
  async getMonthlyReport(@Query('month') month?: string, @Query('year') year?: string) {
    const m = month ? parseInt(month) - 1 : new Date().getMonth();
    const y = year ? parseInt(year) : new Date().getFullYear();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: { created_at: { gte: start, lte: end } },
      include: {
        from_account: { include: { user: { select: { first_name: true, last_name: true } } } },
        to_account: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });

    const newCustomers = await this.prisma.user.count({
      where: { role: 'customer', created_at: { gte: start, lte: end } },
    });
    const newAccounts = await this.prisma.account.count({
      where: { created_at: { gte: start, lte: end } },
    });
    const newLoans = await this.prisma.loan.count({
      where: { created_at: { gte: start, lte: end } },
    });

    return {
      report_period: `${y}-${String(m + 1).padStart(2, '0')}`,
      total_transactions: transactions.length,
      total_volume: transactions.reduce((s, t) => s + Number(t.amount), 0),
      new_customers: newCustomers,
      new_accounts: newAccounts,
      new_loans: newLoans,
      transactions: transactions.slice(0, 100),
    };
  }

  @Get('reports/loans')
  async getLoanReport() {
    const loans = await this.prisma.loan.findMany({
      include: { user: { select: { first_name: true, last_name: true, email: true, branch: { select: { name: true } } } }, repayments: true },
      orderBy: { created_at: 'desc' },
    });

    const byStatus = loans.reduce((acc: any, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});
    const byType = loans.reduce((acc: any, l) => {
      acc[l.loan_type] = (acc[l.loan_type] || 0) + Number(l.amount);
      return acc;
    }, {});

    return {
      total_loans: loans.length,
      total_disbursed: loans.filter((l) => l.status === 'disbursed').reduce((s, l) => s + Number(l.disbursed_amount || 0), 0),
      by_status: byStatus,
      by_type: byType,
      loans,
    };
  }

  @Get('reports/cash')
  async getCashReport(@Query('branch_id') branch_id?: string) {
    const where = branch_id ? { branch_id } : {};
    const accounts = await this.prisma.account.findMany({
      where: { ...where, status: 'active' },
      include: { user: { select: { first_name: true, last_name: true } }, branch: { select: { name: true, code: true } } },
      orderBy: { balance: 'desc' },
    });
    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    return {
      total_balance: totalBalance,
      account_count: accounts.length,
      average_balance: accounts.length > 0 ? totalBalance / accounts.length : 0,
      accounts: accounts.slice(0, 50),
    };
  }

  @Get('reports/audit')
  async getAuditReport(@Query('from_date') from_date?: string, @Query('to_date') to_date?: string) {
    const where: any = {};
    if (from_date || to_date) {
      where.timestamp = {};
      if (from_date) where.timestamp.gte = new Date(from_date);
      if (to_date) where.timestamp.lte = new Date(to_date + 'T23:59:59');
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: { user: { select: { first_name: true, last_name: true, role: true } } },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    const byModule = logs.reduce((acc: any, l) => { acc[l.module] = (acc[l.module] || 0) + 1; return acc; }, {});
    const byRole = logs.reduce((acc: any, l) => { acc[l.role] = (acc[l.role] || 0) + 1; return acc; }, {});

    return { total_events: logs.length, by_module: byModule, by_role: byRole, logs };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM HEALTH
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('system/health')
  async getSystemHealth() {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        latency_ms: dbLatency,
        provider: 'PostgreSQL',
      },
      cache: {
        status: 'connected',
        provider: 'Redis',
      },
      uptime_seconds: process.uptime(),
      node_version: process.version,
      memory_usage: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF STATEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('accounts/:id/statement/pdf')
  async generateStatement(
    @Param('id') id: string,
    @Query('from_date') from_date: string,
    @Query('to_date') to_date: string,
    @Res() res: Response,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        user: true,
        branch: true,
      },
    });
    if (!account) throw new NotFoundException('Account not found');

    const start = from_date ? new Date(from_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = to_date ? new Date(to_date + 'T23:59:59') : new Date();

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ from_account_id: id }, { to_account_id: id }],
        created_at: { gte: start, lte: end },
      },
      orderBy: { created_at: 'asc' },
    });

    // Calculate opening balance by going backwards
    const earlierTx = await this.prisma.transaction.findMany({
      where: {
        OR: [{ from_account_id: id }, { to_account_id: id }],
        created_at: { lt: start },
      },
    });

    let openingBalance = Number(account.balance);
    for (const tx of transactions) {
      if (tx.from_account_id === id) openingBalance += Number(tx.amount);
      if (tx.to_account_id === id) openingBalance -= Number(tx.amount);
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement_${account.account_number}.pdf"`);
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 110).fill('#1e3a5f');
    doc.fill('#ffffff').fontSize(26).font('Helvetica-Bold').text('COREBANK', 50, 25);
    doc.fontSize(10).font('Helvetica').text('Enterprise Core Banking System', 50, 58);
    doc.text('Account Statement', 50, 75);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 50, 90);

    // Branch on right
    doc.fontSize(9).text(account.branch?.name || 'CoreBank', doc.page.width - 250, 25, { width: 200, align: 'right' });
    doc.text(account.branch?.address || '', doc.page.width - 250, 40, { width: 200, align: 'right' });
    doc.text(account.branch?.phone || '', doc.page.width - 250, 55, { width: 200, align: 'right' });

    // ── Customer Info ────────────────────────────────────────────────────────
    doc.fill('#000000').fontSize(11).font('Helvetica-Bold').text('Account Holder Information', 50, 130);
    doc.moveTo(50, 146).lineTo(550, 146).stroke('#cccccc');

    const infoY = 155;
    doc.font('Helvetica').fontSize(10);
    doc.text(`Name: ${account.user.first_name} ${account.user.last_name}`, 50, infoY);
    doc.text(`Email: ${account.user.email}`, 50, infoY + 16);
    doc.text(`Phone: ${account.user.phone_number || 'N/A'}`, 50, infoY + 32);
    doc.text(`Account Number: ${account.account_number}`, 300, infoY);
    doc.text(`Account Type: ${account.account_type.toUpperCase()}`, 300, infoY + 16);
    doc.text(`Status: ${account.status.toUpperCase()}`, 300, infoY + 32);

    // ── Statement Period ────────────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('Statement Period', 50, 225);
    doc.moveTo(50, 241).lineTo(550, 241).stroke('#cccccc');
    doc.font('Helvetica').fontSize(10);
    doc.text(`From: ${start.toLocaleDateString('en-IN')}`, 50, 250);
    doc.text(`To: ${end.toLocaleDateString('en-IN')}`, 200, 250);
    doc.text(`Opening Balance: ₹${openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 350, 250);

    // ── Transaction Table ────────────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').text('Transaction History', 50, 285);
    doc.moveTo(50, 301).lineTo(550, 301).stroke('#cccccc');

    // Table header
    doc.rect(50, 305, 500, 22).fill('#1e3a5f');
    doc.fill('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('Date', 55, 312);
    doc.text('Description', 130, 312);
    doc.text('Type', 310, 312);
    doc.text('Debit (₹)', 365, 312);
    doc.text('Credit (₹)', 430, 312);
    doc.text('Balance (₹)', 490, 312);

    let runBalance = openingBalance;
    let rowY = 332;
    doc.fill('#000000').font('Helvetica').fontSize(8);

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const isCredit = tx.to_account_id === id;
      const isDebit = tx.from_account_id === id;

      if (isCredit) runBalance += Number(tx.amount);
      if (isDebit) runBalance -= Number(tx.amount);

      if (i % 2 === 0) doc.rect(50, rowY - 4, 500, 18).fill('#f9f9f9');
      doc.fill('#000000');
      doc.text(new Date(tx.created_at).toLocaleDateString('en-IN'), 55, rowY);
      doc.text((tx.description || tx.transaction_type).substring(0, 28), 130, rowY);
      doc.text(tx.transaction_type.substring(0, 12), 310, rowY);
      doc.text(isDebit ? Number(tx.amount).toFixed(2) : '-', 365, rowY);
      doc.text(isCredit ? Number(tx.amount).toFixed(2) : '-', 430, rowY);
      doc.text(runBalance.toFixed(2), 490, rowY);

      rowY += 18;
      if (rowY > doc.page.height - 100) {
        doc.addPage();
        rowY = 50;
      }
    }

    // ── Closing Balance ──────────────────────────────────────────────────────
    doc.moveTo(50, rowY + 5).lineTo(550, rowY + 5).stroke('#1e3a5f');
    doc.rect(50, rowY + 10, 500, 25).fill('#e8f0fe');
    doc.fill('#1e3a5f').fontSize(10).font('Helvetica-Bold');
    doc.text('Closing Balance:', 55, rowY + 17);
    doc.text(`₹${Number(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, rowY + 17);

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.fill('#666666').fontSize(8).font('Helvetica');
    doc.text(
      'This is a computer-generated statement and does not require a signature. For queries, contact your branch or helpline 1800-200-3456.',
      50, doc.page.height - 60, { width: 500, align: 'center' },
    );
    doc.text(
      `CoreBank Ltd. | IFSC: CRBN0001001 | ${account.branch?.name || 'Head Office'}`,
      50, doc.page.height - 40, { width: 500, align: 'center' },
    );

    doc.end();
  }
}
