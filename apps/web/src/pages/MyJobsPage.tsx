import { useEffect, useState, type JSX } from 'react';
import { apiFetch } from '../api/client';
import { Pagination } from '../components/ui/Pagination';
import type { Job, JobStatus, Paginated } from '../types/api';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<JobStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  SCHEDULED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

/**
 * The Client-role portal's read-only view of their own jobs. `GET
 * /jobs` already scopes to the caller's own records server-side
 * (`JobsService`'s Client visibility filter) — this page adds no
 * filtering of its own, just a simpler, non-editable layout, since a
 * Client caller holds `jobs.read` but not `jobs.manage` and has no
 * `clients.read`/`services.read`/`staff.read` to resolve the lookups
 * the operational `JobsPage` needs for its create/edit form.
 * @returns the client portal's jobs page element
 */
export function MyJobsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Job> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Paginated<Job>>(`/jobs?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(setResult)
      .catch(() => setLoadError('Could not load your jobs.'));
  }, [page]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">My jobs</h1>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Scheduled</th>
                <th className="px-3 py-2">Service address</th>
                <th className="px-3 py-2">Services</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                    No jobs yet.
                  </td>
                </tr>
              )}
              {result.items.map((job) => (
                <tr key={job.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {job.scheduledStart
                      ? new Date(job.scheduledStart).toLocaleString()
                      : 'Unscheduled'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {job.serviceAddress
                      ? `${job.serviceAddress.addressLine1}, ${job.serviceAddress.city}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {job.jobServices.length === 0
                      ? '—'
                      : job.jobServices.map((js) => js.service.name).join(', ')}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status]}`}
                    >
                      {STATUS_LABELS[job.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
