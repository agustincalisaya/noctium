# TASK: HU-L-01 — Registrar materia

**Módulo:** L (Materias)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_L.md` sección 2.1 · reglas sección 3.1, 3.2, 3.3 · eventos sección 4 · `docs/tasks/HU-Sprint-1.md` HU-L-01, criterio de aceptación 6 (Cancelar con confirmación condicional)
**RBAC:** requiere el permiso `materias:crear`, exclusivo del rol Gerente. Se registra como una fila nueva en `RolPermiso` (mecanismo creado en HU-A-02) — esta es la **primera acción real** que puebla esa tabla más allá del placeholder `sesion:ping`.
**Schema:** agrega vía migración nueva el modelo `Materia` (`id`, `nombre`, `nombre_normalizado`, `codigo` nullable, `is_active`, `created_at`, `created_by`), con constraints únicos sobre `nombre_normalizado` y `codigo`. Depende de `Usuario`/`RolUsuario` (HU-A-01) y de `RolPermiso`/`withPermission()` (HU-A-02), ya existentes.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno) — en particular el seed de `RolPermiso`, que pasa a incluir `materias:crear`.
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance

Esta es la primera task de un módulo nuevo (L) y la primera vez que se usa `withPermission()` (HU-A-02) con una acción real de negocio en lugar del placeholder `sesion:ping`. No depende de HU-L-02 (listado) ni al revés — son independientes entre sí, cada una cubre un endpoint distinto sobre el mismo modelo `Materia`.

`spec_modulo_L.md` §3.3 deja explícito que `Materia` no tiene campo de duración en este sprint (ese dato vive en `spec_modulo_C.md` como parámetro del centro). Esta task no introduce ningún campo de duración bajo ninguna circunstancia, aunque parezca una omisión al construir el formulario.

**Fuera de alcance de esta task (explícito):**
- Modificación de una materia ya registrada — no está contractualizada en `spec_modulo_L.md` para este sprint.
- Baja lógica / reactivación de materias — misma razón.
- Asociación de una materia a un profesor (`ProfesorMateria`) — pertenece a `spec_modulo_D.md` (HU-D-03), que además es quien define esa tabla; esta task no la crea ni la toca.
- Listado y detalle de materias — HU-L-02, task separada.

---

## 2. Historia de Usuario

**Como** Gerente del centro
**Necesito** registrar una nueva materia en el catálogo
**Para** que pueda asociarse a profesores y usarse al configurar turnos

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_L.md` §2.1. Incluye:
- Migración nueva: modelo `Materia`.
- Utilidad compartida `normalizarTexto()` en `lib/utils/normalizar-texto.ts`, **si todavía no existe** (es de uso transversal — también la necesitará HU-K-01 de Aulas; se crea acá por ser la primera task que la requiere, y HU-K-01 la reutiliza sin reimplementarla).
- Capa de servicios (`lib/services/materias/materia.service.ts` → `crearMateria()`).
- Schema Zod (`lib/schemas/materias.schema.ts` → `CrearMateriaSchema`).
- Route Handler (`app/api/materias/route.ts`, método `POST`) y Server Action equivalente (`crearMateria()` en `app/(dashboard)/materias/actions.ts`).
- Agregar `materias:crear` al seed de `RolPermiso`, asignado al rol Gerente.
- Emisión del evento `materia:creada`.
- UI: formulario de alta de materia, con botón "Cancelar" y confirmación condicional por datos ingresados.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Cualquier campo de duración en `Materia`.
- Modificación o baja de materias.
- Asociación a profesores.
- Listado (`GET`) — HU-L-02.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `lib/schemas/materias.schema.ts`

```typescript
export const CrearMateriaSchema = z.object({
  nombre: z.string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar los 80 caracteres")
    .transform((v) => v.replace(/\s+/g, " ")),
  codigo: z.string()
    .trim()
    .max(10, "El código no puede superar los 10 caracteres")
    .regex(/^[A-Za-z0-9]+$/, "El código admite solo letras y números, sin espacios")
    .transform((v) => v.toUpperCase())
    .optional(),
});
export type CrearMateriaInput = z.infer<typeof CrearMateriaSchema>;
```

### 4.2. Servicio

**Archivo:** `lib/services/materias/materia.service.ts`
**Función:** `crearMateria(input: CrearMateriaInput, usuarioId: string): Promise<Materia>`

Comportamiento exigido, en este orden (`spec_modulo_L.md` §2.1, dentro de una única `prisma.$transaction` — Regla N.° 2 de `docs/RULES.md`):
1. Calcular `nombre_normalizado = normalizarTexto(input.nombre)`.
2. Verificar unicidad aplicativa de `nombre_normalizado` contra **todas** las materias, activas e inactivas (sin filtro `is_active`). Si existe → `409 NOMBRE_DUPLICADO`, mensaje indicando si la existente está inactiva.
3. Si vino `codigo`: verificar unicidad aplicativa análoga (también sin filtrar por `is_active`). Si existe → `409 CODIGO_DUPLICADO`.
4. Insertar con `is_active: true`, `nombre`, `nombre_normalizado`, `codigo` (o `null`), `created_by: usuarioId`.
5. **Defensa adicional:** capturar `P2002` (violación de constraint único de Prisma sobre `nombre_normalizado`/`codigo`) y traducirla al mismo shape `409` que los pasos 2/3 — nunca propagar el error técnico crudo.
6. Commit.
7. **Después del COMMIT:** emitir `materia:creada` (sección 4.5).

**Errores de servicio a definir:** `NOMBRE_DUPLICADO`, `CODIGO_DUPLICADO`.

### 4.3. Route Handler

**Archivo:** `app/api/materias/route.ts`
**Método:** `POST`
**Permiso de acceso:** `withPermission("materias:crear")`

### 4.4. Server Action

**Archivo:** `app/(dashboard)/materias/actions.ts`
**Función:** `crearMateria()` — wrapper delgado sobre el servicio (validar sesión y permiso, invocar `CrearMateriaSchema.safeParse()`, invocar el servicio, `revalidatePath("/materias")`).

### 4.5. Eventos de dominio

**Archivo:** `lib/events/event-types.ts` — agregar `materia:creada` si no está ya declarado desde la spec.
**Listener de auditoría:** handler en `audit-log.listener.ts`, patrón `void registrarAuditLog(...)` — nunca `await`.

Payload: `materia_id, nombre, codigo, usuario_id` — emitido después del `COMMIT`, nunca dentro de la transacción.

---

## 5. Frontend

- Formulario de alta (`app/(dashboard)/materias/nueva/page.tsx` o modal desde el listado, según se resuelva en HU-L-02 — **punto abierto, relevar antes de implementar:** ¿página dedicada o modal? Como HU-L-02 (listado) puede no estar implementada todavía al momento de esta task, se propone una página dedicada por simplicidad, integrable después como modal si el equipo lo prefiere una vez exista el listado.
- Campos Nombre (obligatorio) y Código (opcional), con las mismas reglas de `CrearMateriaSchema` validadas en cliente antes de enviar.
- Mensajes de error inline específicos por campo: `NOMBRE_DUPLICADO` y `CODIGO_DUPLICADO` se muestran junto al campo correspondiente, no como error genérico de formulario.
- Botón deshabilitado con indicador de carga mientras se procesa.
- Tras éxito: redirect o cierre de modal (según lo resuelto arriba) con confirmación visual.
- **Botón "Cancelar" (`HU-Sprint-1.md`, HU-L-01, criterio de aceptación 6):** vuelve al listado de materias sin guardar. Si hay datos ya ingresados en el formulario (nombre y/o código no vacíos), solicita confirmación antes de descartar — mismo patrón de "¿Estás seguro?" que HU-A-03 introduce para el logout con formularios abiertos; **relevar antes de implementar** si conviene reutilizar el mismo mecanismo de detección de "cambios sin guardar" que se defina ahí (si HU-A-03 ya está implementada al momento de esta task) o resolverlo acá de forma local y simple (estado de formulario `dirty` acotado a esta página, sin depender de un mecanismo transversal).
- Gateado por permiso: el enlace/botón "Nueva materia" solo se muestra si el rol de la sesión es Gerente — pero la verificación real es la del Route Handler (`withPermission`), esto es solo ocultamiento de UI.

**Fuera de alcance de frontend:** listado de materias (HU-L-02).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- Alta exitosa con nombre y código válidos → retorna la materia creada con `is_active: true`.
- Alta exitosa sin código (opcional) → `codigo: null`.
- Nombre duplicado contra una materia **activa** → `409 NOMBRE_DUPLICADO`.
- Nombre duplicado contra una materia **inactiva** → `409 NOMBRE_DUPLICADO` igual (criterio de unicidad sobre el universo completo).
- Mismo nombre con distinta capitalización/acentos (`"matematica"` vs `"Matemática"`) → detectado como duplicado por `normalizarTexto()`.
- Código duplicado (mayúsculas/minúsculas indistintas por el `.transform()` del schema) → `409 CODIGO_DUPLICADO`.
- Simular `P2002` en el `INSERT` (condición de carrera, mock de Prisma) → se traduce al mismo `409` que la validación aplicativa, nunca un 500 crudo.
- Evento `materia:creada` emitido después del `COMMIT`, no antes (mock/spy).

### Nivel 2 — Postman
- Alta exitosa (rol Gerente) → `201`, cuerpo conforme spec.
- Alta con rol distinto de Gerente (p. ej. Profesor) → `403 SIN_PERMISO`, sin crear la fila.
- Alta con nombre duplicado → `409 NOMBRE_DUPLICADO`.
- Alta con código duplicado → `409 CODIGO_DUPLICADO`.
- Alta con nombre de 1 caracter → `400`, error de validación Zod.

### Nivel 3 — BD / TablePlus
- Verificar la fila creada en `Materia` (`nombre`, `nombre_normalizado`, `codigo`, `is_active: true`, `created_by`).
- Verificar que el constraint único de `nombre_normalizado` y de `codigo` existen efectivamente en el schema (no solo la validación aplicativa).
- Verificar en `AuditLog` que `materia:creada` quedó encadenado con hash SHA-256 intacto.
- Verificar en `RolPermiso` que `materias:crear` quedó sembrado para el rol Gerente únicamente.

**Evidencia esperada:** Postman + SQL para el contrato de API y capa de datos; capturas del formulario de alta en sus estados (normal, error de duplicado, cargando, confirmación de "Cancelar" con datos ingresados).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] Punto abierto de la sección 5 (página dedicada vs. modal para el formulario) resuelto.
- [ ] Punto abierto de la sección 5 (mecanismo de detección de "cambios sin guardar" para el botón Cancelar) resuelto.
- [ ] Service, Route Handler y Server Action implementados, sin lógica de negocio fuera de `materia.service.ts`.
- [ ] `normalizarTexto()` implementada como utilidad compartida y reutilizable (no acoplada a `Materia`), lista para que HU-K-01 la reutilice.
- [ ] Endpoint responde con el shape estándar `{ data, error }` y status codes semánticos.
- [ ] Doble validación de unicidad (aplicativa + `P2002`) implementada para `nombre` y `codigo`.
- [ ] Evento `materia:creada` emitido tras `COMMIT`, nunca dentro de la transacción.
- [ ] Frontend funcional: formulario con validación, mensajes de error específicos por campo, botón Cancelar con confirmación condicional, gateado por permiso.
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Tests de los 3 niveles documentados con evidencia.
- [ ] PR con diff acotado exclusivamente a esta HU.