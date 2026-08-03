import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus, RoleCode } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/** Payload for PATCH /organizations/me/members/:membershipId. */
export class UpdateMembershipDto {
  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
