# TASK: HU-B-07 — Desactivar y reactivar alumno

**Módulo:** B (Alumno).
**Sprint:** 3.
**Contrato:** `docs/specs/spec_modulo_B.md` §§2.10–2.13 y 3.11–3.17.
**RBAC:** `alumnos:cambiar_estado`, exclusivo de Mesa de Entrada.
**Schema:** completo; sin migración.
**Estado:** commit e99a2a7 en feature/hu-restantes más las correcciones de auditoría (sección 7); pendiente revisión e integración.

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
- `alumno.estado.service.ts`: impacto, baja, reactivación e historial.
- `GET impacto-baja`, `POST desactivar` y `POST reactivar` con `withPermission("alumnos:cambiar_estado")`.
- Actions equivalentes con validación, permiso y revalidación.
- C expone baja masiva y existencia de clases pasadas (corte en la hora local del centro); I y E exponen existencia de registros.
- El autorregistro devuelve `CUENTA_YA_EXISTE` para una ficha inactiva, tenga o no cuenta: al iniciar y también al confirmar el código, donde la ficha se bloquea y se relee antes de crear y vincular la cuenta.

La baja usa el orden alumno → clases → inscripciones, revalida bajo bloqueo y registra el historial después del commit mediante el mecanismo compartido. La confirmación del autorregistro toma el mismo bloqueo de la ficha, así que una baja y una confirmación simultáneas se serializan.

## 4. Frontend

La ficha muestra la acción según el estado y el permiso. La confirmación de baja carga el impacto, lista clases futuras (fecha dd/mm/aaaa, singular y plural), explica que no se restauran y exige motivo cuando corresponde. La reactivación pide confirmación sin motivo y, al terminar, informa éxito junto con «Las inscripciones anteriores no se restauran…» (§2.11). Datos muestra el historial de estados junto a la cuenta.

## 5. Testing

### Unitario/API automatizado

- Schemas estrictos, trim y límites del motivo.
- Envelopes, permiso y actor de las tres rutas.
- Autorregistro: ficha inactiva al iniciar; ficha inactiva o ya vinculada al confirmar; vinculación condicionada sin filas.

### API / Postman

Colección en `docs/testing/Modulo B/hu-b-07/HU-B-07.postman_collection.json`, con assertions de status, envelope y código para éxito y cada error. Su presencia no acredita ejecución.

### PostgreSQL

`src/server/alumnos/alumno.estado.pg.test.ts` cubre los casos 3 a 7 de §3.17 y la matriz de `alumnos:cambiar_estado` del caso 6. Resultado en `docs/testing/Modulo B/hu-b-07/HU-B-07-evidencia.md`.

### UI manual

Pendiente de recorrido autenticado para impacto, doble envío, error dentro del modal, recarga e historial.

## 6. Definition of Done

- [x] Relevamiento confirmado.
- [x] Servicio, rutas, actions y schemas implementados.
- [x] Baja lógica sin `DELETE`, pagos intactos y cuenta integrada.
- [x] UI, textos, historial y DESIGN actualizados.
- [x] Corrección de autorregistro implementada, también en la confirmación del código.
- [x] PostgreSQL descartable aprobado (14/14).
- [ ] Postman ejecutado.
- [ ] Recorrido UI manual aprobado.
- [x] TypeScript, lint focal y suite Vitest completa aprobados (ver evidencia).
- [ ] Commit de las correcciones, revisión e integración.

## 7. Correcciones de auditoría

| Hallazgo | Corrección |
|---|---|
| P1-01 | `confirmarCodigoAutorregistro` corre en `transaccion`, bloquea la ficha, relee `activoAlumno`/`usuarioId` y vincula con `updateMany` condicionado; `verificar-codigo` responde `409 CUENTA_YA_EXISTE`. |
| P2-01 | `alumnoTieneRegistros` (C) compara contra la hora local del centro (`horaLocal`). |
| P2-02 | PG de §3.17, Postman con assertions, SQL y evidencia. |
| P3-04 | El aviso de no restauración se muestra al terminar la reactivación. |
| P3-06 | JSDoc de `crearAlumno` restituido a su función. |
| Observaciones | Singular «1 clase futura» y fecha dd/mm/aaaa en M-21. |
