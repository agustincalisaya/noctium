# TASK: HU-K-01 — Registrar aula

**Módulo:** K (Aulas)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_K.md` sección 2.1 · reglas sección 3.1, 3.3 · eventos sección 4 · `docs/tasks/HU-Sprint-1.md` HU-K-01, criterio de aceptación 6 (botón Cancelar)
**RBAC:** requiere el permiso `aulas:crear`, exclusivo del rol Gerente. Se agrega al seed de `RolPermiso` (mecanismo creado en HU-A-02).
**Schema:** agrega vía migración nueva el modelo `Aula` (`id`, `nombre`, `nombre_normalizado`, `capacidad`, `is_active`, `created_at`, `created_by`), con constraint único sobre `nombre_normalizado`. Depende de `Usuario`/`RolUsuario` (HU-A-01) y de `RolPermiso`/`withPermission()` (HU-A-02), ya existentes.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno) — en particular el seed de `RolPermiso`, que pasa a incluir `aulas:crear`.
- Si `lib/utils/normalizar-texto.ts` ya existe (creada en HU-L-01) o si esta task es la que la crea — con la pregunta concreta, nunca resuelto por inferencia propia del agente.
- Todo otro punto marcado en esta task como **"relevar antes de asumir"**.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance

Esta task reutiliza `normalizarTexto()` (`lib/utils/normalizar-texto.ts`), la misma utilidad compartida que HU-L-01 creó para Materias — `spec_modulo_K.md` §2.1 es explícito en que no debe reimplementarse una comparación más limitada solo para Aulas. Si al momento de ejecutar esta task HU-L-01 todavía no está implementada y la utilidad no existe, esta task la crea (mismo comportamiento: minúsculas + sin diacríticos), dejándola igualmente reutilizable para cuando HU-L-01 se implemente.

No depende de HU-K-02 (listado) ni al revés — son independientes entre sí, cada una cubre un endpoint distinto sobre el mismo modelo `Aula`. Tampoco depende de `spec_modulo_C.md` (Turno/HU-C-15): registrar un aula es solo crear el recurso, nunca asignarlo — ver Fuera de alcance.

**Fuera de alcance de esta task (explícito):**
- Modificación de un aula ya registrada — no está contractualizada en `spec_modulo_K.md` para este sprint.
- Baja lógica / reactivación de aulas — misma razón.
- Cualquier lógica de disponibilidad por horario o asignación a un turno — pertenece exclusivamente a `spec_modulo_C.md` (HU-C-15, fuera de las HU asignadas a esta persona). Esta task no debe anticipar ni un campo ni un endpoint relacionado.
- Listado y detalle de aulas — HU-K-02, task separada.
- La collation `natural_es` sobre la columna `nombre` — esa migración pertenece a HU-K-02 (es lo que hace el orden natural en el listado posible; el alta no la necesita para insertar, así que no se adelanta acá salvo que el relevamiento determine que conviene aplicarla en la misma migración que crea la tabla, por practicidad — **punto abierto, ver más abajo**).

**Punto abierto — ¿aplicar la collation `natural_es` en la migración de esta task o en la de HU-K-02? (relevar antes de implementar):** `spec_modulo_K.md` §2.2 define la collation como parte del comportamiento de listado (HU-K-02), pero técnicamente es una propiedad de la columna `nombre`, que esta task es la que crea. Aplicarla acá evitaría una segunda migración que altera un tipo de columna ya poblado con datos; aplicarla en HU-K-02 mantiene el diff de esta task estrictamente acotado a lo que su propia HU pide. **Se propone aplicarla en esta task** (crear la columna ya con la collation correcta desde el origen, evitando un `ALTER COLUMN` posterior sobre datos existentes), documentándolo como una decisión de schema que se adelanta por practicidad — a confirmar con el equipo antes de implementar.

---

## 2. Historia de Usuario

**Como** Gerente del centro
**Necesito** registrar una nueva aula con su capacidad
**Para** que pueda asignarse a turnos una vez agendados

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_K.md` §2.1. Incluye:
- Migración nueva: modelo `Aula` (y, sujeto al punto abierto de la sección 1, la collation `natural_es` aplicada a `nombre` desde el origen).
- Reutilización (o creación, si no existe todavía) de `normalizarTexto()` en `lib/utils/normalizar-texto.ts`.
- Capa de servicios (`lib/services/aulas/aula.service.ts` → `crearAula()`).
- Schema Zod (`lib/schemas/aulas.schema.ts` → `CrearAulaSchema`).
- Route Handler (`app/api/aulas/route.ts`, método `POST`) y Server Action equivalente (`crearAula()` en `app/(dashboard)/aulas/actions.ts`).
- Agregar `aulas:crear` al seed de `RolPermiso`, asignado al rol Gerente.
- Emisión del evento `aula:creada`.
- UI: formulario de alta de aula, con botón "Cancelar".

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Modificación o baja de aulas.
- Cualquier campo o lógica de disponibilidad/asignación a turnos.
- Listado (`GET`) — HU-K-02.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `lib/schemas/aulas.schema.ts`

```typescript
export const CrearAulaSchema = z.object({
  nombre: z.string()
    .trim()
    .min(1, "El nombre o número del aula es obligatorio")
    .max(30, "El nombre no puede superar los 30 caracteres")
    .transform((v) => v.replace(/\s+/g, " ")),
  capacidad: z.coerce.number()
    .int("La capacidad debe ser un número entero")
    .positive("La capacidad debe ser mayor a cero"),
});
export type CrearAulaInput = z.infer<typeof CrearAulaSchema>;
```

### 4.2. Servicio

**Archivo:** `lib/services/aulas/aula.service.ts`
**Función:** `crearAula(input: CrearAulaInput, usuarioId: string): Promise<Aula>`

Comportamiento exigido, en este orden (`spec_modulo_K.md` §2.1, dentro de una única `prisma.$transaction` — Regla N.° 2 de `docs/RULES.md`):
1. Calcular `nombre_normalizado = normalizarTexto(input.nombre)`.
2. Verificar unicidad aplicativa de `nombre_normalizado` contra **todas** las aulas, activas e inactivas. Si existe → `409 NOMBRE_DUPLICADO`.
3. Insertar con `is_active: true`, `nombre`, `nombre_normalizado`, `capacidad`, `created_by: usuarioId`.
4. **Defensa adicional:** capturar `P2002` (violación de constraint único sobre `nombre_normalizado`) y traducirla al mismo `409` que el paso 2 — nunca propagar el error técnico crudo.
5. Commit.
6. **Después del COMMIT:** emitir `aula:creada` (sección 4.5).

El alta no toca ninguna tabla relacionada a `Turno` bajo ninguna circunstancia (Regla de negocio 3.3 de la spec).

**Errores de servicio a definir:** `NOMBRE_DUPLICADO`.

### 4.3. Route Handler

**Archivo:** `app/api/aulas/route.ts`
**Método:** `POST`
**Permiso de acceso:** `withPermission("aulas:crear")`

### 4.4. Server Action

**Archivo:** `app/(dashboard)/aulas/actions.ts`
**Función:** `crearAula()` — wrapper delgado sobre el servicio (validar sesión y permiso, invocar `CrearAulaSchema.safeParse()`, invocar el servicio, `revalidatePath("/aulas")`).

### 4.5. Eventos de dominio

**Archivo:** `lib/events/event-types.ts` — agregar `aula:creada` si no está ya declarado desde la spec.
**Listener de auditoría:** handler en `audit-log.listener.ts`, patrón `void registrarAuditLog(...)` — nunca `await`.

Payload: `aula_id, nombre, capacidad, usuario_id` — emitido después del `COMMIT`, nunca dentro de la transacción.

---

## 5. Frontend

- Formulario de alta (`app/(dashboard)/aulas/nueva/page.tsx` — mismo patrón de página dedicada usado en HU-L-01, por consistencia, salvo que ese punto abierto se haya resuelto distinto).
- Campos Nombre/Número (obligatorio) y Capacidad (obligatorio, entero positivo), con las mismas reglas de `CrearAulaSchema` validadas en cliente antes de enviar.
- Mensaje de error inline específico junto al campo Nombre para `NOMBRE_DUPLICADO`.
- Botón deshabilitado con indicador de carga mientras se procesa.
- Tras éxito: redirect con confirmación visual.
- **Botón "Cancelar" (`HU-Sprint-1.md`, HU-K-01, criterio de aceptación 6):** vuelve al listado de aulas sin guardar. A diferencia de HU-L-01 (Materias), esta HU **no** exige confirmación condicional por datos ingresados — el criterio de aceptación de Aulas es más simple ("'Cancelar' vuelve al listado sin guardar", sin la cláusula de confirmación que sí tiene Materias) — implementar el botón como una navegación directa, sin diálogo intermedio.
- Gateado por permiso: el enlace/botón "Nueva aula" solo se muestra si el rol de la sesión es Gerente — la verificación real es la del Route Handler.
- Estilos: seguir `docs/DESIGN.md`. Usar exclusivamente tokens (`bg-primary`, `text-muted-foreground`, `bg-brand-accent`, `bg-success`, `bg-warning`, etc.). Prohibido usar colores hex o la paleta default de Tailwind (`blue-600`, `emerald-100`, etc.).

**Fuera de alcance de frontend:** listado de aulas (HU-K-02); cualquier referencia a turnos o disponibilidad.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- Alta exitosa con nombre y capacidad válidos → retorna el aula creada con `is_active: true`.
- Nombre duplicado contra un aula **activa** → `409 NOMBRE_DUPLICADO`.
- Nombre duplicado contra un aula **inactiva** → `409 NOMBRE_DUPLICADO` igual (criterio de unicidad sobre el universo completo).
- Mismo nombre con distinta capitalización (`"aula 3"` vs `"Aula 3"`) → detectado como duplicado por `normalizarTexto()`.
- Capacidad no entera o ≤ 0 → error de validación Zod, nunca llega al servicio.
- Simular `P2002` en el `INSERT` (condición de carrera, mock de Prisma) → se traduce al mismo `409` que la validación aplicativa, nunca un 500 crudo.
- Verificar explícitamente que `crearAula()` no escribe ni consulta ninguna tabla relacionada a `Turno`.
- Evento `aula:creada` emitido después del `COMMIT`, no antes (mock/spy).

### Nivel 2 — Postman
- Alta exitosa (rol Gerente) → `201`, cuerpo conforme spec.
- Alta con rol distinto de Gerente → `403 SIN_PERMISO`, sin crear la fila.
- Alta con nombre duplicado → `409 NOMBRE_DUPLICADO`.
- Alta con capacidad `0` o negativa → `400`, error de validación Zod.

### Nivel 3 — BD / TablePlus
- Verificar la fila creada en `Aula` (`nombre`, `nombre_normalizado`, `capacidad`, `is_active: true`, `created_by`).
- Verificar que el constraint único de `nombre_normalizado` existe efectivamente en el schema.
- Si se confirmó aplicar la collation `natural_es` en esta task (punto abierto de la sección 1): verificar que la columna `nombre` de `Aula` quedó con esa collation desde la creación.
- Verificar en `AuditLog` que `aula:creada` quedó encadenado con hash SHA-256 intacto.
- Verificar en `RolPermiso` que `aulas:crear` quedó sembrado para el rol Gerente únicamente.

**Evidencia esperada:** Postman + SQL para el contrato de API y capa de datos; capturas del formulario de alta en sus estados (normal, error de duplicado, cargando, y del botón Cancelar).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar, incluyendo el estado real de `normalizarTexto()`.
- [ ] Punto abierto de la sección 1 (collation `natural_es` en esta migración vs. en la de HU-K-02) resuelto y documentado como "DECISIÓN RESUELTA".
- [ ] Service, Route Handler y Server Action implementados, sin lógica de negocio fuera de `aula.service.ts`.
- [ ] `normalizarTexto()` reutilizada tal cual (no reimplementada) si ya existía por HU-L-01.
- [ ] Endpoint responde con el shape estándar `{ data, error }` y status codes semánticos.
- [ ] Doble validación de unicidad (aplicativa + `P2002`) implementada para `nombre`.
- [ ] Evento `aula:creada` emitido tras `COMMIT`, nunca dentro de la transacción.
- [ ] Ninguna referencia a `Turno` introducida en esta task (Regla de negocio 3.3).
- [ ] Frontend funcional: formulario con validación, mensaje de error específico de duplicado, botón Cancelar sin confirmación intermedia, gateado por permiso.
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Tests de los 3 niveles documentados con evidencia.
- [ ] UI sin colores hardcodeados: solo tokens definidos en `docs/DESIGN.md`.
- [ ] PR con diff acotado exclusivamente a esta HU.