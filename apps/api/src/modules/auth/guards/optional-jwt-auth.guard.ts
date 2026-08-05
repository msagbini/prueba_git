import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

/**
 * Like `JwtAuthGuard`, but never rejects the request for a missing or
 * invalid token — it just leaves `req.user` unset. Used only on
 * `POST /invitations/:token/accept`, which must work both for a brand
 * new account (no token at all) and for an existing account (must be
 * authenticated as that user) — see `AuthService.acceptInvitation()` and
 * docs/architecture/auth.md.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Overrides the default (throw-if-no-user) behavior so a missing or
   * invalid token simply results in an unauthenticated request instead
   * of a 401.
   * @param _err any error from the strategy (ignored)
   * @param user the decoded user, if a valid token was presented
   * @returns `user` if present, otherwise `undefined` — never throws
   */
  handleRequest<TUser = AuthenticatedUser>(_err: unknown, user: TUser | false): TUser | undefined {
    return user || undefined;
  }
}
