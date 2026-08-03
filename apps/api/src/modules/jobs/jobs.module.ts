import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BillingModule } from '../billing/billing.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/** Jobs module. */
@Module({
  imports: [AuditLogsModule, BillingModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
