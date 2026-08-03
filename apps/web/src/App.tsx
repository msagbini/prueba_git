import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

/**
 * Redirects to /login unless the in-memory session is authenticated.
 * Session persistence across reloads is Fase 5 work.
 * @param props route guard props
 * @param props.children the element to render when authenticated
 * @returns the children, or a redirect to /login
 */
function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * The routing shell: /login and a protected / (dashboard).
 * @returns the app's route definitions
 */
function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
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
