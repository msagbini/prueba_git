-- Found while implementing AuthService.me()/login(): the
-- bootstrap_by_user_id policy on organization_memberships (see migration
-- auth_bootstrap_policies) lets a caller discover their own membership
-- rows by app.current_user_id, but Prisma's `include: { organization: true }`
-- issues a *separate* row-security-checked lookup against "organizations"
-- for each one -- which still only allows `id = app.current_org_id`, unset
-- in this context. The join silently returned null instead of the
-- organization, which Prisma then rejected as an "inconsistent query
-- result" for a required relation.
--
-- Fix: a read-only bootstrap policy granting visibility into exactly the
-- organizations the caller (per app.current_user_id) actually belongs to
-- -- narrower than "any org", scoped via the same membership table this
-- mirrors. FOR SELECT only: nothing writes to "organizations" through
-- this bootstrap context, only the normal tenant-scoped path does.

CREATE POLICY bootstrap_by_membership ON "organizations"
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_memberships
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
