import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { CreatePaymentDto } from './dto/create-payment.dto';

/**
 * Payment records against invoices. Record-keeping only — no
 * payment-gateway integration in Fase 2 (Stripe is Fase 4, per the
 * roadmap in root README.md). Fase 2 scope note: see
 * `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class PaymentsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Lists records. Stubbed for Fase 3 — see the class-level scope note.
   */
  list(): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Creates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _dto the payment to record
   */
  create(_dto: CreatePaymentDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Fetches a single record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the payment to fetch
   */
  findOne(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
