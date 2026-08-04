import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { AuthCard } from '../components/ui/AuthCard';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';

/**
 * Sets a new password from the token in a `/reset-password?token=...`
 * link (see `SmtpEmailService.sendPasswordResetEmail`).
 * @returns the reset-password form element
 */
export function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError('This link is invalid or has expired — request a new one.');
      } else {
        setError('Could not reset your password. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <p className="text-sm text-gray-600">
          This password reset link is missing its token. Request a new one from the{' '}
          <Link to="/forgot-password" className="underline hover:text-gray-700">
            forgot password
          </Link>{' '}
          page.
        </p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <p className="text-sm text-gray-600">Your password has been reset.</p>
        <Button className="w-full" onClick={() => navigate('/login')}>
          Sign in
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="New password"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Reset password'}
        </Button>
      </form>
    </AuthCard>
  );
}
