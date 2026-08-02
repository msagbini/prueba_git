import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import { TenantContextService } from './tenant-context.service';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor';

/**
 * Provides {@link PrismaService} and the multi-tenant data-access
 * machinery application-wide (global, so feature modules don't each need
 * to re-import it): `ClsModule` establishes an `AsyncLocalStorage`
 * context per request (mounted as Express middleware, so it's in place
 * before guards/interceptors run), and `TenantTransactionInterceptor`
 * (registered globally here) wraps every authenticated request in a
 * tenant-scoped transaction, exposed to services via
 * {@link TenantContextService}. See docs/architecture/multi-tenancy.md.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
  ],
  providers: [
    PrismaService,
    TenantContextService,
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
  exports: [PrismaService, TenantContextService],
})
export class PrismaModule {}
