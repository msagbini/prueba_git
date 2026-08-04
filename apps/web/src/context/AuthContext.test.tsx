import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

/**
 * Renders the current auth status as text, for assertions.
 * @returns the status text element
 */
function StatusProbe(): JSX.Element {
  const { status } = useAuth();
  return <span>status:{status}</span>;
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores an authenticated session when the refresh cookie is valid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'b' }), { status: 200 }),
    );

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('status:loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('status:authenticated')).toBeInTheDocument());
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

    await waitFor(() => expect(screen.getByText('status:unauthenticated')).toBeInTheDocument());
  });
});
