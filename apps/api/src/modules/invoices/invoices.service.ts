import { Injectable, NotImplementedException } from '@nestjs/common';
import { TenantContextService } from '../../prisma/tenant-context.service';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import type { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';

/**
 * Invoices and their line items. `subtotal`/`taxAmount`/`total` are
 * derived from line items, not set directly by callers — computing them
 * is Fase 3 business logic, not part of this contract. Fase 2 scope
 * note: see `organizations.service.ts` for the pattern this follows.
 */
@Injectable()
export class InvoicesService {
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
   * @param _dto the invoice to create
   */
  create(_dto: CreateInvoiceDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Fetches a single record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the invoice to fetch
   */
  findOne(_id: string): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Updates a record. Stubbed for Fase 3 — see the class-level scope note.
   * @param _id the invoice to update
   * @param _dto the fields to change
   */
  update(_id: string, _dto: UpdateInvoiceDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }

  /**
   * Creates a line item. Stubbed for Fase 3 — see the class-level scope note.
   * @param _invoiceId the invoice to add a line item to
   * @param _dto the line item to create
   */
  createLineItem(_invoiceId: string, _dto: CreateInvoiceLineItemDto): never {
    throw new NotImplementedException('Implemented in Fase 3.');
  }
}
