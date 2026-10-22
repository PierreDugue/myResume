import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AppEnv } from '../config/env.validation';
import { AdminUser } from './entities/admin-user.entity';
import { hashPassword, verifyPassword } from './password';

export type AdminSyncResult = 'created' | 'updated' | 'unchanged' | 'not-configured' | 'missing';

/**
 * Keeps the single admin account in sync with ADMIN_EMAIL / ADMIN_PASSWORD on startup: creates it,
 * or updates its email/password when they changed (this is also how the password is reset).
 */
@Injectable()
export class AdminAccountService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminAccountService.name);

  constructor(
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.sync();
    const messages: Record<AdminSyncResult, string> = {
      created: 'Admin account created',
      updated: 'Admin account updated from ADMIN_EMAIL / ADMIN_PASSWORD',
      unchanged: 'Admin account up to date',
      'not-configured': 'ADMIN_EMAIL / ADMIN_PASSWORD not set: existing admin account kept',
      missing: 'No admin account: set ADMIN_EMAIL and ADMIN_PASSWORD to create one',
    };
    if (result === 'missing') this.logger.warn(messages[result]);
    else this.logger.log(messages[result]);
  }

  async sync(): Promise<AdminSyncResult> {
    const email = this.config.get('ADMIN_EMAIL', { infer: true });
    const password = this.config.get('ADMIN_PASSWORD', { infer: true });
    const pepper = this.config.get('PASSWORD_PEPPER', { infer: true });
    const [existing] = await this.admins.find({ order: { createdAt: 'ASC' }, take: 1 });

    if (!email || !password) return existing ? 'not-configured' : 'missing';

    if (!existing) {
      await this.admins.save(
        this.admins.create({ email, passwordHash: await hashPassword(password, pepper) }),
      );
      return 'created';
    }

    let changed = false;
    if (existing.email !== email) {
      existing.email = email;
      changed = true;
    }
    // Also true after a pepper rotation: the old hash no longer verifies, so it is rebuilt.
    if (!(await verifyPassword(password, existing.passwordHash, pepper))) {
      existing.passwordHash = await hashPassword(password, pepper);
      changed = true;
    }
    if (!changed) return 'unchanged';
    await this.admins.save(existing);
    return 'updated';
  }
}
