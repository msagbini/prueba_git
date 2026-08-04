import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

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

  /**
   * Starts a Stripe Checkout session upgrading the caller's active
   * organization to a paid plan.
   * @param dto the target plan
   * @returns the URL to redirect the caller's browser to
   */
  @UseGuards(RolesGuard)
  @Roles(RoleCode.OWNER, RoleCode.ADMIN)
  @Post('checkout')
  createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.billingService.createMineCheckoutSession(dto);
  }
}
