import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingPage, formatLimit, formatPrice } from './BillingPage';
import type { Plan, Subscription } from '../types/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const FREE_PLAN: Plan = {
  id: 'p1',
  code: 'FREE',
  name: 'Free',
  description: null,
  priceMonthlyCents: 0,
  maxClients: 10,
  maxActiveJobs: 5,
  maxStaff: 2,
};

const PRO_PLAN: Plan = {
  id: 'p2',
  code: 'PRO',
  name: 'Pro',
  description: null,
  priceMonthlyCents: 4900,
  maxClients: null,
  maxActiveJobs: null,
  maxStaff: null,
};

const SUBSCRIPTION: Subscription = {
  id: 'sub1',
  status: 'ACTIVE',
  currentPeriodEnd: null,
  plan: FREE_PLAN,
};

function stubFetch(
  overrides: Record<string, (init?: RequestInit) => Promise<Response>> = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [match, handler] of Object.entries(overrides)) {
      if (url.includes(match)) return handler(init);
    }
    if (url.includes('/organizations/me/subscription') && !init?.method)
      return Promise.resolve(jsonResponse(SUBSCRIPTION));
    if (url.includes('/plans')) return Promise.resolve(jsonResponse([FREE_PLAN, PRO_PLAN]));
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderAt(path: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BillingPage />
    </MemoryRouter>,
  );
}

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

describe('BillingPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the current plan and the plan grid', async () => {
    stubFetch();

    renderAt('/billing');

    await waitFor(() => expect(screen.getByText('Current plan')).toBeInTheDocument());
    expect(screen.getByText('$49/mo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeInTheDocument();
  });

  it('shows a load error when the request fails', async () => {
    stubFetch({ '/plans': () => Promise.resolve(jsonResponse({ message: 'err' }, 500)) });

    renderAt('/billing');

    await waitFor(() =>
      expect(screen.getByText('Could not load billing information.')).toBeInTheDocument(),
    );
  });

  it('shows the success banner and dismisses it', async () => {
    stubFetch();

    renderAt('/billing?checkout=success');

    await waitFor(() =>
      expect(
        screen.getByText(
          'Checkout complete — your plan will update once Stripe confirms the payment.',
        ),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() =>
      expect(
        screen.queryByText(
          'Checkout complete — your plan will update once Stripe confirms the payment.',
        ),
      ).not.toBeInTheDocument(),
    );
  });

  it('shows the canceled banner', async () => {
    stubFetch();

    renderAt('/billing?checkout=canceled');

    await waitFor(() =>
      expect(screen.getByText("Checkout canceled — your plan hasn't changed.")).toBeInTheDocument(),
    );
  });

  it('starts checkout and redirects to the returned URL on upgrade', async () => {
    stubFetch({
      '/subscription/checkout': () =>
        Promise.resolve(jsonResponse({ checkoutUrl: 'https://checkout.stripe.com/session123' })),
    });
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });

    renderAt('/billing');
    await waitFor(() => expect(screen.getByText('Current plan')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));

    await waitFor(() =>
      expect(window.location.href).toBe('https://checkout.stripe.com/session123'),
    );

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("shows a 503 error when billing isn't configured", async () => {
    stubFetch({
      '/subscription/checkout': () => Promise.resolve(jsonResponse({ message: 'no stripe' }, 503)),
    });

    renderAt('/billing');
    await waitFor(() => expect(screen.getByText('Current plan')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));

    await waitFor(() =>
      expect(
        screen.getByText("Billing isn't configured on this deployment yet — check back soon."),
      ).toBeInTheDocument(),
    );
  });

  it('shows a 403 error when the caller lacks permission to change the plan', async () => {
    stubFetch({
      '/subscription/checkout': () => Promise.resolve(jsonResponse({ message: 'forbidden' }, 403)),
    });

    renderAt('/billing');
    await waitFor(() => expect(screen.getByText('Current plan')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));

    await waitFor(() =>
      expect(screen.getByText('Only an Owner or Admin can change the plan.')).toBeInTheDocument(),
    );
  });
});
