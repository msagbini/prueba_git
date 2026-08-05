import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { MembershipsService } from './memberships.service';
import { UpdateMembershipDto } from './dto/update-membership.dto';

/** Manages membership in the caller's active organization. */
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
   * @param user the authenticated caller
   * @param membershipId the membership to update
   * @param dto the fields to change
   * @returns the updated membership
   */
  @Patch(':membershipId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    return this.membershipsService.update(user.org, user.sub, membershipId, dto);
  }

  /**
   * Removes a record.
   * @param user the authenticated caller
   * @param membershipId the membership to remove
   * @returns the removal result
   */
  @Delete(':membershipId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('membershipId') membershipId: string) {
    return this.membershipsService.remove(user.org, user.sub, membershipId);
  }
}
