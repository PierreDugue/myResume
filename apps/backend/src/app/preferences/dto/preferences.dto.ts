import type {
  OverviewPreferences,
  PagePreferences,
  PublicPageId,
  SitePreferences,
  UpdateSitePreferencesRequest,
} from '@my-resume/api-models';
import { SKILLS_OVER_TIME_MAX } from '@my-resume/resume-metrics';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsObject,
  isUUID,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { IsOptionalButNotNull } from '../../common/validators';
import type { SitePreferencesEntity } from '../entities/site-preferences.entity';

/**
 * Every page is visible until the admin hides it. Typed as the full record, so a page id added to
 * `PublicPageId` breaks the build until it gets its default here.
 */
export const DEFAULT_PAGE_PREFERENCES: Readonly<PagePreferences> = Object.freeze({
  overview: true,
  explore: true,
  traces: true,
  serviceMap: true,
  quality: true,
  siteMetrics: true,
  about: true,
});

const PAGE_IDS = Object.keys(DEFAULT_PAGE_PREFERENCES) as PublicPageId[];

/** Partial page flags: each key optional, but a boolean when sent (never null). */
export class UpdatePagePreferencesDto implements Partial<PagePreferences> {
  @IsOptionalButNotNull()
  @IsBoolean()
  overview?: boolean;

  @IsOptionalButNotNull()
  @IsBoolean()
  explore?: boolean;

  @IsOptionalButNotNull()
  @IsBoolean()
  traces?: boolean;

  @IsOptionalButNotNull()
  @IsBoolean()
  serviceMap?: boolean;

  @IsOptionalButNotNull()
  @IsBoolean()
  quality?: boolean;

  @IsOptionalButNotNull()
  @IsBoolean()
  siteMetrics?: boolean;

  @IsOptionalButNotNull()
  @IsBoolean()
  about?: boolean;
}

/** Partial overview settings: each key optional, but valid when sent (never null). */
export class UpdateOverviewPreferencesDto implements Partial<OverviewPreferences> {
  /** At most SKILLS_OVER_TIME_MAX distinct skill ids; unknown ids are refused by the service (400). */
  @IsOptionalButNotNull()
  @IsArray()
  @ArrayMaxSize(SKILLS_OVER_TIME_MAX)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  skillsOverTime?: string[];
}

/** PATCH body: unknown groups and page ids are refused by the global ValidationPipe (400). */
export class UpdateSitePreferencesDto implements UpdateSitePreferencesRequest {
  @IsOptionalButNotNull()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdatePagePreferencesDto)
  pages?: UpdatePagePreferencesDto;

  @IsOptionalButNotNull()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateOverviewPreferencesDto)
  overview?: UpdateOverviewPreferencesDto;
}

/**
 * Every page id with its stored flag, or the default; stored keys that aren't page ids are dropped.
 * `skillsOverTime` is the selection already resolved against the existing skills (the mapper stays
 * pure): empty = automatic.
 */
export function toSitePreferences(
  entity: SitePreferencesEntity | null,
  skillsOverTime: readonly string[] = [],
): SitePreferences {
  const stored: Record<string, unknown> = entity?.pages ?? {};
  const pages = { ...DEFAULT_PAGE_PREFERENCES };
  for (const id of PAGE_IDS) {
    const value = stored[id];
    if (typeof value === 'boolean') pages[id] = value;
  }
  return { pages, overview: { skillsOverTime: [...skillsOverTime] } };
}

/** Only the page flags actually sent (class-transformer leaves absent keys undefined). */
export function sentPageFlags(dto: UpdatePagePreferencesDto | undefined): Partial<PagePreferences> {
  const flags: Partial<PagePreferences> = {};
  for (const id of PAGE_IDS) {
    const value = dto?.[id];
    if (typeof value === 'boolean') flags[id] = value;
  }
  return flags;
}

/** The stored selection, without anything that isn't a uuid string (hand-edited or old data), nor duplicates. */
export function parseStoredSkillsOverTime(entity: SitePreferencesEntity | null): string[] {
  const stored: unknown = entity?.overview?.['skillsOverTime'];
  if (!Array.isArray(stored)) return [];
  const ids = stored.filter((id): id is string => typeof id === 'string' && isUUID(id, 'all'));
  return [...new Set(ids)];
}

/** Only the overview settings actually sent (class-transformer leaves absent keys undefined). */
export function sentOverviewPreferences(
  dto: UpdateOverviewPreferencesDto | undefined,
): Partial<OverviewPreferences> {
  const sent: Partial<OverviewPreferences> = {};
  if (Array.isArray(dto?.skillsOverTime)) sent.skillsOverTime = dto.skillsOverTime;
  return sent;
}
