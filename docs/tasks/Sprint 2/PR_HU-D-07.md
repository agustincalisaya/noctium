# 📌 Descripción del Pull Request

Se implementa la funcionalidad correspondiente a la Historia de Usuario **HU-D-07 – Modificar materias asociadas al profesor**.

## HU-D-07 – Modificar materias asociadas al profesor
**Rol:** Personal de Mesa de Entrada · **Sprint:** 2

### Resumen
Desde el modo edición de la ficha del profesor (`/profesores/[id]?modo=edicion`) ahora se pueden agregar y quitar materias con el mismo selector de HU-D-03. El guardado es todo o nada. Quitar una materia se bloquea si el profesor tiene turnos futuros (Disponible o Completo) de ella: aparece un aviso debajo de la materia con el link "Ver turnos", que abre un modal con esos turnos paginados de a 10, cada uno enlazado a su Detalle de turno en una pestaña nueva.

Contrato: `spec_modulo_D.md` §2.7 y `spec_modulo_C.md` §2.15. Task: `docs/tasks/Sprint 2/HU-D-07.md` (§11: implementación).

### Cambios

**Backend módulo D**
- `src/server/profesores/profesor.service.ts`: `actualizarMateriasDeProfesor()` (conjunto final, diff agregar/quitar, todo o nada en una transacción, no toca `version` ni `HorarioProfesor`) y `listarTurnosFuturosDeMateria()` (lista del modal vía el servicio público de Turnos).
- `src/server/profesores/profesor.schema.ts`: `ActualizarMateriasProfesorSchema` (`materia_ids`, `.strict()`, sin repetidos, admite vacío), `ListarTurnosFuturosQuerySchema` y `TURNOS_FUTUROS_POR_PAGINA = 10`.
- `src/server/profesores/actions.ts`: Server Action `actualizarMateriasProfesor(profesorId, materiaIds)` con `{ data, error }`, `detalle` por materia bloqueada y `revalidatePath` de ficha, listados y materias tocadas.
- `src/types/profesor.types.ts`: `ResultadoActualizarMaterias`, `MateriaBloqueadaPorTurnos`, `TurnoFuturoDeMateria`, `PaginaTurnosFuturos`.

**API**
- `src/app/api/profesores/[id]/materias/route.ts`: nuevo `PUT` (`profesores:editar`). Responde `409 MATERIA_CON_TURNOS_FUTUROS` con `detalle: [{ materia_id, cantidad }]` y `409 MATERIA_INACTIVA` con `materia_ids_invalidas`. El `POST` de HU-D-03 no cambia.
- `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.ts` (nuevo): `GET ?pagina=N` (`profesores:leer`), 10 por página fijo, `400` ante parámetros ajenos, `404` si no existe el profesor o la materia.

**Módulo Turnos**
- `src/server/turnos/turno.publico.ts`: nueva `listarTurnosFuturosDeProfesorPorMateria()` (aditiva; ver sección propia más abajo).

**Frontend**
- `src/app/(dashboard)/profesores/[id]/materias-profesor-selector.tsx` (nuevo): sección "Materias" del modo edición. Mismo filtro y estilos que HU-D-03; asociadas tildadas y quitables; asociadas inactivas con "Inactiva"; aviso de rechazo con N y "Ver turnos".
- `src/app/(dashboard)/profesores/[id]/ver-turnos-futuros-dialog.tsx` (nuevo): `Dialog` informativo con fecha, hora, aula, cupo "3/5" y `EstadoTurnoBadge`; paginación de a 10; links `target="_blank" rel="noopener noreferrer"`; estados de carga y error; botón "Entendido".
- `src/app/(dashboard)/profesores/[id]/editar-profesor-form.tsx`: integra la sección Materias, el estado "cambios sin guardar" con materias y el orden de guardado materias → datos, con banner de error parcial.
- `src/app/(dashboard)/profesores/[id]/page.tsx`: arma las opciones del selector (activas + asociadas inactivas) y los banners `?actualizada=materias` y `&pendientes=N`.
- `src/app/(dashboard)/profesores/[id]/ficha-materias.tsx`: el link "Asociar materias" pasa a "Editar materias" (`?modo=edicion#materias`).

**Seed (solo agregados)**
- `prisma/seed.ts`: 8 turnos de Giménez + Matemática, profesora Herrera con materia inactiva y un turno PENDIENTE con profesor (flag `pendiente` en `TurnoSeed` y su validación en `validarDatos()`). Detalle en la sección ⚠️ más abajo.

**Docs**
- `docs/tasks/Sprint 2/HU-D-07.md` (nuevo): task con relevamiento, plan, casos CP-D07-xx y §11 de implementación.
- `docs/specs/spec_modulo_D.md` §2.7 y `docs/specs/spec_modulo_C.md` §2.15: notas de sincronización (aditivas, sin renumerar).

**Tests**
- `src/server/profesores/profesor.materias.test.ts` (nuevo): schema y servicio (todo o nada, orden DELETE → conteo, `version`, sin cambios, P2002, horarios intactos).
- `src/server/profesores/actions.materias.test.ts` (nuevo): Server Action.
- `src/app/api/profesores/[id]/materias/route.test.ts` (nuevo): `PUT`.
- `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.test.ts` (nuevo): `GET` del modal.
- `src/app/(dashboard)/profesores/[id]/editar-materias.test.tsx` (nuevo): selector, secuencia de guardado, modal y regresión del bug de scroll.
- `src/server/turnos/turno.publico.test.ts`: 3 casos de la función nueva.

### Criterios de aceptación
- [x] **1. Selector desde la ficha:** en modo edición se muestran las materias asociadas (tildadas) y las activas disponibles, con el filtro y el aspecto de HU-D-03; las asociadas inactivas aparecen con la etiqueta "Inactiva".
- [x] **2. Agregar una o varias:** el `PUT` recibe el conjunto final y agrega en una sola operación con las validaciones de HU-D-03 (`MATERIA_INACTIVA`, `MATERIA_NO_ENCONTRADA`, `PROFESOR_INACTIVO`; los duplicados se evitan por conjunto + `P2002` → `MATERIA_YA_ASOCIADA`).
- [x] **3. Quitar sin turnos futuros:** solo bloquean los turnos `DISPONIBLE`/`COMPLETO` posteriores a ahora (pasados, cancelados y pendientes no bloquean). Ante el rechazo, la casilla vuelve a quedar tildada, aparece "No se puede quitar: el profesor tiene N turnos futuros de esta materia" + "Ver turnos", y el modal lista los turnos paginados de a 10, cada uno con su Detalle de turno en pestaña nueva, donde se cancelan (HU-C-05).
- [x] **4. Mensaje de éxito:** "Materias del profesor actualizadas" al guardar solo materias (texto pendiente de confirmación del PO, ver Pendientes).
- [x] **5. Horarios intactos:** el servicio no lee ni escribe `HorarioProfesor`; verificado en BD (Castro: 8 horarios antes y después).

### Decisiones tomadas
- **Todo o nada:** el guardado de materias corre en una única transacción; si una materia a quitar tiene turnos futuros, no se guarda nada (ni altas ni bajas). Se informan todas las materias bloqueadas juntas.
- **Orden de guardado:** materias primero y datos personales después (son dos endpoints sin transacción común, spec §2.7). Si fallan las materias, los datos no se envían; si las materias salen bien y los datos no, se muestra el banner "Las materias se guardaron, pero los datos no: <error>" y el reintento manda solo los datos.
- **`version`:** el guardado de materias **no** incrementa `Profesor.version`; si lo hiciera, el guardado de datos siguiente daría un conflicto falso.
- **Concurrencia (Regla N.° 7):** dentro de la transacción, primero el `DELETE` del vínculo y después el conteo de turnos. Es la contraparte del `FOR SHARE OF pm` de `profesorActivoDictaMateria(…, tx)`: un turno que se está creando hace esperar a la baja y el conteo lo ve. Verificado con dos transacciones reales.
- **Ruta propia para el modal:** la lista sale de `GET …/turnos-futuros` sobre `listarTurnosFuturosDeProfesorPorMateria()` (spec C §2.15 / D §2.7) y no del listado de HU-C-01, porque ese no filtra por materia, estado ni fecha (HU-C-02 AC6). Mantiene la misma presentación.
- **Link de la ficha:** "Asociar materias" pasa a "Editar materias" (`?modo=edicion#materias`). `/profesores/[id]/materias` (HU-D-03) queda solo para el wizard de alta, que solo agrega.
- **Selector nuevo, sin tocar HU-D-03:** reutiliza `filtrarMaterias()`, `OpcionMateria` y los estilos; `AsociarMateriasForm` no se modificó.
- **Server Action con arreglo, no `FormData`:** el conjunto vacío es válido y `getAll()` no distingue "vacío" de "no enviado".
- **Sin cambios:** si el conjunto enviado es igual al actual, no se escribe nada (`sin_cambios: true`).
- **Profesor inactivo:** la sección Materias se muestra en solo lectura con "Solo pueden asociarse materias a profesores activos".
- **Turnos `PENDIENTE` afectados:** no bloquean, pero se informan (`pendientes_afectados`) con un aviso en el banner de éxito.
- **Baja física:** quitar una materia borra la fila de `ProfesorMateria`; es la excepción a la Regla N.° 1 que ya documenta la spec §2.7 paso 6.

### Bug corregido durante la implementación
En modo edición, el `<legend className="sr-only">` del selector (`position: absolute`, sin ningún ancestro posicionado) tomaba el documento como bloque contenedor. Quedaba fuera del `<main>` que scrollea y del `overflow-hidden` del layout, y estiraba el documento 132 px. Al llegar al final del contenido, el touchpad hacía scrollear `html/body`: desaparecía el header y aparecía el fondo del body; con `#materias` pasaba al cargar. **Fix:** `relative` en la `<section id="materias">` + test de regresión. Verificado midiendo en Chrome headless: el documento queda en 768 px (igual a la ventana) en consulta, edición, `#materias`, aviso de rechazo, modal y banner parcial.

**Pendiente:** el selector de HU-D-03 (`materias/asociar-materias-form.tsx`) tiene el mismo `<legend className="sr-only">` sin ancestro posicionado. Hoy no se nota porque esa pantalla es corta, pero conviene aplicarle el mismo `relative` preventivo (no se tocó en este PR).

### ⚠️ Cambios en el seed (afectan a todo el equipo)
Solo se **agregaron** datos; ningún registro existente cambió.
- **Giménez pasa de 3 a 11 turnos futuros de Matemática** (`seed-turno-28` a `seed-turno-35`, días operativos 8 a 15, 08:00, Aula 1). Quien tenga pruebas o capturas que asuman "Giménez tiene 3 turnos de Matemática" debe actualizarlas.
- **Profesora nueva Herrera, Mariana** (DNI 32200022, activa, sin cuenta) con Química y "Historia de la Ciencia" (inactiva) asociadas. El listado de profesores pasa de 22 a 23 (sigue en 2 páginas de 20).
- **Turno `seed-turno-36`: PENDIENTE de Castro + Química con profesor asignado** (sin aula ni alumnos). `TurnoSeed` suma el campo opcional `pendiente`, y `validarDatos()` lo valida con las reglas de profesor y lo excluye de las reservas.

👉 **Hay que volver a correr el seed:** `npx prisma db seed`.

### Cambios en el módulo Turnos
Solo se **agregó** `listarTurnosFuturosDeProfesorPorMateria()` en `src/server/turnos/turno.publico.ts`; no se modificó nada existente.
- Usa el mismo criterio de "turno futuro" que `contarTurnosFuturosDeProfesorPorMateria()` (`DISPONIBLE`/`COMPLETO` con `fecha + hora_inicio` > ahora en Buenos Aires), así el total del modal coincide con el N del aviso.
- Orden fecha → hora → `idTurno`, paginada, con `$queryRaw` parametrizado.
- El formato `"3/5"` (y `"Sin asignar"`) está **copiado** de `presentar()` de `turno.service.ts`: no se puede importar porque es privada, y el público no puede importar ese archivo (`publico.aislamiento.test.ts`, Regla N.° 3).

Pido revisión a @<responsable de Turnos>.

### Cómo probar
Precondición: `npx prisma db seed` recién corrido; sesión de **mesa.entrada@noctium.local** / `Password123!`.

1. **Caso feliz:** Profesores → **Castro, Julián** → «Editar» (o "Editar materias"). Destildar **Matemática** (solo tiene un turno cancelado) → "Guardar cambios" → banner "Materias del profesor actualizadas". Los horarios de atención de la ficha quedan iguales (8 intervalos).
2. **Rechazo + paginación:** **Giménez, Laura** → modo edición → destildar **Matemática** → Guardar → la casilla vuelve a quedar tildada y aparece "No se puede quitar: el profesor tiene **11** turnos futuros de esta materia" → "Ver turnos" → modal con "Mostrando 1–10 de 11" → página 2 con 1 turno → "Ver detalle" abre el Detalle de turno en una **pestaña nueva** → "Entendido" cierra.
3. **Todo o nada:** **Castro** → tildar **Inglés Técnico** y destildar **Física** → Guardar → rechazo por Física (N = 1) y **no se guarda nada**: al recargar, Castro sigue sin Inglés Técnico.
4. **Flujo completo:** **Acuña, Sergio** → destildar **Programación I** → Guardar → rechazo (N = 1) → "Ver turnos" → "Ver detalle" (pestaña nueva) → "Cancelar turno" → volver a la ficha → "Guardar cambios" de nuevo → éxito (el turno pasado de Acuña no bloquea).
5. **Permisos:** con **gerente@noctium.local**, `PUT /api/profesores/{id}/materias` y `GET /api/profesores/{id}/materias/{materiaId}/turnos-futuros` → **403 SIN_PERMISO**; sin sesión → **401**.

Extra: **Herrera, Mariana** muestra "Historia de la Ciencia" tildada con "Inactiva", y guardar sin tocarla no da error.

### Verificación
- `npx tsc --noEmit`: ✅ 0 errores.
- `npx eslint`: ✅ 0 errores, 0 warnings.
- `npx next build`: ✅ OK.
- `npx vitest run`: ✅ **99 archivos y 1375 tests** en verde (antes de la HU: 94 archivos y 1300 tests; +75 tests nuevos). **11 archivos y 58 tests omitidos**: los `*.pg.test.ts`, que necesitan base de prueba configurada (igual que antes).
- Contra la base y el servidor reales (seed recién corrido; servicios por script y rutas por HTTP con login real), probé:
  - el rechazo de Giménez (N = 11 y N = 4, con rollback);
  - el todo o nada de Castro;
  - el flujo completo de Acuña;
  - la inactiva asociada de Herrera;
  - `MATERIA_INACTIVA` y `PROFESOR_INACTIVO`;
  - concurrencia con dos transacciones;
  - 403 y 401.
- Cobertura de casos: 23 de 25 CP-D07-xx cubiertos; CP-12 y CP-19 parciales (falta recorrerlos en navegador). Detalle en la task §11.4.

### Evidencias
![CP-D07-01 – Selector de materias precargado en modo edición](...)
![CP-D07-09 – Modal "Ver turnos"](...)
![CP-D07-12 – Flujo completo: rechazo → cancelar → reintento](...)
![CP-D07-19 – Cancelar con cambios de materias sin guardar](...)

### Pendientes
- **PO:** mensaje del criterio 4. Se usa "Materias del profesor actualizadas" (literal del AC); la spec §2.7 dice «Materias asignadas correctamente». Si se elige el de la spec, se cambia una constante en `profesores/[id]/page.tsx`.
- **PO:** texto del aviso de turnos pendientes afectados ("Atención: hay N turnos pendientes de las materias quitadas que no van a poder confirmarse con este profesor.").
- **Auditoría de bajas (Regla N.° 2):** no queda registro de qué materia se quitó ni quién lo hizo materia por materia (solo `Profesor.modificadoPorUsuarioId`/`updatedAtProfesor`). No se creó tabla nueva; requiere decisión de PO/SM.
- **Dos pestañas guardando materias a la vez:** una pestaña desactualizada puede volver a asociar una materia que otra quitó (aceptado por la spec).
- **Revisión del responsable de Turnos** por el agregado en `turno.publico.ts`.
- **Fix preventivo** del `legend sr-only` en el selector de HU-D-03.
- **SM:** estimación (5 vs 2 SP en `HU-Sprint-2.md`) y nota del backlog sobre `profesores:crear`.

## ❔ Modificación de archivos esenciales
¿Se modificó?
- [ ] schema.prisma
- [x] seed.ts

## 🔗 Vinculación con GitHub Projects (Automatización)

Closes #<número de issue de HU-D-07>
