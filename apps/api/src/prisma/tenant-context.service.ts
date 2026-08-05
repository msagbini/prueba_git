import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { TenantPrismaClient } from './run-in-tenant-transaction';

/** ClsService key the tenant-scoped Prisma client is stored under for the current request. */
export const TENANT_PRISMA_CLS_KEY = 'tenantPrisma';

/**
 * Gives services access to the current request's tenant-scoped Prisma
 * client without threading it through every method call — it's stashed in
 * `nestjs-cls`'s `AsyncLocalStorage` context by `TenantTransactionInterceptor`
 * for the duration of the request. See docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class TenantContextService {
  /**
   * Constructs the service around the shared CLS store.
   * @param cls the request-scoped CLS store the tenant client is read from
   */
  constructor(private readonly cls: ClsService) {}

  /**
   * The tenant-scoped Prisma client for the current request.
   * @throws Error if called outside a request scoped to an organization
   *   (i.e. a `@Public()` route, or code running outside the request
   *   lifecycle) — this is intentionally a hard failure rather than
   *   silently falling back to an unscoped client.
   * @returns the tenant-scoped Prisma client bound to the caller's active organization
   */
  get client(): TenantPrismaClient {
    const client = this.cls.get<TenantPrismaClient>(TENANT_PRISMA_CLS_KEY);
    if (!client) {
      throw new Error(
        'No tenant-scoped Prisma client in the current request context. ' +
          'TenantContextService is only usable behind an authenticated (non-@Public) route.',
      );
    }
    return client;
  }
}
