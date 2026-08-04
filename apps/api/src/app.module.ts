import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ServicesModule } from './modules/services/services.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { StaffModule } from './modules/staff/staff.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { PlansModule } from './modules/plans/plans.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/** Root application module — wires together config, infrastructure and feature modules. */
@Module({
  imports: [
    AppConfigModule,
    // Per-IP request limiting, applied globally via APP_GUARD below.
    // 100 requests / 60s is generous for this API's real callers (the
    // web/mobile clients making normal interactive traffic, plus
    // occasional Stripe webhook deliveries) while still bounding a
    // single misbehaving or malicious client — not a tuned production
    // number, just a sane default; revisit with real traffic data.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Powers RecurringJobsService's @Cron handler (JobsModule) — see
    // there for why a background job needs its own tenant-enumeration path.
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    MembershipsModule,
    UsersModule,
    RolesModule,
    ClientsModule,
    ServicesModule,
    JobsModule,
    StaffModule,
    InvoicesModule,
    PaymentsModule,
    AuditLogsModule,
    PlansModule,
    BillingModule,
    ReportsModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
