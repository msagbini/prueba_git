import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as exempt from the global JwtAuthGuard (see
 * `modules/auth/guards/jwt-auth.guard.ts`). Used only by the small set of
 * routes that must work without an authenticated session: signup, login,
 * refresh, organization selection, the public invitation preview, and the
 * health check.
 * @returns a decorator that tags the route/class with `isPublic: true` metadata
 */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
