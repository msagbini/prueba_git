import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import type { AppNotification } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'JOB_ASSIGNED',
    title: 'You were assigned a job',
    body: 'Cleaning at 123 Main St',
    entityType: 'Job',
    entityId: 'j1',
    readAt: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'n2',
    type: 'JOB_REMINDER',
    title: 'Job starting soon',
    body: 'Cleaning at 456 Oak Ave',
    entityType: 'Job',
    entityId: 'j2',
    readAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
];

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/notifications/unread-count')) {
          return Promise.resolve(jsonResponse({ count: 1 }));
        }
        if (url.includes('/notifications?')) {
          return Promise.resolve(
            jsonResponse({ items: NOTIFICATIONS, page: 1, pageSize: 10, total: 2, totalPages: 1 }),
          );
        }
        if (url.includes('/read')) {
          return Promise.resolve(jsonResponse({}, 201));
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the unread badge from the initial poll', async () => {
    render(<NotificationBell />);

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('opens the dropdown and lists notifications on click', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() => expect(screen.getByText('You were assigned a job')).toBeInTheDocument());
    expect(screen.getByText('Job starting soon')).toBeInTheDocument();
  });

  it('marks an unread notification read on click and decrements the badge', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => expect(screen.getByText('You were assigned a job')).toBeInTheDocument());

    fireEvent.click(screen.getByText('You were assigned a job'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/n1/read'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
  });

  it('closes the dropdown when clicking outside', async () => {
    render(
      <div>
        <NotificationBell />
        <button>outside</button>
      </div>,
    );
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => expect(screen.getByText('You were assigned a job')).toBeInTheDocument());

    fireEvent.mouseDown(screen.getByText('outside'));

    await waitFor(() =>
      expect(screen.queryByText('You were assigned a job')).not.toBeInTheDocument(),
    );
  });

  it('shows an empty state when there are no notifications', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/notifications/unread-count'))
        return Promise.resolve(jsonResponse({ count: 0 }));
      if (url.includes('/notifications?'))
        return Promise.resolve(
          jsonResponse({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 }),
        );
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() => expect(screen.getByText('No notifications yet.')).toBeInTheDocument());
  });
});
