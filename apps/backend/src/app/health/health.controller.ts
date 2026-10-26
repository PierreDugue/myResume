import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { AllowDirectAccess } from '../auth/allow-direct-access.decorator';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** `GET /api/health`: 200 when every check is up, 503 otherwise (see docs/api-contract.md). */
  @Public()
  @AllowDirectAccess() // platform health checks call the backend directly, not through nginx
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database').withTimeout(1500)]);
  }
}
