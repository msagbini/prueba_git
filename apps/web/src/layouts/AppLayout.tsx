import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OPERATIONAL_NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clients', label: 'Clients', end: false },
  { to: '/services', label: 'Services', end: false },
  { to: '/staff', label: 'Staff', end: false },
  { to: '/jobs', label: 'Jobs', end: false },
  { to: '/invoices', label: 'Invoices', end: false },
  { to: '/billing', label: 'Billing', end: false },
];

// A Client-role caller holds none of the permissions the links above
// need (clients.read/services.read/staff.read/billing are all
// unavailable to RoleCode.CLIENT — see prisma/seed.ts) other than the
// two links here, which map onto jobs.read/invoices.read scoped to
// their own records.
const CLIENT_NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/my-jobs', label: 'My jobs', end: false },
  { to: '/my-invoices', label: 'My invoices', end: false },
];

/**
 * The authenticated app shell: a top nav bar plus the routed page content.
 * Nav links are added here as their pages ship (Fase 9 adds the
 * operational screens — clients first) rather than pre-building links to
 * pages that don't exist yet. Client-role callers get a distinct, shorter
 * nav (see `CLIENT_NAV_LINKS`) since they hold none of the permissions the
 * operational links need.
 * @returns the layout element, with the active route rendered via `Outlet`
 */
export function AppLayout(): JSX.Element {
  const { logout, role } = useAuth();
  const navLinks = role === 'CLIENT' ? CLIENT_NAV_LINKS : OPERATIONAL_NAV_LINKS;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-gray-900">DOS</span>
            <nav className="flex gap-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <button
            onClick={() => logout()}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
