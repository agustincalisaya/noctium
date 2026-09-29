# TASK: HU-L-03 — Modificar datos de materia

**Módulo:** L (Materias)
**Sprint:** 2
**Contrato de referencia:** `docs/specs/spec_modulo_L.md` Revisión 2: §2.4 (contrato), §3.4 (unicidad excluyéndose a sí misma), §3.5 (concurrencia optimista), §4 (trazabilidad, sin evento). También: §2.1 (reglas de validación del alta, reutilizadas) · §2.2 (detalle) · `docs/tasks/Sprint 2/HU-Sprint-2.md` HU-L-03 (criterios 1 a 5) · `docs/adicionales/mapa-pantallas-sprint-2.md` §1 (fila "Ficha de materia") · `docs/DESIGN.md` §3 (tokens `--warning`) y §6.2 (banner inline)
**Pantalla de referencia:** Mockup 20 "Ficha de materia — edición". No está en el repo. Si difiere de la spec o del mapa de pantallas, mandan la spec y el mapa.
**RBAC:** `materias:editar`, exclusivo del rol Gerente. **Ya lo trae el paquete de Sprint 2**: está en la migración `20260928150100_sprint2_modelo` (`('GERENTE','materias:editar')`) y en `prisma/seed.ts`. Esta task no lo agrega. `materias:leer` y `materias:crear` no se tocan.
**Schema:** **sin migración propia.** El paquete de Sprint 2 (`20260928150000_sprint2_enum` + `20260928150100_sprint2_modelo`) ya agrega a `Materia` las columnas `updatedAtMateria DateTime @default(now()) @updatedAt`, `modificadoPorUsuarioId String?` y `version Int @default(0)`, con los mismos nombres que usa esta task.

---

## 0. Relevamiento previo a implementación

Verificado el 28/09, antes de implementar:
- Están las migraciones del paquete de Sprint 2 y la Revisión 2 de `spec_modulo_L.md`, que contempla HU-L-03.
- Columnas, `version` y permiso coinciden con el paquete. No hace falta nada nuevo de modelo ni de permisos, así que no hay ningún pedido al integrador.
- La migración sin commitear `prisma/migrations/20260924222247/` (FK de `reservas_turno`) no es de esta HU y no se toca.

**Archivos creados:**
- `src/app/(dashboard)/materias/[id]/editar-materia-form.tsx`: el modo edición de la ficha (componente cliente).
- `src/lib/modo-edicion.ts`: el mecanismo `?modo=edicion` y `?actualizada=1`, reutilizable por HU-D-06 y HU-K-03.
- `src/components/shared/breadcrumb.tsx`: migas de pan con `LinkProtegido`.
- `src/server/materias/materia.modificar.test.ts`: tests del service y del schema.

**Archivos modificados:**
- `src/server/materias/materia.schema.ts`: `ModificarMateriaSchema`. Los validadores de nombre y código se extrajeron para compartirlos con `CrearMateriaSchema`, sin cambiar su comportamiento.
- `src/server/materias/materia.service.ts`:
  - `modificarMateria()`;
  - el helper `traducirViolacionUnicidad()`, compartido con `crearMateria()`;
  - `obtenerMateriaPorId()` ahora devuelve también `updated_at` y `version` (cambio aditivo).
- `src/server/materias/actions.ts`: la Server Action `modificarMateria()`.
- `src/types/materia.types.ts`: `ResultadoModificarMateria` y `DetalleMateria`.
- `src/app/api/materias/[id]/route.ts`: `PATCH`.
- `src/app/(dashboard)/materias/[id]/page.tsx`:
  - modo consulta y modo edición sobre la misma ruta;
  - breadcrumb;
  - botón "Modificar";
  - banner de éxito;
  - fila "Última modificación".
- `src/components/ui/badge.tsx`: variante `warning`.

---

## 1. Nota de alcance

**Ruta: la edición es un modo de la misma ficha, `/materias/[id]?modo=edicion`, no una ruta aparte.** Así lo definen `mapa-pantallas-sprint-2.md` §1 ("Ficha de materia (`/materias/[id]`) — HU-L-03 — Modo edición del mismo detalle") y `spec_modulo_L.md` §2.4 ("Pantalla: modo edición del mismo detalle"). **No** se crea `/materias/[id]/editar`, aunque Alumnos (HU-B-06) sí haya usado una subruta `editar/` en Sprint 1.

**Profesores que la dictan: se reutiliza lo que ya existe.** El detalle de HU-L-02 ya los resuelve con `obtenerMateriaPorId()`, bajo la excepción a la Regla N.° 3 documentada en `spec_modulo_L.md` §2.2. En modo edición se muestran esos mismos datos en solo lectura. No se consulta `Profesor` directamente ni se depende de `profesor.publico.ts`, así que no queda ningún PENDIENTE por este punto.

**Fuera de alcance de esta task (explícito):**
- Cambiar el estado activo/inactivo (criterio 5). `.strict()` rechaza `is_active`.
- Duración por materia (criterio 5, §3.3). `.strict()` rechaza cualquier campo extra.
- Editar los profesores asociados: se hace desde la ficha del profesor (HU-D-07).
- Evento `materia:modificada` o tabla de auditoría: la trazabilidad va por columnas (§4, Regla N.° 2 opción (a)).
- `obtenerMateriasPorIds()` (§2.5): la consume el módulo E, no es parte de esta HU.

---

## 2. Historia de Usuario

**Como** Gerente
**Necesito** modificar el nombre y el código de una materia registrada
**Para** corregir datos cargados o actualizar su código sin dar de baja la materia

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_L.md` §2.4:
- schema Zod `ModificarMateriaSchema`;
- service `modificarMateria()`;
- `PATCH /api/materias/[id]`;
- Server Action `modificarMateria()`;
- modo edición de la ficha `/materias/[id]` según el mockup 20.

Sin migración ni cambios de seed: los trae el paquete de Sprint 2.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/materias/materia.schema.ts`

Tiene las mismas reglas y normalización que el alta, porque comparte los validadores de nombre y código con `CrearMateriaSchema`. **Semántica de PATCH:**
- **campo ausente:** no se modifica;
- **`codigo: null` o `""`:** quita el código (el alta lo permite opcional, HU-L-01);
- **`version`:** obligatoria;
- **`.strict()`:** rechaza `is_active`, duración y cualquier otro campo.

Hay una diferencia menor con el snippet de §2.4: la spec deriva el schema con `CrearMateriaSchema.partial()`. Así, un `""` en `codigo` se transformaría a `undefined` ("no se modifica") en vez de a `null`. Por eso el campo se define explícitamente, para que el vacío quite el código tal como pide la regla de 5.b. Validado en el servidor.

### 4.2. Servicio

**Archivo:** `src/server/materias/materia.service.ts`
**Función:** `modificarMateria(id, input, usuarioId): Promise<{ id, campos_modificados, version }>`

Todo corre dentro de una única `prisma.$transaction`:
1. La materia debe existir, activa o inactiva. Si no → `MATERIA_NO_ENCONTRADA`.
2. Se compara el payload con los valores actuales y solo entran al `data` los campos que cambiaron (criterio 3). Si no cambió nada, devuelve `campos_modificados: []` sin escribir (spec §2.4 paso 1; ya no se usa `SIN_CAMBIOS`).
3. Si cambió el nombre: unicidad del nombre normalizado contra **todas las demás** materias, activas e inactivas (`NOT: { idMateria: id }`) → `NOMBRE_DUPLICADO`, con "(inactiva)" cuando corresponde.
4. Si cambió el código a un valor no nulo: unicidad análoga → `CODIGO_DUPLICADO`.
5. `updateMany({ where: { idMateria, version }, data: { ...cambios, version: { increment: 1 }, updatedAtMateria, modificadoPorUsuarioId } })`. Si `count === 0` → `CONFLICTO_EDICION_CONCURRENTE` (Regla N.° 7, §3.5).
6. Un `P2002` se traduce a `NOMBRE_DUPLICADO` o `CODIGO_DUPLICADO` con `traducirViolacionUnicidad()`, el mismo helper que usa `crearMateria()`.

### 4.3. Route Handler

`PATCH /api/materias/[id]`, protegido con `withPermission("materias:editar")`. Respuestas:
- `400 VALIDACION` (`flatten()`);
- `404 MATERIA_NO_ENCONTRADA`;
- `409 NOMBRE_DUPLICADO` / `CODIGO_DUPLICADO` / `CONFLICTO_EDICION_CONCURRENTE`;
- `200 { data: { id, campos_modificados, version }, error: null }`.

### 4.4. Server Action

`modificarMateria(materiaId, formData)` en `src/server/materias/actions.ts`. No está ligada a `useActionState`, así que usa el shape `{ data, error }` (Regla N.° 5), igual que `modificarAlumno()`. Paso a paso:
1. Arma el payload con `formData.has()` (ausente = no se modifica).
2. Valida con Zod.
3. Llama a `verificarPermiso("materias:editar")`.
4. Invoca el service.
5. Ejecuta `revalidatePath` sobre `/materias` y `/materias/[id]`.

### 4.5. Trazabilidad

No hay evento. `updatedAtMateria`, `modificadoPorUsuarioId` y `version` se escriben en el mismo `updateMany` (§4 de la spec).

---

## 5. Frontend — ficha `/materias/[id]` en modo edición (mockup 20)

**Decisiones tomadas (28/09):**
- **5.a. Mecanismo:** el parámetro de URL `?modo=edicion` sobre `/materias/[id]`. Vive en `src/lib/modo-edicion.ts` (`esModoEdicion`, `rutaModoEdicion`, `rutaTrasGuardar`, `fueActualizada`) para que HU-D-06 (ficha de profesor) y HU-K-03 (aula) usen exactamente el mismo mecanismo. La página es un Server Component: con `?modo=edicion` exige `materias:editar` (`exigirPermiso`, que redirige a `/sin-permiso`) antes de montar el formulario.
- **5.b. Vaciar el código:** el alta (HU-L-01) lo trata como opcional, así que en la edición vaciarlo lo deja en `null`. En el PATCH, un campo ausente no se modifica y un `null` explícito (o `""`) lo borra. Validado en el servidor (4.1).
- **Concurrencia optimista:** el cliente manda la `version` que vio. Si no coincide, no se guarda y se muestra el mensaje de la spec ("La materia fue modificada por otro usuario. Recargá para ver los datos actuales.") con un botón "Recargar". Ese botón hace `router.refresh()`, y el formulario se remonta con los datos actuales por el `key={version}`.

**Modo consulta** (HU-L-02, ampliado):
- breadcrumb "Materias / <nombre>";
- botón "Modificar", visible solo con `materias:editar` (`tienePermiso`);
- fila "Última modificación", visible solo si la materia se modificó alguna vez (`version > 0`);
- banner "Materia actualizada correctamente" con `?actualizada=1` (`bg-success`, DESIGN.md §6.2).

**Modo edición:**
- **Encabezado:** breadcrumb, título, `Badge variant="warning"` con el texto "Editando", "Cancelar" (outline) y "Guardar cambios".
- **"Guardar cambios":** deshabilitado mientras el valor normalizado sea igual al guardado, y también mientras se procesa ("Guardando...").
- **Tarjeta "Datos de la materia":**
  - inputs Nombre y Código, precargados;
  - texto de ayuda del mockup;
  - errores debajo de cada campo con el mismo patrón que el alta (`text-destructive`, `role="alert"`, `aria-invalid`); los duplicados se muestran en su campo.
- **Tarjeta "Profesores que la dictan":**
  - chips (`Badge variant="outline"`) con los datos de `obtenerMateriaPorId()`;
  - nota "Mesa de Entradas las asigna desde la ficha de cada profesor.";
  - solo lectura.
- En pantallas angostas las tarjetas se apilan (`md:grid-cols-2`).
- Sin switch de estado ni campo de duración.
- **Cancelar:** si no hay cambios, vuelve a modo consulta. Si hay cambios, abre `ConfirmarDescarteDialog`. `DirtyStateContext` refleja los cambios, así que el breadcrumb, el menú, el logout y el cierre de la pestaña también piden confirmación.
- **Guardar:** manda solo los campos que cambiaron más `version`. Si sale bien, pasa a `router.replace("/materias/[id]?actualizada=1")`, con banner.

**Pendiente de diseño (no bloqueante):** DESIGN.md §6.5 pide `--destructive-soft` para los "avisos cortos de acción rechazada", pero ese token todavía no existe en `src/app/globals.css`. Por eso el aviso de conflicto usa el mismo estilo de error general que el formulario de alta (`text-destructive`). Cuando el token se agregue a `globals.css`, conviene migrarlo.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios (`src/server/materias/materia.modificar.test.ts`, 19 tests, pasan)
- `modificarMateria`:
  - solo nombre (se actualizan nombre y normalizado, no el código);
  - solo código;
  - código `null` (lo quita, sin chequear duplicados);
  - sin cambios (no escribe, `[]`);
  - nombre duplicado con otra activa y con otra inactiva ("(inactiva)"), excluyendo la propia;
  - cambio solo de mayúsculas/acentos del propio nombre → no es duplicado;
  - código duplicado;
  - `version` desactualizada → `CONFLICTO_EDICION_CONCURRENTE`;
  - `P2002` en nombre y en código → 409 de negocio;
  - materia inexistente;
  - materia inactiva editable.
- `ModificarMateriaSchema`:
  - normalización igual que el alta;
  - campo ausente;
  - `""`/`null` → `null`;
  - validaciones de largo y formato;
  - `version` obligatoria;
  - rechaza `is_active`/duración.

### Nivel 2 — Postman
- `PATCH /api/materias/:id` como Gerente → `200 { id, campos_modificados, version }`.
- Con Mesa de Entrada o Profesor → `403 SIN_PERMISO`, sin cambios en la BD.
- Nombre duplicado → `409 NOMBRE_DUPLICADO`; código duplicado → `409 CODIGO_DUPLICADO`.
- Misma `version` enviada dos veces con cambios → la segunda da `409 CONFLICTO_EDICION_CONCURRENTE`.
- Nombre de 1 carácter → `400`; sin `version` → `400`; con `is_active` o `duracion` → `400`.
- Id inexistente → `404`.
- Body idéntico al actual → `200` con `campos_modificados: []`, y la `version` no cambia.

### Nivel 3 — BD / TablePlus
- Después de editar: `updatedAtMateria` avanzó, `modificadoPorUsuarioId` es el del gerente, `version` subió en 1, y `createdAtMateria`, `creadoPorUsuarioId` y `activaMateria` no cambiaron.

**Evidencia esperada:** Postman y SQL, más capturas de la ficha en modo edición en estos estados: sin cambios (Guardar deshabilitado), error de duplicado, guardando, confirmación de Cancelar, conflicto de versión, y el banner de éxito.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo: paquete de Sprint 2 y spec Revisión 2 presentes; nombres coincidentes; sin migración propia.
- [x] Service, Route Handler (`PATCH`) y Server Action, sin lógica de negocio fuera de `materia.service.ts`.
- [x] Unicidad excluyendo la propia materia, aplicativa más `P2002`, para nombre y código.
- [x] Solo se actualizan los campos modificados; sin cambios no se escribe.
- [x] Concurrencia optimista con `version`.
- [x] Ficha con `?modo=edicion` (mecanismo reutilizable), breadcrumb, badge "Editando" (`warning`), Guardar deshabilitado sin cambios, profesores en solo lectura.
- [x] Cancelar con `ConfirmarDescarteDialog` y `DirtyStateContext`; banner "Materia actualizada correctamente".
- [x] Sin switch de estado ni duración.
- [x] Ningún `DELETE` físico.
- [x] Nivel 1 en verde; typecheck y lint limpios.
- [ ] Niveles 2 y 3 (Postman y SQL) y capturas de UI: a cargo de quien pruebe a mano.
- [ ] PR con el diff acotado a esta HU.
