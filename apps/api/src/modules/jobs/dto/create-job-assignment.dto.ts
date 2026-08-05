import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Payload for POST /jobs/:id/assignments. */
export class CreateJobAssignmentDto {
  @ApiProperty({ description: 'The OrganizationMembership id of the staff member to assign.' })
  @IsUUID()
  membershipId!: string;
}
