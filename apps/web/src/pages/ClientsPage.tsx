import { useEffect, useState, type JSX } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, SelectField, TextareaField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type { Client, ClientAddress, Paginated } from '../types/api';

const PAGE_SIZE = 20;

interface ClientFormState {
  name: string;
  type: 'RESIDENTIAL' | 'COMMERCIAL';
  primaryContactName: string;
  email: string;
  phone: string;
  notes: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

const EMPTY_FORM: ClientFormState = {
  name: '',
  type: 'RESIDENTIAL',
  primaryContactName: '',
  email: '',
  phone: '',
  notes: '',
};

/**
 * Strips empty-string fields so a PATCH doesn't overwrite existing values with ''.
 * @param form the client form's current field values
 * @returns a request body with only the non-empty fields
 */
function toPayload(form: ClientFormState): Record<string, string> {
  const payload: Record<string, string> = { name: form.name, type: form.type };
  if (form.status) payload.status = form.status;
  if (form.primaryContactName) payload.primaryContactName = form.primaryContactName;
  if (form.email) payload.email = form.email;
  if (form.phone) payload.phone = form.phone;
  if (form.notes) payload.notes = form.notes;
  return payload;
}

/**
 * Client (customer) records: list, create, edit, and manage service/
 * billing addresses — the first of the operational CRUD pages consuming
 * the API that's existed since Fase 3 with no web UI in front of it.
 * @returns the clients page element
 */
export function ClientsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Client> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addresses, setAddresses] = useState<ClientAddress[] | null>(null);
  const [addressForm, setAddressForm] = useState({
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });
  const [addressError, setAddressError] = useState<string | null>(null);

  const load = async (targetPage: number): Promise<void> => {
    try {
      const data = await apiFetch<Paginated<Client>>(
        `/clients?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setResult(data);
      setLoadError(null);
    } catch {
      setLoadError('Could not load clients.');
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const openCreate = (): void => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setAddresses(null);
    setModalOpen(true);
  };

  const openEdit = async (client: Client): Promise<void> => {
    setEditingClient(client);
    setForm({
      name: client.name,
      type: client.type,
      primaryContactName: client.primaryContactName ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      notes: client.notes ?? '',
      status: client.status,
    });
    setFormError(null);
    setModalOpen(true);
    try {
      setAddresses(await apiFetch<ClientAddress[]>(`/clients/${client.id}/addresses`));
    } catch {
      setAddresses([]);
    }
  };

  const closeModal = (): void => setModalOpen(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingClient) {
        await apiFetch(`/clients/${editingClient.id}`, {
          method: 'PATCH',
          body: JSON.stringify(toPayload(form)),
        });
      } else {
        await apiFetch('/clients', { method: 'POST', body: JSON.stringify(toPayload(form)) });
      }
      setModalOpen(false);
      await load(page);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setFormError('Plan limit reached — upgrade to add more clients.');
      } else if (
        err instanceof ApiError &&
        typeof err.body === 'object' &&
        err.body &&
        'message' in err.body
      ) {
        setFormError(String((err.body as { message: unknown }).message));
      } else {
        setFormError('Could not save this client.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!editingClient) return;
    setAddressError(null);
    try {
      const created = await apiFetch<ClientAddress>(`/clients/${editingClient.id}/addresses`, {
        method: 'POST',
        body: JSON.stringify({ label: 'SERVICE', ...addressForm }),
      });
      setAddresses((prev) => [...(prev ?? []), created]);
      setAddressForm({ addressLine1: '', city: '', state: '', postalCode: '', country: '' });
    } catch {
      setAddressError('Could not add this address.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
        <Button onClick={openCreate}>New client</Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No clients yet.
                  </td>
                </tr>
              )}
              {result.items.map((client) => (
                <tr key={client.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{client.name}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {client.type === 'RESIDENTIAL' ? 'Residential' : 'Commercial'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{client.email ?? client.phone ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        client.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {client.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      onClick={() => openEdit(client)}
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
        onClose={closeModal}
        title={editingClient ? `Edit ${editingClient.name}` : 'New client'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Type"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as ClientFormState['type'] })
              }
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
            </SelectField>
            {editingClient && (
              <SelectField
                label="Status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ClientFormState['status'] })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </SelectField>
            )}
          </div>
          <Field
            label="Primary contact"
            value={form.primaryContactName}
            onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <TextareaField
            label="Notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>

        {editingClient && (
          <div className="mt-5 border-t border-gray-200 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Addresses
            </h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
              {addresses === null && <li className="text-gray-400">Loading…</li>}
              {addresses?.length === 0 && <li className="text-gray-400">No addresses yet.</li>}
              {addresses?.map((address) => (
                <li key={address.id}>
                  {address.addressLine1}, {address.city}, {address.state} {address.postalCode}
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddAddress} className="mt-3 grid grid-cols-2 gap-2">
              <Field
                label="Address line 1"
                className="col-span-2"
                value={addressForm.addressLine1}
                onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                required
              />
              <Field
                label="City"
                value={addressForm.city}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                required
              />
              <Field
                label="State"
                value={addressForm.state}
                onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                required
              />
              <Field
                label="Postal code"
                value={addressForm.postalCode}
                onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                required
              />
              <Field
                label="Country"
                value={addressForm.country}
                onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                required
              />
              {addressError && <p className="col-span-2 text-xs text-red-600">{addressError}</p>}
              <div className="col-span-2 flex justify-end">
                <Button type="submit" variant="secondary" className="text-xs">
                  Add address
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
