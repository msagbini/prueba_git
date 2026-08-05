import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** Payload for PATCH /organizations/me. */
export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code new invoices default to, e.g. "AUD".',
  })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'defaultCurrency must be a 3-letter ISO 4217 code, e.g. "AUD".',
  })
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Vertical-specific configuration — see Organization.settings in schema.prisma.',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
