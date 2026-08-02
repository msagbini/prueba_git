import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/**
 * Enforces `@RequirePermissions(...)` route metadata against the
 * `role_permissions` grants seeded for the caller's active role (see
 * `prisma/seed.ts` and the RBAC matrix in docs/architecture/auth.md).
 * Queries `PrismaService` directly (not the tenant-scoped client) because
 * `roles`/`permissions`/`role_permissions` are global reference tables,
 * not tenant data.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  /**
   * Constructs the guard around the reflector and Prisma client it checks grants with.
   * @param reflector used to read the `@RequirePermissions()` metadata off the route/class
   * @param prisma used to look up the caller's role's granted permissions
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Checks the caller's role against the route's required permission codes.
   * @param context the current execution context
   * @returns true if no permissions are required, or the caller's role grants all of them
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roleCode = request.user?.role;
    if (!roleCode) {
      return false;
    }

    const grantedCount = await this.prisma.rolePermission.count({
      where: {
        role: { code: roleCode as RoleCode },
        permission: { code: { in: requiredPermissions } },
      },
    });

    return grantedCount >= requiredPermissions.length;
  }
}
