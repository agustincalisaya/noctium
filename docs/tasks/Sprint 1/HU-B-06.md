# HU-B-06 — Modificar datos del alumno

**Módulo:** B (Alumno) · **Sprint:** 1 · **Prioridad:** 19 · **SP:** 1
**Contrato de referencia:** `spec_modulo_B.md §2.5, §3.3`
**RBAC:** `alumnos:editar` (ya existe, MESA_ENTRADA-only)
**Schema:** requiere migración — agrega `version Int @default(0)` a `Alumno`
**Estructura de carpetas:** conforme a Regla N.° 11 de `RULES.md`

---

## 0. Relevamiento previo

Relevamiento realizado por Claude Code sobre `feature/HU-B-06` (creada desde `develop` con HEAD `1f866cc`, ya con HU-B-03 y los PRs de Módulo C/D mergeados), verificando todo directamente en disco.

### Hallazgo bloqueante confirmado

`actualizarEmailCuenta()` **no existe** en ningún lugar del repo real de Módulo A. Se revisó `src/server/usuarios/usuario.service.ts` (solo tiene `obtenerNombreVisible()`, de lectura) y `src/server/sesion/` (solo login y renovación de sesión) — ninguna función pública de escritura sobre `Usuario.email`. Esto es la misma tensión con la Regla N.° 3 que ya había quedado documentada en HU-B-02 (`alumno.service.ts:138-143`), ahora más grave por tratarse de una escritura real, no de una simple verificación de lectura.

**Decisión resuelta (Adriel, 2026-09-23):** se implementa toda la HU salvo el caso "alumno con cuenta vinculada (`usuarioId` no nulo) cambia su email" — ese caso específico queda documentado como bloqueado/pendiente, sin ningún atajo que escriba directo sobre `Usuario`. Se avisa al equipo para que prioricen `actualizarEmailCuenta()` en Módulo A. La validación de unicidad de email (lectura, mismo patrón de HU-B-02) y la actualización de `Alumno.emailAlumno` para cualquier alumno (con o sin cuenta) sí se implementan normalmente.

### Hallazgos adicionales confirmados en disco

- `version` no existe en `Alumno` (revisado campo por campo); el único campo con "version" en el nombre es `versionTerminosAceptada` (HU-B-08, sin relación con concurrencia).
- Migración de un solo paso: `ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0` — no requiere el patrón nullable→backfill de las columnas normalizadas, porque el default es una constante, no un valor calculado por fila. Mismo criterio que la migración de auditoría de `profesor_materia` (HU-D-03).
- `crearAlumno()` (HU-B-01) está en `src/app/(dashboard)/alumnos/actions.ts`, violando la Regla N.° 11 literal (debería estar en `src/server/alumnos/actions.ts`). Se corrige como parte de esta task, ya que de todos modos hay que tocar ese archivo para agregar `modificarAlumno()`.
- `src/app/(dashboard)/alumnos/[id]/page.tsx` ya tenía un comentario anticipando esta HU ("HU-B-06 agrega edición de identidad con el mismo FichaSeccion"), pero el relevamiento determinó que un formulario único calza mejor con el criterio 1 y evita un problema real de concurrencia (ver Nota de alcance).
- `TurnoAlumno` es tabla puente pura (`turnoId`, `alumnoId`), sin ningún dato denormalizado de nombre/apellido — el criterio 7 se cumple por diseño relacional, sin cambios necesarios.
- Sin emisión de evento `alumno:actualizado` — mismo precedente que el resto del módulo (no hay mecanismo de eventos implementado en el repo).

### Archivos nuevos

| Archivo | Contenido |
|---|---|
| `prisma/migrations/<ts>_alumno_version/migration.sql` | `ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0` |
| `src/app/api/alumnos/[id]/route.ts` | Export `PATCH` (el archivo ya existe con `GET`, de HU-B-04) |
| `src/app/(dashboard)/alumnos/[id]/editar/page.tsx` | Página del formulario único |
| `src/app/(dashboard)/alumnos/[id]/editar/editar-alumno-form.tsx` | Formulario unificado (identidad + contacto + forma de pago) |
| `docs/tasks/Sprint 1/HU-B-06.md` | Este documento |

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agrega `version Int @default(0)` a `Alumno` |
| `src/server/alumnos/alumno.schema.ts` | Agrega `construirModificarAlumnoSchema()` (factory, misma razón que `crearIdentidadAlumnoSchema` por `dniLongitudMin/Max`) |
| `src/server/alumnos/alumno.service.ts` | Agrega `modificarAlumno()` (patrón `updateMany` de Regla N.° 7) y extrae el helper compartido de validación de forma de pago (usado también por `actualizarFormaPagoPreferida()`) |
| `src/server/alumnos/actions.ts` | Agrega `modificarAlumno()` (Server Action) y **recibe `crearAlumno()` movida acá** desde `src/app/(dashboard)/alumnos/actions.ts` (corrección de deuda técnica de HU-B-01) |
| `src/app/(dashboard)/alumnos/actions.ts` | Se elimina (contenido movido a `src/server/alumnos/actions.ts`) — actualizar los imports que lo referencian |
| `src/types/alumno.types.ts` | `Alumno`/`DetalleAlumno` ganan `version`; nuevo tipo `ResultadoModificarAlumno` |
| `src/app/(dashboard)/alumnos/[id]/ficha-encabezado.tsx` | Agrega el link "Modificar datos", con nueva prop `puedeEditar` |
| `src/app/(dashboard)/alumnos/[id]/page.tsx` | Pasa `puedeEditar` a `FichaEncabezado` |

---

## 1. Nota de alcance

### Decisiones resueltas (DECISIÓN RESUELTA, Adriel, 2026-09-23)

1. **Bloqueante `actualizarEmailCuenta()`**: se implementa toda la HU salvo el caso "alumno con cuenta vinculada cambia su email" (ver arriba). Este caso queda **fuera de alcance de esta task por dependencia bloqueante**, no por decisión de scope — se documenta explícitamente y se avisa al equipo.
2. **Arquitectura UX: formulario único** en `/alumnos/[id]/editar`, con identidad, contacto y forma de pago en un solo `<form>`/submit. Motivo: calza con el criterio 1 literal ("un formulario precargado") y evita que dos ediciones parciales abiertas a la vez (si hubiera secciones separadas) compitan por el mismo `version` cargado, generando conflictos de concurrencia contra uno mismo. Las páginas `/alumnos/[id]/contacto` y `/alumnos/[id]/forma-pago` (HU-B-02/B-03) siguen existiendo y siendo válidas por su propio contrato, pero ya no son la vía principal de edición desde la ficha.
3. **Se corrige la deuda técnica de HU-B-01**: `crearAlumno()` se mueve de `src/app/(dashboard)/alumnos/actions.ts` a `src/server/alumnos/actions.ts`, cumpliendo la Regla N.° 11. Se aprovecha porque de todos modos hay que tocar ese archivo para esta HU.
4. **Validación de forma de pago compartida**: se extrae un helper (verificación de existencia + `activaFormaPago`) usado tanto por `actualizarFormaPagoPreferida()` (HU-B-03) como por la nueva `modificarAlumno()`, evitando duplicar la regla de negocio.

### Puntos aceptados sin objeción (confirmados por Claude Code, consistentes con precedentes del propio módulo)

- Migración de `version` en un solo paso (default constante, sin backfill).
- Sin emisión de evento de dominio `alumno:actualizado` (mismo precedente que el resto del módulo).
- Género usa el mismo patrón `camposProvistos` que teléfono/email de HU-B-02, para poder volver explícitamente a "sin especificar" (distinguir "campo no provisto" de "campo provisto para limpiar").
- Sin cambios necesarios para el criterio 7 (turnos reflejan datos actualizados) — `TurnoAlumno` es tabla puente pura, se cumple por diseño relacional.

### Fuera de alcance de esta historia (texto oficial del PDF)

- Desactivación y reactivación del alumno (Sprint 3).
- Consulta del historial de cambios de la ficha.

### Fuera de alcance de esta task (por dependencia bloqueante, no por decisión de scope)

- Propagación del cambio de email a `Usuario.email` cuando el alumno tiene cuenta vinculada (`Alumno.usuarioId` no nulo) — bloqueado por la ausencia de `actualizarEmailCuenta()` en Módulo A. El aviso de "el nuevo email pasará a ser tu email de acceso" (parte del criterio 4) tampoco se implementa todavía, ya que depende de este mismo caso.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** modificar la información de un alumno registrado
**Para** mantener actualizados sus datos de identidad, contacto y preferencia de pago

**SP estimado:** 1

**Criterios de aceptación (oficiales, PDF):**

1. Desde el detalle o el listado se abre un formulario precargado con los datos actuales del alumno. Los campos conservan las mismas etiquetas y ayudas de formato que en el alta.
2. Se pueden modificar Nombre, Apellido, DNI, Fecha de nacimiento, Género, Teléfono, Email y forma de pago preferida. El identificador interno, la fecha de alta y el estado se muestran sin posibilidad de edición.
3. Los datos modificados deben cumplir las mismas validaciones definidas para el registro inicial (reglas de HU-B-01 identidad, HU-B-02 contacto, HU-B-03 forma de pago).
4. Si se cambia el DNI, se comprueba que no pertenezca a otro alumno activo o inactivo, excluyendo la propia ficha. Si se cambia el email asociado a una cuenta, también se valida su unicidad, y se avisa antes de confirmar que el nuevo email pasará a ser su email de acceso. **(Parcialmente bloqueado — ver Nota de alcance: la propagación a `Usuario.email` y el aviso correspondiente quedan pendientes de `actualizarEmailCuenta()` en Módulo A.)**
5. Al guardar se actualizan únicamente los datos modificados y se informa "Alumno actualizado correctamente". La operación se realiza en una única transacción y registra la fecha y el usuario de la modificación. Si no hubo cambios, la acción Guardar permanece deshabilitada.
6. Si otro usuario modificó la ficha mientras el formulario estaba abierto, no se sobrescriben sus cambios. Se muestra "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales".
7. Los turnos del alumno siguen vinculados a la misma ficha y muestran sus datos actualizados.
8. Cancelar descarta las modificaciones; si existen cambios, se solicita confirmación antes de abandonar el formulario.
9. Esta historia no permite cambiar el estado activo/inactivo del alumno.

---

## 3. Alcance de la task

- Migración `version Int @default(0)` en `Alumno`.
- `construirModificarAlumnoSchema()` + `modificarAlumno()` + helper compartido de validación de forma de pago.
- `PATCH /api/alumnos/[id]` + Server Action `modificarAlumno()`.
- Formulario único `/alumnos/[id]/editar` (identidad + contacto + forma de pago).
- Link "Modificar datos" en la ficha (`ficha-encabezado.tsx`).
- Corrección de ubicación de `crearAlumno()` (deuda técnica de HU-B-01).

---

## 4. Contrato Backend

### 4.1. Schema

```typescript
export function construirModificarAlumnoSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax)
    .partial()
    .merge(ContactoAlumnoSchema.partial())
    .extend({
      forma_pago_id: z.string().min(1).nullable().optional(), // mismo criterio que HU-B-03 (ids reales son slugs, no UUID)
      version: z.number().int().nonnegative(), // obligatorio, no opcional
    })
    .strict();
}
export type ModificarAlumnoInput = z.infer<ReturnType<typeof construirModificarAlumnoSchema>>;
```

### 4.2. Service — `modificarAlumno()`

1. Verificar existencia de la ficha (para distinguir "no existe" de "edición concurrente" en el paso 4).
2. Si viene `dni`: validar unicidad excluyendo la propia ficha (`id != alumnoId`), contra activas e inactivas.
3. Si viene `email`: validar unicidad contra `Usuario.email` (lectura). **Si `Alumno.usuarioId` no es `null`: no propagar el cambio a `Usuario.email`** — este caso queda bloqueado (ver Nota de alcance); documentar con un comentario explícito en el código, igual que se hizo en HU-B-02.
4. Si viene `forma_pago_id` no nulo: usar el helper compartido para verificar que la `FormaPago` exista y esté activa.
5. **Concurrencia optimista (Regla N.° 7):**
   ```typescript
   const resultado = await tx.alumno.updateMany({
     where: { id: alumnoId, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, updatedAt: new Date() },
   });
   if (resultado.count === 0) {
     throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
   }
   ```
6. Solo se escriben los campos efectivamente provistos en el payload (diff) — mismo patrón `camposProvistos` que HU-B-02, extendido a todos los campos editables (incluido género, para permitir volver a "sin especificar").
7. `id`, `is_active` y `created_at` nunca son editables desde este endpoint.
8. No emite evento de dominio (ver Nota de alcance).

### 4.3. Route Handler — `PATCH /api/alumnos/[id]/route.ts`

- El archivo ya existe (con `GET`, de HU-B-04) — se agrega el export `PATCH`.
- Protegido con `withPermission("alumnos:editar", ...)`.
- Valida con `construirModificarAlumnoSchema(...).safeParse()` → 400 con `flatten()` si falla.
- Traduce `409 CONFLICTO_EDICION_CONCURRENTE`, `409 DNI_YA_REGISTRADO`, `409 EMAIL_YA_ASOCIADO`, `409 FORMA_PAGO_NO_DISPONIBLE` según corresponda.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "uuid", "campos_modificados": ["telefono", "forma_pago_id"], "version": 4 }, "error": null }
```

**Respuesta `409 Conflict` (edición concurrente):**
```json
{ "data": null, "error": { "code": "CONFLICTO_EDICION_CONCURRENTE", "message": "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." } }
```

### 4.4. Server Action — `modificarAlumno()`

En `src/server/alumnos/actions.ts` (junto a `crearAlumno()`, ahora corregida de ubicación, y las otras dos actions existentes), mismo patrón: `verificarPermiso("alumnos:editar")` → service → `revalidatePath` → `MENSAJES_POR_CODIGO` → `{ data, error }` genérico.

### 4.5. Eventos de dominio

No aplica (ver Nota de alcance).

---

## 5. Frontend

### `/alumnos/[id]/editar` (nueva)

- Formulario único, precargado con los datos actuales del alumno (identidad, contacto, forma de pago) más el `version` actual (oculto, no editable).
- Mismas etiquetas y ayudas de formato que en el alta (HU-B-01/B-02/B-03).
- Nombre, Apellido, DNI, Fecha de nacimiento, Género, Teléfono, Email y forma de pago preferida son editables. Id interno, fecha de alta y estado se muestran sin edición.
- "Guardar" permanece deshabilitado si no hubo cambios respecto al valor cargado (diffing real campo por campo, no solo un flag de "tocado" — el patrón existente de `useDirtyState()` en `ContactoAlumnoForm` no alcanza para este criterio, hay que construir la comparación).
- Al guardar exitosamente: "Alumno actualizado correctamente".
- Si el servidor devuelve `409 CONFLICTO_EDICION_CONCURRENTE`: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales" — no se reintenta el guardado automáticamente.
- Si se cambia el DNI y ya pertenece a otro alumno: mismo mensaje de HU-B-01.
- Si se cambia el email y ya está asociado a otra cuenta: mismo mensaje de HU-B-02.
- **No se implementa** el aviso "el nuevo email pasará a ser tu email de acceso" (bloqueado, ver Nota de alcance).
- "Cancelar" descarta modificaciones; si hay cambios sin guardar, pide confirmación (reutiliza `DirtyStateContext`/`ConfirmarDescarteDialog`).

### `/alumnos/[id]` (ficha)

- `ficha-encabezado.tsx` agrega el link "Modificar datos" hacia `/alumnos/[id]/editar`, visible solo si `puedeEditar` (derivado de `alumnos:editar`, ya calculado en `page.tsx` desde HU-B-04).

---

## 6. Testing

### Nivel 1 — Unitarios

No aplica (sin test runner instalado en el proyecto).

### Nivel 2 — Integración (curl)

- Modificar solo un campo (ej. teléfono) con `version` correcto → 200, solo ese campo cambia, `version` incrementado en la respuesta.
- Modificar múltiples campos a la vez → 200, todos reflejados, un solo incremento de `version`.
- Modificar con `version` desactualizado (simular edición concurrente: dos requests con el mismo `version` inicial, la segunda debe fallar) → 409 `CONFLICTO_EDICION_CONCURRENTE`.
- Cambiar DNI a uno ya usado por otro alumno (activo e inactivo, dos casos) → 409.
- Cambiar DNI al mismo valor que ya tiene la propia ficha → 200 (no debe autorrechazarse).
- Cambiar email a uno ya asociado a otra cuenta → 409 `EMAIL_YA_ASOCIADO`.
- Cambiar email de un alumno **sin** cuenta vinculada → 200, se actualiza `Alumno.emailAlumno` normalmente.
- Cambiar email de un alumno **con** cuenta vinculada → verificar el comportamiento acordado (bloqueado): documentar exactamente qué pasa hoy (¿se actualiza solo `Alumno.emailAlumno` y `Usuario.email` queda desincronizado deliberadamente, marcado en la respuesta o en la task? — a confirmar con Claude Code al implementar, no asumir).
- Cambiar forma de pago a una inactiva/inexistente → 409 `FORMA_PAGO_NO_DISPONIBLE`.
- Volver género a "sin especificar" → 200, queda `null`.
- Sin permiso `alumnos:editar` → 403.
- Sin sesión → 401.
- Body inválido → 400.

### Nivel 3 — BD

- Verificar que `version` se incrementa en cada actualización exitosa y nunca en un `409`.
- Verificar que los campos no provistos en el payload no cambian.
- Verificar que `TurnoAlumno` de un alumno modificado sigue apuntando a la misma ficha, con los datos actualizados visibles vía join.

---

## 7. Checklist DoD

- [x] Migración `version` aplicada.
- [x] `construirModificarAlumnoSchema()`, `modificarAlumno()` y el helper compartido de forma de pago implementados.
- [x] `PATCH /api/alumnos/[id]` implementado y protegido con `alumnos:editar`.
- [x] Server Action implementada, `{ data, error }` genérico.
- [x] `crearAlumno()` movida a `src/server/alumnos/actions.ts`, `src/app/(dashboard)/alumnos/actions.ts` eliminado, imports actualizados.
- [x] Formulario único `/alumnos/[id]/editar` implementado, con diffing real para deshabilitar "Guardar" sin cambios.
- [x] Link "Modificar datos" agregado a la ficha.
- [x] Caso "email + cuenta vinculada" documentado como bloqueado, con el comportamiento exacto verificado y anotado (no silencioso) — ver sección 8.1.
- [x] `npm run lint` y `npm run build` limpios.
- [x] Nivel 2 (curl) con evidencia real de todos los casos de la sección 6 — ver sección 8.4.
- [x] Nivel 3 (BD) con evidencia real — ver sección 8.4.
- [ ] Verificado manualmente por Adriel en el navegador antes del commit final, incluyendo el caso de edición concurrente (dos pestañas) y el diffing de "Guardar deshabilitado".

---

## 8. Correcciones posteriores

### 8.1. Bloqueante email + cuenta vinculada — decisión final (Adriel, 2026-09-23)

Confirmado: **opción (a), rechazo atómico**, no la variante de guardado parcial planteada inicialmente. Si el payload trae un cambio de `email` y `Alumno.usuarioId` no es `null`, `modificarAlumno()` lanza `EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE` (409) **dentro de la misma transacción** que el resto de las validaciones — no se guarda nada del request, ni siquiera los demás campos del payload que no tenían ningún problema.

**Motivo:** los otros tres 409 de este mismo endpoint (`DNI_DUPLICADO`, `EMAIL_YA_ASOCIADO`, `FORMA_PAGO_NO_DISPONIBLE`) ya bloquean el `PATCH` completo — ningún caso de error de `modificarAlumno()` hace commit parcial. Guardar el resto de los campos mientras se informa un error específico de uno de ellos rompería:
- El contrato de respuesta estándar (Regla N.° 5 de `docs/RULES.md`): `{data, error}` es mutuamente excluyente, nunca ambos a la vez.
- El criterio 5 de esta misma HU: "la operación se realiza en una única transacción".
- La consistencia del endpoint: no hay motivo de negocio para que el email sea el único campo con semántica de "falla pero guarda el resto".

**Verificado con evidencia real (curl, Nivel 2, 2026-09-23):** alumno con cuenta vinculada (Sofía Fernández, `usuarioId` no nulo), payload `{"email":"sofia.nueva@example.com","telefono":"+54 11 9999-0000","version":0}` → `409 EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE`. Verificación directa en BD inmediatamente después: `telefonoAlumno` y `emailAlumno` sin cambios, `version` sigue en `0` — confirma que el rechazo fue 100% atómico, ninguno de los dos campos se escribió.

Sigue pendiente, sin cambios respecto a lo ya documentado en §0/§1: la propagación a `Usuario.email` y el aviso "pasará a ser tu email de acceso" quedan bloqueados hasta que Módulo A implemente `actualizarEmailCuenta()`.

### 8.2. Código de error de DNI duplicado — unificado a `DNI_DUPLICADO`

El contrato original de esta task (§4.3, §6) especificaba un código nuevo, `DNI_YA_REGISTRADO`, para `modificarAlumno()`. Se unificó a `DNI_DUPLICADO` (Adriel, 2026-09-23) — el mismo código que ya usa `crearAlumno()` (HU-B-01) para la misma regla de negocio ("ese DNI ya pertenece a otra ficha, activa o inactiva"). Introducir un segundo código para una regla idéntica solo agregaría una traducción más que mantener en el frontend sin ninguna distinción real de comportamiento.

### 8.3. Hallazgos técnicos de la implementación (no decisiones de negocio)

- **Zod v4 rompe el snippet literal de `spec_modulo_B.md` §2.5 / task §4.1**: `ContactoAlumnoSchema` (= `ContactoSchema` de `contacto.schema.ts`) tiene un `.superRefine()` propio (la regla "al menos uno de teléfono/email"). En Zod v4, `.partial()` sobre un objeto con `checks` propios lanza en runtime: `.partial() cannot be used on object schemas containing refinements` (`node_modules/zod/v4/core/util.js:498-504`). `construirModificarAlumnoSchema()` no usa `.merge(ContactoAlumnoSchema.partial())` — en su lugar agrega `telefono`/`email` explícitamente con el helper `campoOpcional()` (ahora exportado desde `contacto.schema.ts`), sin la regla "al menos uno" (no aplica a una edición parcial).
- `genero` se sobreescribe en el schema de modificación como `.nullable().optional()` (a diferencia del `.optional()` de `crearIdentidadAlumnoSchema`) para poder distinguir "no vino" (no se toca) de "vino `null`" (se persiste como "sin especificar") — necesario para el criterio de poder volver el género a "sin especificar".
- La función real de identidad se llama `crearIdentidadAlumnoSchema`, no `construirIdentidadAlumnoSchema` como decía el relevamiento inicial de esta task.
- `Alumno.modificadoPorUsuarioId` ya existía en el schema (agregado con un comentario anticipando esta HU) — no hizo falta migrarlo, solo `version`.
- El `updateMany` de `modificarAlumno()` tipa `data` como `Prisma.AlumnoUncheckedUpdateManyInput`, no `AlumnoUpdateManyMutationInput` — la variante "checked" no expone `formaPagoPreferidaId` (solo la relación `formaPagoPreferida`), y acá se escribe el escalar FK directamente.
- El formulario único (`editar-alumno-form.tsx`) calcula el diff campo por campo tanto para deshabilitar "Guardar" como para decidir qué claves incluir en el `FormData` que recibe la Server Action — así `camposProvistos` (que la action arma con `formData.has()`) refleja cambios reales, no todo el formulario en cada guardado.

### 8.4. Evidencia de testing

**Nivel 2 (curl, 2026-09-23, `npm run dev` local)** — los 14 casos de la sección 6, contra el seed real (Martina Sánchez `cmuenrgjs000uhnsga5sj2240`, sin cuenta; Sofía Fernández `cmuenrgif000ihnsgmjwam3mw`, con cuenta; Tomás Romero DNI `40100008` activo; Bruno Paz DNI `40100017` inactivo):

| Caso | Resultado |
|---|---|
| Un solo campo (teléfono), version correcto | `200`, `campos_modificados:["telefono"]`, version 0→1 |
| Múltiples campos (teléfono+email) | `200`, ambos reflejados, version 1→2 |
| Edición concurrente **real** (2 requests paralelos, mismo version=2) | Uno `200` (version 2→3), el otro `409 CONFLICTO_EDICION_CONCURRENTE` |
| DNI ya usado (alumno activo) | `409 DNI_DUPLICADO`, "Ya existe un alumno registrado con ese DNI" |
| DNI ya usado (alumno inactivo) | `409 DNI_DUPLICADO`, "...(ficha inactiva)" |
| DNI al mismo valor propio | `200`, no se autorrechaza |
| Email ya asociado a otra cuenta | `409 EMAIL_YA_ASOCIADO` |
| Email, alumno sin cuenta vinculada | `200`, `emailAlumno` actualizado |
| Email, alumno con cuenta vinculada (+ otro campo) | `409 EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE`, rechazo atómico verificado en BD |
| Forma de pago inexistente | `409 FORMA_PAGO_NO_DISPONIBLE` |
| Género → "sin especificar" | `200`, columna queda `NULL` en BD |
| Sin permiso (`GERENTE`) | `403 SIN_PERMISO` |
| Sin sesión | `401 SESION_INVALIDA` |
| Body inválido (JSON malformado / falta `version` / clave desconocida) | `400` en los tres casos |

**Nivel 3 (BD, 2026-09-23)**:
- `version` de Martina terminó en `6` (6 escrituras exitosas: teléfono, teléfono+email, concurrente-ganador, DNI-propio, email, género) — nunca se incrementó en ninguno de los `409`.
- `version` de Sofía quedó en `0` tras su único intento (rechazado) — confirma que el `409 EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE` no tocó la fila.
- `nombreAlumno`/`apellidoAlumno`/`formaPagoPreferidaId` de Martina nunca provistos en ningún request de prueba: verificados sin cambios en BD al final de la secuencia.
- `modificadoPorUsuarioId` de Martina quedó en el id de la sesión de `mesa.entrada@noctium.local` que hizo las modificaciones.
- Join `turno_alumno` → `turnos`/`alumnos` para el turno `seed-turno-07` de Martina: sigue apuntando a la misma ficha y expone `telefonoAlumno`/`emailAlumno` ya actualizados — confirma el criterio 7 (sin cambios de código necesarios, por diseño relacional).

**Build/lint**: `npm run lint` limpio (0 errores; 1 warning preexistente no relacionado en `home/page.tsx`). `npm run build` compila y tipa sin errores.

**Pendiente**: verificación manual de Adriel en el navegador (formulario, diffing de "Guardar" deshabilitado, edición concurrente con dos pestañas reales) antes del commit final — no se marca como "listo" sin esa verificación.
