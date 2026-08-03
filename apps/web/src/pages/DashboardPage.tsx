import { useAuth } from '../context/AuthContext';

/**
 * Placeholder landing screen after login — real dashboard widgets are Fase 5 work.
 * @returns the dashboard placeholder element
 */
export function DashboardPage(): JSX.Element {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <button
          onClick={logout}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-600">
        This is a Fase 2 routing/API-client scaffold — clients, jobs, scheduling, staff and billing
        screens land in later phases.
      </p>
    </div>
  );
}
