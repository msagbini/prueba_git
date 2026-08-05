import { Prisma } from '@prisma/client';
import { isTenantScopedModel } from './tenant-scoped-models';

const READ_AND_FILTER_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/**
 * Merges `organizationId` into a Prisma `where` argument without
 * clobbering an explicit filter the caller already set on that field —
 * an explicit mismatched value is left alone deliberately so a
 * programmer error there fails loudly against Postgres (rejected by RLS,
 * or simply returns no rows) rather than being silently overridden.
 * @param where the operation's existing `where` object, if any
 * @param organizationId the active tenant's id from the request context
 * @returns a new `where` object with `organizationId` guaranteed present
 */
function scopeWhere(
  where: Record<string, unknown> | undefined,
  organizationId: string,
): Record<string, unknown> {
  return { organizationId, ...where };
}

/**
 * The application-layer half of the multi-tenant defense described in
 * docs/architecture/multi-tenancy.md. Given the active organization id for
 * the current request, returns a Prisma Client Extension that:
 * - injects `organizationId` into the `where` of every read/update/delete
 *   on a {@link TENANT_SCOPED_MODELS} model — this is the extension's main
 *   practical value, since `where` filters are optional and TypeScript
 *   won't force callers to add the filter themselves; and
 * - injects `organizationId` into the `data` of every `create`/
 *   `createMany`/`upsert`, as a secondary safety net.
 *
 * Typing caveat on the create side: Prisma Client Extensions change how a
 * query behaves, not its generated argument types — `organizationId` is a
 * required, non-nullable, no-default column, so Prisma's generated
 * `CreateInput` types still require it at compile time regardless of this
 * extension. Normal (typed) call sites therefore always pass it
 * explicitly on create; the runtime injection here matters for dynamic/
 * untyped call sites, and — combined with `scopeWhere`'s "explicit value
 * wins" rule below — for proving that a hardcoded *wrong* organizationId
 * still gets caught, just one layer down, by Postgres RLS's `WITH CHECK`
 * (see the "rejects a create for the wrong organization" test).
 *
 * This is applied to the transaction client (`tx`) that already has
 * `app.current_org_id` set via `set_config` for the same organization (see
 * `run-in-tenant-transaction.ts`), so a bug in either layer is still
 * caught by the other.
 *
 * Known limitation: `aggregate` and `groupBy` are not auto-scoped here
 * (their `where` shape varies enough that a generic injector risks
 * silently producing the wrong query) — call sites using them must scope
 * explicitly, with Postgres RLS as the fail-closed backstop either way.
 * @param organizationId the active tenant's id for the current request/operation
 * @returns a Prisma Client Extension object suitable for `client.$extends(...)`
 */
export function tenantScopingExtension(organizationId: string) {
  return Prisma.defineExtension({
    name: 'tenant-scoping',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantScopedModel(model)) {
            return query(args);
          }

          const scopedArgs = args as {
            where?: Record<string, unknown>;
            data?: Record<string, unknown> | Record<string, unknown>[];
            create?: Record<string, unknown>;
          };

          if (READ_AND_FILTER_OPERATIONS.has(operation)) {
            scopedArgs.where = scopeWhere(scopedArgs.where, organizationId);
          }

          if (operation === 'create' && scopedArgs.data && !Array.isArray(scopedArgs.data)) {
            scopedArgs.data = { organizationId, ...scopedArgs.data };
          }

          if (operation === 'createMany' && Array.isArray(scopedArgs.data)) {
            scopedArgs.data = scopedArgs.data.map((row) => ({ organizationId, ...row }));
          }

          if (operation === 'upsert') {
            scopedArgs.where = scopeWhere(scopedArgs.where, organizationId);
            if (scopedArgs.create) {
              scopedArgs.create = { organizationId, ...scopedArgs.create };
            }
          }

          return query(scopedArgs);
        },
      },
    },
  });
}
