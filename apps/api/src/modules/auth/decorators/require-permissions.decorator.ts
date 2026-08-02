import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Restricts a route to callers whose active role grants every listed
 * permission code (checked against `role_permissions`, seeded by
 * `prisma/seed.ts` — see the RBAC matrix in docs/architecture/auth.md).
 * Finer-grained than {@link Roles}: use this when a route's access rule
 * doesn't map cleanly onto "some fixed set of roles" (e.g. it should track
 * the permission matrix even if roles are extended later).
 * @param permissions the permission codes required to call this route
 * @returns a decorator attaching the required permission codes as route metadata
 */
export const RequirePermissions = (...permissions: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSIONS_KEY, permissions);
