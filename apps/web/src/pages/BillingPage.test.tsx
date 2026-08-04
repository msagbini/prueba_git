import { describe, expect, it } from 'vitest';
import { formatLimit, formatPrice } from './BillingPage';

describe('formatPrice', () => {
  it('shows "Free" for a zero-cost plan', () => {
    expect(formatPrice(0)).toBe('Free');
  });

  it('formats cents as a rounded monthly dollar amount', () => {
    expect(formatPrice(4900)).toBe('$49/mo');
    expect(formatPrice(14900)).toBe('$149/mo');
  });
});

describe('formatLimit', () => {
  it('shows "Unlimited <label>" for a null limit', () => {
    expect(formatLimit(null, 'clients')).toBe('Unlimited clients');
  });

  it('shows the concrete number otherwise', () => {
    expect(formatLimit(10, 'clients')).toBe('10 clients');
  });
});
