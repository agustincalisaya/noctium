# TASK: HU-B-07 — Desactivar y reactivar alumno

**Módulo:** B (Alumno)  
**Sprint:** 3  
**Contrato:** `docs/specs/spec_modulo_B.md` §§2.10–2.13 y 3.11–3.17  
**RBAC:** `alumnos:cambiar_estado`, exclusivo de Mesa de Entrada  
**Schema:** completo; sin migración

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
- C expone baja masiva y existencia de clases pasadas; I y E exponen existencia de registros.
- El autorregistro devuelve `CUENTA_YA_EXISTE` para una ficha inactiva, tenga o no cuenta.

La baja usa el orden alumno → clases → inscripciones, revalida bajo bloqueo y registra el historial después del commit mediante el mecanismo compartido.

## 4. Frontend

La ficha muestra la acción según el estado y el permiso. La confirmación de baja carga el impacto, lista clases futuras, explica que no se restauran y exige motivo cuando corresponde. Baja y reactivación informan éxito mediante toast. Datos muestra el historial de estados junto a la cuenta.

## 5. Testing

### Unitario/API automatizado

- Schemas estrictos, trim y límites del motivo.
- Envelopes, permiso y actor de las tres rutas.
- Autorregistro de ficha inactiva sin cuenta.

### PostgreSQL

`npm run test:pg` aprobó 314 pruebas en la base descartable principal y las suites aisladas ejecutadas. El comando terminó con código 1 porque detectó la base persistente `noctium_test` y, por seguridad, no ejecutó tres suites heredadas que la referencian. Quedan pendientes casos PG específicos de B-07 para rollback y ambas intercalaciones concurrentes.

### UI manual

Pendiente de recorrido autenticado para impacto, doble envío, error dentro del modal, recarga e historial.

## 6. Definition of Done

- [x] Relevamiento confirmado.
- [x] Servicio, rutas, actions y schemas implementados.
- [x] Baja lógica sin `DELETE`, pagos intactos y cuenta integrada.
- [x] UI, textos, historial y DESIGN actualizados.
- [x] Corrección de autorregistro implementada.
- [ ] PostgreSQL descartable aprobado.
- [ ] Recorrido UI manual aprobado.
- [x] Build, TypeScript, lint focal y suite Vitest completa aprobados.
