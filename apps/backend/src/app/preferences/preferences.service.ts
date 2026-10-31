import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicPageId, SitePreferences } from '@my-resume/api-models';
import { Repository } from 'typeorm';
import { sentPageFlags, toSitePreferences, UpdateSitePreferencesDto } from './dto/preferences.dto';
import { SitePreferencesEntity } from './entities/site-preferences.entity';

/**
 * The site preferences are a single row, enforced by a unique index on a constant expression
 * (`UQ_site_preferences_singleton`). PATCH creates the row if needed and merges into it with one
 * atomic upsert, so concurrent requests can't create a second row or lose each other's keys. No
 * row means "all defaults". Read on every call (no cache): one small row, never stale across
 * instances.
 */
@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(SitePreferencesEntity)
    private readonly preferences: Repository<SitePreferencesEntity>,
  ) {}

  async get(): Promise<SitePreferences> {
    return toSitePreferences(await this.find());
  }

  /**
   * Merges what was sent into what is stored, in SQL (`jsonb ||`): keys left out keep their value.
   * The `ON CONFLICT ((true))` target is the singleton index.
   */
  async update(dto: UpdateSitePreferencesDto): Promise<SitePreferences> {
    const rows = (await this.preferences.query(
      `INSERT INTO "site_preferences" ("pages") VALUES ($1::jsonb)
       ON CONFLICT ((true)) DO UPDATE
       SET "pages" = "site_preferences"."pages" || EXCLUDED."pages", "updatedAt" = now()
       RETURNING *`,
      [JSON.stringify(sentPageFlags(dto.pages))],
    )) as SitePreferencesEntity[];
    return toSitePreferences(rows[0] ?? null);
  }

  async isPageEnabled(id: PublicPageId): Promise<boolean> {
    return (await this.get()).pages[id];
  }

  private async find(): Promise<SitePreferencesEntity | null> {
    const [first] = await this.preferences.find({ order: { createdAt: 'ASC' }, take: 1 });
    return first ?? null;
  }
}
