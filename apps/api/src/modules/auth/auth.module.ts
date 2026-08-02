import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { EmailService } from './email/email.service';
import { ConsoleEmailService } from './email/console-email.service';

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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    OptionalJwtAuthGuard,
    { provide: EmailService, useClass: ConsoleEmailService },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [RolesGuard, PermissionsGuard],
})
export class AuthModule {}
