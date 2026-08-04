/**
 * Hand-written types mirroring the DOS API's response shapes this app
 * consumes — there's no shared-types package generating these (matches
 * `apps/mobile/src/types/api.ts`, which does the same thing for the same
 * reason). Kept narrow: only the fields these pages actually use.
 */

export type PlanCode = 'FREE' | 'PRO' | 'BUSINESS';

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  description: string | null;
  priceMonthlyCents: number;
  maxClients: number | null;
  maxActiveJobs: number | null;
  maxStaff: number | null;
}

export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED';

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  plan: Plan;
}

export interface CheckoutSession {
  checkoutUrl: string;
}
