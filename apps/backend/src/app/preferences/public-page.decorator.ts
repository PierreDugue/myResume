import { applyDecorators, UseGuards } from '@nestjs/common';
import type { PublicPageId } from '@my-resume/api-models';
import { PageEnabledGuard } from './page-enabled.guard';
import { PublicPageMetadata } from './public-page.metadata';

/**
 * Marks a controller as the API of one public page (see docs/api-contract.md, Preferences):
 * while the admin has disabled that page, visitors get `404 "This page is disabled"` and a request
 * with a valid admin token is still served. The module must import PreferencesModule.
 */
export function PublicPage(id: PublicPageId) {
  return applyDecorators(PublicPageMetadata(id), UseGuards(PageEnabledGuard));
}
