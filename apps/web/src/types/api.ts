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
  membershipId: string;
  employeeCode: string | null;
  hourlyRate: string | null;
  hireDate: string | null;
  status: StaffStatus;
  membership: { user: SafeUser };
}

export type JobStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface JobServiceLine {
  id: string;
  quantity: string;
  service: { id: string; name: string };
}

export interface JobAssignment {
  id: string;
  status: 'ASSIGNED' | 'CONFIRMED' | 'DECLINED';
  membership: { id: string; user: SafeUser };
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
}

export interface InvoiceWithLineItems extends Invoice {
  lineItems: InvoiceLineItem[];
}

export type PaymentMethod = 'CASH' | 'CHECK' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paidAt: string | null;
  referenceNumber: string | null;
}

export interface Job {
  id: string;
  clientId: string;
  serviceAddressId: string | null;
  status: JobStatus;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  notes: string | null;
  client: { id: string; name: string };
  serviceAddress: ClientAddress | null;
  jobServices: JobServiceLine[];
  assignments: JobAssignment[];
}

export interface InvitationPreview {
  organizationName: string;
  role: string;
  invitedByName: string;
  email: string;
}

export type NotificationType = 'JOB_ASSIGNED' | 'JOB_REMINDER';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}
