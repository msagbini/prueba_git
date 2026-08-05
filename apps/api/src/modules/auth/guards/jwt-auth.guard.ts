import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Global guard (registered via `APP_GUARD` in `AuthModule`) enforcing
 * that every route requires a valid access token, except those marked
 * `@Public()` — see docs/architecture/auth.md for the exact list
 * (signup, login, refresh, select-organization, the public invitation
 * preview, and `/health`).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Constructs the guard around the reflector used to read route metadata.
   * @param reflector used to read the `@Public()` metadata off the route/class
   */
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Allows `@Public()` routes through unconditionally; otherwise requires a valid access token.
   * @param context the current execution context
   * @returns true if the route is public, otherwise delegates to the JWT strategy
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
