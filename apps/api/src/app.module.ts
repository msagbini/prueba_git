import { Module } from '@nestjs/common';
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

/** Root application module — wires together config, infrastructure and feature modules. */
@Module({
  imports: [
    AppConfigModule,
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
    HealthModule,
  ],
})
export class AppModule {}
