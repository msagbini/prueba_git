import { Prisma, type PrismaClient } from '@prisma/client';
import { tenantScopingExtension } from './tenant-scoping.extension';

/**
 * The tenant-scoped Prisma client handed to callers of
 * {@link runInTenantTransaction}. Typed as Prisma's own
 * `Prisma.TransactionClient` — extensions only change query *behavior*,
 * not the generated delegate types, so the extended transaction client is
 * structurally identical to the unextended one from a caller's point of
 * view (still fully type-checked against the real Client/Job/etc. shapes).
 */
export type TenantPrismaClient = Prisma.TransactionClient;

/**
 * Opens a single Prisma interactive transaction scoped to one
 * organization: sets the Postgres session variable Row-Level Security
 * policies check (`app.current_org_id`, via `set_config`, scoped to this
 * transaction only), then hands the caller a Prisma client extended with
 * {@link tenantScopingExtension} for the same organization — the
 * database-layer and application-layer halves of the multi-tenant
 * isolation described in docs/architecture/multi-tenancy.md, wired
 * together in one place so nothing can use one without the other.
 *
 * Extensions must be applied to the client *before* `$transaction` is
 * called on it (Prisma propagates an extended client's extensions into
 * its transaction callback automatically) — so this extends `prisma`
 * itself for this call, then starts the transaction on that extended
 * client, rather than trying to extend the `tx` handle from inside it.
 *
 * `set_config(..., true)` (not string-interpolated `SET LOCAL ...`) is
 * used deliberately: it is a normal SQL function call, so Prisma's tagged
 * template `$executeRaw` can bind `organizationId` as a real parameter
 * instead of interpolating it into SQL text.
 * @param prisma the base (unscoped) PrismaService/PrismaClient
 * @param organizationId the tenant this transaction and every query inside it are scoped to
 * @param fn work to run with the tenant-scoped client; its return value is the transaction's result
 * @returns whatever `fn` returns, once the transaction commits
 */
export async function runInTenantTransaction<T>(
  prisma: PrismaClient,
  organizationId: string,
  fn: (tenantClient: TenantPrismaClient) => Promise<T>,
): Promise<T> {
  const scopedClient = prisma.$extends(tenantScopingExtension(organizationId));
  return scopedClient.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return fn(tx as TenantPrismaClient);
  });
}
