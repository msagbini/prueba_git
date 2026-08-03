/**
 * Converts a validated (`@IsDateString()`) ISO date string to a `Date`
 * instance for a Prisma `@db.Date` field — those fields reject a bare
 * string like `"2026-01-15"` at the Prisma Client layer (it expects a
 * `Date` object or a full ISO-8601 datetime), even though `class-
 * validator`'s `@IsDateString()` accepts a plain date.
 * @param value the date string to convert, or `undefined`
 * @returns the equivalent `Date`, or `undefined` if `value` is `undefined`
 */
export function toDateOrUndefined(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}
