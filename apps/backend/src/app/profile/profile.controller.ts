import { Body, Controller, Get, Put } from '@nestjs/common';
import type { Profile } from '@my-resume/api-models';
import { UpdateProfileDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';

/** Admin only: the public profile is part of GET /api/resume (without the hidden phone). */
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
