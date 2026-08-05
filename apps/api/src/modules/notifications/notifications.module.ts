import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationWriterService } from './notification-writer.service';

/**
 * Notifications module. `NotificationWriterService` is exported so
 * request-scoped mutations elsewhere (currently just `JobsService`'s
 * assignment creation) can write a notification — mirrors
 * `AuditLogsModule`'s `AuditLogWriterService` export. Background/cron
 * writers (the reminder job) aren't request-scoped, so they write
 * `Notification` rows directly through their own tenant-scoped
 * transaction client instead of through this service — same pattern
 * `RecurringJobsService` already uses for `Job` rows.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationWriterService],
  exports: [NotificationWriterService],
})
export class NotificationsModule {}
