import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/** The service catalog. See `services.service.ts` for the Fase 2 stub scope note. */
@ApiTags('services')
@ApiBearerAuth()
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
  @Get('service-categories')
  listCategories() {
    return this.servicesService.listCategories();
  }

  /**
   * Creates a category.
   * @param dto the category to create
   * @returns the created category
   */
  @Post('service-categories')
  createCategory(@Body() dto: CreateServiceCategoryDto) {
    return this.servicesService.createCategory(dto);
  }

  /**
   * Lists records.
   * @returns every service in the caller's active organization.
   */
  @Get('services')
  list() {
    return this.servicesService.list();
  }

  /**
   * Creates a record.
   * @param dto the service to create
   * @returns the created record
   */
  @Post('services')
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  /**
   * Fetches a single record.
   * @param id the service to fetch
   * @returns the matching record
   */
  @Get('services/:id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  /**
   * Updates a record.
   * @param id the service to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @Patch('services/:id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  /**
   * Removes a record.
   * @param id the service to remove
   * @returns the removal result
   */
  @Delete('services/:id')
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
