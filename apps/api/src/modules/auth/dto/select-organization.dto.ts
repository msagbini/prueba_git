import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

/**
 * Payload for POST /auth/select-organization, called after a login that
 * returned `requiresOrganizationSelection: true`.
 */
export class SelectOrganizationDto {
  @ApiProperty({ description: 'The short-lived selection token returned by POST /auth/login.' })
  @IsString()
  selectionToken!: string;

  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}
