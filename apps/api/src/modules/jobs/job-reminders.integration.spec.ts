import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runInTenantTransaction } from '../../prisma/run-in-tenant-transaction';
import { JobRemindersService } from './job-reminders.service';

/**
 * Integration test proving `JobRemindersService` actually notifies
 * against a real database — including that a job outside the reminder
 * window gets no notification, both the assigned staff member and a
 * client-portal user get one, and a second run doesn't send a
 * duplicate. Same skip-if-no-database pattern as
 * `recurring-jobs.integration.spec.ts`.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.MIGRATION_DATABASE_URL);
const describeIfDatabase = hasDatabase ? describe : describe.skip;

describeIfDatabase('JobRemindersService (real database)', () => {
  const prisma = new PrismaService();
  const migratorPrisma = new PrismaClient({
    datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } },
  });
  const service = new JobRemindersService(prisma);

  const orgId = randomUUID();
  let staffUserId: string;
  let clientUserId: string;
  let dueJobId: string;
  let farFutureJobId: string;

  beforeAll(async () => {
    const [ownerRole, staffRole, clientRole, vertical] = await Promise.all([
      prisma.role.findFirstOrThrow({ where: { code: 'OWNER' } }),
      prisma.role.findFirstOrThrow({ where: { code: 'STAFF' } }),
      prisma.role.findFirstOrThrow({ where: { code: 'CLIENT' } }),
      prisma.industryVertical.findFirstOrThrow({ where: { code: 'CLEANING' } }),
    ]);

    const owner = await prisma.user.create({
      data: {
        email: `job-reminders-owner-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Owner',
        lastName: 'Test',
      },
    });
    const staff = await prisma.user.create({
      data: {
        email: `job-reminders-staff-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Staff',
        lastName: 'Test',
      },
    });
    staffUserId = staff.id;
    const clientUser = await prisma.user.create({
      data: {
        email: `job-reminders-client-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Client',
        lastName: 'Test',
      },
    });
    clientUserId = clientUser.id;

    await runInTenantTransaction(prisma, orgId, async (tx) => {
      await tx.organization.create({
        data: {
          id: orgId,
          name: 'Job Reminders Test Org',
          slug: `job-reminders-test-org-${orgId}`,
          industryVerticalId: vertical.id,
          timezone: 'UTC',
          locale: 'en-US',
        },
      });
      await tx.organizationMembership.create({
        data: { organizationId: orgId, userId: owner.id, roleId: ownerRole.id },
      });
      const staffMembership = await tx.organizationMembership.create({
        data: { organizationId: orgId, userId: staffUserId, roleId: staffRole.id },
      });

      const client = await tx.client.create({
        data: { organizationId: orgId, name: 'Reminders Client', type: 'RESIDENTIAL' },
      });
      await tx.organizationMembership.create({
        data: {
          organizationId: orgId,
          userId: clientUserId,
          roleId: clientRole.id,
          clientId: client.id,
        },
      });

      const dueJob = await tx.job.create({
        data: {
          organizationId: orgId,
          clientId: client.id,
          createdByUserId: owner.id,
          status: 'SCHEDULED',
          scheduledStart: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6h from now — inside the 24h window
        },
      });
      dueJobId = dueJob.id;
      await tx.jobAssignment.create({
        data: { organizationId: orgId, jobId: dueJob.id, membershipId: staffMembership.id },
      });

      const farFutureJob = await tx.job.create({
        data: {
          organizationId: orgId,
          clientId: client.id,
          createdByUserId: owner.id,
          status: 'SCHEDULED',
          scheduledStart: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h from now — outside the window
        },
      });
      farFutureJobId = farFutureJob.id;
      await tx.jobAssignment.create({
        data: { organizationId: orgId, jobId: farFutureJob.id, membershipId: staffMembership.id },
      });
    });
  });

  afterAll(async () => {
    await migratorPrisma.notification.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.jobAssignment.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.job.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.client.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.organizationMembership.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.organization.delete({ where: { id: orgId } });
    await migratorPrisma.user.deleteMany({
      where: { id: { in: [staffUserId, clientUserId] } },
    });
    await prisma.$disconnect();
    await migratorPrisma.$disconnect();
  });

  it('notifies the assigned staff member and the client-portal user about a job due within the window', async () => {
    await service.sendDueReminders();

    const notifications = await runInTenantTransaction(prisma, orgId, (tx) =>
      tx.notification.findMany({ where: { entityType: 'Job', entityId: dueJobId } }),
    );

    const recipientIds = notifications.map((n) => n.userId).sort();
    expect(recipientIds).toEqual([clientUserId, staffUserId].sort());
    expect(notifications.every((n) => n.type === 'JOB_REMINDER')).toBe(true);
  });

  it('does not notify about a job outside the reminder window', async () => {
    const notifications = await runInTenantTransaction(prisma, orgId, (tx) =>
      tx.notification.findMany({ where: { entityType: 'Job', entityId: farFutureJobId } }),
    );
    expect(notifications).toHaveLength(0);
  });

  it('is idempotent — running it again does not send a duplicate reminder', async () => {
    await service.sendDueReminders();
    await service.sendDueReminders();

    const notifications = await runInTenantTransaction(prisma, orgId, (tx) =>
      tx.notification.findMany({ where: { entityType: 'Job', entityId: dueJobId } }),
    );
    expect(notifications).toHaveLength(2); // one per recipient (staff + client), still — not per run
  });
});
