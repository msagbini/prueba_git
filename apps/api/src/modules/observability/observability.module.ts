import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';
import { ErrorReportingService } from './error-reporting.service';
import { NoopErrorReportingService } from './noop-error-reporting.service';
import { SentryErrorReportingService } from './sentry-error-reporting.service';

/**
 * Binds {@link ErrorReportingService} to the real Sentry-backed
 * implementation when `SENTRY_DSN` is configured, or a logging no-op
 * otherwise — the same optional-provider degradation `AuthModule` uses
 * for `EmailService`. Exported for `AllExceptionsFilter` (registered
 * globally in `AppModule`) to inject.
 */
@Module({
  providers: [
    SentryErrorReportingService,
    NoopErrorReportingService,
    {
      provide: ErrorReportingService,
      useFactory: (
        config: ConfigService<EnvConfig, true>,
        sentry: SentryErrorReportingService,
        noop: NoopErrorReportingService,
      ) => (config.get('SENTRY_DSN', { infer: true }) ? sentry : noop),
      inject: [ConfigService, SentryErrorReportingService, NoopErrorReportingService],
    },
  ],
  exports: [ErrorReportingService],
})
export class ObservabilityModule {}
