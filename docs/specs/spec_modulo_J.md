```markdown
# Especificación Técnica — Módulo J (Calendario)
## Noctium — Sprint 1

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 10) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_C.md` (Turno, único dueño del dato) · `spec_modulo_D.md` (Profesor) · `spec_modulo_L.md` (Materias) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md`

**HU contractualizadas en esta revisión:** HU-J-01 (Calendario por profesor), HU-J-02 (Calendario por materia) — Sprint 1.

**Fuera de alcance de esta spec (explícito):**
- Vistas por día o por mes (solo vista semanal este sprint).
- Filtros combinados (ej. profesor + materia a la vez).

---

## 1. Visión General

El Módulo J es **exclusivamente de lectura**: no crea, modifica ni transiciona ningún dato. Ofrece dos vistas semanales de solo consulta sobre los turnos ya `AGENDADO` que gestiona `spec_modulo_C.md` — por profesor (HU-J-01) y por materia (HU-J-02). No expone ningún endpoint de escritura, y por eso no tiene sección de Reglas de Negocio orientadas a mutación ni eventos de dominio propios (sección 4).

**Regla central, compartida con `spec_modulo_C.md` §3.2:** un turno `PENDIENTE` no reserva recursos y, en consecuencia, **nunca aparece en ningún calendario** — ambas vistas de este módulo filtran exclusivamente `estado: "AGENDADO"`.

**Aislamiento de dominio (Regla N.° 3):** este módulo no consulta la tabla `Turno` directamente. Consume los servicios públicos de `spec_modulo_C.md`:
- `listarTurnosAgendadosPorProfesor(profesorId, semanaInicio, semanaFin)`
- `listarTurnosAgendadosPorMateria(materiaId, semanaInicio, semanaFin, profesorId?)` — el parámetro `profesorId` opcional es el filtro que usa este módulo cuando quien consulta es un Profesor (ver 2.2).

**Nota de trazabilidad (gap a resolver en revisión futura):** ninguna de las dos funciones anteriores está contractualizada todavía en `spec_modulo_C.md` (que solo define alta, asignación y listado propio, sección 2 de esa spec). Corresponde agregarlas como sección aditiva en una futura revisión de `spec_modulo_C.md` — se documentan acá solo como el contrato que este módulo consume, siguiendo el mismo patrón de gap ya declarado en `spec_modulo_C.md` respecto de `spec_modulo_B.md`/`spec_modulo_D.md`.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Profesor`, `Materia` y `Turno`, incluidos `[profesorId]`, `[materiaId]` y `turno_id`, son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo.
- Toda ruta requiere `withPermission("calendario:leer")` (Regla N.° 10) — disponible para Mesa de Entrada, Gerente y Profesor, con el alcance acotado por rol que describe cada sección.
- Ambas vistas abren, por defecto, en la semana actual; el rango se expresa siempre como `[lunes, sábado]` del `DIAS_OPERATIVOS` vigente (mismo parámetro de `spec_modulo_D.md`/`spec_modulo_C.md`).

---

### 2.1. Calendario semanal por profesor (HU-J-01)

**Ruta:** `GET /app/api/calendario/profesor/[profesorId]/route.ts`
**Permiso requerido:** `calendario:leer`

```typescript
export const ConsultarCalendarioProfesorQuerySchema = z.object({
  semana_inicio: fechaCalendarioValidaSchema.optional(), // lunes de la semana a consultar; si se omite, semana actual
});
export type ConsultarCalendarioProfesorQuery = z.infer<typeof ConsultarCalendarioProfesorQuerySchema>;
```

**Comportamiento esperado:**
1. **Resolución del `profesorId` efectivo, según rol de la sesión:**
   - Rol `PROFESOR`: el servidor **ignora cualquier `profesorId` que no sea el propio** y siempre resuelve la agenda a partir de `Profesor.usuario_id === session.sub` (nunca confía en el parámetro de la URL para decidir de quién es la agenda). Si el `profesorId` de la ruta no coincide con el propio: `403 SIN_PERMISO`, sin revelar si ese otro profesor existe o tiene turnos — el mismo principio de neutralidad de `spec_modulo_A.md` §3.2, aplicado acá a nivel de autorización de datos.
   - Rol `MESA_ENTRADA` o `GERENTE`: usan el `profesorId` de la ruta libremente; debe corresponder a un profesor activo (`404 PROFESOR_NO_ENCONTRADO` en caso contrario).
2. Calcular `semana_inicio`/`semana_fin` (si no viene `semana_inicio`, se usa el lunes de la semana actual del servidor).
3. Invocar `listarTurnosAgendadosPorProfesor(profesorId, semanaInicio, semanaFin)` — filtra `estado: "AGENDADO"` exclusivamente (regla central, sección 1).
4. Cada evento del resultado incluye: `hora_inicio`, `hora_fin`, `alumno` (`"Apellido, Nombre"`), `materia`, `aula`, `estado` (siempre `"AGENDADO"` en este listado, se incluye igual para que la UI lo muestre con texto/ícono, no solo color). No hay diferencias de campos mostrados entre los roles autorizados en este sprint — la frase "según permisos del rol" del criterio de aceptación se refiere al acceso mismo (paso 1), no a una vista con campos distintos por rol.
5. Si no hay turnos en el rango: se devuelve `eventos: []` — el mensaje "Agenda sin turnos" es responsabilidad de la UI ante una lista vacía, no un código de error.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "profesor": { "id": "cuid", "nombre_completo": "Gómez, Ana" },
    "rango": { "desde": "2026-04-06", "hasta": "2026-04-11" },
    "eventos": [
      { "turno_id": "cuid", "fecha": "2026-04-07", "hora_inicio": "10:00", "hora_fin": "11:00",
        "alumno": "Pérez, Ana", "materia": "Matemática", "aula": "Aula 2", "estado": "AGENDADO" }
    ]
  },
  "error": null
}
```

**Respuesta `403 Forbidden` (profesor intentando ver otra agenda):**
```json
{ "data": null, "error": { "code": "SIN_PERMISO", "message": "No tenés permisos para acceder a esta sección" } }
```

**Nota de sincronización (HU-J-01, implementación):**
- **Rango por días operativos:** la semana se calcula de lunes a domingo en `America/Argentina/Buenos_Aires` y el rango va del primer al último día de `dias_operativos` (no un `[lunes, sábado]` fijo). Con la configuración actual del seed (`LUNES`–`VIERNES`) el rango es lunes–viernes; con `LUNES`–`SABADO` coincidiría exactamente con lo escrito arriba. `semana_inicio` puede ser cualquier día: se normaliza al lunes de su semana.
- **Profesor sin ficha vinculada** a su cuenta: `403 SIN_PERMISO` (no tiene agenda propia).
- **Turnos grupales:** `alumno` se mantiene como string; si el turno tiene más de un alumno se unen como `"Apellido, Nombre; Apellido, Nombre"`.
- **Lectura de turnos:** `listarTurnosAgendadosPorProfesor()` todavía no existe en el módulo C. Por decisión de equipo, HU-J-01 no modifica `turno.service.ts`: la consulta de solo lectura vive en `src/server/calendario/calendario.service.ts` (`listarTurnosAgendadosDeProfesor`, rango `[desde, hasta)`, filtro `AGENDADO` en la query), con un `TODO` para reemplazarla por el servicio público del módulo C (excepción temporal a §3.4).
- **Profesor efectivo:** se resuelve con los servicios públicos del módulo D `obtenerOpcionProfesorDeUsuario()` (rol Profesor) y `obtenerOpcionProfesorActivo()` (Mesa/Gerente).

---

### 2.2. Calendario semanal por materia (HU-J-02)

**Ruta:** `GET /app/api/calendario/materia/[materiaId]/route.ts`
**Permiso requerido:** `calendario:leer`

```typescript
export const ConsultarCalendarioMateriaQuerySchema = z.object({
  semana_inicio: fechaCalendarioValidaSchema.optional(),
});
export type ConsultarCalendarioMateriaQuery = z.infer<typeof ConsultarCalendarioMateriaQuerySchema>;
```

**Comportamiento esperado:**
1. Verificar `materiaId` activa (`verificarMateriaActiva()`, Módulo L). Si no: `404 MATERIA_NO_ENCONTRADA`.
2. **Alcance según rol** (mismo principio de resolución server-side que 2.1, nunca vía parámetro de cliente):
   - `MESA_ENTRADA` / `GERENTE`: ven **todos** los turnos agendados de la materia en la semana, de cualquier profesor.
   - `PROFESOR`: ven únicamente los turnos agendados de la materia donde **él mismo** es el profesor asignado — se invoca `listarTurnosAgendadosPorMateria(materiaId, semanaInicio, semanaFin, profesorId: session.sub)`, nunca sin ese filtro.
3. Cada evento incluye: `hora_inicio`, `hora_fin`, `profesor` (`"Apellido, Nombre"`), `alumno`, `aula`, `estado`.
4. **Sin deduplicación ni ocultamiento:** si varios turnos coinciden en el mismo horario con distintos profesores (visible solo para Mesa de Entrada/Gerente, ya que un Profesor solo ve los suyos), el backend devuelve **todos** los eventos tal cual — la disposición "uno junto al otro" en pantalla es responsabilidad exclusiva de la UI, el contrato de datos no oculta ni combina eventos superpuestos.
5. La `materiaId` seleccionada se conserva del lado del cliente al navegar entre semanas y al volver del detalle de un evento (comportamiento de UI, no de este contrato — el backend no tiene estado de navegación).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "materia": { "id": "cuid", "nombre": "Matemática", "codigo": "MAT101" },
    "rango": { "desde": "2026-04-06", "hasta": "2026-04-11" },
    "eventos": [
      { "turno_id": "cuid", "fecha": "2026-04-07", "hora_inicio": "10:00", "hora_fin": "11:00",
        "profesor": "Gómez, Ana", "alumno": "Pérez, Ana", "aula": "Aula 2", "estado": "AGENDADO" },
      { "turno_id": "cuid", "fecha": "2026-04-07", "hora_inicio": "10:00", "hora_fin": "11:00",
        "profesor": "López, Juan", "alumno": "Ruiz, Marcos", "aula": "Aula 5", "estado": "AGENDADO" }
    ]
  },
  "error": null
}
```

---

## 3. Reglas de Negocio Estrictas

Este módulo no tiene capa de servicios de escritura — sus "reglas de negocio" son, en rigor, reglas de **alcance y autorización de lectura**, resueltas en `lib/services/calendario/calendario.service.ts` (capa delgada que orquesta las llamadas a los servicios públicos de `spec_modulo_C.md`, conforme a la Regla N.° 4 de `docs/RULES.md`).

### 3.1. Solo turnos `AGENDADO`
Ninguna consulta de este módulo puede, bajo ningún parámetro o combinación de filtros, devolver un turno `PENDIENTE` — es la misma regla central de `spec_modulo_C.md` §3.2, vista desde el lado de lectura.

### 3.2. El alcance de un Profesor se resuelve siempre en el servidor
Un usuario con rol `PROFESOR` nunca puede obtener datos de una agenda ajena (2.1) ni de turnos de otros profesores dentro de una materia (2.2) manipulando un parámetro de la solicitud — el `profesorId` efectivo sale siempre de `session.sub` vía `spec_modulo_A.md`, nunca de la URL o el body cuando el rol es `PROFESOR`. La UI oculta el selector de profesor para este rol, pero eso no reemplaza esta verificación server-side (mismo principio general de `spec_modulo_A.md` §2.2).

### 3.3. Sin deduplicación de eventos superpuestos
El backend nunca combina, agrupa ni descarta eventos que coincidan en horario — entrega el conjunto completo; cualquier presentación "lado a lado" es una decisión de la capa de UI, no del contrato de datos.

### 3.4. Aislamiento: sin acceso directo a `Turno`
Toda lectura pasa por los servicios públicos de `spec_modulo_C.md` (Regla N.° 3) — este módulo no importa ni consulta el modelo `Turno` de Prisma directamente.

---

## 4. Eventos de Dominio (EDA)

Este módulo **no emite eventos de dominio**: es exclusivamente de lectura, no muta ningún estado que deba auditarse (Regla N.° 2 de `docs/RULES.md` aplica a mutaciones; una consulta de calendario no lo es).
```