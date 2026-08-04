import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { StaffService } from './staff.service';
import { UpdateStaffDto } from './dto/update-staff.dto';

/** Staff profiles. */
@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('staff')
export class StaffController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param staffService implements this controller's routes
   */
  constructor(private readonly staffService: StaffService) {}

  /**
   * Lists records.
   * @param pagination the requested page/pageSize
   * @returns a page of staff profiles in the caller's active organization
   */
  @RequirePermissions('staff.read')
  @Get()
  list(@Query() pagination: PaginationQueryDto) {
    return this.staffService.list(pagination);
  }

  /**
   * Fetches a single record.
   * @param id the staff profile to fetch
   * @returns the matching record
   */
  @RequirePermissions('staff.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  /**
   * Updates a record.
   * @param user the authenticated caller
   * @param id the staff profile to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @RequirePermissions('staff.manage')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(user.org, user.sub, id, dto);
  }
}
