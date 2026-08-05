import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobsCalendarView } from './JobsCalendarView';
import type { Job, Paginated } from '../../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function paginated(items: Job[]): Paginated<Job> {
  return { items, page: 1, pageSize: 100, total: items.length, totalPages: 1 };
}

/**
 * Mirrors the component's own mondayOf() so tests don't need to freeze time.
 * @param date the date to find the Monday of
 * @returns the Monday of that date's week
 */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isoDayOfWeek = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - isoDayOfWeek);
  return d;
}

/**
 * Adds a number of days to a date, returning a new date.
 * @param date the base date
 * @param days number of days to add (may be negative)
 * @returns a new date offset by the given number of days
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function rangeLabelFor(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

const THIS_MONDAY = mondayOf(new Date());
const THIS_TUESDAY = addDays(THIS_MONDAY, 1);

function makeJob(overrides: Partial<Job> = {}): Job {
  const scheduled = new Date(THIS_MONDAY);
  scheduled.setHours(9, 0, 0, 0);
  return {
    id: 'j1',
    clientId: 'c1',
    serviceAddressId: null,
    status: 'SCHEDULED',
    scheduledStart: scheduled.toISOString(),
    scheduledEnd: null,
    notes: null,
    client: { id: 'c1', name: 'Acme Corp' },
    serviceAddress: null,
    jobServices: [],
    assignments: [],
    ...overrides,
  };
}

/**
 * Builds a fake DataTransfer good enough for this component's setData/getData usage.
 * @returns a minimal DataTransfer-shaped object
 */
function fakeDataTransfer(): DataTransfer {
  const store = new Map<string, string>();
  return {
    setData: (format: string, data: string) => store.set(format, data),
    getData: (format: string) => store.get(format) ?? '',
  } as unknown as DataTransfer;
}

describe('JobsCalendarView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the current week and the scheduled job on its day', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([makeJob()]))));

    render(<JobsCalendarView onOpenJob={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByText(rangeLabelFor(THIS_MONDAY))).toBeInTheDocument();
  });

  it('shows a load error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'err' }, 500)));

    render(<JobsCalendarView onOpenJob={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Could not load jobs for this week.')).toBeInTheDocument(),
    );
  });

  it('calls onOpenJob when a job card is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([makeJob()]))));
    const onOpenJob = vi.fn();

    render(<JobsCalendarView onOpenJob={onOpenJob} />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Acme Corp'));

    expect(onOpenJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }));
  });

  it('navigates to the previous/next week and back to today', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(paginated([]))));

    render(<JobsCalendarView onOpenJob={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(rangeLabelFor(THIS_MONDAY))).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '‹ Previous' }));
    await waitFor(() =>
      expect(screen.getByText(rangeLabelFor(addDays(THIS_MONDAY, -7)))).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }));
    await waitFor(() => expect(screen.getByText(rangeLabelFor(THIS_MONDAY))).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '‹ Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(screen.getByText(rangeLabelFor(THIS_MONDAY))).toBeInTheDocument());
  });

  it('reschedules a job when dropped on a different day', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve(jsonResponse({}, 200));
      return Promise.resolve(jsonResponse(paginated([makeJob()])));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<JobsCalendarView onOpenJob={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const card = screen.getByText('Acme Corp').closest('[draggable]') as HTMLElement;
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(card, { dataTransfer });

    const targetColumn = screen.getByText(String(THIS_TUESDAY.getDate())).closest('div')
      ?.parentElement as HTMLElement;
    fireEvent.drop(targetColumn, { dataTransfer });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/jobs/j1',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });

  it('shows a drag error when rescheduling fails', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH')
        return Promise.resolve(jsonResponse({ message: 'forbidden' }, 403));
      return Promise.resolve(jsonResponse(paginated([makeJob()])));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<JobsCalendarView onOpenJob={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

    const card = screen.getByText('Acme Corp').closest('[draggable]') as HTMLElement;
    const dataTransfer = fakeDataTransfer();
    fireEvent.dragStart(card, { dataTransfer });
    const targetColumn = screen.getByText(String(THIS_TUESDAY.getDate())).closest('div')
      ?.parentElement as HTMLElement;
    fireEvent.drop(targetColumn, { dataTransfer });

    await waitFor(() =>
      expect(
        screen.getByText(
          'Could not reschedule this job — you may not have permission to manage it.',
        ),
      ).toBeInTheDocument(),
    );
  });
});
