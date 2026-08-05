import type { JSX } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';

const OPERATIONAL_SHORTCUTS = [
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

// Mirrors AppLayout's CLIENT_NAV_LINKS — a Client-role caller only has
// jobs.read/invoices.read (own records), so the shortcuts above would
// mostly 403 for them.
const CLIENT_SHORTCUTS = [
  { to: '/my-jobs', label: 'My jobs', description: 'Scheduled and past work at your address.' },
  {
    to: '/my-invoices',
    label: 'My invoices',
    description: 'View and download invoices for your account.',
  },
];

/**
 * The authenticated landing page — shortcuts into the operational
 * screens (clients, services, staff, jobs, invoices) built in Fase 9,
 * plus billing, or into the client portal for a Client-role caller.
 * @returns the dashboard element
 */
export function DashboardPage(): JSX.Element {
  const { role } = useAuth();
  const shortcuts = role === 'CLIENT' ? CLIENT_SHORTCUTS : OPERATIONAL_SHORTCUTS;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((s) => (
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
