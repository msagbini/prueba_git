import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { RoleCode, type Prisma, type RefreshToken } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { runInTenantTransaction } from '../../prisma/run-in-tenant-transaction';
import {
  runWithSessionVar,
  SESSION_VAR_CURRENT_USER_ID,
  SESSION_VAR_LOOKUP_TOKEN_HASH,
} from '../../prisma/run-with-session-var';
import type { EnvConfig } from '../../config/env.validation';
import { EmailService } from './email/email.service';
import { generateRawToken, hashToken } from './token.util';
import { slugifyOrganizationName } from './slug.util';
import type { SignupDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';
import type { SelectOrganizationDto } from './dto/select-organization.dto';
import type { SwitchOrganizationDto } from './dto/switch-organization.dto';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { IssuedTokens, LoginResult, MeResult, InvitationPreview } from './auth.types';

const SELECTION_TOKEN_PURPOSE = 'org-selection';
const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;
const INVITATION_TTL_DAYS = 7;

interface SelectionTokenPayload {
  sub: string;
  purpose: typeof SELECTION_TOKEN_PURPOSE;
}

/**
 * Implements the auth flows documented in docs/architecture/auth.md:
 * signup, login (including the multi-organization selection step),
 * organization switching, refresh-token rotation, invitations, email
 * verification and password reset. See also ADR 0004 (token strategy),
 * ADR 0005 (multi-org membership) and ADR 0006 (bootstrap RLS policies) —
 * this service is the concrete implementation of all three.
 */
@Injectable()
export class AuthService {
  /**
   * Constructs the service around its Prisma, JWT, config and email dependencies.
   * @param prisma the base (unscoped) Prisma client, used for global-table reads and to open scoped transactions
   * @param tenantContext the current authenticated request's tenant-scoped Prisma client
   * @param jwt used to sign/verify access tokens and the short-lived organization-selection token
   * @param config used to read JWT/refresh-token configuration
   * @param email the (currently stubbed) transactional email port
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly email: EmailService,
  ) {}

  /**
   * Creates a new Organization, its Owner User and their membership in a
   * single tenant-scoped transaction (see docs/architecture/auth.md).
   * @param dto the signup payload
   * @returns the newly issued token pair
   */
  async signup(dto: SignupDto): Promise<IssuedTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const [industryVertical, ownerRole] = await Promise.all([
      this.prisma.industryVertical.findUniqueOrThrow({
        where: { code: dto.industryVerticalCode },
      }),
      this.prisma.role.findUniqueOrThrow({ where: { code: RoleCode.OWNER } }),
    ]);
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const organizationId = randomUUID();

    const { tokens, rawVerificationToken, ownerEmail } = await runInTenantTransaction(
      this.prisma,
      organizationId,
      async (tx) => {
        await tx.organization.create({
          data: {
            id: organizationId,
            name: dto.organizationName,
            slug: slugifyOrganizationName(dto.organizationName, organizationId),
            industryVerticalId: industryVertical.id,
            timezone: 'UTC',
            locale: 'en-US',
          },
        });

        const user = await tx.user.create({
          data: {
            email: dto.ownerEmail,
            passwordHash,
            firstName: dto.ownerFirstName,
            lastName: dto.ownerLastName,
          },
        });

        const membership = await tx.organizationMembership.create({
          data: { organizationId, userId: user.id, roleId: ownerRole.id },
        });

        const rawToken = generateRawToken();
        await tx.emailVerificationToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(rawToken),
            expiresAt: hoursFromNow(EMAIL_VERIFICATION_TTL_HOURS),
          },
        });

        const issuedTokens = await this.issueTokenPair(tx, {
          userId: user.id,
          membershipId: membership.id,
          organizationId,
          role: RoleCode.OWNER,
        });

        return { tokens: issuedTokens, rawVerificationToken: rawToken, ownerEmail: user.email };
      },
    );

    await this.email.sendVerificationEmail(ownerEmail, rawVerificationToken);
    return tokens;
  }

  /**
   * Verifies credentials and either issues tokens directly (single
   * membership) or returns a short-lived selection token plus the list of
   * organizations to choose from (multiple memberships).
   * @param dto the login payload
   * @returns the login result — tokens, or an organization-selection step
   */
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const memberships = await runWithSessionVar(
      this.prisma,
      SESSION_VAR_CURRENT_USER_ID,
      user.id,
      (tx) =>
        tx.organizationMembership.findMany({
          where: { userId: user.id, status: 'ACTIVE' },
          include: { organization: true, role: true },
        }),
    );

    if (memberships.length === 0) {
      throw new UnauthorizedException('This account has no active organization membership.');
    }

    if (memberships.length === 1) {
      const membership = memberships[0]!;
      const tokens = await runInTenantTransaction(this.prisma, membership.organizationId, (tx) =>
        this.issueTokenPair(tx, {
          userId: user.id,
          membershipId: membership.id,
          organizationId: membership.organizationId,
          role: membership.role.code,
        }),
      );
      return { requiresOrganizationSelection: false, tokens };
    }

    const selectionToken = this.jwt.sign(
      { sub: user.id, purpose: SELECTION_TOKEN_PURPOSE } satisfies SelectionTokenPayload,
      { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }), expiresIn: '5m' },
    );

    return {
      requiresOrganizationSelection: true,
      selectionToken,
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role.code,
      })),
    };
  }

  /**
   * Completes a multi-membership login by exchanging the selection token
   * plus a chosen organization for a real token pair.
   * @param dto the selection token and the chosen organization
   * @returns the newly issued token pair
   */
  async selectOrganization(dto: SelectOrganizationDto): Promise<IssuedTokens> {
    const payload = await this.verifySelectionToken(dto.selectionToken);

    const membership = await runWithSessionVar(
      this.prisma,
      SESSION_VAR_CURRENT_USER_ID,
      payload.sub,
      (tx) =>
        tx.organizationMembership.findFirst({
          where: { userId: payload.sub, organizationId: dto.organizationId, status: 'ACTIVE' },
          include: { role: true },
        }),
    );
    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization.');
    }

    return runInTenantTransaction(this.prisma, dto.organizationId, (tx) =>
      this.issueTokenPair(tx, {
        userId: payload.sub,
        membershipId: membership.id,
        organizationId: dto.organizationId,
        role: membership.role.code,
      }),
    );
  }

  /**
   * Issues a new token pair for a different organization the caller
   * already belongs to, without invalidating the current session.
   * @param currentUserId the authenticated caller's global user id
   * @param dto the organization to switch to
   * @returns the newly issued token pair
   */
  async switchOrganization(
    currentUserId: string,
    dto: SwitchOrganizationDto,
  ): Promise<IssuedTokens> {
    const membership = await runWithSessionVar(
      this.prisma,
      SESSION_VAR_CURRENT_USER_ID,
      currentUserId,
      (tx) =>
        tx.organizationMembership.findFirst({
          where: { userId: currentUserId, organizationId: dto.organizationId, status: 'ACTIVE' },
          include: { role: true },
        }),
    );
    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization.');
    }

    return runInTenantTransaction(this.prisma, dto.organizationId, (tx) =>
      this.issueTokenPair(tx, {
        userId: currentUserId,
        membershipId: membership.id,
        organizationId: dto.organizationId,
        role: membership.role.code,
      }),
    );
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new
   * pair is issued. Reuse of an already-revoked token revokes its whole
   * descendant chain (see ADR 0004).
   * @param rawToken the raw refresh token presented by the client
   * @returns the newly issued token pair
   */
  async refresh(rawToken: string): Promise<IssuedTokens> {
    const tokenHash = hashToken(rawToken);
    // Deliberately no `include` here: joining into organization_memberships
    // while only app.lookup_token_hash (not app.current_org_id) is set
    // would hit that table's RLS with no matching policy — the membership
    // is instead fetched below, inside a properly org-scoped transaction.
    // See docs/technical-log/phase-2.md for the bug this replaced.
    const existing = await runWithSessionVar(
      this.prisma,
      SESSION_VAR_LOOKUP_TOKEN_HASH,
      tokenHash,
      (tx) => tx.refreshToken.findUnique({ where: { tokenHash } }),
    );

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }
    if (existing.revokedAt) {
      await this.revokeTokenFamily(existing.id, existing.organizationId);
      throw new UnauthorizedException('Refresh token has already been used; session revoked.');
    }

    return runInTenantTransaction(this.prisma, existing.organizationId, async (tx) => {
      const membership = await tx.organizationMembership.findUniqueOrThrow({
        where: { id: existing.membershipId },
        include: { role: true },
      });

      const issuedTokens = await this.issueTokenPair(tx, {
        userId: existing.userId,
        membershipId: existing.membershipId,
        organizationId: existing.organizationId,
        role: membership.role.code,
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByTokenId: issuedTokens.refreshTokenId },
      });

      return issuedTokens;
    });
  }

  /**
   * Revokes a refresh token. Idempotent — logging out twice, or with an
   * already-invalid token, is not an error.
   * @param rawToken the raw refresh token to revoke
   */
  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const existing = await runWithSessionVar(
      this.prisma,
      SESSION_VAR_LOOKUP_TOKEN_HASH,
      tokenHash,
      (tx) => tx.refreshToken.findUnique({ where: { tokenHash } }),
    );
    if (!existing || existing.revokedAt) {
      return;
    }
    await runInTenantTransaction(this.prisma, existing.organizationId, (tx) =>
      tx.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }),
    );
  }

  /**
   * Builds the caller's profile plus their full list of organization memberships.
   * @param currentUserId the authenticated caller's global user id
   * @param activeOrganizationId the organization the caller's current access token is scoped to
   * @returns the caller's profile plus every organization they belong to
   */
  async me(currentUserId: string, activeOrganizationId: string): Promise<MeResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: currentUserId } });
    const memberships = await runWithSessionVar(
      this.prisma,
      SESSION_VAR_CURRENT_USER_ID,
      currentUserId,
      (tx) =>
        tx.organizationMembership.findMany({
          where: { userId: currentUserId, status: 'ACTIVE' },
          include: { organization: true, role: true },
        }),
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerifiedAt: user.emailVerifiedAt,
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role.code,
        isActive: m.organizationId === activeOrganizationId,
      })),
    };
  }

  /**
   * Consumes an email-verification token and marks the user verified.
   * @param rawToken the raw email-verification token from the link the user clicked
   */
  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  /**
   * Always succeeds without revealing whether the email exists.
   * @param dto the account email to send a reset link to, if it exists
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      return;
    }
    const rawToken = generateRawToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: hoursFromNow(PASSWORD_RESET_TTL_HOURS),
      },
    });
    await this.email.sendPasswordResetEmail(user.email, rawToken);
  }

  /**
   * Consumes a password-reset token and sets the new password.
   * @param dto the raw reset token and the new password
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    ]);
  }

  /**
   * Invites an email address to join the caller's active organization.
   * Requires Owner/Admin (enforced via `@Roles()` on the route).
   * @param currentUser the authenticated caller
   * @param currentUser.sub the caller's global user id, recorded as the inviter
   * @param currentUser.org the organization the invitation is created in
   * @param dto the invitee's email and intended role
   */
  async createInvitation(
    currentUser: { sub: string; org: string },
    dto: InviteUserDto,
  ): Promise<void> {
    const [role, organization] = await Promise.all([
      this.prisma.role.findUniqueOrThrow({ where: { code: dto.roleCode } }),
      this.tenantContext.client.organization.findUniqueOrThrow({
        where: { id: currentUser.org },
      }),
    ]);

    // A Client-role membership must be linked to the Client record it
    // represents (OrganizationMembership.clientId) — see
    // docs/architecture/multi-tenancy.md. Every other role must NOT carry
    // a clientId, since it would be meaningless for them.
    if (dto.roleCode === RoleCode.CLIENT) {
      if (!dto.clientId) {
        throw new BadRequestException('clientId is required when roleCode is CLIENT.');
      }
      const client = await this.tenantContext.client.client.findFirst({
        where: { id: dto.clientId, deletedAt: null },
      });
      if (!client) {
        throw new BadRequestException(
          'clientId does not belong to the caller’s active organization.',
        );
      }
    } else if (dto.clientId) {
      throw new BadRequestException('clientId is only meaningful when roleCode is CLIENT.');
    }

    const rawToken = generateRawToken();
    await this.tenantContext.client.userInvitation.create({
      data: {
        organizationId: currentUser.org,
        email: dto.email,
        roleId: role.id,
        invitedByUserId: currentUser.sub,
        tokenHash: hashToken(rawToken),
        expiresAt: daysFromNow(INVITATION_TTL_DAYS),
        clientId: dto.roleCode === RoleCode.CLIENT ? dto.clientId : undefined,
      },
    });

    await this.email.sendInvitationEmail(dto.email, organization.name, rawToken);
  }

  /**
   * Looks up an invitation and shapes it for display before it's accepted.
   * @param rawToken the raw invitation token from the link
   * @returns a preview of the invitation (org, role, inviter) for display before accepting
   */
  async getInvitationPreview(rawToken: string): Promise<InvitationPreview> {
    const invitation = await this.findValidInvitation(rawToken);
    return {
      organizationName: invitation.organization.name,
      role: invitation.role.code,
      invitedByName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`,
      email: invitation.email,
    };
  }

  /**
   * Accepts an invitation. Branches on whether the invited email already
   * has an account (see docs/architecture/auth.md): a new email creates
   * the account from `dto`; an existing email requires `authenticatedUserId`
   * to match, and only adds the membership.
   * @param rawToken the raw invitation token
   * @param dto profile/password fields, required only for a brand-new account
   * @param authenticatedUserId the caller's user id if they presented a valid access token, otherwise undefined
   * @returns the newly issued token pair, scoped to the joined organization
   */
  async acceptInvitation(
    rawToken: string,
    dto: AcceptInvitationDto,
    authenticatedUserId?: string,
  ): Promise<IssuedTokens> {
    const invitation = await this.findValidInvitation(rawToken);
    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    let userId: string;
    if (existingUser) {
      if (authenticatedUserId !== existingUser.id) {
        throw new ConflictException(
          'An account with this email already exists. Log in first, then accept this invitation.',
        );
      }
      userId = existingUser.id;
    } else {
      if (!dto.firstName || !dto.lastName || !dto.password) {
        throw new BadRequestException(
          'firstName, lastName and password are required to create a new account.',
        );
      }
      const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
      const created = await this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          // The invite link itself proves ownership of this email address.
          emailVerifiedAt: new Date(),
        },
      });
      userId = created.id;
    }

    return runInTenantTransaction(this.prisma, invitation.organizationId, async (tx) => {
      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          roleId: invitation.roleId,
          clientId: invitation.clientId,
        },
      });
      // A Staff membership always gets an (initially blank) StaffProfile —
      // see the "creation happens via the invitation flow" note in
      // staff.service.ts. Owner/Admin/Dispatcher/Client memberships don't
      // get one: StaffProfile only holds field-employee HR data
      // (employeeCode, hourlyRate, hireDate).
      if (invitation.role.code === RoleCode.STAFF) {
        await tx.staffProfile.create({
          data: { organizationId: invitation.organizationId, membershipId: membership.id },
        });
      }
      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });
      return this.issueTokenPair(tx, {
        userId,
        membershipId: membership.id,
        organizationId: invitation.organizationId,
        role: invitation.role.code,
      });
    });
  }

  /**
   * Looks up a pending, unexpired invitation by its raw token.
   *
   * Deliberately two steps rather than one `include`-heavy query: while
   * only `app.lookup_token_hash` is set (no org context yet), joining
   * into `organizations` would hit RLS with no matching policy — the
   * invited organization's row is instead fetched via a properly
   * org-scoped transaction once its id is known, and `role`/`invitedBy`
   * (global, non-RLS tables) via the plain client. See
   * docs/technical-log/phase-2.md for the bug this replaced.
   * @param rawToken the raw invitation token
   * @returns the invitation with its organization, role and inviter loaded
   */
  private async findValidInvitation(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const invitation = await runWithSessionVar(
      this.prisma,
      SESSION_VAR_LOOKUP_TOKEN_HASH,
      tokenHash,
      (tx) => tx.userInvitation.findUnique({ where: { tokenHash } }),
    );
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new NotFoundException('Invitation not found or no longer valid.');
    }

    const [organization, role, invitedBy] = await Promise.all([
      runInTenantTransaction(this.prisma, invitation.organizationId, (tx) =>
        tx.organization.findUniqueOrThrow({ where: { id: invitation.organizationId } }),
      ),
      this.prisma.role.findUniqueOrThrow({ where: { id: invitation.roleId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: invitation.invitedByUserId } }),
    ]);

    return { ...invitation, organization, role, invitedBy };
  }

  /**
   * Walks the `replacedByTokenId` chain from `tokenId` forward, revoking
   * every descendant — the response to a detected refresh-token reuse
   * (see ADR 0004).
   * @param tokenId the refresh token id where reuse was detected
   * @param organizationId the organization the token family belongs to
   */
  private async revokeTokenFamily(tokenId: string, organizationId: string): Promise<void> {
    await runInTenantTransaction(this.prisma, organizationId, async (tx) => {
      let currentId: string | null = tokenId;
      while (currentId) {
        const token: RefreshToken = await tx.refreshToken.update({
          where: { id: currentId },
          data: { revokedAt: new Date() },
        });
        currentId = token.replacedByTokenId;
      }
    });
  }

  /**
   * Signs a new access token and creates its paired refresh token row.
   * @param tx the transaction client to create the refresh token row in — already scoped to `params.organizationId`
   * @param params the identity/membership/role the tokens are scoped to
   * @param params.userId the global user id the tokens authenticate
   * @param params.membershipId the membership the access token's role claim comes from
   * @param params.organizationId the organization the tokens are scoped to
   * @param params.role the membership's role code, embedded in the access token
   * @returns the issued access token, raw refresh token, and the refresh token's row id
   */
  private async issueTokenPair(
    tx: Prisma.TransactionClient,
    params: { userId: string; membershipId: string; organizationId: string; role: RoleCode },
  ): Promise<IssuedTokens> {
    const accessToken = this.jwt.sign(
      {
        sub: params.userId,
        org: params.organizationId,
        membershipId: params.membershipId,
        role: params.role,
      },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );

    const rawRefreshToken = generateRawToken();
    const refreshTtlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const created = await tx.refreshToken.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        membershipId: params.membershipId,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: daysFromNow(refreshTtlDays),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken, refreshTokenId: created.id };
  }

  /**
   * Verifies a login organization-selection token.
   * @param token the selection token presented to POST /auth/select-organization
   * @returns the decoded payload
   */
  private async verifySelectionToken(token: string): Promise<SelectionTokenPayload> {
    let payload: SelectionTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<SelectionTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired selection token.');
    }
    if (payload.purpose !== SELECTION_TOKEN_PURPOSE) {
      throw new UnauthorizedException('Invalid selection token.');
    }
    return payload;
  }
}

/**
 * Computes an expiry timestamp a number of hours in the future.
 * @param hours how many hours from now
 * @returns a Date `hours` hours in the future
 */
function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Computes an expiry timestamp a number of days in the future.
 * @param days how many days from now
 * @returns a Date `days` days in the future
 */
function daysFromNow(days: number): Date {
  return hoursFromNow(days * 24);
}
