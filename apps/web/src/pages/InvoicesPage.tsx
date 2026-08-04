import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, SelectField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type {
  Client,
  Invoice,
  InvoiceStatus,
  InvoiceWithLineItems,
  Paginated,
  Payment,
  PaymentMethod,
} from '../types/api';

const PAGE_SIZE = 20;
const LOOKUP_PAGE_SIZE = 100;

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  SENT: 'bg-blue-50 text-blue-700',
  PAID: 'bg-green-50 text-green-700',
  OVERDUE: 'bg-red-50 text-red-700',
  VOID: 'bg-gray-100 text-gray-400 line-through',
};

/**
 * Invoices, their line items, and the payments recorded against them.
 * Payments live inside an invoice's edit view rather than as a separate
 * top-level page — `POST /payments` always targets one invoice, and
 * there's no standalone "browse all payments" use case this product
 * defines yet, so a nested view avoids a second nav item for the same
 * data. `GET /payments` has no per-invoice filter, so this fetches a
 * large page and filters client-side — fine at today's scale, revisit if
 * an organization's payment volume ever approaches the 100-row lookup cap.
 * @returns the invoices page element
 */
export function InvoicesPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Invoice> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ clientId: '', issueDate: '', dueDate: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<InvoiceWithLineItems | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusDraft, setStatusDraft] = useState<InvoiceStatus>('DRAFT');
  const [subError, setSubError] = useState<string | null>(null);

  const [lineForm, setLineForm] = useState({ description: '', quantity: '1', unitPrice: '' });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'CARD' as PaymentMethod,
    referenceNumber: '',
  });

  const load = async (targetPage: number): Promise<void> => {
    try {
      const data = await apiFetch<Paginated<Invoice>>(
        `/invoices?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setResult(data);
      setLoadError(null);
    } catch {
      setLoadError('Could not load invoices.');
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => {
    apiFetch<Paginated<Client>>(`/clients?pageSize=${LOOKUP_PAGE_SIZE}`)
      .then((res) => setClients(res.items))
      .catch(() => setLoadError('Could not load clients.'));
  }, []);

  const clientName = (clientId: string): string =>
    clients.find((c) => c.id === clientId)?.name ?? '—';

  const openCreate = (): void => {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setCreateForm({ clientId: '', issueDate: today, dueDate: in30 });
    setCreateError(null);
    setModalOpen(true);
  };

  const handleCreate = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch('/invoices', { method: 'POST', body: JSON.stringify(createForm) });
      setModalOpen(false);
      await load(page);
    } catch {
      setCreateError('Could not create this invoice.');
    } finally {
      setCreating(false);
    }
  };

  const refreshEditing = async (id: string): Promise<void> => {
    const [invoice, paymentsRes] = await Promise.all([
      apiFetch<InvoiceWithLineItems>(`/invoices/${id}`),
      apiFetch<Paginated<Payment>>(`/payments?pageSize=${LOOKUP_PAGE_SIZE}`),
    ]);
    setEditing(invoice);
    setStatusDraft(invoice.status);
    setPayments(paymentsRes.items.filter((p) => p.invoiceId === id));
    await load(page);
  };

  const openEdit = async (invoice: Invoice): Promise<void> => {
    setSubError(null);
    setLineForm({ description: '', quantity: '1', unitPrice: '' });
    setPaymentForm({ amount: '', method: 'CARD', referenceNumber: '' });
    await refreshEditing(invoice.id);
  };

  const handleStatusChange = async (): Promise<void> => {
    if (!editing) return;
    setSubError(null);
    try {
      await apiFetch(`/invoices/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusDraft }),
      });
      await refreshEditing(editing.id);
    } catch {
      setSubError('Could not update the status.');
    }
  };

  const handleAddLineItem = async (): Promise<void> => {
    if (!editing || !lineForm.description || !lineForm.unitPrice) return;
    setSubError(null);
    try {
      await apiFetch(`/invoices/${editing.id}/line-items`, {
        method: 'POST',
        body: JSON.stringify({
          description: lineForm.description,
          quantity: Number(lineForm.quantity),
          unitPrice: Number(lineForm.unitPrice),
        }),
      });
      setLineForm({ description: '', quantity: '1', unitPrice: '' });
      await refreshEditing(editing.id);
    } catch {
      setSubError('Could not add this line item.');
    }
  };

  const handleRecordPayment = async (): Promise<void> => {
    if (!editing || !paymentForm.amount) return;
    setSubError(null);
    try {
      await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: editing.id,
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          referenceNumber: paymentForm.referenceNumber || undefined,
        }),
      });
      setPaymentForm({ amount: '', method: 'CARD', referenceNumber: '' });
      await refreshEditing(editing.id);
    } catch (err) {
      if (
        err instanceof ApiError &&
        typeof err.body === 'object' &&
        err.body &&
        'message' in err.body
      ) {
        setSubError(String((err.body as { message: unknown }).message));
      } else {
        setSubError('Could not record this payment.');
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
        <Button onClick={openCreate}>New invoice</Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No invoices yet.
                  </td>
                </tr>
              )}
              {result.items.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{invoice.invoiceNumber}</td>
                  <td className="px-3 py-2 text-gray-600">{clientName(invoice.clientId)}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    ${invoice.total} {invoice.currency}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[invoice.status]}`}
                    >
                      {STATUS_LABELS[invoice.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      onClick={() => openEdit(invoice)}
                    >
                      Open
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New invoice">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <SelectField
            label="Client"
            required
            value={createForm.clientId}
            onChange={(e) => setCreateForm({ ...createForm, clientId: e.target.value })}
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Issue date"
              type="date"
              required
              value={createForm.issueDate}
              onChange={(e) => setCreateForm({ ...createForm, issueDate: e.target.value })}
            />
            <Field
              label="Due date"
              type="date"
              required
              value={createForm.dueDate}
              onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
            />
          </div>
          {createError && <p className="text-xs text-red-600">{createError}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !createForm.clientId}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? editing.invoiceNumber : ''}
      >
        {editing && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <SelectField
                label="Status"
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as InvoiceStatus)}
                className="flex-1"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <Button
                variant="secondary"
                className="mt-5 px-2 py-1 text-xs"
                onClick={handleStatusChange}
              >
                Update
              </Button>
            </div>

            <p className="text-sm text-gray-600">
              Subtotal ${editing.subtotal} · Tax ${editing.taxAmount} ·{' '}
              <span className="font-medium text-gray-900">Total ${editing.total}</span>
            </p>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Line items
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
                {editing.lineItems.length === 0 && (
                  <li className="text-gray-400">No line items yet.</li>
                )}
                {editing.lineItems.map((li) => (
                  <li key={li.id} className="flex justify-between">
                    <span>
                      {li.description} × {li.quantity}
                    </span>
                    <span>${li.lineTotal}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="Line item description"
                  placeholder="Description"
                  value={lineForm.description}
                  onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <input
                  aria-label="Line item quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={lineForm.quantity}
                  onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <input
                  aria-label="Line item unit price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit price"
                  value={lineForm.unitPrice}
                  onChange={(e) => setLineForm({ ...lineForm, unitPrice: e.target.value })}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={handleAddLineItem}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Payments
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
                {payments.length === 0 && (
                  <li className="text-gray-400">No payments recorded yet.</li>
                )}
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>
                      {p.method} {p.referenceNumber ? `(${p.referenceNumber})` : ''}
                    </span>
                    <span>${p.amount}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="Payment amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <select
                  aria-label="Payment method"
                  value={paymentForm.method}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                  <option value="CHECK">Check</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="OTHER">Other</option>
                </select>
                <input
                  aria-label="Reference number"
                  placeholder="Reference #"
                  value={paymentForm.referenceNumber}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })
                  }
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <Button
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  onClick={handleRecordPayment}
                >
                  Record
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
