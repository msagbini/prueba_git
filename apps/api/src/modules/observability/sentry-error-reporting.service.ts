import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import type { EnvConfig } from '../../config/env.validation';
import { ErrorReportContext, ErrorReportingService } from './error-reporting.service';

/**
 * Real {@link ErrorReportingService} over the Sentry SDK, bound in
 * `ObservabilityModule` whenever `SENTRY_DSN` is set — see
 * {@link NoopErrorReportingService} for the fallback used otherwise. No
 * real Sentry account exists in this project (same honesty standard as
 * `SmtpEmailService`/Stripe billing): `Sentry.init()` and
 * `captureException()` are real, correct calls against the real SDK, but
 * actual delivery to a Sentry project is unverified — only that this
 * class is bound instead of the no-op one when `SENTRY_DSN` is present.
 */
@Injectable()
export class SentryErrorReportingService extends ErrorReportingService {
  private readonly logger = new Logger(SentryErrorReportingService.name);

  /**
   * Initializes the Sentry SDK from validated env config.
   * @param config the application's validated environment configuration
   */
  constructor(config: ConfigService<EnvConfig, true>) {
    super();
    const dsn = config.get('SENTRY_DSN', { infer: true });
    Sentry.init({
      dsn,
      environment: config.get('NODE_ENV', { infer: true }),
      tracesSampleRate: config.get('SENTRY_TRACES_SAMPLE_RATE', { infer: true }),
    });
    // Nest constructs this provider unconditionally (see
    // ObservabilityModule's factory, which picks it or NoopErrorReportingService
    // based on this same check) — only log "initialized" when it's actually
    // the one that ends up bound, so this line doesn't lie on every boot
    // that has no real Sentry account configured.
    if (dsn) {
      this.logger.log('Sentry error tracking initialized.');
    }
  }

  /**
   * Reports the exception to Sentry, tagging it with request metadata when available.
   * @param error the caught exception
   * @param context request metadata to attach, if the exception happened during a request
   */
  captureException(error: unknown, context?: ErrorReportContext): void {
    Sentry.captureException(error, context ? { contexts: { request: { ...context } } } : undefined);
  }
}
