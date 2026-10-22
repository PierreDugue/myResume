import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthUser, LoginRequest, LoginResponse } from '@my-resume/api-models';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type { AppEnv } from '../config/env.validation';
import { AdminUser } from './entities/admin-user.entity';
import { JWT_EXPIRES_IN_SECONDS, JwtPayload } from './jwt-payload';
import { hashPassword, verifyPassword } from './password';

@Injectable()
export class AuthService {
  private readonly pepper: string;
  /** Hash of a random secret, compared when the email is unknown so the response time reveals nothing. */
  private readonly dummyHash: Promise<string>;

  constructor(
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    private readonly jwt: JwtService,
    config: ConfigService<AppEnv, true>,
  ) {
    this.pepper = config.get('PASSWORD_PEPPER', { infer: true });
    this.dummyHash = hashPassword(randomUUID(), this.pepper);
  }

  async login({ email, password }: LoginRequest): Promise<LoginResponse> {
    const admin = await this.admins.findOneBy({ email: email.trim().toLowerCase() });
    const valid = await verifyPassword(
      password,
      admin?.passwordHash ?? (await this.dummyHash),
      this.pepper,
    );
    if (!admin || !valid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = { sub: admin.id, email: admin.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: JWT_EXPIRES_IN_SECONDS,
    };
  }

  async me(id: string): Promise<AuthUser> {
    const admin = await this.admins.findOneBy({ id });
    if (!admin) throw new UnauthorizedException();
    return { id: admin.id, email: admin.email };
  }
}
