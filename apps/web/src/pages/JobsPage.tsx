import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, SelectField, TextareaField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type {
  Client,
  ClientAddress,
  Job,
  JobStatus,
  Paginated,
  Service,
  StaffProfile,
} from '../types/api';

const PAGE_SIZE = 20;
const LOOKUP_PAGE_SIZE = 100;

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
 * Converts an ISO timestamp to the value a `datetime-local` input expects, or '' for null.
 * @param iso an ISO 8601 timestamp, or null
 * @returns a `datetime-local`-compatible string, or ''
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Scheduled jobs: list, create/edit, assign staff, and bill services — the
 * dispatch-adjacent core of the operational UI. Not a calendar view (that's
 * a separate, later piece of work); this is the list/CRUD surface the
 * `/jobs` API has supported since Fase 3.
 * @returns the jobs page element
 */
export function JobsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Job> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form, setForm] = useState({
    clientId: '',
    serviceAddressId: '',
    scheduledStart: '',
    scheduledEnd: '',
    notes: '',
    status: 'DRAFT' as JobStatus,
  });
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [assignMembershipId, setAssignMembershipId] = useState('');
  const [serviceToAdd, setServiceToAdd] = useState('');
  const [serviceQty, setServiceQty] = useState('1');
  const [subError, setSubError] = useState<string | null>(null);

  const loadLookups = async (): Promise<void> => {
    const [clientsRes, servicesRes, staffRes] = await Promise.all([
      apiFetch<Paginated<Client>>(`/clients?pageSize=${LOOKUP_PAGE_SIZE}`),
      apiFetch<Paginated<Service>>(`/services?pageSize=${LOOKUP_PAGE_SIZE}`),
      apiFetch<Paginated<StaffProfile>>(`/staff?pageSize=${LOOKUP_PAGE_SIZE}`),
    ]);
    setClients(clientsRes.items);
    setServices(servicesRes.items);
    setStaff(staffRes.items.filter((s) => s.status === 'ACTIVE'));
  };

  const load = async (targetPage: number): Promise<void> => {
    try {
      const data = await apiFetch<Paginated<Job>>(`/jobs?page=${targetPage}&pageSize=${PAGE_SIZE}`);
      setResult(data);
      setLoadError(null);
    } catch {
      setLoadError('Could not load jobs.');
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => {
    loadLookups().catch(() => setLoadError('Could not load clients/services/staff.'));
  }, []);

  const clientName = (clientId: string): string =>
    clients.find((c) => c.id === clientId)?.name ?? '—';

  const refreshEditingJob = async (id: string): Promise<void> => {
    const fresh = await apiFetch<Job>(`/jobs/${id}`);
    setEditingJob(fresh);
    await load(page);
  };

  const openCreate = (): void => {
    setEditingJob(null);
    setForm({
      clientId: '',
      serviceAddressId: '',
      scheduledStart: '',
      scheduledEnd: '',
      notes: '',
      status: 'DRAFT',
    });
    setAddresses([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = async (job: Job): Promise<void> => {
    setEditingJob(job);
    setForm({
      clientId: job.clientId,
      serviceAddressId: job.serviceAddressId ?? '',
      scheduledStart: toLocalInput(job.scheduledStart),
      scheduledEnd: toLocalInput(job.scheduledEnd),
      notes: job.notes ?? '',
      status: job.status,
    });
    setFormError(null);
    setSubError(null);
    setModalOpen(true);
    try {
      setAddresses(await apiFetch<ClientAddress[]>(`/clients/${job.clientId}/addresses`));
    } catch {
      setAddresses([]);
    }
  };

  const handleClientChange = async (clientId: string): Promise<void> => {
    setForm({ ...form, clientId, serviceAddressId: '' });
    if (!clientId) {
      setAddresses([]);
      return;
    }
    try {
      setAddresses(await apiFetch<ClientAddress[]>(`/clients/${clientId}/addresses`));
    } catch {
      setAddresses([]);
    }
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingJob) {
        const payload: Record<string, unknown> = {
          status: form.status,
          notes: form.notes || undefined,
        };
        if (form.serviceAddressId) payload.serviceAddressId = form.serviceAddressId;
        if (form.scheduledStart)
          payload.scheduledStart = new Date(form.scheduledStart).toISOString();
        if (form.scheduledEnd) payload.scheduledEnd = new Date(form.scheduledEnd).toISOString();
        await apiFetch(`/jobs/${editingJob.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setModalOpen(false);
        await load(page);
      } else {
        const payload: Record<string, unknown> = {
          clientId: form.clientId,
          notes: form.notes || undefined,
        };
        if (form.serviceAddressId) payload.serviceAddressId = form.serviceAddressId;
        if (form.scheduledStart)
          payload.scheduledStart = new Date(form.scheduledStart).toISOString();
        if (form.scheduledEnd) payload.scheduledEnd = new Date(form.scheduledEnd).toISOString();
        await apiFetch('/jobs', { method: 'POST', body: JSON.stringify(payload) });
        setModalOpen(false);
        await load(page);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setFormError('Plan limit reached — upgrade to schedule more active jobs.');
      } else if (
        err instanceof ApiError &&
        typeof err.body === 'object' &&
        err.body &&
        'message' in err.body
      ) {
        setFormError(String((err.body as { message: unknown }).message));
      } else {
        setFormError('Could not save this job.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (): Promise<void> => {
    if (!editingJob || !assignMembershipId) return;
    setSubError(null);
    try {
      await apiFetch(`/jobs/${editingJob.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ membershipId: assignMembershipId }),
      });
      setAssignMembershipId('');
      await refreshEditingJob(editingJob.id);
    } catch {
      setSubError('Could not assign this staff member.');
    }
  };

  const handleAddService = async (): Promise<void> => {
    if (!editingJob || !serviceToAdd) return;
    setSubError(null);
    try {
      await apiFetch(`/jobs/${editingJob.id}/services`, {
        method: 'POST',
        body: JSON.stringify({ serviceId: serviceToAdd, quantity: Number(serviceQty) }),
      });
      setServiceToAdd('');
      setServiceQty('1');
      await refreshEditingJob(editingJob.id);
    } catch {
      setSubError('Could not add this service.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Jobs</h1>
        <Button onClick={openCreate}>New job</Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Scheduled</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No jobs yet.
                  </td>
                </tr>
              )}
              {result.items.map((job) => (
                <tr key={job.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {job.client?.name ?? clientName(job.clientId)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {job.scheduledStart
                      ? new Date(job.scheduledStart).toLocaleString()
                      : 'Unscheduled'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {job.assignments.length === 0
                      ? '—'
                      : job.assignments
                          .map(
                            (a) => `${a.membership.user.firstName} ${a.membership.user.lastName}`,
                          )
                          .join(', ')}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[job.status]}`}
                    >
                      {STATUS_LABELS[job.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      onClick={() => openEdit(job)}
                    >
                      Edit
                    </Button>
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingJob ? 'Edit job' : 'New job'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {editingJob ? (
            <p className="text-sm text-gray-600">
              Client: <span className="font-medium text-gray-900">{editingJob.client?.name}</span>
            </p>
          ) : (
            <SelectField
              label="Client"
              required
              value={form.clientId}
              onChange={(e) => handleClientChange(e.target.value)}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          )}

          {addresses.length > 0 && (
            <SelectField
              label="Service address"
              value={form.serviceAddressId}
              onChange={(e) => setForm({ ...form, serviceAddressId: e.target.value })}
            >
              <option value="">No address on file</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.addressLine1}, {a.city}
                </option>
              ))}
            </SelectField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Scheduled start"
              type="datetime-local"
              value={form.scheduledStart}
              onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
            />
            <Field
              label="Scheduled end"
              type="datetime-local"
              value={form.scheduledEnd}
              onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })}
            />
          </div>

          {editingJob && (
            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as JobStatus })}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          )}

          <TextareaField
            label="Notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (!editingJob && !form.clientId)}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>

        {editingJob && (
          <div className="mt-5 flex flex-col gap-5 border-t border-gray-200 pt-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Assigned staff
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
                {editingJob.assignments.length === 0 && (
                  <li className="text-gray-400">Nobody assigned yet.</li>
                )}
                {editingJob.assignments.map((a) => (
                  <li key={a.id}>
                    {a.membership.user.firstName} {a.membership.user.lastName}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <select
                  aria-label="Assign staff member"
                  value={assignMembershipId}
                  onChange={(e) => setAssignMembershipId(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">Select staff…</option>
                  {staff.map((s) => (
                    <option key={s.membershipId} value={s.membershipId}>
                      {s.membership.user.firstName} {s.membership.user.lastName}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" className="px-2 py-1 text-xs" onClick={handleAssign}>
                  Assign
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Services
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
                {editingJob.jobServices.length === 0 && (
                  <li className="text-gray-400">No services billed yet.</li>
                )}
                {editingJob.jobServices.map((js) => (
                  <li key={js.id}>
                    {js.service.name} × {js.quantity}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <select
                  aria-label="Add a service"
                  value={serviceToAdd}
                  onChange={(e) => setServiceToAdd(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">Select service…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={serviceQty}
                  onChange={(e) => setServiceQty(e.target.value)}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={handleAddService}
                >
                  Add
                </Button>
              </div>
            </div>

            {subError && <p className="text-xs text-red-600">{subError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
