import { useEffect, useState, type JSX } from 'react';
import { apiFetch, downloadFile } from '../api/client';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type {
  Invoice,
  InvoiceStatus,
  InvoiceWithLineItems,
  Paginated,
  Payment,
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
 * The Client-role portal's read-only view of their own invoices. `GET
 * /invoices` and `GET /invoices/:id` already scope to the caller's own
 * records server-side (`InvoicesService`'s Client visibility filter) —
 * this is a read-only counterpart to the operational `InvoicesPage`,
 * with no create/edit/record-payment actions, since a Client caller
 * holds `invoices.read`/`payments.read` but not `invoices.manage`.
 * @returns the client portal's invoices page element
 */
export function MyInvoicesPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Invoice> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewing, setViewing] = useState<InvoiceWithLineItems | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    apiFetch<Paginated<Invoice>>(`/invoices?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(setResult)
      .catch(() => setLoadError('Could not load your invoices.'));
  }, [page]);

  const openView = async (invoice: Invoice): Promise<void> => {
    try {
      const [full, paymentsRes] = await Promise.all([
        apiFetch<InvoiceWithLineItems>(`/invoices/${invoice.id}`),
        apiFetch<Paginated<Payment>>(`/payments?pageSize=${LOOKUP_PAGE_SIZE}`),
      ]);
      setViewing(full);
      setPayments(paymentsRes.items.filter((p) => p.invoiceId === invoice.id));
    } catch {
      setLoadError('Could not load this invoice.');
    }
  };

  const handleDownloadPdf = async (invoice: Invoice): Promise<void> => {
    try {
      await downloadFile(`/invoices/${invoice.id}/pdf`, `${invoice.invoiceNumber}.pdf`);
    } catch {
      setLoadError('Could not download this invoice as a PDF.');
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">My invoices</h1>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No invoices yet.
                  </td>
                </tr>
              )}
              {result.items.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{invoice.invoiceNumber}</td>
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
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => handleDownloadPdf(invoice)}
                      >
                        PDF
                      </Button>
                      <Button
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onClick={() => openView(invoice)}
                      >
                        View
                      </Button>
                    </div>
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
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? viewing.invoiceNumber : ''}
      >
        {viewing && (
          <div className="flex flex-col gap-5">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => handleDownloadPdf(viewing)}
              >
                Download PDF
              </Button>
            </div>

            <p className="text-sm text-gray-600">
              Subtotal ${viewing.subtotal} · Tax ${viewing.taxAmount} ·{' '}
              <span className="font-medium text-gray-900">Total ${viewing.total}</span>
            </p>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Line items
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
                {viewing.lineItems.length === 0 && (
                  <li className="text-gray-400">No line items yet.</li>
                )}
                {viewing.lineItems.map((li) => (
                  <li key={li.id} className="flex justify-between">
                    <span>
                      {li.description} × {li.quantity}
                    </span>
                    <span>${li.lineTotal}</span>
                  </li>
                ))}
              </ul>
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
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
