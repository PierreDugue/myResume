import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { PreferencesService } from './preferences.service';
import { PublicPageMetadata } from './public-page.metadata';

export const PAGE_DISABLED_MESSAGE = 'This page is disabled';

/**
 * Refuses a disabled public page's endpoints to visitors (404). The admin (a verified token, set
 * as `request.user` by the global JwtAuthGuard, even on public routes) is always let through to
 * preview the page. Applied per controller by @PublicPage(), so it runs after the global guards.
 */
@Injectable()
export class PageEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly preferences: PreferencesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const page = this.reflector.getAllAndOverride(PublicPageMetadata, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!page) return true;
    if (context.switchToHttp().getRequest<AuthenticatedRequest>().user) return true;
    if (!(await this.preferences.isPageEnabled(page))) {
      throw new NotFoundException(PAGE_DISABLED_MESSAGE);
    }
    return true;
  }
}
