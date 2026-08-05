/** Extra, non-sensitive context attached to a reported exception. */
export interface ErrorReportContext {
  method?: string;
  url?: string;
  statusCode?: number;
}

/**
 * Port for external error tracking. Only this interface plus a Sentry
 * implementation exist for now — see `SentryErrorReportingService` and
 * `NoopErrorReportingService` (bound based on whether `SENTRY_DSN` is
 * configured, the same optional-provider pattern as `EmailService`).
 */
export abstract class ErrorReportingService {
  /**
   * Reports an exception to the configured error-tracking backend.
   * @param error the caught exception
   * @param context request metadata to attach, if the exception happened during a request
   */
  abstract captureException(error: unknown, context?: ErrorReportContext): void;
}
