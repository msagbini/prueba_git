import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clients', label: 'Clients', end: false },
  { to: '/services', label: 'Services', end: false },
  { to: '/staff', label: 'Staff', end: false },
  { to: '/billing', label: 'Billing', end: false },
];

/**
 * The authenticated app shell: a top nav bar plus the routed page content.
 * Nav links are added here as their pages ship (Fase 9 adds the
 * operational screens — clients first) rather than pre-building links to
 * pages that don't exist yet.
 * @returns the layout element, with the active route rendered via `Outlet`
 */
export function AppLayout(): JSX.Element {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-gray-900">DOS</span>
            <nav className="flex gap-4">
              {NAV_LINKS.map((link) => (
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
