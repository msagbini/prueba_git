import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from '../components/ui/AuthCard';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import type { InvitationPreview } from '../types/api';

/**
 * Accepts an organization invitation from an
 * `/accept-invitation/:token` link (see
 * `SmtpEmailService.sendInvitationEmail`). Branches the same way the API
 * does (`AuthService.acceptInvitation`): a caller with an active session
 * accepts directly (their existing account just gets a new membership);
 * everyone else fills in a name/password to create the account the
 * invited email doesn't have yet.
 * @returns the accept-invitation element
 */
export function AcceptInvitationPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, setSession } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<InvitationPreview>(`/invitations/${token}`)
      .then(setPreview)
      .catch(() => setPreviewError('This invitation link is invalid or has expired.'));
  }, [token]);

  const handleAccept = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!token) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const body = isAuthenticated ? {} : form;
      const tokens = await apiFetch<{ accessToken: string }>(`/invitations/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSession(tokens.accessToken);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError(
          'An account with this email already exists. Log in, then revisit this link.',
        );
      } else if (
        err instanceof ApiError &&
        typeof err.body === 'object' &&
        err.body &&
        'message' in err.body
      ) {
        setSubmitError(String((err.body as { message: unknown }).message));
      } else {
        setSubmitError('Could not accept this invitation.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (previewError) {
    return (
      <AuthCard title="Invitation">
        <p className="text-sm text-red-600">{previewError}</p>
      </AuthCard>
    );
  }

  if (!preview) {
    return (
      <AuthCard title="Invitation">
        <p className="text-sm text-gray-600">Loading…</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="You're invited">
      <p className="text-sm text-gray-600">
        <span className="font-medium text-gray-900">{preview.invitedByName}</span> invited{' '}
        <span className="font-medium text-gray-900">{preview.email}</span> to join{' '}
        <span className="font-medium text-gray-900">{preview.organizationName}</span> as{' '}
        {preview.role}.
      </p>

      <form onSubmit={handleAccept} className="flex flex-col gap-4">
        {!isAuthenticated && (
          <>
            <Field
              label="First name"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <Field
              label="Last name"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
            <Field
              label="Password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </>
        )}
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Joining…' : 'Accept invitation'}
        </Button>
        {!isAuthenticated && (
          <p className="text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="underline hover:text-gray-700">
              Log in first
            </Link>
            , then revisit this link.
          </p>
        )}
      </form>
    </AuthCard>
  );
}
