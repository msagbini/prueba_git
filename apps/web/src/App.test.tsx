import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/**
 * Builds a fake (unsigned) JWT carrying only the `role` claim `decodeJwtRole` reads.
 * @param role the role claim to embed
 * @returns a JWT-shaped string with a real base64 payload segment
 */
function fakeJwt(role: string): string {
  const payload = btoa(JSON.stringify({ role }));
  return `header.${payload}.signature`;
}

function stubFetch(
  overrides: Record<string, (init?: RequestInit) => Promise<Response>> = {},
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      for (const [match, handler] of Object.entries(overrides)) {
        if (url.includes(match)) return handler(init);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the login page at /login when unauthenticated', async () => {
    stubFetch({
      '/auth/refresh': () => Promise.resolve(jsonResponse({ message: 'no session' }, 401)),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Sign in to DOS')).toBeInTheDocument());
  });

  it('redirects an unauthenticated caller from / to /login', async () => {
    stubFetch({
      '/auth/refresh': () => Promise.resolve(jsonResponse({ message: 'no session' }, 401)),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Sign in to DOS')).toBeInTheDocument());
  });

  it('renders the dashboard behind the shared layout for an authenticated caller', async () => {
    stubFetch({
      '/auth/refresh': () =>
        Promise.resolve(jsonResponse({ accessToken: fakeJwt('OWNER'), refreshToken: 'r1' })),
      '/notifications/unread-count': () => Promise.resolve(jsonResponse({ count: 0 })),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument(),
    );
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /Jobs/ })).toBeInTheDocument();
  });

  it('routes a Client-role caller to the client-portal shortcuts, not the operational ones', async () => {
    stubFetch({
      '/auth/refresh': () =>
        Promise.resolve(jsonResponse({ accessToken: fakeJwt('CLIENT'), refreshToken: 'r1' })),
      '/notifications/unread-count': () => Promise.resolve(jsonResponse({ count: 0 })),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument(),
    );
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /My jobs/ })).toBeInTheDocument();
    expect(within(main).queryByRole('link', { name: /^Clients$/ })).not.toBeInTheDocument();
  });
});
