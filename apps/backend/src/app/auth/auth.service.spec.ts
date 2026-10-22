import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AdminUser } from './entities/admin-user.entity';
import { hashPassword } from './password';

const SECRET = 'test-secret-that-is-at-least-32-chars!';
const PEPPER = 'test-pepper-that-is-at-least-32-chars!';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;
  let admin: AdminUser;
  const repo = { findOne: vi.fn(), findOneBy: vi.fn() };

  beforeAll(async () => {
    admin = Object.assign(new AdminUser(), {
      id: '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f',
      email: 'pierre@example.com',
      passwordHash: await hashPassword('correct horse battery staple', PEPPER),
    });
  });

  beforeEach(async () => {
    repo.findOne.mockReset();
    repo.findOneBy.mockReset();
    jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: 86400, algorithm: 'HS256' } });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwt },
        { provide: getRepositoryToken(AdminUser), useValue: repo },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => ({ PASSWORD_PEPPER: PEPPER })[key] },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('returns a 24 h HS256 token carrying the admin id and email', async () => {
      repo.findOneBy.mockResolvedValue(admin);

      const res = await service.login({
        email: 'pierre@example.com',
        password: 'correct horse battery staple',
      });

      expect(res.expiresIn).toBe(86400);
      const payload = await jwt.verifyAsync(res.accessToken, {
        secret: SECRET,
        algorithms: ['HS256'],
      });
      expect(payload).toMatchObject({ sub: admin.id, email: admin.email });
      expect(payload.exp - payload.iat).toBe(86400);
    });

    it('looks the admin up by lowercased, trimmed email', async () => {
      repo.findOneBy.mockResolvedValue(admin);
      await service.login({
        email: '  Pierre@Example.COM ',
        password: 'correct horse battery staple',
      });
      expect(repo.findOneBy).toHaveBeenCalledWith({ email: 'pierre@example.com' });
    });

    it('rejects a wrong password with "Invalid credentials"', async () => {
      repo.findOneBy.mockResolvedValue(admin);
      await expect(
        service.login({ email: 'pierre@example.com', password: 'wrong password' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('rejects the right password if the stored hash was made with another pepper', async () => {
      repo.findOneBy.mockResolvedValue(
        Object.assign(new AdminUser(), {
          ...admin,
          passwordHash: await hashPassword(
            'correct horse battery staple',
            'another-pepper-also-32-characters!!',
          ),
        }),
      );
      await expect(
        service.login({ email: 'pierre@example.com', password: 'correct horse battery staple' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('rejects an unknown email with the same message, still checking a password hash', async () => {
      repo.findOneBy.mockResolvedValue(null);
      const started = performance.now();
      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
      // A bcrypt comparison (cost 12) takes tens of ms: an instant answer would reveal unknown emails.
      expect(performance.now() - started).toBeGreaterThan(20);
    });
  });

  describe('me', () => {
    it('returns the admin without its password hash', async () => {
      repo.findOneBy.mockResolvedValue(admin);
      const me = await service.me(admin.id);
      expect(me).toEqual({ id: admin.id, email: admin.email });
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: admin.id });
    });

    it('rejects a token whose admin no longer exists', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.me(admin.id)).rejects.toThrow(UnauthorizedException);
    });
  });
});
