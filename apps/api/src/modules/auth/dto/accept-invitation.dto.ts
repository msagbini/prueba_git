import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Payload for POST /invitations/:token/accept. `firstName`/`lastName`/
 * `password` are required only when the invited email has no existing
 * account — see the branching accept-flow in docs/architecture/auth.md.
 * When the account already exists, this endpoint requires an
 * `Authorization` header for that same user instead (checked in
 * `AuthService`, not expressible via class-validator).
 */
export class AcceptInvitationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
