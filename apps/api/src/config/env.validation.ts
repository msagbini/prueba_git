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

  // Stripe (Fase 4 monetization) — all optional. Without a real Stripe
  // account these are unset in every environment this project has been
  // run in so far; BillingService degrades to a clear 503 rather than
  // crashing the whole app over an unconfigured optional feature. See
  // docs/technical-log/phase-4.md for what is/isn't live-verified.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Where Stripe Checkout redirects after a successful subscription purchase. */
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().default('http://localhost:5173/billing?checkout=success'),
  /** Where Stripe Checkout redirects if the customer cancels out of the flow. */
  STRIPE_CHECKOUT_CANCEL_URL: z.string().default('http://localhost:5173/billing?checkout=canceled'),

  // Transactional email (Fase 9) — all optional, like Stripe above. Without
  // SMTP_HOST, AuthModule binds ConsoleEmailService (logs instead of
  // sending) rather than crashing the app over an unconfigured optional
  // feature. No real SMTP credentials exist in this project — see
  // docs/technical-log/phase-9.md for what is/isn't live-verified.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  /** Whether to use implicit TLS (port 465) vs. STARTTLS (587/25, the default). */
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** The "From" address on outgoing mail — must be a domain the SMTP account is authorized to send as. */
  SMTP_FROM: z.string().default('DOS <no-reply@dos.example.com>'),
  /** Base URL of the web app, used to build links embedded in emails (verify/reset/invitation). */
  WEB_APP_URL: z.string().default('http://localhost:5173'),

  /** Local disk directory job-attachment uploads are written under, one subfolder per organization. */
  UPLOADS_DIR: z.string().default('./uploads'),

  /** Minimum severity written to the structured (pino) logger. */
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Error tracking (Fase 9.1) — optional, like Stripe/SMTP above. Without
  // SENTRY_DSN, ErrorReportingService degrades to a no-op (unhandled
  // errors are still captured by the structured logger, just not shipped
  // anywhere external) rather than crashing the app over an unconfigured
  // optional feature. No real Sentry account exists in this project — see
  // docs/technical-log/phase-9.md for what is/isn't live-verified.
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
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
