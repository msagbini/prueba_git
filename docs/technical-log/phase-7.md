# Fase 7 — Escalabilidad: technical log

Status: **Fase 7 completa — esperando aprobación para Fase 8**

Tracks what was actually built during Fase 7.

## Planning

- Per the standing authorization ("Dale sin mi autorización siempre y
  cuando hayas doble chequeado y testeado todo... analizado y
  optimizado"), proceeded directly into Fase 7 without a scope
  check-in — unlike Fase 5, this phase's scope was already concrete and
  named, not open-ended: the original 8-phase roadmap calls it
  "Escalabilidad," and two prior phases had already flagged specific,
  non-blocking open items pointing straight at it —
  `docs/architecture/auth.md` ("argon2... confirmed against the deploy
  image before Fase 7") and `docs/technical-log/phase-6.md`
  ("react-native-keychain against a real device"). The API-side item
  (argon2/deploy image) was addressable in this sandbox; the mobile
  native-device item was not (no Android SDK/Xcode here either, same
  gap already documented in Fase 6) and stays open.
- Concretized into: a real production Docker image for `apps/api`
  (resolving the argon2 open item), production hardening middleware
  (security headers, rate limiting, compression, graceful shutdown —
  the standard "scalability" checklist for a service meant to run
  behind a load balancer with multiple replicas), and wiring the image
  build into CI so a broken production build is caught before merge.
  Deliberately did **not** invent cloud deployment targets (a specific
  cloud provider, Kubernetes manifests, a registry) — nobody has
  decided those yet, and guessing would violate the product's own
  no-invented-infrastructure rule the same way inventing a business
  model would have in Fase 4.

## Build log

- **Production Dockerfile** (`apps/api/Dockerfile`, `.dockerignore`):
  multi-stage build using `pnpm deploy --legacy --prod` (not `cp`/manual
  copying) to extract a self-contained, production-only install for
  `apps/api` from the pnpm workspace — the officially supported
  mechanism for this exact scenario. `node:22-slim` (Debian/glibc), not
  `-alpine` (musl); non-root user; `dumb-init` as PID 1 so signals reach
  Node's shutdown path instead of being swallowed.
  - **A real bug found and fixed via a local dry run, before ever
    touching Docker**: pnpm v10's `deploy` command refuses to run
    against a workspace without `inject-workspace-packages=true` set,
    failing immediately with `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`.
    Running `pnpm --filter @dos/api deploy --prod /tmp/out-api` directly
    in this sandbox (no Docker needed — `pnpm deploy` is pure filesystem
    work) caught this before it could fail mid-`docker build`. Fixed
    with `--legacy` (documented in the Dockerfile: apps/api's only
    workspace dependency, `@dos/config`, is dev-only and already dropped
    by `--prod`, so the non-legacy symlink-injecting implementation buys
    nothing here).
  - **A real finding that corrected an assumption already written into
    the Dockerfile's own comments**: the first draft assumed argon2
    needed a C++ toolchain to compile from source on Alpine specifically
    (a common footgun for native Node addons on musl). Inspecting the
    same local `pnpm deploy` output's `node_modules/argon2/prebuilds/`
    showed the package actually ships prebuilt binaries for **both**
    glibc and musl on linux-x64/arm64 — no compilation needed on either
    base image. The base-image choice (`slim` over `alpine`) was kept
    anyway, but for the real reason: only the glibc prebuild has
    actually been exercised (every signup/login in this project's e2e
    suite runs on it), and musl is a genuinely separate, unverified
    native-addon compatibility surface — not because compilation would
    fail.
  - **A real, load-bearing verification, done without Docker**: ran a
    real argon2 hash → verify(correct) → verify(wrong) round trip
    directly against the `pnpm deploy` output's installed argon2
    package. All three results were correct (`VERIFY_CORRECT: true`,
    `VERIFY_WRONG: false`), confirming the exact native module that
    would ship in the production image actually works — the concrete
    open item this whole task existed to close.
  - **What could not be verified**: `docker build` itself. This
    sandbox's egress policy blocks Docker Hub's CDN (confirmed via the
    agent proxy's own diagnostics — `connect_rejected`, "gateway
    answered 403 to CONNECT," host `production.cloudfront.docker.com`)
    — a policy denial, not a bug, and per the proxy's own operating
    instructions not something to retry or route around. The Dockerfile
    is real, reviewed infrastructure code with its core extraction
    mechanism (`pnpm deploy`) and its one genuinely uncertain native
    dependency (argon2) both verified directly; the full multi-stage
    build (base image pull, apt install, `nest build` inside the
    container, final image assembly) has not been run end to end. CI
    (below) will be the first real test of that, on a runner with normal
    network access.

- **Production hardening**, all live-verified against a running
  instance (`apps/api/src/main.ts`, `app.module.ts`):
  - `helmet()` — security headers (HSTS, `X-Content-Type-Options`,
    CSP, etc). Verified Swagger UI still works under the default CSP by
    checking its actual served HTML: every `<script>` tag is a
    same-origin `src=` reference (`./docs/swagger-ui-bundle.js` etc.),
    no inline scripts, so `script-src 'self'` doesn't break it — each
    asset confirmed `200`.
  - `compression()` — verified `Content-Encoding: gzip` appears on a
    response above the default size threshold (the ~25KB OpenAPI JSON
    spec) and correctly does _not_ appear on tiny responses (`/plans`),
    matching the middleware's own threshold behavior rather than being
    a false negative.
  - `@nestjs/throttler`, global `APP_GUARD`, 100 requests/60s per IP —
    verified by firing 100+ rapid requests at a running instance and
    getting a `429` with `Retry-After: 60` back, then confirming the
    full e2e suite (which makes well over 100 HTTP calls across its run)
    still passes cleanly against the same limit — the number is generous
    enough for real interactive traffic without being toothless.
  - `app.enableShutdownHooks()` — without this, Nest never invokes
    `OnModuleDestroy` (so `PrismaService.onModuleDestroy`'s
    `$disconnect()` never ran) on `SIGTERM`, a real gap for anything
    that expects a graceful `docker stop`/Kubernetes `preStop` drain
    instead of the process just dying mid-request. Verified live: sent
    `SIGTERM` to a running instance, confirmed immediate clean exit with
    no error/traceback in the log (versus, before this change, an
    ungraceful default-Node termination).

- **CI**: added a `docker build -f apps/api/Dockerfile .` step (no
  registry push) to `.github/workflows/ci.yml`, after lint/build/test/
  README-check — catches a broken production build before merge rather
  than at actual deploy time. This step's own YAML was validated for
  syntax (parsed with `js-yaml`) but, per the point above, has not
  actually been run in this sandbox; GitHub Actions runners have normal
  Docker Hub access, so this is expected to be the step's first real run.

## Fase 7 — cierre

- **Ítem de arquitectura pendiente, cerrado con evidencia real**:
  `docs/architecture/auth.md` pedía explícitamente confirmar los
  bindings nativos de argon2 contra la imagen de deploy antes de esta
  fase — se hizo, con un round-trip real de hash/verify contra el mismo
  paquete que la imagen instalaría, no una suposición.
- **Bug real encontrado sin necesitar Docker**: `pnpm deploy` fallando
  por el modo legacy/inyectado de pnpm v10, detectado con una prueba
  local antes de que pudiera romper el build dentro del contenedor.
- **Suposición incorrecta corregida con evidencia, no dejada pasar**:
  argon2 no necesita compilar desde código fuente en Alpine — tiene
  binarios prebuilt para musl también — corregido en los comentarios
  del propio Dockerfile en vez de quedar como una razón equivocada
  documentada permanentemente.
- **Límite real del entorno, reportado, no evadido**: la política de
  salida de este sandbox bloquea Docker Hub — se diagnosticó con las
  herramientas del propio proxy, se reportó explícitamente, y no se
  intentó rodear (tal como indican las instrucciones del proxy).
- **Endurecimiento de producción real, verificado en vivo, no solo
  agregado**: cada una de las cuatro piezas (headers de seguridad,
  compresión, rate limiting, graceful shutdown) se probó contra una
  instancia corriendo de verdad, incluyendo confirmar que el rate limit
  no rompe la propia suite de e2e.
- **Sin infraestructura de nube inventada**: ningún proveedor cloud,
  manifiesto de Kubernetes, ni registro de imágenes fue decidido aquí —
  son decisiones del stakeholder, no supuestos del agente.

**Fase 7 completa — esperando aprobación para Fase 8** (Comercialización,
per el roadmap original — el último ítem no definido en detalle sigue
siendo el device/simulador real para verificar `react-native-keychain`,
ya documentado en Fase 6 como abierto). Por la regla del producto de no
avanzar de fase sin aprobación, Fase 8 no comienza hasta que el
stakeholder lo confirme explícitamente y, si su alcance no está ya
decidido, lo defina.
