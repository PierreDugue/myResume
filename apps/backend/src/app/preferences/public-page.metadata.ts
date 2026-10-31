import { Reflector } from '@nestjs/core';
import type { PublicPageId } from '@my-resume/api-models';

/** The public page a controller (or route) serves. Set by @PublicPage(), read by PageEnabledGuard. */
export const PublicPageMetadata = Reflector.createDecorator<PublicPageId>();
