import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ServicesService } from './services.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/** The service catalog. */
@ApiTags('services')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller()
export class ServicesController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param servicesService implements this controller's routes
   */
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * Lists categories.
   * @returns every service category in the caller's active organization.
   */
  @RequirePermissions('services.read')
  @Get('service-categories')
  listCategories() {
    return this.servicesService.listCategories();
  }

  /**
   * Creates a category.
   * @param user the authenticated caller
   * @param dto the category to create
   * @returns the created category
   */
  @RequirePermissions('services.manage')
  @Post('service-categories')
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServiceCategoryDto) {
    return this.servicesService.createCategory(user.org, user.sub, dto);
  }

  /**
   * Lists records.
   * @param pagination the requested page/pageSize
   * @returns a page of services in the caller's active organization
   */
  @RequirePermissions('services.read')
  @Get('services')
  list(@Query() pagination: PaginationQueryDto) {
    return this.servicesService.list(pagination);
  }

  /**
   * Creates a record.
   * @param user the authenticated caller
   * @param dto the service to create
   * @returns the created record
   */
  @RequirePermissions('services.manage')
  @Post('services')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServiceDto) {
    return this.servicesService.create(user.org, user.sub, dto);
  }

  /**
   * Fetches a single record.
   * @param id the service to fetch
   * @returns the matching record
   */
  @RequirePermissions('services.read')
  @Get('services/:id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  /**
   * Updates a record.
   * @param user the authenticated caller
   * @param id the service to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @RequirePermissions('services.manage')
  @Patch('services/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(user.org, user.sub, id, dto);
  }

  /**
   * Removes a record.
   * @param user the authenticated caller
   * @param id the service to remove
   * @returns the removal result
   */
  @RequirePermissions('services.manage')
  @Delete('services/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.servicesService.remove(user.org, user.sub, id);
  }
}
