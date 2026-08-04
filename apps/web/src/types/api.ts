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

/** A page of results, as every DOS list endpoint returns since Fase 9's pagination pass. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ClientType = 'RESIDENTIAL' | 'COMMERCIAL';
export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  primaryContactName: string | null;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  notes: string | null;
  createdAt: string;
}

export interface ClientAddress {
  id: string;
  label: 'BILLING' | 'SERVICE';
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
}

export type PricingType = 'HOURLY' | 'FIXED' | 'PER_UNIT';

export interface Service {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  pricingType: PricingType;
  unitLabel: string | null;
  basePrice: string;
  isActive: boolean;
}

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
}

export type StaffStatus = 'ACTIVE' | 'INACTIVE';

export interface StaffProfile {
  id: string;
  employeeCode: string | null;
  hourlyRate: string | null;
  hireDate: string | null;
  status: StaffStatus;
  membership: { user: SafeUser };
}
