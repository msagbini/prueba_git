import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  runInTenantTransaction,
  type TenantPrismaClient,
} from '../../prisma/run-in-tenant-transaction';

/** How far ahead a job's `scheduledStart` must be to earn a reminder. */
const REMINDER_WINDOW_HOURS = 24;

/**
 * Notifies assigned staff and the client (if they have a portal
 * account) about a job starting soon — `NotificationType.JOB_REMINDER`.
 * Runs hourly rather than daily (unlike `RecurringJobsService`) since a
 * 24-hour reminder window means a job entering that window mid-day
 * shouldn't wait until the next morning's run to get one.
 *
 * Same "no per-request tenant context" problem `RecurringJobsService`
 * solves, solved the same way: enumerate organizations via the narrow
 * `system_job_read_all` RLS policy, then do the actual per-organization
 * work through `runInTenantTransaction` — this service never reads or
 * writes outside the normal RLS-protected path.
 */
@Injectable()
export class JobRemindersService {
  private readonly logger = new Logger(JobRemindersService.name);

  /**
   * Constructs the service around the base (unscoped) Prisma client.
   * @param prisma the base Prisma client — used directly only for the
   *   narrow system-job organization enumeration, never for job data
   */
  constructor(private readonly prisma: PrismaService) {}

  /** Runs hourly: notifies about every job starting within the reminder window that hasn't been notified about yet. */
  @Cron(CronExpression.EVERY_HOUR)
  async sendDueReminders(): Promise<void> {
    const organizationIds = await this.listOrganizationIds();
    for (const organizationId of organizationIds) {
      try {
        const sent = await runInTenantTransaction(this.prisma, organizationId, (tx) =>
          this.sendForOrganization(tx, organizationId),
        );
        if (sent > 0) {
          this.logger.log(
            `Sent ${sent} job reminder notification(s) for organization ${organizationId}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed to send job reminders for organization ${organizationId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Enumerates every organization id via the narrow system-job policy.
   * @returns every organization's id
   */
  private async listOrganizationIds(): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.system_job', 'true', true)`;
      const organizations = await tx.organization.findMany({ select: { id: true } });
      return organizations.map((o) => o.id);
    });
  }

  /**
   * Sends due reminders for one (already tenant-scoped) organization.
   * @param tx the tenant-scoped Prisma client for this organization
   * @param organizationId the organization being processed
   * @returns how many notifications were sent
   */
  private async sendForOrganization(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<number> {
    const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);
    const dueJobs = await tx.job.findMany({
      where: {
        deletedAt: null,
        scheduledStart: { gte: new Date(), lte: windowEnd },
        status: { in: ['DRAFT', 'SCHEDULED'] },
      },
      include: {
        client: { select: { id: true, name: true } },
        assignments: { select: { membership: { select: { userId: true } } } },
      },
    });

    let sent = 0;
    for (const job of dueJobs) {
      const recipientUserIds = new Set<string>();
      for (const assignment of job.assignments) {
        recipientUserIds.add(assignment.membership.userId);
      }
      // A client organization can have more than one portal user linked
      // to the same Client record (each invited separately) — notify
      // all of them, not just the first.
      const clientMemberships = await tx.organizationMembership.findMany({
        where: { clientId: job.clientId, role: { code: RoleCode.CLIENT } },
        select: { userId: true },
      });
      for (const membership of clientMemberships) {
        recipientUserIds.add(membership.userId);
      }

      for (const userId of recipientUserIds) {
        if (await this.alreadyReminded(tx, job.id, userId)) {
          continue;
        }
        await tx.notification.create({
          data: {
            organizationId,
            userId,
            type: 'JOB_REMINDER',
            title: 'Upcoming job',
            body: job.client
              ? `A job for ${job.client.name} is scheduled within the next ${REMINDER_WINDOW_HOURS} hours.`
              : `A job is scheduled within the next ${REMINDER_WINDOW_HOURS} hours.`,
            entityType: 'Job',
            entityId: job.id,
          },
        });
        sent += 1;
      }
    }
    return sent;
  }

  /**
   * Whether this recipient already has a `JOB_REMINDER` notification for
   * this job — the idempotency check that lets this run hourly without
   * spamming the same reminder every run, without needing a new field
   * on `Job` to track "was a reminder sent" (the `Notification` table
   * already has everything this check needs).
   * @param tx the tenant-scoped Prisma client
   * @param jobId the job a reminder would be about
   * @param userId the would-be recipient
   * @returns whether a reminder for this job+recipient already exists
   */
  private async alreadyReminded(
    tx: TenantPrismaClient,
    jobId: string,
    userId: string,
  ): Promise<boolean> {
    const existing = await tx.notification.findFirst({
      where: { type: 'JOB_REMINDER', entityType: 'Job', entityId: jobId, userId },
      select: { id: true },
    });
    return existing !== null;
  }
}
