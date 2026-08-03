import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { UpdateStaffDto } from './dto/update-staff.dto';

/** Staff profiles. See `staff.service.ts` for the Fase 2 stub scope note. */
@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param staffService implements this controller's routes
   */
  constructor(private readonly staffService: StaffService) {}

  /**
   * Lists records.
   * @returns every staff profile in the caller's active organization.
   */
  @Get()
  list() {
    return this.staffService.list();
  }

  /**
   * Fetches a single record.
   * @param id the staff profile to fetch
   * @returns the matching record
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  /**
   * Updates a record.
   * @param id the staff profile to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }
}
