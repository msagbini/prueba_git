import { z } from 'zod';

/**
 * Schema for every environment variable the API depends on. Validated once
 * at boot (see {@link AppConfigModule}) so a missing/malformed env var fails
 * fast on startup instead of surfacing as a confusing runtime error later.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  /** Connection string used by the running API — the restricted `dos_app` Postgres role (no BYPASSRLS). */
  DATABASE_URL: z.string().url(),
  /** Connection string used only by Prisma migration tooling — the privileged `dos_migrator` role (BYPASSRLS). */
  MIGRATION_DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates raw `process.env` against {@link envSchema}, throwing a
 * readable aggregate error on the first failure instead of letting the app
 * boot in a half-configured state.
 * @param config raw environment variables as provided by dotenv/the OS
 * @returns the parsed, typed and defaulted environment configuration
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${message}`);
  }
  return parsed.data;
}
