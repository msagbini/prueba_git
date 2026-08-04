# Fase 8 — Comercialización: technical log

Status: **Fase 8 completa.** Este es el cierre del roadmap original de 8
fases (Estrategia → Base técnica → MVP operativo → Monetización →
Expansión → App móvil → Escalabilidad → Comercialización).

Tracks what was actually built during Fase 8.

## Planning

- Per la autorización estándar de esta sesión ("Dale sin mi autorización
  siempre y cuando hayas doble chequeado y testeado todo... analizado y
  optimizado"), se procedió sin esperar aprobación explícita paso a paso
  — pero el alcance concreto de "Comercialización" no estaba definido en
  ninguna parte de la documentación del proyecto (a diferencia de Fase 7,
  cuyo alcance ya estaba anclado por ítems abiertos previos). Igual que en
  Fase 5, esto disparó una pregunta explícita al usuario en vez de
  inventar alcance de producto.
- Se ofrecieron tres opciones concretas: un portal de billing real en
  `apps/web` sobre la API de `modules/billing` (Fase 4) que hasta ahora
  no tenía ningún consumidor de UI en tres fases; una landing page pública
  de marketing; u onboarding self-serve mejorado. El usuario eligió
  explícitamente **"Portal de billing en apps/web"**.
- Alcance final: construir la UI real de billing en `apps/web` — plan
  actual, catálogo de planes disponibles, upgrade vía Stripe Checkout, y
  el round trip de redirect de éxito/cancelación — todo consumiendo
  endpoints que ya existían y estaban probados desde Fase 4
  (`GET /organizations/me/subscription`, `GET /plans`,
  `POST /organizations/me/subscription/checkout`). Deliberadamente no se
  inventaron features de billing nuevas en el backend (proration UI,
  downgrade flow, cancelación desde la UI) — no estaban pedidas ni
  ancladas en ningún documento previo.

## Build log

- **Sesión con reload real** (`AuthContext.tsx`): hasta Fase 8, `apps/web`
  perdía la sesión en cada recarga de página — el access token vivía solo
  en memoria y no había ningún intento de restaurarlo al arrancar la app
  (marcado como deferred en comentarios desde Fase 2). Se agregó un
  `POST /auth/refresh` silencioso en el `useEffect` de montaje de
  `AuthProvider`, con body `{}` — el refresh token nunca lo maneja el
  cliente web (va en una cookie `httpOnly`, enviada automáticamente por
  `credentials: 'include'`), así que un objeto vacío es toda la carga que
  hace falta. Nuevo estado `status: 'loading' | 'unauthenticated' |
'authenticated'` para que las rutas protegidas no redirijan a `/login`
  antes de que la restauración termine.
- **Layout y navegación real** (`layouts/AppLayout.tsx`, `App.tsx`): rutas
  anidadas de React Router v6 (`<Route element={<AppLayout/>}>` con
  `<Outlet/>`) reemplazando el shell de rutas plano de Fase 2/5. Header
  con nav Dashboard/Billing y botón de sign-out.
- **`pages/BillingPage.tsx`** — el entregable central: carga en paralelo
  la suscripción activa y el catálogo de planes, muestra el plan actual y
  tarjetas Free/Pro/Business con límites (`maxClients`/`maxActiveJobs`/
  `maxStaff`), y dispara `POST .../checkout` al hacer upgrade,
  redirigiendo a la URL de Stripe Checkout devuelta. Maneja
  explícitamente el caso `503` (sin credenciales de Stripe configuradas
  en el deployment — el estado real de este proyecto desde Fase 4) con un
  mensaje inline en vez de un error genérico, y el `403` (solo Owner/Admin
  puede cambiar de plan, ya reforzado por la API). La misma página también
  renderiza los banners de `?checkout=success|canceled` — el
  `STRIPE_CHECKOUT_SUCCESS_URL`/`_CANCEL_URL` de `apps/api/.env.example`
  ya apuntaban ahí desde Fase 4, así que no hizo falta una ruta separada.
- **Suite de tests Vitest** — no existía runner de tests en `apps/web`
  hasta ahora (`pnpm test` era un `echo` placeholder desde Fase 2). Se
  agregó `vitest` (pineado a `^2`, no `^4`, porque este proyecto usa
  Vite 5 y Vitest 4 requiere Vite 6/7/8 — verificado con un intento real
  de instalar la versión más nueva primero, que trajo warnings de peer
  dependency) + `@testing-library/react`/`jest-dom` + `jsdom`. 10 tests
  nuevos en 3 archivos: `api/client.test.ts` (4, incluyendo el header
  `Authorization` y `credentials: include`), `context/AuthContext.test.tsx`
  (2, restauración de sesión exitosa y fallback a unauthenticated),
  `pages/BillingPage.test.tsx` (4, las funciones puras de formateo).
- **Verificación manual real contra la API corriendo**, con Playwright en
  un browser real (Chromium preinstalado en este sandbox), no solo
  contra mocks: login → dashboard → billing → click en "Upgrade to Pro"
  → mensaje inline 503 correcto (sin credenciales Stripe reales en este
  proyecto) → reload de página → sesión restaurada silenciosamente →
  banners `?checkout=success`/`?checkout=canceled` se renderizan
  correctamente → sign-out redirige a `/login`. Los únicos errores de
  consola observados fueron benignos: un 404 de favicon y dos 400 de
  `/auth/refresh` disparados por el doble-invoke de `useEffect` en modo
  desarrollo de React StrictMode antes del login (sin sesión aún, 400
  esperado), y el 503 que era la prueba intencional del botón de upgrade.

### Bug real encontrado y arreglado: regresión de `@dos/mobile#build`

Al correr `pnpm turbo run lint build test --force` desde la raíz —el
chequeo completo del monorepo que este mismo proyecto exige antes de
cerrar cualquier fase— `@dos/mobile#build` falló con decenas de errores
`TS2786` ("cannot be used as a JSX component") en prácticamente todos los
componentes de React Native de la app (`FlatList`, `View`, `Text`,
`TouchableOpacity`, `ActivityIndicator`, etc.) y en `AuthContext.Provider`.

- **Primer paso, antes de asumir causalidad**: dado que el único cambio de
  esta fase toca `apps/web` (y su `pnpm-lock.yaml`), la hipótesis inicial
  fue una regresión de hoisting/lockfile causada por las nuevas
  devDependencies de test de `apps/web` interfiriendo con la resolución
  de `@types/react` de `apps/mobile` — exactamente el tipo de problema que
  el `packageExtensions` de `pnpm-workspace.yaml` ya existe para prevenir
  (ahí documentado para `react-router`/`react-router-dom`).
- **Se descartó con evidencia, no se asumió**: `pnpm why @types/react`
  dentro de `apps/mobile` mostró una sola versión (`19.2.18`) en todo el
  grafo de dependencias — ninguna duplicación. Para confirmar del todo, se
  hizo `git stash` de todo el trabajo de Fase 8 (incluido `pnpm-lock.yaml`),
  se reinstaló contra el lockfile limpio de antes de esta fase, y se
  corrió `pnpm --filter @dos/mobile build` de nuevo: **el mismo error,
  idéntico, byte por byte**. Esto probó que el bug es preexistente y no
  tiene relación con los cambios de esta fase — ya estaba ahí, sin haber
  sido detectado (la tarea de Fase 6 que decía haber verificado
  "tsc/lint/jest/Metro build" para `apps/mobile` no lo atrapó, por la
  razón que sea). Se restauró el stash inmediatamente después.
- **Causa raíz real**: `@react-native/typescript-config@0.86.2` (el
  tsconfig base que `apps/mobile/tsconfig.json` extiende, deliberadamente
  no unificado con `@dos/config` por ser específico del ecosistema React
  Native) fija `"jsx": "react-native"` — el modo de transformación JSX
  clásico, que depende del namespace `JSX` **global** que `@types/react`
  solía declarar. `@types/react@19.x` movió ese namespace a estar
  **scoped al módulo** (`React.JSX`), como parte de un cambio deliberado
  de React 19 para permitir que coexistan múltiples runtimes de JSX en un
  mismo proyecto. Con el modo clásico y `@types/react` 19, TypeScript no
  encuentra la declaración esperada y termina comparando tipos de formas
  inconsistentes — de ahí los errores de `Component<any,any,any>` con
  `refs` faltante y `bigint no asignable a ReactNode`.
- **Fix real, no un workaround frágil**: `apps/mobile/tsconfig.json` ya
  sobreescribe `compilerOptions` del config base (`"types": ["jest"]`) —
  se agregó `"jsx": "react-jsx"` al mismo bloque. Esto no es un parche:
  `@react-native/babel-preset` (el preset de Babel que Metro realmente usa
  para compilar, verificado en `apps/mobile/babel.config.js`) ya emite el
  runtime automático de JSX por defecto — `"jsx": "react-jsx"` en tsconfig
  simplemente hace que el type-checker esté de acuerdo con lo que Babel ya
  compila, en vez de reflejar un modo de transformación que Metro no usa.
  Verificado: `tsc --noEmit` limpio, `pnpm --filter @dos/mobile build`
  completo (tsc + bundle de Metro) exitoso, y los 8 tests de Jest de
  `apps/mobile` siguen pasando sin cambios.
- **Verificación final**: `pnpm turbo run lint build test --force` desde
  la raíz — las 9 tareas (`@dos/api`/`@dos/web`/`@dos/mobile` ×
  lint/build/test) pasan de forma independiente, no solo "el pipeline no
  aborta."

## Fase 8 — cierre

- **Alcance no inventado**: "Comercialización" no tenía un alcance
  concreto documentado en ningún lado del proyecto; se preguntó al
  usuario en vez de asumir, igual que en Fase 5.
- **UI real sobre API real, no una maqueta**: el portal de billing
  consume los mismos endpoints de `modules/billing` que existen —
  probados vía e2e— desde Fase 4, sin inventar campos ni endpoints nuevos.
- **Bug real preexistente encontrado, diagnosticado con evidencia (no
  supuesto) y arreglado en la causa raíz**, no evadido con
  `skipLibCheck` ni silenciando el error: la regresión de `@dos/mobile`
  se aisló con un `git stash` + reinstalación limpia antes de tocar nada,
  confirmando que no era causada por el trabajo de esta fase, y se
  corrigió alineando el `tsconfig` con el comportamiento real de Babel.
- **Cobertura de tests donde no la había**: `apps/web` no tenía ningún
  test runner configurado hasta esta fase; ahora tiene 10 tests reales
  (no triviales) cubriendo el cliente HTTP, la restauración de sesión, y
  el formateo de precios/límites de planes.
- **Verificación manual real, no solo tipos que compilan**: todo el flujo
  de billing se ejerció contra la API corriendo, en un browser real vía
  Playwright, incluyendo el camino de error (503 sin Stripe configurado).
- **Lo que sigue sin verificar, documentado sin maquillar**: un pago real
  de Stripe de punta a punta — este proyecto nunca tuvo credenciales de
  prueba reales de Stripe, la misma limitación ya documentada desde
  Fase 4. El dispositivo/simulador real para `react-native-keychain`
  (Fase 6) y `docker build` en este sandbox (Fase 7, bloqueado por
  política de egress a Docker Hub) siguen abiertos, sin cambios.

**Fase 8 completa — cierra el roadmap original de 8 fases.** No hay una
"Fase 9" definida en ningún documento del proyecto: el roadmap original
(Estrategia, Base técnica, MVP operativo, Monetización, Expansión, App
móvil, Escalabilidad, Comercialización) está completo. Cualquier trabajo
siguiente (más superficie de producto, cerrar los ítems abiertos de
device real/Docker Hub, u otra dirección) necesita alcance definido por
el stakeholder — no se inventa aquí, por la misma regla que ya se aplicó
en cada fase de alcance ambiguo.
