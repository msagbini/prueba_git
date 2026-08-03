import type { Prisma } from '@prisma/client';

/**
 * Fields safe to return from the API for a `User` referenced through
 * another entity (e.g. a membership's or job assignment's user) —
 * deliberately excludes `passwordHash` and other fields with no reason to
 * ever leave the auth module. Use as a nested `select` wherever a `User`
 * relation is included, instead of `include: { user: true }`.
 */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
} as const satisfies Prisma.UserSelect;

/** The shape {@link SAFE_USER_SELECT} produces. */
export type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;
