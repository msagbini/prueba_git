import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

/** Organization settings for the caller's active organization. See `organizations.service.ts` for the Fase 2 stub scope note. */
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
   * @returns the caller's active organization
   */
  @Get()
  getMine() {
    return this.organizationsService.getMine();
  }

  /**
   * Owner/Admin only.
   * @param dto the fields to update
   * @returns the updated organization
   */
  @UseGuards(RolesGuard)
  @Roles(RoleCode.OWNER, RoleCode.ADMIN)
  @Patch()
  updateMine(@Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.updateMine(dto);
  }
}
