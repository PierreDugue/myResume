import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PublicPageId, SitePreferences } from '@my-resume/api-models';
import { Repository } from 'typeorm';
import { SkillsService } from '../skills/skills.service';
import {
  sentOverviewPreferences,
  sentPageFlags,
  parseStoredSkillsOverTime,
  toSitePreferences,
  UpdateSitePreferencesDto,
} from './dto/preferences.dto';
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
    private readonly skills: SkillsService,
  ) {}

  async get(): Promise<SitePreferences> {
    return this.toResponse(await this.find());
  }

  /**
   * Validates the whole body, then merges what was sent into what is stored, in SQL (`jsonb ||`) and
   * in one statement: nothing is written if any part is invalid, and keys left out keep their value.
   * The `ON CONFLICT ((true))` target is the singleton index.
   */
  async update(dto: UpdateSitePreferencesDto): Promise<SitePreferences> {
    const overview = sentOverviewPreferences(dto.overview);
    await this.skills.findByIdsOrFail(overview.skillsOverTime);

    const rows = (await this.preferences.query(
      `INSERT INTO "site_preferences" ("pages", "overview") VALUES ($1::jsonb, $2::jsonb)
       ON CONFLICT ((true)) DO UPDATE
       SET "pages" = "site_preferences"."pages" || EXCLUDED."pages",
           "overview" = "site_preferences"."overview" || EXCLUDED."overview",
           "updatedAt" = now()
       RETURNING *`,
      [JSON.stringify(sentPageFlags(dto.pages)), JSON.stringify(overview)],
    )) as SitePreferencesEntity[];
    return this.toResponse(rows[0] ?? null);
  }

  /** Reads the page flags only: called on every gated request, so it must not look up skills. */
  async isPageEnabled(id: PublicPageId): Promise<boolean> {
    return toSitePreferences(await this.find()).pages[id];
  }

  /**
   * The stored "Skills over time" ids as they are, without checking that the skills still exist:
   * the dashboard needs no extra query, since `buildDashboard` ignores unknown ids.
   */
  async storedSkillsOverTime(): Promise<string[]> {
    return parseStoredSkillsOverTime(await this.find());
  }

  /** The stored selection, minus the skills that no longer exist, in skills-list order. */
  private async toResponse(row: SitePreferencesEntity | null): Promise<SitePreferences> {
    return toSitePreferences(row, await this.skills.existingIds(parseStoredSkillsOverTime(row)));
  }

  private async find(): Promise<SitePreferencesEntity | null> {
    const [first] = await this.preferences.find({ order: { createdAt: 'ASC' }, take: 1 });
    return first ?? null;
  }
}
