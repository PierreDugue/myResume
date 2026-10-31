import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtPayload } from './jwt-payload';
import { Public } from './public.decorator';

export type AuthenticatedRequest = Request & { user?: JwtPayload };

/**
 * Global guard: every route needs a valid Bearer token unless it is marked @Public().
 *
 * On a @Public() route the token is optional: a valid one sets `request.user` (so the admin can,
 * for example, preview a disabled page), and a missing, malformed, invalid or expired one is
 * ignored: the request goes on as a visitor's. A public route never answers 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride(Public, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.verify(request);
    if (user) request.user = user;
    if (isPublic || user) return true;
    throw new UnauthorizedException();
  }

  /** The claims of a valid `Authorization: Bearer <token>`, or null. */
  private async verify(request: AuthenticatedRequest): Promise<JwtPayload | null> {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) return null;
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, { algorithms: ['HS256'] });
    } catch {
      return null;
    }
  }
}
