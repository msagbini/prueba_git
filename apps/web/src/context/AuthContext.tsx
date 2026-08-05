import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type JSX,
} from 'react';
import { apiFetch, decodeJwtRole, setAccessToken } from '../api/client';

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
  /** The caller's role in their active organization (e.g. "CLIENT"), or null before a session exists. */
  role: string | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  /**
   * Adopts a session whose access token was issued outside `login()` —
   * currently only `AcceptInvitationPage`, whose
   * `POST /invitations/:token/accept` returns tokens directly. Without
   * this, that page's own `setAccessToken` call (in `api/client.ts`)
   * would leave this context's `status` stuck on `unauthenticated`, and
   * `RequireAuth` would bounce the caller straight back to /login.
   * @param accessToken the freshly issued access token
   */
  setSession: (accessToken: string) => void;
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
  const [role, setRole] = useState<string | null>(null);
  // StrictMode double-invokes a mount effect in dev (mount → cleanup →
  // mount again) to surface impure effects — this one has no cleanup,
  // so without this guard it fires two concurrent POST /auth/refresh
  // calls sharing the same not-yet-rotated cookie. The server treats
  // the second arrival as reuse of an already-rotated token (correct
  // behavior for real token theft — see ADR 0004) and revokes the
  // whole family, silently logging the caller back out on their very
  // first page load. A ref survives StrictMode's simulated remount
  // (only the effect body re-runs, component state doesn't reset), so
  // it reliably limits the actual restore-session work to one call.
  const restoreStarted = useRef(false);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    apiFetch<LoginTokens>('/auth/refresh', { method: 'POST', body: JSON.stringify({}) })
      .then((tokens) => {
        setAccessToken(tokens.accessToken);
        setRole(decodeJwtRole(tokens.accessToken));
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
      setRole(decodeJwtRole(result.tokens.accessToken));
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
    setRole(null);
    setStatus('unauthenticated');
  };

  const setSession = (accessToken: string): void => {
    setAccessToken(accessToken);
    setRole(decodeJwtRole(accessToken));
    setStatus('authenticated');
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        isAuthenticated: status === 'authenticated',
        role,
        login,
        logout,
        setSession,
      }}
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
