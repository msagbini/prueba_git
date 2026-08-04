import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Client, ClientAddress, Invoice, InvoiceLineItem, Organization } from '@prisma/client';

/** Everything the PDF layout needs, gathered from tables that already exist — no new fields. */
export interface InvoicePdfData {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  client: Client;
  organization: Organization;
  billingAddress: ClientAddress | null;
}

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

/**
 * Formats a decimal amount as currency, caching the `Intl.NumberFormat`
 * instance per currency code rather than constructing one per call.
 * @param amount the amount to format
 * @param currency the ISO 4217 currency code (e.g. "USD")
 * @returns the formatted amount, e.g. "$1,234.56"
 */
function formatCurrency(amount: unknown, currency: string): string {
  let formatter = CURRENCY_FORMATTERS.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    CURRENCY_FORMATTERS.set(currency, formatter);
  }
  return formatter.format(Number(amount));
}

/**
 * Renders an invoice as a PDF document, server-side, from data that's
 * already fully computed by `InvoicesService` (subtotal/total are
 * recomputed from line items on every mutation — this only lays them
 * out, it never recalculates anything).
 */
@Injectable()
export class InvoicePdfService {
  /**
   * Builds a one-page invoice PDF as a readable stream.
   * @param data the invoice and everything needed to render it
   * @returns a `PDFDocument`, itself a Node.js readable stream of the PDF bytes
   */
  generate(data: InvoicePdfData): PDFKit.PDFDocument {
    const { invoice, lineItems, client, organization, billingAddress } = data;
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

    doc
      .fontSize(20)
      .text(organization.name, { continued: false })
      .fontSize(10)
      .fillColor('#666666')
      .text('Invoice')
      .fillColor('#000000')
      .moveDown(1.5);

    const headerTop = doc.y;
    doc
      .fontSize(10)
      .text(`Invoice #: ${invoice.invoiceNumber}`, 50, headerTop)
      .text(`Issue date: ${invoice.issueDate.toISOString().slice(0, 10)}`)
      .text(`Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`)
      .text(`Status: ${invoice.status}`);

    const billToLines = [
      client.name,
      client.primaryContactName ?? undefined,
      client.email ?? undefined,
      client.phone ?? undefined,
      billingAddress?.addressLine1,
      billingAddress?.addressLine2 ?? undefined,
      billingAddress &&
        `${billingAddress.city}, ${billingAddress.state} ${billingAddress.postalCode}`,
      billingAddress?.country,
    ].filter((line): line is string => Boolean(line));

    doc
      .fontSize(10)
      .text('Bill to:', 320, headerTop, { width: 200 })
      .text(billToLines.join('\n'), 320, doc.y, { width: 200 });

    doc.moveDown(3);

    const tableTop = doc.y;
    const columns = { description: 50, quantity: 320, unitPrice: 390, lineTotal: 470 };
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text('Description', columns.description, tableTop)
      .text('Qty', columns.quantity, tableTop, { width: 60, align: 'right' })
      .text('Unit price', columns.unitPrice, tableTop, { width: 70, align: 'right' })
      .text('Line total', columns.lineTotal, tableTop, { width: 80, align: 'right' })
      .fillColor('#000000')
      .moveTo(50, tableTop + 15)
      .lineTo(562, tableTop + 15)
      .strokeColor('#cccccc')
      .stroke();

    let rowY = tableTop + 22;
    for (const item of lineItems) {
      doc
        .fontSize(9)
        .text(item.description, columns.description, rowY, { width: 260 })
        .text(String(item.quantity), columns.quantity, rowY, { width: 60, align: 'right' })
        .text(formatCurrency(item.unitPrice, invoice.currency), columns.unitPrice, rowY, {
          width: 70,
          align: 'right',
        })
        .text(formatCurrency(item.lineTotal, invoice.currency), columns.lineTotal, rowY, {
          width: 80,
          align: 'right',
        });
      rowY = doc.y + 8;
    }

    doc.moveTo(50, rowY).lineTo(562, rowY).strokeColor('#cccccc').stroke();

    let totalsY = rowY + 10;
    const totalsRow = (label: string, amount: unknown, bold = false): void => {
      doc
        .fontSize(bold ? 11 : 9)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, columns.unitPrice - 60, totalsY, { width: 130, align: 'right' })
        .text(formatCurrency(amount, invoice.currency), columns.lineTotal, totalsY, {
          width: 80,
          align: 'right',
        });
      totalsY = doc.y + 4;
    };
    totalsRow('Subtotal', invoice.subtotal);
    totalsRow('Tax', invoice.taxAmount);
    totalsRow('Total', invoice.total, true);
    doc.font('Helvetica');

    doc.end();
    return doc;
  }
}
