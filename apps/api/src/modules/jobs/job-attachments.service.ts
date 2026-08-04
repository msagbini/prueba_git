import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JobAttachment } from '@prisma/client';
import type { EnvConfig } from '../../config/env.validation';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import { JobsService, type JobCaller } from './jobs.service';

/** What multer's disk storage hands the controller once a file is written — see `job-attachment-storage.ts`. */
export interface UploadedAttachmentFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

/**
 * Photo/file attachments on a job (e.g. before/after cleaning photos) —
 * record-keeping and authenticated retrieval around files multer has
 * already validated and written to disk (see
 * `job-attachment-storage.ts`). Authorization mirrors `JobsService`'s
 * `jobs.read` routes (start/complete): whoever can see the job can attach
 * to and read from it — a Staff caller only if assigned, via
 * `JobsService.findOne`'s existing visibility check, not duplicated here.
 */
@Injectable()
export class JobAttachmentsService {
  private readonly uploadsDir: string;

  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param auditLog records changes made through this service
   * @param jobsService used to authorize the caller against the target job
   * @param config resolves the configured uploads directory
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditLog: AuditLogWriterService,
    private readonly jobsService: JobsService,
    config: ConfigService<EnvConfig, true>,
  ) {
    this.uploadsDir = config.get('UPLOADS_DIR', { infer: true });
  }

  /**
   * Records an already-uploaded file as a job attachment.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, both as uploader and for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param jobId the job to attach the file to
   * @param file the file multer already validated and wrote to disk
   * @returns the created attachment record
   */
  async create(
    organizationId: string,
    actorUserId: string,
    caller: JobCaller,
    jobId: string,
    file: UploadedAttachmentFile,
  ): Promise<JobAttachment> {
    await this.jobsService.findOne(caller, jobId); // throws NotFoundException if the caller can't see this job

    const attachment = await this.tenantContext.client.jobAttachment.create({
      data: {
        organizationId,
        jobId,
        uploadedByUserId: actorUserId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        storagePath: file.storagePath,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job_attachment.created',
      entityType: 'JobAttachment',
      entityId: attachment.id,
      after: attachment,
    });

    return attachment;
  }

  /**
   * Lists a job's attachments.
   * @param caller the authenticated caller, for row-level visibility
   * @param jobId the job to list attachments for
   * @returns the job's attachments, newest first
   */
  async list(caller: JobCaller, jobId: string): Promise<JobAttachment[]> {
    await this.jobsService.findOne(caller, jobId);
    return this.tenantContext.client.jobAttachment.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetches one attachment's metadata plus a stream of its file content.
   * @param caller the authenticated caller, for row-level visibility
   * @param jobId the attachment's job
   * @param attachmentId the attachment to fetch
   * @returns the attachment record and a readable stream of its file
   */
  async getFileStream(
    caller: JobCaller,
    jobId: string,
    attachmentId: string,
  ): Promise<{ attachment: JobAttachment; stream: Readable }> {
    await this.jobsService.findOne(caller, jobId);
    const attachment = await this.tenantContext.client.jobAttachment.findFirst({
      where: { id: attachmentId, jobId },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }
    const stream = createReadStream(join(this.uploadsDir, attachment.storagePath));
    return { attachment, stream };
  }

  /**
   * Deletes an orphaned upload from disk — used when the DB write for a
   * newly-uploaded file fails, so a failed request doesn't leave an
   * unreferenced file behind.
   * @param storagePath the path (relative to `UPLOADS_DIR`) to remove
   */
  async deleteOrphanedFile(storagePath: string): Promise<void> {
    await unlink(join(this.uploadsDir, storagePath)).catch(() => undefined);
  }
}
