import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

// Code-split per route: a caller visiting one operational page doesn't
// need the other five in their initial bundle. Login/Dashboard stay
// eager — every authenticated session hits Dashboard immediately after
// the silent session-restore, so lazy-loading it would just move the
// waterfall one hop later for zero benefit.
const BillingPage = lazy(() =>
  import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })),
);
const ClientsPage = lazy(() =>
  import('./pages/ClientsPage').then((m) => ({ default: m.ClientsPage })),
);
const ServicesPage = lazy(() =>
  import('./pages/ServicesPage').then((m) => ({ default: m.ServicesPage })),
);
const StaffPage = lazy(() => import('./pages/StaffPage').then((m) => ({ default: m.StaffPage })));
const JobsPage = lazy(() => import('./pages/JobsPage').then((m) => ({ default: m.JobsPage })));
const InvoicesPage = lazy(() =>
  import('./pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
);

/**
 * Gates the authenticated routes: redirects to /login once session
 * restore has resolved to "no session," but renders nothing (rather than
 * redirecting immediately) while it's still in flight — otherwise every
 * page reload would flash the login page before the silent refresh call
 * (see `AuthContext`) has a chance to complete.
 * @param props route guard props
 * @param props.children the element to render when authenticated
 * @returns the children, a loading placeholder, or a redirect to /login
 */
function RequireAuth({ children }: { children: JSX.Element }): JSX.Element | null {
  const { status } = useAuth();
  if (status === 'loading') {
    return null;
  }
  return status === 'authenticated' ? children : <Navigate to="/login" replace />;
}

/**
 * The routing shell: /login, and the protected app (dashboard + billing)
 * behind the shared layout. The lazy-loaded operational pages render
 * inside a single top-level `Suspense` — Login/Dashboard never suspend,
 * so one boundary is enough rather than one per route.
 * @returns the app's route definitions
 */
function AppRoutes(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/billing" element={<BillingPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

/**
 * Root application component.
 * @returns the app wrapped in its providers
 */
export function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
