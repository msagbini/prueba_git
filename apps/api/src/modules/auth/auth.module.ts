import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { EnvConfig } from '../../config/env.validation';
import { BillingModule } from '../billing/billing.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { EmailService } from './email/email.service';
import { ConsoleEmailService } from './email/console-email.service';
import { SmtpEmailService } from './email/smtp-email.service';

/**
 * Authentication, session and invitation module (see
 * docs/architecture/auth.md). Registers `JwtAuthGuard` globally via
 * `APP_GUARD` — every route in the application requires a valid access
 * token unless marked `@Public()`. `RolesGuard`/`PermissionsGuard` are
 * exported for other modules to apply per-route (`@UseGuards(RolesGuard)`
 * + `@Roles(...)`), not registered globally, since most routes don't need
 * a role check beyond "authenticated."
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Secret/expiry are passed explicitly on every sign()/verifyAsync()
    // call in AuthService (they differ per token type: access token vs.
    // the short-lived org-selection token), so no default is configured here.
    JwtModule.register({}),
    BillingModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    OptionalJwtAuthGuard,
    SmtpEmailService,
    {
      provide: EmailService,
      // SMTP_HOST unset (the case in every environment this project has
      // run in so far — no real SMTP credentials exist here) falls back
      // to logging instead of crashing the app over an unconfigured
      // optional feature, matching BillingService's Stripe pattern.
      useFactory: (
        config: ConfigService<EnvConfig, true>,
        smtp: SmtpEmailService,
        stub: ConsoleEmailService,
      ) => (config.get('SMTP_HOST', { infer: true }) ? smtp : stub),
      inject: [ConfigService, SmtpEmailService, ConsoleEmailService],
    },
    ConsoleEmailService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [RolesGuard, PermissionsGuard],
})
export class AuthModule {}
