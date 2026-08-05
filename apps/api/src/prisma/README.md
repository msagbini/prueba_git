# src/prisma

The multi-tenant data-access layer. See
[`docs/architecture/multi-tenancy.md`](../../../../docs/architecture/multi-tenancy.md)
for the design; this README is a map of which file implements which part
of it.

| File                                 | Role                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma.service.ts`                  | Plain `PrismaClient` wrapper with Nest lifecycle hooks (connect/disconnect). The **unscoped** client — only used to open tenant-scoped transactions or to query the global reference tables (`User`, `Role`, `Permission`, `IndustryVertical`, ...).                                |
| `prisma.module.ts`                   | Wires `PrismaService`, `ClsModule` (per-request `AsyncLocalStorage`), `TenantContextService` and the global `TenantTransactionInterceptor` together.                                                                                                                                |
| `tenant-scoped-models.ts`            | The list of Prisma models that carry `organizationId` and must be auto-scoped.                                                                                                                                                                                                      |
| `tenant-scoping.extension.ts`        | The Prisma Client Extension that injects `organizationId` into reads/writes for those models — the application-layer half of the isolation.                                                                                                                                         |
| `run-in-tenant-transaction.ts`       | Opens one Prisma interactive transaction scoped to an organization: sets the Postgres session variable RLS policies check (`set_config('app.current_org_id', ...)`) and applies `tenant-scoping.extension.ts` to the same transaction — the two layers wired together in one place. |
| `tenant-transaction.interceptor.ts`  | Wraps every authenticated HTTP request in one call to `run-in-tenant-transaction.ts`, scoped to `req.user.org`. `@Public()` routes pass through unscoped.                                                                                                                           |
| `tenant-context.service.ts`          | How feature-module services reach the current request's tenant-scoped client (`this.tenantContext.client.job.findMany()`, etc.) without it being passed as a parameter everywhere.                                                                                                  |
| `tenant-scoping.integration.spec.ts` | Proves the isolation against a real PostgreSQL database — not mocked. Skips itself if no database is reachable.                                                                                                                                                                     |

## Using this in a feature module service

```ts
@Injectable()
export class JobsService {
  constructor(private readonly tenantContext: TenantContextService) {}

  findAll() {
    // organizationId is injected automatically — no explicit filter needed,
    // and Postgres RLS would still block a cross-tenant row even if this
    // extension were somehow bypassed.
    return this.tenantContext.client.job.findMany();
  }
}
```

Code that must run outside a request's tenant scope (the seed script, a
future admin/system job) uses `PrismaService` directly, or
`runInTenantTransaction()` for a one-off scoped operation (e.g. the
signup flow creating a brand-new organization — see
docs/architecture/auth.md).
