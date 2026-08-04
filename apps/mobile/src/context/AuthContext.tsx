import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiFetch, decodeJwtRole, setAccessToken } from '../api/client';
import { clearTokens, loadTokens, saveTokens } from '../auth/tokenStorage';
import type { IssuedTokens, LoginResponse, MembershipSummary } from '../types/api';

/** The pending multi-organization selection step, after a login that returned it. */
interface PendingSelection {
  selectionToken: string;
  memberships: MembershipSummary[];
}

type AuthStatus = 'loading' | 'unauthenticated' | 'needsOrganizationSelection' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  pendingSelection: PendingSelection | null;
  /** The caller's role in their active organization (e.g. "CLIENT"), or null before a session exists. */
  role: string | null;
  login: (email: string, password: string) => Promise<void>;
  selectOrganization: (organizationId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Session state for the mobile app. Unlike `apps/web` (access token held
 * in memory only, refresh token in an httpOnly cookie the SPA never
 * touches), the mobile client persists both tokens itself in the
 * platform secure storage (`src/auth/tokenStorage.ts`) — see
 * docs/architecture/auth.md's mobile token-storage section — and
 * restores the session on launch by immediately rotating the stored
 * refresh token, rather than trusting a possibly-expired stored access
 * token (15 minute lifetime; the app is very likely to have been closed
 * longer than that between launches).
 * @param props the provider's props
 * @param props.children the subtree that gets access to the auth context
 * @returns the provider element
 */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  // Guards against restoreSession() ever firing twice concurrently for
  // one real mount (e.g. if StrictMode's dev-mode double-invoke of
  // mount effects is enabled here in the future, as it already was in
  // apps/web — see AuthContext.tsx there for the bug this caused: two
  // concurrent POST /auth/refresh calls sharing the same not-yet-
  // rotated token trip the server's reuse-detection defense and revoke
  // the whole token family, silently logging the caller back out). A
  // ref survives a simulated remount (only the effect body re-runs,
  // component state doesn't reset), so it reliably limits the actual
  // restore-session work to one call per real mount.
  const restoreStarted = useRef(false);

  // Deliberately run-once-on-mount: restoreSession only touches state
  // through setters, which are stable across renders, so it doesn't
  // belong in the dependency array below.
  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreSession = async (): Promise<void> => {
    const stored = await loadTokens();
    if (!stored) {
      setStatus('unauthenticated');
      return;
    }
    try {
      const fresh = await apiFetch<IssuedTokens>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      await applyTokens(fresh);
    } catch {
      // Refresh token expired, revoked, or reused (theft detection) —
      // start over rather than get stuck on a session that can't work.
      await clearTokens();
      setStatus('unauthenticated');
    }
  };

  const applyTokens = async (tokens: IssuedTokens): Promise<void> => {
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    setRole(decodeJwtRole(tokens.accessToken));
    await saveTokens(tokens);
    setPendingSelection(null);
    setStatus('authenticated');
  };

  const login = async (email: string, password: string): Promise<void> => {
    const result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.requiresOrganizationSelection) {
      setPendingSelection({
        selectionToken: result.selectionToken,
        memberships: result.memberships,
      });
      setStatus('needsOrganizationSelection');
      return;
    }
    await applyTokens(result.tokens);
  };

  const selectOrganization = async (organizationId: string): Promise<void> => {
    if (!pendingSelection) {
      throw new Error('selectOrganization called with no pending selection.');
    }
    const tokens = await apiFetch<IssuedTokens>('/auth/select-organization', {
      method: 'POST',
      body: JSON.stringify({ selectionToken: pendingSelection.selectionToken, organizationId }),
    });
    await applyTokens(tokens);
  };

  const logout = async (): Promise<void> => {
    if (refreshToken) {
      // Best-effort — the session is cleared locally either way.
      try {
        await apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } catch {
        // Ignore — the tokens are being discarded regardless.
      }
    }
    setAccessToken(null);
    setRefreshToken(null);
    setPendingSelection(null);
    setRole(null);
    await clearTokens();
    setStatus('unauthenticated');
  };

  return (
    <AuthContext.Provider
      value={{ status, pendingSelection, role, login, selectOrganization, logout }}
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
