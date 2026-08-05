import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffPage } from './StaffPage';
import type { Paginated, StaffProfile } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const PROFILE: StaffProfile = {
  id: 'sp1',
  membershipId: 'm1',
  employeeCode: 'EMP-01',
  hourlyRate: '25.00',
  hireDate: '2026-01-01T00:00:00.000Z',
  status: 'ACTIVE',
  membership: {
    user: {
      id: 'u1',
      email: 'jane@test.local',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: null,
      status: 'ACTIVE',
    },
  },
};

function paginated<T>(items: T[]): Paginated<T> {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

describe('StaffPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the staff list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([PROFILE]))));

    render(<StaffPage />);

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    const table = screen.getByRole('table');
    expect(within(table).getByText('jane@test.local')).toBeInTheDocument();
    expect(within(table).getByText('EMP-01')).toBeInTheDocument();
    expect(within(table).getByText('$25.00/hr')).toBeInTheDocument();
  });

  it('shows an empty state prompting an invite', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([]))));

    render(<StaffPage />);

    await waitFor(() =>
      expect(screen.getByText('No staff yet — invite someone to get started.')).toBeInTheDocument(),
    );
  });

  it('shows a load error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'err' }, 500)));

    render(<StaffPage />);

    await waitFor(() => expect(screen.getByText('Could not load staff.')).toBeInTheDocument());
  });

  it('sends a staff invitation and shows a confirmation', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/staff?')) return Promise.resolve(jsonResponse(paginated([PROFILE])));
      if (url.endsWith('/organizations/me/invitations') && init?.method === 'POST')
        return Promise.resolve(jsonResponse({}, 201));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StaffPage />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Invite staff' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newhire@test.local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() => expect(screen.getByText(/Invitation sent to/)).toBeInTheDocument());
    expect(screen.getByText('newhire@test.local')).toBeInTheDocument();
  });

  it('shows a plan-limit error (402) when inviting over the plan cap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/staff?')) return Promise.resolve(jsonResponse(paginated([PROFILE])));
        return Promise.resolve(jsonResponse({ message: 'Plan limit reached' }, 402));
      }),
    );

    render(<StaffPage />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Invite staff' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newhire@test.local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() =>
      expect(
        screen.getByText('Plan limit reached — upgrade to add more staff.'),
      ).toBeInTheDocument(),
    );
  });

  it("edits a staff profile's employment fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/staff?')) return Promise.resolve(jsonResponse(paginated([PROFILE])));
      if (url.endsWith('/staff/sp1') && init?.method === 'PATCH')
        return Promise.resolve(jsonResponse({}, 200));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StaffPage />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Employee code'), { target: { value: 'EMP-02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/staff/sp1',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });

  it('shows an edit error when saving fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/staff?')) return Promise.resolve(jsonResponse(paginated([PROFILE])));
        if (init?.method === 'PATCH')
          return Promise.resolve(jsonResponse({ message: 'boom' }, 500));
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    render(<StaffPage />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByText('Could not save this staff profile.')).toBeInTheDocument(),
    );
  });
});
