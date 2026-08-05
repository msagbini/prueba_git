import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeWebhookController } from './stripe-webhook.controller';

/**
 * DOS's own billing module — subscription status, plan-limit enforcement,
 * Stripe Checkout, and the Stripe webhook handler. `BillingService` is
 * exported so `modules/clients`, `modules/jobs`, `modules/auth` and
 * `modules/memberships` can enforce plan limits at their own creation
 * points.
 */
@Module({
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
