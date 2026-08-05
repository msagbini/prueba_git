import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyInvoicesPage } from './MyInvoicesPage';
import type { Invoice, InvoiceWithLineItems, Paginated, Payment } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const INVOICE: Invoice = {
  id: 'inv1',
  clientId: 'c1',
  invoiceNumber: 'INV-0001',
  status: 'SENT',
  issueDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-15T00:00:00.000Z',
  subtotal: '100',
  taxAmount: '10',
  total: '110',
  currency: 'USD',
};

const INVOICE_FULL: InvoiceWithLineItems = {
  ...INVOICE,
  lineItems: [
    { id: 'li1', description: 'Deep clean', quantity: '1', unitPrice: '100', lineTotal: '100' },
  ],
};

const PAYMENT: Payment = {
  id: 'p1',
  invoiceId: 'inv1',
  amount: '110',
  method: 'CARD',
  status: 'COMPLETED',
  paidAt: '2026-08-05T00:00:00.000Z',
  referenceNumber: 'ref-1',
};

function paginated<T>(items: T[]): Paginated<T> {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

describe('MyInvoicesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the caller's invoices with due date, total, and status", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([INVOICE]))));

    render(<MyInvoicesPage />);

    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
    expect(screen.getByText('$110 USD')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('shows an empty state when there are no invoices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([]))));

    render(<MyInvoicesPage />);

    await waitFor(() => expect(screen.getByText('No invoices yet.')).toBeInTheDocument());
  });

  it('shows a load error when the list request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'err' }, 500)));

    render(<MyInvoicesPage />);

    await waitFor(() =>
      expect(screen.getByText('Could not load your invoices.')).toBeInTheDocument(),
    );
  });

  it('opens the view modal with line items and payments filtered to this invoice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/invoices?')) return Promise.resolve(jsonResponse(paginated([INVOICE])));
        if (url.includes('/invoices/inv1')) return Promise.resolve(jsonResponse(INVOICE_FULL));
        if (url.includes('/payments?'))
          return Promise.resolve(
            jsonResponse(
              paginated([PAYMENT, { ...PAYMENT, id: 'p2', invoiceId: 'other-invoice' }]),
            ),
          );
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    render(<MyInvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    await waitFor(() => expect(screen.getByText('Deep clean × 1')).toBeInTheDocument());
    expect(screen.getByText('CARD (ref-1)')).toBeInTheDocument();
    expect(screen.getByText(/Subtotal \$100/)).toBeInTheDocument();
  });

  it('downloads the PDF when the PDF button is clicked', async () => {
    // A jsdom Blob passed as a Response body hits a cross-realm gap
    // (the Response internals call body.stream(), which jsdom's Blob
    // polyfill doesn't implement) — a string body exercises the same
    // downloadFile() code path (response.blob()) without that gap.
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/invoices?')) return Promise.resolve(jsonResponse(paginated([INVOICE])));
        if (url.includes('/pdf'))
          return Promise.resolve(
            new Response('%PDF-1.4', {
              status: 200,
              headers: { 'Content-Type': 'application/pdf' },
            }),
          );
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );
    const clickSpy = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    render(<MyInvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
  });
});
