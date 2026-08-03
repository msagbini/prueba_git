import { Injectable, NotFoundException } from '@nestjs/common';
import type { Plan, Subscription } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';

/** A subscription joined with the plan it's on — what the UI needs to render billing status. */
export type SubscriptionWithPlan = Subscription & { plan: Plan };

/**
 * DOS's own billing relationship with the caller's active organization —
 * distinct from `modules/invoices`/`modules/payments`, which are the
 * cleaning business's billing to its own customers. See
 * docs/technical-log/phase-4.md.
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
   * @throws NotFoundException if the organization has no subscription —
   *   should not happen for an organization created through signup, which
   *   always creates one, but guards against data inconsistencies
   *   surfacing as a confusing 500 instead of a clear 404
   */
  async getSubscription(): Promise<SubscriptionWithPlan> {
    const subscription = await this.tenantContext.client.subscription.findFirst({
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException('This organization has no subscription.');
    }
    return subscription;
  }
}
