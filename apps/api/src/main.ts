import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildSwaggerDocument } from './swagger';
import type { EnvConfig } from './config/env.validation';
import { ErrorReportingService } from './modules/observability/error-reporting.service';

/** Boots the NestJS application: global pipes, CORS, Swagger, and the HTTP listener. */
async function bootstrap(): Promise<void> {
  // rawBody: true additionally exposes `req.rawBody` (the exact bytes
  // received) alongside the normal parsed `req.body` — needed by the
  // Stripe webhook handler, which must verify a signature computed over
  // the raw request body, not a re-serialized version of it. bufferLogs
  // holds Nest's own bootstrap logs (module init, route mapping) until
  // `useLogger` below swaps in the structured logger, instead of losing
  // them to the default console logger first and pino second.
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService<EnvConfig, true>);

  // Standard security headers (HSTS, X-Content-Type-Options, disabled
  // X-Powered-By, etc). Content-Security-Policy is left at helmet's
  // default (self-only) — this API serves JSON, not HTML, so it isn't
  // meaningfully exercised either way, but there's no reason to disable it.
  app.use(helmet());
  app.use(compression());

  // Needed to read the httpOnly refresh-token cookie set by AuthController
  // (see docs/architecture/auth.md).
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  SwaggerModule.setup('api/docs', app, buildSwaggerDocument(app));

  // Errors thrown inside a request never reach these — AllExceptionsFilter
  // (registered globally in AppModule) already logs/reports those. These
  // two only catch what happens *outside* any request: a rejected promise
  // nothing awaited, or a synchronous throw outside Nest's request
  // pipeline. Node's default behavior for `uncaughtException` is to keep
  // running in a possibly-corrupted state — logging/reporting it and then
  // exiting lets the process manager restart into a clean state instead.
  const logger = app.get(Logger);
  const errorReporter = app.get(ErrorReportingService);
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(error, 'Unhandled promise rejection');
    errorReporter.captureException(error);
  });
  process.on('uncaughtException', (error) => {
    logger.error(error, 'Uncaught exception');
    errorReporter.captureException(error);
    process.exit(1);
  });

  // Runs PrismaService.onModuleDestroy (closes the DB connection) and any
  // other lifecycle hook when the process receives SIGTERM/SIGINT —
  // without this, Nest never calls them and a container orchestrator's
  // stop signal just kills the process mid-request instead of draining it.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  // A rejection escaping bootstrap() (e.g. the database being unreachable
  // during startup) is a distinct failure mode from the steady-state
  // process.on('unhandledRejection') handler registered above: this one
  // means the app never finished starting. Registering that handler
  // suppresses Node's default behavior of terminating the process on an
  // unhandled rejection, so without this .catch() a boot failure would
  // leave a zombie process — alive, but never listening on any port,
  // which a container orchestrator's restart policy wouldn't catch. The
  // logger/error reporter may not exist yet if `NestFactory.create()`
  // itself is what failed, so this falls back to plain console output.
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
