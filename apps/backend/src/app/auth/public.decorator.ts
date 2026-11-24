import { Reflector } from '@nestjs/core';

/**
 * Marks a route (or controller) as public: the global JwtAuthGuard lets it through without a token.
 * Only for GET routes, plus POST /api/auth/login and POST /api/assistant/ask, both rate-limited
 * per visitor IP (see docs/api-contract.md).
 */
export const Public = Reflector.createDecorator<void, boolean>({ transform: () => true });
