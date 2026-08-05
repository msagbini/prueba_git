import type { JSX } from 'react';
import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  children: ReactNode;
}

/**
 * The centered white-card-on-gray layout every unauthenticated page
 * (login, verify email, reset password, accept invitation) shares —
 * factored out once a fourth page needed the exact same shell.
 * @param props the card's heading and body content
 * @param props.title the card's heading
 * @param props.children the card's body content
 * @returns the auth card element
 */
export function AuthCard({ title, children }: AuthCardProps): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}
