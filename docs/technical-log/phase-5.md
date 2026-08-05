# Fase 5 — Expansión (Reportes y Analytics): technical log

Status: **Fase 5 completa — esperando aprobación para Fase 6**

Tracks what was actually built during Fase 5.

## Planning

- Fase 4's close-out explicitly left Fase 5's scope undecided — "Expansión:
  alcance a definir con el stakeholder." Per the product's own no-invented-
  scope rule, this was resolved with a direct question rather than picked
  unilaterally: offered three concrete candidates (reportes/analytics, más
  verticales de field service, recurrencia de jobs) plus an open option.
  The user chose **reportes y analytics** — real operational dashboards
  (revenue, jobs completed, staff performance) over data that already
  exists from Fase 3, explicitly scoped to _not_ invent a new business
  model or new data the product doesn't already generate.
- Concretized into five reports, chosen to cover the standard SaaS
  reporting surface for the data this schema already has, without
  overreaching: revenue, job-status breakdown, staff performance
  (mentioned explicitly), plus top-clients and outstanding-invoices as the
  natural extensions of "ingresos" that any operator asks for next. No new
  tables — every report reads `Payment`/`Job`/`Invoice`/`StaffProfile`,
  written by modules that already exist.

## Build log

- **`modules/reports`** (`reports.service.ts`, `reports.controller.ts`,
  `reports.module.ts`, `dto/`): five read-only endpoints, all gated by a
  new `reports.read` permission granted only to Owner/Admin (seeded in
  `prisma/seed.ts`, applied to this sandbox's database and verified via a
  direct `role_permissions` query — Dispatcher/Staff/Client explicitly do
  not have it, since this is financial/management data).
  - `GET /reports/revenue` — total + bucketed (day/week/month) completed-
    payment revenue over a date range.
  - `GET /reports/jobs-summary` — job counts by status for jobs created in
    range.
  - `GET /reports/staff-performance` — per-staff completed-job count and
    hours worked (from `actualStart`/`actualEnd`), sorted descending.
  - `GET /reports/top-clients` — highest-revenue clients plus job count.
  - `GET /reports/outstanding-invoices` — current snapshot of unpaid
    invoice balance, total and overdue.
  - **A real architectural decision, not an oversight**: the tenant-
    scoping Prisma extension does not auto-inject `organizationId` into
    `groupBy`/`aggregate` (documented in its own file as a known
    limitation) — only into `findMany`/`count`/etc. A reporting feature is
    exactly the place a raw-SQL or `groupBy` approach could quietly leak
    cross-tenant data if the manual scoping were ever gotten wrong. Every
    report here instead uses `findMany` (auto-scoped, RLS as the backstop
    regardless) and aggregates in TypeScript — simpler to verify correct
    than hand-scoped SQL, and fast enough at the per-organization data
    volumes this product operates at. Documented at length in
    `modules/reports/README.md` and the service's class doc so a future
    contributor doesn't "optimize" this into an unscoped raw query.
  - Money fields use `Prisma.Decimal` accumulation (`.plus()`), matching
    the existing pattern in `invoices.service.ts`, not floating-point
    arithmetic — avoids rounding drift when summing many payments.

- **A real, load-bearing gap found while building the staff-performance
  report, fixed at the root**: `Job.actualStart`/`actualEnd` have existed
  in the schema since Fase 2 (justified there as "when work actually
  happened, as opposed to when it was scheduled") but `UpdateJobDto` never
  exposed them — there was no way, through any endpoint, to ever set
  them. Discovered live: a `PATCH /jobs/:id` with `actualStart`/`actualEnd`
  400'd with `"property actualStart should not exist"` (the global
  `ValidationPipe`'s `forbidNonWhitelisted` rejecting them). This made
  "hours worked" permanently zero for every organization, in practice
  unreachable dead code — the same category of bug as Fase 3's missing
  `UserInvitation.clientId` wiring. Fixed by adding both fields to
  `UpdateJobDto` (`@IsOptional() @IsDateString()`, identical shape to the
  existing `scheduledStart`/`scheduledEnd`) and wiring them through
  `JobsService.update` via the same `toDateOrUndefined` helper already
  used for the other two. No schema or migration change — the columns
  already existed. Verified live via `curl` (the field now saves
  correctly) and via e2e (a job with a 3-hour `actualStart`/`actualEnd`
  window reports exactly `hoursWorked: 3` for the assigned staff member).

- **Live verification, then e2e regression coverage**: built a full
  fixture by hand first via `curl` — client, service, completed job with
  `actualStart`/`actualEnd`, invoice, a partial payment (150 of 200), and
  a Staff member assigned to the job — and confirmed every report's exact
  numbers (revenue `150`, one `COMPLETED` job, staff `hoursWorked: 3`,
  top client revenue `150`/`jobCount: 1`, outstanding balance `50`),
  plus a `403` for a Staff-role caller. Then turned the same fixture into
  a new `describe('Reports', ...)` block in
  `apps/api/test/business-flows.e2e.spec.ts` (own dedicated org, per-run
  unique data, same pattern as the existing "Free plan limits"/"Stripe
  webhooks" blocks), run twice back to back to confirm re-runnability
  against this sandbox's non-pristine database.

- **Comprehensive verification pass**: `pnpm turbo run lint build test`
  across the whole monorepo with the cache forced off, all 9 tasks green,
  including 31 `apps/api` tests (27 e2e + 4 in the RLS integration spec).
  `docs/api/openapi.yaml` regenerated — confirms the five new routes and
  the `Job.actualStart`/`actualEnd` DTO fields, and that
  `/webhooks/stripe` still correctly stays excluded.
  `modules/reports/README.md` written (the five endpoints, their query
  params, and the groupBy/aggregate scoping decision);
  `modules/jobs/README.md` updated for the new `PATCH` fields.

## Fase 5 — cierre

- **Alcance decidido con el usuario, no inventado**: ante un "Expansión"
  sin definir, se preguntó directamente en vez de asumir — reportes y
  analytics fue la elección explícita, acotada a datos que el producto ya
  genera desde Fase 3.
- **Cinco reportes reales, no cosméticos**: cada uno devuelve números
  exactos verificados contra un fixture construido a mano (ingresos,
  jobs por estado, performance de staff con horas trabajadas, clientes
  top, facturas pendientes) — no placeholders ni datos simulados.
- **Decisión de arquitectura documentada, no solo tomada**: evitar
  `groupBy`/SQL crudo para las agregaciones, dado que la extensión de
  tenant-scoping no los cubre automáticamente — el riesgo real de fuga
  cross-tenant en una feature que por naturaleza mira a través de muchas
  filas se evitó por diseño, no por suerte.
- **Bug real de causa raíz encontrado y corregido** (no parcheado):
  `actualStart`/`actualEnd` de `Job` existían en el schema desde Fase 2
  sin ningún endpoint que los expusiera, dejando "horas trabajadas"
  permanentemente en cero — corregido en el DTO/servicio, con el mismo
  patrón (`toDateOrUndefined`) ya usado para campos de fecha hermanos, y
  verificado en vivo antes de escribir el test de regresión.
- **Permiso nuevo, seedeado y verificado en la base de datos real**:
  `reports.read` se añadió al seed, se corrió contra la base del sandbox,
  y se confirmó por consulta SQL directa que solo Owner/Admin lo tienen
  — no se asumió que el seed "debería" haber funcionado.

**Fase 5 completa — esperando aprobación para Fase 6.** Por la regla del
producto de no avanzar de fase sin aprobación, Fase 6 no comienza hasta
que el stakeholder lo confirme explícitamente y, si su alcance no está ya
decidido, lo defina.
