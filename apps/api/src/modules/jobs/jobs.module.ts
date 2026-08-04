import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobAttachmentsService } from './job-attachments.service';
import { RecurringJobsService } from './recurring-jobs.service';
import { JobRemindersService } from './job-reminders.service';

/** Jobs module. */
@Module({
  imports: [AuditLogsModule, BillingModule, NotificationsModule],
  controllers: [JobsController],
  providers: [JobsService, JobAttachmentsService, RecurringJobsService, JobRemindersService],
})
export class JobsModule {}
