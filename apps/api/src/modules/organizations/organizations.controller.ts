import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

/** Organization settings for the caller's active organization. */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations/me')
export class OrganizationsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param organizationsService implements this controller's routes
   */
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Fetches the caller's active organization.
   * @param user the authenticated caller
   * @returns the caller's active organization
   */
  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getMine(user.org);
  }

  /**
   * Owner/Admin only.
   * @param user the authenticated caller
   * @param dto the fields to update
   * @returns the updated organization
   */
  @UseGuards(RolesGuard)
  @Roles(RoleCode.OWNER, RoleCode.ADMIN)
  @Patch()
  updateMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.updateMine(user.org, user.sub, dto);
  }
}
