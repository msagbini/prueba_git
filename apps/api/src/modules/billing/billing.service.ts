import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JobStatus,
  PlanCode,
  SubscriptionStatus,
  type Plan,
  type Subscription,
} from '@prisma/client';
import Stripe from 'stripe';
import type { EnvConfig } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import {
  runInTenantTransaction,
  type TenantPrismaClient,
} from '../../prisma/run-in-tenant-transaction';
import { TenantContextService } from '../../prisma/tenant-context.service';
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
  private readonly logger = new Logger(BillingService.name);
  private stripeClient: Stripe | undefined;

  /**
   * Constructs the service around the tenant-scoped Prisma client and app config.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param config validated environment configuration, for the optional Stripe settings
   * @param prisma the unscoped Prisma client — the Stripe webhook handler
   *   has no authenticated org context to intercept, so (like `signup`/
   *   `acceptInvitation` in `modules/auth`, see ADR 0006) it resolves the
   *   target organization from Stripe event metadata and opens its own
   *   {@link runInTenantTransaction} rather than reading `tenantContext`
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
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
      // Copied onto the resulting Stripe Subscription object too, so
      // customer.subscription.updated/deleted webhook events — which carry
      // a Subscription, not the Checkout Session — can still be routed
      // back to the right organization without an extra Stripe API call.
      subscription_data: {
        metadata: { organizationId: subscription.organizationId, planCode: plan.code },
      },
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

  /**
   * Verifies and processes an incoming Stripe webhook event, syncing the
   * relevant organization's `Subscription` row to Stripe's state.
   * Unrecognized event types are acknowledged and ignored — Stripe's
   * recommended handling for events a given integration doesn't care about.
   * @param rawBody the exact request body bytes Stripe signed — must not
   *   be a re-serialized/re-parsed copy, or signature verification fails
   * @param signature the `Stripe-Signature` request header
   * @throws ServiceUnavailableException if `STRIPE_WEBHOOK_SECRET` isn't configured
   * @throws BadRequestException if the signature doesn't verify
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Billing webhooks are not configured on this deployment (missing STRIPE_WEBHOOK_SECRET).',
      );
    }

    // Signature verification is pure local cryptography keyed by the
    // webhook secret, not `STRIPE_SECRET_KEY` — so this uses its own
    // client instead of `getStripeClient()`, which requires
    // STRIPE_SECRET_KEY and is reserved for real outbound Stripe calls
    // (Customer/Checkout Session creation). Keeping the two independent
    // means an environment can receive and verify webhooks correctly even
    // before outbound billing calls are configured.
    const stripe = new Stripe('sk_unused_webhook_signature_verification_only', {
      apiVersion: STRIPE_API_VERSION,
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'invalid signature';
      throw new BadRequestException(`Stripe webhook signature verification failed: ${message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(
          event.data.object as unknown as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as unknown as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionUpdated(
          event.data.object as unknown as Stripe.Subscription,
          SubscriptionStatus.CANCELED,
        );
        break;
      default:
        this.logger.debug(`Ignoring unhandled Stripe webhook event type: ${event.type}`);
    }
  }

  /**
   * Links a newly-completed Checkout Session to the organization it was
   * for: sets the subscription's plan, Stripe subscription id, and status.
   * @param session the completed Checkout Session
   */
  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId =
      session.metadata?.organizationId ?? session.client_reference_id ?? undefined;
    const planCode = session.metadata?.planCode as PlanCode | undefined;
    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    if (!organizationId || !planCode || !stripeSubscriptionId) {
      this.logger.warn(
        `checkout.session.completed (session ${session.id}) is missing organizationId/planCode/subscription id — ignoring`,
      );
      return;
    }

    await runInTenantTransaction(this.prisma, organizationId, async (tx) => {
      const plan = await tx.plan.findUnique({ where: { code: planCode } });
      if (!plan) {
        this.logger.warn(
          `checkout.session.completed (session ${session.id}) referenced unknown plan code ${planCode} — ignoring`,
        );
        return;
      }
      await tx.subscription.updateMany({
        where: { organizationId },
        data: { planId: plan.id, stripeSubscriptionId, status: SubscriptionStatus.ACTIVE },
      });
    });
  }

  /**
   * Syncs an organization's `Subscription` row to a Stripe Subscription's
   * current status and billing period.
   * @param subscription the Stripe Subscription from the webhook event
   * @param forcedStatus overrides the status derived from `subscription.status` —
   *   used for `customer.subscription.deleted`, whose `status` is not
   *   reliably `canceled` in every case Stripe fires that event for
   */
  private async onSubscriptionUpdated(
    subscription: Stripe.Subscription,
    forcedStatus?: SubscriptionStatus,
  ): Promise<void> {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) {
      this.logger.warn(
        `Stripe subscription event for subscription ${subscription.id} is missing organizationId metadata — ignoring`,
      );
      return;
    }

    const status = forcedStatus ?? this.mapStripeSubscriptionStatus(subscription.status);
    const periodEndSeconds = subscription.items.data[0]?.current_period_end;
    const currentPeriodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000) : null;

    await runInTenantTransaction(this.prisma, organizationId, (tx) =>
      tx.subscription.updateMany({
        where: { organizationId },
        data: { status, stripeSubscriptionId: subscription.id, currentPeriodEnd },
      }),
    );
  }

  /**
   * Maps a Stripe subscription status to DOS's own {@link SubscriptionStatus}.
   * @param status the Stripe Subscription's `status` field
   * @returns the closest DOS equivalent
   */
  private mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'canceled':
      case 'incomplete_expired':
      case 'paused':
        return SubscriptionStatus.CANCELED;
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
      default:
        return SubscriptionStatus.PAST_DUE;
    }
  }
}
