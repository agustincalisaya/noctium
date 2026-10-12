# TASK: HU-B-07 — Desactivar y reactivar alumno

**Módulo:** B (Alumno).
**Sprint:** 3.
**Contrato:** `docs/specs/spec_modulo_B.md` §§2.10–2.13 y 3.11–3.17.
**RBAC:** `alumnos:cambiar_estado`, exclusivo de Mesa de Entrada.
**Schema:** completo; sin migración.
**Estado:** implementada y verificada localmente en `feature/hu-restantes`; recorrido de navegador, CI sobre el SHA del PR e integración pendientes (ver evidencia). SHA del PR: ⏳ se completa al abrirlo.

## 0. Relevamiento previo

El relevamiento confirmado por el usuario identificó el servicio de estado, schemas, rutas, actions, UI, historial y extensiones públicas de C/I/E. No se detectaron decisiones funcionales abiertas ni migraciones necesarias.

## 1. Alcance

La baja lógica libera inscripciones vigentes de clases futuras, conserva pagos e historial académico, desactiva la cuenta y revoca sesiones. La reactivación habilita ficha y cuenta sin restaurar inscripciones ni sesiones.

**Fuera de alcance:** reintegros, creación retroactiva de cuentas y restauración de inscripciones.

## 2. Historia de Usuario

**Como** integrante de Mesa de Entrada
**Necesito** desactivar o reactivar un alumno
**Para** mantener su disponibilidad, acceso e inscripciones consistentes.

**SP:** 5

## 3. Backend

- `DesactivarAlumnoSchema`: `version` obligatoria y motivo opcional normalizado, máximo 300.
- `ReactivarAlumnoSchema`: solo `version`.
- `alumno.estado.service.ts`: impacto (con `listarInscripcionesDeAlumno(id, { desde })`, la misma regla que la baja), baja, reactivación e historial. `obtenerHistorialEstadosAlumno` arma `historial_estados` (más reciente primero) y la usan `GET /api/alumnos/[id]` y la ficha.
- `GET impacto-baja`, `POST desactivar` y `POST reactivar` con `withPermission("alumnos:cambiar_estado")`.
- Actions equivalentes: permiso verificado antes de validar el payload, validación y revalidación.
- C expone baja masiva y existencia de clases pasadas (corte en la hora local del centro); I y E exponen existencia de registros.
- El autorregistro devuelve `CUENTA_YA_EXISTE` (mismo código, mensaje y cuerpo que la rama de cuenta existente) para una ficha inactiva, tenga o no cuenta, por su DNI o por su email de contacto: al iniciar; de nuevo dentro de la transacción de la alta directa, con `SELECT … FOR SHARE` sobre las fichas con ese email, que serializa contra una baja concurrente; y al confirmar el código, donde la ficha se bloquea y se relee antes de crear y vincular la cuenta. `verificar-codigo` responde 409 también ante `TRANSACCION_OCUPADA`.

La baja usa el orden alumno → clases → inscripciones. Solo lee, filtra y bloquea las inscripciones de clases futuras (las pasadas o en curso no se bloquean ni se tocan); marca vencidas únicamente las reservas de las clases bloqueadas, revalida bajo bloqueo y registra el historial después del commit mediante el mecanismo compartido. La confirmación del autorregistro toma el mismo bloqueo de la ficha, así que una baja y una confirmación simultáneas se serializan.

## 4. Frontend

La ficha muestra la acción según el estado y el permiso. La confirmación de baja carga el impacto, lista clases futuras (fecha dd/mm/aaaa, singular y plural), explica que no se restauran y exige motivo cuando corresponde. La reactivación pide confirmación sin motivo y, al terminar, informa éxito junto con «Las inscripciones anteriores no se restauran…» (§2.11). Datos muestra el historial de estados junto a la cuenta.

## 5. Testing

### Unitario/API automatizado

- Schemas estrictos, trim y límites del motivo.
- Envelopes, permiso y actor de las tres rutas; impacto con `desde` (fecha del centro y tres condiciones); `GET /api/alumnos/[id]` con `historial_estados`; `verificar-codigo` (200, 400, 404, 409 `CUENTA_YA_EXISTE` y `TRANSACCION_OCUPADA`, 422).
- Server Action con permiso verificado antes de validar, con `verificarPermiso` real y roles distintos.
- Autorregistro: ficha inactiva por DNI y por email al iniciar; relectura dentro de la transacción de la alta directa y de la confirmación; vinculación condicionada sin filas.
- Componentes: diálogo M-21 (singular y plural, lista, motivo obligatorio y tope de 300, rechazo dentro del diálogo, doble envío con dos clics en su propio `act`, aviso de no restauración, reactivación) e historial de estados.

### API / Postman

Colección en `docs/testing/Modulo B/hu-b-07/HU-B-07.postman_collection.json`: 29 solicitudes con assertions de status, envelope y código para éxito y cada error, más la ficha con `historial_estados` y su permiso. Ejecutada contra la aplicación con una base descartable (ver evidencia).

### PostgreSQL

`src/server/alumnos/alumno.estado.pg.test.ts` cubre los casos 3 a 7 de §3.17, el historial después del commit (fallo antes y después del commit), el filtro de clases futuras, el autorregistro con ficha inactiva y la concurrencia con intercalado forzado en dos conexiones. `src/server/alumnos/alumno.estado.permisos.pg.test.ts` ejecuta las rutas con `withPermission` real para los cuatro roles y compara la matriz de `rol_permiso` antes y después del seed completo. `HU-B-07.sql` asierta el estado de la base después de la baja y de la reactivación. Resultados en `docs/testing/Modulo B/hu-b-07/HU-B-07-evidencia.md`.

### UI manual

⏳ Pendiente de recorrido autenticado para impacto, doble envío, error dentro del modal, recarga e historial.

## 6. Definition of Done

- [x] Relevamiento confirmado.
- [x] Servicio, rutas, actions y schemas implementados.
- [x] Baja lógica sin `DELETE`, pagos intactos y cuenta integrada.
- [x] UI, textos, historial y DESIGN actualizados.
- [x] Autorregistro con ficha inactiva por DNI y por email de contacto, también al confirmar el código.
- [x] PostgreSQL descartable aprobado (`alumno.estado.pg` 38/38 y `alumno.estado.permisos.pg` 2/2).
- [x] Postman ejecutado (29 solicitudes, 104 aserciones) y SQL con aserciones ejecutado.
- [ ] ⏳ Recorrido UI manual aprobado.
- [x] TypeScript, lint, suite Vitest completa y build aprobados (ver evidencia).
- [ ] ⏳ CI sobre el SHA del PR, revisión e integración.

## 7. Decisiones y ajustes de cierre

| Tema | Decisión |
|---|---|
| Autorregistro con ficha inactiva | Rige el criterio 5 del Excel: el DNI y el email de contacto de una ficha inactiva siguen contando para la unicidad, tenga o no cuenta; no se crea ni se vincula ninguna. La spec B §3.14 se alinea con una nota de sincronización. |
| Confirmación del código | `confirmarCodigoAutorregistro` corre en `transaccion`, bloquea la ficha, relee `activoAlumno` y `usuarioId` y vincula con `updateMany` condicionado; `verificar-codigo` responde `409 CUENTA_YA_EXISTE` y `409 TRANSACCION_OCUPADA`. |
| Serialización contra la baja | La alta directa relee las fichas con el mismo email con `SELECT … FOR SHARE` dentro de su transacción. `bloquear()` no bloquea por email y la baja no toma un bloqueo asesor. |
| Registros del alumno | `alumnoTieneRegistros` (C) compara contra la hora local del centro. |
| Clases pasadas | La baja filtra por inicio posterior al momento actual antes de bloquear y de marcar reservas vencidas; la regla de C-24 se mantiene para las clases que toca. |
| Impacto | `listarInscripcionesDeAlumno(id, { desde })` con las tres condiciones; la paridad impacto y baja está probada con clases pasadas y en curso. |
| Alumno inactivo desde mesa de entrada | Se conserva `ALUMNO_NO_DISPONIBLE` (contrato previo de C-04); el autoservicio, C-18 y «Registrar pago» usan `ALUMNO_INACTIVO`. Queda registrado en la nota de sincronización de la spec B. |
| `historial_estados` en la API | Lo arma el servicio y la ruta y la página usan la misma función. |
| Aviso de no restauración | Se informa en la confirmación de la baja y al terminar la reactivación (§2.11). |
| Textos | Singular «1 clase futura», fecha dd/mm/aaaa y «Sin profesor» desde el catálogo de textos. |
