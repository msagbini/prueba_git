import { Injectable } from '@nestjs/common';
import type { NotificationType } from '@prisma/client';
import { TenantContextService } from '../../prisma/tenant-context.service';

/** One notification to create — see `Notification` in schema.prisma. */
export interface NotificationEntry {
  /** The organization the notification belongs to. */
  organizationId: string;
  /** The global User id of the recipient. */
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** The Prisma model name the notification is about, e.g. `"Job"`. */
  entityType?: string;
  entityId?: string;
}

/**
 * Writes rows to the `notifications` table. Every trigger point (job
 * assignment, the reminder cron) calls this after its own write
 * succeeds — mirrors `AuditLogWriterService`'s role as the one shared
 * write path other modules depend on, exported from this module for
 * exactly that reason.
 */
@Injectable()
export class NotificationWriterService {
  /**
   * Constructs the writer around the tenant-scoped Prisma client.
   * @param tenantContext the current request's (or tenant-scoped transaction's) Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Creates one notification.
   * @param entry the notification to create
   */
  async create(entry: NotificationEntry): Promise<void> {
    await this.tenantContext.client.notification.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        type: entry.type,
        title: entry.title,
        body: entry.body,
        entityType: entry.entityType,
        entityId: entry.entityId,
      },
    });
  }
}
