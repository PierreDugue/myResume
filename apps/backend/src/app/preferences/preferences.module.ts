import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SitePreferencesEntity } from './entities/site-preferences.entity';
import { PageEnabledGuard } from './page-enabled.guard';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

/**
 * Site preferences. Modules whose controllers use @PublicPage() import this module, for the
 * controller-scoped PageEnabledGuard.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SitePreferencesEntity])],
  controllers: [PreferencesController],
  providers: [PreferencesService, PageEnabledGuard],
  exports: [PreferencesService],
})
export class PreferencesModule {}
