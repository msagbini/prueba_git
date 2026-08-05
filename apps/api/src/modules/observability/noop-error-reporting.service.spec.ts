import { Logger } from '@nestjs/common';
import { NoopErrorReportingService } from './noop-error-reporting.service';

describe('NoopErrorReportingService', () => {
  it('does not throw when reporting an exception', () => {
    const service = new NoopErrorReportingService();

    expect(() => service.captureException(new Error('boom'))).not.toThrow();
  });

  it('warns exactly once across multiple reports, not once per call', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = new NoopErrorReportingService();

    service.captureException(new Error('first'));
    service.captureException(new Error('second'));
    service.captureException(new Error('third'));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN is not configured'));
    warnSpy.mockRestore();
  });
});
