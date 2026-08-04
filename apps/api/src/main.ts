import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildSwaggerDocument } from './swagger';
import type { EnvConfig } from './config/env.validation';

/** Boots the NestJS application: global pipes, CORS, Swagger, and the HTTP listener. */
async function bootstrap(): Promise<void> {
  // rawBody: true additionally exposes `req.rawBody` (the exact bytes
  // received) alongside the normal parsed `req.body` — needed by the
  // Stripe webhook handler, which must verify a signature computed over
  // the raw request body, not a re-serialized version of it.
  const app = await NestFactory.create(AppModule, { rawBody: true });
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

  // Runs PrismaService.onModuleDestroy (closes the DB connection) and any
  // other lifecycle hook when the process receives SIGTERM/SIGINT —
  // without this, Nest never calls them and a container orchestrator's
  // stop signal just kills the process mid-request instead of draining it.
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap();
