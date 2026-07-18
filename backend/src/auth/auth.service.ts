import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async registerUser(data: any) {
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: data.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password_hash,
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
        role: (data.role as string) || 'customer',
      },
    });

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      phone_number: user.phone_number,
      is_active: user.is_active,
      is_verified: user.is_verified,
    };
  }

  async login(data: any) {
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.username },
        ],
        is_deleted: false,
      },
    });

    if (!user) {
      const account = await this.prisma.account.findUnique({
        where: { account_number: data.username },
        include: { user: true },
      });
      if (account) {
        user = account.user;
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '1h' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    };
  }

  async generateTokens(user: any) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '1h' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user,
    };
  }

  async checkRegister(data: { account_or_card: string; phone_number: string; date_of_birth?: string }) {
    // 1. Find account
    let account = await this.prisma.account.findUnique({
      where: { account_number: data.account_or_card },
      include: { user: true },
    });

    let user: any = null;

    if (account) {
      user = account.user;
    } else {
      // 2. Find card
      const card = await this.prisma.card.findUnique({
        where: { card_number: data.account_or_card },
        include: { account: { include: { user: true } } },
      });
      if (card) {
        user = card.account.user;
      }
    }

    if (!user) {
      throw new BadRequestException('No account or debit card matches the provided number.');
    }

    // 3. Verify phone number
    const dbPhone = user.phone_number?.replace(/[^0-9]/g, '');
    const inputPhone = data.phone_number.replace(/[^0-9]/g, '');
    if (!dbPhone || !dbPhone.endsWith(inputPhone)) {
      throw new BadRequestException('Verification failed. Registered phone number does not match.');
    }

    // 4. Verify date of birth
    if (data.date_of_birth && user.date_of_birth) {
      const dbDob = new Date(user.date_of_birth).toISOString().split('T')[0];
      const inputDob = new Date(data.date_of_birth).toISOString().split('T')[0];
      if (dbDob !== inputDob) {
        throw new BadRequestException('Verification failed. Date of birth does not match.');
      }
    }

    return { user_id: user.id };
  }

  async finalizeRegister(data: any) {
    const { user_id, username, password } = data;
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // Check if username is already taken
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== user_id) {
      throw new ConflictException('Username is already taken.');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await this.prisma.user.update({
      where: { id: user_id },
      data: {
        username,
        password_hash,
        is_verified: true,
        kyc_status: 'verified',
      },
    });

    return { message: 'Registration finalized successfully.' };
  }
}
