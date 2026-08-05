import { useState, type FormEvent, type JSX } from 'react';
import { Link } from 'react-router';
import { apiFetch } from '../api/client';
import { AuthCard } from '../components/ui/AuthCard';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';

/**
 * Requests a password-reset email. The API always responds the same way
 * regardless of whether the address has an account (see
 * `AuthService.forgotPassword`) — this page mirrors that: the success
 * message never confirms or denies the email exists.
 * @returns the forgot-password form element
 */
export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    } finally {
      // Always show the same outcome, success or failure — matching the
      // API's own "never reveal whether the address exists" behavior.
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-gray-600">
          If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a
          link to reset your password.
        </p>
        <Link
          to="/login"
          className="block text-center text-xs text-gray-500 underline hover:text-gray-700"
        >
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <p className="text-center text-xs text-gray-500">
          <Link to="/login" className="underline hover:text-gray-700">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
