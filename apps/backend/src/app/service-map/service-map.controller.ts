import { Controller, Get } from '@nestjs/common';
import type { ServiceMapResponse } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { ServiceMapService } from './service-map.service';

@Controller('service-map')
export class ServiceMapController {
  constructor(private readonly serviceMap: ServiceMapService) {}

  @Public()
  @Get()
  get(): Promise<ServiceMapResponse> {
    return this.serviceMap.get();
  }
}
