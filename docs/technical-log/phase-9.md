# Fase 9 — Hardening y funcionalidad operativa: technical log

Status: **Fase 9 completa.** No es parte del roadmap original de 8 fases
(ese roadmap cerró en Fase 8) — es trabajo dirigido directamente por el
stakeholder a partir de una auditoría técnica propia, con autorización
estándar para proceder sin aprobación paso a paso siempre que cada paso
esté doble-chequeado y probado.

Tracks what was actually built during Fase 9.

## Planning

- Al cerrar Fase 8, se hizo una auditoría real del proyecto a pedido del
  usuario ("Pues mira como vas... Diseño, cómo optimizar todo, seguridad,
  innovación... funcionalidades, cosas que faltan aún") — no una revisión
  de código en abstracto: se levantó el stack completo, se creó una
  organización nueva por signup real, se ejercitaron flujos de negocio
  contra la API viva, y se corrió `pnpm audit`. El hallazgo principal:
  `apps/web` tenía tres páginas (Login, Dashboard, Billing) mientras que
  clientes/jobs/staff/servicios/facturas tenían APIs completas y
  probadas desde Fase 3 sin ninguna UI encima. Se identificaron además:
  paginación ausente en todos los endpoints de listado, el proveedor de
  email nunca saliendo de la consola, sin rate-limit específico en login,
  6 vulnerabilidades altas en dependencias, `Job.recurrenceRule` sin
  procesar desde Fase 2, y ninguna capacidad de subir archivos/fotos.
- El usuario respondió "Pues dale con todo tu que yo tengo tiempo" —
  autorización para atacar toda la lista de hallazgos, no solo uno.
- Se armó una lista de tareas explícita (paginación → 5 páginas
  operativas → email real → hardening de seguridad → jobs recurrentes →
  adjuntos de fotos → este cierre), deliberadamente en ese orden: la
  paginación es una dependencia de las páginas de listado que vienen
  después, y las páginas operativas eran el hallazgo de mayor impacto.
- Deliberadamente **no** se atacaron en esta fase (ver "Fase 9 — cierre"
  para el porqué de cada uno): portal de cliente final, generación de PDF
  de facturas, calendario/dispatch board, integraciones externas, cámara
  en mobile, migración mayor de NestJS 10→11/react-router 6→7.

## Build log

### Paginación

Todo endpoint de listado (`GET /clients`, `/jobs`, `/invoices`,
`/payments`, `/staff`, `/services`) hacía `findMany()` sin límite —
`GET /jobs` en particular trae un `include` pesado (cliente, dirección,
servicios, asignaciones por fila). Se agregó `PaginationQueryDto`
compartido (`page`/`pageSize`, tope de 100) y un envelope
`PaginatedResult<T>` (`{ items, page, pageSize, total, totalPages }`),
aplicado de forma consistente. `service-categories` quedó
deliberadamente sin paginar — es taxonomía organizacional, no un
registro transaccional creciente, mismo razonamiento que `plans`.

Actualizó el único consumidor real de la forma anterior (`JobsListScreen`
en `apps/mobile`, que esperaba un array plano) y las aserciones de la
suite e2e. Verificado en vivo: `GET /clients?page=1&pageSize=5` devuelve
la forma correcta; `pageSize=9999` devuelve 400 (el cap de validación
funciona).

### Portal operativo en `apps/web` (Clientes, Servicios, Staff, Jobs, Facturas)

El hallazgo de mayor impacto de la auditoría, resuelto con cinco páginas
CRUD reales — no maquetas — contra las APIs que existían desde Fase 3:

- **Capa de componentes compartida** (`components/ui/`): `Button`,
  `Field`/`SelectField`/`TextareaField` (label/error asociados vía
  `aria-describedby`), `Modal` (sobre el elemento nativo `<dialog>` —
  focus trap y Escape-to-close gratis, sin reinventar esa lógica de
  accesibilidad) y `Pagination`. Cierra dos hallazgos de la auditoría a
  la vez ("sin sistema de componentes", "cero `aria-*`").
- **Clientes**: lista paginada, crear/editar, gestión de direcciones
  (sub-panel dentro del modal de edición).
- **Servicios**: catálogo de categorías (control inline, no paginado —
  mismo razonamiento que arriba) y servicios con precio (lista paginada,
  crear/editar, campo de unidad condicional a `pricingType`).
- **Staff**: invitar (envía por el endpoint de invitaciones existente,
  con `roleCode: STAFF`), listar, editar campos de empleo. No hay
  "crear staff" directo — un `StaffProfile` solo existe cuando se acepta
  una invitación.
- **Jobs**: lista con estado/fecha/asignados, crear/editar (cliente,
  dirección, horario, notas, estado), asignar staff y agregar servicios
  facturables desde el modal de edición.
  - **Hallazgo real en la API mientras se construía esto**: `GET /jobs`
    no incluía `assignments` en absoluto — "asignar staff" habría sido
    de solo-escritura, sin forma de mostrar quién ya está en un job. Se
    agregó al `JOB_DETAILS_INCLUDE` existente, mismo patrón que
    cliente/dirección/servicios.
- **Facturas**: crear, agregar líneas, registrar pagos — anidado dentro
  de la misma vista de edición en vez de una página top-level separada
  para pagos (`POST /payments` siempre apunta a una factura; no hay caso
  de uso de "ver todos los pagos" definido en ningún documento del
  producto).
  - **Otro hallazgo real**: `GET /invoices/:id` no podía devolver las
    líneas de la factura — solo existía `POST .../line-items`, sin forma
    de leerlas de vuelta. Se enriqueció `findOne` con una consulta
    adicional de líneas.
- **Dashboard**: reemplaza el párrafo placeholder por tarjetas de acceso
  directo a cada página nueva.

Verificado en vivo con Playwright para cada página: crear, editar,
sub-acciones (direcciones, asignaciones, líneas de factura, pagos),
navegación completa por los 6 links del header + las 6 tarjetas del
dashboard. Sin errores de consola más allá del 404 de favicon ya
documentado como benigno desde Fase 8.

### Proveedor de email real (P0 de seguridad)

`ConsoleEmailService` seguía siendo el único proveedor — verificación de
cuenta, reset de contraseña e invitaciones nunca le llegaban a un usuario
real. Se agregó `SmtpEmailService` (nodemailer), enlazado en
`AuthModule` vía un factory provider que elige entre SMTP real y el stub
de consola según si `SMTP_HOST` está configurado — mismo patrón de
degradación de `BillingService` con Stripe. Los links de los correos se
construyen desde una nueva variable `WEB_APP_URL`
(`/verify-email`, `/reset-password`, `/accept-invitation/:token`) — esas
páginas todavía no existen en `apps/web`, marcado explícitamente como
seguimiento separado, no bloqueante para que el mecanismo de envío sea
real.

6 tests unitarios nuevos (construcción del transporte, cada link, y que
un fallo de envío se loguee en vez de lanzar — para que una caída
transitoria de SMTP nunca haga fallar el signup/invite/reset que lo
disparó). Es también el primer archivo de test a nivel unitario del
proyecto — hasta ahora todo era integración/e2e, otro hallazgo de la
auditoría.

Sin credenciales SMTP reales en este proyecto — verificado en vivo que
el wiring de DI elige correctamente `SmtpEmailService` cuando
`SMTP_HOST` está seteado (un intento real de DNS/conexión que falla,
logueado, sin tumbar el request), pero la entrega real de correo queda
sin verificar. Mismo estándar de honestidad que Stripe en Fase 4.

### Hardening de seguridad

- **Rate limit específico en login/signup/forgot-password**: el único
  límite existente era el global (100 req/60s, igual para
  `/auth/login` que para `/plans`). Se agregó un override de 10 req/60s
  en esas tres rutas via `@Throttle`. Verificado en vivo: 11 intentos
  rápidos de login — los primeros 10 se procesan (401 por credenciales
  malas), el 11º y 12º devuelven 429; `/health` no se ve afectado; la
  suite e2e (bien por debajo de 10 logins/signups en total) sigue
  pasando.
- **Vulnerabilidades de dependencias**: de las 6 altas encontradas en la
  auditoría, 4 eran de `multer` (vía `@nestjs/platform-express`, pineado
  exacto a `2.0.2`, ya la versión más nueva disponible en la línea 10.x
  de NestJS). Corregir esto de verdad requeriría una migración mayor a
  NestJS 11 — no se apresuró esa migración aquí. En cambio, al construir
  la funcionalidad de adjuntos (más abajo) esas rutas de multer se
  volvieron código real y alcanzable por primera vez, así que se agregó
  un override de pnpm (`multer: ^2.2.0` en `pnpm-workspace.yaml`)
  forzando la versión parcheada en todo el árbol, incluso debajo de
  `@nestjs/platform-express` — verificado con `pnpm why` y una nueva
  corrida de `pnpm audit` (altas: 6 → 2). Las 2 restantes, más las
  moderadas de `lodash`/`js-yaml`/`qs` (herramientas de dev/jest,
  inalcanzables en runtime) y `react-router` (requiere su propia
  migración mayor 6→7), quedan documentadas como seguimiento explícito,
  no barridas bajo la alfombra.

### Jobs recurrentes

`Job.recurrenceRule` existe desde Fase 2 (el comentario del schema ya
decía "generated recurring instances back [to the parent]") pero nada lo
procesaba — crear un job con una regla de recurrencia guardaba el string
y no hacía nada más. Se agregó `RecurringJobsService`: un `@Cron` diario
(`@nestjs/schedule`) que, para cada organización, materializa la próxima
ocurrencia debida (`rrule`, ventana de 7 días) de cualquier job raíz
(`recurrenceRule` seteado, `parentJobId` nulo) como un `Job` hijo real —
idempotente, con aislamiento por organización de punta a punta.

**La pregunta arquitectónica real que esto planteó**: un cron job no
tiene contexto de tenant por request, así que no puede usar el camino
normal ni siquiera para saber qué organizaciones existen — toda tabla,
incluida `organizations` misma, está protegida por RLS. Deliberadamente
no se usó el rol `dos_migrator` (BYPASSRLS) para esto — ese rol está
documentado como reservado solo para `prisma migrate` desde Fase 2, y
usarlo acá difuminaría ese límite para cualquier futuro job en segundo
plano. En cambio: una migración nueva agrega una política RLS angosta,
explícita y de solo lectura (`system_job_read_all`) — SELECT únicamente,
solo sobre `organizations`, habilitada por su propio flag de sesión que
nada más setea. El trabajo real de lectura/escritura de jobs por
organización sigue pasando por el mismo camino con tenant-scope que usa
cada request.

5 tests unitarios (matemática pura de fechas) y 2 de integración contra
una base de datos real (materializa una fila `Job` hija real,
correctamente aislada por organización; correrlo dos veces no duplica).

### Adjuntos de fotos en jobs

Ninguna capacidad de subir archivos existía en el proyecto — un hueco
real para un producto de field service donde fotos de antes/después son
evidencia estándar. Se agregó `JobAttachment` (modelo nuevo + migración
con RLS, mismo patrón `tenant_isolation` de cada tabla de negocio) y tres
rutas sobre el recurso `jobs` existente: `POST`/`GET .../attachments` y
`GET .../attachments/:id`, con la misma autorización `jobs.read` que
clock in/out (Staff solo si está asignado).

Almacenamiento en disco local bajo `UPLOADS_DIR`, una subcarpeta por
organización — no se decidió ningún proveedor de almacenamiento en la
nube para este proyecto (mismo razonamiento de "no inventar
infraestructura" que el trabajo de Docker en Fase 7), y el almacenamiento
local es una implementación real y completa para donde este proyecto
efectivamente corre hoy, no un placeholder. Los archivos se sirven por
una ruta de descarga autenticada y con tenant-scope, no servido estático
— un path público adivinable filtraría fotos de una organización a
cualquiera con la URL. Valida tipo de archivo (JPEG/PNG/WebP) y tamaño
(10MB) vía `fileFilter`/`limits` de multer.

Deliberadamente acotado a la API solamente — conectar una pantalla de
cámara al flujo de clock-out de `apps/mobile` es trabajo real y separado,
y este sandbox no tiene dispositivo/simulador Android/iOS para
verificarlo (la misma brecha de entorno documentada desde Fase 6), así
que construirlo sin ninguna forma de verificarlo violaría la disciplina
de testing del propio proyecto.

Verificado en vivo de punta a punta: se subió un PNG real, se listó, se
descargó y se confirmó identidad byte a byte con el original, se
confirmó que un archivo no-imagen devuelve 415, y que un caller de otra
organización recibe 404 tanto en listado como en descarga. Todo esto
también quedó fijado como 3 tests e2e nuevos contra una base de datos
real y uploads multipart reales, no mocks.

## Fase 9 — cierre

- **Alcance no inventado, seguido por autorización explícita**: cada
  ítem de esta fase viene directo de la auditoría que el usuario pidió,
  y el usuario autorizó explícitamente atacar toda la lista ("dale con
  todo").
- **Cinco bugs reales encontrados y arreglados mientras se construía,
  no solo en la auditoría original**: el fix de modal-no-cierra en la
  página de Jobs (inconsistencia de UX encontrada por Playwright), el
  `assignments` faltante en `JOB_DETAILS_INCLUDE`, las líneas de factura
  no legibles en `GET /invoices/:id`, la dependencia phantom de `multer`
  (necesitaba ser dependencia directa, no solo vía override), y la
  regresión de estado del test de invoices por race condition en el
  propio script de verificación (descartada como bug real tras
  confirmar contra la API directamente).
- **Seguridad real, no solo agregada — verificada**: rate limit de login
  probado con 11 requests reales; el override de multer confirmado con
  `pnpm why` y una re-auditoría, no solo asumido.
- **Arquitectura respetada, no evadida**: la automatización de jobs
  recurrentes necesitaba salir del modelo de tenant-por-request de este
  proyecto — se resolvió con una política RLS nueva, angosta y
  explícita, en vez de tomar el atajo de usar el rol de BYPASSRLS
  reservado para migraciones.
- **Cobertura de tests donde no la había**: primer test unitario del
  proyecto (`smtp-email.service.spec.ts`), mezclado con integración real
  (recurring jobs, job attachments) y e2e con multipart real, no solo
  mocks.

### Lo que queda deliberadamente sin construir

Ninguno de estos está pedido en ningún documento del proyecto — se
listan aquí para que la brecha esté documentada, no oculta:

- **Portal de cliente final**: el rol `Client` existe en el RBAC desde
  Fase 2 con visibilidad de sus propios jobs/facturas ya filtrada en el
  backend, pero no tiene ninguna pantalla, ni web ni mobile.
- **Calendario/dispatch board**: `apps/web`'s Jobs page es una lista, no
  una vista de calendario/semana con arrastrar-y-soltar.
- **Cámara en `apps/mobile`** para adjuntar fotos desde el flujo de
  clock-out — bloqueado en tener un dispositivo/simulador real para
  verificarlo, mismo gap documentado desde Fase 6.
- **Notificaciones más allá de auth** (recordatorio de cita, job
  asignado) — no hay módulo de notificaciones.
- **Migraciones mayores de dependencias** (NestJS 10→11, react-router
  6→7) que resolverían de raíz las vulnerabilidades restantes — cada una
  es su propio esfuerzo de migración con su propia superficie de cambios
  incompatibles, no algo para apurar dentro de un hardening pass.

## Fase 9.1 — Optimización adicional

El stakeholder pidió continuar: primero una auditoría real en vivo
("córrelo, qué hay que mejorar? Diseño, optimizar, seguridad,
innovación... funcionalidades, cosas que faltan aún"), luego
autorización a actuar sobre todo lo encontrado ("dale con todo"), y
finalmente pidió seguir optimizando "desde todos los aspectos" y
cerrar funcionalidad que no existía antes. Esto se atacó en dos
partes.

### Rendimiento — encontrado y verificado, no especulado

- Se recorrió cada `for (const ... of ...)` en los `*.service.ts` de
  `apps/api` buscando N+1 reales: no se encontró ninguno (el módulo de
  reports hace un `findMany` acotado por rango de fechas + agregación
  en memoria, que es el patrón correcto).
- El problema real: cada tabla tenía un único índice (`organizationId`).
  Toda query de "hijos de X" (`jobId`, `invoiceId`, `clientId`,
  `parentJobId`) y toda columna de `orderBy` de las páginas paginadas no
  tenían índice de soporte más allá del de tenant. Se añadieron 12
  índices (`Job`, `ClientAddress`, `JobService`, `JobAttachment`,
  `JobAssignment`, `InvoiceLineItem`, `Payment`, `Client`, `Service`,
  `StaffProfile`, `Invoice`) vía
  `prisma/migrations/20260804115922_performance_indices/`.
- Verificado, no asumido: `SELECT ... FROM pg_indexes` confirmó los 24
  índices totales existen; `SET enable_seqscan = off; EXPLAIN ...`
  confirmó que el planner sí usa `jobs_organization_id_scheduled_start_idx`
  cuando le conviene (con los volúmenes de datos de prueba actuales el
  planner prefiere seq scan, comportamiento correcto a esa escala, no
  señal de que el índice no funcione).
- `apps/web`: code-splitting por ruta con `React.lazy` + un único
  `Suspense` en el nivel superior. Medido con `vite build` real: el
  bundle inicial bajó de 213.71 kB (64.04 kB gzip) a 173.89 kB
  (56.85 kB gzip). Confirmado con Playwright contra el dev server real
  que los chunks de las páginas operativas solo cargan al navegar a
  ellas, no en el login/dashboard inicial.

### Funcionalidad — páginas web para los links de email

Fase 9 dejó `SmtpEmailService` enviando links reales a
`/verify-email`, `/reset-password` y `/accept-invitation/:token` que no
tenían página en `apps/web` — brecha documentada arriba, cerrada ahora:

- `AuthCard` — layout compartido factorizado de `LoginPage` (que además
  se reescribió sobre este componente) para las cuatro pantallas nuevas.
- `ForgotPasswordPage` (`/forgot-password`): dispara
  `POST /auth/forgot-password`; muestra siempre el mismo mensaje de
  éxito exista o no la cuenta, replicando el comportamiento del backend
  de no confirmar ni negar la existencia del email.
- `ResetPasswordPage` (`/reset-password?token=...`): lee el token de la
  query string, llama `POST /auth/reset-password`, distingue token
  inválido/expirado (400) de otros errores.
- `VerifyEmailPage` (`/verify-email?token=...`): dispara
  `POST /auth/verify-email` al montar, sin formulario.
- `AcceptInvitationPage` (`/accept-invitation/:token`): trae el preview
  público (`GET /invitations/:token`) y replica exactamente el
  branching del backend (`AuthService.acceptInvitation`) — si
  `useAuth().isAuthenticated` es true, acepta con body vacío
  (el backend exige que el usuario autenticado sea el dueño del email
  invitado); si no, pide nombre/apellido/contraseña para crear la
  cuenta nueva; un 409 (cuenta existente, no autenticado como ese
  usuario) muestra el mensaje de "iniciá sesión primero".
- Las cuatro rutas se registraron en `App.tsx` como públicas (fuera de
  `RequireAuth`), también lazy-loaded.
- **Verificado en vivo, no solo con tests unitarios**: con la API y el
  dev server de `apps/web` corriendo de verdad, se creó una
  organización real por signup, se dispararon los tres emails
  (`ConsoleEmailService` los loguea), se extrajeron los tokens reales
  del log, y con Playwright contra Chromium real se probó: reset de
  contraseña con token inválido y válido (con login posterior usando la
  contraseña nueva), verificación de email con token inválido y válido,
  y las tres ramas de aceptar invitación (cuenta nueva sin
  autenticación, cuenta existente sin autenticación → 409, cuenta
  existente autenticado como ese usuario → acepta directo sin mostrar
  el formulario). Las 9 verificaciones live pasaron.

### Funcionalidad — generación de PDF de facturas

También listado arriba como brecha deliberada — los datos de una
factura estaban completos desde Fase 3, pero no había forma de
exportarla. Cerrado ahora:

- `InvoicePdfService` (`apps/api`, `pdfkit`, sin dependencias nativas
  ni navegador headless) renderiza una factura de una página: datos de
  la organización, número/fechas/estado de la factura, datos del
  cliente (nombre, contacto, email, teléfono) y su dirección de
  facturación (`ClientAddress` con `label=BILLING`, si existe — nada
  de esto es un campo nuevo, todo ya vivía en el schema desde Fase 2/3),
  la tabla de line items, y subtotal/tax/total. No recalcula nada —
  solo da formato a los totales que `InvoicesService.recomputeTotals()`
  ya mantiene correctos.
- `GET /invoices/:id/pdf` (`invoices.read`, misma visibilidad por fila
  que el resto del módulo — un Client solo puede pedir el PDF de sus
  propias facturas) sirve el PDF vía `StreamableFile`, mismo patrón que
  la descarga de adjuntos de jobs (Fase 9).
- `apps/web`: botón "PDF" en la fila de cada factura y botón
  "Download PDF" dentro del modal de edición — un nuevo helper
  `downloadFile()` en `api/client.ts` (paralelo a `apiFetch`, pero para
  respuestas binarias: arma un blob, dispara la descarga del navegador,
  libera el object URL) en vez de forzar el flujo JSON existente a
  manejar bytes.
- **Verificado en vivo, no solo con un e2e que aserte el content-type**:
  se creó una organización, un cliente con dirección de facturación
  real, y una factura con dos line items reales por HTTP contra la API
  corriendo; se descargó el PDF resultante y se decodificaron sus
  streams `FlateDecode` a mano (Python + zlib) para confirmar que el
  texto renderizado coincide byte a byte con los datos reales: nombre
  de la organización, número de factura, fechas, "Bill to" completo con
  la dirección, cada línea de servicio con cantidad/precio/total, y
  Subtotal/Tax/Total ($402.50, correcto). Además, con Playwright real
  se click-eó el botón "PDF" en la lista y el botón "Download PDF" en
  el modal, confirmando en ambos casos una descarga real con nombre
  `INV-0001.pdf` y bytes que empiezan con la firma `%PDF-`. Cobertura
  añadida a la suite e2e existente: PDF válido para el dueño de la
  factura, 404 para un id inexistente y para una factura de otra
  organización (aislamiento multi-tenant también en esta ruta).
- `pnpm audit --prod` re-corrido tras añadir `pdfkit`: mismas 15
  vulnerabilidades pre-existentes que ya estaban documentadas, ninguna
  nueva introducida por la dependencia.

### Verificación de este addendum

- `pnpm --filter web run build` / `lint` / `test` — verde.
- `pnpm turbo run lint build test --force` — 9/9 tareas verdes en todo
  el monorepo (`api`, `web`, `mobile`, `config`).
- Migración de índices aplicada limpiamente contra Postgres local
  (`prisma migrate dev`), sin downtime porque son solo `CREATE INDEX`
  aditivos.
- `docs/api/openapi.yaml` regenerado (`pnpm docs:api`) para incluir
  `GET /invoices/:id/pdf`.

**Fase 9 (incluyendo este addendum) completa.** Como en el cierre de
Fase 8: no hay una fase siguiente definida en ningún documento del
proyecto. De la lista de brechas deliberadas, quedan: portal de
cliente final, calendario/dispatch board, cámara en mobile,
notificaciones más allá de auth, y las migraciones mayores de
dependencias — sin cambios respecto a lo documentado arriba. Cualquier
dirección posterior necesita alcance definido por el stakeholder.
