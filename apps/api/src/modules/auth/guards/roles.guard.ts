import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@prisma/client';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Enforces `@Roles(...)` route metadata against the caller's active
 * membership role (from the JWT, already validated by `JwtAuthGuard`,
 * which always runs first — Nest guarantees all guards run before any
 * route without `@Roles()` metadata is allowed through unchanged).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * Constructs the guard around the reflector it reads route metadata from.
   * @param reflector used to read the `@Roles()` metadata off the route/class
   */
  constructor(private readonly reflector: Reflector) {}

  /**
   * Checks the caller's role against the route's required role list.
   * @param context the current execution context
   * @returns true if no roles are required, or the caller's role is among the required ones
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.role;
    return Boolean(role && requiredRoles.includes(role as RoleCode));
  }
}
