import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runInTenantTransaction } from '../../prisma/run-in-tenant-transaction';
import { RecurringJobsService } from './recurring-jobs.service';

/**
 * Integration test proving `RecurringJobsService` actually materializes
 * job instances against a real database — including that the narrow
 * `system_job_read_all` policy (see the `system_job_org_visibility`
 * migration) genuinely lets it enumerate organizations it has no
 * per-request membership in, and that the created instances still land
 * correctly-scoped per organization. Same skip-if-no-database pattern as
 * `tenant-scoping.integration.spec.ts`.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.MIGRATION_DATABASE_URL);
const describeIfDatabase = hasDatabase ? describe : describe.skip;

describeIfDatabase('RecurringJobsService (real database)', () => {
  const prisma = new PrismaService();
  const migratorPrisma = new PrismaClient({
    datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } },
  });
  const service = new RecurringJobsService(prisma);

  const orgId = randomUUID();
  let actorUserId: string;
  let clientId: string;
  let rootJobId: string;

  beforeAll(async () => {
    const [role, vertical] = await Promise.all([
      prisma.role.findFirstOrThrow({ where: { code: 'OWNER' } }),
      prisma.industryVertical.findFirstOrThrow({ where: { code: 'CLEANING' } }),
    ]);

    const actor = await prisma.user.create({
      data: {
        email: `recurring-jobs-test-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Actor',
      },
    });
    actorUserId = actor.id;

    await runInTenantTransaction(prisma, orgId, async (tx) => {
      await tx.organization.create({
        data: {
          id: orgId,
          name: 'Recurring Jobs Test Org',
          slug: `recurring-jobs-test-org-${orgId}`,
          industryVerticalId: vertical.id,
          timezone: 'UTC',
          locale: 'en-US',
        },
      });
      await tx.organizationMembership.create({
        data: { organizationId: orgId, userId: actorUserId, roleId: role.id },
      });

      const client = await tx.client.create({
        data: { organizationId: orgId, name: 'Recurring Client', type: 'RESIDENTIAL' },
      });
      clientId = client.id;

      // Daily, anchored yesterday — guarantees an occurrence lands inside
      // the service's lookahead window regardless of when this test runs.
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const root = await tx.job.create({
        data: {
          organizationId: orgId,
          clientId: client.id,
          createdByUserId: actorUserId,
          status: 'SCHEDULED',
          recurrenceRule: 'FREQ=DAILY',
          scheduledStart: yesterday,
          notes: 'Recurring root',
        },
      });
      rootJobId = root.id;
    });
  });

  afterAll(async () => {
    await migratorPrisma.job.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.client.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.organizationMembership.deleteMany({ where: { organizationId: orgId } });
    await migratorPrisma.organization.delete({ where: { id: orgId } });
    await migratorPrisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
    await migratorPrisma.$disconnect();
  });

  it('materializes a due occurrence as a real child Job row, correctly scoped to the organization', async () => {
    await service.materializeDueOccurrences();

    const children = await runInTenantTransaction(prisma, orgId, (tx) =>
      tx.job.findMany({ where: { parentJobId: rootJobId } }),
    );

    expect(children).toHaveLength(1);
    expect(children[0]?.organizationId).toBe(orgId);
    expect(children[0]?.clientId).toBe(clientId);
    expect(children[0]?.recurrenceRule).toBeNull(); // a materialized instance isn't itself a new root
  });

  it('is idempotent — running it again does not create a duplicate instance', async () => {
    await service.materializeDueOccurrences();
    await service.materializeDueOccurrences();

    const children = await runInTenantTransaction(prisma, orgId, (tx) =>
      tx.job.findMany({ where: { parentJobId: rootJobId } }),
    );

    expect(children).toHaveLength(1);
  });
});
