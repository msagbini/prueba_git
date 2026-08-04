import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { join } from 'node:path';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JobsService } from './jobs.service';
import { JobAttachmentsService } from './job-attachments.service';
import { jobAttachmentMulterOptions } from './job-attachment-storage';
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
   * Constructs the controller around the services implementing its routes.
   * @param jobsService implements this controller's job routes
   * @param attachmentsService implements this controller's attachment routes
   */
  constructor(
    private readonly jobsService: JobsService,
    private readonly attachmentsService: JobAttachmentsService,
  ) {}

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

  /**
   * Uploads a photo/file attachment (e.g. before/after evidence) to a
   * job. Same authorization as `start`/`complete`: whoever can see the
   * job (Staff, only if assigned) can attach to it.
   * @param user the authenticated caller
   * @param id the job to attach the file to
   * @param file the uploaded file, already validated and written to disk by multer
   * @returns the created attachment record
   */
  @RequirePermissions('jobs.read')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', jobAttachmentMulterOptions(process.env.UPLOADS_DIR ?? './uploads')),
  )
  @Post(':id/attachments')
  async createAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      return await this.attachmentsService.create(
        user.org,
        user.sub,
        { membershipId: user.membershipId, role: user.role },
        id,
        {
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath: join(user.org, file.filename),
        },
      );
    } catch (err) {
      // The job lookup (visibility check) happens after multer has
      // already written the file — clean up rather than leave an
      // attachment-less file behind if that check fails.
      await this.attachmentsService.deleteOrphanedFile(join(user.org, file.filename));
      throw err;
    }
  }

  /**
   * Lists a job's attachments.
   * @param user the authenticated caller
   * @param id the job to list attachments for
   * @returns the job's attachments, newest first
   */
  @RequirePermissions('jobs.read')
  @Get(':id/attachments')
  listAttachments(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.attachmentsService.list({ membershipId: user.membershipId, role: user.role }, id);
  }

  /**
   * Streams one attachment's file content.
   * @param user the authenticated caller
   * @param id the attachment's job
   * @param attachmentId the attachment to download
   * @param res used to set the response's Content-Type/Content-Disposition
   * @returns a stream of the file's content
   */
  @RequirePermissions('jobs.read')
  @Get(':id/attachments/:attachmentId')
  async downloadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { attachment, stream } = await this.attachmentsService.getFileStream(
      { membershipId: user.membershipId, role: user.role },
      id,
      attachmentId,
    );
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
    });
    return new StreamableFile(stream);
  }
}
