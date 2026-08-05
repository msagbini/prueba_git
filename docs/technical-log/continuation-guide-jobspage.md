# Guía de continuación — cierre de cobertura `apps/web` (pausa temporal)

Estado al momento de la pausa: **commit `bff4cc7` pusheado** a
`claude/dos-saas-product-fv8j11` (PR #1). Todo lo descrito abajo como "hecho"
ya está en el remoto — no hace falta rehacerlo, solo verificarlo si quieres.

## 1. Cómo levantar el entorno en tu máquina

```bash
git clone https://github.com/msagbini/prueba_git.git
cd prueba_git
git checkout claude/dos-saas-product-fv8j11
git pull origin claude/dos-saas-product-fv8j11   # trae bff4cc7

pnpm install          # raíz del monorepo, instala todo (api/web/mobile/packages)
```

No hace falta Postgres/Docker corriendo para este trabajo puntual (son solo
tests de `apps/web` con `fetch` mockeado, no tocan la API real).

## 2. Correr los tests de `apps/web`

```bash
cd apps/web
npx vitest run                 # toda la suite (debería dar 26 archivos / 128 tests, todos OK)
npx vitest                     # modo watch, útil mientras iteras
npx vitest run src/pages/JobsPage.test.tsx --reporter=verbose   # un archivo puntual
```

Antes de la pausa, `npx vitest run` daba **26 test files / 128 tests, todos
pasando**, corrido 2-3 veces para confirmar que no hay flakiness.

## 3. Qué quedó hecho (commit `bff4cc7`)

- Toda la suite de tests de página/componente que faltaba: `Button`, `AuthCard`,
  `Pagination`, `Modal`, `Field`, `NotificationBell`, `AppLayout`, `LoginPage`,
  `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`, `DashboardPage`,
  `MyJobsPage`, `MyInvoicesPage`, `AcceptInvitationPage`, `ClientsPage`,
  `ServicesPage`, `StaffPage`, `InvoicesPage`, `JobsCalendarView`, `JobsPage`.
- Polyfill de `HTMLDialogElement.showModal`/`.close` en `src/test-setup.ts`
  (jsdom no lo implementa y `Modal.tsx` lo usa).
- **Bug real corregido** en `ForgotPasswordPage.tsx`: el `try { } finally { }`
  no tenía `catch`, así que un fallo de red se colaba como unhandled promise
  rejection en vez de mostrarse silenciosamente (que era la intención). Ya
  arreglado con un `catch {}` vacío.
- Lint limpio (`npx eslint ...`) y `prettier` aplicado vía el hook de
  pre-commit (husky/lint-staged) — si ves diffs de formato al hacer `git
status`, son de eso, no los reviertas.

## 4. Qué falta (pendiente, en orden)

1. **`apps/web/src/App.tsx`** (routing) — sigue sin test, estaba en la lista
   original de archivos con 0% cobertura. Decidir si amerita un test file
   propio (probablemente sí: montar `<App />` con un router de memoria y
   verificar que las rutas protegidas/públicas resuelven al componente
   correcto).
2. **Re-medir cobertura real**:
   ```bash
   cd apps/web
   pnpm run test:coverage
   ```
   Antes de este archivo, el último número medido (antes de `JobsPage`/
   `JobsCalendarView`) era **62%**. Con los ~30 tests nuevos de estos dos
   archivos debería subir bastante — hay que correrlo para tener el número
   real, no asumir.
3. **Fijar un `coverage.thresholds` honesto** en `apps/web/vite.config.ts`
   (bloque `test.coverage`), espejando el patrón ya existente en
   `apps/api/jest.config.js` (`coverageThreshold`). Usar el número medido en
   el paso 2 como piso, con un poco de margen hacia abajo (ej. si mide 78%,
   fijar 75%) para no ser frágil ante pequeños cambios futuros.
   - **Verificación de falsabilidad obligatoria** (regla del proyecto): subir
     el threshold temporalmente a algo imposible (ej. 99%), correr
     `pnpm run test:coverage`, confirmar que **falla**, y luego revertir al
     valor real elegido. Esto prueba que el gate realmente bloquea, no que
     solo está ahí de adorno.
4. **Actualizar CI** (`.github/workflows/ci.yml`): el paso de cobertura de
   `apps/web` está como "solo reporta" (no bloquea) desde el commit `202cc5b`,
   justamente porque este gap seguía abierto. Ahora que se cierra, cambiarlo
   a gate real (que el step falle si no se cumple el threshold).
5. **Verificación completa del monorepo**:
   ```bash
   pnpm turbo run lint build test --force
   ```
   Se espera 9/9 tareas OK (api, web, mobile × lint/build/test, más el check
   de docs). Correr esto antes de dar por cerrado el trabajo.
6. **Documentar** en `docs/technical-log/phase-9.md` (nueva sección/addendum,
   siguiendo el patrón de entradas anteriores de este archivo) y en
   `CHANGELOG.md`:
   - Cobertura real antes/después (con números reales del paso 2).
   - Lista de archivos que antes no tenían test y ahora sí.
   - El bug real encontrado en `ForgotPasswordPage.tsx` y por qué importa
     ahora que el SDK de Sentry del browser está conectado (una unhandled
     rejection se reportaría incorrectamente a Sentry como error real).
   - Los workarounds de jsdom descubiertos (documentarlos como notas de
     infraestructura de test, no como bugs de la app):
     - `HTMLDialogElement.showModal`/`.close` no implementados → polyfill.
     - `new Response(blob, ...)` con `Blob` de jsdom rompe en `.blob()`
       (`object.stream is not a function`) → usar body de tipo `string` en
       vez de `Blob` en los mocks de PDF/descarga.
     - `vi.stubGlobal('URL', {...URL, ...})` rompe `new URL(...)` interno
       (pierde el prototipo de clase) → asignar
       `URL.createObjectURL`/`URL.revokeObjectURL` directamente como
       propiedades, sin reemplazar el global `URL`.
     - `vi.useFakeTimers()` + `waitFor()` de Testing Library hace deadlock
       (timeout de 5000ms) porque `waitFor` usa `setTimeout` real
       internamente → evitar fake timers en tests dependientes de fecha;
       en su lugar espejar las funciones de date-math del propio componente
       (`mondayOf`, `addDays`) en el test para calcular valores esperados
       contra la fecha real.
   - El nuevo threshold de cobertura de `apps/web`, con el número exacto.
7. **Commit + push** final a `claude/dos-saas-product-fv8j11` (PR #1 ya
   existe, no hace falta crear uno nuevo — un push más actualiza el mismo PR).
8. Marcar la tarea #81 ("Write apps/web component/page test suite to close
   coverage gap") como completada en el tracker de tareas.

## 5. Patrones a mantener si escribes algo nuevo

- **Modal siempre montado en el DOM**: `open`/`close` solo togglean el
  atributo `open` nativo, el JSX del modal nunca se desmonta. Cualquier
  texto dentro de un formulario de modal (opciones de `<select>`, labels de
  checkbox, texto estático) siempre está presente en `document.body` y puede
  colisionar con texto idéntico en otra parte de la página (celdas de tabla,
  headers de columna, badges de estado). Fix: `within(screen.getByRole('table'))`
  para acotar a la tabla, o `getAllByText(...)` con longitud esperada cuando
  ambas coincidencias son legítimas (ej. header de columna + badge de estado
  comparten la palabra "Scheduled"/"Active").
- **Mock de fetch estándar**: `vi.stubGlobal('fetch', vi.fn(...))` +
  `jsonResponse(body, status)` local + `afterEach(() => vi.unstubAllGlobals())`.
  Para páginas con múltiples endpoints, un helper `stubFetch(overrides)` que
  hace match por substring de URL con fallback a defaults razonables (ver
  cualquiera de los test files ya escritos como plantilla, ej.
  `InvoicesPage.test.tsx` o `JobsPage.test.tsx`).
- Correr cada archivo de test nuevo 2-3 veces aislado
  (`npx vitest run <archivo> --reporter=verbose`) antes de darlo por bueno —
  varias veces la "flakiness" resultó ser un bug determinista de ambigüedad
  de DOM que solo aparecía según qué assertion corriera primero.

## 6. Referencia rápida de comandos

```bash
# Ver diferencia con el remoto antes de tocar nada
git fetch origin claude/dos-saas-product-fv8j11
git log --oneline -5

# Lint de un set de archivos de test
cd apps/web && npx eslint src/pages/*.test.tsx src/components/**/*.test.tsx src/layouts/*.test.tsx

# Cobertura
cd apps/web && pnpm run test:coverage

# Verificación completa del monorepo (correr al final)
pnpm turbo run lint build test --force
```

PR de referencia: https://github.com/msagbini/prueba_git/pull/1
