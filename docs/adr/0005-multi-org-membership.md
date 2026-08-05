# ADR 0005: A user can belong to multiple organizations

- **Status**: Accepted
- **Date**: Fase 2

## Context

The product's monetization plan includes white-label and multi-client
scenarios (agencies/contractors managing several businesses). A person in
that position needs to operate more than one organization without juggling
separate email addresses/accounts. This was raised and decided explicitly
with the product stakeholder during Fase 2 planning (see
[`docs/technical-log/phase-2.md`](../technical-log/phase-2.md)) — the
simpler single-org-per-user model was the initial default but was
overridden in favor of this one.

## Decision

`users` is a global identity (no `organization_id`). Access to an
organization is represented by an `organization_memberships` row
(`user_id`, `organization_id`, `role_id`, optional `client_id`). A JWT
access token is scoped to exactly one **active** membership at a time; a
user with multiple memberships selects one at login
(`POST /auth/select-organization`) or switches later
(`POST /auth/switch-organization`). Full flow in
[`../architecture/auth.md`](../architecture/auth.md).

## Alternatives considered

- **One organization per user** (simpler): rejected because it directly
  contradicts a named business scenario (agencies/contractors/white-label)
  in the product's own monetization plan, and retrofitting multi-org
  support onto a single-org auth model later is a breaking migration of the
  `users` table, the JWT shape, and every "current org" assumption in the
  codebase — far more expensive than building it correctly now.

## Consequences

- Every table that used to hang directly off `users` (e.g. `staff_profiles`
  in the original single-org draft of this schema) instead hangs off
  `organization_memberships`, since a "staff profile" is inherently
  specific to one organization's employment relationship, not to the
  global identity.
- The JWT and refresh token are both scoped to a `membership_id`, not just
  a `user_id` — refreshing a token never silently changes which
  organization the caller is acting in.
- The login flow has a real branch (single membership → immediate tokens;
  multiple → an organization-selection step) that both `apps/web` and
  `apps/mobile` must implement, not just the API.
