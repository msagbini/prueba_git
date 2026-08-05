import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ErrorReportingService } from '../../modules/observability/error-reporting.service';

/**
 * Global exception filter — logs every unhandled exception through the
 * structured (pino) logger and reports 5xx ones to
 * {@link ErrorReportingService}, then delegates to
 * `BaseExceptionFilter.catch()` for the actual HTTP response so the
 * response shape (validation error bodies, standard `HttpException`
 * JSON, etc.) is exactly what it was before this filter existed — this
 * only adds observability, it never changes what a caller receives.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  /**
   * Constructs the filter.
   * @param httpAdapterHost passed through to `BaseExceptionFilter` for response formatting
   * @param logger structured logger every exception is recorded through
   * @param errorReporter external error-tracking backend 5xx exceptions are reported to
   */
  constructor(
    httpAdapterHost: HttpAdapterHost,
    @InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger,
    private readonly errorReporter: ErrorReportingService,
  ) {
    super(httpAdapterHost.httpAdapter);
  }

  /**
   * Logs/reports the exception, then delegates response formatting to the base filter.
   * @param exception whatever was thrown — an `HttpException` or an arbitrary unhandled error
   * @param host the current request's arguments host
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const context = { method: request?.method, url: request?.url, statusCode: status };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({ err: exception, ...context }, 'Unhandled exception');
      this.errorReporter.captureException(exception, context);
    } else {
      this.logger.warn(context, 'Request error');
    }

    super.catch(exception, host);
  }
}
