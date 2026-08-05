/**
 * Turns an organization name into a URL-safe slug, suffixed with part of
 * a UUID to keep it unique without a retry-on-collision loop.
 * @param name the organization's display name
 * @param uniqueSuffix a value (typically the org's own id) to derive the disambiguating suffix from
 * @returns a lowercase, hyphenated slug
 */
export function slugifyOrganizationName(name: string, uniqueSuffix: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'org'}-${uniqueSuffix.slice(0, 8)}`;
}
