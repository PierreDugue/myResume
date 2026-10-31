import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { SitePreferences } from '@my-resume/api-models';
import { Public } from '../auth/public.decorator';
import { UpdateSitePreferencesDto } from './dto/preferences.dto';
import { PreferencesService } from './preferences.service';

/** Site preferences (docs/api-contract.md, Preferences): public read, admin partial update. */
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Public()
  @Get()
  get(): Promise<SitePreferences> {
    return this.preferences.get();
  }

  @Patch()
  update(@Body() dto: UpdateSitePreferencesDto): Promise<SitePreferences> {
    return this.preferences.update(dto);
  }
}
