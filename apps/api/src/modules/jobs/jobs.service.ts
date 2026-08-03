import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  RoleCode,
  type Job,
  type JobAssignment,
  type JobService as JobServiceRow,
} from '@prisma/client';
import { toDateOrUndefined } from '../../common/to-date';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';
import type { CreateJobAssignmentDto } from './dto/create-job-assignment.dto';
import type { CreateJobServiceDto } from './dto/create-job-service.dto';

/** Identifies the caller for row-level job visibility — see {@link JobsService.visibilityFilter}. */
export interface JobCaller {
  membershipId: string;
  role: string;
}

/**
 * Scheduled jobs: creation, status/scheduling updates, staff assignment
 * and the services billed to a job. `list`/`findOne` apply row-level
 * visibility on top of the tenant scoping every model gets: a Staff
 * caller only sees jobs they're assigned to, a Client caller only sees
 * their own jobs — Owner/Admin/Dispatcher see everything (see the RBAC
 * matrix in docs/architecture/auth.md). `update`/`remove`/assignment/
 * job-service routes require `jobs.manage`, which Staff and Client never
 * hold, so no equivalent restriction is needed there.
 */
@Injectable()
export class JobsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param auditLog records changes made through this service
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditLog: AuditLogWriterService,
  ) {}

  /**
   * Lists records.
   * @param caller the authenticated caller, for row-level visibility
   * @returns jobs visible to the caller
   */
  async list(caller: JobCaller): Promise<Job[]> {
    return this.tenantContext.client.job.findMany({
      where: { deletedAt: null, ...(await this.visibilityFilter(caller)) },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  /**
   * Creates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, both as the creator and for the audit trail
   * @param dto the job to create
   * @returns the created record
   */
  async create(organizationId: string, actorUserId: string, dto: CreateJobDto): Promise<Job> {
    await this.assertClientExists(dto.clientId);
    if (dto.serviceAddressId) {
      await this.assertAddressBelongsToClient(dto.serviceAddressId, dto.clientId);
    }

    const job = await this.tenantContext.client.job.create({
      data: {
        organizationId,
        clientId: dto.clientId,
        serviceAddressId: dto.serviceAddressId,
        scheduledStart: toDateOrUndefined(dto.scheduledStart),
        scheduledEnd: toDateOrUndefined(dto.scheduledEnd),
        recurrenceRule: dto.recurrenceRule,
        notes: dto.notes,
        createdByUserId: actorUserId,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job.created',
      entityType: 'Job',
      entityId: job.id,
      after: job,
    });

    return job;
  }

  /**
   * Fetches a single record.
   * @param caller the authenticated caller, for row-level visibility
   * @param id the job to fetch
   * @returns the matching record
   */
  async findOne(caller: JobCaller, id: string): Promise<Job> {
    return this.findOrThrow(caller, id);
  }

  /**
   * Updates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param id the job to update
   * @param dto the fields to change
   * @returns the updated record
   */
  async update(
    organizationId: string,
    actorUserId: string,
    caller: JobCaller,
    id: string,
    dto: UpdateJobDto,
  ): Promise<Job> {
    const before = await this.findOrThrow(caller, id);
    if (dto.serviceAddressId) {
      await this.assertAddressBelongsToClient(dto.serviceAddressId, before.clientId);
    }

    const after = await this.tenantContext.client.job.update({
      where: { id },
      data: {
        status: dto.status,
        serviceAddressId: dto.serviceAddressId,
        scheduledStart: toDateOrUndefined(dto.scheduledStart),
        scheduledEnd: toDateOrUndefined(dto.scheduledEnd),
        notes: dto.notes,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job.updated',
      entityType: 'Job',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Soft-deletes a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param id the job to remove
   */
  async remove(
    organizationId: string,
    actorUserId: string,
    caller: JobCaller,
    id: string,
  ): Promise<void> {
    const before = await this.findOrThrow(caller, id);

    const after = await this.tenantContext.client.job.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job.removed',
      entityType: 'Job',
      entityId: id,
      before,
      after,
    });
  }

  /**
   * Assigns staff to a job.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param jobId the job to assign staff to
   * @param dto the membership to assign
   * @returns the created assignment
   */
  async createAssignment(
    organizationId: string,
    actorUserId: string,
    caller: JobCaller,
    jobId: string,
    dto: CreateJobAssignmentDto,
  ): Promise<JobAssignment> {
    await this.findOrThrow(caller, jobId);

    const membership = await this.tenantContext.client.organizationMembership.findFirst({
      where: { id: dto.membershipId },
    });
    if (!membership) {
      throw new BadRequestException(
        'membershipId does not belong to the caller’s active organization.',
      );
    }

    const assignment = await this.tenantContext.client.jobAssignment.create({
      data: { organizationId, jobId, membershipId: dto.membershipId },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job_assignment.created',
      entityType: 'JobAssignment',
      entityId: assignment.id,
      after: assignment,
    });

    return assignment;
  }

  /**
   * Adds a service to a job, snapshotting its current base price.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param jobId the job to add a service to
   * @param dto the service and quantity to add
   * @returns the created job service
   */
  async createJobService(
    organizationId: string,
    actorUserId: string,
    caller: JobCaller,
    jobId: string,
    dto: CreateJobServiceDto,
  ): Promise<JobServiceRow> {
    await this.findOrThrow(caller, jobId);

    const service = await this.tenantContext.client.service.findFirst({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new BadRequestException(
        'serviceId does not belong to the caller’s active organization.',
      );
    }

    const jobService = await this.tenantContext.client.jobService.create({
      data: {
        organizationId,
        jobId,
        serviceId: dto.serviceId,
        quantity: dto.quantity,
        unitPriceSnapshot: service.basePrice,
        notes: dto.notes,
      },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job_service.created',
      entityType: 'JobService',
      entityId: jobService.id,
      after: jobService,
    });

    return jobService;
  }

  /**
   * Fetches a non-deleted, caller-visible job or throws if it can't be found.
   * @param caller the authenticated caller, for row-level visibility
   * @param id the job to fetch
   * @returns the matching record
   * @throws NotFoundException if no such job is visible to the caller
   */
  private async findOrThrow(caller: JobCaller, id: string): Promise<Job> {
    const job = await this.tenantContext.client.job.findFirst({
      where: { id, deletedAt: null, ...(await this.visibilityFilter(caller)) },
    });
    if (!job) {
      throw new NotFoundException('Job not found.');
    }
    return job;
  }

  /**
   * Builds the extra `where` clause restricting which jobs a Staff or
   * Client caller may see — see the class-level scope note. Owner/Admin/
   * Dispatcher get an empty filter (no restriction).
   * @param caller the authenticated caller
   * @returns a Prisma `where` fragment to merge into a job query
   */
  private async visibilityFilter(caller: JobCaller): Promise<Record<string, unknown>> {
    if (caller.role === RoleCode.STAFF) {
      return { assignments: { some: { membershipId: caller.membershipId } } };
    }
    if (caller.role === RoleCode.CLIENT) {
      const membership = await this.tenantContext.client.organizationMembership.findFirst({
        where: { id: caller.membershipId },
      });
      // No linked Client record (shouldn't happen for a real Client
      // membership, but fail closed rather than show every job) — filter
      // to a clientId that can never match.
      return { clientId: membership?.clientId ?? '00000000-0000-0000-0000-000000000000' };
    }
    return {};
  }

  /**
   * Confirms a client exists (and isn't soft-deleted) in the caller's active organization.
   * @param clientId the client to check
   * @throws BadRequestException if no such client exists
   */
  private async assertClientExists(clientId: string): Promise<void> {
    const client = await this.tenantContext.client.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client) {
      throw new BadRequestException(
        'clientId does not belong to the caller’s active organization.',
      );
    }
  }

  /**
   * Confirms an address belongs to the given client.
   * @param addressId the address to check
   * @param clientId the client it must belong to
   * @throws BadRequestException if the address doesn't belong to that client
   */
  private async assertAddressBelongsToClient(addressId: string, clientId: string): Promise<void> {
    const address = await this.tenantContext.client.clientAddress.findFirst({
      where: { id: addressId, clientId },
    });
    if (!address) {
      throw new BadRequestException('serviceAddressId does not belong to the job’s client.');
    }
  }
}
