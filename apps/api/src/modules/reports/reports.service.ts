import { Injectable } from '@nestjs/common';
import { InvoiceStatus, JobStatus, PaymentStatus, Prisma } from '@prisma/client';
import { SAFE_USER_SELECT } from '../../common/safe-user';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { DateRangeQueryDto } from './dto/date-range-query.dto';
import { ReportGranularity, type RevenueQueryDto } from './dto/revenue-query.dto';
import type { TopClientsQueryDto } from './dto/top-clients-query.dto';

const DEFAULT_RANGE_DAYS = 30;

/** One bucket of `GET /reports/revenue`. */
export interface RevenueBucket {
  periodStart: string;
  revenue: Prisma.Decimal;
}

/** Response shape for `GET /reports/revenue`. */
export interface RevenueReport {
  from: string;
  to: string;
  granularity: ReportGranularity;
  totalRevenue: Prisma.Decimal;
  buckets: RevenueBucket[];
}

/** Response shape for `GET /reports/jobs-summary`. */
export interface JobsSummaryReport {
  from: string;
  to: string;
  totalJobs: number;
  byStatus: Record<JobStatus, number>;
}

/** One row of `GET /reports/staff-performance`. */
export interface StaffPerformanceRow {
  staffProfileId: string;
  membershipId: string;
  name: string;
  jobsCompleted: number;
  hoursWorked: number;
}

/** Response shape for `GET /reports/staff-performance`. */
export interface StaffPerformanceReport {
  from: string;
  to: string;
  staff: StaffPerformanceRow[];
}

/** One row of `GET /reports/top-clients`. */
export interface TopClientRow {
  clientId: string;
  name: string;
  revenue: Prisma.Decimal;
  jobCount: number;
}

/** Response shape for `GET /reports/top-clients`. */
export interface TopClientsReport {
  from: string;
  to: string;
  clients: TopClientRow[];
}

/** Response shape for `GET /reports/outstanding-invoices`. */
export interface OutstandingInvoicesReport {
  asOf: string;
  outstandingCount: number;
  outstandingTotal: Prisma.Decimal;
  overdueCount: number;
  overdueTotal: Prisma.Decimal;
}

/**
 * Read-only operational and financial reports for the caller's active
 * organization, computed from data the Fase 3 business modules already
 * write (`Payment`, `Job`, `Invoice`, `StaffProfile`) — no new schema.
 * Aggregation happens in application code rather than SQL `groupBy`/raw
 * queries: the tenant-scoping Prisma extension does not auto-scope
 * `groupBy`/`aggregate` (see `tenant-scoping.extension.ts`), and hand-
 * written raw SQL would have to re-implement that scoping itself: an easy
 * place to accidentally leak cross-tenant data. `findMany` is auto-scoped,
 * so every report is built by fetching the relevant (already tenant-
 * scoped) rows and reducing them in TypeScript — simple and safe, and at
 * the per-organization data volumes this product operates at, fast enough.
 */
@Injectable()
export class ReportsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Total and time-bucketed revenue (completed payments) for the caller's
   * active organization.
   * @param dto the date range and bucket size
   * @returns total revenue and one entry per non-empty bucket, sorted ascending
   */
  async getRevenue(dto: RevenueQueryDto): Promise<RevenueReport> {
    const { from, to } = this.resolveRange(dto);
    const granularity = dto.granularity ?? ReportGranularity.DAY;

    const payments = await this.tenantContext.client.payment.findMany({
      where: { status: PaymentStatus.COMPLETED, paidAt: { gte: from, lt: to } },
      select: { amount: true, paidAt: true },
    });

    const buckets = new Map<string, Prisma.Decimal>();
    let totalRevenue = new Prisma.Decimal(0);
    for (const payment of payments) {
      totalRevenue = totalRevenue.plus(payment.amount);
      // paidAt is required for a COMPLETED payment in practice (set the
      // moment PaymentsService marks it completed), but is nullable in the
      // schema — skip the impossible case rather than crash on it.
      if (!payment.paidAt) {
        continue;
      }
      const key = bucketKey(payment.paidAt, granularity);
      buckets.set(key, (buckets.get(key) ?? new Prisma.Decimal(0)).plus(payment.amount));
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      totalRevenue,
      buckets: [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([periodStart, revenue]) => ({ periodStart, revenue })),
    };
  }

  /**
   * Job counts by status, for jobs created within the range.
   * @param dto the date range
   * @returns total job count and the breakdown by status
   */
  async getJobsSummary(dto: DateRangeQueryDto): Promise<JobsSummaryReport> {
    const { from, to } = this.resolveRange(dto);

    const jobs = await this.tenantContext.client.job.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lt: to } },
      select: { status: true },
    });

    const byStatus = Object.fromEntries(
      Object.values(JobStatus).map((status) => [status, 0]),
    ) as Record<JobStatus, number>;
    for (const job of jobs) {
      byStatus[job.status] += 1;
    }

    return { from: from.toISOString(), to: to.toISOString(), totalJobs: jobs.length, byStatus };
  }

  /**
   * Per-staff completed-job count and hours worked (from `actualStart`/
   * `actualEnd`) within the range, for jobs completed in that window.
   * @param dto the date range
   * @returns one row per staff member, sorted by jobs completed descending
   */
  async getStaffPerformance(dto: DateRangeQueryDto): Promise<StaffPerformanceReport> {
    const { from, to } = this.resolveRange(dto);

    const [staffProfiles, assignments] = await Promise.all([
      this.tenantContext.client.staffProfile.findMany({
        select: {
          id: true,
          membershipId: true,
          membership: { select: { user: { select: SAFE_USER_SELECT } } },
        },
      }),
      this.tenantContext.client.jobAssignment.findMany({
        where: { job: { status: JobStatus.COMPLETED, actualEnd: { gte: from, lt: to } } },
        select: { membershipId: true, job: { select: { actualStart: true, actualEnd: true } } },
      }),
    ]);

    const statsByMembership = new Map<string, { jobsCompleted: number; hoursWorked: number }>();
    for (const assignment of assignments) {
      const stats = statsByMembership.get(assignment.membershipId) ?? {
        jobsCompleted: 0,
        hoursWorked: 0,
      };
      stats.jobsCompleted += 1;
      if (assignment.job.actualStart && assignment.job.actualEnd) {
        stats.hoursWorked +=
          (assignment.job.actualEnd.getTime() - assignment.job.actualStart.getTime()) / 3_600_000;
      }
      statsByMembership.set(assignment.membershipId, stats);
    }

    const staff = staffProfiles
      .map((profile) => {
        const stats = statsByMembership.get(profile.membershipId) ?? {
          jobsCompleted: 0,
          hoursWorked: 0,
        };
        return {
          staffProfileId: profile.id,
          membershipId: profile.membershipId,
          name: `${profile.membership.user.firstName} ${profile.membership.user.lastName}`,
          jobsCompleted: stats.jobsCompleted,
          hoursWorked: Math.round(stats.hoursWorked * 100) / 100,
        };
      })
      .sort((a, b) => b.jobsCompleted - a.jobsCompleted);

    return { from: from.toISOString(), to: to.toISOString(), staff };
  }

  /**
   * Per-client revenue (completed payments on their invoices) and job
   * count within the range, highest revenue first.
   * @param dto the date range and result limit
   * @returns the top clients by revenue
   */
  async getTopClients(dto: TopClientsQueryDto): Promise<TopClientsReport> {
    const { from, to } = this.resolveRange(dto);
    const limit = dto.limit ?? 10;

    const [payments, jobs] = await Promise.all([
      this.tenantContext.client.payment.findMany({
        where: { status: PaymentStatus.COMPLETED, paidAt: { gte: from, lt: to } },
        select: { amount: true, invoice: { select: { clientId: true } } },
      }),
      this.tenantContext.client.job.findMany({
        where: { deletedAt: null, createdAt: { gte: from, lt: to } },
        select: { clientId: true },
      }),
    ]);

    const revenueByClient = new Map<string, Prisma.Decimal>();
    for (const payment of payments) {
      const clientId = payment.invoice.clientId;
      revenueByClient.set(
        clientId,
        (revenueByClient.get(clientId) ?? new Prisma.Decimal(0)).plus(payment.amount),
      );
    }
    const jobCountByClient = new Map<string, number>();
    for (const job of jobs) {
      jobCountByClient.set(job.clientId, (jobCountByClient.get(job.clientId) ?? 0) + 1);
    }

    const clientIds = [...new Set([...revenueByClient.keys(), ...jobCountByClient.keys()])];
    if (clientIds.length === 0) {
      return { from: from.toISOString(), to: to.toISOString(), clients: [] };
    }

    const clients = await this.tenantContext.client.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });

    const rows = clients
      .map((client) => ({
        clientId: client.id,
        name: client.name,
        revenue: revenueByClient.get(client.id) ?? new Prisma.Decimal(0),
        jobCount: jobCountByClient.get(client.id) ?? 0,
      }))
      .sort((a, b) => b.revenue.comparedTo(a.revenue))
      .slice(0, limit);

    return { from: from.toISOString(), to: to.toISOString(), clients: rows };
  }

  /**
   * Invoices not yet fully paid (excluding `VOID`), as of now — a current
   * snapshot, not a date-ranged report.
   * @returns outstanding and overdue counts/totals
   */
  async getOutstandingInvoices(): Promise<OutstandingInvoicesReport> {
    const now = new Date();
    const invoices = await this.tenantContext.client.invoice.findMany({
      where: { status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] } },
      select: {
        total: true,
        dueDate: true,
        payments: { where: { status: PaymentStatus.COMPLETED }, select: { amount: true } },
      },
    });

    let outstandingCount = 0;
    let outstandingTotal = new Prisma.Decimal(0);
    let overdueCount = 0;
    let overdueTotal = new Prisma.Decimal(0);

    for (const invoice of invoices) {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
      const balance = invoice.total.minus(paid);
      if (balance.lessThanOrEqualTo(0)) {
        continue;
      }
      outstandingCount += 1;
      outstandingTotal = outstandingTotal.plus(balance);
      if (invoice.dueDate < now) {
        overdueCount += 1;
        overdueTotal = overdueTotal.plus(balance);
      }
    }

    return {
      asOf: now.toISOString(),
      outstandingCount,
      outstandingTotal,
      overdueCount,
      overdueTotal,
    };
  }

  /**
   * Resolves a query's optional `from`/`to` into concrete dates.
   * @param dto the raw date-range query params
   * @returns `to` (now, if unset) and `from` (30 days before `to`, if unset)
   */
  private resolveRange(dto: DateRangeQueryDto): { from: Date; to: Date } {
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }
}

/**
 * The bucket key a timestamp falls into for a given granularity — `YYYY-MM-DD`
 * for a day, the Monday (UTC) starting its week, or `YYYY-MM` for a month.
 * @param date the timestamp to bucket
 * @param granularity the bucket size
 * @returns the bucket's key, also usable as its ISO-prefixed start date
 */
function bucketKey(date: Date, granularity: ReportGranularity): string {
  switch (granularity) {
    case ReportGranularity.WEEK:
      return startOfWeekUtc(date).toISOString().slice(0, 10);
    case ReportGranularity.MONTH:
      return date.toISOString().slice(0, 7);
    case ReportGranularity.DAY:
    default:
      return date.toISOString().slice(0, 10);
  }
}

/**
 * The Monday (UTC, midnight) of the week containing `date`.
 * @param date any timestamp within the target week
 * @returns that week's Monday at UTC midnight
 */
function startOfWeekUtc(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + diffToMonday);
  return day;
}
