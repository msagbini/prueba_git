import { Injectable, Logger } from '@nestjs/common';
import { ErrorReportContext, ErrorReportingService } from './error-reporting.service';

/**
 * {@link ErrorReportingService} bound when `SENTRY_DSN` isn't configured.
 * Does not throw, and doesn't duplicate the structured logging the global
 * exception filter already does for every 5xx — it only marks, once per
 * process, that exceptions aren't being shipped anywhere external.
 */
@Injectable()
export class NoopErrorReportingService extends ErrorReportingService {
  private readonly logger = new Logger(NoopErrorReportingService.name);
  private hasWarned = false;

  /**
   * No-ops the report, warning once that error tracking isn't configured.
   * @param _error unused — nothing is done with it
   * @param _context unused — nothing is done with it
   */
  captureException(_error: unknown, _context?: ErrorReportContext): void {
    if (!this.hasWarned) {
      this.hasWarned = true;
      this.logger.warn(
        'SENTRY_DSN is not configured — exceptions are logged locally only, not shipped to an external error tracker.',
      );
    }
  }
}
