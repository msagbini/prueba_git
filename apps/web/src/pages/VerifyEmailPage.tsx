import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { AuthCard } from '../components/ui/AuthCard';

type Status = 'verifying' | 'verified' | 'error';

/**
 * Confirms the email-verification token from a `/verify-email?token=...`
 * link (see `SmtpEmailService.sendVerificationEmail`) — no form, just
 * fires the request on mount.
 * @returns the verification status element
 */
export function VerifyEmailPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error');

  useEffect(() => {
    if (!token) return;
    apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setStatus('verified'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <AuthCard title="Email verification">
      {status === 'verifying' && <p className="text-sm text-gray-600">Verifying your email…</p>}
      {status === 'verified' && (
        <>
          <p className="text-sm text-gray-600">Your email is verified.</p>
          <Link
            to="/login"
            className="block text-center text-xs text-gray-500 underline hover:text-gray-700"
          >
            Sign in
          </Link>
        </>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-600">
          This link is invalid or has expired. Sign in and check your account settings to request a
          new one.
        </p>
      )}
    </AuthCard>
  );
}
