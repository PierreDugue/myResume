import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AppEnv, validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { buildTypeOrmOptions } from './database/typeorm-options';
import { HealthModule } from './health/health.module';
import { ResumeModule } from './resume/resume.module';
import { LogsModule } from './logs/logs.module';
import { TracesModule } from './traces/traces.module';
import { ServiceMapModule } from './service-map/service-map.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Local dev: apps/backend/.env, then the root .env (POSTGRES_* fallbacks). In Docker,
      // the variables come from docker-compose.yml and these files do not exist.
      envFilePath: ['apps/backend/.env', '.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) =>
        buildTypeOrmOptions({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          PORT: config.get('PORT', { infer: true }),
          DATABASE_HOST: config.get('DATABASE_HOST', { infer: true }),
          DATABASE_PORT: config.get('DATABASE_PORT', { infer: true }),
          DATABASE_USER: config.get('DATABASE_USER', { infer: true }),
          DATABASE_PASSWORD: config.get('DATABASE_PASSWORD', { infer: true }),
          DATABASE_NAME: config.get('DATABASE_NAME', { infer: true }),
          DATABASE_SSL: config.get('DATABASE_SSL', { infer: true }),
          JWT_SECRET: config.get('JWT_SECRET', { infer: true }),
          PASSWORD_PEPPER: config.get('PASSWORD_PEPPER', { infer: true }),
        }),
    }),
    AuthModule,
    HealthModule,
    ResumeModule,
    DashboardModule,
    LogsModule,
    TracesModule,
    ServiceMapModule,
  ],
})
export class AppModule {}
