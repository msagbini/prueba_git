# modules/auth

Authentication, session, RBAC and invitation module — the concrete
implementation of [`docs/architecture/auth.md`](../../../../docs/architecture/auth.md),
ADR 0004 (token strategy), ADR 0005 (multi-org membership) and ADR 0006
(bootstrap RLS policies).

## Structure

```
auth.controller.ts        HTTP surface: request/response shaping, cookies
auth.service.ts            All flow logic (signup, login, refresh, invitations, ...)
auth.module.ts              Wiring: registers JwtAuthGuard globally via APP_GUARD
auth.types.ts                Shared response shapes
token.util.ts                 Raw token generation + hashing
slug.util.ts                   Organization name → slug
dto/                              class-validator request DTOs
strategies/jwt.strategy.ts        Verifies the access token, populates req.user
guards/
  jwt-auth.guard.ts               Global guard; @Public() opts a route out
  optional-jwt-auth.guard.ts      Never rejects — used only by invitation accept
  roles.guard.ts                  @Roles(...) enforcement
  permissions.guard.ts            @RequirePermissions(...) enforcement
decorators/
  current-user.decorator.ts       @CurrentUser() — reads req.user
  roles.decorator.ts               @Roles(...)
  require-permissions.decorator.ts @RequirePermissions(...)
email/
  email.service.ts                 Port (abstract class)
  console-email.service.ts         Fase 2 stub implementation (logs only)
```

## Endpoints

| Method & path                        | Auth                    | Notes                                                        |
| ------------------------------------ | ----------------------- | ------------------------------------------------------------ |
| `POST /auth/signup`                  | Public                  | Creates org + owner in one transaction                       |
| `POST /auth/login`                   | Public                  | Returns tokens, or a selection step for 2+ memberships       |
| `POST /auth/select-organization`     | Public (selectionToken) | Completes a multi-membership login                           |
| `POST /auth/switch-organization`     | Required                | Move to a different membership without logging out           |
| `POST /auth/refresh`                 | Public (refresh token)  | Rotates; reuse of a revoked token revokes the family         |
| `POST /auth/logout`                  | Public (refresh token)  | Idempotent                                                   |
| `GET /auth/me`                       | Required                | Profile + every membership                                   |
| `POST /auth/verify-email`            | Public                  |                                                              |
| `POST /auth/forgot-password`         | Public                  | Never reveals whether the email exists                       |
| `POST /auth/reset-password`          | Public                  |                                                              |
| `POST /organizations/me/invitations` | Required, Owner/Admin   | `clientId` required (and only valid) when `roleCode: CLIENT` |
| `GET /invitations/:token`            | Public                  | Preview before accepting                                     |
| `POST /invitations/:token/accept`    | Public, optional auth   | Branches on whether the email already has an account         |

## Using guards in other modules

```ts
@UseGuards(RolesGuard)
@Roles(RoleCode.OWNER, RoleCode.ADMIN)
@Delete('clients/:id')
remove(...) { ... }
```

`RolesGuard`/`PermissionsGuard` are exported from `AuthModule` for exactly
this — every other feature module imports `AuthModule` (or just these
guards) rather than re-implementing role checks.

## Known Fase 2 simplifications

- Email is a logging stub (`ConsoleEmailService`) — see ADR list in
  `docs/technical-log/phase-2.md` for the real-provider decision, deferred
  past this phase.
- The refresh-token cookie is always set (web pattern) _and_ the raw
  refresh token is always included in the JSON body (mobile pattern) —
  simplest uniform contract given the backend can't reliably distinguish
  client type from a REST call alone.

## Testing

No dedicated auth unit/integration test files were added in Fase 2 —
every flow (signup, login with 1 and 2+ memberships, select/switch
organization, refresh rotation and reuse-family revocation, logout
idempotency, forgot/reset password, invitations both branches, RBAC
enforcement) was instead verified end-to-end against a live, running
instance of the API and a real PostgreSQL database — see
`docs/technical-log/phase-2.md` for the full list and the two real bugs
that live testing (not static review) caught. Adding automated e2e/unit
coverage for these flows is flagged as follow-up work, not done here.
