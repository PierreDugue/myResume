import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppEnv } from '../config/env.validation';
import { AdminAccountService } from './admin-account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminUser } from './entities/admin-user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JWT_EXPIRES_IN_SECONDS } from './jwt-payload';

/**
 * Login, the admin account, and the app-wide guards: rate limiting (300 requests/min per IP by
 * default) and JWT authentication on every route not marked @Public().
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN_SECONDS },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }] }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminAccountService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
