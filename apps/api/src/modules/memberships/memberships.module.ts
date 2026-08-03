import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

/** Membership management module. */
@Module({
  imports: [AuditLogsModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
})
export class MembershipsModule {}
