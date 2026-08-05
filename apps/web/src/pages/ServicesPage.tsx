import { useEffect, useState, type JSX } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, SelectField, TextareaField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type { Paginated, PricingType, Service, ServiceCategory } from '../types/api';

const PAGE_SIZE = 20;

interface ServiceFormState {
  categoryId: string;
  name: string;
  description: string;
  pricingType: PricingType;
  unitLabel: string;
  basePrice: string;
  isActive: boolean;
}

const EMPTY_FORM: ServiceFormState = {
  categoryId: '',
  name: '',
  description: '',
  pricingType: 'FIXED',
  unitLabel: '',
  basePrice: '',
  isActive: true,
};

const PRICING_LABELS: Record<PricingType, string> = {
  HOURLY: 'Hourly',
  FIXED: 'Fixed',
  PER_UNIT: 'Per unit',
};

/**
 * The service catalog: categories and priced, sellable services — a
 * small catalog editor rather than a paginated list, since categories
 * are typically a handful per organization.
 * @returns the services page element
 */
export function ServicesPage(): JSX.Element {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Service> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');

  const load = async (targetPage: number): Promise<void> => {
    try {
      const [services, cats] = await Promise.all([
        apiFetch<Paginated<Service>>(`/services?page=${targetPage}&pageSize=${PAGE_SIZE}`),
        apiFetch<ServiceCategory[]>('/service-categories'),
      ]);
      setResult(services);
      setCategories(cats);
      setLoadError(null);
    } catch {
      setLoadError('Could not load the service catalog.');
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const categoryName = (categoryId: string | null): string =>
    categories.find((c) => c.id === categoryId)?.name ?? '—';

  const openCreate = (): void => {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (service: Service): void => {
    setEditingService(service);
    setForm({
      categoryId: service.categoryId ?? '',
      name: service.name,
      description: service.description ?? '',
      pricingType: service.pricingType,
      unitLabel: service.unitLabel ?? '',
      basePrice: service.basePrice,
      isActive: service.isActive,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleAddCategory = async (): Promise<void> => {
    if (!newCategoryName.trim()) return;
    try {
      const created = await apiFetch<ServiceCategory>('/service-categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setCategories((prev) => [...prev, created]);
      setNewCategoryName('');
    } catch {
      setFormError('Could not add this category.');
    }
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload: Record<string, unknown> = {
      name: form.name,
      pricingType: form.pricingType,
      basePrice: Number(form.basePrice),
      isActive: form.isActive,
    };
    if (form.categoryId) payload.categoryId = form.categoryId;
    if (form.description) payload.description = form.description;
    if (form.pricingType === 'PER_UNIT') payload.unitLabel = form.unitLabel;

    try {
      if (editingService) {
        await apiFetch(`/services/${editingService.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/services', { method: 'POST', body: JSON.stringify(payload) });
      }
      setModalOpen(false);
      await load(page);
    } catch (err) {
      if (
        err instanceof ApiError &&
        typeof err.body === 'object' &&
        err.body &&
        'message' in err.body
      ) {
        setFormError(String((err.body as { message: unknown }).message));
      } else {
        setFormError('Could not save this service.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Services</h1>
        <Button onClick={openCreate}>New service</Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Categories:</span>
        {categories.map((c) => (
          <span key={c.id} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {c.name}
          </span>
        ))}
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category"
          aria-label="New category name"
          className="rounded border border-gray-300 px-2 py-0.5 text-xs focus:border-gray-900 focus:outline-none"
        />
        <Button variant="secondary" className="px-2 py-0.5 text-xs" onClick={handleAddCategory}>
          Add
        </Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {result && (
        <div className="mt-4 overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Pricing</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No services yet.
                  </td>
                </tr>
              )}
              {result.items.map((service) => (
                <tr key={service.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{service.name}</td>
                  <td className="px-3 py-2 text-gray-600">{categoryName(service.categoryId)}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {PRICING_LABELS[service.pricingType]}
                    {service.pricingType === 'PER_UNIT' && service.unitLabel
                      ? ` (${service.unitLabel})`
                      : ''}
                  </td>
                  <td className="px-3 py-2 text-gray-600">${service.basePrice}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        service.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      onClick={() => openEdit(service)}
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
        title={editingService ? `Edit ${editingService.name}` : 'New service'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <SelectField
            label="Category"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Pricing type"
              value={form.pricingType}
              onChange={(e) => setForm({ ...form, pricingType: e.target.value as PricingType })}
            >
              <option value="FIXED">Fixed</option>
              <option value="HOURLY">Hourly</option>
              <option value="PER_UNIT">Per unit</option>
            </SelectField>
            <Field
              label="Base price (USD)"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.basePrice}
              onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
            />
          </div>
          {form.pricingType === 'PER_UNIT' && (
            <Field
              label="Unit label"
              placeholder="e.g. sq ft"
              required
              value={form.unitLabel}
              onChange={(e) => setForm({ ...form, unitLabel: e.target.value })}
            />
          )}
          <TextareaField
            label="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (sellable)
          </label>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
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
