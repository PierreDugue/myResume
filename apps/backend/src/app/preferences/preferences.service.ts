import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PagePreferences, PublicPageId, SitePreferences } from '@my-resume/api-models';
import { Repository } from 'typeorm';
import { CLOCK, Clock } from '../common/clock';
import { SkillsService } from '../skills/skills.service';
import {
  sentOverviewPreferences,
  sentPageFlags,
  parseStoredSkillsOverTime,
  toSitePreferences,
  UpdateSitePreferencesDto,
} from './dto/preferences.dto';
import { SitePreferencesEntity } from './entities/site-preferences.entity';

/** How long `isPageEnabled` reuses the stored page flags. */
const PAGE_FLAGS_TTL_MS = 5000;

/**
 * The site preferences are a single row, enforced by a unique index on a constant expression
 * (`UQ_site_preferences_singleton`). PATCH creates the row if needed and merges into it with one
 * atomic upsert, so concurrent requests can't create a second row or lose each other's keys. No
 * row means "all defaults".
 *
 * Reads are fresh (one small row), except the page flags behind `isPageEnabled`, which every gated
 * request and every `subscribe:metrics` message asks for: a short TTL cache (5 s) bounds the reads
 * they trigger, however many sockets or requests there are. `update()` clears it, so the instance
 * that handled a change is never stale, and another instance is at most 5 s behind.
 */
@Injectable()
export class PreferencesService {
  /** The pending or finished flag read, shared by concurrent callers; null when none is cached. */
  private pageFlags: { flags: Promise<PagePreferences>; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(SitePreferencesEntity)
    private readonly preferences: Repository<SitePreferencesEntity>,
    private readonly skills: SkillsService,
    @Inject(CLOCK) private readonly clock: Clock,
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
    // Dropping the entry also detaches a read still running: it can't store its older value.
    this.pageFlags = null;
    return this.toResponse(rows[0] ?? null);
  }

  /**
   * Reads the page flags only: called on every gated request and socket subscription, so it must
   * not look up skills, and it is cached for 5 s (see the class comment).
   */
  async isPageEnabled(id: PublicPageId): Promise<boolean> {
    return (await this.cachedPageFlags())[id];
  }

  private cachedPageFlags(): Promise<PagePreferences> {
    const now = this.clock.now().getTime();
    if (this.pageFlags && now < this.pageFlags.expiresAt) return this.pageFlags.flags;

    const flags = this.find().then((row) => toSitePreferences(row).pages);
    const entry = { flags, expiresAt: now + PAGE_FLAGS_TTL_MS };
    this.pageFlags = entry;
    // A failed read is not kept (unless update() already replaced the entry).
    flags.catch(() => {
      if (this.pageFlags === entry) this.pageFlags = null;
    });
    return flags;
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
