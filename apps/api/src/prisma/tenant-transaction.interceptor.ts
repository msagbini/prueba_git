import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, Observable, firstValueFrom } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import { runInTenantTransaction } from './run-in-tenant-transaction';
import { TENANT_PRISMA_CLS_KEY } from './tenant-context.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

/**
 * Wraps every authenticated request in a single Prisma interactive
 * transaction scoped to the caller's active organization (see
 * `run-in-tenant-transaction.ts` and docs/architecture/multi-tenancy.md),
 * making the resulting tenant-scoped client available for the rest of the
 * request via {@link TenantContextService}.
 *
 * The entire downstream request handling (guards have already run by the
 * time an interceptor executes; this covers the controller method and
 * everything it calls) happens *inside* the transaction callback — routed
 * through `firstValueFrom(next.handle())` so the RxJS pipeline resolves to
 * a promise the transaction can await, keeping the connection/transaction
 * open for the whole request and committing only once it completes.
 *
 * `@Public()` routes (no `req.user`) are passed through unscoped — there
 * is no organization to transact against yet (e.g. signup, which opens
 * its own scoped transaction once it knows the new organization's id).
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  /**
   * Constructs the interceptor around the base Prisma client and CLS store.
   * @param prisma the base (unscoped) Prisma client each request's transaction is opened from
   * @param cls the CLS store the tenant-scoped client is published to for the request
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Opens a tenant-scoped transaction for authenticated requests and runs the rest of the request inside it.
   * @param context the current execution context, used to read `req.user`
   * @param next the next handler in the interceptor chain
   * @returns an Observable of the (possibly transaction-wrapped) response
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = request.user?.org;

    if (!organizationId) {
      return next.handle();
    }

    return from(
      runInTenantTransaction(this.prisma, organizationId, async (tenantClient) => {
        this.cls.set(TENANT_PRISMA_CLS_KEY, tenantClient);
        return firstValueFrom(next.handle());
      }),
    );
  }
}
