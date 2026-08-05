import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';

/** Payload for POST /organizations/me/invitations (Owner/Admin only). */
export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: RoleCode })
  @IsEnum(RoleCode)
  roleCode!: RoleCode;

  @ApiPropertyOptional({
    description:
      'Required (and only meaningful) when roleCode is CLIENT — links the resulting membership to this Client record.',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
