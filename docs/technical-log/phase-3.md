# Fase 3 — MVP operativo: technical log

Status: **Fase 3 completa — esperando aprobación para Fase 4**

Tracks what was actually built during Fase 3, in the order it happened.
Fase 2 built the architecture, schema, auth and API contract (controllers,
DTOs, Swagger, guards) for the 11 business modules, with every service
method stubbed via `NotImplementedException`. Fase 3's job was narrow and
concrete: implement the real logic behind that already-reviewed contract
— no new routes, no schema fields invented beyond what a genuine gap in
the existing contract required (two such gaps came up; both are called
out below with why they were real, not scope creep).

## Planning

- User approval to proceed ("Sigue con todo") received after Fase 2's
  close-out, which had explicitly marked the project as awaiting
  approval before starting Fase 3 (per the product's own
  no-phase-advancement-without-approval rule).
- Scope and order confirmed against the Fase 2 contract itself (every
  controller/DTO/route already existed; this phase never touched routes
  or DTOs except to fix the two gaps below) rather than re-planned from
  scratch.

## Build log

- **Shared audit-log writer** (`modules/audit-logs/audit-log-writer.service.ts`):
  `AuditLogWriterService`, exported from `AuditLogsModule`, gives every
  business module a single `record()` call to append before/after state
  to the append-only `audit_logs` table inside the same tenant-scoped
  transaction as the mutation itself — an audit entry can't exist without
  the change it records, or vice versa. `AuditLogsService.list()` (the
  read side) implemented for real at the same time.

- **Organizations + memberships**
  (`modules/organizations/organizations.service.ts`,
  `modules/memberships/memberships.service.ts`): real `getMine`/
  `updateMine` and `list`/`update`/`remove`. Memberships gained a guard
  against ever leaving an organization with zero active Owners (demoting,
  suspending, or removing the last one is rejected with 400) — a real
  data-integrity rule, not part of the original DTO contract but implied
  by the product needing to always be manageable by someone.
  - **Two real bugs found by live verification**: (1) the members list
    serialized the full `User` row, including `passwordHash`, over the
    API — fixed with a shared `SAFE_USER_SELECT`
    (`src/common/safe-user.ts`) used everywhere a `User` is joined in,
    instead of `include: { user: true }`. (2) the last-Owner guard's
    count query initially used the plain (unscoped) `PrismaService`;
    `OrganizationMembership` is RLS-protected, so that connection has no
    `app.current_org_id` set and RLS fails closed to zero rows — always
    reporting "no Owners left" and blocking every legitimate change.
    Fixed by using the request's tenant-scoped client instead.

- **Users** (`modules/users/users.service.ts`): `list`/`findOne` scoped
  to users sharing a membership with the caller's active org (`users` has
  no `organizationId`/RLS, so this is enforced at the service layer via
  the membership join). `update`/`remove` allowed for the caller
  themselves or an Owner/Admin; `remove` deletes the membership (not the
  global `User` row) by delegating to `MembershipsService`, so the
  last-Owner guard lives in exactly one place. Verified live: cross-org
  404 (an org cannot see or edit another org's user by id).

- **Clients** (`modules/clients/clients.service.ts`): full CRUD plus
  addresses. `remove` soft-deletes (`deletedAt`) rather than deleting —
  a client's job/invoice history must stay attributable. First module
  wired to `PermissionsGuard`/`@RequirePermissions` (`clients.manage`/
  `clients.read`) instead of the coarser `@Roles` used in Fase 2.
  - **Found and fixed a real RBAC seed bug**: Dispatcher had
    `clients.manage` but not `clients.read` in `prisma/seed.ts`, unlike
    every other module (jobs, invoices, payments, services, staff) where
    Dispatcher has both — a Dispatcher could create/edit clients but not
    list or view them. Added the missing grant.

- **Services** (`modules/services/services.service.ts`): categories +
  catalog CRUD. `remove` deactivates (`isActive: false`) rather than
  deleting — `Service` has no `deletedAt`, and `JobService`/
  `InvoiceLineItem` reference a service by id, so a hard delete would
  either violate the foreign key or orphan billing history. Enforces the
  create/update DTOs' documented-but-previously-unvalidated rule that
  `PER_UNIT` pricing requires a `unitLabel` (400 otherwise).

- **Staff** (`modules/staff/staff.service.ts`): `list`/`findOne`/
  `update` for `StaffProfile`. No `POST /staff` route exists in the
  contract — creation is a side effect: `AuthService.acceptInvitation`
  now creates a blank `StaffProfile` when the invitation's role is Staff,
  and `MembershipsService.update` does the same when a membership is
  promoted into Staff, both matching the "creation happens via the
  invitation flow" note already documented in the Fase 2 stub.
  - **Found and fixed a real bug**: `PATCH /staff/:id` 500'd on
    `hireDate` — Prisma's `@db.Date` columns reject a bare
    `"YYYY-MM-DD"` string (what `class-validator`'s `@IsDateString()`
    produces and what the DTO carries), even though it passes DTO
    validation; it needs an actual `Date` instance. Fixed with a shared
    `toDateOrUndefined()` helper (`src/common/to-date.ts`) rather than a
    one-off patch, since `Invoice.issueDate`/`dueDate` have the same
    shape and were about to hit the same bug.

- **Jobs** (`modules/jobs/jobs.service.ts`): full CRUD plus staff
  assignment and billed services. `remove` soft-deletes. Validates
  referential integrity the DTOs don't validate themselves — `clientId`,
  `serviceAddressId`, assignment `membershipId`, job-service `serviceId`
  must all belong to the caller's org (400, not a raw foreign-key 500).
  `createJobService` snapshots the service's current `basePrice` into
  `unitPriceSnapshot`. Implements the row-level visibility the Fase 2
  contract promised in its class doc but never built: `list`/`findOne`
  filter to a Staff caller's own assignments or a Client caller's own
  `clientId` — Owner/Admin/Dispatcher see everything.
  - **Verified live**: an unassigned Staff caller sees zero jobs, the
    same caller sees the job once assigned via
    `POST /jobs/:id/assignments`, and is correctly 403'd attempting to
    update it (`jobs.manage` is never granted to Staff).

- **Invoices** (`modules/invoices/invoices.service.ts`): invoice +
  line-item creation. Generates an organization-unique `invoiceNumber`
  (`INV-0001`, `INV-0002`, ...) with a retry-on-conflict loop against the
  `unique(organizationId, invoiceNumber)` constraint, since two
  concurrent creates in the same org could otherwise race on the same
  count-based number. `createLineItem` recomputes `subtotal`/`total` from
  every line item after each insert, per the class doc's
  "derived, not settable" contract; `taxAmount` stays `0` — there is no
  tax rate/rule anywhere in this schema to compute it from, and adding
  one wasn't part of this contract. Client callers only see their own
  invoices.

- **Payments** (`modules/payments/payments.service.ts`): payment
  recording. A created payment is treated as already received
  (`status: COMPLETED`, `paidAt: now()`) rather than `PENDING` — there's
  no gateway integration in this phase (Stripe is Fase 4), so recording a
  payment here means the money already changed hands. Once an invoice's
  completed payments cover its total, the invoice is automatically marked
  `PAID`.
  - **Verified live**: a partial payment (40 of a 100 total) leaves the
    invoice `DRAFT`; a second payment completing the balance flips it to
    `PAID` automatically.

- **Comprehensive live verification pass**: ran `turbo run lint build
test` across the whole monorepo (9/9 tasks, including the live
  `apps/api` Postgres RLS integration tests), then a fresh end-to-end
  flow exercising every new module together — signup, client/service/
  job/invoice/payment creation, staff invitation and promotion, and the
  `audit-logs` list showing the resulting trail.
  - **Found and fixed a real, load-bearing gap**: the Client-role
    row-level visibility just built into jobs/invoices/payments depends
    on `OrganizationMembership.clientId` — but the invitation flow never
    had anywhere to carry a `clientId` from invite to accept (a Client
    invitation could be created and accepted, yet the resulting
    membership's `clientId` was always `null`), making that entire
    feature unreachable dead code in practice. Fixed by adding
    `UserInvitation.clientId` (migration
    `20260803104353_invitation_client_link`, nullable FK to `clients`,
    RLS already covered by the table's existing `organizationId`
    policy), threaded through `InviteUserDto` (new optional `clientId`,
    required and validated when `roleCode: CLIENT`, rejected otherwise),
    `AuthService.createInvitation` and `AuthService.acceptInvitation`.
    Verified live: inviting a Client without `clientId` 400s; inviting
    one with a valid `clientId` and accepting produces a membership whose
    `GET /jobs`/`GET /invoices` correctly show only that client's
    records, confirmed against a second client's job/invoice in the same
    organization which do not appear.
  - Confirmed the `audit_logs` trail captures actions across modules
    (`client.created`, `job.created`, `invoice.created`, ... — one entry
    per mutation, with before/after state) for the session's activity.

- **Docs closeout**: `docs/api/openapi.yaml` regenerated (`pnpm
docs:api`) against the fully implemented API; `docs/erd/erd.md` updated
  for the `UserInvitation.clientId` addition (new field + `Client
||--o{ UserInvitation` relation); every implemented module's
  `README.md` rewritten to drop the "Fase 2 stub" note and document the
  real permission codes, row-level visibility rules, and side effects
  (soft-delete/deactivate, audit logging) each route now has;
  `CHANGELOG.md` and root `README.md` status updated.

## Fase 3 — cierre

Todos los 11 módulos de negocio de Fase 2 tienen implementación real
(10 estaban stub; `roles` ya estaba completo desde Fase 2). Resumen:

- **RBAC en las rutas de negocio**: se migró de `@Roles` (grueso) a
  `PermissionsGuard`/`@RequirePermissions` (fino, contra la matriz
  `role_permissions` sembrada en Fase 2) en todos los módulos nuevos,
  manteniendo `@Roles` donde ya existía (organizations, memberships,
  audit-logs) por ser Owner/Admin-only sin necesidad de granularidad
  extra.
- **Visibilidad por fila**: Staff solo ve sus jobs asignados; Client solo
  ve sus propios jobs/invoices/payments — implementado y verificado en
  vivo, incluyendo el fix del vínculo invitación↔cliente que lo hacía
  inalcanzable.
- **Integridad referencial**: toda relación cross-entity que un DTO no
  valida por sí solo (clientId, serviceAddressId, membershipId,
  serviceId, invoiceId) se valida explícitamente contra el tenant activo,
  devolviendo 400 en vez de un error crudo de foreign key.
- **Auditoría real**: cada mutación en los 9 módulos de negocio escribe
  una entrada en `audit_logs` con estado antes/después, verificado en
  vivo.
- **Bugs reales encontrados y corregidos en la causa raíz** (no
  parcheados): fuga de `passwordHash`, guard de "último Owner" corriendo
  contra el cliente Prisma equivocado, permiso `clients.read` faltante
  para Dispatcher en el seed, conversión de fecha para columnas
  `@db.Date`, y el vínculo invitación↔cliente faltante — cada uno
  documentado arriba con su verificación en vivo.

**Reglas de construcción del producto — verificación de cumplimiento**:
sin rutas ni campos inventados salvo dos gaps reales y justificados
(guard de último-Owner, vínculo invitación↔cliente — ambos documentados
arriba con el porqué); sin soluciones frágiles (cada bug se corrigió en
la raíz, con un helper compartido cuando el mismo patrón se repetía —
`SAFE_USER_SELECT`, `toDateOrUndefined`); sin placeholders vacíos (cada
método stub de Fase 2 tiene ahora lógica real, verificada contra Postgres
en vivo, no simulada); documentación actualizada en el mismo commit que
el código que describe.

**Fase 3 completa — esperando aprobación para Fase 4** (Monetización:
integración de Stripe para pagos, planes/suscripciones). Por la regla
del producto de no avanzar de fase sin aprobación, Fase 4 no comienza
hasta que el stakeholder lo confirme explícitamente.
