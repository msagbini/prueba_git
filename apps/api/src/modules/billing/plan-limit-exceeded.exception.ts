import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when an action would exceed the caller's active organization's
 * plan limit (e.g. creating a client past `Plan.maxClients`) — `402
 * Payment Required` is the semantically correct status for "this needs a
 * plan upgrade," distinct from `403 Forbidden` (which means "no
 * permission," not "pay to unlock").
 */
export class PlanLimitExceededException extends HttpException {
  /**
   * Constructs the exception.
   * @param message explains which limit was hit and what plan to upgrade to
   */
  constructor(message: string) {
    super(message, HttpStatus.PAYMENT_REQUIRED);
  }
}
