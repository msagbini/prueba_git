import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';
import type { EnvConfig } from '../../../config/env.validation';

/**
 * Validates the `Authorization: Bearer <token>` access token on every
 * request that isn't `@Public()` (see `JwtAuthGuard`). The decoded payload
 * — already shaped as {@link AuthenticatedUser} at sign time by
 * `AuthService` — is attached to `req.user` verbatim; no database lookup
 * happens here, by design (see docs/architecture/auth.md: the token
 * itself carries everything a route needs to authorize the request).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Constructs the passport-jwt strategy with the configured signing secret.
   * @param config used to read the JWT signing secret the token must verify against
   */
  constructor(config: ConfigService<EnvConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /**
   * Passport calls this after signature/expiry verification succeeds.
   * @param payload the verified JWT payload
   * @returns the payload unchanged, becoming `req.user`
   */
  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
