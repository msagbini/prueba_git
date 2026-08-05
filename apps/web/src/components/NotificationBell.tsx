import { useEffect, useRef, useState, type JSX } from 'react';
import { apiFetch } from '../api/client';
import type { AppNotification, Paginated } from '../types/api';

const POLL_INTERVAL_MS = 30_000;
const DROPDOWN_PAGE_SIZE = 10;

/**
 * Formats how long ago a timestamp was, in the coarse "5m ago"/"2h
 * ago"/"3d ago" style a notification dropdown needs — not a general
 * relative-time formatter, just enough granularity for "did I already
 * see this."
 * @param iso the timestamp to format
 * @returns a short relative-time string
 */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The nav bar's notification bell: an unread-count badge, polled every
 * {@link POLL_INTERVAL_MS} so it stays roughly current without the
 * caller having to reload the page, and a dropdown of the most recent
 * notifications. Clicking an unread one marks it read; nothing here
 * navigates to the notification's underlying entity — every current
 * notification type (job assignment, job reminder) already has an
 * obvious "go check your jobs" next step without needing a deep link.
 * @returns the notification bell element
 */
export function NotificationBell(): JSX.Element {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCount = async (): Promise<void> => {
    try {
      const { count } = await apiFetch<{ count: number }>('/notifications/unread-count');
      setUnreadCount(count);
    } catch {
      // Ignore — a stale badge is better than an error banner on every page.
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = async (): Promise<void> => {
    const opening = !open;
    setOpen(opening);
    if (opening) {
      try {
        const result = await apiFetch<Paginated<AppNotification>>(
          `/notifications?pageSize=${DROPDOWN_PAGE_SIZE}`,
        );
        setNotifications(result.items);
      } catch {
        setNotifications([]);
      }
    }
  };

  const handleMarkRead = async (notification: AppNotification): Promise<void> => {
    if (notification.readAt) return;
    try {
      await apiFetch(`/notifications/${notification.id}/read`, { method: 'POST' });
      setNotifications(
        (current) =>
          current?.map((n) =>
            n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n,
          ) ?? null,
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      // Ignore — worst case the notification just stays marked unread.
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Notifications
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications === null && <p className="px-3 py-4 text-sm text-gray-400">Loading…</p>}
            {notifications?.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-400">No notifications yet.</p>
            )}
            {notifications?.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleMarkRead(notification)}
                className={`block w-full border-b border-gray-50 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50 ${
                  notification.readAt ? '' : 'bg-blue-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-gray-900">{notification.title}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {timeAgo(notification.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-600">{notification.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
