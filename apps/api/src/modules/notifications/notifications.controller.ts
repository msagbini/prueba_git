import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationsService } from './notifications.service';

/**
 * A caller's own in-app notifications. `notifications.read` is granted
 * to every role (see `prisma/seed.ts`) — every method also scopes to
 * the caller's own `userId`, so the permission check and the row-level
 * filter are two independent layers (matches this project's usual
 * "RLS + application filter" defense-in-depth, not one replacing the
 * other) rather than the permission check being the only thing here.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  /**
   * Constructs the controller around the service implementing its routes.
   * @param notificationsService implements this controller's routes
   */
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Lists the caller's own notifications, newest first.
   * @param user the authenticated caller
   * @param pagination the requested page/pageSize
   * @returns a page of the caller's notifications
   */
  @RequirePermissions('notifications.read')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationQueryDto) {
    return this.notificationsService.list(user.sub, pagination);
  }

  /**
   * Counts the caller's unread notifications, for a nav-bar badge.
   * @param user the authenticated caller
   * @returns the unread count
   */
  @RequirePermissions('notifications.read')
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.notificationsService.unreadCount(user.sub);
    return { count };
  }

  /**
   * Marks one of the caller's own notifications as read.
   * @param user the authenticated caller
   * @param id the notification to mark read
   * @returns the updated notification
   */
  @RequirePermissions('notifications.read')
  @Post(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, id);
  }
}
