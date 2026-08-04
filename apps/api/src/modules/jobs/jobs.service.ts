import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobStatus,
  Prisma,
  RoleCode,
  type Job,
  type JobAssignment,
  type JobService as JobServiceRow,
} from '@prisma/client';
import { toDateOrUndefined } from '../../common/to-date';
import { paginate, type PaginatedResult } from '../../common/pagination';
import { SAFE_USER_SELECT } from '../../common/safe-user';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import { BillingService } from '../billing/billing.service';
import { NotificationWriterService } from '../notifications/notification-writer.service';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';
import type { CreateJobAssignmentDto } from './dto/create-job-assignment.dto';
import type { CreateJobServiceDto } from './dto/create-job-service.dto';
import type { ListJobsQueryDto } from './dto/list-jobs-query.dto';

/** Identifies the caller for row-level job visibility — see {@link JobsService.visibilityFilter}. */
export interface JobCaller {
  membershipId: string;
  role: string;
}

/**
 * What `list`/`findOne` embed alongside a job — client contact info, the
 * service address, billed services, and assigned staff. Staff callers
 * have `jobs.read` but not `clients.read`/`services.read`, so this is the
 * only way a field-staff client (mobile app) can learn who/where/what a
 * job is for; without it, a Staff caller could see a job existed but
 * nothing else about it. `assignments` was added alongside the web
 * dispatch UI (Fase 9) — without it, "assign staff" would be write-only,
 * with no way to show who's already on a job.
 */
const JOB_DETAILS_INCLUDE = {
  client: { select: { id: true, name: true, primaryContactName: true, phone: true, email: true } },
  serviceAddress: true,
  jobServices: { include: { service: { select: { id: true, name: true } } } },
  assignments: {
    include: { membership: { select: { id: true, user: { select: SAFE_USER_SELECT } } } },
  },
} satisfies Prisma.JobInclude;

/** A job with the related data {@link JOB_DETAILS_INCLUDE} embeds. */
export type JobWithDetails = Prisma.JobGetPayload<{ include: typeof JOB_DETAILS_INCLUDE }>;

/**
 * Scheduled jobs: creation, status/scheduling updates, staff assignment
 * and the services billed to a job. `list`/`findOne` apply row-level
 * visibility on top of the tenant scoping every model gets: a Staff
 * caller only sees jobs they're assigned to, a Client caller only sees
 * their own jobs — Owner/Admin/Dispatcher see everything (see the RBAC
 * matrix in docs/architecture/auth.md). `update`/`remove`/assignment/
 * job-service routes require `jobs.manage`, which Staff and Client never
 * hold, so no equivalent restriction is needed there. `create` is gated
 * by the active plan's `maxActiveJobs` limit (see
 * `BillingService.assertActiveJobLimit`).
 */
@Injectable()
export class JobsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param auditLog records changes made through this service
   * @param billing enforces the active plan's active-job limit
   * @param notifications notifies a staff member when they're assigned to a job
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditLog: AuditLogWriterService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationWriterService,
  ) {}

  /**
   * Lists records. `scheduledFrom`/`scheduledTo` (both optional) narrow
   * to jobs scheduled in that window — the web dispatch calendar uses
   * this to pull one week at a time instead of paging through every
   * job in the organization.
   * @param caller the authenticated caller, for row-level visibility
   * @param query the requested page/pageSize and optional scheduled-date window
   * @returns a page of jobs visible to the caller, with client/address/services details
   */
  async list(caller: JobCaller, query: ListJobsQueryDto): Promise<PaginatedResult<JobWithDetails>> {
    const where: Prisma.JobWhereInput = {
      deletedAt: null,
      ...(await this.visibilityFilter(caller)),
    };
    if (query.scheduledFrom || query.scheduledTo) {
      where.scheduledStart = {
        ...(query.scheduledFrom ? { gte: new Date(query.scheduledFrom) } : {}),
        ...(query.scheduledTo ? { lt: new Date(query.scheduledTo) } : {}),
      };
    }
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.tenantContext.client.job.findMany({
        where,
        orderBy: { scheduledStart: 'asc' },
        include: JOB_DETAILS_INCLUDE,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.tenantContext.client.job.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  /**
   * Creates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, both as the creator and for the audit trail
   * @param dto the job to create
   * @returns the created record
   */
  async create(organizationId: string, actorUserId: string, dto: CreateJobDto): Promise<Job> {
    await this.billing.assertMineActiveJobLimit();
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
   * @returns the matching record, with client/address/services details
   */
  async findOne(caller: JobCaller, id: string): Promise<JobWithDetails> {
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
        actualStart: toDateOrUndefined(dto.actualStart),
        actualEnd: toDateOrUndefined(dto.actualEnd),
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
   * Marks a job as started ("clock in"): transitions `DRAFT`/`SCHEDULED`
   * to `IN_PROGRESS` and records `actualStart` as now. Reuses
   * `findOrThrow`'s row-level visibility check as the authorization: a
   * Staff caller can only start a job they're assigned to (or get a 404,
   * same as any other job they can't see); Owner/Admin/Dispatcher can
   * start any job. Deliberately does **not** require `jobs.manage` — that
   * permission covers reassignment/rescheduling/deletion, well beyond
   * what a field-staff caller starting their own work needs.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param id the job to start
   * @returns the updated record
   * @throws ForbiddenException if the caller is a Client
   * @throws BadRequestException if the job isn't `DRAFT` or `SCHEDULED`
   */
  async start(
    organizationId: string,
    actorUserId: string,
    caller: JobCaller,
    id: string,
  ): Promise<Job> {
    this.assertCanClock(caller);
    const before = await this.findOrThrow(caller, id);
    if (before.status !== JobStatus.DRAFT && before.status !== JobStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot start a job with status ${before.status}.`);
    }

    const after = await this.tenantContext.client.job.update({
      where: { id },
      data: { status: JobStatus.IN_PROGRESS, actualStart: new Date() },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job.started',
      entityType: 'Job',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Marks a job as completed ("clock out"): transitions `IN_PROGRESS` to
   * `COMPLETED` and records `actualEnd` as now. Same authorization as
   * {@link start}.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param id the job to complete
   * @returns the updated record
   * @throws ForbiddenException if the caller is a Client
   * @throws BadRequestException if the job isn't `IN_PROGRESS`
   */
  async complete(
    organizationId: string,
    actorUserId: string,
    caller: JobCaller,
    id: string,
  ): Promise<Job> {
    this.assertCanClock(caller);
    const before = await this.findOrThrow(caller, id);
    if (before.status !== JobStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot complete a job with status ${before.status}.`);
    }

    const after = await this.tenantContext.client.job.update({
      where: { id },
      data: { status: JobStatus.COMPLETED, actualEnd: new Date() },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'job.completed',
      entityType: 'Job',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Assigns staff to a job. Notifies the assigned staff member
   * (`NotificationType.JOB_ASSIGNED`) so they learn about it without
   * having to keep re-checking their jobs list.
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
    const job = await this.findOrThrow(caller, jobId);

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

    await this.notifications.create({
      organizationId,
      userId: membership.userId,
      type: 'JOB_ASSIGNED',
      title: 'New job assigned',
      body: job.client
        ? `You've been assigned to a job for ${job.client.name}.`
        : "You've been assigned to a job.",
      entityType: 'Job',
      entityId: jobId,
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
   * @returns the matching record, with client/address/services details
   * @throws NotFoundException if no such job is visible to the caller
   */
  private async findOrThrow(caller: JobCaller, id: string): Promise<JobWithDetails> {
    const job = await this.tenantContext.client.job.findFirst({
      where: { id, deletedAt: null, ...(await this.visibilityFilter(caller)) },
      include: JOB_DETAILS_INCLUDE,
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
   * Rejects Client callers from starting/completing a job — clocking in/
   * out is a field-staff action, not something a Client's portal access
   * should be able to trigger.
   * @param caller the authenticated caller
   * @throws ForbiddenException if the caller is a Client
   */
  private assertCanClock(caller: JobCaller): void {
    if (caller.role === RoleCode.CLIENT) {
      throw new ForbiddenException('Clients cannot start or complete jobs.');
    }
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
