import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BillingModule } from '../billing/billing.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobAttachmentsService } from './job-attachments.service';
import { RecurringJobsService } from './recurring-jobs.service';

/** Jobs module. */
@Module({
  imports: [AuditLogsModule, BillingModule],
  controllers: [JobsController],
  providers: [JobsService, JobAttachmentsService, RecurringJobsService],
})
export class JobsModule {}
