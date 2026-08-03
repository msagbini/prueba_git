import { Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, type Plan, type Subscription } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { TenantPrismaClient } from '../../prisma/run-in-tenant-transaction';
import { PlanLimitExceededException } from './plan-limit-exceeded.exception';

/** A subscription joined with the plan it's on — what the UI needs to render billing status. */
export type SubscriptionWithPlan = Subscription & { plan: Plan };

/**
 * DOS's own billing relationship with an organization — distinct from
 * `modules/invoices`/`modules/payments`, which are the cleaning
 * business's billing to its own customers. See
 * docs/technical-log/phase-4.md.
 *
 * Also enforces the active plan's usage limits (`assert*Limit` methods).
 * Every method takes the tenant-scoped Prisma client explicitly, rather
 * than reading it off `TenantContextService` internally, because not
 * every caller has one from the normal per-request interceptor: `signup`
 * and `acceptInvitation` in `modules/auth` open their own bootstrap
 * transaction (there's no authenticated org context yet to intercept),
 * and this service needs to work from inside that transaction too — see
 * ADR 0006. The `Mine` methods are the convenience wrapper for ordinary,
 * already-authenticated routes.
 */
@Injectable()
export class BillingService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Fetches the caller's active organization's subscription and plan.
   * @returns the subscription, with its plan
   */
  getMineSubscription(): Promise<SubscriptionWithPlan> {
    return this.getSubscription(this.tenantContext.client);
  }

  /**
   * Rejects the call if the caller's active organization is already at
   * its plan's client limit.
   * @returns nothing (resolves if under the limit)
   * @throws PlanLimitExceededException if `Plan.maxClients` would be exceeded
   */
  assertMineClientLimit(): Promise<void> {
    return this.assertClientLimit(this.tenantContext.client);
  }

  /**
   * Rejects the call if the caller's active organization is already at
   * its plan's active-job limit.
   * @returns nothing (resolves if under the limit)
   * @throws PlanLimitExceededException if `Plan.maxActiveJobs` would be exceeded
   */
  assertMineActiveJobLimit(): Promise<void> {
    return this.assertActiveJobLimit(this.tenantContext.client);
  }

  /**
   * Fetches an organization's subscription and plan.
   * @param client a Prisma client scoped to the target organization
   * @returns the subscription, with its plan
   * @throws NotFoundException if the organization has no subscription —
   *   should not happen for an organization created through signup, which
   *   always creates one, but guards against data inconsistencies
   *   surfacing as a confusing 500 instead of a clear 404
   */
  async getSubscription(client: TenantPrismaClient): Promise<SubscriptionWithPlan> {
    const subscription = await client.subscription.findFirst({ include: { plan: true } });
    if (!subscription) {
      throw new NotFoundException('This organization has no subscription.');
    }
    return subscription;
  }

  /**
   * Rejects the call if the organization is already at its plan's client limit.
   * @param client a Prisma client scoped to the target organization
   * @throws PlanLimitExceededException if `Plan.maxClients` (non-deleted clients) would be exceeded
   */
  async assertClientLimit(client: TenantPrismaClient): Promise<void> {
    const { plan } = await this.getSubscription(client);
    if (plan.maxClients === null) {
      return;
    }
    const count = await client.client.count({ where: { deletedAt: null } });
    if (count >= plan.maxClients) {
      throw new PlanLimitExceededException(
        `Client limit reached for the ${plan.name} plan (${plan.maxClients}). Upgrade to add more.`,
      );
    }
  }

  /**
   * Rejects the call if the organization is already at its plan's
   * active-job limit. "Active" excludes `COMPLETED`/`CANCELLED` jobs —
   * finished work doesn't hold capacity.
   * @param client a Prisma client scoped to the target organization
   * @throws PlanLimitExceededException if `Plan.maxActiveJobs` would be exceeded
   */
  async assertActiveJobLimit(client: TenantPrismaClient): Promise<void> {
    const { plan } = await this.getSubscription(client);
    if (plan.maxActiveJobs === null) {
      return;
    }
    const count = await client.job.count({
      where: {
        deletedAt: null,
        status: { notIn: [JobStatus.COMPLETED, JobStatus.CANCELLED] },
      },
    });
    if (count >= plan.maxActiveJobs) {
      throw new PlanLimitExceededException(
        `Active job limit reached for the ${plan.name} plan (${plan.maxActiveJobs}). Upgrade to add more.`,
      );
    }
  }

  /**
   * Rejects the call if the organization is already at its plan's staff
   * limit. Counts `StaffProfile` rows, not all memberships —
   * Owners/Admins/Dispatchers don't consume a staff seat.
   * @param client a Prisma client scoped to the target organization
   * @throws PlanLimitExceededException if `Plan.maxStaff` would be exceeded
   */
  async assertStaffLimit(client: TenantPrismaClient): Promise<void> {
    const { plan } = await this.getSubscription(client);
    if (plan.maxStaff === null) {
      return;
    }
    const count = await client.staffProfile.count();
    if (count >= plan.maxStaff) {
      throw new PlanLimitExceededException(
        `Staff limit reached for the ${plan.name} plan (${plan.maxStaff}). Upgrade to add more.`,
      );
    }
  }
}
