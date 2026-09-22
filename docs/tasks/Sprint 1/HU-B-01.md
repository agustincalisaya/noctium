# HU-B-01 — Registrar datos de identidad del alumno
## Noctium — Sprint 1 — Módulo B (Alumno)

**Referencia de spec:** `docs/specs/spec_modulo_B.md` §2.1 (Alta de identidad del alumno), §3.1-3.4 (reglas de negocio)
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 9, 10)

---

## 0. Relevamiento previo a implementación

### 0.1 Archivos nuevos a crear
| Archivo | Contenido |
|---|---|
| `src/server/shared/fecha.schema.ts` | `fechaCalendarioValidaSchema` — validación estricta de calendario, implementada a mano (parseo + reconstrucción con `Date.UTC` + comparación exacta de año/mes/día), sin agregar `date-fns` como dependencia nueva. Reutilizable por otros módulos (Profesor, Turno). |
| `src/server/alumnos/alumno.schema.ts` | `crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax)` — factory, porque la longitud del DNI es un rango configurable en `ParametroSistema`, no un valor fijo. |
| `src/app/(dashboard)/alumnos/actions.ts` | Server Action `crearAlumno()` (no existía ningún `actions.ts` bajo `alumnos/` todavía) |
| `src/app/(dashboard)/alumnos/nueva/page.tsx` | **(agregado al incorporar frontend)** Formulario "Nuevo alumno" (criterios de aceptación 1, 8, 9 de HU-B-01), siguiendo el patrón ya usado en `materias/nueva/` (HU-L-01). Conectado al Server Action `crearAlumno()`. |

**Nota de convención de rutas (resuelta por precedente):** se sigue la estructura real ya usada por Módulo A (`src/server/<modulo>/*.schema.ts` + `*.service.ts` juntos), no la nomenclatura genérica `lib/schemas/` / `lib/services/` de la spec original — el repo no tiene esas carpetas y `tsconfig.json` solo mapea `@/* → ./src/*`.

### 0.2 Archivos existentes a modificar
| Archivo | Cambio |
|---|---|
| `src/server/alumnos/alumno.service.ts` | Era un stub (`// TODO... export {}`). Implementa `crearAlumno()`. |
| `src/app/api/alumnos/route.ts` | GET/POST devolvían 501. Implementa POST con `withPermission("alumnos:crear", ...)`. GET queda como está (501) — el listado es HU-B-04, fuera de esta task. |
| `prisma/seed.ts` | Sección "10) RolPermiso": agrega `alumnos:crear`, sembrado únicamente para `MESA_ENTRADA`. |
| `src/app/(dashboard)/alumnos/page.tsx` | **(agregado al incorporar frontend)** Era un placeholder ("Alumnos - en construcción"). Se agrega un link/botón "Nuevo alumno" hacia el formulario — lo mínimo para poder navegar, sin construir el listado completo (HU-B-04, sigue fuera de alcance). |

### 0.3 Puntos ambiguos relevados y resueltos
- **DNI, longitud:** el seed real usa `dni_longitud_min: "7"` / `dni_longitud_max: "8"` (rango), no un `DNI_LONGITUD` único como sugería la spec original. El schema usa `.min(min).max(max)` leídos vía `getParametroNumerico()` (`src/server/shared/parametros.ts`), no `.length()`.
- **Alcance del permiso `alumnos:crear`:** solo `MESA_ENTRADA`, según spec_modulo_B.md §2.1 ("Permiso requerido: alumnos:crear — Mesa de Entrada"). No incluye `GERENTE`.
- **`fechaCalendarioValidaSchema`:** implementada a mano, sin dependencia nueva (`date-fns` no está en `package.json`).
- **Forma del payload de respuesta (201):** se mapea a claves limpias (`id`, `nombre`, `apellido`, `dni`, `activo`) en el Route Handler, en vez de exponer los nombres de columna de Prisma (`idAlumno`, `nombreAlumno`, etc.) tal cual.
- **Trazabilidad de la mutación (Regla N.° 2 — DECISIÓN RESUELTA, no relevar de nuevo):** RULES.md fue actualizado por decisión de equipo; ya no exige event bus asíncrono ni `AuditLog` con hash-chain. Para esta HU corresponde el patrón (a) de la regla actualizada — columnas de auditoría en la propia entidad (`createdAtAlumno`, `creadoPorUsuarioId`), sin tabla de eventos adicional.
- **Alcance de frontend (DECISIÓN RESUELTA, no relevar de nuevo):** la primera pasada de esta task dejó el frontend fuera "por decisión de scoping" (backend-first). Al revisar los criterios de aceptación reales de HU-B-01 (documento "Historias de Usuario - Sprint 1"), se confirmó que los criterios 1, 8 y 9 describen comportamiento de interfaz que es parte de la HU misma, no una historia aparte. Se corrigió: el frontend se incorpora a esta misma task antes del cierre, no se deja pendiente para una iteración separada.

### 0.4 Nota de sincronización (no bloqueante para esta task)
El modelo `Alumno` no tiene columna `version` para concurrencia optimista, que sí exige `spec_modulo_B.md` §3.3 para HU-B-06. No afecta al alta (esta HU) — el `INSERT` simplemente no la setea — pero cuando se implemente HU-B-06 va a hacer falta una migración de Prisma agregándola.

---

## 1. Nota de alcance

Esta task implementa exclusivamente el alta de la ficha de identidad del alumno (HU-B-01), incluyendo su formulario de carga. No crea cuenta de acceso (`Usuario`) — eso corresponde a HU-B-08 (autorregistro). El campo `dniAlumno` valida unicidad contra el universo completo de fichas, activas e inactivas.

---

## 2. Historia de Usuario

**Como** personal de Mesa de Entrada
**Necesito** registrar los datos de identidad de un alumno
**Para** disponer de una ficha confiable al gestionar turnos y su futura atención académica

**SP estimado:** 1

---

## 3. Alcance de esta task

**Incluye:**
- Formulario "Nuevo alumno" con Nombre, Apellido, DNI, Fecha de nacimiento (obligatorios, con marca visible) y Género (opcional) — criterio de aceptación 1.
- Labels visibles y ayuda de formato en cada campo.
- Validación en la interfaz (UX) + validación real en el servidor (Zod, sin duplicar reglas de negocio en el cliente).
- Errores específicos junto a cada campo ante un rechazo del servidor, sin perder los datos válidos ya cargados, con foco en el primer campo inválido — criterio 9.
- Botón de guardar deshabilitado + indicador de carga mientras se procesa la petición, para evitar envíos duplicados (definiciones generales del Sprint).
- Botón Cancelar: si hay datos ingresados/modificados, pide confirmación antes de descartar y volver; si no hay cambios, vuelve directo — criterio 8. Reutiliza `DirtyStateContext` (de HU-A-03), sin crear un mecanismo nuevo.
- Endpoint de alta con Nombre, Apellido, DNI, Fecha de nacimiento (obligatorios) y Género (opcional).
- Validación de unicidad de DNI contra alumnos activos e inactivos, con revalidación inmediata antes del INSERT y defensa de constraint único (P2002).
- Creación de la ficha en estado activo, con registro de fecha de alta y usuario registrante.
- Permiso `alumnos:crear`, exclusivo de Mesa de Entrada — la opción "Nuevo alumno" solo es accesible para ese rol (criterio 1: "La opción solo está disponible para los roles autorizados; el servidor rechaza el intento desde otro rol").

**Explícitamente fuera de alcance de esta task:**
- Creación de la cuenta de acceso del alumno (HU-B-08).
- Búsqueda inteligente / filtros combinados en el listado (Sprint 2).
- Desactivación del alumno (Sprint 3).
- Datos de contacto (HU-B-02) y forma de pago preferida (HU-B-03) — se ofrecen como paso siguiente tras el alta, pero no se implementan en esta task.
- Listado completo de alumnos (HU-B-04) — la pantalla `alumnos/page.tsx` solo recibe el link mínimo para navegar al formulario, no se construye la tabla/listado.

---

## 4. Contrato Backend

### Schema Zod (`src/server/alumnos/alumno.schema.ts`)
```typescript
export function crearIdentidadAlumnoSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return z.object({
    nombre: z.string().trim().min(2).max(50)
      .regex(/^[\p{L}\s'-]+$/u, "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones")
      .transform((v) => v.replace(/\s+/g, " ")),
    apellido: z.string().trim().min(2).max(50)
      .regex(/^[\p{L}\s'-]+$/u, "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones")
      .transform((v) => v.replace(/\s+/g, " ")),
    dni: z.string().trim()
      .regex(/^\d+$/, "Ingresá el DNI solo con números")
      .min(dniLongitudMin).max(dniLongitudMax),
    fecha_nacimiento: fechaCalendarioValidaSchema
      .refine((d) => d <= new Date(), "La fecha de nacimiento no puede ser futura"),
    genero: z.enum(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICARLO"]).optional(),
  });
}
export type IdentidadAlumnoInput = z.infer<ReturnType<typeof crearIdentidadAlumnoSchema>>;
```

### Servicio (`src/server/alumnos/alumno.service.ts` → `crearAlumno`)
1. Verificar unicidad aplicativa de `dniAlumno` contra todos los alumnos, activos e inactivos, dentro de la misma transacción que el INSERT.
2. Si existe: error `DNI_DUPLICADO`, indicando en el mensaje si la ficha existente está inactiva.
3. Defensa de constraint único (P2002) capturada y traducida al mismo error, ante una alta simultánea con el mismo DNI (Regla N.° 7).
4. Insertar con `activoAlumno: true`, `createdAtAlumno`, `creadoPorUsuarioId` (columnas de auditoría — Regla N.° 2, patrón a).

### Route Handler (`POST /app/api/alumnos/route.ts`)
- `withPermission("alumnos:crear", ...)`.
- Schema `.safeParse()` antes de invocar el servicio (Regla N.° 6).
- Contrato estándar (Regla N.° 5): éxito `201 { data: { id, nombre, apellido, dni, activo }, error: null }`; error `409 { data: null, error: { code: "DNI_DUPLICADO", message } }`; error `400` con `flatten()` de Zod ante payload inválido; `401`/`403` según corresponda vía `withPermission`.

### Server Action (`crearAlumno()` en `app/(dashboard)/alumnos/actions.ts`)
Mismo contrato como objeto plano serializable, nunca `NextResponse`.

### Seed (`prisma/seed.ts`)
`alumnos:crear` agregado a `RolPermiso`, exclusivamente para `MESA_ENTRADA` (mismo patrón que `materias:crear` para `GERENTE`, de HU-L-01).

---

## 5. Frontend

**Ruta:** `src/app/(dashboard)/alumnos/nueva/page.tsx`, siguiendo el patrón ya usado en `materias/nueva/` (HU-L-01): mismo stack de componentes (shadcn/ui, Tailwind).

**Campos del formulario:** Nombre, Apellido, DNI, Fecha de nacimiento (obligatorios, con marca visible), Género (opcional, select con el enum real `Genero`).

**Comportamiento (criterios de aceptación 1, 8, 9 + definiciones generales del Sprint):**
1. Labels visibles y ayuda de formato en cada campo.
2. Conectado al Server Action `crearAlumno()` — la validación real es el schema Zod del servidor; el cliente solo agrega validación de UX básica (required, maxLength).
3. Si el Server Action devuelve error, se muestra junto al campo correspondiente (usando `parsed.error.flatten()` que ya devuelve el Server Action), sin perder los datos ya cargados, con foco en el primer campo inválido. Nunca se muestran mensajes técnicos.
4. Botón de submit deshabilitado + indicador de carga durante el envío, para evitar envíos duplicados.
5. Botón Cancelar conectado a `DirtyStateContext` (de HU-A-03, reutilizado, no se crea un mecanismo nuevo): si el formulario tiene cambios, pide confirmación antes de volver al listado; si no, vuelve directo.
6. La opción "Nuevo alumno" (accesible desde `alumnos/page.tsx`) solo se muestra/es efectiva para el rol Mesa de Entrada — enforcement real en el servidor vía `withPermission("alumnos:crear")`, la ocultación en el cliente es defensa en profundidad, no el control real.

---

## 6. Testing

### Unit
- `IdentidadAlumnoSchema`: casos válidos e inválidos por campo (nombre/apellido con números o símbolos, DNI con separadores, fecha futura, fecha inexistente como 31/02).
- `fechaCalendarioValidaSchema`: fechas límite de calendario (bisiestos, 31/02, 30/02).
- `crearAlumno`: unicidad de DNI (activo e inactivo), revalidación previa al INSERT.

### Postman / equivalente
- Alta exitosa (201).
- DNI duplicado, ficha existente activa (409).
- DNI duplicado, ficha existente inactiva (409, mensaje indica inactividad).
- Payload inválido por cada campo (400, `flatten()` de Zod).
- Intento desde rol sin permiso `alumnos:crear` (403).
- Sin sesión (401).
- Condición de carrera: dos altas simultáneas con el mismo DNI (una 201, una 409 vía constraint de base, nunca un 500).

### BD
- Verificar `activoAlumno: true`, `createdAtAlumno`, `creadoPorUsuarioId` tras el alta.
- Verificar constraint único de `dniAlumno` a nivel de base (P2002) ante alta simultánea.
- Verificar `RolPermiso` con `alumnos:crear` sembrado para `MESA_ENTRADA`.

### Frontend (verificado en el navegador real, Chrome, contra `next dev` + Postgres real — no simulado)

- ✅ **Criterio 1** (formulario + campos): navegando como `mesa.entrada@noctium.local` → `/alumnos` → click "Nuevo alumno" → `/alumnos/nueva` muestra el formulario con Nombre, Apellido, DNI, Fecha de nacimiento y Género, labels visibles, ayuda de formato bajo cada campo (incluye el rango real de `dni_longitud_min`/`max` traído del servidor, no hardcodeado), y marca `*` en los 4 campos obligatorios (Género no la lleva).
- ✅ **Criterio 1** (RBAC): logueado como `profesor1@noctium.local` (rol `PROFESOR`), el link "Nuevo alumno" no aparece en `/alumnos`. Navegación directa a `/alumnos/nueva` por URL → el servidor redirige a `/alumnos` (el `redirect()` de `nueva/page.tsx` corta antes de renderizar el formulario). El rechazo real ante un intento de envío (no solo el gateo de UI) ya estaba verificado en la ronda de testing backend: la Server Action devuelve `SIN_PERMISO` para ese mismo rol.
- ✅ **Criterio 9** (errores por campo, sin perder datos): submit con todos los campos vacíos → cada campo muestra su error específico debajo (`"El nombre debe tener al menos 2 caracteres"`, `"Ingresá el DNI solo con números"`, etc.), ningún mensaje técnico. Segunda prueba con DNI duplicado (mismo DNI de un alta anterior) → el error `"Ya existe un alumno registrado con ese DNI"` aparece solo bajo el campo DNI, y Nombre/Apellido/Fecha de nacimiento **conservan** los valores válidos que ya estaban cargados (no se perdieron ni se limpió el formulario).
- ✅ **Definiciones generales** (guardado en una sola operación): en ningún caso de error quedó una ficha parcial en la base — confirmado también a nivel servicio en la sección de arriba.
- ✅ **Definiciones generales** (botón deshabilitado + loading): el botón pasa a `"Guardando..."` y queda disabled durante el envío (mismo mecanismo que `materia-form.tsx`, `pendiente` + `disabled`).
- ✅ **Criterio 8** (Cancelar con confirmación): con datos cargados y sin guardar, click en "Cancelar" abre el diálogo "Datos sin guardar" (`DirtyStateContext` reutilizado, sin mecanismo nuevo); "Salir sin guardar" navega a `/alumnos`, "Seguir editando" lo cierra sin perder los datos.
- ✅ Alta exitosa end-to-end: completar el formulario con datos válidos → redirige a `/alumnos?creada=1` → banner verde "Alumno registrado correctamente".

**No verificado en esta ronda (no bloqueante, no lo pide la task):** el flujo de Cancelar con el formulario **sin** modificar (debería volver directo, sin diálogo) no se probó explícitamente por separado — se infiere del mismo código que gatea por `dirtyLocal`, pero no hay captura de ese caso puntual. Si se quiere evidencia específica de esa rama, queda pendiente.

Los alumnos de prueba creados durante esta ronda (DNI `30234567`) se borraron de la base al finalizar; la tabla `alumnos` quedó en 17 filas, el mismo baseline del seed.

---

## 7. Checklist de Definition of Done

- [x] Schema Zod implementado y testeado (unit).
- [x] Servicio `crearAlumno` implementado, con unicidad de DNI y revalidación previa al INSERT.
- [x] Route Handler `POST /api/alumnos` con permiso, validación Zod y contrato estándar.
- [x] Server Action `crearAlumno()` equivalente.
- [x] Permiso `alumnos:crear` sembrado para `MESA_ENTRADA` en `prisma/seed.ts`.
- [x] Lint limpio (`npm run lint`, 0 errores/warnings).
- [x] Build limpio (`npm run build`, compila y tipa sin errores).
- [x] Backend verificado contra el sistema real (3 casos: alta 201, DNI duplicado 409, sin sesión 401).
- [x] Formulario "Nuevo alumno" implementado (criterios 1, 8, 9).
- [x] Lint y build limpios tras agregar el frontend (`npm run lint` sin salida, `npm run build` compila y tipa sin errores, incluye `/alumnos/nueva`).
- [x] Flujo de frontend probado en el navegador — por el agente, contra `next dev` real (ver sección 6). **Pendiente que Adriel lo repita él mismo** antes de dar el OK final; no reemplaza esa verificación, la complementa.
- [x] Evidencia de testing en los 3 niveles + frontend documentada en la sección 6 (un caso menor sin cubrir, anotado explícitamente, no se marcó como pasado).
- [ ] Código subido al repo en branch propia, sin tocar alcance de otras HU. — **Pendiente**: por pedido explícito, todavía no se hizo commit/push.