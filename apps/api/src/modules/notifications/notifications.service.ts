import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginate, type PaginatedResult } from '../../common/pagination';
import { TenantContextService } from '../../prisma/tenant-context.service';

/**
 * A caller's own in-app notifications. Unlike most business modules,
 * there's no "manage" side beyond marking one's own notification read —
 * nothing else here is ever created through this service (see
 * `NotificationWriterService` and `JobRemindersService` for where rows
 * actually come from). Every method scopes to `userId` in addition to
 * the tenant scoping RLS already applies — a notification is inherently
 * personal, not organization-wide, so this is a hard filter on every
 * query rather than a role-based visibility rule.
 */
@Injectable()
export class NotificationsService {
  /**
   * Constructs the service around the tenant-scoped Prisma client.
   * @param tenantContext the current request's tenant-scoped Prisma client
   */
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Lists the caller's own notifications, newest first.
   * @param userId the authenticated caller's global user id
   * @param pagination the requested page/pageSize
   * @returns a page of the caller's notifications
   */
  async list(
    userId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Notification>> {
    const where = { userId };
    const { page, pageSize } = pagination;
    const [items, total] = await Promise.all([
      this.tenantContext.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.tenantContext.client.notification.count({ where }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  /**
   * Counts the caller's unread notifications — cheap enough to poll for
   * a nav-bar badge without fetching the full list.
   * @param userId the authenticated caller's global user id
   * @returns how many of the caller's notifications have no `readAt`
   */
  async unreadCount(userId: string): Promise<number> {
    return this.tenantContext.client.notification.count({ where: { userId, readAt: null } });
  }

  /**
   * Marks one of the caller's own notifications as read. Idempotent —
   * marking an already-read notification read again just returns it
   * unchanged, rather than erroring.
   * @param userId the authenticated caller's global user id
   * @param id the notification to mark read
   * @returns the updated notification
   * @throws NotFoundException if no such notification belongs to the caller
   */
  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.tenantContext.client.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }
    if (notification.readAt) {
      return notification;
    }
    return this.tenantContext.client.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
