# ADR 0006: Narrow bootstrap RLS policies for pre-org-context lookups

- **Status**: Accepted
- **Date**: Fase 2 (discovered while implementing the auth module)

## Context

Building the auth module surfaced a real gap in the multi-tenancy design
(ADR 0003): several lookups the documented auth flows depend on need to
happen **before** the caller has a single-organization context to scope a
transaction to, yet they read tables whose `tenant_isolation` RLS policy
is keyed on exactly that context:

- `POST /auth/login` (multi-membership case) needs to discover **every**
  organization a user belongs to — inherently a cross-organization read
  of `organization_memberships`.
- `POST /auth/refresh` and `POST /auth/logout` need to look up a
  `refresh_tokens` row by its `tokenHash` alone — the whole point of the
  lookup is finding out which organization/membership the token belongs
  to, so that can't be a precondition for the query.
- `GET /invitations/:token` and `POST /invitations/:token/accept` need
  the same by-`tokenHash` lookup on `user_invitations`.

With only the existing `tenant_isolation` policy, `app.current_org_id`
would be unset for all of these, and the fail-closed policy would (by
design) return zero rows — the flows would be unimplementable as
documented.

## Decision

Add a second, narrowly-scoped **permissive** RLS policy to each affected
table (Postgres combines multiple permissive policies for the same
command with `OR`, so these only ever add visibility, never remove it):

- `refresh_tokens` and `user_invitations`: `bootstrap_by_token_hash`,
  keyed on a `app.lookup_token_hash` session variable compared against
  the row's `token_hash`. The security argument: possession of a token's
  exact, unguessable hash **is** the credential — the same trust a caller
  already has by holding the raw token.
- `organization_memberships`: `bootstrap_by_user_id`, keyed on
  `app.current_user_id`, set only immediately after a password has been
  verified in `AuthService.login()`. The security argument: a user may
  always see their own membership rows across every organization they
  belong to — this was never meant to be secret from them.
- `organizations`: `bootstrap_by_membership` (`FOR SELECT` only), keyed
  on the same `app.current_user_id`, allowing visibility into exactly the
  organizations found via the policy above (a subquery against
  `organization_memberships`). Added one implementation step later than
  the first two, once live testing (not just review) surfaced that
  Prisma's `include: { organization: true }` on a
  `organization_memberships` read is a _second_, separately
  RLS-evaluated query against `organizations` — the membership-level
  bootstrap policy alone doesn't extend into that join.

Implemented via `runWithSessionVar()`
(`apps/api/src/prisma/run-with-session-var.ts`), a sibling to
`runInTenantTransaction()` that sets one of these two session variables
instead of `app.current_org_id`, and does **not** apply
`tenantScopingExtension` (these lookups are deliberately cross-tenant).

### General pattern going forward

The `organizations` fix above generalizes: adding a bootstrap policy per
_joined_ relation doesn't scale and is easy to get wrong (it happened
twice — see `docs/technical-log/phase-2.md`). The pattern this codebase
follows instead: a bootstrap lookup (`runWithSessionVar`) fetches only the
**scalar** row needed to learn the organization id — no `include` of
anything RLS-protected. Once that id is known, any further relations are
fetched through a normal, properly `app.current_org_id`-scoped
transaction (`runInTenantTransaction`), which needs no special policy at
all. `AuthService.refresh()` and `findValidInvitation()` both follow this
two-step shape; the _only_ legitimate exception is `login()`/`me()`'s
cross-organization membership discovery, which cannot be scoped to one
org by construction — that one keeps the `organizations` bootstrap
policy above.

## Alternatives considered

- **A separate, more-privileged Postgres role for these lookups**:
  rejected — it would reintroduce a broad RLS bypass for a narrow need,
  widening the blast radius of any bug in this code path to "sees
  everything" instead of "sees exactly the one row it already had the key
  to."
- **Removing RLS's `FORCE` and relying on app-layer scoping alone for
  these three tables**: rejected for the same reason ADR 0003 rejected it
  everywhere else — a single application bug becomes a cross-tenant leak
  instead of being caught by the database.

## Consequences

- Any future table with the same "must be found by a global secret/key
  before org context is known" shape should follow this same narrow,
  documented pattern — not a blanket bypass. Prefer the two-step
  scalar-lookup-then-scoped-transaction shape described above over adding
  another bootstrap policy, unless the query is genuinely,
  irreducibly cross-organization.
- `docs/architecture/multi-tenancy.md` has a "Bootstrap lookups" section
  cross-referencing this ADR; anyone auditing RLS policies on
  `refresh_tokens`, `user_invitations`, `organization_memberships` or
  `organizations` should read this ADR alongside ADR 0003, not just ADR
  0003 alone.
- Verified against a live Postgres 16 instance, both at the SQL level
  (`app.current_user_id` set to a real user shows their memberships; set
  to a random id shows zero rows) and through the running API end-to-end
  (signup, login with 1 and 2+ memberships, select/switch-organization,
  refresh rotation and reuse detection, invitations, password reset) —
  see `docs/technical-log/phase-2.md` for the full list, including the
  two real bugs this live testing caught that a review alone would
  likely have missed.
