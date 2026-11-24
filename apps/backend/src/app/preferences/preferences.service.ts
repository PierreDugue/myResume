import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PagePreferences, PublicPageId, SitePreferences } from '@my-resume/api-models';
import { Repository } from 'typeorm';
import { CLOCK, Clock } from '../common/clock';
import { ASSISTANT_CONFIGURED } from '../config/assistant-configured';
import { SkillsService } from '../skills/skills.service';
import {
  sentAssistantPreferences,
  sentOverviewPreferences,
  sentPageFlags,
  parseStoredSkillsOverTime,
  toSitePreferences,
  UpdateSitePreferencesDto,
} from './dto/preferences.dto';
import { SitePreferencesEntity } from './entities/site-preferences.entity';

/** How long `isPageEnabled` and `isAssistantEnabled` reuse the stored flags. */
const GATE_FLAGS_TTL_MS = 5000;

/** The stored switches that gate requests: what the TTL cache holds. */
interface GateFlags {
  pages: PagePreferences;
  assistant: boolean;
}

/**
 * The site preferences are a single row, enforced by a unique index on a constant expression
 * (`UQ_site_preferences_singleton`). PATCH creates the row if needed and merges into it with one
 * atomic upsert, so concurrent requests can't create a second row or lose each other's keys. No
 * row means "all defaults".
 *
 * Reads are fresh (one small row), except the gate flags behind `isPageEnabled` and
 * `isAssistantEnabled`, which every gated request, every `subscribe:metrics` message and every
 * assistant question asks for: one short TTL cache (5 s) for both bounds the reads
 * they trigger, however many sockets or requests there are. `update()` clears it, so the instance
 * that handled a change is never stale, and another instance is at most 5 s behind.
 */
@Injectable()
export class PreferencesService {
  /** The pending or finished flag read, shared by concurrent callers; null when none is cached. */
  private gateFlags: { flags: Promise<GateFlags>; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(SitePreferencesEntity)
    private readonly preferences: Repository<SitePreferencesEntity>,
    private readonly skills: SkillsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ASSISTANT_CONFIGURED) private readonly assistantConfigured: boolean,
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
      `INSERT INTO "site_preferences" ("pages", "overview", "assistant")
       VALUES ($1::jsonb, $2::jsonb, $3::jsonb)
       ON CONFLICT ((true)) DO UPDATE
       SET "pages" = "site_preferences"."pages" || EXCLUDED."pages",
           "overview" = "site_preferences"."overview" || EXCLUDED."overview",
           "assistant" = "site_preferences"."assistant" || EXCLUDED."assistant",
           "updatedAt" = now()
       RETURNING *`,
      [
        JSON.stringify(sentPageFlags(dto.pages)),
        JSON.stringify(overview),
        JSON.stringify(sentAssistantPreferences(dto.assistant)),
      ],
    )) as SitePreferencesEntity[];
    // Dropping the entry also detaches a read still running: it can't store its older value.
    this.gateFlags = null;
    return this.toResponse(rows[0] ?? null);
  }

  /**
   * Reads the page flags only: called on every gated request and socket subscription, so it must
   * not look up skills, and it is cached for 5 s (see the class comment).
   */
  async isPageEnabled(id: PublicPageId): Promise<boolean> {
    return (await this.cachedGateFlags()).pages[id];
  }

  /** The admin's assistant switch, from the same 5 s cache as `isPageEnabled`. */
  async isAssistantEnabled(): Promise<boolean> {
    return (await this.cachedGateFlags()).assistant;
  }

  private cachedGateFlags(): Promise<GateFlags> {
    const now = this.clock.now().getTime();
    if (this.gateFlags && now < this.gateFlags.expiresAt) return this.gateFlags.flags;

    const flags = this.find().then((row) => {
      const { pages, assistant } = toSitePreferences(row);
      return { pages, assistant: assistant.enabled };
    });
    const entry = { flags, expiresAt: now + GATE_FLAGS_TTL_MS };
    this.gateFlags = entry;
    // A failed read is not kept (unless update() already replaced the entry).
    flags.catch(() => {
      if (this.gateFlags === entry) this.gateFlags = null;
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
    const skillsOverTime = await this.skills.existingIds(parseStoredSkillsOverTime(row));
    return toSitePreferences(row, skillsOverTime, this.assistantConfigured);
  }

  private async find(): Promise<SitePreferencesEntity | null> {
    const [first] = await this.preferences.find({ order: { createdAt: 'ASC' }, take: 1 });
    return first ?? null;
  }
}
