import { Link } from 'react-router-dom';

const SHORTCUTS = [
  {
    to: '/clients',
    label: 'Clients',
    description: 'Customer records and service/billing addresses.',
  },
  { to: '/services', label: 'Services', description: 'Your priced, sellable service catalog.' },
  {
    to: '/staff',
    label: 'Staff',
    description: 'Invite team members and manage employment fields.',
  },
  { to: '/jobs', label: 'Jobs', description: 'Schedule work, assign staff, bill services.' },
  { to: '/invoices', label: 'Invoices', description: 'Bill clients and record payments.' },
  { to: '/billing', label: 'Billing', description: 'Your organization’s plan and subscription.' },
];

/**
 * The authenticated landing page — shortcuts into the operational
 * screens (clients, services, staff, jobs, invoices) built in Fase 9,
 * plus billing.
 * @returns the dashboard element
 */
export function DashboardPage(): JSX.Element {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-900"
          >
            <h2 className="text-sm font-semibold text-gray-900">{s.label}</h2>
            <p className="mt-1 text-xs text-gray-500">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
