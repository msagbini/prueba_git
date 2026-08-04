import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, setAccessToken } from '../api/client';

interface LoginTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginRequiresSelection {
  requiresOrganizationSelection: true;
  selectionToken: string;
  memberships: { organizationId: string; organizationName: string; role: string }[];
}

type LoginResponse =
  ({ requiresOrganizationSelection: false } & { tokens: LoginTokens }) | LoginRequiresSelection;

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth state for the SPA. The access token lives in memory only (never
 * `localStorage`, to limit XSS blast radius — see docs/architecture/
 * auth.md); the refresh token is an httpOnly cookie the SPA never reads
 * directly. Session restore on boot works by attempting one silent
 * `POST /auth/refresh` — the browser sends the cookie automatically —
 * rather than trusting nothing and forcing a re-login on every page
 * reload. Multi-organization account selection is not implemented yet
 * (`login` still surfaces `requiresOrganizationSelection` for the
 * caller to handle; `LoginPage` currently shows an error for that case).
 * @param props the provider's props
 * @param props.children the subtree that gets access to the auth context
 * @returns the provider element
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    apiFetch<LoginTokens>('/auth/refresh', { method: 'POST', body: JSON.stringify({}) })
      .then((tokens) => {
        setAccessToken(tokens.accessToken);
        setStatus('authenticated');
      })
      .catch(() => {
        setStatus('unauthenticated');
      });
  }, []);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    const result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!result.requiresOrganizationSelection) {
      setAccessToken(result.tokens.accessToken);
      setStatus('authenticated');
    }
    return result;
  };

  const logout = async (): Promise<void> => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } catch {
      // Ignore — the local session is cleared regardless.
    }
    setAccessToken(null);
    setStatus('unauthenticated');
  };

  return (
    <AuthContext.Provider
      value={{ status, isAuthenticated: status === 'authenticated', login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Reads the current auth context.
 * @returns the current auth context; throws if used outside an AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
