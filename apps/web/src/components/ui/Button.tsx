import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-gray-900 text-white hover:bg-gray-800',
  secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

/**
 * Shared button style — every operational page (clients, jobs, staff,
 * ...) uses this instead of hand-rolled classes.
 * @param props standard button attributes plus a style `variant`
 * @param props.variant visual style — `primary` (default), `secondary`, or `danger`
 * @param props.className extra classes merged onto the base style
 * @returns the button element
 */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
