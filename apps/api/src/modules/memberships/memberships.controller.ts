import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MembershipsService } from './memberships.service';
import { UpdateMembershipDto } from './dto/update-membership.dto';

/** Manages membership in the caller's active organization. See `memberships.service.ts` for the Fase 2 stub scope note. */
@ApiTags('memberships')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleCode.OWNER, RoleCode.ADMIN)
@Controller('organizations/me/members')
export class MembershipsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param membershipsService implements this controller's routes
   */
  constructor(private readonly membershipsService: MembershipsService) {}

  /**
   * Lists records.
   * @returns every membership in the caller's active organization.
   */
  @Get()
  list() {
    return this.membershipsService.list();
  }

  /**
   * Updates a membership.
   * @param membershipId the membership to update
   * @param dto the fields to change
   * @returns the updated membership
   */
  @Patch(':membershipId')
  update(@Param('membershipId') membershipId: string, @Body() dto: UpdateMembershipDto) {
    return this.membershipsService.update(membershipId, dto);
  }

  /**
   * Removes a record.
   * @param membershipId the membership to remove
   * @returns the removal result
   */
  @Delete(':membershipId')
  remove(@Param('membershipId') membershipId: string) {
    return this.membershipsService.remove(membershipId);
  }
}
