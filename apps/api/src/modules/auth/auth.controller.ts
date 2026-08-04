import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { RoleCode } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import type { EnvConfig } from '../../config/env.validation';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';
import { RefreshDto } from './dto/refresh.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import type { IssuedTokens, LoginResponse, MeResult, InvitationPreview } from './auth.types';

const REFRESH_TOKEN_COOKIE = 'refreshToken';

/**
 * A stricter per-IP limit than the app-wide default (100 req/60s, set in
 * `app.module.ts`) for the three credential-guessing-shaped routes:
 * login, signup, and forgot-password. 100/min is generous enough for
 * general API traffic but does little against a targeted password-
 * guessing attempt; 10/min still comfortably covers a real user
 * mistyping a password a few times.
 */
const CREDENTIAL_GUESS_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/**
 * Authentication, session and invitation endpoints. See
 * docs/architecture/auth.md for the full flow design — this controller
 * is thin: request/response shaping and cookie handling live here,
 * everything else is in `AuthService`.
 */
@ApiTags('auth')
@Controller()
export class AuthController {
  /**
   * Constructs the controller around the service implementing every flow it exposes.
   * @param authService implements every flow this controller exposes
   * @param config used to decide whether the refresh-token cookie requires HTTPS
   */
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * Creates a new organization and its owner account.
   * @param dto the signup payload
   * @param res used to set the refresh-token cookie on success
   * @returns the newly issued access/refresh tokens
   */
  @Public()
  @Throttle(CREDENTIAL_GUESS_THROTTLE)
  @Post('auth/signup')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<IssuedTokens, 'refreshTokenId'>> {
    const tokens = await this.authService.signup(dto);
    return this.respondWithTokens(res, tokens);
  }

  /**
   * Verifies credentials; returns tokens directly, or a selection step
   * if the account belongs to more than one organization.
   * @param dto the login payload
   * @param res used to set the refresh-token cookie if login completes immediately
   * @returns tokens, or the organization-selection step
   */
  @Public()
  @Throttle(CREDENTIAL_GUESS_THROTTLE)
  @Post('auth/login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.login(dto);
    if (!result.requiresOrganizationSelection) {
      const tokens = await this.respondWithTokens(res, result.tokens);
      return { requiresOrganizationSelection: false, tokens };
    }
    return result;
  }

  /**
   * Exchanges a login selection token plus a chosen organization for a real token pair.
   * @param dto the selection token and the chosen organization
   * @param res used to set the refresh-token cookie on success
   * @returns the newly issued access/refresh tokens
   */
  @Public()
  @Post('auth/select-organization')
  async selectOrganization(
    @Body() dto: SelectOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<IssuedTokens, 'refreshTokenId'>> {
    const tokens = await this.authService.selectOrganization(dto);
    return this.respondWithTokens(res, tokens);
  }

  /**
   * Switches the caller's active organization without ending their current session.
   * @param user the authenticated caller
   * @param dto the organization to switch to
   * @param res used to set the refresh-token cookie on success
   * @returns the newly issued access/refresh tokens, scoped to the new organization
   */
  @Post('auth/switch-organization')
  async switchOrganization(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() dto: SwitchOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<IssuedTokens, 'refreshTokenId'>> {
    const tokens = await this.authService.switchOrganization(user.sub, dto);
    return this.respondWithTokens(res, tokens);
  }

  /**
   * Rotates a refresh token for a new access/refresh pair.
   * @param dto may carry the refresh token explicitly (mobile clients)
   * @param req read for the refresh-token cookie (web clients) if the body didn't carry one
   * @param res used to set the refresh-token cookie on success
   * @returns the newly issued access/refresh tokens
   */
  @Public()
  @Post('auth/refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<IssuedTokens, 'refreshTokenId'>> {
    const rawToken = this.extractRefreshToken(dto, req);
    const tokens = await this.authService.refresh(rawToken);
    return this.respondWithTokens(res, tokens);
  }

  /**
   * Revokes the current refresh token and clears its cookie. Idempotent.
   * @param dto may carry the refresh token explicitly (mobile clients)
   * @param req read for the refresh-token cookie (web clients) if the body didn't carry one
   * @param res used to clear the refresh-token cookie
   */
  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken =
      dto.refreshToken ?? (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined);
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE);
  }

  /**
   * The caller's profile and every organization they belong to.
   * @param user the authenticated caller
   * @returns the caller's profile plus their organization memberships
   */
  @ApiBearerAuth()
  @Get('auth/me')
  async me(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>): Promise<MeResult> {
    return this.authService.me(user.sub, user.org);
  }

  /**
   * Marks the caller's email as verified.
   * @param dto the raw verification token from the emailed link
   */
  @Public()
  @Post('auth/verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.authService.verifyEmail(dto.token);
  }

  /**
   * Requests a password-reset email; always succeeds without revealing whether the address exists.
   * @param dto the account email to send a reset link to, if it exists
   */
  @Public()
  @Throttle(CREDENTIAL_GUESS_THROTTLE)
  @Post('auth/forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto);
  }

  /**
   * Sets a new password using a reset token.
   * @param dto the raw reset token and the new password
   */
  @Public()
  @Post('auth/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }

  /**
   * Invites an email address to join the caller's active organization. Owner/Admin only.
   * @param user the authenticated caller
   * @param dto the invitee's email and intended role
   */
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(RoleCode.OWNER, RoleCode.ADMIN)
  @Post('organizations/me/invitations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async createInvitation(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() dto: InviteUserDto,
  ): Promise<void> {
    await this.authService.createInvitation({ sub: user.sub, org: user.org }, dto);
  }

  /**
   * Public preview of an invitation, shown before the invitee accepts it.
   * @param token the raw invitation token from the link
   * @returns the org/role/inviter preview
   */
  @Public()
  @Get('invitations/:token')
  async getInvitation(@Param('token') token: string): Promise<InvitationPreview> {
    return this.authService.getInvitationPreview(token);
  }

  /**
   * Accepts an invitation. Public route, but `OptionalJwtAuthGuard`
   * still resolves `req.user` if a valid access token is presented — see
   * `AuthService.acceptInvitation()` for the new-account vs.
   * existing-account branching this enables.
   * @param token the raw invitation token from the link
   * @param dto profile/password fields, required only for a brand-new account
   * @param user the caller, if they presented a valid access token
   * @param res used to set the refresh-token cookie on success
   * @returns the newly issued access/refresh tokens, scoped to the joined organization
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('invitations/:token/accept')
  async acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<IssuedTokens, 'refreshTokenId'>> {
    const tokens = await this.authService.acceptInvitation(token, dto, user?.sub);
    return this.respondWithTokens(res, tokens);
  }

  /**
   * Sets the refresh-token cookie and returns the response body shape
   * every token-issuing endpoint shares: the access token plus the raw
   * refresh token (included in the body too, for mobile clients that
   * don't read cookies — see docs/architecture/auth.md).
   * @param res the response to attach the cookie to
   * @param tokens the freshly issued tokens
   * @returns the public response body (refreshTokenId is internal and stripped)
   */
  private respondWithTokens(
    res: Response,
    tokens: IssuedTokens,
  ): Omit<IssuedTokens, 'refreshTokenId'> {
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      // Browsers drop `Secure` cookies over plain HTTP, which local dev
      // (http://localhost) always is — only require it in production.
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict',
    });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  /**
   * Resolves the raw refresh token from the request body or cookie.
   * @param dto the refresh request body, which may carry the token explicitly
   * @param req the request, whose cookie jar is checked if the body didn't carry one
   * @returns the raw refresh token
   * @throws BadRequestException if neither the body nor the cookie has one
   */
  private extractRefreshToken(dto: RefreshDto, req: Request): string {
    const rawToken =
      dto.refreshToken ?? (req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined);
    if (!rawToken) {
      throw new BadRequestException('No refresh token provided.');
    }
    return rawToken;
  }
}
