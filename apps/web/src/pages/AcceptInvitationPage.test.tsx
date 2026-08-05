import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvitationPage } from './AcceptInvitationPage';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function renderPage(authenticated: boolean, setSession = vi.fn()): void {
  vi.mocked(useAuth).mockReturnValue({
    status: authenticated ? 'authenticated' : 'unauthenticated',
    isAuthenticated: authenticated,
    role: authenticated ? 'STAFF' : null,
    login: vi.fn(),
    logout: vi.fn(),
    setSession,
  });

  render(
    <MemoryRouter initialEntries={['/accept-invitation/tok123']}>
      <Routes>
        <Route path="/accept-invitation/:token" element={<AcceptInvitationPage />} />
        <Route path="/" element={<p>dashboard</p>} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const PREVIEW = {
  organizationName: 'Acme Cleaning',
  role: 'STAFF',
  invitedByName: 'Owner Person',
  email: 'invitee@test.local',
};

describe('AcceptInvitationPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error when the preview request fails (invalid/expired link)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'not found' }, 404)));

    renderPage(false);

    await waitFor(() =>
      expect(
        screen.getByText('This invitation link is invalid or has expired.'),
      ).toBeInTheDocument(),
    );
  });

  it('shows the name/password form for an unauthenticated visitor and accepts', async () => {
    const setSession = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/tok123')) return Promise.resolve(jsonResponse(PREVIEW));
        if (url.endsWith('/accept'))
          return Promise.resolve(jsonResponse({ accessToken: 'tok-abc' }, 201));
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    renderPage(false, setSession);

    await waitFor(() => expect(screen.getByText("You're invited")).toBeInTheDocument());
    expect(screen.getByText('Acme Cleaning')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secretpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));

    await waitFor(() => expect(setSession).toHaveBeenCalledWith('tok-abc'));
    await waitFor(() => expect(screen.getByText('dashboard')).toBeInTheDocument());
  });

  it('skips the name/password form for an already-authenticated caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/tok123')) return Promise.resolve(jsonResponse(PREVIEW));
        if (url.endsWith('/accept'))
          return Promise.resolve(jsonResponse({ accessToken: 'tok-abc' }, 201));
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    renderPage(true);

    await waitFor(() => expect(screen.getByText("You're invited")).toBeInTheDocument());
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
  });

  it('shows a specific message on a 409 (account already exists)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/tok123')) return Promise.resolve(jsonResponse(PREVIEW));
        if (url.endsWith('/accept'))
          return Promise.resolve(jsonResponse({ message: 'conflict' }, 409));
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    renderPage(false);
    await waitFor(() => expect(screen.getByText("You're invited")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secretpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'An account with this email already exists. Log in, then revisit this link.',
        ),
      ).toBeInTheDocument(),
    );
  });
});
