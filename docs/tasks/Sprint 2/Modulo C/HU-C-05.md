# TASK: HU-C-05 — Cambiar estado del turno a cancelado

**Módulo:** C (Turnos) · **Sprint:** 2 · **SP:** 2 (Excel `docs/Historias de Usuario - Sprint 2.xlsx`, fila 75; `HU-Sprint-2.md` dice 1: discrepancia administrativa, sin efecto técnico)
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` Rev. 5 §2.10 (incluye N-1 y N-3), §2.4 (`acciones_habilitadas`), §3.1, §3.2, §3.8, §3.9, §3.13, §4 · `docs/RULES.md` Reglas 1, 2, 4, 5, 6, 7, 8, 10, 11 · `docs/DESIGN.md` §6.1, §6.3, §6.5 · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila Detalle de turno) y §4
**Referencia visual:** `docs/Noctium pantallas Sprint 2.pdf` pág. 5 (detalle, acciones) y pág. 8 (Modal Cancelar turno)
**RBAC:** `turnos:cancelar`, exclusivo de MESA_ENTRADA, ya existe (migración `20260928150100_sprint2_modelo` línea 89; `prisma/seed.ts:727`). No se crean permisos.
**Schema:** ya completo, sin migración (`EstadoTurno.CANCELADO`, `modificadoPorUsuarioId`, `updatedAtTurno`, trigger `turno_sincronizar_reservas`).
**Estado:** Implementación delegada por el SM a una sesión no supervisada; las fases SDD no se revisaron antes de implementar. Auditada y reconstruida el 30/09/2026; decisiones del SM registradas en esta task.

---

## Decisiones del SM (30/09/2026)

- **Estrategia (D1):** HU-C-05 se entrega en su propia rama, `feature/HU-C-05_cancelar-turno`, creada sobre `feature/HU-C-10_prioridad`. Son PR apilados: C-10 → C-05 → C-06.
- **T-PC (D2):** HU-C-10 queda exactamente como se revisó. `asignar-prioridad-dialog.tsx` y su test no cambian. El comportamiento «resultado incierto» ante un 5xx o un fallo de red se aplica solo en los diálogos de cancelar y reprogramar. `MENSAJE_RESULTADO_INCIERTO` vive en el módulo compartido `src/app/(dashboard)/turnos/[id]/turno-acciones-mensajes.ts`. Ningún archivo de C-10 importa nada de C-05.
- **Archivos no versionados (D6, D7):** no se versionan el Excel, el PDF, las fases SDD de la sesión no supervisada, `.claude/` ni `.mcp.json`.
- **N-3 en singular:** con un solo pago el aviso dice «Este turno tiene 1 pago registrado; no se reembolsan automáticamente». Anotado en spec C §2.10.
- **«Descartar» en el listado:** se muestra con el permiso `turnos:cancelar` y estado `PENDIENTE`. Es equivalente a `acciones_habilitadas.descartar`. Anotado en spec C §2.10.
- **Regla N.° 11:** los imports entre archivos de `src/server` de C-05 usan el alias `@/server/...`.

---

## 0. Relevamiento previo a implementación

Antes de escribir código se reporta lo siguiente y se espera **confirmación explícita**.

### 0.1. Base
- Rama `feature/HU-C-05_cancelar-turno`, creada sobre `feature/HU-C-10_prioridad` (`6dbcc73`, que ya integra `develop`).
- **I-01** (aprobada por los PO) no está en este HEAD. Si al momento de implementar ya se integró a la base, relevar sus cambios en `turno-detalle-encabezado.tsx` y `turno-detalle.tsx` antes de editarlos. **No reimplementarla ni esperar su commit para empezar.**

### 0.2. Archivos nuevos
1. `src/server/turnos/turno.cancelacion.service.ts`
2. `src/server/turnos/turno.cancelacion.test.ts`
3. `src/server/turnos/turno.cancelacion.pg.test.ts`
4. `src/app/api/turnos/[id]/cancelacion/route.ts`
5. `src/app/api/turnos/[id]/cancelacion/route.test.ts`
6. `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.tsx`
7. `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.test.tsx`
8. `src/app/(dashboard)/turnos/[id]/turno-acciones-mensajes.ts` (D2: `MENSAJE_RESULTADO_INCIERTO`, compartido con C-06)

### 0.3. Archivos existentes a modificar

| Archivo | Cambio |
|---|---|
| `src/app/(dashboard)/turnos/[id]/turno-detalle-encabezado.tsx` | Botón «Cancelar turno» si `acciones_habilitadas` incluye `cancelar`; «Descartar» si incluye `descartar`; orden de la pág. 5 |
| `src/app/(dashboard)/turnos/[id]/turno-detalle.tsx` | Estado del modal, render de `CancelarTurnoDialog`, `cargar(true)` |
| `src/app/(dashboard)/turnos/estado-turno-badge.tsx` | «Cancelado» con contorno según DESIGN §6.5 |
| `src/app/(dashboard)/turnos/turnos-listado.tsx`, `src/app/(dashboard)/turnos/page.tsx` | «Descartar» en filas `PENDIENTE` con `turnos:cancelar` (spec §2.4) |
| `turno-detalle.test.tsx`, `turnos-listado.test.tsx` | Nuevos casos, sin borrar los existentes |

### 0.4. Puntos ya resueltos (no relevar de nuevo)
- **DECISIÓN RESUELTA — `PENDIENTE`:** usa «Descartar», incluido el vencido (N-1, PO 29/09). No se ofrece «Cancelar turno».
- **DECISIÓN RESUELTA — reservas:** las libera el trigger al cambiar `estadoTurno`. **No** hay `DELETE` manual. `turno_alumno` y `pagos` se preservan.
- **DECISIÓN RESUELTA — aviso de pagos (N-3):** se muestra solo si el detalle trae la propiedad `pagos` (permiso `pagos:leer` existente; el Profesor nunca la recibe) con al menos un elemento. Sin consultas extra.
- **Decisión del SM (30/09/2026, D2):** ante un 5xx, el diálogo de cancelar cierra, recarga y avisa "resultado incierto", porque reintentar una cancelación ya aplicada devolvería 409 TURNO_CANCELADO. No se aplica a HU-C-10, que conserva su comportamiento revisado.

### 0.5. A relevar en el §0 (sin decidir por inferencia)
- Si `@/lib/turno-detalle` ya expone el día abreviado («Mar 06/10») para la descripción del modal. Si no, proponer un helper puro en ese mismo archivo. **Resuelto al implementar:** no existía; se agregó `diaAbreviadoYFecha()` (función pura, con test) en `src/lib/turno-detalle.ts`.

---

## 1. Nota de alcance

Esta HU convierte en operación real las acciones `cancelar` y `descartar` que HU-C-09 ya calcula.

**No depende de I-01:** el aviso N-3 lee `pagos` del detalle vía `listarPagosDeTurno()`, que ya existe. La integración de I-01 en el encabezado compartido es un paso de ensamblado posterior (§8).

**Fuera de alcance (explícito):**
- Cancelación de un turno propio por el alumno (HU-C-14, Sprint 3; AC6).
- Motivo de cancelación, notificaciones, reactivar un cancelado, reembolsos o anulación de pagos (Regla 8, spec I §3.6).
- Borrar `TurnoAlumno`, `Pago` o el `Turno` (Regla 1).
- Cambios de trigger, migraciones o seed.
- Reimplementar I-01. HU-J-03.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** cancelar un turno ya confirmado
**Para** liberar el aula, el profesor y a los alumnos inscriptos cuando la clase no va a dictarse.

**Criterios de aceptación (literal, Excel filas 75–80):**
1. Desde el detalle de un turno Disponible o Completo, la acción “Cancelar turno” solicita confirmación: “¿Confirmás cancelar este turno? Esta acción no se puede deshacer.”
2. Un turno Pendiente no tiene esta acción — se descarta simplemente sin guardar (ya cubierto por el flujo de configuración, HU-C-03).
3. Al confirmar, el turno pasa a estado Cancelado (nuevo valor del enum EstadoTurno), deja de reservar profesor/aula/alumnos (se eliminan sus filas de reservas_turno) y se informa “Turno cancelado correctamente”.
   – Un turno Cancelado no vuelve a ningún otro estado.
4. Un turno Cancelado deja de aparecer en los calendarios (HU-J-01/HU-J-02) y en las franjas ocupadas que consultan HU-C-07/HU-C-16, igual que ya sucede con Pendiente.
5. El listado (HU-C-01) y el detalle siguen mostrando el turno cancelado con su historial completo (no se borra), con la etiqueta “Cancelado”.
6. Esta historia no incluye la cancelación de un turno propio por el alumno (HU-C-14, Sprint 3).

**Lectura contractual del AC2 (spec C N-1, aprobada por el PO):** desde R5-1 el `PENDIENTE` ya está guardado. «Descartar» lo pasa a `CANCELADO` (única salida sin borrado físico), incluso si está vencido. La fila permanece visible como «Cancelado».

---

## 3. Alcance de esta task

Backend (servicio y ruta) y frontend (encabezado, `AlertDialog`, badge, «Descartar» en el listado) conforme a spec C §2.10. Incluye la tarea T-PC (resultado incierto tras un 5xx) solo en el diálogo de cancelación (D2). El de prioridad, de C-10, no cambia.

---

## 4. Contrato backend

### 4.1. Schema Zod
No hay body. La ruta no parsea cuerpo; el `id` de la URL no se valida como CUID (convención spec C, ids de seed).

### 4.2. Servicio
**Archivo:** `src/server/turnos/turno.cancelacion.service.ts` · **Función:** `cancelarTurno(id: string, usuarioId: string): Promise<{ id: string; estado: "CANCELADO" }>`

Dentro de una única `prisma.$transaction`:
1. `SELECT "idTurno","estadoTurno","fechaTurno","horaInicioTurno","profesorId","aulaId" FROM turnos WHERE "idTurno" = $1 FOR UPDATE`. Si no existe → `ServiceError("TURNO_NO_ENCONTRADO")`; si está `CANCELADO` → `ServiceError("TURNO_CANCELADO")`.
2. Si el estado es `DISPONIBLE` o `COMPLETO` y `!turnoSigueVigente(fecha, horaInicio)` → `ServiceError("TURNO_VENCIDO")`, antes de escribir nada. Para un `PENDIENTE` no aplica.
3. Leer los `alumnoId` de `turno_alumno` del turno (solo para el payload).
4. `tx.turno.updateMany({ where: { idTurno: id, estadoTurno: { in: ["PENDIENTE","DISPONIBLE","COMPLETO"] } }, data: { estadoTurno: "CANCELADO", modificadoPorUsuarioId: usuarioId } })`; si `count === 0` → `ServiceError("TURNO_MODIFICADO")`.
5. **Sin `DELETE` manual:** el trigger `turno_sincronizar_reservas` elimina las filas del turno en `reservas_turno` y no las reinserta porque el estado ya no está confirmado.
6. Commit.
7. **Después del COMMIT:** `emitirEventoTurno("turno:cancelado", id, usuarioId, { turno_id, estado_anterior, profesor_id, aula_id, alumno_ids, usuario_id })`. Un fallo se propaga (500); no se atrapa ni se simula rollback.

### 4.3. Route Handler
`POST /api/turnos/[id]/cancelacion` con `withPermission("turnos:cancelar", …)` y `const { id } = await ctx.params`.

| Resultado | HTTP | Cuerpo |
|---|---|---|
| Éxito | 200 | `{ data: { id, estado: "CANCELADO" }, error: null }` |
| Sin permiso | 403 | `SIN_PERMISO` (de `withPermission`) |
| `TURNO_NO_ENCONTRADO` | 404 | `{ data: null, error: { code, message } }` |
| `TURNO_CANCELADO`, `TURNO_VENCIDO`, `TURNO_MODIFICADO` | 409 | ídem |
| Error no tipado (incluido el evento posterior al COMMIT) | 500 | Manejo actual de Next; no se oculta |

### 4.4. Server Action
No se crea: el módulo C usa Route Handlers directos (spec C, Convenciones generales).

---

## 5. Frontend

**Pantalla:** Detalle de turno (`/turnos/[id]`), ver `mapa-pantallas-sprint-2.md` §1. **Modal:** `AlertDialog` y feedback por toast, ver mapa §4 y `DESIGN.md` §6.1/§6.3.

- **Encabezado** (pág. 5, orden Reprogramar · Asignar prioridad · Cancelar turno):
  - «Cancelar turno» con contorno y texto `--destructive` sobre `--card`, solo si `acciones_habilitadas` incluye `cancelar`.
  - «Descartar» con el mismo estilo si incluye `descartar`.
- **`CancelarTurnoDialog`**, sobre `@base-ui/react/alert-dialog` (patrón `confirmar-descarte-dialog.tsx`; no se cierra con click afuera):
  - **Modo cancelar (pág. 8 + AC1):**
    - Título «¿Confirmás cancelar este turno?».
    - Descripción «{Materia} · {Día} {dd/mm}, {hh:mm}–{hh:mm} · {Aula} · {N} alumnos inscriptos. Esta acción no se puede deshacer.».
    - Botones «Volver» y «Cancelar turno» (relleno `--destructive`).
  - **Aviso N-3:** solo si `turno.pagos` existe y tiene largo > 0. Una línea con ícono, fondo `--destructive-soft` y texto `--destructive-soft-foreground`: «Este turno tiene {N} pagos registrados; no se reembolsan automáticamente».
  - **Modo descartar:** título «¿Confirmás descartar este turno?», descripción «Esta acción no se puede deshacer.», botones «Volver» y «Descartar turno».
  - Mientras envía: botones deshabilitados; no se cierra con Escape ni por `onOpenChange`.
- **Resultados:**

| Respuesta | UI |
|---|---|
| 200 | Cierra; `toast.success("Turno cancelado correctamente")` o `toast.success("Turno descartado")`; `cargar(true)` |
| 404 / 409 | `toast.error(mensaje del servidor)`; `cargar(true)` |
| ≥ 500 o fallo de red (**T-PC**) | Cierra; `toast.error("No pudimos confirmar si el cambio se guardó. Revisá el detalle actualizado antes de reintentar.")`; `cargar(true)` |

- **`asignar-prioridad-dialog.tsx` (C-10) no se modifica (D2).** El mensaje del T-PC se importa de `turno-acciones-mensajes.ts`.
- **Badge «Cancelado»** (DESIGN §6.5): borde y texto `--destructive`, fondo `--card`, en el listado y el detalle.
- **Listado:** enlace «Descartar» en las filas `PENDIENTE` si `page.tsx` confirma `turnos:cancelar`. Abre el mismo modal en modo descartar y recarga la página actual (se conservan `q` y `pagina`).

---

## 6. Matriz CA → tarea → prueba → verificación

Estado actualizado el 30/09/2026 con los resultados de la sesión no supervisada (§10). Los identificadores `C05-T0x` vienen de sus fases SDD, que no se versionan (D6).

| CA | Tarea | Prueba | Verificación | Estado |
|---|---|---|---|---|
| AC1 | C05-T03, C05-T04 | DOM: botón solo con `cancelar`; texto literal; «Volver» sin `fetch` | Verificado visualmente contra el mockup, pág. 8; e2e «UI AC1 texto literal», «Volver cierra sin cambiar estado», «no se cierra con click afuera» | **Verificado** |
| AC2 | C05-T01, C05-T03, C05-T04, C05-T06 | Unit: `PENDIENTE` vigente y vencido → `CANCELADO`; DOM: «Descartar» sin «Cancelar turno»; HTTP 200 sobre un `PENDIENTE` | HTTP 200 `c05-e2e-pendiente-vencido`; UI `seed-turno-11` y listado, verificados visualmente (modo descartar y listado tras descartar); PG «descarta un PENDIENTE vencido» | **Verificado** (lectura N-1) |
| AC3 (estado, liberación, toast) | C05-T01, C05-T02, C05-T04, C05-T08 | Unit (`where`, `data`, `count 0`, evento post-commit, sin `DELETE`). PG: `reservas_turno` vacío y T2 superpuesto confirma. DOM: toast literal | HTTP 200 `seed-turno-04`; BD reservas 17→0, evento `turno:cancelado`; toast verificado visualmente; PG «el trigger libera…» | **Verificado** |
| AC3 (terminal) | C05-T01, C05-T08 | Unit/PG: segundo POST → 409 `TURNO_CANCELADO`; concurrencia: una sola transición y un solo evento | HTTP 409 (`seed-turno-04` repetido, `seed-turno-09`); PG concurrencia 1 ganador y 1 evento | **Verificado** |
| AC4 | — (sin cambios de código) | PG/HTTP: el turno no aparece en `GET /api/calendario/*` ni resta en `/api/turnos/profesores/[id]/disponibilidad` | HTTP: `seed-turno-04` presente → ausente en J-01 y J-02; 14:00 no ofrecido → ofrecido en §2.8.2 | **Verificado** |
| AC5 | C05-T05, C05-T08 | PG: `turno_alumno` y `pagos` intactos; DOM: badge con tokens §6.5 en listado y detalle | BD `seed-turno-02` (3 pagos, 6 alumnos) y `seed-turno-04` (15 alumnos) conservados; GET detalle con estado y alumnos; listado verificado visualmente; estilo calculado del badge | **Verificado** |
| AC6 | — | Revisión de rutas: no existe ninguna de alumno para cancelar | Única ruta nueva `POST /api/turnos/[id]/cancelacion` con `turnos:cancelar` (solo Mesa); Profesor/Gerente 403 | **Verificado** |
| N-3 | C05-T04 | DOM: aviso con `pagos` de 2 elementos; sin propiedad → sin aviso | Aviso «3 pagos registrados» verificado visualmente; tests DOM sin propiedad `pagos` | **Verificado** |
| T-PC | C05-T07 | DOM (cancelación): 500 y red → cierre, mensaje literal, recarga. PG: con fallo forzado del evento la fila queda cancelada sin evento | e2e con trigger temporal que hace fallar `eventos_turno`, verificado visualmente; PG «T-PC (premisa)» | **Verificado** |

---

## 7. Testing (3 niveles)

1. **Unit / componentes:** `turno.cancelacion.test.ts`, `route.test.ts`, `cancelar-turno-dialog.test.tsx` y las ampliaciones de `turno-detalle.test.tsx` y `turnos-listado.test.tsx`.
   Comandos: `npm ci` · `npx tsc --noEmit` · `npx eslint <archivos tocados>` · `npm test -- <archivos>` · `npm test`.
2. **HTTP autenticado:**
   - Mesa: 200 (`DISPONIBLE`, `COMPLETO`, `PENDIENTE` y `PENDIENTE` vencido), 404, 409 (`TURNO_CANCELADO`, `TURNO_VENCIDO`).
   - Gerente y Profesor: 403.
   - Se guardan código y rol, nunca credenciales.
3. **PostgreSQL** (`noctium_test` aislada, sin seed ni migraciones): `turnos` (estado y auditoría), `reservas_turno`, `turno_alumno`, `pagos` y `eventos_turno` antes y después; confirmación de un turno superpuesto.
4. **Navegador:** detalle y modal contra las págs. 5 y 8, modo descartar, aviso N-3 y badge.

Lo que no pueda ejecutarse se marca «Bloqueado» con motivo; nunca como aprobado.

---

## 8. Integración pendiente (ensamblado final)

- **I-01:** al integrar su commit aprobado, unir en `turno-detalle-encabezado.tsx` y `turno-detalle.tsx` su modal «Registrar pago» (ubicado en la tarjeta Pago, pág. 5) con los botones de C-05, C-06 y C-10, sin cambiar el aviso N-3. Re-ejecutar los tests de detalle.
- **C-06:** agrega «Reprogramar» al mismo encabezado después de C-05.

---

## 9. Definition of Done

- [x] Auditada y reconstruida el 30/09/2026 (ver «Decisiones del SM»).
- [x] Servicio, ruta y UI según §§4–5; sin lógica de negocio en la ruta.
- [x] Sin `DELETE` manual; `turno_alumno` y `pagos` preservados (PG y BD e2e).
- [x] Evento `turno:cancelado` después del COMMIT (unit) y registrado (PG y BD e2e).
- [x] T-PC aplicado a la cancelación (DOM, e2e con fallo real del evento); prioridad sin cambios (D2).
- [x] Badge «Cancelado» según DESIGN §6.5 (clases y estilo calculado).
- [x] Matriz §6 completa con su verificación.

---

## 10. Resultado de implementación y verificación — 30/09/2026

> Este apartado registra lo que verificó la sesión no supervisada sobre su commit original `21a115e`, en su propio entorno. La verificación sobre la rama reconstruida, en el entorno del equipo, figura en el informe de reconstrucción del SM.

**Base:** `fda3a3aedae8d6f3eac42c3c871529587c313a15`. **Entorno:** Node 22.22.2 (el contenedor no trae Node 24), dependencias con `npm ci`, cliente Prisma generado y `next typegen`. **Bases de datos:** clúster PostgreSQL 16 propio de la sesión (`/var/tmp/noctium-pg-c05`, puerto 55432, sin relación con la base compartida del equipo), con dos bases: `noctium_test` (migraciones, sin seed; suites PG) y `noctium_e2e` (migraciones + seed + un fixture `c05-e2e-pendiente-vencido`; reseteada antes de cada corrida HTTP/navegador).

### 10.1. Archivos

**Nuevos:**
- `src/server/turnos/turno.cancelacion.service.ts` — `cancelarTurno()`.
- `src/app/api/turnos/[id]/cancelacion/route.ts` — `POST`, `turnos:cancelar`.
- `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.tsx` — `AlertDialog` cancelar/descartar, aviso N-3, T-PC.
- `src/app/(dashboard)/turnos/[id]/turno-acciones-mensajes.ts` — `MENSAJE_RESULTADO_INCIERTO` (D2, agregado en la reconstrucción).
- Tests: `src/server/turnos/turno.cancelacion.test.ts` (11), `src/server/turnos/turno.cancelacion.pg.test.ts` (7), `src/app/api/turnos/[id]/cancelacion/route.test.ts` (10), `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.test.tsx` (12).

**Modificados:**
- `turno-detalle-encabezado.tsx` — botones «Cancelar turno» y «Descartar» (contorno destructivo) tras «Asignar prioridad»; «Reprogramar» (C-06) irá primero.
- `turno-detalle.tsx` — estado del modal y resumen del mockup pág. 8.
- `estado-turno-badge.tsx` — «Cancelado» con `border-destructive bg-card text-destructive` (DESIGN §6.5).
- `turnos-listado.tsx`, `turnos/page.tsx` — «Descartar» en filas `PENDIENTE` con `turnos:cancelar`; recarga misma página y búsqueda.
- `src/lib/turno-detalle.ts` — `diaAbreviadoYFecha()`.
- Tests ampliados: `turno-detalle.test.tsx` (+4 casos y el de acciones actualizado), `turnos-listado.test.tsx` (+3), `src/lib/turno-detalle.test.ts` (+1).

Sin cambios en `prisma/schema.prisma`, migraciones, seed, trigger, `turno.acciones.ts`, I-01, E ni J-03.

### 10.2. Resultados

| Verificación | Resultado real |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npx eslint` (repositorio completo) | 0 errores |
| `npx next build` | Correcto; incluye `ƒ /api/turnos/[id]/cancelacion` |
| Suite completa `npx vitest run` (×3) | 1065 passed, 49 skipped (suites PG sin variables), 3 todo — idéntico en las tres corridas. Línea base antes de C-05: 1022 passed, 42 skipped |
| Suites C-05 enfocadas (servicio, PG, ruta, pantallas de turnos, helper) (×3) | 178 passed en cada corrida |
| Todas las suites PG sobre `noctium_test` (×3) | 48 passed, **1 failed preexistente**: `turno.reservas.pg.test.ts` «asignar profesor y alumnos…» espera `ALUMNO_NO_DISPONIBLE` y el servicio devuelve `ALUMNO_INACTIVO`. Falla igual en la base sin cambios de C-05; ajena a esta HU (HU-C-04/C-15), no se modificó |
| Suite PG C-05 (7 casos) | 7 passed: liberación real por trigger + turno superpuesto confirma después; inscripciones y pagos conservados; terminal; `PENDIENTE` vencido; `DISPONIBLE` vencido intacto; concurrencia (1 ganador, 1 evento); premisa T-PC |
| HTTP autenticado + navegador (`next start`, ×3 + corrida final) | 34/34 en las tres corridas; corrida final 35/35 (agrega el estilo calculado del badge) |

**Casos HTTP (roles reales del seed):** Mesa 200 COMPLETO vigente y `PENDIENTE` vencido; 409 `TURNO_CANCELADO` (repetido y cancelado del seed); 409 `TURNO_VENCIDO`; 404; Gerente 403; Profesor 403; sin sesión 401. Sin eventos en los rechazos.

**Navegador vs mockups:**
- Detalle de un turno disponible, verificado visualmente contra el mockup, pág. 5: acciones arriba a la derecha.
- Diálogo de cancelación con pagos, verificado visualmente contra el mockup, pág. 8: título, resumen «Programación I · Jue 01/10, 10:00–12:00 · Aula 2 · 6 alumnos inscriptos. Esta acción no se puede deshacer.», Volver / Cancelar turno. Agrega el aviso N-3 aprobado después del mockup.
- Después de cancelar: toast literal y detalle en «Cancelado» sin acciones.
- Diálogo en modo descartar (sin mockup; textos de la spec N-1).
- Listado: etiqueta «Cancelado» con contorno y «Descartar» en `PENDIENTE`.
- Resultado incierto (T-PC): fallo real del evento forzado con un trigger temporal en la base aislada; el turno queda cancelado sin evento, y la UI cierra, avisa el resultado incierto y recarga.

**Diferencias con el mockup, justificadas:** falta «Reprogramar» (C-06, no autorizada todavía) y «Registrar pago» (I-01, fuera de este HEAD). El aviso N-3 no figura en la pág. 8 porque se aprobó después. El descarte no tiene mockup.

### 10.3. Cierre de la entrega (30/09/2026)

**Commit original:** `21a115e07489a67b88575968a35fb14ce17656f0`, de la sesión no supervisada, publicado sobre `feature/HU-C-10_prioridad`. El 30/09/2026 el SM lo retiró de esa rama y lo reconstruyó en `feature/HU-C-05_cancelar-turno` con las correcciones de «Decisiones del SM». Sin cambios en schema, migraciones, seed, I-01, E ni J-03.

#### a) Verificaciones aprobadas
- Node 22.22.2: `tsc`, ESLint del repositorio, `next build`, suite completa (1065 passed ×3), suites C-05 enfocadas (178 ×3), suite PG de C-05 (7/7), HTTP + navegador (34/34 ×3 y 35/35 final).
- **Node 24.21.0** (obtenido con `npx node@24`, el contenedor trae Node 22) sobre `21a115e`: `tsc` 0 errores, ESLint 0 errores, suite completa 1065 passed / 49 skipped / 3 todo, suites PG 48 passed + la falla preexistente de b), `next build` correcto con `/api/turnos/[id]/cancelacion`.
- **Formato de fecha** `diaAbreviadoYFecha()` (`src/lib/turno-detalle.ts`): cambio aditivo; `fechaCorta`, `diaMes`, `fechaLarga` y el resto no cambian. Un único consumidor (`turno-detalle.tsx`, resumen del `AlertDialog`). Produce «Mar 06/10» para `2026-10-06`, como el mockup pág. 8. Calcula sobre la fecha de calendario en UTC: los tests del helper y de sus consumidores (53) pasan igual con `TZ` = America/Argentina/Buenos_Aires, Pacific/Kiritimati (UTC+14), Pacific/Pago_Pago (UTC−11) y UTC.

#### b) Test PostgreSQL preexistente que falla (ajeno a C-05)
`src/server/turnos/turno.reservas.pg.test.ts` › «asignar profesor y alumnos confirma Disponible o Completo, reserva y revalida todos los alumnos»: espera `ALUMNO_NO_DISPONIBLE` y `asignarParticipantesTurno()` devuelve `ALUMNO_INACTIVO`. Se ejecutó sobre worktrees limpios de `fda3a3a` y `c794405` (sin código de C-05) y falla igual; también en `21a115e`. C-05 no toca ese servicio ni ese test; corresponde a su dueño (HU-C-04/C-15).

#### c) Validación con Node 24
**Ejecutada**, ver a). Ya no queda pendiente.

### 10.4. Pendientes
- Integración con el commit aprobado de I-01 en el encabezado compartido (§8).
- Falla preexistente de b), para su dueño.
- `CAMBIO_GUARDADO_SIN_TRAZA`: propuesta de la sesión no supervisada, ligada al 500 posterior al commit en la emisión de eventos (D-5); a evaluar por el SM en un ticket aparte.

---

## 11. Ajuste visual del listado tras integrar `develop` — 30/09/2026

**Relevamiento autorizado:** rama `feature/HU-C-05_cancelar-turno`, HEAD `bfa90cf`, árbol limpio al inicio. En `turnos-listado.tsx`, la celda Acciones aplicaba `whitespace-nowrap` a «Ver detalle», «Continuar configuración» y «Descartar» como una sola línea. Su ancho comprimía otras columnas a 1440 px y partía la fecha. El mockup del listado (`Noctium pantallas Sprint 2.pdf`, pág. 3) presenta fecha y horario en una línea; es anterior a la acción «Descartar» aprobada en spec C §2.10, por lo que no define la disposición de tres acciones. La spec C §2.4 exige conservar las tres según estado y permisos. No requiere cambios de contrato ni de backend.

**Ajuste aplicado:** fecha y horario con `whitespace-nowrap`; dentro de Acciones, un contenedor `flex flex-wrap` con separaciones horizontal y vertical, manteniendo cada texto completo. Se conservan el orden «Ver detalle» → «Continuar configuración» → «Descartar», los `href`, el botón, las condiciones de permiso/estado, `min-w-190` y `overflow-x-auto` de la tabla. No se ocultan columnas ni se agrega menú.

**Verificación:** ruta temporal de navegador que montó el componente real `TurnosListado`, con respuesta de `GET /api/turnos` sustituida en memoria por tres registros de prueba `PENDIENTE`, `DISPONIBLE` y `CANCELADO`. No se escribieron datos de prueba en PostgreSQL; la ruta temporal se retiró después de las capturas. Chrome headless a 1440 × 900 muestra fecha y hora completas y las tres acciones del pendiente distribuidas en dos líneas. A 1024 × 900, fecha y hora siguen completas; el extremo derecho se alcanza mediante el scroll horizontal de la tabla y muestra las tres acciones, además de «Ver detalle» para Disponible y Cancelado. La captura del extremo derecho se tomó con un estilo **solo del fixture** que posicionó el scroll al final; ese estilo no existe en producción.

**Evidencia:** [1440 px](evidencia-HU-C-05/listado-1440.png), [1024 px, inicio de tabla](evidencia-HU-C-05/listado-1024.png), [1024 px, extremo derecho](evidencia-HU-C-05/listado-1024-acciones.png). `npx eslint 'src/app/(dashboard)/turnos/turnos-listado.tsx'`: sin errores. `npx tsc --noEmit`: sin errores. `npm test -- 'src/app/(dashboard)/turnos/turnos-listado.test.tsx'`: 18/18 casos aprobados. No se modificaron tests porque el cambio es únicamente de distribución visual; las pruebas existentes cubren presencia, permisos y comportamiento de las acciones.

**Texto para reemplazar el pendiente visual del PR:** «Corregida y verificada la compresión del listado de turnos tras sumar “Descartar”. A 1440 px, fecha y horario permanecen en una línea y las acciones de un Pendiente se distribuyen dentro de su celda. A 1024 px, la tabla conserva el scroll horizontal y permite acceder a todas las acciones. Verificado en Chrome con datos aislados para Pendiente, Disponible y Cancelado; capturas en `docs/tasks/Sprint 2/evidencia-HU-C-05/`. ESLint, TypeScript y los 18 tests del listado pasan.»
