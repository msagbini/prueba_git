# Authentication & authorization

DOS rolls its own authentication (no third-party auth-as-a-service), built
around one non-negotiable constraint: **a user can belong to more than one
organization**, and every session is scoped to exactly one of them at a
time.

## Identity model

- **`users`** is a global identity: email, password hash, profile fields.
  It has no `organization_id` — see
  [`multi-tenancy.md`](./multi-tenancy.md#the-one-exception-users).
- **`organization_memberships`** links a user to an organization with a
  role (`owner | admin | dispatcher | staff | client`) and, for the
  `client` role, to a specific `clients` row. A user has one membership row
  per organization they belong to.
- **Roles are fixed system roles** in Fase 2 (see
  [ADR 0004](../adr/0004-auth-token-strategy.md)); per-organization custom
  roles are a documented future extension, not built now.

## Password storage

`argon2id` (OWASP's current recommendation), via the `argon2` npm package.
This requires native bindings at build time — confirmed against the
deploy image before Fase 7 (infra hardening), flagged as a non-blocking
open item for now.

## Tokens

- **Access token**: JWT, ~15 minute lifetime. Payload:
  `{ sub: userId, org: organizationId, membershipId, role: roleCode, iat, exp }`.
  Every field an endpoint needs to authorize a request is in the token —
  no database round-trip needed to know "who is this and what can they do
  in this organization."
- **Refresh token**: opaque random value, ~30 day lifetime, stored
  **hashed** in `refresh_tokens`, and — critically — linked to a specific
  `membership_id`. A refresh token is scoped to one organization; refreshing
  it never changes which organization the resulting access token is for.
  - **Web**: delivered as an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
    The access token is returned in the response body and held in memory by
    the SPA (never persisted to `localStorage`, to limit XSS blast radius).
  - **Mobile**: both tokens are returned in the response body; the mobile
    client is responsible for storing them in the platform secure storage
    (Keychain on iOS, Keystore on Android) — cookies aren't a natural fit
    for a native app's HTTP client.
- **Rotation**: every `POST /auth/refresh` revokes the presented token and
  issues a new pair, chained via `replaced_by_token_id`. If a
  already-revoked token is presented again (a sign of theft/replay), the
  **entire token family** is revoked and the user must log in again.

## Login flow (multi-organization aware)

```
POST /auth/login { email, password }
        │
        ▼
  credentials valid?
        │
   ┌────┴────┐
   │ 1 active │ N active
   │ membership│ memberships
   ▼          ▼
 issue tokens   return membership list
 for that org   (no tokens yet)
                        │
                        ▼
          POST /auth/select-organization { organizationId }
                        │
                        ▼
              issue tokens for that org
```

Switching organizations later (without logging out) goes through
`POST /auth/switch-organization`, which mints a new token pair for a
different membership the user already holds. The previous pair is **not**
force-revoked — a user can keep two organizations open in two browser tabs
at once — it simply expires on its own schedule or is revoked by an
explicit logout.

`GET /auth/me` returns the user's profile plus the full list of their
`organization_memberships`, which is what a workspace-switcher UI needs to
render.

## Signup

`POST /auth/signup` creates an `organizations` row, a `users` row (or
attaches to an existing one — see invitations below for the "email already
exists" case), and an `organization_memberships` row with `role=owner`, in
a single transaction. A verification email is sent through an `EmailService`
interface; the concrete provider (SES, Postmark, etc.) is an infra decision
deferred past Fase 2 — only the port is defined here.

## Invitations

`POST /organizations/me/invitations` (Owner/Admin only) creates a
`user_invitations` row and sends an email with a token link.

Accepting an invitation branches on whether the invited email already has
an account:

- **New email** — `POST /invitations/:token/accept` with
  `firstName/lastName/password` creates the `users` row and the
  `organization_memberships` row together, marks the invitation accepted,
  and auto-logs the user in (email is trusted because the invite link
  proves ownership).
- **Existing email** — acceptance requires being authenticated as that
  user first (log in, then accept); only the new
  `organization_memberships` row is created. The existing password is
  never touched by this flow.

## Guards

- `JwtAuthGuard` is registered globally; routes opt out with `@Public()`
  (used only by signup, login, refresh, `select-organization`, and the
  public invitation-preview endpoint).
- `RolesGuard` + `@Roles(...)` for route-level role checks.
- `PermissionsGuard` + `@RequirePermissions(...)` for the finer-grained
  `role_permissions` matrix (see the RBAC table in root `README.md`'s
  linked module docs).
- Row-level ownership (a Staff member seeing only their assigned jobs, a
  Client seeing only their own records) is enforced in each module's
  service layer on top of these guards — see individual module READMEs
  under `apps/api/src/modules/`.
