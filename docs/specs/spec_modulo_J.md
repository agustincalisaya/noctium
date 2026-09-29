```markdown
# Especificación Técnica — Módulo J (Calendario)
## Noctium — Sprint 2
## Revisión 2 — Sprint 2: vistas día, semana y mes (HU-J-03); incluye la Revisión 2.1 (corrección tras re-auditoría, 29/09/2026)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 10) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_C.md` (Turno, único dueño del dato) · `spec_modulo_D.md` (Profesor) · `spec_modulo_L.md` (Materias) · `spec_modulo_C.md` Revisión 5 (prioridad y estado `CANCELADO`, §2.12 y §3.9) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§1, §4)

**HU contractualizadas en esta revisión:** HU-J-01 (Calendario por profesor), HU-J-02 (Calendario por materia) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-J-03 (Ver calendario en formato día, semana o mes).

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-J-01 | Contractualizada en la Revisión 1 (Sprint 1) | Ampliada: + `prioridad` por evento; rango cerrado vía `listarTurnosParaCalendario` (2.1); parámetros `vista` y `fecha` (2.3) |
| HU-J-02 | Contractualizada en la Revisión 1 (Sprint 1) | Ampliada: + `prioridad`; `alumnos_inscriptos`/`inscriptos`/`cupo` en lugar de `alumno`; `vista` y `fecha` (2.2, 2.3) |
| HU-J-03 | Gap — "Vistas por día o por mes" figuraba como fuera de alcance | Añadida sección 2.3 (aditiva, no renumera) |

**Changelog — Revisión 2 (Sprint 2), detalle:**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-J-03 | Gap — "Vistas por día o por mes" figuraba como fuera de alcance | Nueva sección 2.3 (aditiva, no renumera). Amplía 2.1 y 2.2 con `vista` y `fecha` |
| `eventos[]` | `hora_inicio`, `hora_fin`, `alumno`, `materia`, `aula`, `estado` | + `prioridad` (indicador de HU-C-10) |
| Estado `CANCELADO` | No existía | Sin cambio de código: 3.1 ya filtra `DISPONIBLE`/`COMPLETO` (`spec_modulo_C.md` §3.9) |
| Permisos | `calendario:leer` | Sin cambios |

**Changelog — Revisión 2.1 (corrección tras re-auditoría, 29/09/2026):**
| HU / sección | Acción |
|---|---|
| HU-J-03 AC2 (2.3 punto 4) | La vista mes agrega `estado_predominante` por día (estado con más turnos; empate: `COMPLETO` > `DISPONIBLE`) |
| HU-J-03 AC4 (2.3 punto 6) | Cambiar de vista con el selector abre en la fecha de **hoy** (el cliente omite `fecha`); navegación anterior/siguiente y clic en un día se distinguen del cambio de vista |
| Contrato con C (1, 2.3 punto 1) | `listarTurnosParaCalendario` con rango **cerrado e inclusivo** `[desde, hasta]` (sin sumar un día); tabla de correspondencia campo a campo entre lo que devuelve C y los eventos de J |
| Ejemplos 2.1 y 2.2 | + `prioridad`; 2.2 con `alumnos_inscriptos`/`inscriptos`/`cupo` en lugar de `alumno` (queda de una sola versión) |
| Texto desactualizado | Sección 1 y convenciones (vistas día/semana/mes); HU-C-04 confirma el turno; máquina de cuatro estados; referencia a `lib/services/`; regla 3.2 (`session.sub` es el id de Usuario); 403 `SIN_PERMISO` para turno ajeno en la vista rápida |

**Fuera de alcance de esta spec (explícito):**
- ~~Vistas por día o por mes (solo vista semanal este sprint).~~ **Incorporadas en Revisión 2** (2.3, ver «Actualización de alcance» más abajo).
- Filtros combinados (ej. profesor + materia a la vez).

**Actualización de alcance — Revisión 2 (Sprint 2):** las **vistas por día y por mes** pasan a estar dentro de alcance (2.3). Siguen fuera de alcance los **filtros combinados** y la creación o edición de turnos desde el calendario (es solo lectura).

---

## 1. Visión General

El Módulo J es **exclusivamente de lectura**: no crea, modifica ni transiciona ningún dato. Ofrece vistas de solo consulta —día, semana y mes (HU-J-03)— sobre los turnos ya confirmados (`DISPONIBLE` o `COMPLETO`) que gestiona `spec_modulo_C.md`, por profesor (HU-J-01) y por materia (HU-J-02). No expone ningún endpoint de escritura, y por eso no tiene sección de Reglas de Negocio orientadas a mutación ni eventos de dominio propios (sección 4).

**Regla central, compartida con `spec_modulo_C.md` §3.2:** un turno `PENDIENTE` no reserva recursos y, en consecuencia, **nunca aparece en ningún calendario** — ambas vistas de este módulo filtran exclusivamente turnos confirmados, `estado ∈ {"DISPONIBLE", "COMPLETO"}` (máquina de cuatro estados vigente de `spec_modulo_C.md` Revisión 5, §1 y §3.1: `PENDIENTE`, `DISPONIBLE`, `COMPLETO` y `CANCELADO` terminal; solo los dos centrales se muestran). Esto incluye a un turno `PENDIENTE` que ya tenga profesor, alumnos o aula cargados: mientras no se confirme (la confirmación la hace HU-C-04, `spec_modulo_C.md` §2.2; HU-C-15 solo asigna aula), no aparece. En esta spec, "turno agendado" (lenguaje de las HU) equivale a turno confirmado.

**Aislamiento de dominio (Regla N.° 3):** este módulo no consulta la tabla `Turno` directamente. Consume los servicios públicos de `spec_modulo_C.md`:
- `listarTurnosParaCalendario({ desde, hasta, profesorId?, materiaId? }, db?)` (`spec_modulo_C.md` §2.15, agregada en la Revisión 5.1). **Contrato acordado con C:** el rango es **cerrado e inclusivo `[desde, hasta]`** (fechas `AAAA-MM-DD`; la vista día usa `desde = hasta`), por lo que J pasa el primer y el último día del rango tal cual, **sin sumar ni restar un día**. Devuelve por turno (nunca `PENDIENTE`): `turno_id`, `fecha`, `hora_inicio`, `hora_fin`, `estado`, `prioridad`, `materia { id, nombre }`, `profesor { id, nombre_para_mostrar }`, `aula { id, nombre }`, `alumnos: string[]`, `inscriptos: number`, `cupo: number | null`, `alumnos_inscriptos: "3/5"`. J define qué necesita y C lo provee; J no pide nada más. Reemplaza a las dos funciones que esta spec nombraba en la Revisión 1 (`listarTurnosAgendadosPorProfesor` y `listarTurnosAgendadosPorMateria`, que nunca existieron en C). Para la vista por profesor se pasa `profesorId`; para la vista por materia, `materiaId` y, cuando quien consulta es un Profesor, también `profesorId` (ver 2.2).

**Alcance de esta revisión:** la sección 2.3 (HU-J-03) y las reglas 3.5 y 3.6 son nuevas y aditivas; por eso no se renumeran las secciones 2.1, 2.2 y 3.1 a 3.4, que vienen de la Revisión 1 (Sprint 1) y se amplían sin cambiar su numeración (ver `docs/adicionales/sdd-metodologia.md`). La Revisión 2.1 solo corrige el texto de esta misma spec, sin agregar operaciones.

**Nota de trazabilidad (resuelta en la Revisión 5.1):** el gap que esta spec declaraba (las funciones de lectura no estaban contractualizadas en `spec_modulo_C.md`) se cierra con `listarTurnosParaCalendario` en `spec_modulo_C.md` §2.15. **HU-J-03 migra `calendario.service.ts` a esa función**, porque ya toca esa consulta (vista mes y `prioridad`); con eso desaparece la excepción temporal a la Regla N.° 3 que documentan las notas de sincronización de 2.1 y 2.2. Hasta que se implemente HU-J-03, esa excepción sigue vigente.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Profesor`, `Materia` y `Turno`, incluidos `[profesorId]`, `[materiaId]` y `turno_id`, son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("calendario:leer")` (Regla N.° 10) — disponible para Mesa de Entrada, Gerente y Profesor, con el alcance acotado por rol que describe cada sección.
- Las pantallas abren, por defecto, en la vista `semana` de la semana actual (2.3). El rango de la semana es siempre cerrado, del primer al último día de `DIAS_OPERATIVOS` vigente (mismo parámetro de `spec_modulo_D.md`/`spec_modulo_C.md`); el de la vista día es `[fecha, fecha]` y el del mes, del primer al último día calendario.
- **Correspondencia con `listarTurnosParaCalendario` (`spec_modulo_C.md` §2.15):** cada evento de J se arma con los campos que devuelve C: `turno_id`, `fecha`, `hora_inicio`, `hora_fin`, `estado`, `prioridad` (tal cual); `materia` = `materia.nombre`; `aula` = `aula.nombre`; `profesor` = `profesor.nombre_para_mostrar` (`"Apellido, Nombre"`); `alumno` (2.1) = `alumnos` unidos con `"; "`, o `"—"` si está vacío; `alumnos_inscriptos`, `inscriptos` y `cupo` (2.2) tal cual. El servicio no hace consultas adicionales para armar el evento.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/calendario.types.ts` (nombre a confirmar contra el código), schemas en `src/server/calendario/calendario.schema.ts` y services en `src/server/calendario/calendario.service.ts`. Este módulo es de solo lectura y no tiene Server Actions (`src/server/calendario/actions.ts` no se crea). Imports siempre con el alias `@/`.

---

### 2.1. Calendario semanal por profesor (HU-J-01)

**Ruta:** `GET /api/calendario/profesor/[profesorId]` (Route Handler en `src/app/api/calendario/profesor/[profesorId]/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarTurnosAgendadosDeProfesor()` en `src/server/calendario/calendario.service.ts` (a migrar a `listarTurnosParaCalendario()`, ver 2.3)
**Permiso requerido:** `calendario:leer`

```typescript
export const ConsultarCalendarioProfesorQuerySchema = z.object({
  semana_inicio: fechaCalendarioValidaSchema.optional(), // lunes de la semana a consultar; si se omite, semana actual
});
export type ConsultarCalendarioProfesorQuery = z.infer<typeof ConsultarCalendarioProfesorQuerySchema>;
```

**Comportamiento esperado:**
1. **Resolución del `profesorId` efectivo, según rol de la sesión:**
   - Rol `PROFESOR`: el servidor **ignora cualquier `profesorId` que no sea el propio** y siempre resuelve la agenda a partir de la ficha de Profesor vinculada a la cuenta (`Profesor.usuario_id === session.sub`, vía `obtenerOpcionProfesorDeUsuario()`, módulo D; `session.sub` es el id de **Usuario**, no de Profesor) (nunca confía en el parámetro de la URL para decidir de quién es la agenda). Si el `profesorId` de la ruta no coincide con el propio: `403 SIN_PERMISO`, sin revelar si ese otro profesor existe o tiene turnos — el mismo principio de neutralidad de `spec_modulo_A.md` §3.2, aplicado acá a nivel de autorización de datos.
   - Rol `MESA_ENTRADA` o `GERENTE`: usan el `profesorId` de la ruta libremente; debe corresponder a un profesor activo (`404 PROFESOR_NO_ENCONTRADO` en caso contrario).
2. Calcular `semana_inicio`/`semana_fin` (si no viene `semana_inicio`, se usa el lunes de la semana actual del servidor).
3. Invocar `listarTurnosParaCalendario({ profesorId, desde: semanaInicio, hasta: semanaFin })` (`spec_modulo_C.md` §2.15; en la Revisión 1 se llamaba `listarTurnosAgendadosPorProfesor`), con `semanaInicio`/`semanaFin` = primer y último día operativo de la semana (rango cerrado, sin sumar un día) — filtra exclusivamente turnos confirmados, `estado ∈ {"DISPONIBLE", "COMPLETO"}`, en la query (regla central, sección 1). Un `PENDIENTE` con profesor, alumnos o aula ya cargados no se incluye.
4. Cada evento del resultado incluye (correspondencia con C en «Convenciones generales»): `turno_id`, `fecha`, `hora_inicio`, `hora_fin`, `alumno` (`"Apellido, Nombre"`), `materia`, `aula`, `estado` (`"DISPONIBLE" | "COMPLETO"`, para que la UI lo muestre con texto e ícono, no solo color) y `prioridad` (`"NORMAL" | "ALTA" | "URGENTE"`; la UI marca `ALTA` y `URGENTE` con texto o ícono, no solo color, HU-C-10 AC2). Un turno `DISPONIBLE` puede quedar sin alumnos (`spec_modulo_C.md` §2.5, Decisión B); en ese caso `alumno` es `"—"`. No hay diferencias de campos mostrados entre los roles autorizados en este sprint — la frase "según permisos del rol" del criterio de aceptación se refiere al acceso mismo (paso 1), no a una vista con campos distintos por rol.
5. Si no hay turnos en el rango: se devuelve `eventos: []` — el mensaje "Agenda sin turnos" es responsabilidad de la UI ante una lista vacía, no un código de error.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "profesor": { "id": "cuid", "nombre_completo": "Gómez, Ana" },
    "rango": { "desde": "2026-04-06", "hasta": "2026-04-11" },
    "eventos": [
      { "turno_id": "cuid", "fecha": "2026-04-07", "hora_inicio": "10:00", "hora_fin": "11:00",
        "alumno": "Pérez, Ana", "materia": "Matemática", "aula": "Aula 2", "estado": "DISPONIBLE", "prioridad": "NORMAL" },
      { "turno_id": "cuid", "fecha": "2026-04-08", "hora_inicio": "14:00", "hora_fin": "16:00",
        "alumno": "Ruiz, Marcos", "materia": "Física", "aula": "Aula 5", "estado": "COMPLETO", "prioridad": "ALTA" }
    ]
  },
  "error": null
}
```

**Respuesta `403 Forbidden` (profesor intentando ver otra agenda):**
```json
{ "data": null, "error": { "code": "SIN_PERMISO", "message": "No tenés permisos para acceder a esta sección" } }
```

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — `semana_inicio` con formato de fecha inválido.
- `403 SIN_PERMISO` — Profesor que pide la agenda de otro profesor, o Profesor sin ficha vinculada a su cuenta.
- `404 PROFESOR_NO_ENCONTRADO` — Mesa de Entrada o Gerente con un `profesorId` que no corresponde a un profesor activo.

**Nota de sincronización (HU-J-01, implementación):**
- **Rango por días operativos:** la semana se calcula de lunes a domingo en `America/Argentina/Buenos_Aires` y el rango va del primer al último día de `dias_operativos` (no un `[lunes, sábado]` fijo). Con la configuración actual del seed (`LUNES`–`VIERNES`) el rango es lunes–viernes; con `LUNES`–`SABADO` coincidiría exactamente con lo escrito arriba. `semana_inicio` puede ser cualquier día: se normaliza al lunes de su semana.
- **Profesor sin ficha vinculada** a su cuenta: `403 SIN_PERMISO` (no tiene agenda propia).
- **Turnos grupales:** `alumno` se mantiene como string; si el turno tiene más de un alumno se unen como `"Apellido, Nombre; Apellido, Nombre"`.
- **Lectura de turnos:** `listarTurnosAgendadosPorProfesor()` todavía no existe en el módulo C. Por decisión de equipo, HU-J-01 no modifica `turno.service.ts`: la consulta de solo lectura vive en `src/server/calendario/calendario.service.ts` (`listarTurnosAgendadosDeProfesor`, implementada con rango semiabierto `[desde, hasta)`; al migrar a `listarTurnosParaCalendario()` el rango pasa a ser el cerrado `[desde, hasta]` del contrato, sin sumar un día; filtro `estadoTurno IN ("DISPONIBLE", "COMPLETO")` en la query), con un `TODO(Regla N.° 3)` para reemplazarla por el servicio público del módulo C (excepción temporal a §3.4). **Revisión 5.1:** el reemplazo es `listarTurnosParaCalendario()` (`spec_modulo_C.md` §2.15) y se hace dentro de HU-J-03. Revalidado el 24/09/2026 contra el flujo de HU-C-03/C-04/C-15: el módulo C sigue sin exponerlo.
- **Estados (sincronizado 24/09/2026):** el valor `AGENDADO` de la Revisión 1 de `spec_modulo_C.md` se reemplazó por `DISPONIBLE` y `COMPLETO`. El calendario muestra ambos (etiquetas "Disponible" / "Completo", con íconos distintos) y excluye `PENDIENTE` en cualquier grado de configuración.
- **Profesor efectivo:** se resuelve con los servicios públicos del módulo D `obtenerOpcionProfesorDeUsuario()` (rol Profesor) y `obtenerOpcionProfesorActivo()` (Mesa/Gerente).

---

### 2.2. Calendario semanal por materia (HU-J-02)

**Ruta:** `GET /api/calendario/materia/[materiaId]` (Route Handler en `src/app/api/calendario/materia/[materiaId]/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarTurnosAgendadosDeMateria()` en `src/server/calendario/calendario.service.ts` (a migrar a `listarTurnosParaCalendario()`, ver 2.3)
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
   - `PROFESOR`: ven únicamente los turnos confirmados de la materia donde **él mismo** es el profesor asignado — se invoca `listarTurnosParaCalendario({ materiaId, profesorId: <ficha del profesor>, desde, hasta })` (el id de la ficha, no `session.sub`; ver la nota de sincronización de esta misma sección), nunca sin ese filtro.
3. Cada evento incluye (correspondencia con C en «Convenciones generales»): `turno_id`, `fecha`, `hora_inicio`, `hora_fin`, `profesor` (`"Apellido, Nombre"`), `alumnos_inscriptos` (`"3/5"`), `inscriptos`, `cupo`, `aula`, `estado` (`"DISPONIBLE" | "COMPLETO"`) y `prioridad` (`"NORMAL" | "ALTA" | "URGENTE"`, misma marca visual que en 2.1); **no** lleva `alumno` (ver la nota de sincronización HU-J-02). Igual que en 2.1, un `PENDIENTE` con profesor, alumnos o aula ya cargados no se incluye.
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
        "profesor": "Gómez, Ana", "alumnos_inscriptos": "1/5", "inscriptos": 1, "cupo": 5, "aula": "Aula 2", "estado": "DISPONIBLE", "prioridad": "NORMAL" },
      { "turno_id": "cuid", "fecha": "2026-04-07", "hora_inicio": "10:00", "hora_fin": "11:00",
        "profesor": "López, Juan", "alumnos_inscriptos": "2/2", "inscriptos": 2, "cupo": 2, "aula": "Aula 5", "estado": "COMPLETO", "prioridad": "URGENTE" }
    ]
  },
  "error": null
}
```

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — `semana_inicio` con formato de fecha inválido.
- `403 SIN_PERMISO` — Profesor sin ficha vinculada o que consulta una materia que no dicta (sin revelar si existe).
- `404 MATERIA_NO_ENCONTRADA` — Mesa de Entrada o Gerente con una materia inexistente o inactiva.

**Nota de sincronización (HU-J-02, implementación 24/09/2026):**
- **Ocupación en lugar de `alumno`:** el backlog vigente (criterio 2) reemplaza el nombre del alumno por la ocupación sobre cupo. Cada evento lleva `alumnos_inscriptos` (`"3/5"` = filas de `TurnoAlumno` del turno / `Turno.cupoMaximoTurno`, mismo formato que el módulo C) y los números sueltos `inscriptos` y `cupo`; **no** lleva `alumno` ni nombres de alumnos. La UI lo muestra como "Alumnos: 3/5". Un `DISPONIBLE` sin alumnos es `"0/N"` y sigue en el calendario. Evento real: `{ "turno_id", "fecha", "hora_inicio", "hora_fin", "profesor": "Giménez, Laura", "alumnos_inscriptos": "3/5", "inscriptos": 3, "cupo": 5, "aula": "Aula 2", "estado": "DISPONIBLE", "prioridad": "NORMAL" }`.
- **Profesor efectivo:** el paso 2 dice `profesorId: session.sub`, pero `session.sub` es el id de **Usuario**. El filtro usa el id de la ficha de **Profesor** vinculada a la cuenta (`Profesor.usuarioId`), vía `obtenerOpcionProfesorDeUsuario()` del módulo D, igual que §2.1. Profesor sin ficha → `403 SIN_PERMISO`.
- **Materias del Profesor (default, a confirmar con el equipo):** el Profesor solo puede consultar materias activas que tiene asociadas (HU-D-03, `obtenerMateriasDelProfesor()` del módulo D). Una materia que no dicta → `403 SIN_PERMISO` en la API, sin revelar si existe (mismo criterio que C: `403 SIN_PERMISO` ante un recurso ajeno, nunca `404`); su selector muestra solo esas materias. Mesa de Entrada y Gerente eligen entre todas las materias activas (`listarMateriasActivas()`, módulo L).
- **Materia activa:** el paso 1 se resuelve con `obtenerOpcionMateriaActiva()` (servicio público nuevo del módulo L, aditivo), que además devuelve nombre y código para el encabezado. Se verifica **después** del alcance del rol: un Profesor que no dicta la materia recibe `403` aunque la materia esté inactiva o no exista.
- **Rango y lectura de turnos:** mismo criterio que la nota de §2.1 (días operativos en `America/Argentina/Buenos_Aires`; consulta de solo lectura dentro de `src/server/calendario/calendario.service.ts`, `listarTurnosAgendadosDeMateria()`, con `TODO(Regla N.° 3)` hasta que HU-J-03 lo migre a `listarTurnosParaCalendario()`, `spec_modulo_C.md` §2.15). La ubicación del servicio es `src/server/calendario/calendario.service.ts` (Regla N.° 11), la misma que fija §3.
- **Orden:** los eventos salen ordenados por fecha, hora, apellido/nombre del profesor e id, para que los superpuestos queden siempre en el mismo carril de la grilla.

---

### 2.3. Vistas día, semana y mes (HU-J-03) — NUEVA en Revisión 2

**Rutas:** las mismas de 2.1 y 2.2 (`GET /api/calendario/profesor/[profesorId]` y `GET /api/calendario/materia/[materiaId]`) — **no hay ruta nueva**: HU-J-03 amplía HU-J-01 y HU-J-02 con el parámetro `vista`.
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `calendario.service.ts` — función de resolución de rango por vista, que invoca `listarTurnosParaCalendario()` (nombre exacto a confirmar contra el código)
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

   Los tres rangos son **cerrados e inclusivos** y se pasan tal cual a `listarTurnosParaCalendario({ desde, hasta, ... })` (`spec_modulo_C.md` §2.15 usa el mismo `[desde, hasta]`): el servicio de J **no suma ni resta un día**. `fecha`, si se omite, es hoy en `America/Argentina/Buenos_Aires`.
2. La consulta de turnos, el alcance por rol y el filtro `DISPONIBLE`/`COMPLETO` son los de 2.1, 2.2 y 3.1 (un `CANCELADO` no aparece). **La resolución de rango es lo único que cambia** por vista.
3. **Vistas `dia` y `semana`:** devuelven `eventos[]` con la misma forma que 2.1 y 2.2 (incluido `prioridad`, `"NORMAL" | "ALTA" | "URGENTE"`, por evento); la vista día tiene el mismo nivel de detalle que la semana, para un único día (HU-J-03 AC3). La UI marca `ALTA` y `URGENTE` con texto o ícono, **no solo color** (HU-C-10 AC2).
4. **Vista `mes`:** por ser una vista de resumen, en lugar de la lista de eventos devuelve **un ítem por día del mes**:
   ```json
   {
     "data": {
       "profesor": { "id": "cuid", "nombre_completo": "Gómez, Ana" },
       "vista": "mes",
       "rango": { "desde": "2026-10-01", "hasta": "2026-10-31" },
       "dias": [
         { "fecha": "2026-10-05", "cantidad": 3, "por_estado": { "DISPONIBLE": 2, "COMPLETO": 1 }, "estado_predominante": "DISPONIBLE", "prioridad_maxima": "ALTA" },
         { "fecha": "2026-10-06", "cantidad": 2, "por_estado": { "DISPONIBLE": 1, "COMPLETO": 1 }, "estado_predominante": "COMPLETO", "prioridad_maxima": "NORMAL" },
         { "fecha": "2026-10-07", "cantidad": 0, "por_estado": { "DISPONIBLE": 0, "COMPLETO": 0 }, "estado_predominante": null, "prioridad_maxima": null }
       ]
     },
     "error": null
   }
   ```
   `dias` incluye **todos** los días del mes; los días sin turnos (entre ellos los no operativos) vienen con `cantidad: 0` y la UI los atenúa. La vista mes de materia (2.2) devuelve `materia` en lugar de `profesor`, con el mismo `dias`. Cada ítem es el **indicador compacto** de HU-J-03 AC2 (cantidad y estado predominante, sin detalle hora a hora):
   - `cantidad`: turnos `DISPONIBLE` + `COMPLETO` del día; `por_estado` lleva siempre las dos claves.
   - `estado_predominante` (**definición de diseño**, ver `decisiones_de_diseno`): el estado con **más turnos** ese día; si hay **empate**, prioridad `COMPLETO` > `DISPONIBLE`; `null` si `cantidad = 0`. Se calcula en el servicio a partir de `por_estado` (3.5). La UI lo muestra con texto e ícono junto a la cantidad, no solo color.
   - `prioridad_maxima` es la mayor prioridad entre los turnos del día (`URGENTE` > `ALTA` > `NORMAL`; `null` si no hay turnos). Sin turnos en el mes: `dias` con todos en 0; el mensaje "Agenda sin turnos" sigue siendo de la UI.
5. **Clic en un día del mes → vista `día` de esa fecha:** es navegación del cliente (`fecha=<día>&vista=dia`), sin lógica de servidor. Es la única transición de vista que conserva una fecha distinta de hoy.
6. **Cambio de vista y navegación (HU-J-03 AC4 y AC5), todo del cliente:**
   - **Cambio de vista con el selector «Día / Semana / Mes»:** se conserva el profesor o la materia seleccionados y la fecha vuelve a **hoy** (letra del AC): el cliente pide `vista=<nueva>` **sin `fecha`**, de modo que el servidor toma hoy (`America/Argentina/Buenos_Aires`) y abre en el día de hoy (`dia`), en la semana actual (`semana`) o en el mes actual (`mes`). No se arrastra la fecha de referencia de la vista anterior.
   - **«Hoy»:** igual que el cambio de vista, sobre la vista activa: pide la misma `vista` sin `fecha` y vuelve al día, la semana o el mes actual.
   - **«Anterior» / «siguiente»:** envían `fecha` explícita, movida un día, una semana o un mes según la vista.
   - Cada cambio dispara una consulta nueva con `vista` y, salvo en los dos primeros casos, `fecha`.
7. **Vista rápida al hacer clic en un turno** (mapa de pantallas §4, aprobado): abre un `Dialog` de solo lectura con fecha, materia, profesor, alumnos inscriptos y estado, y un enlace "Ver detalle completo" a `/turnos/[id]`. **No requiere endpoint nuevo:** el `Dialog` consulta `GET /api/turnos/[id]` (`turnos:leer`, ya concedido a los tres roles; un Profesor que pide un turno ajeno recibe `403 SIN_PERMISO` sin revelar si existe, como en 2.1, `spec_modulo_C.md` §2.4). Los datos de pagos no aparecen ahí: requieren `pagos:leer`, que el `Dialog` ignora.

**Errores esperados:** los mismos de 2.1 y 2.2:
- `400` (validación Zod, `flatten()`) — `vista` fuera de `dia | semana | mes` o `fecha` / `semana_inicio` inválidas.
- `403 SIN_PERMISO` — mismo alcance por rol que 2.1 y 2.2.
- `404 PROFESOR_NO_ENCONTRADO` / `404 MATERIA_NO_ENCONTRADA`.

**Fuera de alcance:** crear, editar o arrastrar turnos desde el calendario; vista de agenda por aula; filtros combinados.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/calendario/calendario.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

Este módulo no tiene reglas de escritura: sus "reglas de negocio" son, en rigor, reglas de **alcance y autorización de lectura**, que orquestan las llamadas a los servicios públicos de `spec_modulo_C.md`.

### 3.1. Solo turnos confirmados (`DISPONIBLE` o `COMPLETO`)
Ninguna consulta de este módulo puede, bajo ningún parámetro o combinación de filtros, devolver un turno `PENDIENTE` — es la misma regla central de `spec_modulo_C.md` §3.2, vista desde el lado de lectura. Esto vale aunque el `PENDIENTE` ya tenga profesor, alumnos o aula cargados (HU-C-04 y HU-C-15 permiten cargarlos antes de confirmar; la confirmación es de HU-C-04). El filtro es una lista positiva de estados confirmados aplicada en la query del servidor, nunca en la UI: si el módulo C agrega estados nuevos, no aparecen en el calendario hasta que esta spec lo decida.

### 3.2. El alcance de un Profesor se resuelve siempre en el servidor
Un usuario con rol `PROFESOR` nunca puede obtener datos de una agenda ajena (2.1) ni de turnos de otros profesores dentro de una materia (2.2) manipulando un parámetro de la solicitud — el `profesorId` efectivo sale siempre de la sesión, nunca de la URL o el body cuando el rol es `PROFESOR`: `session.sub` (`spec_modulo_A.md`) es el id de **Usuario**, y con él se obtiene la ficha de Profesor vinculada (`obtenerOpcionProfesorDeUsuario()`, módulo D); el filtro de `listarTurnosParaCalendario` usa el id de esa ficha, no `session.sub`. Sin ficha vinculada: `403 SIN_PERMISO`. La UI oculta el selector de profesor para este rol, pero eso no reemplaza esta verificación server-side (mismo principio general de `spec_modulo_A.md` §2.2).

### 3.3. Sin deduplicación de eventos superpuestos
El backend nunca combina, agrupa ni descarta eventos que coincidan en horario — entrega el conjunto completo; cualquier presentación "lado a lado" es una decisión de la capa de UI, no del contrato de datos.

### 3.4. Aislamiento: sin acceso directo a `Turno`
Toda lectura pasa por los servicios públicos de `spec_modulo_C.md` (Regla N.° 3), en concreto `listarTurnosParaCalendario()` — este módulo no importa ni consulta el modelo `Turno` de Prisma directamente. *Estado actual:* hasta que HU-J-03 migre `calendario.service.ts`, existe una excepción temporal (ver notas de 2.1 y 2.2); un test debe fallar si aparece un estado de turno nuevo que la consulta directa no filtre.

---

### 3.5. Una sola consulta, tres resoluciones de rango (Revisión 2)
Las tres vistas comparten la misma consulta de solo lectura y el mismo filtro de estados; solo cambia el rango cerrado que se calcula. Está prohibido agregar en la vista `mes` una consulta distinta con reglas propias: el mes agrega en memoria el resultado de la misma consulta (conteo por estado, `estado_predominante` y `prioridad_maxima`).

### 3.6. Cancelado no se muestra, pero se conserva (Revisión 2)
Un turno `CANCELADO` desaparece del calendario (3.1) pero sigue existiendo con su historial. Si Mesa de Entrada necesita verlo, lo encuentra en el listado de Turnos (`spec_modulo_C.md` §2.4), que sí lo muestra.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Este módulo **no usa ni la opción (a) (columnas de auditoría) ni la opción (b) (tabla de eventos)** de la Regla N.° 2 de `docs/RULES.md`: es exclusivamente de lectura, no muta ningún estado que deba auditarse (la regla aplica a mutaciones; una consulta de calendario no lo es), no tiene tablas propias y no emite eventos de dominio.
```
