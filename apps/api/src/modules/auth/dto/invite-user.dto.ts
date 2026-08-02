import { ApiProperty } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

/** Payload for POST /organizations/me/invitations (Owner/Admin only). */
export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: RoleCode })
  @IsEnum(RoleCode)
  roleCode!: RoleCode;
}
