import { SetMetadata } from '@nestjs/common';
import type { RoleCode } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to callers whose active membership role is one of
 * `roles` — enforced by `RolesGuard`. See the RBAC matrix in
 * docs/architecture/auth.md.
 * @param roles the role codes allowed to call this route
 * @returns a decorator attaching the allowed roles as route metadata
 */
export const Roles = (...roles: RoleCode[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
