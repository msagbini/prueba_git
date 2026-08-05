import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function renderLayout(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<p>page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ count: 0 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the full operational nav for a non-Client role', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      isAuthenticated: true,
      role: 'OWNER',
      login: vi.fn(),
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    renderLayout();

    for (const label of [
      'Dashboard',
      'Clients',
      'Services',
      'Staff',
      'Jobs',
      'Invoices',
      'Billing',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders the short Client nav for a Client role', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      isAuthenticated: true,
      role: 'CLIENT',
      login: vi.fn(),
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    renderLayout();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My jobs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My invoices' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Billing' })).not.toBeInTheDocument();
  });

  it('calls logout when "Sign out" is clicked', () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      isAuthenticated: true,
      role: 'OWNER',
      login: vi.fn(),
      logout,
      setSession: vi.fn(),
    });

    renderLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(logout).toHaveBeenCalled();
  });
});
