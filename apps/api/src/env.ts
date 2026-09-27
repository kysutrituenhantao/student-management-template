export interface Env {
  DB: D1Database;
  /** Static assets (the Next.js export). Present in production only. */
  ASSETS?: Fetcher;
  /** Per-IP limit on sign-in attempts (`ratelimits` in wrangler.jsonc). */
  LOGIN_LIMITER?: RateLimit;

  ENVIRONMENT: "development" | "test" | "production";
  LOG_LEVEL?: "debug" | "info" | "warn" | "error" | "silent";
  SITE_URL: string;

  // Secrets
  /** A teacher types this to create an account. Unset means nobody can register. */
  TEACHER_INVITE_CODE?: string;
}
