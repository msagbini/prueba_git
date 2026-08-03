import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/** DOS's own billing module — subscription status now, Stripe checkout to follow. */
@Module({
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
