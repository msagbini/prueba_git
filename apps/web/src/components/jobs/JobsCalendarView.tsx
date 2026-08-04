import { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';
import { Button } from '../ui/Button';
import type { Job, JobStatus, Paginated } from '../../types/api';

const DAY_COUNT = 7;
const FETCH_PAGE_SIZE = 100;

const STATUS_COLORS: Record<JobStatus, string> = {
  DRAFT: 'border-gray-300 bg-gray-50 text-gray-600',
  SCHEDULED: 'border-blue-300 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-300 bg-amber-50 text-amber-700',
  COMPLETED: 'border-green-300 bg-green-50 text-green-700',
  CANCELLED: 'border-red-300 bg-red-50 text-red-700 line-through',
};

/**
 * Midnight-local Monday of the week containing `date`.
 * @param date any date within the target week
 * @returns midnight-local Monday of that week
 */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isoDayOfWeek = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - isoDayOfWeek);
  return d;
}

/**
 * Adds whole days to a date, returning a new Date.
 * @param date the base date
 * @param days the number of days to add (may be negative)
 * @returns a new date offset by `days`
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Whether two Dates fall on the same local calendar day.
 * @param a the first date
 * @param b the second date
 * @returns true if `a` and `b` share the same local year/month/day
 */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface JobsCalendarViewProps {
  /** Called when a job card is clicked (not dropped) — the parent owns the edit modal. */
  onOpenJob: (job: Job) => void;
}

/**
 * A week-at-a-time dispatch calendar for `JobsPage`: one column per day,
 * jobs positioned by `scheduledStart`, draggable between days to
 * reschedule (native HTML5 drag-and-drop — no library, since this is
 * the only place in the app that needs it). Jobs with no
 * `scheduledStart` never appear here (there's no day to put them in) —
 * they're still visible in the list view, which is the point of
 * keeping both views rather than replacing the list outright.
 * Rescheduling calls `PATCH /jobs/:id`, the same endpoint the list
 * view's edit form already uses — no new write endpoint needed, only
 * the new `scheduledFrom`/`scheduledTo` read filter this view fetches
 * with.
 * @param props the view's props
 * @param props.onOpenJob called when a job card is clicked, not dragged
 * @returns the calendar view element
 */
export function JobsCalendarView({ onOpenJob }: JobsCalendarViewProps): JSX.Element {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const days = Array.from({ length: DAY_COUNT }, (_, i) => addDays(weekStart, i));

  const load = async (): Promise<void> => {
    try {
      const weekEnd = addDays(weekStart, DAY_COUNT);
      const data = await apiFetch<Paginated<Job>>(
        `/jobs?scheduledFrom=${weekStart.toISOString()}&scheduledTo=${weekEnd.toISOString()}&pageSize=${FETCH_PAGE_SIZE}`,
      );
      setJobs(data.items);
      setLoadError(null);
    } catch {
      setLoadError('Could not load jobs for this week.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const jobsForDay = (day: Date): Job[] =>
    jobs
      .filter((j) => j.scheduledStart && isSameLocalDay(new Date(j.scheduledStart), day))
      .sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''));

  const handleDrop = async (job: Job, targetDay: Date): Promise<void> => {
    if (!job.scheduledStart) return;
    setDragError(null);
    const originalStart = new Date(job.scheduledStart);
    const newStart = new Date(targetDay);
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    if (isSameLocalDay(originalStart, newStart)) return; // dropped back on its own day

    const payload: Record<string, unknown> = { scheduledStart: newStart.toISOString() };
    if (job.scheduledEnd) {
      const durationMs = new Date(job.scheduledEnd).getTime() - originalStart.getTime();
      payload.scheduledEnd = new Date(newStart.getTime() + durationMs).toISOString();
    }

    try {
      await apiFetch(`/jobs/${job.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await load();
    } catch {
      setDragError('Could not reschedule this job — you may not have permission to manage it.');
    }
  };

  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(weekStart, DAY_COUNT - 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => setWeekStart(addDays(weekStart, -DAY_COUNT))}
          >
            ‹ Previous
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => setWeekStart(mondayOf(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => setWeekStart(addDays(weekStart, DAY_COUNT))}
          >
            Next ›
          </Button>
        </div>
        <span className="text-sm font-medium text-gray-700">{rangeLabel}</span>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}
      {dragError && <p className="mt-4 text-sm text-red-600">{dragError}</p>}

      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const jobId = e.dataTransfer.getData('text/plain');
              const job = jobs.find((j) => j.id === jobId);
              if (job) handleDrop(job, day);
              setDraggingId(null);
            }}
            className="min-h-[10rem] rounded border border-gray-200 bg-gray-50 p-2"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {day.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
              <span className="text-gray-400">{day.getDate()}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {jobsForDay(day).map((job) => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', job.id);
                    setDraggingId(job.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onOpenJob(job)}
                  className={`cursor-pointer rounded border px-2 py-1 text-xs shadow-sm transition-opacity ${STATUS_COLORS[job.status]} ${draggingId === job.id ? 'opacity-40' : ''}`}
                >
                  <div className="font-medium">
                    {job.scheduledStart
                      ? new Date(job.scheduledStart).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : ''}
                  </div>
                  <div className="truncate">{job.client?.name ?? 'Unknown client'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
