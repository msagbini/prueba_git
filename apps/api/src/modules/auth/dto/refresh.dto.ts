import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Payload for POST /auth/refresh and POST /auth/logout. Web clients rely
 * on the httpOnly cookie and can omit this entirely; mobile clients (no
 * cookie storage) send the refresh token in the body — see
 * docs/architecture/auth.md.
 */
export class RefreshDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
