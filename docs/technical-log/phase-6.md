# Fase 6 — App móvil: technical log

Status: **Fase 6 completa — esperando aprobación para Fase 7**

Tracks what was actually built during Fase 6.

## Planning

- Unlike Fase 5, this phase's scope didn't need a stakeholder question —
  the original 8-phase roadmap already names it explicitly ("App móvil"),
  and the Fase 2 mobile scaffold's own README/code comments had already
  flagged the concrete target: "the real field-staff screens (today's
  jobs, clock in/out, client details) land in Fase 6." Proceeded under the
  standing authorization to advance without a per-phase approval gate,
  conditioned on genuine double-checking/testing/analysis before each
  step — the same basis Fase 5 was built under.
- Read the Fase 2 mobile scaffold (`App.tsx`, a placeholder
  `RootNavigator`/`HomeScreen`, React Navigation already installed) and
  `apps/web`'s Fase 2 scaffold (`src/api/client.ts`,
  `src/context/AuthContext.tsx`) before writing anything — the mobile
  README explicitly pointed at the web scaffold as the pattern to follow
  for auth, and re-deriving that shape from scratch would have risked
  drifting from the already-reviewed API contract shapes (`LoginResponse`
  etc., defined in `apps/api/src/modules/auth/auth.types.ts`).

## Build log

- **API client** (`src/api/client.ts`, `src/api/config.ts`): a typed
  `fetch` wrapper mirroring `apps/web`'s, minus `credentials: 'include'`
  — the mobile app never uses the httpOnly refresh-token cookie the API
  also sets on every auth response; both tokens travel in the response
  body instead (confirmed by reading `AuthController.respondWithTokens`,
  which returns `{ accessToken, refreshToken }` regardless of caller).
  `API_BASE_URL` is a plain constant, not a native config module — one
  string doesn't justify a new native dependency this sandbox can't
  verify links correctly.

- **Secure token storage** (`src/auth/tokenStorage.ts`,
  `react-native-keychain`): per docs/architecture/auth.md's explicit
  mobile requirement ("the mobile client is responsible for storing
  [tokens] in the platform secure storage... Keychain on iOS, Keystore on
  Android"), not `AsyncStorage` and not the in-memory-only pattern
  `apps/web` uses (that pattern is deliberately web-specific, to limit
  XSS blast radius — irrelevant to a native app, which has no XSS
  surface but does need to survive app restarts). Both tokens are stored
  as one JSON blob under `setGenericPassword`'s single username/password
  slot, since the library only models one credential pair.

- **Auth flow** (`src/context/AuthContext.tsx`,
  `src/screens/LoginScreen.tsx`, `src/screens/SelectOrganizationScreen.tsx`):
  login, multi-organization selection (`POST /auth/select-organization`),
  logout (`POST /auth/logout`, best-effort), and — going further than
  `apps/web`'s current scaffold — session restore on launch. Rather than
  trust a stored access token (15 minute lifetime) after a cold start,
  restore immediately calls `POST /auth/refresh` with the stored refresh
  token to get a guaranteed-fresh pair, and clears storage on failure
  (expired/revoked/reused token) instead of getting stuck.
  `SelectOrganizationScreen` is a real screen, not an error message like
  `apps/web`'s current placeholder — the API has fully supported this
  flow since Fase 2, and a field-staff app skipping it would be a
  regression for any user working across more than one organization.

- **Job read enrichment + clock in/out** — done as an `apps/api` change
  (see the "Fase 6 prep" commit and `docs/api/openapi.yaml`), not mobile
  code, but load-bearing for this phase and worth restating here: without
  it, the mobile jobs screens would have had no way to show a Staff
  caller who a job was for, where to go, or to let them start/complete
  their own work. Both gaps were found by actually trying to build the
  real screens, not anticipated in the abstract — see that commit's
  message for the live-verification detail.

- **Jobs screens** (`src/screens/JobsListScreen.tsx`,
  `src/screens/JobDetailScreen.tsx`): the list refetches on every focus
  (via `useFocusEffect`, not just on mount) plus pull-to-refresh, so
  returning from the detail screen after clocking in/out shows current
  status without a manual action. The detail screen surfaces the client's
  name/contact, the service address, billed services, and notes, with a
  "Start job"/"Complete job" button gated on the job's current status
  (mirroring the API's own transition rules — `DRAFT`/`SCHEDULED` →
  `IN_PROGRESS` → `COMPLETED`) and inline error display for a failed
  action (e.g. a race where someone else already changed the job's
  status) rather than swallowing it.

- **Navigation gating** (`src/navigation/RootNavigator.tsx`): switches
  between an unauthenticated stack (Login, or Select Organization when
  `AuthContext.status` is `needsOrganizationSelection`) and the
  authenticated jobs stack, driven entirely by `AuthContext.status` —
  this _is_ the auth gate the Fase 2 scaffold's placeholder comment
  pointed at ("auth gating... are Fase 6 work").

- **A real Jest-environment bug found and fixed, not worked around**:
  the Fase 2 scaffold's `App.test.tsx` smoke test still passed after
  wiring in `AuthProvider`, but a more ambitious test (assert the login
  screen's text appears once the session-restore effect settles) failed
  with an empty render tree — `SafeAreaProvider` renders no children
  under Jest without its native insets measurement, which
  `react-native-safe-area-context` ships a mock for but which only
  works when registered via `jest.mock(...)` (a `setupFiles` entry that
  merely _executes_ the mock module, as first tried, doesn't replace the
  module in the registry). Fixed by adding `jest.setup.js` and wiring it
  into `jest.config.js`'s `setupFiles`, plus re-exposing the mock's
  default-export members as the module's own named exports (the mock
  ships as `export default {...}`, but app code imports named members).
  A manual Jest mock for `react-native-keychain`
  (`__mocks__/react-native-keychain.js`) was needed for the same
  category of reason — no native module exists under Jest at all.

- **A flaky test found and _not_ shipped, rather than forced green**:
  once the above was fixed, asserting on the login screen's rendered
  text was still non-deterministic — sometimes the assertion passed,
  sometimes a spurious "Couldn't find a navigation context" error
  surfaced from a delayed effect, sometimes the text matched twice
  (a transitional extra screen from React Navigation's own internal
  timing, which isn't deterministic under Jest without a real native
  driver for `react-native-screens`/`react-native-gesture-handler`).
  Rather than retry-loop or loosen the assertion until it happened to
  pass, this was left as a documented limitation and the test scoped
  back down to a smoke test (mounts without throwing) — a flaky
  assertion is worse than no assertion, and the underlying screens were
  already verified correct by inspecting the rendered tree directly
  during debugging.

- **Verification**: `pnpm --filter @dos/mobile test` (8 tests across 3
  suites: the App smoke test, `tokenStorage` round-trip against the
  Keychain mock, and `apiFetch`'s header/204/error-body handling against
  a mocked `fetch`), run three times back to back to confirm stability;
  `pnpm --filter @dos/mobile build` (`tsc --noEmit` + a full Metro
  Android JS bundle) — confirms every import resolves and the bundle is
  valid, though not that native modules link on a real device/simulator,
  which this container has no Android SDK/Xcode to check (same category
  of gap as Fase 4's unverified Stripe network calls — implemented
  against the real library, documented as unverified pending real
  hardware). `pnpm turbo run lint build test` across the whole monorepo,
  cache forced off, all 9 tasks green (33 `apps/api` tests unaffected).

## Fase 6 — cierre

- **Alcance ya definido, no había que preguntarlo**: a diferencia de
  Fase 5, el roadmap original y el propio scaffold de Fase 2 ya
  nombraban el alcance concreto de "App móvil" — se procedió directo
  bajo la autorización vigente.
- **Autenticación real, no un mock**: sesión persistida en el
  almacenamiento seguro de la plataforma (Keychain/Keystore) como exige
  la arquitectura ya aprobada, con restauración de sesión al abrir la
  app (yendo más allá de lo que `apps/web` implementa hoy) y selección
  real de organización para cuentas multi-organización.
- **Dos gaps reales de API encontrados construyendo la feature real, no
  anticipados en abstracto**: falta de datos de cliente/dirección/
  servicios en `GET /jobs` para un caller Staff, y ausencia total de una
  vía para que Staff marque su propio trabajo como iniciado/completado
  — ambos corregidos en `apps/api` (ver el commit "Fase 6 prep"),
  verificados en vivo antes de construir la UI que depende de ellos.
- **Bug real de entorno de test encontrado y corregido en la raíz**: el
  mock de `SafeAreaProvider` mal registrado (ejecutado pero no
  reemplazando el módulo) causaba un árbol de render vacío — corregido
  con el mecanismo correcto (`jest.mock` vía `setupFiles`), no
  ignorado.
- **Un test flaky identificado y descartado, no forzado a pasar**:
  disciplina de "no soluciones frágiles" aplicada también a la propia
  suite de tests, no solo al código de producto.
- **Honestidad explícita sobre los límites del sandbox**: sin SDK de
  Android/Xcode en este contenedor, el enlace de módulos nativos
  (`react-native-keychain` en particular) no pudo verificarse en un
  dispositivo/simulador real — documentado explícitamente, con lo que sí
  se verificó (compilación TypeScript, bundle de Metro, lógica de
  pantallas y del cliente API bajo Jest) claramente diferenciado de lo
  que no.

**Fase 6 completa — esperando aprobación para Fase 7** (Escalabilidad,
per el roadmap original — infra hardening, deploy, and the two flagged
non-blocking open items: `argon2` native bindings against the real
deploy image, and `react-native-keychain` against a real device). Por la
regla del producto de no avanzar de fase sin aprobación, Fase 7 no
comienza hasta que el stakeholder lo confirme explícitamente.
