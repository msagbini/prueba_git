import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';

/**
 * Receives Stripe webhook events. Excluded from Swagger (it's not part of
 * DOS's own API contract — Stripe is the only caller) and `@Public()`
 * (there's no DOS-issued JWT to check; Stripe's request signature is the
 * authentication, verified inside {@link BillingService.handleWebhookEvent}).
 */
@ApiExcludeController()
@Public()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  /**
   * Constructs the controller around the service implementing signature
   * verification and event processing.
   * @param billingService verifies and processes the incoming event
   */
  constructor(private readonly billingService: BillingService) {}

  /**
   * Verifies and processes an incoming Stripe webhook event.
   * @param request the raw request — `rawBody` is populated by `main.ts`'s
   *   `NestFactory.create(AppModule, { rawBody: true })`, needed because
   *   Stripe signs the exact bytes it sent, not a re-serialized copy
   * @param signature the `Stripe-Signature` request header
   * @returns nothing (200 acknowledges receipt to Stripe)
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    if (!request.rawBody) {
      throw new BadRequestException('Missing request body.');
    }
    await this.billingService.handleWebhookEvent(request.rawBody, signature);
  }
}
