import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, SelectField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type { Paginated, StaffProfile, StaffStatus } from '../types/api';

const PAGE_SIZE = 20;

/**
 * Staff profiles: the team members who get assigned to jobs. Adding
 * someone happens by inviting their email (they accept and set their own
 * password) rather than a direct "create staff" call — there's no other
 * way to attach a StaffProfile to a real login. Editing here only covers
 * the employment fields (`StaffProfile`); the person's name/email lives
 * on their `User` record, out of scope for this page.
 * @returns the staff page element
 */
export function StaffPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<StaffProfile> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [editing, setEditing] = useState<StaffProfile | null>(null);
  const [editForm, setEditForm] = useState({
    employeeCode: '',
    hourlyRate: '',
    status: 'ACTIVE' as StaffStatus,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (targetPage: number): Promise<void> => {
    try {
      const data = await apiFetch<Paginated<StaffProfile>>(
        `/staff?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setResult(data);
      setLoadError(null);
    } catch {
      setLoadError('Could not load staff.');
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const openInvite = (): void => {
    setInviteEmail('');
    setInviteError(null);
    setInviteSent(false);
    setInviteOpen(true);
  };

  const handleInvite = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setInviting(true);
    setInviteError(null);
    try {
      await apiFetch('/organizations/me/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, roleCode: 'STAFF' }),
      });
      setInviteSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setInviteError('Plan limit reached — upgrade to add more staff.');
      } else {
        setInviteError('Could not send this invitation.');
      }
    } finally {
      setInviting(false);
    }
  };

  const openEdit = (profile: StaffProfile): void => {
    setEditing(profile);
    setEditForm({
      employeeCode: profile.employeeCode ?? '',
      hourlyRate: profile.hourlyRate ?? '',
      status: profile.status,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    const payload: Record<string, unknown> = { status: editForm.status };
    if (editForm.employeeCode) payload.employeeCode = editForm.employeeCode;
    if (editForm.hourlyRate) payload.hourlyRate = Number(editForm.hourlyRate);
    try {
      await apiFetch(`/staff/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setEditing(null);
      await load(page);
    } catch {
      setEditError('Could not save this staff profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Staff</h1>
        <Button onClick={openInvite}>Invite staff</Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Employee code</th>
                <th className="px-3 py-2">Hourly rate</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No staff yet — invite someone to get started.
                  </td>
                </tr>
              )}
              {result.items.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {profile.membership.user.firstName} {profile.membership.user.lastName}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{profile.membership.user.email}</td>
                  <td className="px-3 py-2 text-gray-600">{profile.employeeCode ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {profile.hourlyRate ? `$${profile.hourlyRate}/hr` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        profile.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {profile.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      onClick={() => openEdit(profile)}
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

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite staff">
        {inviteSent ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700">
              Invitation sent to <span className="font-medium">{inviteEmail}</span>. They&apos;ll
              show up here once they accept it.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setInviteOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <Field
              label="Email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Sending…' : 'Send invitation'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing ? `${editing.membership.user.firstName} ${editing.membership.user.lastName}` : ''
        }
      >
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-3">
          <Field
            label="Employee code"
            value={editForm.employeeCode}
            onChange={(e) => setEditForm({ ...editForm, employeeCode: e.target.value })}
          />
          <Field
            label="Hourly rate (USD)"
            type="number"
            min="0"
            step="0.01"
            value={editForm.hourlyRate}
            onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
          />
          <SelectField
            label="Status"
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as StaffStatus })}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectField>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
