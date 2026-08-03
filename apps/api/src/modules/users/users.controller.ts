import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

/** Users visible within the caller's active organization. */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param usersService implements this controller's routes
   */
  constructor(private readonly usersService: UsersService) {}

  /**
   * Lists records.
   * @returns every user sharing a membership with the caller's active organization.
   */
  @Get()
  list() {
    return this.usersService.list();
  }

  /**
   * Fetches a single record.
   * @param id the user to fetch
   * @returns the matching record
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Updates a record. The caller themselves, or an Owner/Admin.
   * @param user the authenticated caller
   * @param id the user to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.org, { userId: user.sub, role: user.role }, id, dto);
  }

  /**
   * Removes a record. The caller themselves, or an Owner/Admin.
   * @param user the authenticated caller
   * @param id the user to remove from the caller's active organization
   * @returns the removal result
   */
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.remove(user.org, { userId: user.sub, role: user.role }, id);
  }
}
