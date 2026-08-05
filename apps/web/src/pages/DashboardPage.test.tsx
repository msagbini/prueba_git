import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('DashboardPage', () => {
  it('shows the operational shortcuts for a non-Client role', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      isAuthenticated: true,
      role: 'OWNER',
      login: vi.fn(),
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    for (const label of ['Clients', 'Services', 'Staff', 'Jobs', 'Invoices', 'Billing']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('shows the client-portal shortcuts for a Client role', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'authenticated',
      isAuthenticated: true,
      role: 'CLIENT',
      login: vi.fn(),
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /My jobs/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My invoices/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Clients/ })).not.toBeInTheDocument();
  });
});
