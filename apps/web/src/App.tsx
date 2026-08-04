import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BillingPage } from './pages/BillingPage';

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
 * behind the shared layout.
 * @returns the app's route definitions
 */
function AppRoutes(): JSX.Element {
  return (
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
        <Route path="/billing" element={<BillingPage />} />
      </Route>
    </Routes>
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
