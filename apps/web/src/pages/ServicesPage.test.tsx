import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServicesPage } from './ServicesPage';
import type { Paginated, Service, ServiceCategory } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const CATEGORY: ServiceCategory = { id: 'cat1', name: 'Cleaning' };

const SERVICE: Service = {
  id: 's1',
  categoryId: 'cat1',
  name: 'Deep clean',
  description: 'A thorough clean',
  pricingType: 'FIXED',
  unitLabel: null,
  basePrice: '150',
  isActive: true,
};

function paginated<T>(items: T[]): Paginated<T> {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

function stubFetch(
  overrides: Record<string, (init?: RequestInit) => Promise<Response>> = {},
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      for (const [match, handler] of Object.entries(overrides)) {
        if (url.includes(match)) return handler(init);
      }
      if (url.includes('/services?')) return Promise.resolve(jsonResponse(paginated([SERVICE])));
      if (url.includes('/service-categories') && !init?.method)
        return Promise.resolve(jsonResponse([CATEGORY]));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

describe('ServicesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the category chips and service list', async () => {
    stubFetch();

    render(<ServicesPage />);

    await waitFor(() => expect(screen.getByText('Deep clean')).toBeInTheDocument());
    // Scoped to the table: the (always-mounted, just not open) modal's
    // "Pricing type" <select> also has a "Fixed" <option>, and its
    // "Active (sellable)" checkbox label would collide with "Active".
    const table = screen.getByRole('table');
    expect(within(table).getByText('Cleaning')).toBeInTheDocument();
    expect(within(table).getByText('Fixed')).toBeInTheDocument();
    expect(within(table).getByText('$150')).toBeInTheDocument();
    // "Active" appears both as the column header and the status badge.
    expect(within(table).getAllByText('Active')).toHaveLength(2);
  });

  it('shows a load error when the request fails', async () => {
    stubFetch({ '/services?': () => Promise.resolve(jsonResponse({ message: 'err' }, 500)) });

    render(<ServicesPage />);

    await waitFor(() =>
      expect(screen.getByText('Could not load the service catalog.')).toBeInTheDocument(),
    );
  });

  it('adds a new category', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/services?')) return Promise.resolve(jsonResponse(paginated([SERVICE])));
      if (url.endsWith('/service-categories') && init?.method === 'POST')
        return Promise.resolve(jsonResponse({ id: 'cat2', name: 'Landscaping' }, 201));
      if (url.endsWith('/service-categories')) return Promise.resolve(jsonResponse([CATEGORY]));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ServicesPage />);
    await waitFor(() => expect(screen.getByText('Deep clean')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('New category name'), {
      target: { value: 'Landscaping' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/service-categories',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('creates a new service, including the unit-label field when pricing type is PER_UNIT', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/services?')) return Promise.resolve(jsonResponse(paginated([SERVICE])));
      if (url.includes('/service-categories')) return Promise.resolve(jsonResponse([CATEGORY]));
      if (url === 'http://localhost:3000/services' && init?.method === 'POST')
        return Promise.resolve(jsonResponse({ ...SERVICE, id: 's2' }, 201));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ServicesPage />);
    await waitFor(() => expect(screen.getByText('Deep clean')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'New service' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lawn mowing' } });
    fireEvent.change(screen.getByLabelText('Pricing type'), { target: { value: 'PER_UNIT' } });
    expect(screen.getByLabelText('Unit label')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Unit label'), { target: { value: 'sq ft' } });
    fireEvent.change(screen.getByLabelText('Base price (USD)'), { target: { value: '0.05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/services',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"unitLabel":"sq ft"'),
        }),
      ),
    );
  });

  it('opens the edit modal pre-filled with the service being edited', async () => {
    stubFetch();

    render(<ServicesPage />);
    await waitFor(() => expect(screen.getByText('Deep clean')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit Deep clean' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Deep clean');
    expect(screen.getByLabelText('Base price (USD)')).toHaveValue(150);
  });

  it('shows a form error when saving fails', async () => {
    stubFetch({
      '/services': (init) =>
        init?.method === 'PATCH'
          ? Promise.resolve(jsonResponse({ message: 'boom' }, 500))
          : Promise.resolve(jsonResponse(paginated([SERVICE]))),
    });

    render(<ServicesPage />);
    await waitFor(() => expect(screen.getByText('Deep clean')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});
