# modules/observability

Error tracking for unhandled exceptions — the part of "if something fails
in production, does anyone find out?" that structured logging alone
doesn't answer (a log line nobody is watching is not the same as an
alert). See [`docs/technical-log/phase-9.md`](../../../../../docs/technical-log/phase-9.md)
for the full addendum, and `src/common/filters/all-exceptions.filter.ts`
(registered globally in `AppModule`) for the only caller of this module.

Structured request/application logging itself (`nestjs-pino`) is wired
directly in `AppModule` and `main.ts`, not in this module — there's only
one logger for the whole app, so it didn't need its own module the way
error reporting's swappable backend does.

## `ErrorReportingService`

Abstract port, same pattern as `modules/auth/email/email.service.ts`:

| Implementation                | Bound when                      | Behavior                                                                                                                       |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SentryErrorReportingService` | `SENTRY_DSN` is set             | Reports via the real `@sentry/node` SDK                                                                                        |
| `NoopErrorReportingService`   | `SENTRY_DSN` is unset (default) | No-ops (a warning logs once); every 5xx is still captured by the structured logger regardless of which implementation is bound |

`ObservabilityModule`'s factory provider picks between them at boot,
exactly like `AuthModule`'s `EmailService` binding.

No real Sentry account exists in this project (same honesty standard as
Stripe/SMTP): `Sentry.init()` and `captureException()` are real, correct
calls against the real SDK, but actual delivery to a Sentry project is
unverified — only that `SentryErrorReportingService` is the one bound
instead of the no-op when `SENTRY_DSN` is present.

## `AllExceptionsFilter`

Registered globally via `APP_FILTER`. Extends Nest's own
`BaseExceptionFilter` and delegates to `super.catch()` for the actual
HTTP response — this filter only adds logging/reporting as a side effect,
it never changes what a caller receives (existing validation-error and
`HttpException` response shapes, and their e2e test assertions, are
untouched). 5xx responses are logged at `error` level and reported via
`ErrorReportingService`; 4xx responses are logged at `warn` level and not
reported (they're normal request errors, not application bugs).
