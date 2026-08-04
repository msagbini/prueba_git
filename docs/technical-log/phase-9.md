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

### Funcionalidad — portal de cliente final

El tercer ítem de la lista de brechas deliberadas. El rol `Client`
existe en el RBAC desde Fase 2 con visibilidad ya filtrada en el
backend (`jobs.read`/`invoices.read`/`payments.read`, siempre
restringido a sus propios registros vía `visibilityFilter()` en cada
servicio), pero no tenía ninguna pantalla. Cerrado ahora:

- `decodeJwtRole()` (`apps/web/src/api/client.ts`) lee el claim `role`
  del access token sin verificar la firma — es solo para decidir qué
  nav mostrar, nunca una decisión de autorización (eso lo sigue
  haciendo `PermissionsGuard` en la API contra el mismo token). Nuevo
  en `AuthContext`: `role` en el contexto, recalculado en cada
  `login()`/restauración de sesión.
- Al construir esto se encontró un bug real y no relacionado en
  `AcceptInvitationPage` (Fase 9.1, addendum anterior): esa página
  llamaba a `setAccessToken()` directamente en vez de pasar por
  `AuthContext`, así que el estado de React de `status` nunca pasaba a
  `authenticated` — `RequireAuth` rebotaba al usuario recién aceptado
  de vuelta a `/login` a pesar de que el backend sí había emitido una
  sesión válida. Se agregó `AuthContext.setSession()` (adopta un
  access token emitido fuera de `login()`, recalculando `role` también)
  y `AcceptInvitationPage` ahora lo usa en las dos ramas. Confirmado en
  vivo que antes del fix la URL rebotaba a `/login` ~1.5s después de
  "llegar" al dashboard, y que después del fix se queda.
- `AppLayout`/`DashboardPage` ahora son conscientes del rol: un
  caller `CLIENT` ve un nav de dos ítems ("My jobs"/"My invoices") en
  vez del nav operativo completo — no tiene permiso para ninguno de
  esos módulos (`clients.read`/`services.read`/`staff.read`/billing no
  están en su lista de permisos, ver `prisma/seed.ts`), así que
  mostrárselos solo produciría errores 403 silenciosos.
- `MyJobsPage` (`/my-jobs`) y `MyInvoicesPage` (`/my-invoices`):
  contrapartes de solo lectura de `JobsPage`/`InvoicesPage` — mismos
  endpoints (`GET /jobs`, `GET /invoices`, `GET /invoices/:id`), sin
  formularios de creación/edición/asignación (el caller no tiene
  `*.manage`). `MyInvoicesPage` reutiliza el botón de descarga de PDF
  de Fase 9.1 y un modal de "ver" con line items y pagos, ambos de
  solo lectura.
- **Verificado en vivo de punta a punta**: se creó una organización, un
  cliente con dirección de facturación, un job y una factura reales
  por HTTP, y se invitó ese email como rol `Client` ligado a ese
  registro de cliente (`clientId` en la invitación). Con Playwright
  real se aceptó la invitación como cuenta nueva, se confirmó que el
  dashboard y el nav muestran las vistas de cliente (no las
  operativas), que `/my-jobs` y `/my-invoices` muestran exactamente el
  job/factura de ese cliente con los datos reales (incluido el total
  de $225), que la descarga de PDF y el modal de "ver" funcionan, y
  que navegar directamente a `/clients` (una URL que un Client no
  debería usar) falla con un mensaje de error en vez de romper la
  página. Por separado, se verificó que la rama "ya autenticado" de
  `AcceptInvitationPage` (aceptar una invitación a una segunda
  organización estando logueado) sigue funcionando tras el fix de
  `setSession()`, y que el nav cambia correctamente al set operativo
  al aceptar como Staff en esa segunda organización.

### Funcionalidad — calendario/dispatch board

Último ítem grande de la lista de brechas deliberadas: `JobsPage` era
una lista, no una vista de calendario/semana. Cerrado con un toggle
List/Calendar dentro de la misma página (no una ruta nueva) — la lista
sigue siendo necesaria para jobs sin `scheduledStart` (`DRAFT`), que
una vista de calendario no tiene dónde ubicar.

- Backend: `GET /jobs` gana `scheduledFrom`/`scheduledTo` opcionales
  (`ListJobsQueryDto`, mismo patrón de nombres que
  `DateRangeQueryDto` en `modules/reports`), filtrando sobre
  `scheduledStart`. Necesario porque paginar a 100 filas no alcanza
  para "todos los jobs de esta semana" en una organización con
  suficiente volumen — antes de este cambio no había forma de pedirle
  a la API un rango de fechas en absoluto.
- `JobsCalendarView` (`apps/web/src/components/jobs/`): vista de
  semana, un componente nuevo y autocontenido (fetch propio por
  semana, sin tocar el estado de paginación de la vista de lista).
  Arrastrar-y-soltar con drag-and-drop nativo de HTML5 (sin librería —
  es el único lugar de la app que lo necesita): soltar un job en otro
  día llama al mismo `PATCH /jobs/:id` que ya usa el formulario de
  edición, preservando la hora del día y la duración original
  (`scheduledEnd - scheduledStart`), no un endpoint nuevo. Click (sin
  arrastrar) abre el mismo modal de edición que la vista de lista, vía
  un callback `onOpenJob` — un solo modal, dos formas de llegar a él.
  Navegación semana anterior/siguiente/"Today".
- **Verificado en vivo, con un drag-and-drop real, no simulado**: se
  creó una organización/cliente/job real vía HTTP con
  `scheduledStart` en el día de hoy, y con Playwright (`dragTo`, que
  despacha los eventos HTML5 DnD reales, no solo un mousemove) se
  arrastró la tarjeta del job a la columna del día siguiente; se
  confirmó contra la API (`GET /jobs`, sin filtro de fecha) que
  `scheduledStart` efectivamente cambió al nuevo día conservando la
  hora. Se verificó el click-para-editar, y la navegación de semanas
  (con `waitForResponse` en vez de esperas arbitrarias, para no
  depender de timing): la semana anterior no muestra el job movido, la
  semana actual sí. Un primer intento de esta última verificación dio
  un falso positivo — `document.body.textContent` incluía el nombre
  del cliente porque aparecía como `<option>` dentro del `<select>`
  del modal "New job", que queda en el DOM (oculto, no desmontado)
  incluso cerrado; se corrigió acotando el assert al grid del
  calendario en vez de al `body` completo, y se confirmó con el HTML
  real del grid que estaba vacío como se esperaba.
- Cobertura e2e nueva en `business-flows.e2e.spec.ts`: el filtro
  `scheduledFrom`/`scheduledTo` incluye un job dentro de la ventana y
  lo excluye fuera de ella.

### Funcionalidad — portal de cliente en `apps/mobile`

`apps/mobile` era Staff-only desde Fase 6. Se extiende con un segundo
stack de navegación para el rol `Client`, reflejando el trabajo ya
hecho en `apps/web` (más arriba en este mismo addendum) — mismo
approach: decodificar `role` del access token, ramificar la UI, sin
tocar el modelo de permisos del backend (ya existía desde Fase 2).

- `decodeJwtRole()` portado a `apps/mobile/src/api/client.ts`, idéntico
  al de `apps/web`. RN provee `atob`/`btoa` como globals del core desde
  la 0.72 (esta app apunta a 0.86), así que no hace falta ningún
  polyfill — sí hizo falta declarar el tipo ambiente
  (`src/types/globals.d.ts`), porque `@react-native/typescript-config`
  no incluye la lib DOM (no es un entorno de navegador) y por lo tanto
  `tsc` no conocía `atob` sin esa declaración.
- `AuthContext` gana `role`, poblado en el mismo punto único
  (`applyTokens()`) que ya cubre las tres formas de obtener sesión
  (login, restauración al abrir la app, selección de organización) —
  no hubo que tocar cada call site por separado.
- `RootNavigator` ahora elige entre tres stacks según
  `status`/`role`: no autenticado, `ClientStack` (si `role === 'CLIENT'`),
  o el `AppStack` de Staff existente (si no). `ClientStack`:
  `ClientHomeScreen` (dos atajos, como el dashboard de cliente de
  `apps/web`) → `MyJobsScreen` (solo lectura, sin acciones de
  clock in/out — un Client no puede actuar sobre un job) y
  `MyInvoicesScreen` → `MyInvoiceDetailScreen` (line items + pagos,
  contraparte en pantalla completa del modal "View" de
  `MyInvoicesPage` en web).
- Se agregaron los tipos `Invoice`/`InvoiceLineItem`/`InvoiceWithLineItems`/
  `Payment` a `apps/mobile/src/types/api.ts`, que hasta ahora solo
  tenía tipos de `Job` (la app nunca había necesitado facturas).
- **Deliberadamente sin botón de descarga de PDF**, a diferencia del
  portal de `apps/web`: requeriría una librería de guardado de
  archivos que esta app bare RN no tiene instalada, y no hay forma de
  verificar que enlace correctamente sin un dispositivo o simulador
  real — no se agrega y se deja sin verificar.
- **Verificación, con la misma limitación de siempre para esta app**:
  sin Android SDK/Xcode en este contenedor, no se pudo renderizar
  ninguna pantalla en un dispositivo o simulador real (mismo gap
  documentado desde Fase 6). Lo que sí se verificó: `tsc --noEmit`,
  `eslint`, `jest` (11/11, incluyendo tests nuevos de `decodeJwtRole`
  que confirman que `atob`/`btoa` funcionan tanto en el entorno de
  Jest como se espera en el runtime de RN), y el bundle de Metro para
  Android — y, del lado del backend real que estas pantallas
  consumen, los mismos `GET /jobs`/`GET /invoices`/`GET /payments` ya
  fueron ejercitados en vivo con un token real de rol `CLIENT` al
  verificar el portal de `apps/web` más arriba en este documento.

### Verificación de este addendum

- `pnpm --filter web run build` / `lint` / `test` — verde.
- `pnpm turbo run lint build test --force` — 9/9 tareas verdes en todo
  el monorepo (`api`, `web`, `mobile`, `config`).
- Migración de índices aplicada limpiamente contra Postgres local
  (`prisma migrate dev`), sin downtime porque son solo `CREATE INDEX`
  aditivos.
- `docs/api/openapi.yaml` regenerado (`pnpm docs:api`) para incluir
  `GET /invoices/:id/pdf` y los nuevos query params de `GET /jobs`.
- Tests nuevos: `decodeJwtRole()` (bien formado, sin claim `role`,
  malformado) en `apps/web` y `apps/mobile`; `AuthContext` (`role`
  reflejando el JWT tras login/restauración de sesión, y
  `setSession()`) en `apps/web`; el filtro de fechas de `GET /jobs` en
  `apps/api` — 14/14 tests de `apps/web`, 11/11 de `apps/mobile`,
  51/51 de `apps/api`, verdes.

**Fase 9 (incluyendo este addendum) completa.** Como en el cierre de
Fase 8: no hay una fase siguiente definida en ningún documento del
proyecto. De la lista de brechas deliberadas, quedan: cámara en
mobile, notificaciones más allá de auth, y las migraciones mayores de
dependencias — sin cambios respecto a lo documentado arriba. Cualquier
dirección posterior necesita alcance definido por el stakeholder.
