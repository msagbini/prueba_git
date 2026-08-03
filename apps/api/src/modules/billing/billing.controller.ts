import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';

/** DOS's own billing for the caller's active organization. */
@ApiTags('billing')
@ApiBearerAuth()
@Controller('organizations/me/subscription')
export class BillingController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param billingService implements this controller's routes
   */
  constructor(private readonly billingService: BillingService) {}

  /**
   * Fetches the caller's active organization's subscription.
   * @returns the subscription, with its plan
   */
  @Get()
  getSubscription() {
    return this.billingService.getMineSubscription();
  }
}
