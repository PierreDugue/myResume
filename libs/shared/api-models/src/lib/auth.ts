/** Body of `POST /api/auth/login`. Email is case-insensitive. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Response of `POST /api/auth/login`. */
export interface LoginResponse {
  /** JWT, sent as `Authorization: Bearer <accessToken>`. */
  accessToken: string;
  /** Lifetime of the token in seconds (86400). */
  expiresIn: number;
}

/** The signed-in admin (`GET /api/auth/me`). */
export interface AuthUser {
  id: string;
  email: string;
}
