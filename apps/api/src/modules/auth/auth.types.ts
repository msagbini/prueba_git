import type { RoleCode } from '@prisma/client';

/** A freshly issued access/refresh token pair, plus the refresh token's row id (internal — never returned to a client). */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

/** One of a user's organization memberships, as summarized for login/me responses. */
export interface MembershipSummary {
  organizationId: string;
  organizationName: string;
  role: RoleCode;
}

/** Result of `AuthService.login()`: either tokens (single membership) or a selection step (multiple memberships). */
export type LoginResult =
  | { requiresOrganizationSelection: false; tokens: IssuedTokens }
  | {
      requiresOrganizationSelection: true;
      selectionToken: string;
      memberships: MembershipSummary[];
    };

/** Public HTTP response shape for POST /auth/login — like {@link LoginResult}, but with the internal `refreshTokenId` stripped from `tokens`. */
export type LoginResponse =
  | { requiresOrganizationSelection: false; tokens: Omit<IssuedTokens, 'refreshTokenId'> }
  | {
      requiresOrganizationSelection: true;
      selectionToken: string;
      memberships: MembershipSummary[];
    };

/** Result of GET /auth/me. */
export interface MeResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerifiedAt: Date | null;
  memberships: (MembershipSummary & { isActive: boolean })[];
}

/** Result of GET /invitations/:token — the public preview shown before accepting. */
export interface InvitationPreview {
  organizationName: string;
  role: RoleCode;
  invitedByName: string;
  email: string;
}
