import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyJobsPage } from './MyJobsPage';
import type { Job, Paginated } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    clientId: 'c1',
    serviceAddressId: 'a1',
    status: 'SCHEDULED',
    scheduledStart: '2026-08-10T09:00:00.000Z',
    scheduledEnd: '2026-08-10T11:00:00.000Z',
    notes: null,
    client: { id: 'c1', name: 'Acme Corp' },
    serviceAddress: {
      id: 'a1',
      label: 'SERVICE',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Miami',
      state: 'FL',
      postalCode: '33101',
      country: 'US',
    },
    jobServices: [
      {
        id: 'js1',
        service: { id: 's1', name: 'Deep clean' },
        quantity: '1',
      },
    ],
    assignments: [],
    ...overrides,
  };
}

function paginated(items: Job[]): Paginated<Job> {
  return { items, page: 1, pageSize: 20, total: items.length, totalPages: 1 };
}

describe('MyJobsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the caller's jobs with schedule, address, services, and status", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([makeJob()]))));

    render(<MyJobsPage />);

    await waitFor(() => expect(screen.getByText('123 Main St, Miami')).toBeInTheDocument());
    expect(screen.getByText('Deep clean')).toBeInTheDocument();
    // "Scheduled" appears both as the "Scheduled" column header and the
    // status badge text (SCHEDULED -> "Scheduled") — both are asserted.
    expect(screen.getAllByText('Scheduled')).toHaveLength(2);
  });

  it('shows an empty state when there are no jobs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([]))));

    render(<MyJobsPage />);

    await waitFor(() => expect(screen.getByText('No jobs yet.')).toBeInTheDocument());
  });

  it('shows a load error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'err' }, 500)));

    render(<MyJobsPage />);

    await waitFor(() => expect(screen.getByText('Could not load your jobs.')).toBeInTheDocument());
  });

  it('shows "Unscheduled" and placeholders for a job with no schedule/address/services', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            paginated([makeJob({ scheduledStart: null, serviceAddress: null, jobServices: [] })]),
          ),
        ),
    );

    render(<MyJobsPage />);

    await waitFor(() => expect(screen.getByText('Unscheduled')).toBeInTheDocument());
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
