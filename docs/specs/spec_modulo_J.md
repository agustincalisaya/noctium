```markdown
# Especificación Técnica — Módulo J (Calendario)
## Noctium — Sprint 1 · Sprint 2 (Revisión 2)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 10) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_C.md` (Turno, único dueño del dato) · `spec_modulo_D.md` (Profesor) · `spec_modulo_L.md` (Materias) · `spec_modulo_C.md` Revisión 5 (prioridad y estado `CANCELADO`, §2.12 y §3.9) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§1, §4)

**HU contractualizadas en esta revisión:** HU-J-01 (Calendario por profesor), HU-J-02 (Calendario por materia) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-J-03 (Ver calendario en formato día, semana o mes).

**Changelog — Revisión 2 (Sprint 2):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-J-03 | Gap — "Vistas por día o por mes" figuraba como fuera de alcance | Nueva sección 2.3 (aditiva, no renumera). Amplía 2.1 y 2.2 con `vista` y `fecha` |
| `eventos[]` | `hora_inicio`, `hora_fin`, `alumno`, `materia`, `aula`, `estado` | + `prioridad` (indicador de HU-C-10) |
| Estado `CANCELADO` | No existía | Sin cambio de código: 3.1 ya filtra `DISPONIBLE`/`COMPLETO` (`spec_modulo_C.md` §3.9) |
| Permisos | `calendario:leer` | Sin cambios |

**Fuera de alcance de esta spec (explícito):**
- Vistas por día o por mes (solo vista semanal este sprint).
- Filtros combinados (ej. profesor + materia a la vez).

**Actualización de alcance — Revisión 2 (Sprint 2):** las **vistas por día y por mes** pasan a estar dentro de alcance (2.3). Siguen fuera de alcance los **filtros combinados** y la creación o edición de turnos desde el calendario (es solo lectura).

---

## 1. Visión General

El Módulo J es **exclusivamente de lectura**: no crea, modifica ni transiciona ningún dato. Ofrece dos vistas semanales de solo consulta sobre los turnos ya confirmados (`DISPONIBLE` o `COMPLETO`) que gestiona `spec_modulo_C.md` — por profesor (HU-J-01) y por materia (HU-J-02). No expone ningún endpoint de escritura, y por eso no tiene sección de Reglas de Negocio orientadas a mutación ni eventos de dominio propios (sección 4).

**Regla central, compartida con `spec_modulo_C.md` §3.2:** un turno `PENDIENTE` no reserva recursos y, en consecuencia, **nunca aparece en ningún calendario** — ambas vistas de este módulo filtran exclusivamente turnos confirmados, `estado ∈ {"DISPONIBLE", "COMPLETO"}` (`spec_modulo_C.md` Revisión 2: `PENDIENTE → DISPONIBLE ⇄ COMPLETO`). Esto incluye a un turno `PENDIENTE` que ya tenga profesor, alumnos o aula cargados: mientras no se confirme (HU-C-15), no aparece. En esta spec, "turno agendado" (lenguaje de las HU) equivale a turno confirmado.

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
3. Invocar `listarTurnosAgendadosPorProfesor(profesorId, semanaInicio, semanaFin)` — filtra exclusivamente turnos confirmados, `estado ∈ {"DISPONIBLE", "COMPLETO"}`, en la query (regla central, sección 1). Un `PENDIENTE` con profesor, alumnos o aula ya cargados no se incluye.
4. Cada evento del resultado incluye: `hora_inicio`, `hora_fin`, `alumno` (`"Apellido, Nombre"`), `materia`, `aula`, `estado` (`"DISPONIBLE" | "COMPLETO"`, para que la UI lo muestre con texto e ícono, no solo color). Un turno `DISPONIBLE` puede quedar sin alumnos (`spec_modulo_C.md` §2.5, Decisión B); en ese caso `alumno` es `"—"`. No hay diferencias de campos mostrados entre los roles autorizados en este sprint — la frase "según permisos del rol" del criterio de aceptación se refiere al acceso mismo (paso 1), no a una vista con campos distintos por rol.
5. Si no hay turnos en el rango: se devuelve `eventos: []` — el mensaje "Agenda sin turnos" es responsabilidad de la UI ante una lista vacía, no un código de error.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "profesor": { "id": "cuid", "nombre_completo": "Gómez, Ana" },
    "rango": { "desde": "2026-04-06", "hasta": "2026-04-11" },
    "eventos": [
      { "turno_id": "cuid", "fecha": "2026-04-07", "hora_inicio": "10:00", "hora_fin": "11:00",
        "alumno": "Pérez, Ana", "materia": "Matemática", "aula": "Aula 2", "estado": "DISPONIBLE" },
      { "turno_id": "cuid", "fecha": "2026-04-08", "hora_inicio": "14:00", "hora_fin": "16:00",
        "alumno": "Ruiz, Marcos", "materia": "Física", "aula": "Aula 5", "estado": "COMPLETO" }
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
- **Lectura de turnos:** `listarTurnosAgendadosPorProfesor()` todavía no existe en el módulo C. Por decisión de equipo, HU-J-01 no modifica `turno.service.ts`: la consulta de solo lectura vive en `src/server/calendario/calendario.service.ts` (`listarTurnosAgendadosDeProfesor`, rango `[desde, hasta)`, filtro `estadoTurno IN ("DISPONIBLE", "COMPLETO")` en la query), con un `TODO(Regla N.° 3)` para reemplazarla por el servicio público del módulo C (excepción temporal a §3.4). Revalidado el 24/09/2026 contra el flujo de HU-C-03/C-04/C-15: el módulo C sigue sin exponerlo.
- **Estados (sincronizado 24/09/2026):** el valor `AGENDADO` de la Revisión 1 de `spec_modulo_C.md` se reemplazó por `DISPONIBLE` y `COMPLETO`. El calendario muestra ambos (etiquetas "Disponible" / "Completo", con íconos distintos) y excluye `PENDIENTE` en cualquier grado de configuración.
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
   - `MESA_ENTRADA` / `GERENTE`: ven **todos** los turnos confirmados (`DISPONIBLE` o `COMPLETO`) de la materia en la semana, de cualquier profesor.
   - `PROFESOR`: ven únicamente los turnos confirmados de la materia donde **él mismo** es el profesor asignado — se invoca `listarTurnosAgendadosPorMateria(materiaId, semanaInicio, semanaFin, profesorId: session.sub)`, nunca sin ese filtro.
3. Cada evento incluye: `hora_inicio`, `hora_fin`, `profesor` (`"Apellido, Nombre"`), `alumno`, `aula`, `estado` (`"DISPONIBLE" | "COMPLETO"`). Igual que en 2.1, un `PENDIENTE` con profesor, alumnos o aula ya cargados no se incluye.
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
        "profesor": "Gómez, Ana", "alumno": "Pérez, Ana", "aula": "Aula 2", "estado": "DISPONIBLE" },
      { "turno_id": "cuid", "fecha": "2026-04-07", "hora_inicio": "10:00", "hora_fin": "11:00",
        "profesor": "López, Juan", "alumno": "Ruiz, Marcos", "aula": "Aula 5", "estado": "COMPLETO" }
    ]
  },
  "error": null
}
```

**Nota de sincronización (HU-J-02, implementación 24/09/2026):**
- **Ocupación en lugar de `alumno`:** el backlog vigente (criterio 2) reemplaza el nombre del alumno por la ocupación sobre cupo. Cada evento lleva `alumnos_inscriptos` (`"3/5"` = filas de `TurnoAlumno` del turno / `Turno.cupoMaximoTurno`, mismo formato que el módulo C) y los números sueltos `inscriptos` y `cupo`; **no** lleva `alumno` ni nombres de alumnos. La UI lo muestra como "Alumnos: 3/5". Un `DISPONIBLE` sin alumnos es `"0/N"` y sigue en el calendario. Evento real: `{ "turno_id", "fecha", "hora_inicio", "hora_fin", "profesor": "Giménez, Laura", "alumnos_inscriptos": "3/5", "inscriptos": 3, "cupo": 5, "aula": "Aula 2", "estado": "DISPONIBLE" }`.
- **Profesor efectivo:** el paso 2 dice `profesorId: session.sub`, pero `session.sub` es el id de **Usuario**. El filtro usa el id de la ficha de **Profesor** vinculada a la cuenta (`Profesor.usuarioId`), vía `obtenerOpcionProfesorDeUsuario()` del módulo D, igual que §2.1. Profesor sin ficha → `403 SIN_PERMISO`.
- **Materias del Profesor (default, a confirmar con el equipo):** el Profesor solo puede consultar materias activas que tiene asociadas (HU-D-03, `obtenerMateriasDelProfesor()` del módulo D). Una materia que no dicta → `403 SIN_PERMISO` en la API, sin revelar si existe; su selector muestra solo esas materias. Mesa de Entrada y Gerente eligen entre todas las materias activas (`listarMateriasActivas()`, módulo L).
- **Materia activa:** el paso 1 se resuelve con `obtenerOpcionMateriaActiva()` (servicio público nuevo del módulo L, aditivo), que además devuelve nombre y código para el encabezado. Se verifica **después** del alcance del rol: un Profesor que no dicta la materia recibe `403` aunque la materia esté inactiva o no exista.
- **Rango y lectura de turnos:** mismo criterio que la nota de §2.1 (días operativos en `America/Argentina/Buenos_Aires`; consulta de solo lectura dentro de `src/server/calendario/calendario.service.ts`, `listarTurnosAgendadosDeMateria()`, con `TODO(Regla N.° 3)` hasta que el módulo C exponga `listarTurnosAgendadosPorMateria()`). La ubicación real del servicio es `src/server/calendario/calendario.service.ts` (Regla N.° 11), no `lib/services/calendario/` como dice §3.
- **Orden:** los eventos salen ordenados por fecha, hora, apellido/nombre del profesor e id, para que los superpuestos queden siempre en el mismo carril de la grilla.

---

### 2.3. Vistas día, semana y mes (HU-J-03) — NUEVA en Revisión 2

**Rutas:** las mismas de 2.1 y 2.2 (`GET /app/api/calendario/profesor/[profesorId]` y `GET /app/api/calendario/materia/[materiaId]`) — **no hay ruta nueva**: HU-J-03 amplía HU-J-01 y HU-J-02 con el parámetro `vista`.
**Permiso requerido:** `calendario:leer`, con el mismo alcance por rol de 2.1 (un Profesor solo ve su agenda).
**Pantalla:** el mismo calendario, con un selector "Día / Semana / Mes" (mapa de pantallas §1, fila HU-J-03).

```typescript
// src/server/calendario/calendario.schema.ts — reemplaza a ConsultarCalendario*QuerySchema
export const VISTAS_CALENDARIO = ["dia", "semana", "mes"] as const;
export const ConsultarCalendarioQuerySchema = z.object({
  vista: z.enum(VISTAS_CALENDARIO).default("semana"),
  fecha: fechaCalendarioValidaSchema.optional(),           // día de referencia; por defecto, hoy
  semana_inicio: fechaCalendarioValidaSchema.optional(),   // alias de compatibilidad con HU-J-01/J-02: equivale a vista=semana&fecha=<valor>
});
```

**Comportamiento esperado (`calendario.service.ts`):**
1. Resolver el rango según la vista, en `America/Argentina/Buenos_Aires`:
   - `dia`: `[fecha, fecha]`.
   - `semana`: como en 2.1, del primer al último día de `DIAS_OPERATIVOS` de la semana de `fecha`.
   - `mes`: del primer al último día calendario del mes de `fecha`.
2. La consulta de turnos, el alcance por rol y el filtro `DISPONIBLE`/`COMPLETO` son los de 2.1, 2.2 y 3.1 (un `CANCELADO` no aparece). **La resolución de rango es lo único que cambia** por vista.
3. **Vistas `dia` y `semana`:** devuelven `eventos[]` con la misma forma que 2.1 y 2.2, con un campo nuevo `prioridad` (`"NORMAL" | "ALTA" | "URGENTE"`) por evento. La UI marca `ALTA` y `URGENTE` con texto o ícono, **no solo color** (HU-C-10 AC2).
4. **Vista `mes`:** por ser una vista de resumen, en lugar de la lista de eventos devuelve **un ítem por día del mes**:
   ```json
   {
     "data": {
       "profesor": { "id": "cuid", "nombre_completo": "Gómez, Ana" },
       "vista": "mes",
       "rango": { "desde": "2026-10-01", "hasta": "2026-10-31" },
       "dias": [
         { "fecha": "2026-10-05", "cantidad": 3, "por_estado": { "DISPONIBLE": 2, "COMPLETO": 1 }, "prioridad_maxima": "ALTA" },
         { "fecha": "2026-10-06", "cantidad": 0, "por_estado": { "DISPONIBLE": 0, "COMPLETO": 0 }, "prioridad_maxima": null }
       ]
     },
     "error": null
   }
   ```
   `dias` incluye **todos** los días del mes; los no operativos vienen con `cantidad: 0` y la UI los atenúa. `prioridad_maxima` es la mayor prioridad entre los turnos del día (`URGENTE` > `ALTA` > `NORMAL`; `null` si no hay turnos). Sin turnos en el mes: `dias` con todos en 0; el mensaje "Agenda sin turnos" sigue siendo de la UI.
5. **Clic en un día del mes → vista `día` de esa fecha:** es navegación del cliente (`fecha=<día>&vista=dia`), sin lógica de servidor.
6. **Navegación:** "anterior", "siguiente" y "hoy" también son del cliente: mueven `fecha` un día, una semana o un mes según la vista. Al cambiar de vista **se conserva** el profesor o la materia seleccionados (AC de HU-J-03). Cada cambio dispara una consulta nueva con `vista` y `fecha`.
7. **Vista rápida al hacer clic en un turno** (mapa de pantallas §4, aprobado): abre un `Dialog` de solo lectura con fecha, materia, profesor, alumnos inscriptos y estado, y un enlace "Ver detalle completo" a `/turnos/[id]`. **No requiere endpoint nuevo:** el `Dialog` consulta `GET /api/turnos/[id]` (`turnos:leer`, ya concedido a los tres roles; un Profesor solo obtiene los propios, `spec_modulo_C.md` §2.4). Los datos de pagos no aparecen ahí: requieren `pagos:leer`, que el `Dialog` ignora.

**Errores esperados:** los mismos de 2.1 y 2.2 (`400`, `403 SIN_PERMISO`, `404 PROFESOR_NO_ENCONTRADO` / `MATERIA_NO_ENCONTRADA`).

**Fuera de alcance:** crear, editar o arrastrar turnos desde el calendario; vista de agenda por aula; filtros combinados.

---

## 3. Reglas de Negocio Estrictas

Este módulo no tiene capa de servicios de escritura — sus "reglas de negocio" son, en rigor, reglas de **alcance y autorización de lectura**, resueltas en `lib/services/calendario/calendario.service.ts` (capa delgada que orquesta las llamadas a los servicios públicos de `spec_modulo_C.md`, conforme a la Regla N.° 4 de `docs/RULES.md`).

### 3.1. Solo turnos confirmados (`DISPONIBLE` o `COMPLETO`)
Ninguna consulta de este módulo puede, bajo ningún parámetro o combinación de filtros, devolver un turno `PENDIENTE` — es la misma regla central de `spec_modulo_C.md` §3.2, vista desde el lado de lectura. Esto vale aunque el `PENDIENTE` ya tenga profesor, alumnos o aula cargados (HU-C-04 y HU-C-15 permiten cargarlos antes de confirmar). El filtro es una lista positiva de estados confirmados aplicada en la query del servidor, nunca en la UI: si el módulo C agrega estados nuevos, no aparecen en el calendario hasta que esta spec lo decida.

### 3.2. El alcance de un Profesor se resuelve siempre en el servidor
Un usuario con rol `PROFESOR` nunca puede obtener datos de una agenda ajena (2.1) ni de turnos de otros profesores dentro de una materia (2.2) manipulando un parámetro de la solicitud — el `profesorId` efectivo sale siempre de `session.sub` vía `spec_modulo_A.md`, nunca de la URL o el body cuando el rol es `PROFESOR`. La UI oculta el selector de profesor para este rol, pero eso no reemplaza esta verificación server-side (mismo principio general de `spec_modulo_A.md` §2.2).

### 3.3. Sin deduplicación de eventos superpuestos
El backend nunca combina, agrupa ni descarta eventos que coincidan en horario — entrega el conjunto completo; cualquier presentación "lado a lado" es una decisión de la capa de UI, no del contrato de datos.

### 3.4. Aislamiento: sin acceso directo a `Turno`
Toda lectura pasa por los servicios públicos de `spec_modulo_C.md` (Regla N.° 3) — este módulo no importa ni consulta el modelo `Turno` de Prisma directamente.

---

### 3.5. Una sola consulta, tres resoluciones de rango (Revisión 2)
Las tres vistas comparten la misma consulta de solo lectura y el mismo filtro de estados; solo cambia el rango que se calcula. Está prohibido agregar en la vista `mes` una consulta distinta con reglas propias: el mes agrega en memoria el resultado de la misma consulta.

### 3.6. Cancelado no se muestra, pero se conserva (Revisión 2)
Un turno `CANCELADO` desaparece del calendario (3.1) pero sigue existiendo con su historial. Si Mesa de Entrada necesita verlo, lo encuentra en el listado de Turnos (`spec_modulo_C.md` §2.4), que sí lo muestra.

---

## 4. Eventos de Dominio (EDA)

Este módulo **no emite eventos de dominio**: es exclusivamente de lectura, no muta ningún estado que deba auditarse (Regla N.° 2 de `docs/RULES.md` aplica a mutaciones; una consulta de calendario no lo es).
```