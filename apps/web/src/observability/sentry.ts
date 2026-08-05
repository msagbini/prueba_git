import * as Sentry from '@sentry/react';

/**
 * Initializes the Sentry SDK from `VITE_SENTRY_DSN`, mirroring
 * `apps/api`'s `SentryErrorReportingService`/`NoopErrorReportingService`
 * degradation: with no DSN configured, `Sentry.init({ dsn: undefined })`
 * is itself a safe no-op (the SDK doesn't send anything), so there's no
 * separate no-op implementation needed here. No real Sentry account
 * exists in this project — same honesty standard as the backend: this
 * is a real, correct call against the real SDK, but actual delivery to a
 * Sentry project is unverified.
 */
export function initSentry(): void {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
}

/**
 * Reports a caught UI error to Sentry — called from `ErrorBoundary`.
 * @param error the error React's error boundary caught
 * @param componentStack the component stack React captured for the error
 */
export function captureException(error: unknown, componentStack?: string): void {
  Sentry.captureException(
    error,
    componentStack ? { contexts: { react: { componentStack } } } : undefined,
  );
}
