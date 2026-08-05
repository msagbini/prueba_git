import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { PinoLogger } from 'nestjs-pino';
import type { ErrorReportingService } from '../../modules/observability/error-reporting.service';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * Builds a fake `ArgumentsHost` exposing only the request fields this
 * filter reads (`method`, `url`) — `BaseExceptionFilter.catch()` itself is
 * mocked out below rather than exercised, so it never needs a real
 * response object.
 * @param overrides request fields to override
 * @param overrides.method the request method to report
 * @param overrides.url the request URL to report
 * @returns a fake `ArgumentsHost`
 */
function fakeHost(overrides: { method?: string; url?: string } = {}): ArgumentsHost {
  const request = { method: 'GET', url: '/clients/123', ...overrides };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let logger: jest.Mocked<Pick<PinoLogger, 'error' | 'warn'>>;
  let errorReporter: jest.Mocked<ErrorReportingService>;
  let baseCatch: jest.SpyInstance;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn() };
    errorReporter = { captureException: jest.fn() };
    // BaseExceptionFilter.catch() does real HTTP response work (needs a
    // live httpAdapter) — mocked out so this test only verifies what
    // AllExceptionsFilter itself adds (logging/reporting), trusting
    // Nest's own base filter is correct.
    baseCatch = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation();
  });

  afterEach(() => {
    baseCatch.mockRestore();
  });

  /**
   * Builds the filter under test.
   * @returns a filter instance wired to this test's mocks
   */
  function buildFilter(): AllExceptionsFilter {
    const httpAdapterHost = { httpAdapter: {} } as HttpAdapterHost;
    return new AllExceptionsFilter(httpAdapterHost, logger as unknown as PinoLogger, errorReporter);
  }

  it('logs a 5xx HttpException as an error and reports it', () => {
    const filter = buildFilter();
    const exception = new HttpException('DB unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    const host = fakeHost({ method: 'GET', url: '/health' });

    filter.catch(exception, host);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: exception,
        method: 'GET',
        url: '/health',
        statusCode: 503,
      }),
      'Unhandled exception',
    );
    expect(errorReporter.captureException).toHaveBeenCalledWith(exception, {
      method: 'GET',
      url: '/health',
      statusCode: 503,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs a non-HttpException (unhandled programmer error) as a 500 error and reports it', () => {
    const filter = buildFilter();
    const exception = new Error('unexpected');
    const host = fakeHost();

    filter.catch(exception, host);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: exception, statusCode: 500 }),
      'Unhandled exception',
    );
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      exception,
      expect.objectContaining({ statusCode: 500 }),
    );
  });

  it('logs a 4xx HttpException as a warning and does not report it', () => {
    const filter = buildFilter();
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    const host = fakeHost({ method: 'GET', url: '/missing' });

    filter.catch(exception, host);

    expect(logger.warn).toHaveBeenCalledWith(
      { method: 'GET', url: '/missing', statusCode: 404 },
      'Request error',
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });

  it('always delegates to BaseExceptionFilter.catch() so the response shape is unchanged', () => {
    const filter = buildFilter();
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    const host = fakeHost();

    filter.catch(exception, host);

    expect(baseCatch).toHaveBeenCalledWith(exception, host);
  });
});
