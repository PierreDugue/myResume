import { Reflector } from '@nestjs/core';
import { Public } from '../auth/public.decorator';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('is public: Docker and the frontend status indicator call it without a token', () => {
    const reflector = new Reflector();
    const isPublic =
      reflector.get(Public, HealthController.prototype.check) ??
      reflector.get(Public, HealthController);
    expect(isPublic).toBe(true);
  });
});
