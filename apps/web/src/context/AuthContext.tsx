import { createContext, useContext, useState, type ReactNode } from 'react';
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

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Minimal auth state for this Fase 2 scaffold — holds whether the app has
 * an access token in memory and exposes `login`/`logout`. Session restore
 * on reload, the organization-selection UI for multi-membership accounts,
 * and switch-organization are all Fase 5/6 work; see
 * docs/architecture/auth.md for the flows this will eventually cover.
 * @param props the provider's props
 * @param props.children the subtree that gets access to the auth context
 * @returns the provider element
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    const result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!result.requiresOrganizationSelection) {
      setAccessToken(result.tokens.accessToken);
      setIsAuthenticated(true);
    }
    return result;
  };

  const logout = (): void => {
    setAccessToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
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
