import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/modules/auth/email/email.service';

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
    app = await NestFactory.create(AppModule, { logger: false });
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
    expect(staffList.body).toHaveLength(1);
    staffMembershipId = staffList.body[0].membershipId;

    const jobsAsStaff = await request(server())
      .get('/jobs')
      .set('Authorization', `Bearer ${staffAccessToken}`)
      .expect(200);
    expect(jobsAsStaff.body).toEqual([]);
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
    expect(jobsAsStaff.body).toHaveLength(1);
    expect(jobsAsStaff.body[0].id).toBe(jobAId);

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
    expect(jobsAsClient.body).toHaveLength(1);
    expect(jobsAsClient.body[0].id).toBe(jobAId);
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
    expect(invoicesAsClient.body.map((i: { id: string }) => i.id)).toEqual([invoiceId]);
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
  });
});
