# RULES.md — Reglas No Negociables del Proyecto Noctium

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · TypeScript · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (generator `prisma-client`) · NextAuth (Credentials Provider) · Tailwind CSS · shadcn/ui

Estas reglas son de cumplimiento obligatorio en todo el código de Noctium. Toda spec de módulo (`docs/specs/spec_modulo_<letra>.md`) y toda task de HU (`docs/tasks/HU-<letra><n>.md`) deben ser consistentes con ellas. Si una excepción puntual es necesaria, se documenta explícitamente en la spec/task correspondiente — nunca se aplica en silencio.

---

## Regla N.° 1 — Prohibido el borrado físico (`DELETE`)
Ninguna entidad del dominio se elimina con `DELETE`. Toda "baja" es una actualización lógica: `is_active: false`, `deleted_at: DateTime`, `deleted_by: <usuario_id>`, `deletion_reason: string`. Cada spec de módulo define cuándo `deletion_reason` es obligatorio (p. ej. condicionado a que la entidad tenga turnos, pagos o historial activo asociado). Los registros dados de baja se preservan siempre — turnos pasados, pagos, historial académico nunca se pierden.

## Regla N.° 2 — Trazabilidad de mutaciones sensibles
Toda mutación sensible (alta, baja lógica, edición, transición de estado) registra de forma verificable **qué** ocurrió, **cuándo** y **quién** la realizó. El mecanismo se elige por caso, sin necesidad de infraestructura de eventos asíncrona ni encadenamiento por hash:

- **(a) Columnas de auditoría en la propia entidad** (`created_at`, `creado_por_usuario_id`, `updated_at`, etc.) — patrón por defecto cuando la trazabilidad requerida es la del ciclo de vida normal del registro (quién y cuándo lo creó/modificó).
- **(b) Escritura directa y síncrona a una tabla de eventos por dominio** — cuando se necesita registrar múltiples eventos discretos sobre la misma entidad a lo largo del tiempo (intentos, cambios de estado repetibles, eventos de seguridad). Ver `EventoSeguridad` (módulo A) como patrón de referencia.

La escritura ocurre **después** de que `prisma.$transaction` resuelva exitosamente cuando el registro de trazabilidad es una tabla separada (opción b) — nunca dentro de la misma transacción de negocio, para no acoplar el commit de datos a una escritura secundaria. Cuando la trazabilidad es parte de la propia fila (opción a), se persiste en la misma operación.

Cada spec de módulo indica cuál de las dos opciones usa y por qué, como parte de su documentación normal — no hace falta una nota de excepción cada vez que se elige (a) por sobre (b) o viceversa.

> Nota de historial: esta regla reemplaza una versión anterior que exigía un event bus asíncrono y un `AuditLog` encadenado por hash SHA-256. Se ajustó porque ningún requisito externo (cátedra/PO) pedía ese nivel de garantía, y los primeros módulos implementados (A y L) ya habían resuelto la trazabilidad de forma efectiva con columnas de auditoría y escritura directa. Decisión de equipo, revisada a partir de la implementación real.

## Regla N.° 3 — Aislamiento de dominio entre módulos
Un módulo no valida ni consulta directamente tablas internas de otro módulo. La comunicación entre módulos ocurre exclusivamente vía: (a) eventos de dominio, o (b) llamadas explícitas a la capa de servicios **pública** del otro módulo. Ejemplo: Pagos (I) no valida un Turno (C) leyendo su tabla — invoca el servicio público de Turnos o reacciona a su evento.

## Regla N.° 4 — La capa de servicios es la única dueña de la lógica de negocio
Route Handlers (`app/api/**/route.ts`) y Server Actions (`src/server/<modulo>/actions.ts`) son capa delgada: validan el payload con Zod, verifican sesión/permiso, invocan `src/server/<modulo>/<modulo>.service.ts` y traducen el resultado al contrato de respuesta estándar. Ninguna regla de negocio vive en un Route Handler o Server Action — vive exclusivamente en el `.service.ts` del módulo, que es una función TypeScript común (sin `"use server"`, sin acceso a `FormData`/`Request`), reutilizable desde Route Handlers, otras Server Actions, scripts o tests.

> Nota de historial: esta regla originalmente referenciaba `lib/services/<modulo>/*.service.ts` como ubicación de la capa de servicios. Se corrigió para reflejar la convención real del proyecto: el service vive junto a la action, dentro de `src/server/<modulo>/`, sin una carpeta `lib/services/` separada en la raíz.

## Regla N.° 5 — Contrato de respuesta estándar
- **Route Handlers:** éxito → `NextResponse.json({ data, error: null }, { status })`; error → `NextResponse.json({ data: null, error: { code, message } }, { status })`, con `status` semántico (400/401/403/404/409/422).
- **Server Actions:** mismo shape como objeto plano serializable (`return { data, error: null }` / `return { data: null, error: {...} }`) — nunca retornan una instancia de `NextResponse`.

> **Excepción — Server Actions consumidas vía `useActionState`:** cuando una Server Action se usa como reducer de `useActionState` (ej. `iniciarSesion` en `login-form.tsx`, `crearMateria` en `materia-form.tsx`), su firma y su shape de retorno quedan determinados por el hook de React y por el estado que consume el formulario (`EstadoLogin`, `EstadoMateria`, con campos como `status: "idle" | "error_validacion" | "error_comunicacion" | ...`), no por el `{ data, error }` genérico de esta regla. El **service** invocado por la action sigue devolviendo datos/errores en forma neutra (o lanzando `ServiceError`); es responsabilidad de la action traducir ese resultado neutro al shape de estado específico del formulario — incluida la traducción de código de error a mensaje de UI (ej. `MENSAJES_POR_CODIGO`), que vive en la action y no en el service, para no acoplar la capa de negocio al copy de UI. Esta excepción aplica a toda Server Action ligada a `useActionState`, no solo a Sesión y Materias.

## Regla N.° 6 — Validación Zod previa a la capa de servicios
Todo payload se valida con `schema.safeParse()` antes de tocar la capa de servicios. Un `!success` retorna `400` con el `flatten()` del error de Zod.

## Regla N.° 7 — Concurrencia: condición y mutación en una única sentencia atómica
Prisma sobre PostgreSQL bajo `READ COMMITTED` no aplica bloqueo pesimista implícito. Toda operación que dependa de un estado previo para decidir si puede ejecutarse (cupo de un turno, saldo, umbral de stock/monto) debe resolver la condición y la mutación en una sola sentencia (`updateMany` con la condición dentro del `where`), nunca con `findUnique` + `update` separados. `count === 0` significa que la condición no se cumplía al momento de ejecutar — no asumir que la fila no existe.

```typescript
// Patrón obligatorio — ejemplo genérico (cupo de turno)
const resultado = await tx.turno.updateMany({
  where: { id: turnoId, cupos_disponibles: { gte: 1 } },
  data: { cupos_disponibles: { decrement: 1 } },
});
if (resultado.count === 0) throw new ServiceError("CUPO_INSUFICIENTE");
```

## Regla N.° 8 — Inmutabilidad de registros de hecho consumado
Registros que representan un hecho ya ocurrido (un pago confirmado, un movimiento de historial académico, una asistencia registrada) no admiten `UPDATE` una vez insertados. Toda corrección se resuelve con un registro compensatorio nuevo que referencia al original.

## Regla N.° 9 — Inyección de credenciales y secretos
Ninguna clave, secreto o credencial se hardcodea. Toda credencial (`NEXTAUTH_SECRET`, credenciales de Mercado Pago, etc.) se lee exclusivamente desde variables de entorno inyectadas vía `.env` / secretos de Docker.

## Regla N.° 10 — RBAC granular por acción
Toda ruta protegida requiere sesión autenticada (NextAuth) y verificación de permiso granular por acción (`withPermission("<modulo>:<accion>")`), nunca solo por rol genérico. La matriz de permisos por rol (mesa de entradas, profesor, gerente, alumno) se documenta y mantiene junto a `spec_modulo_A.md`.

## Regla N.° 11 — Estructura de carpetas por módulo
Cada módulo (Sesión, Materias, Aulas, Turnos, etc.) ubica sus archivos siempre en el mismo lugar, independientemente de qué ruta de `app/` los consuma:

- **Tipos de dominio** → `src/types/<modulo>.types.ts` (ej. `src/types/materia.types.ts`). Los `.d.ts` sueltos en `src/types/` quedan reservados exclusivamente para declaraciones ambientales/globales (ej. `next-auth.d.ts`), no para tipos de dominio.
- **Server Actions** → `src/server/<modulo>/actions.ts` (ej. `src/server/materias/actions.ts`). Capa delgada únicamente (ver Regla N.° 4): valida, verifica permiso, llama al service y traduce la respuesta.
- **Lógica de negocio (services)** → `src/server/<modulo>/<modulo>.service.ts` (ej. `src/server/materias/materia.service.ts`), en el mismo módulo que su action. Es donde vive toda regla de negocio real (ver Regla N.° 4).
- **`src/app/**`** contiene únicamente `page.tsx`, `layout.tsx` y componentes propios de esa ruta — nunca tipos, actions ni services sueltos junto a una página.

Las importaciones a estos archivos usan siempre el alias configurado (`@/types/...`, `@/server/...`), nunca rutas relativas (`../actions`, `./materia.types`).
### Textos incorporados por HU-H-07 (08/10/2026)

Los textos nuevos del Índice de presentismo se centralizan bajo `ui.indicadores.presentismo.*` en `src/lib/textos.ts`: títulos y leyendas de gráficos, series, aviso de clases sin control, tabla y su umbral, columnas, enlace al historial y estados de carga/error/vacío/reintento. Los parámetros de aviso y umbral se interpolan mediante `texto()`. Esto documenta el cumplimiento de HU-C-23 sin modificar reglas de negocio ni permisos.

## Sprint 3 — Registro de asistencia (HU-E-09)

Registrar una clase dictada toma primero el bloqueo canónico de la clase con `bloquear`, dentro de `transaccion`. Con el mismo momento del reloj, vence perezosamente las reservas y copia exclusivamente inscripciones vigentes. Las transiciones de vencimiento que encola C se escriben después del commit; si la validación revierte, se descartan. La clase y sus estados de asistencia son un snapshot inmutable con auditoría en la misma fila; marcar Ausente no cambia pagos, precios ni inscripciones. La unicidad no anulada se protege con el índice parcial y `ON CONFLICT` parametrizado, sin captura de P2002 dentro de la transacción. Todas las lecturas usan el valor vigente compartido de E y excluyen clases anuladas.
### Cancelación propia de inscripciones (HU-C-14)

La elegibilidad del listado y la escritura usan el mismo evaluador. La cancelación bloquea clase e inscripción, marca vencimientos y relee estado, pago y parámetros antes de finalizar lógicamente como `CANCELADA_ALUMNO`. El instante exacto del límite está permitido; una reserva sin pagar puede cancelarse antes de su vencimiento. Pagos e importes quedan intactos. El historial y los eventos se escriben después del commit.

### Lecturas y datos de presentación del Sprint 3

Los indicadores componen exclusivamente lecturas de las fachadas públicas de los módulos dueños del dato (Regla N.° 3). Los fixtures de presentación se registran en `prisma/seed/fixtures/index.ts`, usan servicios de dominio para las mutaciones y comprueban una clave estable antes de crear: repetir el seed no duplica ni modifica hechos existentes.

## Aplicación HU-I-07 — Formas de pago (10/10/2026)

- Solo `formas_pago:editar` y `formas_pago:desactivar` (Gerente) permiten modificar estados/nombres. Todas las rutas verifican sesión y permiso en servidor; `desactivar` incluye reactivar.
- Nombre único normalizado entre activas e inactivas, excluyendo la propia; no se edita `esEfectivo` ni se modifica ningún pago/comprobante emitido.
- Toda baja bloquea el conjunto activo más la forma solicitada con `bloquear` dentro de `transaccion`; solo después recuenta activas y revalida motivo obligatorio con pagos. Nunca puede quedar el catálogo sin formas activas.
- La preferencia del alumno se conserva al desactivar; B expone su estado y el conteo por su fachada. Las opciones de pago/preferida ofrecen activas, y una preferida inactiva no se preselecciona para cobrar.
- Baja/reactivación encolan historial con actor y motivo para después del commit, usando el mecanismo común con reintento. El listado no muestra Preferida por; el impacto solo se informa en la confirmación.

## Aplicación HU-A-06 — Cuenta de acceso y sesión

- La sesión se valida en el servidor en este orden: sesión válida → `jti` revocado → cuenta leída por clave primaria (inexistente, inactiva o con `iat_sesion` anterior a `sesionesValidasDesde` → 401 `SESION_INVALIDA`) → marca «Debe cambiar la contraseña» → permiso del rol. La marca se decide con el valor de la base, nunca con el del token; el token solo sirve para que el proxy redirija.
- `withPermission`, `verificarPermiso` y `exigirPermiso` aplican los mismos pasos. Con la marca solo pasan `sesion:ping` y `cuenta:cambiar_password` (el resto, 403 `DEBE_CAMBIAR_PASSWORD`). `exigirPermiso` redirige según el `code`: `SESION_INVALIDA` → `/login`, `DEBE_CAMBIAR_PASSWORD` → `/primer-ingreso`, `SIN_PERMISO` → `/sin-permiso`. Toda pantalla nueva llama a `exigirPermiso`.
- Alta de alumno y de profesor con cuenta: una sola `transaccion()` que revalida el DNI, crea la cuenta con `crearCuentaParaFicha` (el rol lo fija el servicio de la ficha) e inserta la ficha con su `usuarioId`. El `P2002` del DNI se captura fuera de la transacción. La contraseña inicial (el DNI) se guarda solo como hash y nunca se registra ni se devuelve.
- Cambio de email de una ficha con cuenta: siempre con `cambiarEmailCuenta`, en la misma transacción que la ficha; un email igual al actual no se revalida y no se revocan sesiones. Una ficha con cuenta no puede quedarse sin email. Ninguna ficha crea una cuenta retroactiva.
- Tarjeta «Cuenta de acceso»: un único componente compartido (`src/components/shared/cuenta-acceso-card.tsx`), alimentado con `obtenerResumenCuenta`; nunca muestra el hash ni el DNI.

## Aplicación HU-A-05 — Recuperar contraseña olvidada

- Rutas y pantallas públicas: `POST /api/auth/recuperar-password`, `POST /api/auth/restablecer-password`, `/recuperar-contrasena` y `/restablecer-contrasena`. No pasan por `withPermission` ni por `exigirPermiso` y no están en el `matcher` del proxy ni en `rutas-por-rol.ts`: la autorización es el enlace. Son la excepción a «toda pantalla nueva llama a `exigirPermiso`».
- Respuesta uniforme (Regla N.° 5): el pedido responde `200 { data: { solicitada: true } }` exista o no la cuenta, esté inactiva o se haya superado el límite. Solo el formato inválido (400) y el bloqueo agotado (409, depende solo del email) responden distinto. Todo lo que depende de la existencia de la cuenta corre después de responder.
- `after()` de `next/server`: los servicios no importan `next/*`. `solicitarRecuperacion` devuelve `{ entro }` y la capa delgada programa la tarea con `programarProcesamientoRecuperacion` (`src/server/sesion/recuperacion.tarea.ts`). Vive en un módulo aparte porque `actions.ts` es `"use server"`: todo lo que exporta queda expuesto como Server Action. La tarea tiene su propio `try/catch` y registra solo el tipo de error.
- Límite de 3 solicitudes por email por hora (Regla N.° 7): bloqueo de aviso `pg_advisory_xact_lock(4105, hashtext(email))` dentro de la `transaccion` que cuenta e inserta, por `$executeRaw` y bajo su `lock_timeout`. No se combina con bloqueos de filas, así que no entra en el orden de bloqueo único. La cuarta solicitud registra `RECUPERACION_LIMITADA` con `usuarioId` nulo y no inserta.
- Enlace: 32 bytes de `crypto.randomBytes` en base64url; se guarda solo su hash SHA-256 en hex (`tokenHashRecuperacion`, único) y vence a los 30 minutos de `ahora()`. Usarlo es un `UPDATE … WHERE consumido IS NULL AND vence > ahora RETURNING`, nunca leer y después marcar. Un 410 (cuenta inactiva) o un 422 (igual a la vigente) después de consumirlo deshacen la transacción y el enlace sigue valiendo.
- Orden de bloqueo propio: primero la fila de la cuenta (`FOR UPDATE`) y después sus enlaces, tanto al crear un enlace nuevo (que invalida los abiertos) como al restablecer. Así dos pedidos simultáneos no dejan dos enlaces abiertos y restablecer no se traba con un pedido en curso.
- Restablecer llama a `cambiarPassword(tx, { …, conservarSesionActual: false, origen: "RECUPERACION", ip })` e invalida en la misma transacción los demás enlaces abiertos de la cuenta, que `cambiarPassword` no toca. No inicia sesión.
- Al terminar, el formulario hace siempre `POST /api/auth/logout` (tolera que no haya sesión) y recién después navega con `window.location.href` a `/login?contrasena=actualizada`. Sin eso, una sesión abierta desde «Mi cuenta», ya revocada, haría que `/login` redirija a `/home` y el aviso no se vería.
- Datos sensibles: ni el token, ni el enlace, ni las contraseñas, ni los hashes van en eventos, logs ni respuestas. El enlace solo aparece en el texto plano del email del simulador, fuera de producción. Un error al armar o enviar el email (incluida la falta de `NEXTAUTH_URL`/`AUTH_URL`) invalida el enlace recién creado y registra `RECUPERACION_ENVIO_FALLIDO`.
- Encabezados: `next.config.ts` fija `Referrer-Policy: no-referrer` en `/restablecer-contrasena` y `Cache-Control: no-store, must-revalidate` en las dos pantallas; las dos rutas de API lo fijan en cada respuesta.

## Aplicación HU-B-07 — Estado del alumno

La baja y reactivación toman primero el bloqueo canónico del alumno y validan estado y versión. La baja elige como candidatas solo las inscripciones vigentes de clases Disponibles o Completas que empiezan después del momento de la baja (las clases pasadas o en curso no se bloquean ni se tocan), bloquea esas clases e inscripciones y, con ellas bloqueadas, marca las reservas vencidas del alumno en esas clases; después finaliza solo las inscripciones vigentes con `BAJA_ALUMNO`, conserva pagos y hechos académicos, desactiva la cuenta y revoca sesiones en la misma transacción. La reactivación no restaura inscripciones ni sesiones. El historial de estado se encola para después del commit. El motivo es obligatorio si C, I o E informan registros previos mediante sus fachadas públicas. El DNI y el email de contacto de una ficha inactiva siguen contando para la unicidad: el autorregistro los rechaza con `CUENTA_YA_EXISTE`, y lo comprueba otra vez dentro de la transacción del alta, con las fichas de ese email tomadas `FOR SHARE`, para serializarse con una baja concurrente.

## Aplicación HU-D-08 — Estado del profesor

El permiso `profesores:cambiar_estado` se comprueba en las rutas y actions. Baja/reactivación bloquean al profesor y validan versión y estado; la ficha y su cuenta cambian en la misma transacción. C toma ese mismo recurso antes de crear, confirmar, generar o reprogramar clases y vuelve a comprobar actividad. Los lotes usan una transacción por clase, conservan pagos e inscripciones y reportan fallos por fila. El historial de estados se encola después del commit. La revocación de A conserva milisegundos y el guard compara `iat_sesion` sin truncar; renovar no cambia ese inicio y reactivar no borra el umbral.

Textos nuevos centralizados en `ui.profesores.estado.*`; selección de M-40 limitada al filtro y página visible (diez), por decisión explícita del usuario documentada en la task. Los ids de clase admiten los identificadores estables del seed, con pertenencia validada antes del lote.

## Aplicación HU-F-01 — Personal de mesa de entrada

- Solo el Gerente gestiona el personal (`personal:crear`, `personal:editar`, `personal:leer`). Las rutas usan `withPermission`, las Server Actions `verificarPermiso` (antes de validar con Zod, para que nadie sin permiso obtenga información) y las páginas `exigirPermiso`. `/personal/:path*` está en el `matcher` del proxy y en `rutas-por-rol.ts` (`personal: ["GERENTE"]`).
- La ficha y la cuenta son una unidad: el alta corre en una sola `transaccion()` — DNI único entre todas las fichas de mesa de entrada (activas e inactivas, sin cruzar con otras tablas) → `crearCuentaParaFicha` con rol `MESA_ENTRADA` → la ficha con `usuarioId`. El `P2002` del DNI se captura fuera de la transacción. El servicio le entrega el DNI a A y nunca ve, devuelve ni registra la contraseña inicial.
- Modificar exige `version` y escribe con `updateMany` condicionado (Regla N.° 7). Sin cambios responde `campos_modificados: []` sin escribir. Orden: primero la ficha y después `cambiarEmailCuenta` (el mismo orden de bloqueo que usará la baja de HU-F-05). El email de la ficha es el de la cuenta, no se puede vaciar y su cambio no revoca sesiones; cambiar el DNI no toca la contraseña. Una ficha inactiva se puede modificar y no se reactiva.
- La verificación al salir del campo (`verificarDisponibilidadIntegrante`) solo dice si el DNI o el email están disponibles, nunca de quién son; excluye la propia ficha y su cuenta al editar, y un `excluirId` inexistente es `404 INTEGRANTE_NO_ENCONTRADO`. Es una ayuda: el alta y la modificación repiten la verificación.
- Los errores se lanzan como `ErrorDeDominio` con las claves `errores.personal.*` (`DNI_DUPLICADO`, `INTEGRANTE_NO_ENCONTRADO`, `CONFLICTO_EDICION_CONCURRENTE`) y `errores.cuenta.emailYaAsociado`. El 400 es `VALIDATION_ERROR` con los errores por campo en `detalles`.
- La identidad de una persona (nombre, apellido, DNI con la longitud de `ParametroSistema`, fecha de nacimiento y género) se valida con `construirIdentidadPersonaSchema` (`src/server/shared/identidad-persona.schema.ts`), compartida con HU-G-01, con mensajes de `ui.comun.identidad.*`. No exige mayoría de edad.
- La pantalla confirma siempre el alta y la edición (HU-C-25); el éxito se informa en la ficha con el banner de `?creado=1` o `?actualizada=1`.

## Aplicación HU-F-03 — Listado del personal de mesa de entrada

- `GET /api/personal` y `/personal` solo para el Gerente (`personal:leer`): `withPermission` en la ruta y `exigirPermiso` en la página. La ruta valida la query con `ListarPersonalQuerySchema` (`.strict()`): `pagina` entero positivo y `q` de hasta 100 caracteres; cualquier otro parámetro, incluido `por_pagina`, es `400 VALIDATION_ERROR` con `detalles`.
- `listarPersonal({ pagina, q }, db?)` es de solo lectura: orden por apellido y nombre normalizados y DNI, búsqueda con `construirFiltroBusquedaPersonal` (`src/server/personal/personal.busqueda.ts`, criterio de HU-B-05 sobre las columnas de la ficha) y paginación fija de a `POR_PAGINA_PERSONAL = 10`. `total` y `total_paginas` son del resultado filtrado; una página fuera de rango se lleva a la última y, sin resultados, `pagina` es 1 y `total_paginas` 0 (igual que alumnos). Opera sobre activos e inactivos.
- La búsqueda reutiliza `tokenizarBusqueda` de `src/lib/busqueda-texto.ts` (no hay `busqueda-persona.ts`) y cada módulo arma su propio filtro sobre sus columnas, sin importar el de alumnos.
- La pantalla copia la mecánica del listado de alumnos sin acoplarse: `CampoBusqueda` con debounce y página 1 al cambiar el texto, respuestas viejas descartadas, `replaceState` de la URL, `Pagination` con enlaces que conservan `q` (`parametrosListadoPersonal`), filas inactivas atenuadas y toda la fila enlazada a la ficha. Los textos salen de `ui.personal.listado.*`.

## Aplicación HU-F-05 — Baja y reactivación del personal de mesa de entrada

- Solo el Gerente da de baja y reactiva (`personal:cambiar_estado`): `withPermission` en `POST /api/personal/[id]/desactivar` y `/reactivar`, `verificarPermiso` en las Server Actions `desactivarIntegrante` y `reactivarIntegrante` (antes de validar con Zod) y `tienePermiso` en la ficha para mostrar «Desactivar» o «Reactivar».
- La baja y la reactivación corren en una sola `transaccion()` con el patrón de HU-D-08: `bloquear` la ficha (`fichasMesaEntrada`, nivel recurso) antes de leer nada → releer estado y `version` → `updateMany` condicionado a estado y `version` (Regla N.° 7) → la cuenta en la misma transacción (`desactivarCuenta`, que también revoca las sesiones, o `reactivarCuenta`, que no las restaura y conserva la marca de cambio de contraseña) → `registrarCambioEstado` con entidad `FICHA_MESA_ENTRADA`, que se escribe después del commit (Regla N.° 2, opción b). `modificadoPorUsuarioId` y `version + 1` van en la misma fila.
- No se da de baja a quien tiene la caja abierta: con la ficha ya bloqueada se lee `cajaAbiertaDe` (fachada `caja.publico.ts`) y se rechaza con `CAJA_ABIERTA`. Como `abrirCaja` bloquea la misma ficha antes de insertar la caja, las dos operaciones se serializan sobre la fila (spec F §3.4); está probado con PostgreSQL en los dos órdenes.
- El motivo de la baja es obligatorio si la cuenta «registró operaciones» (DEC-39): lo decide `usuarioRegistroOperaciones(tx, usuarioId)` de `src/server/shared/actividad-usuario.ts`, que recorre en orden las lecturas de I (`pago.publico.ts`), C (`turno.publico.ts`), L (`materia.publico.ts`) y el historial de estados (`historial-estados.ts`) y corta en la primera verdadera. Cada módulo publica su lectura en su fachada; las fachadas no importan el agregador. Cada HU suma su línea ahí (HU-N-01, la de parámetros). Una ficha sin cuenta no consulta caja ni operaciones: el motivo es opcional.
- El motivo se recorta, hasta 300 caracteres, y vacío equivale a no enviado; si viene, se guarda aunque no sea obligatorio. La reactivación no pide motivo. Errores con `ErrorDeDominio`: `INTEGRANTE_YA_INACTIVO`, `INTEGRANTE_YA_ACTIVO`, `CAJA_ABIERTA` (409), `MOTIVO_REQUERIDO` (400), además de `INTEGRANTE_NO_ENCONTRADO` y `CONFLICTO_EDICION_CONCURRENTE`.
- Nada se borra (Regla N.° 1): la ficha y la cuenta quedan inactivas, el DNI y el email siguen reservados, las operaciones conservan su `usuarioId` y todas las bajas y reactivaciones quedan en el historial.
- El detalle (`obtenerDetalleIntegrante`) suma `historialEstados` (con el nombre de quien actuó, por `obtenerNombresPersonal`), `cajaAbierta` y `motivoObligatorioAlDesactivar`: indicadores de solo lectura, sin bloqueo, calculados solo con la ficha activa y con cuenta. El servidor repite la validación al desactivar.
- La pantalla usa `ConfirmarAccionDialog` reversible (`destructiva`, sin `irreversible`) con el motivo en `contenido`; con la caja abierta muestra un `Dialog` informativo en lugar de la confirmación. Los rechazos se ven dentro del modal y, al cerrarlo después de un rechazo, la ficha se refresca; el éxito, con toast y `router.refresh()`. Textos en `ui.personal.ficha.*`, `ui.personal.baja.*`, `ui.personal.reactivacion.*` y `ui.personal.historial.*`.

## Aplicación HU-G-01 — Gerentes

- Solo el Gerente gestiona a los gerentes (`gerentes:crear`, `gerentes:editar`, `gerentes:leer`; `gerentes:cambiar_estado` es de HU-G-05). Las rutas usan `withPermission`, las Server Actions `verificarPermiso` (antes de validar con Zod) y las páginas `exigirPermiso`. `/gerentes/:path*` está en el `matcher` del proxy y en `rutas-por-rol.ts` (`gerentes: ["GERENTE"]`), una regla distinta de la de `gerente` (el panel de indicadores): la comparación es por segmento completo.
- Mismo diseño que HU-F-01 sobre `FichaGerente`, con servicio propio (`src/server/gerentes/gerente.service.ts`) y sin extraer nada compartido con el personal: la duplicación es deliberada y queda como deuda. Se reutilizan tal cual `construirIdentidadPersonaSchema`, `crearCuentaParaFicha` (rol `GERENTE`), `cambiarEmailCuenta`, `verificarEmailNoAsociadoAOtraCuenta` y `obtenerResumenCuenta`.
- El alta corre en una sola `transaccion()`: DNI único entre todas las fichas de gerente (activas e inactivas, sin cruzar con otras tablas) → `crearCuentaParaFicha` → la ficha con `usuarioId`, `creadoPorUsuarioId` y `version = 0`. El `P2002` del DNI (`dniFichaGerente`) se captura fuera de la transacción. El servicio nunca ve, devuelve ni registra la contraseña inicial.
- Modificar exige `version` y escribe con `updateMany` condicionado (Regla N.° 7); sin cambios responde `campos_modificados: []` sin escribir. Orden: primero la ficha y después `cambiarEmailCuenta` (el mismo que usará HU-G-05). Una ficha inactiva se puede modificar y no se reactiva.
- Un gerente puede modificar su propia ficha, email incluido (DEC-44): `cambiarEmailCuenta` no revoca sesiones y la sesión se identifica por `id` y `rol`, así que sigue válida. `obtenerDetalleGerente(id, sesionUsuarioId)` devuelve `esVos` y la confirmación de la edición usa un aviso propio si cambia el email de la propia ficha.
- `listarGerentes(db?)` es el listado mínimo (todas las fichas, sin parámetros, `{ items, total }`); HU-G-03 le suma búsqueda, paginación y `esVos` por ítem de forma aditiva. El detalle no ofrece desactivar ni reactivar ni historial (HU-G-05).
- Errores con `ErrorDeDominio` y claves `errores.gerente.*` (`DNI_DUPLICADO`, `GERENTE_NO_ENCONTRADO`, `CONFLICTO_EDICION_CONCURRENTE`) y `errores.cuenta.emailYaAsociado`. El 400 es `VALIDATION_ERROR` con los errores por campo en `detalles`. No hay fachada `gerente.publico.ts`: el nombre de un gerente lo resuelve `obtenerNombresPersonal`.
- La pantalla confirma siempre el alta y la edición (HU-C-25); el éxito se informa en la ficha con el banner de `?creado=1` o `?actualizada=1`. Un rechazo mostrado dentro del diálogo refresca la página al cerrarlo. Textos en `ui.gerentes.*`.

## Aplicación HU-G-03 — Listado de gerentes

- `GET /api/gerentes` y `/gerentes` solo para el Gerente (`gerentes:leer`): `withPermission` en la ruta y `exigirPermiso` en la página. La ruta valida la query con `ListarGerentesQuerySchema` (`.strict()`): `pagina` entero positivo y `q` de hasta 100 caracteres; cualquier otro parámetro, incluido `por_pagina`, es `400 VALIDATION_ERROR` con `detalles` y el mensaje `errores.gerente.datosInvalidos`.
- `listarGerentes({ pagina, q }, sesionUsuarioId, db?)` es de solo lectura, con el mismo diseño que `listarPersonal`: orden por apellido y nombre normalizados y DNI, búsqueda con `construirFiltroBusquedaGerentes` (`src/server/gerentes/gerente.busqueda.ts`, criterio de HU-B-05 sobre las columnas de la ficha) y paginación fija de a `POR_PAGINA_GERENTES = 10`. `total` y `total_paginas` son del resultado filtrado; una página fuera de rango se lleva a la última y, sin resultados, `pagina` es 1 y `total_paginas` 0. Opera sobre activos e inactivos. Reutiliza `tokenizarBusqueda` de `src/lib/busqueda-texto.ts` y no importa nada de alumnos ni de personal.
- «(vos)» lo decide el servidor: cada ítem trae `esVos` (`usuarioId` de la ficha igual al de la sesión; una ficha sin cuenta nunca lo es). El servicio lee `usuarioId` para calcularlo, pero el ítem no lo devuelve. La ruta le pasa `req.auth!.user.id` y la página, el `id` que devuelve `exigirPermiso`.
- La pantalla copia la mecánica del listado del personal sin acoplarse: `ListadoGerentes` es un componente de cliente con `CampoBusqueda` (debounce, página 1 al cambiar el texto, respuestas viejas descartadas, `replaceState` de la URL) y `Pagination` con enlaces que conservan `q` (`parametrosListadoGerentes`, `src/lib/gerentes-listado.ts`). Filas inactivas atenuadas, toda la fila enlazada a la ficha y «(vos)» junto al apellido. Sin estado vacío sin búsqueda; con `q` y sin resultados, el texto propuesto y «Nuevo gerente». Los textos salen de `ui.gerentes.listado.*`.

## Aplicación HU-G-05 — Baja y reactivación de gerentes

- Solo el Gerente da de baja y reactiva a otro gerente (`gerentes:cambiar_estado`): `withPermission` en `POST /api/gerentes/[id]/desactivar` y `/reactivar`, `verificarPermiso` en las Server Actions `desactivarGerente` y `reactivarGerente` (antes de validar con Zod) y `tienePermiso` en la ficha. Los schemas `DesactivarGerenteSchema` y `ReactivarGerenteSchema` son `.strict()` y tienen la forma de los de HU-F-05 (motivo recortado, hasta 300 caracteres, vacío = no enviado; `version` obligatoria).
- Mismo patrón que HU-F-05 sobre `FichaGerente`, en `gerente.service.ts`, sin la regla de la caja y con dos reglas propias. **Nadie se desactiva a sí mismo:** antes de tomar ningún bloqueo, una lectura simple de la ficha compara su `usuarioId` con el del actor y responde `NO_PUEDE_DESACTIVARSE_A_SI_MISMO` (422) sin cambiar nada. La ficha no ofrece «Desactivar» en la propia (`esVos`), pero quien decide es el servidor.
- **Debe quedar al menos un gerente activo:** la baja lee los ids de todas las fichas de gerente activas y pide, en una sola llamada a `bloquear` (`fichasGerente`, por id ascendente), esas más la objetivo; después las relee bajo bloqueo y cuenta sobre la relectura, nunca sobre la lectura previa. Sin contar al objetivo, las fichas activas con cuenta pasan por `filtrarCuentasActivas` (módulo A); si no queda ninguna, `ULTIMO_GERENTE_ACTIVO` (409). Una ficha activa sin cuenta o con la cuenta inactiva entra en el bloqueo pero no cuenta. Dos bajas toman el mismo conjunto de bloqueos en el mismo orden y se serializan sin interbloqueos; está probado con PostgreSQL con dos bajas cruzadas y con una lectura vieja.
- Orden de la baja, en una única `transaccion()`: lectura simple → «no a sí mismo» → bloqueo de las activas más la objetivo → relectura (`GERENTE_NO_ENCONTRADO`, `GERENTE_YA_INACTIVO`, `CONFLICTO_EDICION_CONCURRENTE`) → último gerente activo → motivo (`MOTIVO_REQUERIDO` si la cuenta «registró operaciones», con el agregador `usuarioRegistroOperaciones` de HU-F-05 sin tocarlo; una ficha sin cuenta no lo consulta) → `updateMany` condicionado a activa y `version` (Regla N.° 7) → `desactivarCuenta` (que ya revoca las sesiones: no se llama además a `revocarSesiones`) → `registrarCambioEstado` con entidad `FICHA_GERENTE`, escrito después del commit (Regla N.° 2, opción b). `modificadoPorUsuarioId` (solo si actúa un usuario) y `version + 1` van en la misma fila.
- La reactivación bloquea solo la ficha, relee (`GERENTE_YA_ACTIVO`, versión), reactiva la cuenta con `reactivarCuenta` (no restaura las sesiones y conserva la marca de cambio de contraseña) y registra `REACTIVAR` sin motivo. No mira «al menos un gerente activo»: reactivar solo suma.
- Nada se borra (Regla N.° 1): la ficha y la cuenta quedan inactivas, el DNI y el email siguen reservados, las operaciones conservan su `usuarioId` y su nombre se sigue resolviendo con `obtenerNombresPersonal`, y todas las bajas y reactivaciones quedan en el historial.
- El detalle (`obtenerDetalleGerente(id, sesionUsuarioId, db?)`, sin cambiar la firma) suma `historialEstados` (camelCase, con el nombre de quien actuó por `obtenerNombresPersonal`), `motivoObligatorioAlDesactivar` (solo con la ficha activa y con cuenta) y `esUltimoGerenteActivo` (solo con la ficha activa; lectura sin bloqueo). Son informativos: la baja repite las dos validaciones.
- La pantalla usa `ConfirmarAccionDialog` reversible (`destructiva`, sin `irreversible`) con el motivo en `contenido`; si la ficha indica que es el último gerente activo, muestra un `Dialog` informativo en lugar de la confirmación. Los rechazos se ven dentro del modal y, al cerrarlo después de un rechazo, la ficha se refresca; el éxito, con toast y `router.refresh()`. Textos en `ui.gerentes.ficha.*`, `ui.gerentes.baja.*`, `ui.gerentes.reactivacion.*`, `ui.gerentes.historial.*` y los errores en `errores.gerente.*`.
