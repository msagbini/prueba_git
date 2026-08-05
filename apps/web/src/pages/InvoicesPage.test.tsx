import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvoicesPage } from './InvoicesPage';
import type { Client, Invoice, InvoiceWithLineItems, Paginated, Payment } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const CLIENT: Client = {
  id: 'c1',
  name: 'Acme Corp',
  type: 'COMMERCIAL',
  primaryContactName: null,
  email: null,
  phone: null,
  status: 'ACTIVE',
  notes: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const INVOICE: Invoice = {
  id: 'inv1',
  clientId: 'c1',
  invoiceNumber: 'INV-0001',
  status: 'DRAFT',
  issueDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-15T00:00:00.000Z',
  subtotal: '100',
  taxAmount: '0',
  total: '100',
  currency: 'USD',
};

const INVOICE_FULL: InvoiceWithLineItems = {
  ...INVOICE,
  lineItems: [
    { id: 'li1', description: 'Deep clean', quantity: '1', unitPrice: '100', lineTotal: '100' },
  ],
};

function paginated<T>(items: T[]): Paginated<T> {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

function stubFetch(
  overrides: Record<string, (init?: RequestInit) => Promise<Response>> = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [match, handler] of Object.entries(overrides)) {
      if (url.includes(match)) return handler(init);
    }
    if (url.includes('/invoices?')) return Promise.resolve(jsonResponse(paginated([INVOICE])));
    if (url.includes('/clients?')) return Promise.resolve(jsonResponse(paginated([CLIENT])));
    if (url.includes('/payments?')) return Promise.resolve(jsonResponse(paginated<Payment>([])));
    if (url.match(/\/invoices\/inv1$/)) return Promise.resolve(jsonResponse(INVOICE_FULL));
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('InvoicesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the invoice list with resolved client names', async () => {
    stubFetch();

    render(<InvoicesPage />);

    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
    const table = screen.getByRole('table');
    expect(within(table).getByText('Acme Corp')).toBeInTheDocument();
    expect(within(table).getByText('$100 USD')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    stubFetch({ '/invoices?': () => Promise.resolve(jsonResponse(paginated([]))) });

    render(<InvoicesPage />);

    await waitFor(() => expect(screen.getByText('No invoices yet.')).toBeInTheDocument());
  });

  it('shows a load error when the invoice list request fails', async () => {
    stubFetch({ '/invoices?': () => Promise.resolve(jsonResponse({ message: 'err' }, 500)) });

    render(<InvoicesPage />);

    await waitFor(() => expect(screen.getByText('Could not load invoices.')).toBeInTheDocument());
  });

  it('creates a new invoice for the selected client', async () => {
    const fetchMock = stubFetch({
      'http://localhost:3000/invoices': (init) =>
        init?.method === 'POST'
          ? Promise.resolve(jsonResponse({ ...INVOICE, id: 'inv2' }, 201))
          : Promise.resolve(jsonResponse(paginated([INVOICE]))),
    });

    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/invoices',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('opens an invoice, showing its line items, and adds a new line item', async () => {
    const fetchMock = stubFetch({
      '/invoices/inv1/line-items': () => Promise.resolve(jsonResponse({}, 201)),
    });

    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByText('Deep clean × 1')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Line item description'), {
      target: { value: 'Window cleaning' },
    });
    fireEvent.change(screen.getByLabelText('Line item unit price'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/invoices/inv1/line-items',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('updates the invoice status', async () => {
    const fetchMock = stubFetch({
      '/invoices/inv1': (init) =>
        init?.method === 'PATCH'
          ? Promise.resolve(jsonResponse({}, 200))
          : Promise.resolve(jsonResponse(INVOICE_FULL)),
    });

    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByText('Deep clean × 1')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'SENT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/invoices/inv1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'SENT' }) }),
      ),
    );
  });

  it('records a payment', async () => {
    const fetchMock = stubFetch({
      'http://localhost:3000/payments': (init) =>
        init?.method === 'POST'
          ? Promise.resolve(jsonResponse({}, 201))
          : Promise.resolve(jsonResponse(paginated<Payment>([]))),
    });

    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByText('Deep clean × 1')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/payments',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows a payment error message from the API body', async () => {
    stubFetch({
      'http://localhost:3000/payments': (init) =>
        init?.method === 'POST'
          ? Promise.resolve(jsonResponse({ message: 'Amount exceeds balance due.' }, 400))
          : Promise.resolve(jsonResponse(paginated<Payment>([]))),
    });

    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByText('Deep clean × 1')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    await waitFor(() =>
      expect(screen.getByText('Amount exceeds balance due.')).toBeInTheDocument(),
    );
  });

  it('downloads the invoice PDF from the list row', async () => {
    stubFetch({
      '/invoices/inv1/pdf': () => Promise.resolve(new Response('%PDF-1.4', { status: 200 })),
    });
    const clickSpy = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    render(<InvoicesPage />);
    await waitFor(() => expect(screen.getByText('INV-0001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
  });
});
