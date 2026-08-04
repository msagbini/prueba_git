import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import Stripe from 'stripe';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/modules/auth/email/email.service';

/**
 * A locally-generated secret, valid only within this test run — Stripe
 * never sees it. It lets the webhook signature-verification path (real
 * `stripe.webhooks.constructEvent`, not a mock) be exercised without a
 * real Stripe account: `Stripe.webhooks.generateTestHeaderString` signs a
 * payload the exact same way Stripe's servers would, using this secret.
 */
const STRIPE_WEBHOOK_SECRET = 'whsec_e2e_test_secret';

/**
 * End-to-end coverage for the Fase 3 business modules, run against a real,
 * fully-booted app and a real Postgres database (no mocks for Prisma/RLS)
 * — the same live-verification approach used throughout this project,
 * turned into a regression suite so CI catches what manual `curl` testing
 * previously caught only once, by hand. Each `it` builds on state from the
 * ones before it (shared `let` variables), mirroring how a real client
 * session actually flows.
 */
describe('business flows (e2e)', () => {
  let app: INestApplication;
  let capturedInvitationToken: string | undefined;

  beforeAll(async () => {
    // Set before the app boots (env is validated once, at ConfigModule
    // construction) so the Stripe webhook signature-verification path is
    // exercisable offline, without real Stripe credentials — see the
    // 'Stripe webhooks' describe block below and docs/technical-log/phase-4.md.
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
    app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    // Capture the raw invitation token instead of parsing console output —
    // ConsoleEmailService (the Fase 2 email stub) only logs it.
    jest
      .spyOn(app.get(EmailService), 'sendInvitationEmail')
      .mockImplementation(async (_to, _orgName, token) => {
        capturedInvitationToken = token;
      });
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  // Unique per run so the suite is safely re-runnable against a
  // non-pristine database (unlike CI, this isn't guaranteed here).
  const runId = Date.now();
  const ownerEmail = `owner-${runId}@e2e-test.local`;
  const staffEmail = `staff-${runId}@e2e-test.local`;
  const portalEmail = `portal-${runId}@e2e-test.local`;
  const otherOwnerEmail = `owner2-${runId}@e2e-test.local`;

  let ownerAccessToken: string;
  let organizationId: string;
  let clientAId: string;
  let clientBId: string;
  let jobAId: string;
  let serviceId: string;
  let staffAccessToken: string;
  let staffMembershipId: string;
  let clientPortalAccessToken: string;
  let invoiceId: string;

  it('signs up an organization and its Owner', async () => {
    const res = await request(server())
      .post('/auth/signup')
      .send({
        organizationName: 'E2E Cleaning Co',
        industryVerticalCode: 'CLEANING',
        ownerEmail,
        ownerFirstName: 'Owa',
        ownerLastName: 'Owner',
        password: 'Sup3rSecret!23',
      })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    ownerAccessToken = res.body.accessToken;

    const me = await request(server())
      .get('/organizations/me')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    organizationId = me.body.id;
    expect(me.body.name).toBe('E2E Cleaning Co');
  });

  it('lists the seeded plans and starts the organization on Free', async () => {
    const plans = await request(server())
      .get('/plans')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    expect(plans.body.map((p: { code: string }) => p.code)).toEqual(['FREE', 'PRO', 'BUSINESS']);

    const subscription = await request(server())
      .get('/organizations/me/subscription')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    expect(subscription.body.plan.code).toBe('FREE');
    expect(subscription.body.status).toBe('ACTIVE');
  });

  it('creates two clients, a service, and a job for the first client', async () => {
    const clientA = await request(server())
      .post('/clients')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'Client A', type: 'RESIDENTIAL' })
      .expect(201);
    clientAId = clientA.body.id;

    const clientB = await request(server())
      .post('/clients')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'Client B', type: 'RESIDENTIAL' })
      .expect(201);
    clientBId = clientB.body.id;

    const service = await request(server())
      .post('/services')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ name: 'Deep Clean', pricingType: 'FIXED', basePrice: 150 })
      .expect(201);
    serviceId = service.body.id;

    const job = await request(server())
      .post('/jobs')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ clientId: clientAId })
      .expect(201);
    jobAId = job.body.id;
    expect(job.body.status).toBe('DRAFT');

    // A second job for Client B, so cross-client visibility can be checked below.
    await request(server())
      .post('/jobs')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ clientId: clientBId })
      .expect(201);
  });

  it('rejects a job for a client that does not belong to the organization', async () => {
    await request(server())
      .post('/jobs')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ clientId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);
  });

  it('snapshots the service price when adding it to a job', async () => {
    const jobService = await request(server())
      .post(`/jobs/${jobAId}/services`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ serviceId, quantity: 1 })
      .expect(201);
    expect(jobService.body.unitPriceSnapshot).toBe('150');
  });

  it('invites and onboards a Staff member, who initially sees no jobs', async () => {
    await request(server())
      .post('/organizations/me/invitations')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: staffEmail, roleCode: 'STAFF' })
      .expect(204);

    expect(capturedInvitationToken).toEqual(expect.any(String));

    const accept = await request(server())
      .post(`/invitations/${capturedInvitationToken}/accept`)
      .send({ firstName: 'Stan', lastName: 'Staffer', password: 'Sup3rSecret!23' })
      .expect(201);
    staffAccessToken = accept.body.accessToken;

    // Accepting a Staff invitation must auto-create a StaffProfile — no
    // POST /staff route exists to do this explicitly.
    const staffList = await request(server())
      .get('/staff')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    expect(staffList.body.items).toHaveLength(1);
    staffMembershipId = staffList.body.items[0].membershipId;

    const jobsAsStaff = await request(server())
      .get('/jobs')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(200);
    expect(jobsAsStaff.body.items).toEqual([]);
  });

  it('shows the job to Staff only after assignment, and blocks Staff from managing it', async () => {
    await request(server())
      .post(`/jobs/${jobAId}/assignments`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ membershipId: staffMembershipId })
      .expect(201);

    const jobsAsStaff = await request(server())
      .get('/jobs')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(200);
    expect(jobsAsStaff.body.items).toHaveLength(1);
    expect(jobsAsStaff.body.items[0].id).toBe(jobAId);

    await request(server())
      .patch(`/jobs/${jobAId}`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);

    // Staff holds neither clients.read nor clients.manage.
    await request(server())
      .get('/clients')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(403);
  });

  it('embeds client/address/service details Staff has no other way to read', async () => {
    const jobsAsStaff = await request(server())
      .get('/jobs')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(200);
    expect(jobsAsStaff.body.items[0].client.name).toBe('Client A');
    expect(jobsAsStaff.body.items[0].jobServices).toHaveLength(1);
  });

  it('lets assigned Staff clock in and out, but not on an unassigned or already-finished job', async () => {
    const started = await request(server())
      .post(`/jobs/${jobAId}/start`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(201);
    expect(started.body.status).toBe('IN_PROGRESS');
    expect(started.body.actualStart).toEqual(expect.any(String));

    const completed = await request(server())
      .post(`/jobs/${jobAId}/complete`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(201);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.actualEnd).toEqual(expect.any(String));

    await request(server())
      .post(`/jobs/${jobAId}/start`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(400);

    const otherJob = await request(server())
      .post('/jobs')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ clientId: clientBId })
      .expect(201);
    await request(server())
      .post(`/jobs/${otherJob.body.id}/start`)
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(404);
  });

  it('never leaks passwordHash through the members list', async () => {
    const members = await request(server())
      .get('/organizations/me/members')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    for (const member of members.body) {
      expect(member.user).not.toHaveProperty('passwordHash');
    }
  });

  it('refuses to demote or remove the organization’s only active Owner', async () => {
    const members = await request(server())
      .get('/organizations/me/members')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    const ownerMembership = members.body.find(
      (m: { role: { code: string } }) => m.role.code === 'OWNER',
    );

    await request(server())
      .patch(`/organizations/me/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ roleCode: 'STAFF' })
      .expect(400);

    await request(server())
      .delete(`/organizations/me/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(400);
  });

  it('requires clientId when inviting a Client, and links the resulting membership to it', async () => {
    await request(server())
      .post('/organizations/me/invitations')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: portalEmail, roleCode: 'CLIENT' })
      .expect(400);

    await request(server())
      .post('/organizations/me/invitations')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: portalEmail, roleCode: 'CLIENT', clientId: clientAId })
      .expect(204);

    const accept = await request(server())
      .post(`/invitations/${capturedInvitationToken}/accept`)
      .send({ firstName: 'Cara', lastName: 'Client', password: 'Sup3rSecret!23' })
      .expect(201);
    clientPortalAccessToken = accept.body.accessToken;

    const jobsAsClient = await request(server())
      .get('/jobs')
      .set('Authorization', `Bearer ${clientPortalAccessToken}`)
      .expect(200);
    // Client A has one job (jobAId); Client B's job must not appear.
    expect(jobsAsClient.body.items).toHaveLength(1);
    expect(jobsAsClient.body.items[0].id).toBe(jobAId);

    await request(server())
      .post(`/jobs/${jobAId}/start`)
      .set('Authorization', `Bearer ${clientPortalAccessToken}`)
      .expect(403);
  });

  it('creates an invoice, recomputes totals from line items, and pays it off', async () => {
    const invoice = await request(server())
      .post('/invoices')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ clientId: clientAId, issueDate: '2026-08-01', dueDate: '2026-08-15' })
      .expect(201);
    invoiceId = invoice.body.id;
    expect(invoice.body.total).toBe('0');

    await request(server())
      .post(`/invoices/${invoiceId}/line-items`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ description: 'Deep clean', quantity: 1, unitPrice: 150 })
      .expect(201);

    const afterLineItem = await request(server())
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    expect(afterLineItem.body.total).toBe('150');
    expect(afterLineItem.body.status).toBe('DRAFT');

    await request(server())
      .post('/payments')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ invoiceId, amount: 150, method: 'CARD' })
      .expect(201);

    const afterPayment = await request(server())
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    expect(afterPayment.body.status).toBe('PAID');

    const invoicesAsClient = await request(server())
      .get('/invoices')
      .set('Authorization', `Bearer ${clientPortalAccessToken}`)
      .expect(200);
    expect(invoicesAsClient.body.items.map((i: { id: string }) => i.id)).toEqual([invoiceId]);
  });

  it('renders the invoice as a real PDF', async () => {
    const pdf = await request(server())
      .get(`/invoices/${invoiceId}/pdf`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('attachment');
    const body = pdf.body as Buffer;
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    await request(server())
      .get('/invoices/00000000-0000-0000-0000-000000000000/pdf')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(404);
  });

  it('records every mutation above in the audit trail', async () => {
    const logs = await request(server())
      .get('/audit-logs')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    const actions = new Set(logs.body.map((entry: { action: string }) => entry.action));
    for (const expectedAction of [
      'client.created',
      'job.created',
      'job_service.created',
      'job_assignment.created',
      'invoice.created',
      'invoice_line_item.created',
      'payment.created',
    ]) {
      expect(actions.has(expectedAction)).toBe(true);
    }
    for (const entry of logs.body) {
      expect(entry.organizationId).toBe(organizationId);
    }
  });

  it('isolates a second organization from the first, even for a raw id lookup', async () => {
    const otherOrg = await request(server())
      .post('/auth/signup')
      .send({
        organizationName: 'Other Org',
        industryVerticalCode: 'CLEANING',
        ownerEmail: otherOwnerEmail,
        ownerFirstName: 'Otto',
        ownerLastName: 'Owner',
        password: 'Sup3rSecret!23',
      })
      .expect(201);
    const otherAccessToken = otherOrg.body.accessToken;

    await request(server())
      .get(`/clients/${clientAId}`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(404);

    await request(server())
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(404);

    await request(server())
      .get(`/invoices/${invoiceId}/pdf`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(404);
  });

  describe('Free plan limits', () => {
    // A dedicated organization so these limits aren't affected by clients/
    // jobs/staff created in the tests above.
    let limitsOwnerAccessToken: string;

    beforeAll(async () => {
      const res = await request(server())
        .post('/auth/signup')
        .send({
          organizationName: 'Limits Test Co',
          industryVerticalCode: 'CLEANING',
          ownerEmail: `limits-${runId}@e2e-test.local`,
          ownerFirstName: 'Lim',
          ownerLastName: 'Itz',
          password: 'Sup3rSecret!23',
        })
        .expect(201);
      limitsOwnerAccessToken = res.body.accessToken;
    });

    it('blocks creating a client past the Free plan’s maxClients (10)', async () => {
      for (let i = 0; i < 10; i++) {
        await request(server())
          .post('/clients')
          .set('Authorization', `Bearer ${limitsOwnerAccessToken}`)
          .send({ name: `Client ${i}`, type: 'RESIDENTIAL' })
          .expect(201);
      }

      await request(server())
        .post('/clients')
        .set('Authorization', `Bearer ${limitsOwnerAccessToken}`)
        .send({ name: 'Client 11', type: 'RESIDENTIAL' })
        .expect(402);
    });

    it('blocks onboarding Staff past the Free plan’s maxStaff (2)', async () => {
      for (let i = 0; i < 2; i++) {
        await request(server())
          .post('/organizations/me/invitations')
          .set('Authorization', `Bearer ${limitsOwnerAccessToken}`)
          .send({ email: `limits-staff-${i}-${runId}@e2e-test.local`, roleCode: 'STAFF' })
          .expect(204);
        await request(server())
          .post(`/invitations/${capturedInvitationToken}/accept`)
          .send({ firstName: 'S', lastName: `${i}`, password: 'Sup3rSecret!23' })
          .expect(201);
      }

      await request(server())
        .post('/organizations/me/invitations')
        .set('Authorization', `Bearer ${limitsOwnerAccessToken}`)
        .send({ email: `limits-staff-2-${runId}@e2e-test.local`, roleCode: 'STAFF' })
        .expect(204);
      await request(server())
        .post(`/invitations/${capturedInvitationToken}/accept`)
        .send({ firstName: 'S', lastName: '2', password: 'Sup3rSecret!23' })
        .expect(402);
    });
  });

  describe('Stripe checkout', () => {
    // This sandbox has no real Stripe credentials (STRIPE_SECRET_KEY is
    // unset), so only the config-missing and input-validation branches are
    // verifiable here — see docs/technical-log/phase-4.md.
    it('rejects checkout for the Free plan', async () => {
      await request(server())
        .post('/organizations/me/subscription/checkout')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ planCode: 'FREE' })
        .expect(400);
    });

    it('returns 503 for a paid plan when Stripe is not configured', async () => {
      await request(server())
        .post('/organizations/me/subscription/checkout')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .send({ planCode: 'PRO' })
        .expect(503);
    });

    it('rejects a non-Owner/Admin caller', async () => {
      await request(server())
        .post('/organizations/me/subscription/checkout')
        .set('Authorization', `Bearer ${staffAccessToken}`)
        .send({ planCode: 'PRO' })
        .expect(403);
    });
  });

  describe('Stripe webhooks', () => {
    // Real signature verification against a locally-generated secret
    // (STRIPE_WEBHOOK_SECRET, set in this file's beforeAll) — genuinely
    // exercisable offline, unlike the outbound Stripe API calls in
    // 'Stripe checkout' above. See docs/technical-log/phase-4.md.
    const stripe = new Stripe('sk_test_e2e_signing_only', { apiVersion: '2026-07-29.dahlia' });
    // Subscription.stripeSubscriptionId is globally unique, so a fixed id
    // would collide with a previous run's row in this sandbox's
    // persistent (non-pristine-per-run) database.
    const fakeStripeSubscriptionId = `sub_test_${runId}`;
    let organizationId: string;

    beforeAll(async () => {
      const res = await request(server())
        .get('/organizations/me')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
      organizationId = res.body.id;
    });

    function sign(event: Record<string, unknown>): { payload: string; signature: string } {
      const payload = JSON.stringify(event);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: STRIPE_WEBHOOK_SECRET,
      });
      return { payload, signature };
    }

    it('rejects a request with an invalid signature', async () => {
      const { payload } = sign({
        id: 'evt_bad',
        type: 'checkout.session.completed',
        data: { object: {} },
      });
      await request(server())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1,v1=not-a-real-signature')
        .send(payload)
        .expect(400);
    });

    it('activates the subscription on checkout.session.completed and reflects it on GET', async () => {
      const { payload, signature } = sign({
        id: `evt_test_checkout_completed_${runId}`,
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: `cs_test_${runId}`,
            object: 'checkout.session',
            subscription: fakeStripeSubscriptionId,
            client_reference_id: organizationId,
            metadata: { organizationId, planCode: 'PRO' },
          },
        },
      });

      await request(server())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      const sub = await request(server())
        .get('/organizations/me/subscription')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
      expect(sub.body.plan.code).toBe('PRO');
      expect(sub.body.status).toBe('ACTIVE');
      expect(sub.body.stripeSubscriptionId).toBe(fakeStripeSubscriptionId);
    });

    it('cancels the subscription on customer.subscription.deleted', async () => {
      const { payload, signature } = sign({
        id: `evt_test_subscription_deleted_${runId}`,
        object: 'event',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: fakeStripeSubscriptionId,
            object: 'subscription',
            status: 'canceled',
            metadata: { organizationId, planCode: 'PRO' },
            items: { object: 'list', data: [] },
          },
        },
      });

      await request(server())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);

      const sub = await request(server())
        .get('/organizations/me/subscription')
        .set('Authorization', `Bearer ${ownerAccessToken}`)
        .expect(200);
      expect(sub.body.status).toBe('CANCELED');
    });
  });

  describe('Reports', () => {
    // A dedicated organization with one fully-worked-through job/invoice/
    // payment/staff-assignment, so the report assertions below check exact
    // numbers instead of just "some data came back".
    let reportsOwnerToken: string;
    let reportsStaffToken: string;
    let reportsClientId: string;

    beforeAll(async () => {
      const signup = await request(server())
        .post('/auth/signup')
        .send({
          organizationName: 'Reports Test Co',
          industryVerticalCode: 'CLEANING',
          ownerEmail: `reports-owner-${runId}@e2e-test.local`,
          ownerFirstName: 'Rep',
          ownerLastName: 'Orts',
          password: 'Sup3rSecret!23',
        })
        .expect(201);
      reportsOwnerToken = signup.body.accessToken;

      const client = await request(server())
        .post('/clients')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ name: 'Acme Corp', type: 'COMMERCIAL' })
        .expect(201);
      reportsClientId = client.body.id;

      const service = await request(server())
        .post('/services')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ name: 'Deep Clean', pricingType: 'FIXED', basePrice: 200 })
        .expect(201);

      const job = await request(server())
        .post('/jobs')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ clientId: reportsClientId })
        .expect(201);

      await request(server())
        .post(`/jobs/${job.body.id}/services`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ serviceId: service.body.id, quantity: 1 })
        .expect(201);

      await request(server())
        .patch(`/jobs/${job.body.id}`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({
          status: 'COMPLETED',
          actualStart: '2026-08-01T09:00:00.000Z',
          actualEnd: '2026-08-01T12:00:00.000Z',
        })
        .expect(200);

      const invoice = await request(server())
        .post('/invoices')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ clientId: reportsClientId, issueDate: '2026-08-01', dueDate: '2026-08-15' })
        .expect(201);

      await request(server())
        .post(`/invoices/${invoice.body.id}/line-items`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ description: 'Deep clean', quantity: 1, unitPrice: 200 })
        .expect(201);

      // A partial payment (150 of 200) — exercises both revenue and the
      // outstanding-invoices balance in the same fixture.
      await request(server())
        .post('/payments')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ invoiceId: invoice.body.id, amount: 150, method: 'CARD' })
        .expect(201);

      await request(server())
        .post('/organizations/me/invitations')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ email: `reports-staff-${runId}@e2e-test.local`, roleCode: 'STAFF' })
        .expect(204);
      const accept = await request(server())
        .post(`/invitations/${capturedInvitationToken}/accept`)
        .send({ firstName: 'Stan', lastName: 'Staffer', password: 'Sup3rSecret!23' })
        .expect(201);
      reportsStaffToken = accept.body.accessToken;

      const staffList = await request(server())
        .get('/staff')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .expect(200);
      const membershipId = staffList.body.items[0].membershipId;

      await request(server())
        .post(`/jobs/${job.body.id}/assignments`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .send({ membershipId })
        .expect(201);
    });

    const range = '?from=2026-07-01T00:00:00.000Z&to=2026-08-10T00:00:00.000Z';

    it('reports revenue for the completed payment, bucketed by day', async () => {
      const res = await request(server())
        .get(`/reports/revenue${range}`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .expect(200);
      expect(res.body.totalRevenue).toBe('150');
      expect(res.body.buckets).toHaveLength(1);
      expect(res.body.buckets[0].revenue).toBe('150');
    });

    it('summarizes jobs by status', async () => {
      const res = await request(server())
        .get(`/reports/jobs-summary${range}`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .expect(200);
      expect(res.body.totalJobs).toBe(1);
      expect(res.body.byStatus.COMPLETED).toBe(1);
    });

    it('reports staff performance with jobs completed and hours worked', async () => {
      const res = await request(server())
        .get(`/reports/staff-performance${range}`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .expect(200);
      expect(res.body.staff).toHaveLength(1);
      expect(res.body.staff[0].name).toBe('Stan Staffer');
      expect(res.body.staff[0].jobsCompleted).toBe(1);
      expect(res.body.staff[0].hoursWorked).toBe(3);
    });

    it('ranks the client by revenue', async () => {
      const res = await request(server())
        .get(`/reports/top-clients${range}`)
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .expect(200);
      expect(res.body.clients).toHaveLength(1);
      expect(res.body.clients[0].clientId).toBe(reportsClientId);
      expect(res.body.clients[0].revenue).toBe('150');
      expect(res.body.clients[0].jobCount).toBe(1);
    });

    it('reports the outstanding balance on the partially-paid invoice', async () => {
      const res = await request(server())
        .get('/reports/outstanding-invoices')
        .set('Authorization', `Bearer ${reportsOwnerToken}`)
        .expect(200);
      expect(res.body.outstandingCount).toBe(1);
      expect(res.body.outstandingTotal).toBe('50');
      expect(res.body.overdueCount).toBe(0);
    });

    it('rejects a non-Owner/Admin caller', async () => {
      await request(server())
        .get('/reports/revenue')
        .set('Authorization', `Bearer ${reportsStaffToken}`)
        .expect(403);
    });
  });
});
