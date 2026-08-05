import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobsPage } from './JobsPage';
import type { Client, ClientAddress, Job, Paginated, Service, StaffProfile } from '../types/api';

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

const ADDRESS: ClientAddress = {
  id: 'a1',
  label: 'SERVICE',
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Miami',
  state: 'FL',
  postalCode: '33101',
  country: 'US',
};

const SERVICE: Service = {
  id: 's1',
  categoryId: null,
  name: 'Deep clean',
  description: null,
  pricingType: 'FIXED',
  unitLabel: null,
  basePrice: '150',
  isActive: true,
};

const STAFF: StaffProfile = {
  id: 'sp1',
  membershipId: 'm1',
  employeeCode: 'EMP-01',
  hourlyRate: null,
  hireDate: null,
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

const JOB: Job = {
  id: 'j1',
  clientId: 'c1',
  serviceAddressId: 'a1',
  status: 'SCHEDULED',
  scheduledStart: '2026-08-10T09:00:00.000Z',
  scheduledEnd: '2026-08-10T11:00:00.000Z',
  notes: null,
  client: { id: 'c1', name: 'Acme Corp' },
  serviceAddress: ADDRESS,
  jobServices: [],
  assignments: [],
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
    if (url.includes('/jobs?')) return Promise.resolve(jsonResponse(paginated([JOB])));
    if (url.includes('/clients?')) return Promise.resolve(jsonResponse(paginated([CLIENT])));
    if (url.includes('/services?')) return Promise.resolve(jsonResponse(paginated([SERVICE])));
    if (url.includes('/staff?')) return Promise.resolve(jsonResponse(paginated([STAFF])));
    if (url.match(/\/clients\/c1\/addresses$/)) return Promise.resolve(jsonResponse([ADDRESS]));
    if (url.match(/\/jobs\/j1$/)) return Promise.resolve(jsonResponse(JOB));
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('JobsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the job list with client, schedule, assignment, and status', async () => {
    stubFetch();

    render(<JobsPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    const table = screen.getByRole('table');
    expect(within(table).getByText('Acme Corp')).toBeInTheDocument();
    expect(within(table).getByText('—')).toBeInTheDocument(); // no assignments yet
    expect(within(table).getAllByText('Scheduled')).toHaveLength(2); // header + badge
  });

  it('shows an empty state', async () => {
    stubFetch({ '/jobs?': () => Promise.resolve(jsonResponse(paginated([]))) });

    render(<JobsPage />);

    await waitFor(() => expect(screen.getByText('No jobs yet.')).toBeInTheDocument());
  });

  it('shows a load error when the job list request fails', async () => {
    stubFetch({ '/jobs?': () => Promise.resolve(jsonResponse({ message: 'err' }, 500)) });

    render(<JobsPage />);

    await waitFor(() => expect(screen.getByText('Could not load jobs.')).toBeInTheDocument());
  });

  it('toggles between the List and Calendar views', async () => {
    stubFetch({
      scheduledFrom: () => Promise.resolve(jsonResponse(paginated([JOB]))),
    });

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  });

  it('creates a new job for the selected client', async () => {
    const fetchMock = stubFetch({
      'http://localhost:3000/jobs': (init) =>
        init?.method === 'POST'
          ? Promise.resolve(jsonResponse({ ...JOB, id: 'j2' }, 201))
          : Promise.resolve(jsonResponse(paginated([JOB]))),
    });

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'New job' }));
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c1' } });
    await waitFor(() => expect(screen.getByLabelText('Service address')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/jobs',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows a plan-limit error (402) when creating over the plan cap', async () => {
    stubFetch({
      'http://localhost:3000/jobs': (init) =>
        init?.method === 'POST'
          ? Promise.resolve(jsonResponse({ message: 'Plan limit reached' }, 402))
          : Promise.resolve(jsonResponse(paginated([JOB]))),
    });

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'New job' }));
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        screen.getByText('Plan limit reached — upgrade to schedule more active jobs.'),
      ).toBeInTheDocument(),
    );
  });

  it("opens the edit modal pre-filled, loading addresses for the job's client", async () => {
    stubFetch();

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit job' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Service address')).toBeInTheDocument());
    expect(screen.getByText('Nobody assigned yet.')).toBeInTheDocument();
    expect(screen.getByText('No services billed yet.')).toBeInTheDocument();
  });

  it('assigns a staff member to the job being edited', async () => {
    const assignedJob: Job = {
      ...JOB,
      assignments: [
        { id: 'as1', status: 'ASSIGNED', membership: { id: 'm1', user: STAFF.membership.user } },
      ],
    };
    const fetchMock = stubFetch({
      '/jobs/j1/assignments': () => Promise.resolve(jsonResponse({}, 201)),
      '/jobs/j1': (init) =>
        !init?.method
          ? Promise.resolve(jsonResponse(assignedJob))
          : Promise.resolve(jsonResponse({}, 200)),
    });

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Assign staff member')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Assign staff member'), { target: { value: 'm1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/jobs/j1/assignments',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('adds a billable service to the job being edited', async () => {
    const fetchMock = stubFetch({
      '/jobs/j1/services': () => Promise.resolve(jsonResponse({}, 201)),
    });

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Add a service')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Add a service'), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/jobs/j1/services',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows a sub-error when assigning staff fails', async () => {
    stubFetch({
      '/jobs/j1/assignments': () => Promise.resolve(jsonResponse({ message: 'err' }, 500)),
    });

    render(<JobsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByLabelText('Assign staff member')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Assign staff member'), { target: { value: 'm1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() =>
      expect(screen.getByText('Could not assign this staff member.')).toBeInTheDocument(),
    );
  });
});
