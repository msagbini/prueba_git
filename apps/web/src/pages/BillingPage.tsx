import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import type { CheckoutSession, Plan, Subscription } from '../types/api';

/**
 * Formats a plan's monthly price for display.
 * @param cents the plan's `priceMonthlyCents`
 * @returns "Free" for 0, otherwise e.g. "$49/mo"
 */
export function formatPrice(cents: number): string {
  if (cents === 0) {
    return 'Free';
  }
  return `$${(cents / 100).toFixed(0)}/mo`;
}

/**
 * Formats a plan limit for display.
 * @param limit the raw limit value (`null` means unlimited)
 * @param label what's being counted (e.g. "clients")
 * @returns e.g. "10 clients" or "Unlimited clients"
 */
export function formatLimit(limit: number | null, label: string): string {
  return limit === null ? `Unlimited ${label}` : `${limit} ${label}`;
}

/**
 * DOS's own billing — the caller's active organization's subscription
 * and the available plans to upgrade to, via `modules/billing` (Fase 4).
 * Handles the Stripe Checkout redirect round trip: `STRIPE_CHECKOUT_
 * SUCCESS_URL`/`_CANCEL_URL` both point back at this page
 * (`/billing?checkout=success|canceled`, see `apps/api/.env.example`),
 * so a `checkout` query param here means the caller is returning from
 * Stripe, not just navigating to this page directly.
 * @returns the billing page element
 */
export function BillingPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [upgradingCode, setUpgradingCode] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const checkoutResult = searchParams.get('checkout');

  useEffect(() => {
    load();
  }, []);

  const load = async (): Promise<void> => {
    try {
      const [sub, planList] = await Promise.all([
        apiFetch<Subscription>('/organizations/me/subscription'),
        apiFetch<Plan[]>('/plans'),
      ]);
      setSubscription(sub);
      setPlans(planList);
    } catch {
      setLoadError('Could not load billing information.');
    }
  };

  const dismissCheckoutBanner = (): void => {
    searchParams.delete('checkout');
    setSearchParams(searchParams, { replace: true });
  };

  const handleUpgrade = async (planCode: string): Promise<void> => {
    setUpgradeError(null);
    setUpgradingCode(planCode);
    try {
      const session = await apiFetch<CheckoutSession>('/organizations/me/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({ planCode }),
      });
      window.location.href = session.checkoutUrl;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setUpgradeError("Billing isn't configured on this deployment yet — check back soon.");
      } else if (err instanceof ApiError && err.status === 403) {
        setUpgradeError('Only an Owner or Admin can change the plan.');
      } else {
        setUpgradeError('Could not start checkout. Try again.');
      }
      setUpgradingCode(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Billing</h1>

      {checkoutResult === 'success' && (
        <div className="mt-4 flex items-center justify-between rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>Checkout complete — your plan will update once Stripe confirms the payment.</span>
          <button onClick={dismissCheckoutBanner} className="font-medium underline">
            Dismiss
          </button>
        </div>
      )}
      {checkoutResult === 'canceled' && (
        <div className="mt-4 flex items-center justify-between rounded border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-700">
          <span>Checkout canceled — your plan hasn&apos;t changed.</span>
          <button onClick={dismissCheckoutBanner} className="font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {loadError && <p className="mt-4 text-sm text-red-600">{loadError}</p>}

      {subscription && (
        <p className="mt-4 text-sm text-gray-600">
          Current plan: <span className="font-medium text-gray-900">{subscription.plan.name}</span>{' '}
          <span className="text-gray-500">({subscription.status})</span>
        </p>
      )}

      {upgradeError && <p className="mt-4 text-sm text-red-600">{upgradeError}</p>}

      {plans && subscription && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === subscription.plan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-lg border p-5 ${isCurrent ? 'border-gray-900' : 'border-gray-200'}`}
              >
                <h2 className="text-sm font-semibold text-gray-900">{plan.name}</h2>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatPrice(plan.priceMonthlyCents)}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-gray-600">
                  <li>{formatLimit(plan.maxClients, 'clients')}</li>
                  <li>{formatLimit(plan.maxActiveJobs, 'active jobs')}</li>
                  <li>{formatLimit(plan.maxStaff, 'staff')}</li>
                </ul>
                {isCurrent ? (
                  <p className="mt-4 text-xs font-medium text-gray-500">Current plan</p>
                ) : plan.code !== 'FREE' ? (
                  <button
                    onClick={() => handleUpgrade(plan.code)}
                    disabled={upgradingCode !== null}
                    className="mt-4 w-full rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                  >
                    {upgradingCode === plan.code ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
