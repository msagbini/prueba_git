import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobStatus, PlanCode, type Plan, type Subscription } from '@prisma/client';
import Stripe from 'stripe';
import type { EnvConfig } from '../../config/env.validation';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { TenantPrismaClient } from '../../prisma/run-in-tenant-transaction';
import type { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { PlanLimitExceededException } from './plan-limit-exceeded.exception';

/** A subscription joined with the plan it's on — what the UI needs to render billing status. */
export type SubscriptionWithPlan = Subscription & { plan: Plan };

/** Where to send the caller's browser to complete a plan purchase. */
export interface CheckoutSession {
  checkoutUrl: string;
}

/** The Stripe API version this integration was built and tested against. */
const STRIPE_API_VERSION = '2026-07-29.dahlia' as const;

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
  private stripeClient: Stripe | undefined;

  /**
   * Constructs the service around the tenant-scoped Prisma client and app config.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param config validated environment configuration, for the optional Stripe settings
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

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

  /**
   * Starts a Stripe Checkout session upgrading the caller's active
   * organization to a paid plan.
   * @param dto the target plan
   * @returns the URL to redirect the caller's browser to
   */
  createMineCheckoutSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSession> {
    return this.createCheckoutSession(this.tenantContext.client, dto);
  }

  /**
   * Starts a Stripe Checkout session upgrading an organization to a paid
   * plan, creating (and persisting) a Stripe Customer for it first if it
   * doesn't have one yet.
   * @param client a Prisma client scoped to the target organization
   * @param dto the target plan
   * @returns the URL to redirect the caller's browser to
   * @throws BadRequestException if `planCode` is `FREE` (nothing to check out)
   * @throws ServiceUnavailableException if Stripe isn't configured, or the
   *   target plan has no `stripePriceId` yet
   */
  async createCheckoutSession(
    client: TenantPrismaClient,
    dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSession> {
    if (dto.planCode === PlanCode.FREE) {
      throw new BadRequestException(
        'The Free plan has no checkout — it is the default for every organization.',
      );
    }

    const stripe = this.getStripeClient();
    const subscription = await this.getSubscription(client);
    const plan = await client.plan.findUnique({ where: { code: dto.planCode } });
    if (!plan) {
      throw new BadRequestException(`Unknown plan: ${dto.planCode}`);
    }
    if (!plan.stripePriceId) {
      throw new ServiceUnavailableException(
        `The ${plan.name} plan is not yet available for purchase.`,
      );
    }

    const stripeCustomerId =
      subscription.stripeCustomerId ??
      (await this.createStripeCustomer(client, stripe, subscription));

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: this.config.get('STRIPE_CHECKOUT_SUCCESS_URL', { infer: true }),
      cancel_url: this.config.get('STRIPE_CHECKOUT_CANCEL_URL', { infer: true }),
      client_reference_id: subscription.organizationId,
      metadata: { organizationId: subscription.organizationId, planCode: plan.code },
    });

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe did not return a checkout URL.');
    }
    return { checkoutUrl: session.url };
  }

  /**
   * Creates a Stripe Customer for an organization that doesn't have one
   * yet, and persists its id onto the organization's `Subscription` row so
   * future checkouts and webhook events reuse it.
   * @param client a Prisma client scoped to the target organization
   * @param stripe the Stripe client to create the customer with
   * @param subscription the organization's subscription row to update
   * @returns the new Stripe Customer's id
   */
  private async createStripeCustomer(
    client: TenantPrismaClient,
    stripe: Stripe,
    subscription: SubscriptionWithPlan,
  ): Promise<string> {
    const customer = await stripe.customers.create({
      metadata: { organizationId: subscription.organizationId },
    });
    await client.subscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  /**
   * Lazily constructs (and caches) the Stripe client from `STRIPE_SECRET_KEY`.
   * @returns a configured Stripe client
   * @throws ServiceUnavailableException if `STRIPE_SECRET_KEY` isn't set —
   *   this project has not yet been given real Stripe credentials, see
   *   docs/technical-log/phase-4.md
   */
  private getStripeClient(): Stripe {
    if (this.stripeClient) {
      return this.stripeClient;
    }
    const secretKey = this.config.get('STRIPE_SECRET_KEY', { infer: true });
    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Billing is not configured on this deployment (missing STRIPE_SECRET_KEY).',
      );
    }
    this.stripeClient = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
    return this.stripeClient;
  }
}
