import type { Request } from 'express';

/**
 * The shape `JwtStrategy` attaches to `req.user` after validating an
 * access token — mirrors the JWT payload documented in
 * docs/architecture/auth.md (`{ sub, org, membershipId, role }`). Optional
 * because `@Public()` routes never populate it.
 */
export interface AuthenticatedUser {
  /** The global User id (JWT `sub` claim). */
  sub: string;
  /** The active OrganizationMembership's organization id (JWT `org` claim). */
  org: string;
  /** The active OrganizationMembership's id. */
  membershipId: string;
  /** The active membership's role code (e.g. "OWNER", "STAFF"). */
  role: string;
}

/** An Express request that may carry an authenticated user (see {@link AuthenticatedUser}). */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
