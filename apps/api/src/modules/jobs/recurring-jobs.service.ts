import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Job } from '@prisma/client';
import { RRule } from 'rrule';
import { PrismaService } from '../../prisma/prisma.service';
import {
  runInTenantTransaction,
  type TenantPrismaClient,
} from '../../prisma/run-in-tenant-transaction';

/** How far ahead to materialize an occurrence — created once it falls within this window, not the instant it's created. */
const LOOKAHEAD_DAYS = 7;
/** Tolerance when checking whether an occurrence's instance already exists, absorbing any msec-level rounding through a DB round trip. */
const DUPLICATE_CHECK_TOLERANCE_MS = 60_000;

/**
 * Materializes real `Job` rows from `Job.recurrenceRule` — a field that's
 * existed since Fase 2 (the schema comment even says "generated recurring
 * instances back [to the parent]") but that nothing ever processed until
 * now: creating a job with a recurrence rule stored it and did nothing
 * else. Runs daily, looking `LOOKAHEAD_DAYS` ahead so a dispatcher sees
 * next week's recurring jobs on the board before they're due, not the
 * morning of.
 *
 * Has no per-request tenant context to run in (it's not triggered by a
 * request), so it enumerates organizations via the narrow
 * `system_job_read_all` RLS policy (see the
 * `system_job_org_visibility` migration) and then does the actual
 * per-organization work through the same `runInTenantTransaction` path
 * every request uses — this service never reads or writes job data
 * outside the normal RLS-protected route.
 */
@Injectable()
export class RecurringJobsService {
  private readonly logger = new Logger(RecurringJobsService.name);

  /**
   * Constructs the service around the base (unscoped) Prisma client.
   * @param prisma the base Prisma client — used directly only for the
   *   narrow system-job organization enumeration, never for job data
   */
  constructor(private readonly prisma: PrismaService) {}

  /** Runs daily: materializes any due recurring job occurrence for every organization. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async materializeDueOccurrences(): Promise<void> {
    const organizationIds = await this.listOrganizationIds();
    for (const organizationId of organizationIds) {
      try {
        const created = await runInTenantTransaction(this.prisma, organizationId, (tx) =>
          this.materializeForOrganization(tx),
        );
        if (created > 0) {
          this.logger.log(
            `Materialized ${created} recurring job instance(s) for organization ${organizationId}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed to materialize recurring jobs for organization ${organizationId}: ${err instanceof Error ? err.message : err}`,
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
   * Materializes due occurrences for every recurring job root in one
   * (already tenant-scoped) organization.
   * @param tx the tenant-scoped Prisma client for this organization
   * @returns how many job instances were created
   */
  private async materializeForOrganization(tx: TenantPrismaClient): Promise<number> {
    const roots = await tx.job.findMany({
      where: { recurrenceRule: { not: null }, parentJobId: null, deletedAt: null },
    });
    let created = 0;
    for (const root of roots) {
      if (await this.materializeOne(tx, root)) {
        created += 1;
      }
    }
    return created;
  }

  /**
   * Materializes one root's next due occurrence, if it's due and doesn't
   * already have a matching instance.
   * @param tx the tenant-scoped Prisma client
   * @param root the recurring job's root row
   * @returns whether a new instance was created
   */
  private async materializeOne(tx: TenantPrismaClient, root: Job): Promise<boolean> {
    if (!root.recurrenceRule || !root.scheduledStart) {
      return false;
    }
    const nextOccurrence = this.nextDueOccurrence(root.recurrenceRule, root.scheduledStart);
    if (!nextOccurrence) {
      return false;
    }

    const alreadyExists = await tx.job.findFirst({
      where: {
        parentJobId: root.id,
        scheduledStart: {
          gte: new Date(nextOccurrence.getTime() - DUPLICATE_CHECK_TOLERANCE_MS),
          lte: new Date(nextOccurrence.getTime() + DUPLICATE_CHECK_TOLERANCE_MS),
        },
      },
    });
    if (alreadyExists) {
      return false;
    }

    const durationMs = root.scheduledEnd
      ? root.scheduledEnd.getTime() - root.scheduledStart.getTime()
      : null;
    await tx.job.create({
      data: {
        organizationId: root.organizationId,
        clientId: root.clientId,
        serviceAddressId: root.serviceAddressId,
        parentJobId: root.id,
        scheduledStart: nextOccurrence,
        scheduledEnd: durationMs !== null ? new Date(nextOccurrence.getTime() + durationMs) : null,
        notes: root.notes,
        createdByUserId: root.createdByUserId,
      },
    });
    return true;
  }

  /**
   * Computes the next occurrence due within `LOOKAHEAD_DAYS` of `now`, if
   * any. Exposed (not private) for direct unit testing of the pure
   * date-math without a database.
   * @param recurrenceRule an RFC 5545 RRULE option string (e.g. "FREQ=WEEKLY;INTERVAL=2"), with or without a "RRULE:" prefix
   * @param anchor the root job's `scheduledStart`, used as the rule's DTSTART
   * @param now the current time, injectable for tests
   * @returns the next due occurrence, or null if the rule is invalid or nothing is due yet
   */
  nextDueOccurrence(recurrenceRule: string, anchor: Date, now: Date = new Date()): Date | null {
    try {
      const options = RRule.parseString(recurrenceRule.replace(/^RRULE:/, ''));
      const rule = new RRule({ ...options, dtstart: anchor });
      const windowEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
      const [nextOccurrence] = rule.between(now, windowEnd, true);
      return nextOccurrence ?? null;
    } catch {
      return null;
    }
  }
}
