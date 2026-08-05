import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BillingModule } from '../billing/billing.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

/**
 * Membership management module. `MembershipsService` is exported so
 * `UsersModule` can delegate `DELETE /users/:id` to it — both routes
 * remove the same `OrganizationMembership`, just addressed differently,
 * and the last-Owner guard should exist in exactly one place.
 */
@Module({
  imports: [AuditLogsModule, BillingModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
