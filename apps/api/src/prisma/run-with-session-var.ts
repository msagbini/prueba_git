import type { Prisma, PrismaClient } from '@prisma/client';

/** Postgres session variable checked by the `bootstrap_by_token_hash` RLS policies (refresh_tokens, user_invitations). */
export const SESSION_VAR_LOOKUP_TOKEN_HASH = 'app.lookup_token_hash';
/** Postgres session variable checked by the `bootstrap_by_user_id` RLS policy (organization_memberships). */
export const SESSION_VAR_CURRENT_USER_ID = 'app.current_user_id';

/**
 * Opens a plain Prisma transaction (not tenant-scoped, no
 * `tenantScopingExtension`) with a single Postgres session variable set
 * via `set_config` — the mechanism behind the narrow "bootstrap" RLS
 * policies (see migration `auth_bootstrap_policies` and ADR 0006) that
 * let a caller look up a row by an exact token hash, or discover their
 * own memberships across organizations, before any single-organization
 * context exists yet.
 * @param prisma the base (unscoped) PrismaClient
 * @param key the session variable name (one of the `SESSION_VAR_*` constants)
 * @param value the value to scope the lookup to (a token hash or a user id)
 * @param fn work to run with the scoped transaction client
 * @returns whatever `fn` returns, once the transaction commits
 */
export async function runWithSessionVar<T>(
  prisma: PrismaClient,
  key: string,
  value: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config(${key}, ${value}, true)`;
    return fn(tx);
  });
}
