import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ErrorReportingService } from './error-reporting.service';
import { NoopErrorReportingService } from './noop-error-reporting.service';
import { ObservabilityModule } from './observability.module';
import { SentryErrorReportingService } from './sentry-error-reporting.service';

jest.mock('@sentry/node');

/**
 * Builds a testing module with `ObservabilityModule` and a fake `ConfigService`.
 * @param sentryDsn value to stand in for `SENTRY_DSN`
 * @returns the resolved `ErrorReportingService`
 */
async function resolveErrorReportingService(sentryDsn: string | undefined) {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), ObservabilityModule],
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: (key: string) =>
        key === 'SENTRY_DSN'
          ? sentryDsn
          : key === 'SENTRY_TRACES_SAMPLE_RATE'
            ? 0
            : key === 'NODE_ENV'
              ? 'test'
              : undefined,
    })
    .compile();

  return moduleRef.get(ErrorReportingService);
}

describe('ObservabilityModule', () => {
  it('binds SentryErrorReportingService when SENTRY_DSN is configured', async () => {
    const service = await resolveErrorReportingService('https://public@sentry.example.com/1');

    expect(service).toBeInstanceOf(SentryErrorReportingService);
  });

  it('binds NoopErrorReportingService when SENTRY_DSN is unset', async () => {
    const service = await resolveErrorReportingService(undefined);

    expect(service).toBeInstanceOf(NoopErrorReportingService);
  });
});
