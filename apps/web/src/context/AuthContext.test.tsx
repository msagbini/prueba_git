import { StrictMode, type JSX } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

/**
 * Builds a syntactically valid JWT with the given payload — signature is
 * irrelevant, `AuthContext` never verifies it (see `decodeJwtRole`).
 * @param payload the claims to encode
 * @returns a three-segment `header.payload.signature` string
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.signature`;
}

/**
 * Renders the current auth status and role as text, for assertions.
 * @returns the status/role text element
 */
function StatusProbe(): JSX.Element {
  const { status, role } = useAuth();
  return (
    <span>
      status:{status} role:{role ?? 'none'}
    </span>
  );
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores an authenticated session when the refresh cookie is valid, decoding role from the token', async () => {
    const accessToken = fakeJwt({ sub: 'u1', role: 'CLIENT' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken, refreshToken: 'b' }), { status: 200 }),
    );

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('status:loading role:none')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('status:authenticated role:CLIENT')).toBeInTheDocument(),
    );
  });

  it('fires exactly one POST /auth/refresh even under StrictMode’s dev-mode double-invoke of mount effects', async () => {
    // Regression test for a real bug: StrictMode double-invoking the
    // mount effect fired two concurrent POST /auth/refresh calls
    // sharing one not-yet-rotated cookie, tripping the server's
    // refresh-token reuse-detection defense and silently logging a
    // freshly-loaded page back out. See restoreStarted's jsdoc in
    // AuthContext.tsx.
    const accessToken = fakeJwt({ sub: 'u1', role: 'OWNER' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken, refreshToken: 'b' }), { status: 200 }),
      );

    render(
      <StrictMode>
        <AuthProvider>
          <StatusProbe />
        </AuthProvider>
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getByText('status:authenticated role:OWNER')).toBeInTheDocument(),
    );

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('falls back to unauthenticated when there is no valid session to restore', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'No refresh token provided.' }), { status: 400 }),
    );

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('status:unauthenticated role:none')).toBeInTheDocument(),
    );
  });

  it('setSession() adopts a session issued outside login(), e.g. from accepting an invitation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'No refresh token provided.' }), { status: 400 }),
    );

    function SetSessionProbe(): JSX.Element {
      const { setSession } = useAuth();
      return (
        <button onClick={() => setSession(fakeJwt({ sub: 'u2', role: 'OWNER' }))}>adopt</button>
      );
    }

    render(
      <AuthProvider>
        <StatusProbe />
        <SetSessionProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('status:unauthenticated role:none')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'adopt' }));

    await waitFor(() =>
      expect(screen.getByText('status:authenticated role:OWNER')).toBeInTheDocument(),
    );
  });
});
