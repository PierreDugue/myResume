import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminAccountService } from './admin-account.service';
import { AdminUser } from './entities/admin-user.entity';
import { hashPassword, verifyPassword } from './password';

// Logins hash and compare passwords many times. bcrypt cost 12 (production) takes ~250 ms per
// hash, enough to push these tests past Vitest's 5 s timeout on CI runners. The minimum cost (4)
// keeps the same behavior in ~1 ms. password.spec.ts covers the production cost.
vi.mock('bcryptjs', async (importOriginal) => {
  const bcrypt = await importOriginal<typeof import('bcryptjs')>();
  return { ...bcrypt, hash: (password: string) => bcrypt.hash(password, 4) };
});

const PEPPER = 'test-pepper-that-is-at-least-32-chars!';

describe('AdminAccountService (startup sync of the single admin account)', () => {
  const repo = {
    find: vi.fn(),
    create: vi.fn((data: Partial<AdminUser>) => Object.assign(new AdminUser(), data)),
    save: vi.fn(async (u: AdminUser) => u),
  };
  let env: Record<string, string | undefined>;

  async function build() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminAccountService,
        { provide: getRepositoryToken(AdminUser), useValue: repo },
        { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
      ],
    }).compile();
    return moduleRef.get(AdminAccountService);
  }

  beforeEach(() => {
    repo.find.mockReset();
    repo.save.mockClear();
    repo.create.mockClear();
    env = {
      ADMIN_EMAIL: 'pierre@example.com',
      ADMIN_PASSWORD: 'correct horse battery staple',
      PASSWORD_PEPPER: PEPPER,
    };
  });

  it('creates the admin with a hashed password when none exists', async () => {
    repo.find.mockResolvedValue([]);

    expect(await (await build()).sync()).toBe('created');

    const saved = repo.save.mock.calls[0][0] as AdminUser;
    expect(saved.email).toBe('pierre@example.com');
    expect(saved.passwordHash).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery staple', saved.passwordHash, PEPPER)).toBe(
      true,
    );
  });

  it('does nothing when the existing admin already matches the environment', async () => {
    repo.find.mockResolvedValue([
      Object.assign(new AdminUser(), {
        email: 'pierre@example.com',
        passwordHash: await hashPassword('correct horse battery staple', PEPPER),
      }),
    ]);

    expect(await (await build()).sync()).toBe('unchanged');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('updates the password when ADMIN_PASSWORD changed (password reset through the environment)', async () => {
    const existing = Object.assign(new AdminUser(), {
      id: 'a1',
      email: 'pierre@example.com',
      passwordHash: await hashPassword('old password 123', PEPPER),
    });
    repo.find.mockResolvedValue([existing]);

    expect(await (await build()).sync()).toBe('updated');

    const saved = repo.save.mock.calls[0][0] as AdminUser;
    expect(saved.id).toBe('a1');
    expect(await verifyPassword('correct horse battery staple', saved.passwordHash, PEPPER)).toBe(
      true,
    );
  });

  it('rehashes the password when the pepper changed (pepper rotation)', async () => {
    repo.find.mockResolvedValue([
      Object.assign(new AdminUser(), {
        id: 'a1',
        email: 'pierre@example.com',
        passwordHash: await hashPassword(
          'correct horse battery staple',
          'old-pepper-that-is-at-least-32-chars!',
        ),
      }),
    ]);

    expect(await (await build()).sync()).toBe('updated');
    const saved = repo.save.mock.calls[0][0] as AdminUser;
    expect(await verifyPassword('correct horse battery staple', saved.passwordHash, PEPPER)).toBe(
      true,
    );
  });

  it('updates the email when ADMIN_EMAIL changed', async () => {
    repo.find.mockResolvedValue([
      Object.assign(new AdminUser(), {
        id: 'a1',
        email: 'old@example.com',
        passwordHash: await hashPassword('correct horse battery staple', PEPPER),
      }),
    ]);

    expect(await (await build()).sync()).toBe('updated');
    expect((repo.save.mock.calls[0][0] as AdminUser).email).toBe('pierre@example.com');
  });

  it('keeps the existing admin untouched when no credentials are configured', async () => {
    env = { PASSWORD_PEPPER: PEPPER };
    repo.find.mockResolvedValue([Object.assign(new AdminUser(), { email: 'pierre@example.com' })]);

    expect(await (await build()).sync()).toBe('not-configured');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('reports a missing admin when no credentials are configured and none exists', async () => {
    env = { PASSWORD_PEPPER: PEPPER };
    repo.find.mockResolvedValue([]);

    expect(await (await build()).sync()).toBe('missing');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('runs the sync when the application starts', async () => {
    repo.find.mockResolvedValue([]);
    const service = await build();
    const sync = vi.spyOn(service, 'sync');
    await service.onApplicationBootstrap();
    expect(sync).toHaveBeenCalledOnce();
  });
});
