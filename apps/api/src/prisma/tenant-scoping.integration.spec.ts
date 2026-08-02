import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { runInTenantTransaction } from './run-in-tenant-transaction';

/**
 * Integration test proving the multi-tenant isolation mechanism described
 * in docs/architecture/multi-tenancy.md actually holds — against a real
 * PostgreSQL database (not mocks), the same way the RLS policies
 * themselves were verified by hand while building this migration (see
 * docs/technical-log/phase-2.md). Requires DATABASE_URL/
 * MIGRATION_DATABASE_URL to point at a reachable database with migrations
 * applied; skips itself otherwise so `pnpm test` doesn't hard-fail in an
 * environment with no database (e.g. a laptop that hasn't run `docker
 * compose up` yet).
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.MIGRATION_DATABASE_URL);
const describeIfDatabase = hasDatabase ? describe : describe.skip;

describeIfDatabase('tenant scoping (application layer + RLS)', () => {
  const prisma = new PrismaClient();
  // Cleanup connects as dos_migrator (BYPASSRLS) so teardown isn't itself
  // subject to the isolation being tested.
  const migratorPrisma = new PrismaClient({
    datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } },
  });

  const orgAId = randomUUID();
  const orgBId = randomUUID();
  let actorUserId: string;
  let orgBClientId: string;
  let orgAJobId: string;

  beforeAll(async () => {
    const [role, vertical] = await Promise.all([
      prisma.role.findFirstOrThrow({ where: { code: 'OWNER' } }),
      prisma.industryVertical.findFirstOrThrow({ where: { code: 'CLEANING' } }),
    ]);

    const actor = await prisma.user.create({
      data: {
        email: `tenant-scoping-test-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Actor',
      },
    });
    actorUserId = actor.id;

    for (const [organizationId, slug] of [
      [orgAId, `tenant-scoping-org-a-${orgAId}`],
      [orgBId, `tenant-scoping-org-b-${orgBId}`],
    ] as const) {
      await runInTenantTransaction(prisma, organizationId, async (tx) => {
        await tx.organization.create({
          data: {
            id: organizationId,
            name: 'Tenant Scoping Test Org',
            slug,
            industryVerticalId: vertical.id,
            timezone: 'UTC',
            locale: 'en-US',
          },
        });
        await tx.organizationMembership.create({
          data: { organizationId, userId: actorUserId, roleId: role.id },
        });
      });
    }

    await runInTenantTransaction(prisma, orgAId, async (tx) => {
      const client = await tx.client.create({
        data: { organizationId: orgAId, name: 'Org A Client', type: 'RESIDENTIAL' },
      });
      const job = await tx.job.create({
        data: {
          organizationId: orgAId,
          clientId: client.id,
          createdByUserId: actorUserId,
          status: 'DRAFT',
        },
      });
      orgAJobId = job.id;
    });

    orgBClientId = await runInTenantTransaction(prisma, orgBId, async (tx) => {
      const client = await tx.client.create({
        data: { organizationId: orgBId, name: 'Org B Client', type: 'RESIDENTIAL' },
      });
      await tx.job.create({
        data: {
          organizationId: orgBId,
          clientId: client.id,
          createdByUserId: actorUserId,
          status: 'DRAFT',
        },
      });
      return client.id;
    });
  });

  afterAll(async () => {
    await migratorPrisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await migratorPrisma.client.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await migratorPrisma.organizationMembership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await migratorPrisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await migratorPrisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
    await migratorPrisma.$disconnect();
  });

  it('scopes an unfiltered findMany to the active organization only', async () => {
    const jobs = await runInTenantTransaction(prisma, orgAId, (tx) => tx.job.findMany());

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe(orgAJobId);
    expect(jobs[0]?.organizationId).toBe(orgAId);
  });

  it('rejects a create for the wrong organization even when the caller hardcodes it', async () => {
    // TypeScript requires organizationId on every create() (Prisma's
    // generated types don't know about the extension's runtime
    // injection — see the caveat on tenantScopingExtension), so a buggy
    // caller could hardcode the wrong one. This proves that mistake is
    // still caught: `scopeWhere`/the create injector let an explicit
    // value win, so the wrong id reaches Postgres unchanged, and RLS's
    // `WITH CHECK` (policied on organizationId) rejects the insert.
    await expect(
      runInTenantTransaction(prisma, orgAId, (tx) =>
        tx.client.create({
          data: { organizationId: orgBId, name: 'Should be rejected', type: 'COMMERCIAL' },
        }),
      ),
    ).rejects.toThrow(/row-level security|row security/i);
  });

  it("cannot read another organization's row by id, even when queried directly", async () => {
    const found = await runInTenantTransaction(prisma, orgAId, (tx) =>
      tx.client.findUnique({ where: { id: orgBClientId } }),
    );

    expect(found).toBeNull();
  });

  it("cannot join across into another organization's data via a subquery-shaped filter", async () => {
    const jobs = await runInTenantTransaction(prisma, orgAId, (tx) =>
      tx.job.findMany({ where: { clientId: orgBClientId } }),
    );

    expect(jobs).toHaveLength(0);
  });
});
