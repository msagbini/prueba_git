/**
 * Hand-written types mirroring the DOS API's response shapes this app
 * consumes — there's no shared-types package generating these (see
 * `apps/web/src/context/AuthContext.tsx`, which does the same thing).
 * Kept intentionally narrow: only the fields these screens actually use.
 */

export type Role = 'OWNER' | 'ADMIN' | 'DISPATCHER' | 'STAFF' | 'CLIENT';

export interface MembershipSummary {
  organizationId: string;
  organizationName: string;
  role: Role;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export type LoginResponse =
  | { requiresOrganizationSelection: false; tokens: IssuedTokens }
  | {
      requiresOrganizationSelection: true;
      selectionToken: string;
      memberships: MembershipSummary[];
    };

export type JobStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface JobClient {
  id: string;
  name: string;
  primaryContactName: string | null;
  phone: string | null;
  email: string | null;
}

export interface JobServiceAddress {
  id: string;
  label: 'BILLING' | 'SERVICE';
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface JobServiceLineItem {
  id: string;
  quantity: string;
  unitPriceSnapshot: string;
  notes: string | null;
  service: { id: string; name: string };
}

/** A page of results, as every DOS list endpoint (`GET /jobs`, etc.) returns since Fase 9's pagination pass. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A job as returned by `GET /jobs`/`GET /jobs/:id` — see `modules/jobs/jobs.service.ts`'s `JOB_DETAILS_INCLUDE`. */
export interface Job {
  id: string;
  status: JobStatus;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  notes: string | null;
  client: JobClient;
  serviceAddress: JobServiceAddress | null;
  jobServices: JobServiceLineItem[];
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

/** An invoice as returned by `GET /invoices` — used by the CLIENT-role portal screens. */
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
