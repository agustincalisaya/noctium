# TASK: HU-C-03 — Configurar turno (agregar cupo máximo)

**Módulo:** C (Turno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` (Revisión 2) sección 2.1 · reglas 3.1, 3.2, 3.7 · eventos sección 4 · changelog al inicio del documento
**RBAC:** `turnos:crear` ya existe y no se toca en esta task (la HU no agrega una acción nueva, solo un campo al payload existente) — **relevar antes de asumir:** confirmar contra `spec_modulo_A.md` / seed de `RolPermiso` que `turnos:crear` sigue siendo exclusivo de Mesa de Entrada, sin cambios de matriz.
**Schema:** requiere migración — agregar `cupoMaximoTurno Int` (NOT NULL) al modelo `Turno`, y reemplazar el enum `EstadoTurno` (`PENDIENTE | AGENDADO` → `PENDIENTE | DISPONIBLE | COMPLETO`). Ver Nota de alcance §1 sobre por qué esta task incluye el cambio de enum aunque HU-C-03 en sí solo pide el cupo.

**Estado: CERRADA e implementada tal como está documentada abajo — REABIERTA (24/09/2026) por el rediseño de cupo automático de la Revisión 3 de `spec_modulo_C.md` — REDISEÑO IMPLEMENTADO Y VERIFICADO (24-25/09/2026), ver §9.**

> **Nota de reapertura (Revisión 3, 24/09/2026, histórica):** por pedido explícito del cliente, aprobado por el PO (ver `propuesta-cambio-cupo-aula.md`), el campo `cupo_maximo` se **elimina** del formulario y del contrato de esta HU — el cupo pasa a fijarse automáticamente al asignar aula (HU-C-15). Todo lo documentado en las secciones 0-8 de este archivo describe la implementación tal como se cerró y verificó originalmente (Revisión 2); sigue siendo válido como historial, pero el contrato vigente para esta HU es el de `spec_modulo_C.md` §2.1 (Revisión 3). **Esta reapertura ya está resuelta e implementada — ver §9 para la evidencia final**, que reemplaza el estado "no se toca todavía" con el que se escribió originalmente esta nota.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Los puntos marcados abajo como **"relevar antes de asumir"**.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

**Relevar antes de asumir — puntos concretos para esta task:**

1. **¿Se migra el enum `EstadoTurno` en esta task o en HU-C-15?** — **RESUELTO:** se migra en esta task, junto con el cupo (ver §8 para el detalle de lo que arrastró fuera de `src/server/turnos/`: calendario y seed).
2. **Confirmar si hay datos en la base de desarrollo que no se puedan perder.** — **RESUELTO:** no había nada cargado a mano; se aplicó `prisma migrate reset --force` con consentimiento explícito del Scrum Master.
3. **Nombre del campo Zod → columna:** `cupo_maximo` (input) → `cupoMaximoTurno` (columna) — **RESUELTO**, confirmado.

---

## 1. Nota de alcance

`spec_modulo_C.md` (Revisión 2) documenta el Módulo C completo con las 4 HU ya contractualizadas (C-03, C-04, C-15, C-01), pero se implementan en tasks separadas, en ese orden. Esta task cubre **exclusivamente** HU-C-03 (spec §2.1): el campo `cupo_maximo` en el alta/modificación de la configuración del turno. No implementa:

- **Carga de profesor y alumnos** (§2.2) — HU-C-04, próxima task.
- **Asignación de aula y la transición de estados en sí** (§2.3) — HU-C-15. Esta task deja el turno configurado y en `PENDIENTE`; nunca produce ni valida una transición a `DISPONIBLE`/`COMPLETO`.
- **Alta/baja individual de alumnos** (§2.5) — depende de que el turno ya esté `DISPONIBLE`/`COMPLETO`, imposible de alcanzar solo con esta task.
- **Cambios al listado** (§2.4, HU-C-01) — el campo `alumnos_inscriptos` sigue siendo responsabilidad de esa task; la etiqueta de texto del estado se adelantó acá (ver §8, "agregado fuera de lo acordado") porque dejarla en "Agendado" era incorrecto después del cambio de enum.

**Fuera de alcance de esta task (explícito):**
- Migrar la lógica de transición de estados (eso no existe todavía en ningún endpoint hasta HU-C-15) — esta task solo agrega el *valor* del enum al schema, no ningún flujo que lo asigne.
- Tocar `asignarParticipantesTurno()` más allá de lo estrictamente necesario para compilar con el enum nuevo (código de error y filtro de estado) — la firma con `alumno_ids[]` la reescribe HU-C-04.

---

## 2. Historia de Usuario

**Como** personal de mesa de entradas
**Necesito** configurar la fecha, hora, materia y cupo máximo de un turno
**Para** iniciar una reserva antes de asignar sus participantes y aula

**SP estimado:** 5

---

## 3. Alcance de esta task

Implementación backend + frontend conforme a `spec_modulo_C.md` §2.1 (Revisión 2). Incluyó:
- Migración de Prisma: `cupoMaximoTurno Int` en `Turno`, reemplazo del enum `EstadoTurno`.
- `ConfigurarTurnoSchema` (`src/server/turnos/turno.schema.ts`) con `cupo_maximo` (tope agregado, ver §8).
- `configurarTurno()` y `modificarConfiguracionTurno()` (`src/server/turnos/turno.service.ts`): persistencia/validación de `cupoMaximoTurno`, `CUPO_MENOR_A_INSCRIPTOS`.
- Renombre `TURNO_YA_AGENDADO` → `TURNO_YA_DISPONIBLE` en los 4 lugares donde aparecía (incluida la línea de `asignarParticipantesTurno` necesaria para compilar).
- Payload de `turno:configurado` con `cupo_maximo`.
- UI: campo "Cupo máximo" en `turno-configuracion.tsx`, con `DirtyStateContext`.
- Calendario, tipos y seed actualizados para compilar con el enum nuevo (confirmado en el relevamiento, ver decisión resuelta §0.1).

**Fuera de alcance de esta task** (no implementado): endpoints de `asignarParticipantesTurno` (más allá del ajuste de compilación), `asignarAulaTurno`, ni las rutas de alta/baja individual de alumno (§2.5).

---

## 4–6. Contrato Backend / Frontend / Testing

Sin cambios respecto al diseño original de la task (ver historial de versión anterior de este documento) — implementado tal cual estaba especificado. El detalle de lo efectivamente hecho y verificado está en §8.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar, incluidos los 3 puntos "relevar antes de asumir".
- [x] Migración aplicada: `cupoMaximoTurno` en `Turno`, enum `EstadoTurno` con los 3 valores nuevos, sin `AGENDADO` remanente en el schema. Verificado contra la base real (no solo el schema).
- [x] Service y Route Handler actualizados, sin lógica de negocio fuera de `turno.service.ts`. **Server Action: no aplica — `src/server/turnos/actions.ts` no existe en el proyecto (divergencia ya documentada en `spec_modulo_C.md`), el frontend llama al Route Handler directo.**
- [x] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos — verificado con curl.
- [x] `turno:configurado` emitido tras el `INSERT`, con `cupo_maximo` en el payload — verificado en `eventos_turno`.
- [x] Frontend: campo "Cupo máximo" funcional, con su estado de error siguiendo `docs/DESIGN.md` — **verificado en navegador por el Scrum Master el 24/09** (ver §8 para el detalle de los 5 puntos de verificación manual, todos confirmados).
- [x] Ningún `DELETE` físico en ningún punto del código.
- [x] Tests de los 3 niveles documentados con evidencia — Nivel 1 (unitarios, `turno.configuracion.test.ts`, 11 tests) y Nivel 3 (BD, enum y columnas verificadas) con evidencia; Nivel 2 se cubrió con curl en vez de Postman (equivalente, mismo contrato verificado), y con verificación manual en navegador para la superficie visual.
- [ ] PR con diff acotado exclusivamente a esta HU — **el diff incluye archivos fuera de Turno** (`calendario.service.ts` + test, `calendario.types.ts`, `evento-calendario.tsx`, `prisma/seed.ts`) como consecuencia directa y ya confirmada de migrar el enum compartido en esta task (ver §0.1) — no es scope creep, pero el PR debe explicar esa razón en su descripción para quien lo revise sin este contexto. **Pendiente: el commit lo hace el Scrum Master manualmente, no Claude Code.**

---

## 8. Evidencia de implementación (24/09/2026)

**Verificado por Claude Code (curl + revisión de código + tests automatizados), backend:**
- Los 4 puntos del checklist original de comandos pasan: `tsc --noEmit` (0 errores), `eslint src` (0 errores, 1 warning preexistente ajeno a esta HU), `build` con y sin `.env` (ambos OK), `vitest` turnos+calendario (33/33).
- Alta con `cupo_maximo` válido → `201`, `estado: "PENDIENTE"`, columnas y evento verificados en base.
- `cupo_maximo` ausente, `0`, `-1`, `2.5` → `400` con mensaje en el campo.
- `CUPO_MENOR_A_INSCRIPTOS`: cupo 1 con 2 inscriptos → `409`; cupo 2 con 2 inscriptos → `200`.
- Turno ya `DISPONIBLE`/`COMPLETO` → `409 TURNO_YA_DISPONIBLE` (código renombrado, no el viejo).
- Turno pendiente no aparece en el calendario (curl + test del filtro).

**Verificado en navegador por el Scrum Master (24/09/2026) — los 5 puntos que quedaban pendientes, todos confirmados:**
1. **Error inline del campo "Cupo máximo"** (`/turnos/nuevo`): probado con `0`, `0.5`, `-1` y vacío — mismo mensaje ("El cupo máximo debe ser un número entero mayor que cero"), en rojo, pegado al campo, sin perder los demás valores del formulario (Fecha, Hora, Materia se conservan entre intentos). Estado vacío no muestra error prematuro. Valor válido (`30`) habilita el botón con foco en `--ring`/`--brand-accent`, coherente con `DESIGN.md`.
2. **Mensaje de éxito:** confirmado en el flujo de modificación ("Configuración actualizada", banner verde con tokens `--success`/`--success-foreground`, links "Volver al listado"/"Ver detalle"). El de alta ("Turno configurado") ya estaba verificado por curl con el texto exacto.
3. **Precarga en `/turnos/[id]/configuracion`:** confirmado sobre el turno de prueba `cmuf2ihu10002uwgw56cod8cn` — el campo "Cupo máximo" cargó el valor persistido (`2`) junto con Fecha/Hora/Materia.
4. **Badge Disponible/Completo en el calendario** (`Calendario → Agenda por profesor`): confirmado — turnos `DISPONIBLE` y `COMPLETO` aparecen con etiquetas distintas y correctas, sin ningún turno `PENDIENTE` colado (regla de negocio 3.2 verificada visualmente).
5. **`DirtyStateContext` y Cancelar:** confirmado — la confirmación aparece al intentar salir con cambios sin guardar, y "Cancelar" no persiste el cambio ni pide confirmación (mismo patrón que `aula-form.tsx`).

**Agregado fuera de lo acordado en la task original (documentado, no silencioso):**
1. **Etiquetas de estado:** el listado, detalle y formulario de participantes mostraban "Agendado" para cualquier turno no pendiente — texto que quedó incorrecto tras el cambio de enum. Se agregó `ETIQUETA_ESTADO_TURNO` en `turno.types.ts`, usado en `turnos-listado.tsx` y `turno-detalle.tsx`; en `participantes-turno.tsx` solo se corrigió el texto del mensaje. **Nota:** el badge/columna de estado en el listado en sí sigue siendo responsabilidad de HU-C-01 — esto fue solo corregir un texto que, de quedar así, mostraría información falsa en producción. Confirmado visualmente en el listado y en la agenda por profesor.
2. **`cupo_maximo` en el detalle del turno** (`turno-detalle.tsx`): dato adicional en la ficha, sin relación con `alumnos_inscriptos` (que sigue siendo de HU-C-01).
3. **Tope de `2147483647`** en Zod y en el formulario, para evitar que un valor mayor rompa la columna `INTEGER` de Postgres con un `500`.

**Otros hallazgos operativos:**
- `prisma migrate dev --create-only` aplicó de paso una migración pendiente preexistente en el repo (`20260924020844_alumno_version`), no generada por esta task.
- El turno de prueba `cmuf2ihu10002uwgw56cod8cn` quedó con cupo `3` tras las pruebas manuales del Scrum Master (se guardó dos veces durante la verificación) — se borra con el próximo reset, no requiere limpieza manual.
- `participantes-turno.test.tsx` no corrió (falta `jsdom` en caché de `npx`, `vitest` no es dependencia del proyecto) — problema preexistente, ajeno a esta HU. Queda como deuda técnica a resolver en algún momento, no bloquea el cierre de esta task.

**Sin commit ni `git add`** — cambios en el working directory a la espera de que el Scrum Master revise y commitee manualmente.

---

## 9. Evidencia de la reapertura Revisión 3 (24-25/09/2026) — cupo automático

**Relevamiento previo con Claude Code** (H1-H5, D1-D9, todos resueltos con recomendación del Scrum Master antes de implementar) y **redacción completa de `spec_modulo_C.md` §2.1 (Revisión 3)** antes de tocar código, siguiendo la metodología SDD.

**Implementado:**
- `cupo_maximo` eliminado de `ConfigurarTurnoSchema` (`turno.schema.ts`) y del formulario `turno-configuracion.tsx`.
- `configurarTurno()` inserta `cupoMaximoTurno: null`; migración aditiva `20260924235924_turno_cupo_nullable` (`ALTER COLUMN "cupoMaximoTurno" DROP NOT NULL`), sin `migrate reset` (no rompía datos existentes).
- **Fusión de pantallas (decisión de UI, Scrum Master):** `/turnos/nuevo` y `/turnos/[id]/aula` se unificaron en una sola vista (`seccion-aula-turno.tsx`, nuevo) — la sección de aula se habilita recién al completar fecha/hora/materia, y muestra el cupo como texto de solo lectura ("Cupo máximo: N alumnos (capacidad del aula elegida; solo lectura)"), nunca un input. Se sigue llamando en dos pasos al backend (`POST /turnos` y luego `PATCH .../aula`), sin endpoint combinado nuevo.
- Ruta vieja `/turnos/[id]/aula` y sus archivos (`aula-turno.tsx`, `aula-turno.test.tsx`) eliminados (D3) — confirmado que responde `404` sin redirect.
- Seed realineado (D5): cupos de turnos confirmados ajustados a la capacidad real de su aula; se agregaron aulas "Sala individual" (capacidad 1) y "Sala grupal" (capacidad 3) para poder probar los casos límite.

**Verificado en navegador por el Scrum Master (24-25/09/2026), como parte de la verificación de los 10 puntos de aceptación del rediseño completo (detalle íntegro en `HU-C-15.md` §6.3, ya que el rediseño cruza las tres HU):**
1. `/turnos/nuevo` no muestra campo de cupo; la sección de aula está grisada hasta completar fecha/hora/materia — confirmado.
2. Al elegir un aula, aparece "Cupo máximo: 10 alumnos (capacidad del aula elegida; solo lectura)" como texto, no como input — confirmado.
3. Guardado sin aula: "Turno configurado · Sin aula asignada · Pendiente"; reintento y recarga no duplican el turno — confirmado.
4. Modificación de un turno pendiente sin aula: "Cupo" y "Aula" muestran "Sin asignar" en el detalle — confirmado.

**Sin regresiones** respecto a lo verificado en §8 (error inline, mensaje de éxito, `DirtyStateContext`) — el rediseño no tocó esa lógica, solo el campo de cupo y la fusión de pantallas.

**Sin commit ni `git add`** — cambios en el working directory, PR pendiente de armar (descripción a cargo del Scrum Master una vez que se decida el momento del commit, en conjunto con HU-C-04 y HU-C-15 ya que es un único PR cruzando las tres HU).