import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** `GET /api/health`: 200 when every check is up, 503 otherwise (see docs/api-contract.md). */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database').withTimeout(1500)]);
  }
}
