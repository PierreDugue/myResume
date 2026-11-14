import { Body, Controller, Get, Put, UseInterceptors } from '@nestjs/common';
import type { Profile } from '@my-resume/api-models';
import { UpdateProfileDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';
import { InvalidateResumeCacheInterceptor } from '../resume/invalidate-resume-cache.interceptor';

/** Admin only: the public profile is part of GET /api/resume (without the hidden phone). */
@UseInterceptors(InvalidateResumeCacheInterceptor)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(): Promise<Profile> {
    return this.profile.get();
  }

  @Put()
  replace(@Body() dto: UpdateProfileDto): Promise<Profile> {
    return this.profile.replace(dto);
  }
}
