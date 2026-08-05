import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>dashboard</p>} />
        <Route path="/forgot-password" element={<p>forgot password page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('submits the entered credentials and navigates to / on success', async () => {
    const login = vi.fn().mockResolvedValue({ requiresOrganizationSelection: false });
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      isAuthenticated: false,
      role: null,
      login,
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@test.local' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('owner@test.local', 'secret'));
    await waitFor(() => expect(screen.getByText('dashboard')).toBeInTheDocument());
  });

  it('shows an error message when login rejects', async () => {
    const login = vi.fn().mockRejectedValue(new Error('bad credentials'));
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      isAuthenticated: false,
      role: null,
      login,
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@test.local' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('Invalid email or password.')).toBeInTheDocument());
  });

  it('shows a not-yet-built message when the account requires organization selection', async () => {
    const login = vi.fn().mockResolvedValue({
      requiresOrganizationSelection: true,
      selectionToken: 'tok',
      memberships: [],
    });
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      isAuthenticated: false,
      role: null,
      login,
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'multi@test.local' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'This account belongs to multiple organizations — selection UI is not built yet.',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('links to the forgot-password page', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      isAuthenticated: false,
      role: null,
      login: vi.fn(),
      logout: vi.fn(),
      setSession: vi.fn(),
    });

    renderLoginPage();
    fireEvent.click(screen.getByRole('link', { name: 'Forgot your password?' }));

    expect(screen.getByText('forgot password page')).toBeInTheDocument();
  });
});
