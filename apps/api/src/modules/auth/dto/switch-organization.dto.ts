import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Payload for POST /auth/switch-organization, called with a valid access token to move to a different membership. */
export class SwitchOrganizationDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string;
}
