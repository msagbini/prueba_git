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

### Funcionalidad — notificaciones (job-assigned, job-reminder)

El último ítem grande de la lista de brechas deliberadas era
"notificaciones más allá de auth", explícitamente marcado como algo
que requeriría definir alcance de negocio nuevo — no algo para
construir unilateralmente bajo la autorización estándar de esta fase.
El stakeholder lo autorizó explícitamente ("Dale todo lo que creas.
Sigue tú en lo tuyo"), así que el diseño de alcance de esta sección
es una decisión tomada bajo esa autorización puntual, no bajo la
autorización general de "doble-chequeado y probado" del resto de la
Fase 9.1.

**Decisión de alcance, y por qué:** en vez de inventar un proceso de
negocio nuevo, el módulo solo superficia dos eventos que ya ocurren:
una asignación de staff a un job, y un job por empezar pronto. Sin
entrega por email/push — el email transaccional de Fase 9 ya cubre el
único canal que los eventos de auth necesitaban, y agregar un segundo
canal de entrega sería inventar alcance real, no solo superficiar un
evento existente.

- **Schema**: `Notification` (`organizationId`, `userId` destinatario,
  `type` — `JOB_ASSIGNED`/`JOB_REMINDER` —, `title`, `body`,
  `entityType`/`entityId` sueltos en vez de una relación real, porque
  distintos tipos de notificación futuros podrían apuntar a distintos
  tipos de entidad, `readAt`). Migración con la misma política RLS
  `tenant_isolation` de siempre; la restricción a "mis propias
  notificaciones" (`userId = caller`) se aplica en
  `NotificationsService`, la misma segunda capa que ya usan los
  filtros de visibilidad de Staff/Client en Jobs/Invoices — RLS
  nunca fue pensado para filtrar por usuario, solo por organización.
  Permiso `notifications.read` sembrado para los cinco roles (una
  notificación es personal por construcción, no hay nada que un
  permiso además restrinja).
- **`NotificationWriterService`** (`modules/notifications`, exportado)
  espeja el rol de `AuditLogWriterService` para el trail de auditoría:
  el único punto de escritura que otros módulos usan. `JobsService.
createAssignment()` lo llama justo después de crear el
  `JobAssignment`, notificando al staff asignado.
- **`JobRemindersService`** (`modules/jobs`, nuevo, junto a
  `RecurringJobsService`): corre cada hora (no diario, como
  `RecurringJobsService` — una ventana de recordatorio de 24h no
  debería esperar a la corrida de la mañana siguiente si un job entra
  a esa ventana a mitad del día), mismo mecanismo de
  `system_job_read_all` + `runInTenantTransaction` para no tener
  contexto de tenant por-request. Notifica a cada staff asignado y a
  cada usuario de portal de cliente ligado al `clientId` del job (un
  cliente puede tener más de un usuario de portal — se notifica a
  todos, no solo al primero). Idempotente revisando si ya existe una
  notificación `JOB_REMINDER` para ese job+destinatario antes de
  crear otra, en vez de agregar un campo nuevo a `Job` para rastrear
  "ya se envió un recordatorio" — la tabla `Notification` ya tiene
  todo lo necesario para esa revisión.
- **API**: `GET /notifications` (paginado, propias, más recientes
  primero), `GET /notifications/unread-count` (para un badge),
  `POST /notifications/:id/read` (idempotente, 404 si no es propia).
- **`apps/web`**: `NotificationBell` en `AppLayout` — badge con el
  conteo sin leer (poll cada 30s), dropdown con las últimas
  notificaciones, click marca como leída. Sin deep-link a la entidad
  subyacente — cada tipo de notificación actual ya tiene un
  "next step" obvio ("andá a ver tus jobs") sin necesitar uno.
- **Verificado en vivo de punta a punta, no solo con los tests**: se
  creó una organización, un cliente, un job, y un staff real por
  HTTP; se confirmó el conteo de no-leídas en 0 antes de asignar, se
  asignó el staff al job, y se confirmó la notificación real
  (`JOB_ASSIGNED`, título/cuerpo con el nombre real del cliente) en
  la lista del staff — y que el Owner no la ve ni puede marcarla como
  leída (404). Con Playwright real se probó el bell completo en el
  navegador: badge con conteo real, dropdown con el contenido real,
  click marca como leída y el badge desaparece, click-afuera cierra
  el dropdown. Para el cron de recordatorios (imposible de esperar en
  vivo — corre cada hora) se escribió un test de integración contra
  Postgres real (`job-reminders.integration.spec.ts`, mismo patrón
  que `recurring-jobs.integration.spec.ts`): un job dentro de la
  ventana de 24h notifica tanto al staff asignado como al usuario de
  portal del cliente, uno fuera de la ventana no notifica a nadie, y
  correr el cron dos veces no duplica notificaciones.
- Cobertura e2e nueva en `business-flows.e2e.spec.ts`: el flujo
  completo de asignación → notificación → aislamiento entre
  usuarios → marcar como leída, agregado al test de asignación de
  Staff ya existente.

### Notificaciones en `apps/mobile`

Espejo del trabajo anterior en `apps/web` — mismo patrón que el
portal de cliente en mobile (más arriba en este addendum): llevar una
funcionalidad ya construida y verificada de un lado del monorepo al
otro, no una decisión de alcance nueva (esa ya se tomó, y se
documentó, en la sección de arriba).

- `NotificationsScreen` (alcanzable tanto desde `AppStack` de Staff
  como desde `ClientStack` de Client — una notificación no es
  específica de un rol): lista, tap para marcar como leída, mismo
  patrón de `FlatList` + `useFocusEffect` que el resto de las
  pantallas de esta app.
- `NotificationsButton`, un botón nuevo en el header de la pantalla
  de inicio de ambos stacks, junto a "Sign out" (`HeaderActions` los
  agrupa — `headerRight` de React Navigation solo acepta un slot).
  Badge con el conteo de no-leídas, poll cada 30s, mismo intervalo
  que `apps/web`'s `NotificationBell`. Sin librería de íconos (esta
  app no tiene ninguna instalada) — el emoji 🔔 como `Text`, mismo
  approach sin-íconos que el resto de la UI de mobile.
- Tipos `NotificationType`/`AppNotification` agregados a
  `types/api.ts` (con ese nombre, no `Notification`, para no
  confundir con cualquier tipo global futuro del mismo nombre —
  mismo cuidado que se tomó en `apps/web`).

**Verificación, misma limitación de siempre para esta app**: sin
Android SDK/Xcode en este contenedor, no se pudo renderizar en un
dispositivo o simulador real. Lo que sí se verificó: `tsc --noEmit`,
`eslint`, `jest` (11/11), y el bundle de Metro para Android — y, del
lado del backend real que esta pantalla consume, `GET /notifications`/
`GET /notifications/unread-count`/`POST /notifications/:id/read` ya
se habían verificado en vivo contra la API real al construir el
`NotificationBell` de `apps/web` más arriba en este documento.

### Verificación de este addendum

- `pnpm --filter web run build` / `lint` / `test` — verde.
- `pnpm turbo run lint build test --force` — 9/9 tareas verdes en todo
  el monorepo (`api`, `web`, `mobile`, `config`).
- Migración de índices aplicada limpiamente contra Postgres local
  (`prisma migrate dev`), sin downtime porque son solo `CREATE INDEX`
  aditivos.
- `docs/api/openapi.yaml` regenerado (`pnpm docs:api`) para incluir
  `GET /invoices/:id/pdf`, los nuevos query params de `GET /jobs`, y
  las tres rutas de `/notifications`.
- Tests nuevos: `decodeJwtRole()` (bien formado, sin claim `role`,
  malformado) en `apps/web` y `apps/mobile`; `AuthContext` (`role`
  reflejando el JWT tras login/restauración de sesión, y
  `setSession()`) en `apps/web`; el filtro de fechas de `GET /jobs`,
  el flujo de asignación → notificación, y `JobRemindersService`
  (integración contra Postgres real) en `apps/api` — 14/14 tests de
  `apps/web`, 11/11 de `apps/mobile`, 54/54 de `apps/api`, verdes.
- `pnpm audit --prod`: mismas 15 vulnerabilidades pre-existentes, sin
  cambios (no se agregó ninguna dependencia nueva para este módulo).

### Migración: `react-router-dom` 6→7

De las dos migraciones mayores de dependencias que quedaban
explícitamente diferidas, esta era la de menor riesgo real: `apps/web`
usa únicamente el modo declarativo (`BrowserRouter`/`Routes`/`Route`,
sin data router, sin `loader`/`action`, sin rutas splat `*`), que es
exactamente el caso que react-router v7 diseñó como superset
compatible de v6 — y la consola ya venía emitiendo los warnings de
preparación para v7 (`v7_startTransition`, `v7_relativeSplatPath`)
desde antes de esta fase, señal de que el terreno ya estaba
preparado. Se evaluó antes de tocar nada: sin eso, no se hubiera
intentado en la misma pasada que el resto de este addendum.

- `pnpm --filter web add react-router-dom@^7.18.2` — bump directo, sin
  cambios de código: compila limpio, sin errores de tipos.
- **Beneficio real, no solo la versión**: resuelve 2 de las
  vulnerabilidades de dependencias documentadas desde el audit
  original de Fase 9 (`GHSA-jjmj-jmhj-qwj2`, sin parche disponible en
  la serie 6.x; `GHSA-337j-9hxr-rhxg`, parcheada recién en 7.18.0+).
  `pnpm audit --prod`: 15 → 13 vulnerabilidades.
- Bundle inicial creció de 180.78 kB (58.97 kB gzip) a 195.73 kB
  (64.12 kB gzip) — el core de v7 es más grande. Aceptado: es el costo
  de estar en la versión soportada actual más el cierre de dos
  vulnerabilidades reales, no una regresión de rendimiento buscada.
- **Verificado en vivo con Playwright**, no solo con el build: los 6
  links de navegación operativa, las tarjetas de acceso directo del
  dashboard, el toggle List/Calendar de Jobs (estado interno, no
  routing, pero se confirmó que sigue andando), atrás/adelante del
  navegador vía la History API, logout, redirección de rutas
  protegidas a `/login` para un visitante no autenticado, y que
  `/forgot-password` (ruta pública) sigue rindiendo bien. Consola
  limpia de warnings de react-router (los de v6 preparándose para v7
  desaparecieron, como se esperaba).

**Hallazgo real, no relacionado con esta migración, encontrado
mientras se verificaba**: una secuencia de recargas de página
completas muy seguidas (`goto()` repetidos en rápida sucesión, algo
que un usuario real casi nunca hace, pero que un script de
verificación sí) puede terminar en un 401 y forzar logout. La
hipótesis, no confirmada con instrumentación del lado del servidor:
`AuthContext` dispara `POST /auth/refresh` en cada montaje completo de
la app; si una recarga nueva interrumpe el fetch de la rotación
anterior antes de que el navegador reciba el `Set-Cookie` con el
refresh token nuevo — pero el servidor ya procesó la rotación y
revocó el viejo — la siguiente carga reintenta con el token ya
revocado, dispara la detección de reuso, y revoca toda la familia de
tokens. Esto es un problema de la lógica de rotación de refresh
tokens (Fase 2), no de qué router se usa para renderizar rutas —
confirmado repitiendo la verificación con navegación client-side
realista (clicks en vez de `goto()` en cadena), donde logout/rutas
protegidas/rutas públicas funcionan exactamente como se espera. Se
deja documentado como hallazgo nuevo, no se intenta arreglar en este
commit — es código de seguridad sensible (rotación + detección de
reuso de tokens) que merece su propia pasada deliberada, no algo para
mezclar con una migración de router.

### Verificación de la migración de react-router

- `pnpm --filter web run build` / `lint` / `test` — verde.
- `pnpm turbo run lint build test --force` — 9/9 tareas verdes en todo
  el monorepo.

### Fix: race de rotación de refresh tokens (el hallazgo de arriba)

El hallazgo documentado arriba se investigó hasta encontrar la causa
raíz real, no solo la hipótesis. No era el `goto()` en rápida
sucesión en sí — era **`StrictMode`**: en desarrollo, React invoca
dos veces el efecto de montaje de un componente (monta → limpia →
monta de nuevo) para exponer efectos impuros, y el efecto de
restauración de sesión de `AuthContext` no tiene función de limpieza.
Resultado: cada carga de página en dev disparaba **dos** `POST
/auth/refresh` concurrentes compartiendo la misma cookie de refresh
token, todavía no rotada por ninguno de los dos. El servidor procesa
la segunda llegada como reuso de un token ya rotado por la primera —
exactamente el comportamiento correcto de la defensa de detección de
reuso (ADR 0004) ante un robo real de token — y revoca toda la
familia, deslogueando en silencio a un usuario que apenas cargó la
página por primera vez.

Confirmado experimentalmente contando requests de red antes de
cualquier cambio: una sola carga de página disparaba 2 llamadas a
`/auth/refresh` con timestamps casi idénticos.

- **Fix, deliberadamente acotado al cliente**: un guard con
  `useRef(false)` en el efecto de montaje de `AuthContext`, en
  `apps/web` y `apps/mobile`. El ref sobrevive el remontaje simulado
  de `StrictMode` (solo se re-ejecuta el cuerpo del efecto, el estado
  del componente no se resetea), así que limita el trabajo real de
  restauración de sesión a una sola llamada por montaje real. No se
  tocó la lógica de rotación/detección de reuso del servidor (Fase 2) — sigue siendo la misma defensa de seguridad, sin debilitar.
  `apps/mobile` no tenía un repro confirmado (no usa `StrictMode` de
  la misma forma), pero se aplicó el mismo guard de forma preventiva:
  mismo patrón de bug latente, mismo fix de bajo costo, defensa en
  profundidad directamente conectada al hallazgo.
- **Test de regresión** en
  `apps/web/src/context/AuthContext.test.tsx`, renderizando el
  `AuthProvider` envuelto en `<StrictMode>` y verificando que
  `fetch` reciba exactamente una llamada a `/auth/refresh`. Se
  confirmó que el test es un guard válido: se revirtió temporalmente
  solo el archivo del fix (`git stash push` de un único archivo,
  dejando el test nuevo en su lugar) y el test falló con el mensaje
  esperado (`expected [...] to have a length of 1 but got 2`);
  restaurado el fix, vuelve a pasar.
- **Verificado en vivo** contra el servidor de desarrollo real con
  Playwright (`verify-double-refresh.mjs`): antes del fix, una sola
  carga de página disparaba 2 llamadas a `/auth/refresh`; después del
  fix, exactamente 1. También se repitió la recarga simple/secuencial
  (F5 dos veces seguidas) confirmando que la sesión se mantiene
  autenticada en ambas, y el flujo de logout por navegación
  client-side sigue limpio.

**Alcance explícitamente dejado fuera, con honestidad**: existe una
segunda race, más angosta y distinta de esta, reproducible solo con
recargas de página completas (`goto()`) en sucesión muy rápida —
mucho más rápida que cualquier interacción humana real — donde una
recarga nueva puede interrumpir la recepción del `Set-Cookie` de la
rotación anterior antes de que el navegador la procese. Arreglar esa
race de raíz requeriría tocar la lógica de rotación/detección de
reuso del lado del servidor (Fase 2, código de seguridad sensible),
lo cual excede el alcance de este fix — que se mantuvo
deliberadamente del lado del cliente. Se deja documentado como
brecha conocida, no oculta.

#### Verificación de este fix

- `pnpm --filter web run test` — 15/15 verde (incluye el test de
  regresión nuevo).
- `pnpm --filter web run build` / `lint` — verde.
- `pnpm turbo run lint build test --force` — 9/9 tareas verdes en
  todo el monorepo.
- Verificación en vivo con Playwright contra el dev server real:
  `verify-double-refresh.mjs` (1 sola llamada a `/auth/refresh` por
  carga, antes eran 2),
  `verify-single-reload-stays-authenticated.mjs` (dos F5 seguidos,
  sesión se mantiene autenticada en ambos), `verify-logout-clean.mjs`
  (logout por navegación client-side sigue limpio).

### Auditoría de dependencias, segunda pasada

Una nueva corrida de `pnpm audit --prod` (auditoría vive contra la
base de datos de advisories, cambia con el tiempo — no es la misma
lista que la del cierre de Fase 9 original) mostró 13
vulnerabilidades, la mayoría en dependencias **transitivas** que
`@nestjs/config`, `@nestjs/swagger`, `@nestjs/common` y
`@nestjs/platform-express` fijan a una versión exacta más vieja que
la parchada — no algo que un simple `pnpm update` resuelva, porque el
`package.json` de esos paquetes de NestJS pide la versión exacta
vulnerable.

- **10 de las 13, corregidas** con `pnpm.overrides` en el
  `package.json` raíz, targeteando la versión exacta vulnerable como
  clave (no el nombre del paquete a secas) para no arrastrar
  resoluciones no relacionadas — por ejemplo `js-yaml` tiene tres
  instancias en el árbol (3.15.1 vía Jest, 4.1.0 vía
  `@nestjs/swagger` — la vulnerable —, 4.3.1 vía ESLint — ya sana);
  el override solo apunta a la 4.1.0:
  - `lodash@4.17.21 → ^4.18.1` (vía `@nestjs/config`,
    `@nestjs/swagger` — inyección de código en `_.template` y dos
    prototype-pollution).
  - `js-yaml@4.1.0 → ^4.3.1` (vía `@nestjs/swagger` — CPU cuadrático
    y prototype-pollution en `merge`).
  - `file-type@20.4.1 → ^21.3.2` (vía `@nestjs/common` — loop
    infinito parseando ASF, DoS por bomba de descompresión ZIP).
  - `qs@6.14.2 → ^6.15.3` / `body-parser@1.20.4 → ^1.20.6` (vía
    `express`/`@nestjs/platform-express` — DoS en `stringify`,
    enforcement de límite de tamaño que se desactivaba en silencio
    con un valor de `limit` inválido).
  - `multer@2.0.2 → ^2.2.0` (vía `@nestjs/platform-express` — cuatro
    CVEs de denegación de servicio, incluyendo limpieza incompleta de
    subidas abortadas y anidamiento profundo de campos). Este es el
    único de los seis con superficie de ataque real y directa en esta
    app — es la librería que procesa las subidas de fotos de
    adjuntos de jobs (Fase 9) —, así que mereció su propia
    verificación dirigida, no solo confiar en que "es un bump menor":
    `test/job-attachments.e2e.spec.ts` (que ejercita el flujo de
    subida real contra la API) sigue en verde después del bump.
  - Todos son bumps de parche o menor dentro del mismo major de cada
    paquete — ninguno cambia una API que este proyecto use
    directamente (son dependencias de dependencias, nunca importadas
    por código propio).
- **3 de las 13, dejadas fuera de esta pasada deliberadamente** —
  cada una requeriría una migración mayor de versión, con su propio
  riesgo de romper algo y su propia verificación dedicada, no algo
  para mezclar con bumps de parche:
  - **`@nestjs/core`** necesita `>=11.1.18` — es decir, terminar la
    migración de NestJS 10→11 completa (Express v5, sintaxis de rutas
    de `path-to-regexp` v8), ya identificada como pendiente desde el
    cierre de Fase 9 original.
  - **`react-router`** necesita `>=8.3.0` — una migración 7→8 nueva,
    no identificada hasta ahora (la migración 6→7 de este mismo
    documento ya quedó verificada y cerrada; esta es otra, posterior).
  - **`fast-xml-parser`** necesita `>=5.7.0` — enterrada dentro del
    propio toolchain de Android de React Native
    (`@react-native-community/cli-platform-android`), una herramienta
    de build de desarrollo, no código de runtime de la app. No se
    forzó el override: es un salto de major (4→5) en una herramienta
    de terceros sin dispositivo/emulador disponible en este entorno
    para verificar que el build de Android siga funcionando después.

`pnpm audit --prod`: 13 → 3 vulnerabilidades (las tres migraciones
mayores de arriba).

#### Verificación de esta pasada de dependencias

- `pnpm install` limpio con los overrides aplicados.
- `pnpm turbo run lint build test --force` — 9/9 tareas verdes en
  todo el monorepo, incluyendo `test/job-attachments.e2e.spec.ts`
  (multer + file-type, verificado en vivo contra Postgres real) y el
  resto de la suite de 54 tests de `apps/api`.
- `pnpm audit --prod`: 13 → 3, las tres restantes documentadas arriba
  como migraciones mayores fuera de alcance.

### Migración: `react-router` 7→8 (y lo que arrastró: React 19, Vite 7)

Al evaluar esta migración (identificada en la pasada de auditoría de
dependencias de arriba) se descubrió que **no es un bump aislado del
router**, a diferencia de la 6→7 anterior: `react-router@8.3.0`
declara `peerDependencies` de `react`/`react-dom` `>=19.2.7` y
`engines.node >=22.22.0`, y el paquete separado `react-router-dom` se
discontinuó — todo se unificó en el paquete `react-router` (`import
... from 'react-router'`, sin más `react-router-dom`). Vite 7 (el
build tool) también exige Node `>=20.19`/`>=22.12`, ya cubierto por
este entorno. El diagnóstico completo se le presentó al stakeholder
antes de tocar nada, porque cambiaba el perfil de riesgo que se
había asumido inicialmente (de "bump de router" a "tres migraciones
mayores encadenadas: React 18→19, Vite 5→7, router 7→8"); autorizó
seguir con las tres en la misma pasada.

- **React 18.3.1 → 19.2.8, Vite 5.4.8 → 7.3.6, `react-router-dom`
  7.18.2 → `react-router` 8.3.0** en `apps/web`. `@vitejs/plugin-react`
  4→5, `vitest` 2→4, `@vitest/coverage-v8` 2→4 (todos con soporte de
  Vite 7 confirmado contra sus propios `peerDependencies` antes del
  bump). `@testing-library/react` 16.3.2 ya soportaba React 19 sin
  cambios. `@types/react`/`@types/react-dom` a las versiones 19
  correspondientes.
- El código ya usaba patrones compatibles con React 19 desde antes
  (`createRoot`, sin `ReactDOM.render`, sin `PropTypes`, sin
  `defaultProps` en componentes de función, sin refs de string) —
  verificado por grep antes de asumir que el bump sería limpio. El
  único ajuste real de código: `@types/react` 19 eliminó el
  namespace global `JSX` (vive ahora en `React.JSX`), así que los 24
  archivos que anotaban `: JSX.Element` como tipo de retorno
  necesitaron importar `type { JSX } from 'react'` explícitamente —
  mecánico, sin cambio de comportamiento.
- Los 10 imports de `react-router-dom` en `apps/web/src` pasaron a
  `react-router` — confirmado antes de tocar código que `BrowserRouter`,
  `Route`, `Routes`, `Navigate`, `Outlet`, `NavLink`, `Link`,
  `useNavigate`, `useSearchParams`, `useParams` (todo lo que esta app
  usa) siguen exportados desde el paquete principal `react-router`,
  no desde el sub-path `react-router/dom` (ese sub-path es solo para
  APIs de router de datos — `RouterProvider`, `HydratedRouter` —, que
  esta app no usa).
- Bundle inicial creció de 195.77 kB (64.13 kB gzip) a 244.39 kB
  (78.45 kB gzip) — el runtime de React 19 más el paquete unificado
  de router 8 (que trae `cookie-es` como dependencia nueva) son más
  grandes. Aceptado, mismo razonamiento que la migración anterior: es
  el costo de estar en versiones soportadas y sin vulnerabilidades
  conocidas, no una regresión de rendimiento buscada.
- **Verificado en vivo con Playwright** con navegación realista
  (clicks, no `goto()` encadenados): los 6 links de navegación
  operativa, las tarjetas del dashboard, el toggle List/Calendar de
  Jobs, atrás/adelante del navegador vía clicks + History API,
  logout, redirección de rutas protegidas a `/login`, y
  `/forgot-password` público. Consola limpia salvo el único 400 ya
  conocido y esperado (`POST /auth/refresh` sin cookie en el primer
  `GET /login` de un visitante nuevo — comportamiento por diseño, no
  un error).
- **Un primer intento de verificación con el script heredado de la
  migración 6→7** (que sí encadena varios `goto()` de recarga
  completa seguidos) reprodujo el 401/logout silencioso de la race ya
  documentada arriba, en su forma original: confirma que sigue viva
  y sin tocar, no que esta migración la haya introducido — se
  reconfirmó corriendo la misma secuencia con navegación realista
  (clicks), que pasó limpio.

`pnpm audit --prod`: 3 → 2 (resuelve `GHSA-qwww-vcr4-c8h2`,
react-router RSC-mode CSRF bypass — que esta app no ejercitaba, al no
usar RSC, pero igual cerraba el hallazgo del audit).

#### Verificación de esta migración

- `pnpm --filter web run build` / `lint` / `test` — verde (15/15
  tests, incluyendo el de regresión de StrictMode del fix anterior).
- `pnpm turbo run lint build test --force` — 9/9 tareas verdes en
  todo el monorepo.
- `pnpm audit --prod`: 3 → 2 vulnerabilidades.
- Verificación en vivo con Playwright contra el dev server real
  (Vite 7, React 19), navegación realista: sin errores de consola
  nuevos, todos los flujos operativos y de auth intactos.

**Fase 9 (incluyendo este addendum) completa.** Como en el cierre de
Fase 8: no hay una fase siguiente definida en ningún documento del
proyecto. De la lista de brechas deliberadas, quedan: cámara en
mobile, la migración de NestJS 10→11 (superficie de cambios
incompatibles — Express v5, sintaxis de rutas de path-to-regexp v8 —
demasiado grande para verificar con el mismo rigor que el resto de
este documento en una sola pasada; es también la única de las dos
vulnerabilidades restantes que sigue pendiente, junto con
`fast-xml-parser`), la actualización mayor de `fast-xml-parser`
dentro del toolchain de Android de RN (sin forma de verificar el
build de Android real en este entorno), y la race angosta de
recargas `goto()` en rápida sucesión documentada arriba (fuera de
alcance porque requiere tocar la detección de reuso de tokens del
servidor — reconfirmada viva, sin tocar, durante esta migración).
Cualquier dirección posterior necesita alcance definido por el
stakeholder.
