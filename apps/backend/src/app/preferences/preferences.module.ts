import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, systemClock } from '../common/clock';
import { SkillsModule } from '../skills/skills.module';
import { SitePreferencesEntity } from './entities/site-preferences.entity';
import { PageEnabledGuard } from './page-enabled.guard';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

/**
 * Site preferences. Modules whose controllers use @PublicPage() import this module, for the
 * controller-scoped PageEnabledGuard.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SitePreferencesEntity]), SkillsModule],
  controllers: [PreferencesController],
  providers: [PreferencesService, PageEnabledGuard, { provide: CLOCK, useValue: systemClock }],
  exports: [PreferencesService],
})
export class PreferencesModule {}
