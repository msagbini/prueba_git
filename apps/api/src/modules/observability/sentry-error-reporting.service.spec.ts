import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import type { EnvConfig } from '../../config/env.validation';
import { SentryErrorReportingService } from './sentry-error-reporting.service';

jest.mock('@sentry/node');

/**
 * Minimal fake of the `ConfigService<EnvConfig, true>` slice this service reads.
 * @param overrides env values to override the defaults with
 * @returns a fake ConfigService exposing only `get()`
 */
function fakeConfig(overrides: Partial<EnvConfig> = {}): ConfigService<EnvConfig, true> {
  const values: Partial<EnvConfig> = {
    SENTRY_DSN: 'https://public@sentry.example.com/1',
    SENTRY_TRACES_SAMPLE_RATE: 0.1,
    NODE_ENV: 'production',
    ...overrides,
  };
  return { get: (key: keyof EnvConfig) => values[key] } as ConfigService<EnvConfig, true>;
}

describe('SentryErrorReportingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the Sentry SDK from env config', () => {
    new SentryErrorReportingService(fakeConfig());

    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://public@sentry.example.com/1',
      environment: 'production',
      tracesSampleRate: 0.1,
    });
  });

  it('reports exceptions via Sentry.captureException, attaching request context', () => {
    const service = new SentryErrorReportingService(fakeConfig());
    const error = new Error('boom');

    service.captureException(error, { method: 'GET', url: '/clients/123', statusCode: 500 });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: { request: { method: 'GET', url: '/clients/123', statusCode: 500 } },
    });
  });

  it('reports exceptions with no context when none is given', () => {
    const service = new SentryErrorReportingService(fakeConfig());
    const error = new Error('boom');

    service.captureException(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, undefined);
  });
});
