import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload';

/** The verified token claims of the current request (only on protected routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
