-- Adds narrow, additional permissive RLS policies for a handful of
-- lookups that legitimately need to happen *before* an organization
-- context is known. Postgres combines multiple permissive policies for
-- the same table/command with OR, so these only ever ADD visibility on
-- top of the existing tenant_isolation policy -- they never take
-- visibility away, and they never grant visibility into another
-- organization's data broadly (see docs/architecture/multi-tenancy.md,
-- "Bootstrap lookups" section, and ADR 0006).
--
-- app.lookup_token_hash: possession of a token's exact hash is itself the
-- credential (the caller already has the raw, unguessable secret) --
-- used by refresh_tokens (POST /auth/refresh, POST /auth/logout) and
-- user_invitations (GET /invitations/:token, POST /invitations/:token/accept),
-- both looked up by a globally-unique tokenHash before the caller has
-- any org context.
--
-- app.current_user_id: set only after a password has just been verified
-- (POST /auth/login) -- used by organization_memberships to discover
-- every organization the authenticated user belongs to, which is
-- inherently a cross-organization query from the database's point of
-- view and cannot be scoped to a single app.current_org_id in advance.

CREATE POLICY bootstrap_by_token_hash ON "refresh_tokens"
  USING (token_hash = NULLIF(current_setting('app.lookup_token_hash', true), ''))
  WITH CHECK (token_hash = NULLIF(current_setting('app.lookup_token_hash', true), ''));

CREATE POLICY bootstrap_by_token_hash ON "user_invitations"
  USING (token_hash = NULLIF(current_setting('app.lookup_token_hash', true), ''))
  WITH CHECK (token_hash = NULLIF(current_setting('app.lookup_token_hash', true), ''));

CREATE POLICY bootstrap_by_user_id ON "organization_memberships"
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
