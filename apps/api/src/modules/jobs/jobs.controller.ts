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
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateJobAssignmentDto } from './dto/create-job-assignment.dto';
import { CreateJobServiceDto } from './dto/create-job-service.dto';

/** Scheduled jobs, assignments and billed services. */
@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('jobs')
export class JobsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param jobsService implements this controller's routes
   */
  constructor(private readonly jobsService: JobsService) {}

  /**
   * Lists records.
   * @param user the authenticated caller
   * @param pagination the requested page/pageSize
   * @returns a page of jobs visible to the caller
   */
  @RequirePermissions('jobs.read')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationQueryDto) {
    return this.jobsService.list({ membershipId: user.membershipId, role: user.role }, pagination);
  }

  /**
   * Creates a record.
   * @param user the authenticated caller
   * @param dto the job to create
   * @returns the created record
   */
  @RequirePermissions('jobs.manage')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto) {
    return this.jobsService.create(user.org, user.sub, dto);
  }

  /**
   * Fetches a single record.
   * @param user the authenticated caller
   * @param id the job to fetch
   * @returns the matching record
   */
  @RequirePermissions('jobs.read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobsService.findOne({ membershipId: user.membershipId, role: user.role }, id);
  }

  /**
   * Updates a record.
   * @param user the authenticated caller
   * @param id the job to update
   * @param dto the fields to change
   * @returns the updated record
   */
  @RequirePermissions('jobs.manage')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
      dto,
    );
  }

  /**
   * Removes a record.
   * @param user the authenticated caller
   * @param id the job to remove
   * @returns the removal result
   */
  @RequirePermissions('jobs.manage')
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobsService.remove(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
    );
  }

  /**
   * Starts a job ("clock in"). Any caller who can see the job may start
   * it (Staff: only if assigned), except Client.
   * @param user the authenticated caller
   * @param id the job to start
   * @returns the updated record
   */
  @RequirePermissions('jobs.read')
  @Post(':id/start')
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobsService.start(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
    );
  }

  /**
   * Completes a job ("clock out"). Same authorization as `start`.
   * @param user the authenticated caller
   * @param id the job to complete
   * @returns the updated record
   */
  @RequirePermissions('jobs.read')
  @Post(':id/complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobsService.complete(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
    );
  }

  /**
   * Assigns staff to a job.
   * @param user the authenticated caller
   * @param id the job to assign staff to
   * @param dto the membership to assign
   * @returns the created assignment
   */
  @RequirePermissions('jobs.manage')
  @Post(':id/assignments')
  createAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateJobAssignmentDto,
  ) {
    return this.jobsService.createAssignment(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
      dto,
    );
  }

  /**
   * Adds a service to a job.
   * @param user the authenticated caller
   * @param id the job to add a service to
   * @param dto the service and quantity to add
   * @returns the created job service
   */
  @RequirePermissions('jobs.manage')
  @Post(':id/services')
  createJobService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateJobServiceDto,
  ) {
    return this.jobsService.createJobService(
      user.org,
      user.sub,
      { membershipId: user.membershipId, role: user.role },
      id,
      dto,
    );
  }
}
