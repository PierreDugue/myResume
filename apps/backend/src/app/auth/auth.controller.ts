import { Body, Controller, Get, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser, LoginResponse } from '@my-resume/api-models';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './jwt-payload';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 5 attempts per minute per IP. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload | undefined): Promise<AuthUser> {
    if (!user) throw new UnauthorizedException();
    return this.auth.me(user.sub);
  }
}
