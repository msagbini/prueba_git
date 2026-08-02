# ADR 0004: JWT access tokens + rotating opaque refresh tokens

- **Status**: Accepted
- **Date**: Fase 2

## Context

Auth needs to work for two very different clients — a browser SPA and a
native mobile app — while keeping the access token stateless (so every
request doesn't need a database round-trip to know the caller's
organization and role) and the long-lived credential revocable.

## Decision

- **Access token**: short-lived (~15 min) JWT carrying
  `{ sub, org, membershipId, role }`.
- **Refresh token**: opaque random value, stored hashed server-side,
  rotated on every use, with reuse-detection (a revoked token being
  presented again revokes its whole family).
- **Delivery differs by client**: web gets the refresh token as an
  `httpOnly`/`Secure`/`SameSite=Strict` cookie; mobile gets both tokens in
  the response body for secure-storage persistence (Keychain/Keystore).
- Roles are **fixed system roles** (`owner|admin|dispatcher|staff|client`)
  for Fase 2; per-organization custom roles are a documented future
  extension.

## Alternatives considered

- **Long-lived JWT only (no refresh token)**: simpler, but an issued token
  can't be revoked before it expires — unacceptable for a product handling
  business-critical scheduling/invoicing data where "someone left the
  company, cut their access now" is a real requirement.
- **Server-side session only (no JWT)**: every request needs a database
  lookup to authorize; works fine for the web app but is a worse fit for
  mobile clients that want to avoid a round-trip on every screen
  transition, and doesn't naturally support the org-scoped-claims-in-token
  pattern used throughout the API.

## Consequences

- `argon2id` (via the `argon2` package) is used for password hashing —
  current OWASP recommendation. It requires native bindings, which must be
  confirmed to build cleanly in the CI/deploy image (tracked as an open
  item, not blocking Fase 2).
- Custom per-organization roles, when built later, must not break the
  fixed-role assumption baked into the JWT's `role` claim shape without a
  deliberate migration — flagged here so it isn't done casually.
