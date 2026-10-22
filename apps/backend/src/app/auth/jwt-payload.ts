/** Claims of our access tokens. */
export interface JwtPayload {
  /** Admin id. */
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const JWT_EXPIRES_IN_SECONDS = 86_400;
