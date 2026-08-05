import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientsPage } from './ClientsPage';
import type { Client, ClientAddress, Paginated } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const CLIENT: Client = {
  id: 'c1',
  name: 'Acme Corp',
  type: 'COMMERCIAL',
  primaryContactName: 'Jane Doe',
  email: 'jane@acme.test',
  phone: null,
  status: 'ACTIVE',
  notes: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

function paginated<T>(items: T[]): Paginated<T> {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

describe('ClientsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the client list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([CLIENT]))));

    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    // Scoped to the table: the (always-mounted, just not open) modal's
    // "Type" <select> also has a "Commercial" <option>, which would
    // otherwise collide with the table cell's plain-text "Commercial".
    const table = screen.getByRole('table');
    expect(within(table).getByText('Commercial')).toBeInTheDocument();
    expect(within(table).getByText('jane@acme.test')).toBeInTheDocument();
  });

  it('shows an empty state when there are no clients', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([]))));

    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('No clients yet.')).toBeInTheDocument());
  });

  it('shows a load error when the list request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'err' }, 500)));

    render(<ClientsPage />);

    await waitFor(() => expect(screen.getByText('Could not load clients.')).toBeInTheDocument());
  });

  it('creates a new client and refreshes the list', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/clients?') && (!init || init.method === undefined))
        return Promise.resolve(jsonResponse(paginated([CLIENT])));
      if (url === 'http://localhost:3000/clients' && init?.method === 'POST')
        return Promise.resolve(jsonResponse({ ...CLIENT, id: 'c2' }, 201));
      return Promise.reject(new Error(`unexpected fetch: ${url} ${init?.method}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'New client' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Client Inc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/clients',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows a plan-limit error (402) when creating over the plan cap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        if (!init?.method) return Promise.resolve(jsonResponse(paginated([CLIENT])));
        return Promise.resolve(jsonResponse({ message: 'Plan limit reached' }, 402));
      }),
    );

    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'New client' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Client Inc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        screen.getByText('Plan limit reached — upgrade to add more clients.'),
      ).toBeInTheDocument(),
    );
  });

  it('opens the edit modal, loads addresses, and adds a new address', async () => {
    const address: ClientAddress = {
      id: 'a1',
      label: 'SERVICE',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Miami',
      state: 'FL',
      postalCode: '33101',
      country: 'US',
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/clients?')) return Promise.resolve(jsonResponse(paginated([CLIENT])));
      if (url.endsWith('/clients/c1/addresses') && !init?.method)
        return Promise.resolve(jsonResponse([address]));
      if (url.endsWith('/clients/c1/addresses') && init?.method === 'POST')
        return Promise.resolve(
          jsonResponse({ ...address, id: 'a2', addressLine1: '456 Oak Ave', city: 'Orlando' }, 201),
        );
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByText(/123 Main St, Miami/)).toBeInTheDocument());

    const dialog = screen
      .getByRole('heading', { name: 'Edit Acme Corp' })
      .closest('dialog') as HTMLElement;
    fireEvent.change(within(dialog).getByLabelText('Address line 1'), {
      target: { value: '456 Oak Ave' },
    });
    fireEvent.change(within(dialog).getByLabelText('City'), { target: { value: 'Orlando' } });
    fireEvent.change(within(dialog).getByLabelText('State'), { target: { value: 'FL' } });
    fireEvent.change(within(dialog).getByLabelText('Postal code'), { target: { value: '32801' } });
    fireEvent.change(within(dialog).getByLabelText('Country'), { target: { value: 'US' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add address' }));

    await waitFor(() => expect(screen.getByText(/456 Oak Ave, Orlando/)).toBeInTheDocument());
  });

  it('closes the modal on Cancel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([CLIENT]))));

    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'New client' }));
    expect(screen.getByRole('heading', { name: 'New client' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'New client' })).not.toBeInTheDocument(),
    );
  });
});
