import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/**
 * DOS's own billing module — subscription status and plan-limit
 * enforcement now, Stripe checkout/webhooks to follow. `BillingService`
 * is exported so `modules/clients`, `modules/jobs`, `modules/auth` and
 * `modules/memberships` can enforce plan limits at their own creation
 * points.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
