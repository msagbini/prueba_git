import { useState, type FormEvent, type JSX } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from '../components/ui/AuthCard';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';

/**
 * The login screen. Multi-organization account selection isn't built yet
 * (unlike `apps/mobile`'s `SelectOrganizationScreen`) — this only handles
 * the single-membership path.
 * @returns the login form element
 */
export function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    try {
      const result = await login(email, password);
      if (result.requiresOrganizationSelection) {
        setError('This account belongs to multiple organizations — selection UI is not built yet.');
        return;
      }
      navigate('/');
    } catch {
      setError('Invalid email or password.');
    }
  };

  return (
    <AuthCard title="Sign in to DOS">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
        <p className="text-center text-xs text-gray-500">
          <Link to="/forgot-password" className="underline hover:text-gray-700">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
