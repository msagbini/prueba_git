import { Link } from 'react-router-dom';

/**
 * The authenticated landing page. Client/job/scheduling/staff screens are
 * a later phase — this phase (Fase 8) only builds the billing section.
 * @returns the dashboard element
 */
export function DashboardPage(): JSX.Element {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-4 text-sm text-gray-600">
        Operational screens (clients, jobs, scheduling, staff) land in a later phase. See{' '}
        <Link to="/billing" className="font-medium text-gray-900 underline">
          Billing
        </Link>{' '}
        for your organization&apos;s plan and subscription.
      </p>
    </div>
  );
}
