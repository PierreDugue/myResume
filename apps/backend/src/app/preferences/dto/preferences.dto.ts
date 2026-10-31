import type {
  PagePreferences,
  PublicPageId,
  SitePreferences,
  UpdateSitePreferencesRequest,
} from '@my-resume/api-models';
import { Type } from 'class-transformer';
import { IsBoolean, IsObject, ValidateNested } from 'class-validator';
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
  about?: boolean;
}

/** PATCH body: unknown groups and page ids are refused by the global ValidationPipe (400). */
export class UpdateSitePreferencesDto implements UpdateSitePreferencesRequest {
  @IsOptionalButNotNull()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdatePagePreferencesDto)
  pages?: UpdatePagePreferencesDto;
}

/** Every page id with its stored flag, or the default; stored keys that aren't page ids are dropped. */
export function toSitePreferences(entity: SitePreferencesEntity | null): SitePreferences {
  const stored: Record<string, unknown> = entity?.pages ?? {};
  const pages = { ...DEFAULT_PAGE_PREFERENCES };
  for (const id of PAGE_IDS) {
    const value = stored[id];
    if (typeof value === 'boolean') pages[id] = value;
  }
  return { pages };
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
