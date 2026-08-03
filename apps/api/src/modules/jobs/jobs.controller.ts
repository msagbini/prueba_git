import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateJobAssignmentDto } from './dto/create-job-assignment.dto';
import { CreateJobServiceDto } from './dto/create-job-service.dto';

/** Scheduled jobs, assignments and billed services. See `jobs.service.ts` for the Fase 2 stub scope note. */
@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param jobsService implements this controller's routes
   */
  constructor(private readonly jobsService: JobsService) {}

  /**
   * Lists records.
   * @returns jobs visible to the caller.
   */
  @Get()
  list() {
    return this.jobsService.list();
  }

  /**
   * Creates a record.
   * @param dto the job to create
   * @returns the created record
   */
  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.create(dto);
  }

  /**
   * Fetches a single record.
   * @param id the job to fetch
   * @returns the matching record
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  /**
   * Updates a record.
   * @param id the job to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(id, dto);
  }

  /**
   * Removes a record.
   * @param id the job to remove
   * @returns the removal result
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.jobsService.remove(id);
  }

  /**
   * Assigns staff to a job.
   * @param id the job to assign staff to
   * @param dto the membership to assign
   * @returns the created assignment
   */
  @Post(':id/assignments')
  createAssignment(@Param('id') id: string, @Body() dto: CreateJobAssignmentDto) {
    return this.jobsService.createAssignment(id, dto);
  }

  /**
   * Adds a service to a job.
   * @param id the job to add a service to
   * @param dto the service and quantity to add
   * @returns the created job service
   */
  @Post(':id/services')
  createJobService(@Param('id') id: string, @Body() dto: CreateJobServiceDto) {
    return this.jobsService.createJobService(id, dto);
  }
}
