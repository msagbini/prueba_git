import { Injectable, NotFoundException } from '@nestjs/common';
import { AddressLabel, Prisma, RoleCode, type Invoice, type InvoiceLineItem } from '@prisma/client';
import type { InvoicePdfData } from './invoice-pdf.service';
import { toDateOrUndefined } from '../../common/to-date';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginate, type PaginatedResult } from '../../common/pagination';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import type { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';

/** Identifies the caller for row-level invoice visibility — a Client only ever sees their own. */
export interface InvoiceCaller {
  membershipId: string;
  role: string;
}

const MAX_INVOICE_NUMBER_ATTEMPTS = 5;

/**
 * Invoices and their line items. `subtotal`/`total` are derived from line
 * items (recomputed on every `createLineItem` call) rather than settable
 * directly — `taxAmount` has no rate/rule to compute it from anywhere in
 * this schema, so it stays `0` for every invoice in this phase; a real
 * tax calculation is out of scope until the product defines where a tax
 * rate would even come from (per-organization? per-jurisdiction?).
 */
@Injectable()
export class InvoicesService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   * @param auditLog records changes made through this service
   */
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditLog: AuditLogWriterService,
  ) {}

  /**
   * Lists records.
   * @param caller the authenticated caller, for row-level visibility
   * @param pagination the requested page/pageSize
   * @returns a page of invoices visible to the caller
   */
  async list(
    caller: InvoiceCaller,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Invoice>> {
    const where = await this.visibilityFilter(caller);
    const { page, pageSize } = pagination;
    const [items, total] = await Promise.all([
      this.tenantContext.client.invoice.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.tenantContext.client.invoice.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  /**
   * Creates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param dto the invoice to create
   * @returns the created record
   */
  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateInvoiceDto,
  ): Promise<Invoice> {
    const invoice = await this.createWithGeneratedNumber(organizationId, dto);

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'invoice.created',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: invoice,
    });

    return invoice;
  }

  /**
   * Fetches a single record, with its line items — there was previously
   * no way to read an invoice's line items at all (only `POST .../line-
   * items` existed), a real gap surfaced building the web invoices page
   * (Fase 9).
   * @param caller the authenticated caller, for row-level visibility
   * @param id the invoice to fetch
   * @returns the matching record, with its line items
   */
  async findOne(
    caller: InvoiceCaller,
    id: string,
  ): Promise<Invoice & { lineItems: InvoiceLineItem[] }> {
    const invoice = await this.findOrThrow(caller, id);
    const lineItems = await this.tenantContext.client.invoiceLineItem.findMany({
      where: { invoiceId: id },
    });
    return { ...invoice, lineItems };
  }

  /**
   * Fetches everything `InvoicePdfService` needs to render an invoice —
   * the invoice, its line items, its client, the client's billing
   * address (if any), and the organization — in one place, so the
   * controller doesn't have to know which tables back a PDF.
   * @param caller the authenticated caller, for row-level visibility
   * @param id the invoice to fetch
   * @returns the data `InvoicePdfService.generate()` renders
   */
  async getPdfData(caller: InvoiceCaller, id: string): Promise<InvoicePdfData> {
    const invoice = await this.findOrThrow(caller, id);
    const [lineItems, client, organization, billingAddress] = await Promise.all([
      this.tenantContext.client.invoiceLineItem.findMany({ where: { invoiceId: id } }),
      this.tenantContext.client.client.findFirstOrThrow({ where: { id: invoice.clientId } }),
      this.tenantContext.client.organization.findFirstOrThrow({
        where: { id: invoice.organizationId },
      }),
      this.tenantContext.client.clientAddress.findFirst({
        where: { clientId: invoice.clientId, label: AddressLabel.BILLING },
      }),
    ]);
    return { invoice, lineItems, client, organization, billingAddress };
  }

  /**
   * Updates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param id the invoice to update
   * @param dto the fields to change
   * @returns the updated record
   */
  async update(
    organizationId: string,
    actorUserId: string,
    caller: InvoiceCaller,
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<Invoice> {
    const before = await this.findOrThrow(caller, id);

    const after = await this.tenantContext.client.invoice.update({
      where: { id },
      data: { status: dto.status, dueDate: toDateOrUndefined(dto.dueDate) },
    });

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'invoice.updated',
      entityType: 'Invoice',
      entityId: id,
      before,
      after,
    });

    return after;
  }

  /**
   * Adds a line item to an invoice, then recomputes the invoice's
   * subtotal/total from every line item (see the class-level scope note).
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param caller the authenticated caller, for row-level visibility
   * @param invoiceId the invoice to add a line item to
   * @param dto the line item to create
   * @returns the created line item
   */
  async createLineItem(
    organizationId: string,
    actorUserId: string,
    caller: InvoiceCaller,
    invoiceId: string,
    dto: CreateInvoiceLineItemDto,
  ): Promise<InvoiceLineItem> {
    await this.findOrThrow(caller, invoiceId);

    const lineTotal = dto.quantity * dto.unitPrice;
    const lineItem = await this.tenantContext.client.invoiceLineItem.create({
      data: {
        organizationId,
        invoiceId,
        jobId: dto.jobId,
        serviceId: dto.serviceId,
        description: dto.description,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        lineTotal,
      },
    });

    await this.recomputeTotals(invoiceId);

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'invoice_line_item.created',
      entityType: 'InvoiceLineItem',
      entityId: lineItem.id,
      after: lineItem,
    });

    return lineItem;
  }

  /**
   * Recomputes `subtotal`/`total` from an invoice's current line items.
   * @param invoiceId the invoice to recompute
   */
  private async recomputeTotals(invoiceId: string): Promise<void> {
    const lineItems = await this.tenantContext.client.invoiceLineItem.findMany({
      where: { invoiceId },
    });
    const subtotal = lineItems.reduce(
      (sum, item) => sum.plus(item.lineTotal),
      new Prisma.Decimal(0),
    );

    const invoice = await this.tenantContext.client.invoice.findFirst({ where: { id: invoiceId } });
    const taxAmount = invoice?.taxAmount ?? new Prisma.Decimal(0);

    await this.tenantContext.client.invoice.update({
      where: { id: invoiceId },
      data: { subtotal, total: subtotal.plus(taxAmount) },
    });
  }

  /**
   * Creates an invoice with a generated, organization-unique invoice
   * number, retrying on the rare chance two concurrent creates in the
   * same organization compute the same number.
   * @param organizationId the caller's active organization
   * @param dto the invoice to create
   * @returns the created record
   */
  private async createWithGeneratedNumber(
    organizationId: string,
    dto: CreateInvoiceDto,
  ): Promise<Invoice> {
    // Every invoice bills in its organization's configured currency
    // (Organization.defaultCurrency, settable via PATCH /organizations/me)
    // rather than the column's own schema-level "USD" default, which would
    // otherwise apply regardless of what the organization is set to.
    const organization = await this.tenantContext.client.organization.findFirstOrThrow({
      where: { id: organizationId },
      select: { defaultCurrency: true },
    });
    for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_ATTEMPTS; attempt++) {
      const existingCount = await this.tenantContext.client.invoice.count();
      const invoiceNumber = `INV-${String(existingCount + 1 + attempt).padStart(4, '0')}`;
      try {
        return await this.tenantContext.client.invoice.create({
          data: {
            organizationId,
            clientId: dto.clientId,
            invoiceNumber,
            issueDate: new Date(dto.issueDate),
            dueDate: new Date(dto.dueDate),
            currency: organization.defaultCurrency,
            subtotal: 0,
            taxAmount: 0,
            total: 0,
          },
        });
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isUniqueConflict || attempt === MAX_INVOICE_NUMBER_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    /* istanbul ignore next -- unreachable: the loop above always returns or throws */
    throw new Error('Unreachable.');
  }

  /**
   * Fetches a caller-visible invoice or throws if it can't be found.
   * @param caller the authenticated caller, for row-level visibility
   * @param id the invoice to fetch
   * @returns the matching record
   * @throws NotFoundException if no such invoice is visible to the caller
   */
  private async findOrThrow(caller: InvoiceCaller, id: string): Promise<Invoice> {
    const invoice = await this.tenantContext.client.invoice.findFirst({
      where: { id, ...(await this.visibilityFilter(caller)) },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }
    return invoice;
  }

  /**
   * Builds the extra `where` clause restricting a Client caller to their
   * own invoices — see the class-level scope note. Owner/Admin/Dispatcher
   * get an empty filter (no restriction); Staff never holds
   * `invoices.read` so never reaches this.
   * @param caller the authenticated caller
   * @returns a Prisma `where` fragment to merge into an invoice query
   */
  private async visibilityFilter(caller: InvoiceCaller): Promise<Record<string, unknown>> {
    if (caller.role !== RoleCode.CLIENT) {
      return {};
    }
    const membership = await this.tenantContext.client.organizationMembership.findFirst({
      where: { id: caller.membershipId },
    });
    return { clientId: membership?.clientId ?? '00000000-0000-0000-0000-000000000000' };
  }
}
