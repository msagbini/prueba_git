import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma, PaymentStatus, RoleCode, type Payment } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AuditLogWriterService } from '../audit-logs/audit-log-writer.service';
import type { CreatePaymentDto } from './dto/create-payment.dto';

/** Identifies the caller for row-level payment visibility — a Client only ever sees payments on their own invoices. */
export interface PaymentCaller {
  membershipId: string;
  role: string;
}

/**
 * Payment records against invoices. Record-keeping only — no
 * payment-gateway integration (Stripe is Fase 4), so a created payment is
 * treated as already received (`status: COMPLETED`, `paidAt: now()`)
 * rather than `PENDING`, and immediately applied to the invoice: once an
 * invoice's completed payments cover its total, the invoice is marked
 * `PAID`.
 */
@Injectable()
export class PaymentsService {
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
   * @returns payments visible to the caller
   */
  async list(caller: PaymentCaller): Promise<Payment[]> {
    return this.tenantContext.client.payment.findMany({
      where: await this.visibilityFilter(caller),
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a record.
   * @param organizationId the caller's active organization
   * @param actorUserId the caller, for the audit trail
   * @param dto the payment to record
   * @returns the created record
   */
  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    const invoice = await this.tenantContext.client.invoice.findFirst({
      where: { id: dto.invoiceId },
    });
    if (!invoice) {
      throw new BadRequestException(
        'invoiceId does not belong to the caller’s active organization.',
      );
    }

    const payment = await this.tenantContext.client.payment.create({
      data: {
        organizationId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
      },
    });

    await this.markInvoicePaidIfSettled(dto.invoiceId, invoice.total);

    await this.auditLog.record({
      organizationId,
      actorUserId,
      action: 'payment.created',
      entityType: 'Payment',
      entityId: payment.id,
      after: payment,
    });

    return payment;
  }

  /**
   * Fetches a single record.
   * @param caller the authenticated caller, for row-level visibility
   * @param id the payment to fetch
   * @returns the matching record
   */
  async findOne(caller: PaymentCaller, id: string): Promise<Payment> {
    const payment = await this.tenantContext.client.payment.findFirst({
      where: { id, ...(await this.visibilityFilter(caller)) },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }
    return payment;
  }

  /**
   * Marks an invoice `PAID` once its completed payments cover its total.
   * @param invoiceId the invoice to check
   * @param total the invoice's total amount due
   */
  private async markInvoicePaidIfSettled(invoiceId: string, total: Prisma.Decimal): Promise<void> {
    const completedPayments = await this.tenantContext.client.payment.findMany({
      where: { invoiceId, status: PaymentStatus.COMPLETED },
    });
    const totalPaid = completedPayments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );

    if (totalPaid.greaterThanOrEqualTo(total)) {
      await this.tenantContext.client.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.PAID },
      });
    }
  }

  /**
   * Builds the extra `where` clause restricting a Client caller to
   * payments on their own invoices — Owner/Admin/Dispatcher get an empty
   * filter (no restriction); Staff never holds `payments.read` so never
   * reaches this.
   * @param caller the authenticated caller
   * @returns a Prisma `where` fragment to merge into a payment query
   */
  private async visibilityFilter(caller: PaymentCaller): Promise<Record<string, unknown>> {
    if (caller.role !== RoleCode.CLIENT) {
      return {};
    }
    const membership = await this.tenantContext.client.organizationMembership.findFirst({
      where: { id: caller.membershipId },
    });
    return {
      invoice: { clientId: membership?.clientId ?? '00000000-0000-0000-0000-000000000000' },
    };
  }
}
