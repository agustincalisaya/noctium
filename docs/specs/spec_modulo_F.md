```markdown
# Especificación Técnica — Módulo F (Personal de mesa de entrada)
## Noctium — Sprint 3
## Revisión 1 — Sprint 3: alta y modificación (HU-F-01), listado (HU-F-03), baja y reactivación (HU-F-05)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 · Prisma ORM (`prisma-client`) · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` §2.4 (matriz RBAC) y §2.5 (servicios de cuentas) · `spec_modulo_D.md` §2.1, §2.2, §2.6 (patrón de ficha con identidad y contacto) · `spec_modulo_B.md` §2.7 y §3.9 (criterio de búsqueda) · `spec_modulo_I.md` (caja, HU-I-12) · `PR-0.md` §2.7, §2.9, §2.13, §2.14, §2.16 · `schema.prisma` · `docs/adicionales/mapa-pantallas-sprint-3.md` (fichas P-45, P-46 y M-43, decisiones DEC-14, 15, 37, 38, 39 y 44) · Backlog Sprint 3 (HU-F-01, HU-F-03, HU-F-05, HU-A-06, HU-I-12, HU-C-23)

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-F-01 | Sin spec (el módulo F no existía) | Añadidas secciones 2.1 (alta) y 2.2 (modificación) |
| HU-F-03 | Sin spec | Añadidas secciones 2.3 (listado y búsqueda) y 2.4 (detalle de la ficha) |
| HU-F-05 | Sin spec | Añadidas secciones 2.5 (desactivar) y 2.6 (reactivar) |
| Servicios públicos | — | Añadida sección 2.7 |

**Puntos a confirmar antes de implementar** (se resuelven con el responsable del PR 0 o con el PO; ninguno cambia un criterio del backlog):
| # | Punto | Quién |
|---|---|---|
| P-F1 | `PR-0.md` §2.7 no lista `version`, los campos normalizados (`nombreNormalizado…`, `apellidoNormalizado…`) ni el índice de orden del listado para `FichaMesaEntrada`. Esta spec los usa (mismo patrón que `Profesor`): pedir que el PR 0 los incluya, porque las HU no agregan migraciones | PR 0 |
| P-F2 | Nombres de las acciones de permiso (`personal:crear`, `:editar`, `:leer`, `:cambiar_estado`): son propuestos. Los fija la tabla cerrada de `PR-0.md` §2.9 («Decisiones tomadas») | PR 0 |
| P-F3 | `PR-0.md` §2.13 no lista dos lecturas de cuentas que esta spec necesita: `verificarEmailNoAsociadoAOtraCuenta` (existe en `spec_modulo_A.md` §2.5, firma a confirmar contra el código) y `obtenerResumenCuenta` (sección «Cuenta de acceso» de HU-A-06, criterio 5). Tampoco lista la **lectura del historial de estados** (`listarHistorialEstados(entidad, id)`) que muestran las fichas (DEC-37): la publica el PR 0 (R7-PR0-1) en el servicio compartido (criterio 5 del mapa); ya no la agrega HU-D-08 | PR 0 / HU-A-06 / HU-D-08 |
| P-F4 | `bloquear` (`PR-0.md` §2.16) toma recursos «aula, materia, profesor, alumno». La ficha del personal es un recurso más (mismo nivel del orden de bloqueo): hay que agregarlo ahí | PR 0 |
| P-F5 | ~~«Registró operaciones»~~ **Resuelto por DEC-39 del mapa de pantallas** (pagos, cajas, inscripciones desde el centro, cambios de estado, de tarifa y de parámetros; en la duda, se pide el motivo). Esta spec lo implementa con una función compartida (2.7). Falta que el PO valide DEC-39 (el mapa lo deja «para validar, sin bloquear») | PO |
| P-F6 | Supuestos que la HU no define (ver 2.2, 2.3 y 3.9): se puede modificar una ficha inactiva; texto de «sin resultados» de la búsqueda; texto del motivo faltante | PO |

---

## 1. Visión General

El Módulo F gestiona la ficha del **personal de mesa de entrada**: identidad, contacto, alta y baja lógica, con su cuenta de acceso (`Usuario` con rol `MESA_ENTRADA`). Lo opera **solo el Gerente**. Es la contraparte de `spec_modulo_G.md` (gerentes): las dos specs tienen el mismo diseño y las mismas reglas; cambia la entidad, el rol de la cuenta, el texto de los mensajes y dos reglas propias de cada una (caja abierta en F; «no autodesactivarse» y «al menos un gerente activo» en G).

**Diferencia clave con el Módulo D:** en D la ficha y la cuenta son independientes (el profesor no tiene cuenta por defecto, `spec_modulo_D.md` §3.1). Acá, siguiendo HU-A-06, **la ficha y la cuenta son una unidad**: se crean juntas, el email de la ficha es el email de la cuenta, y la baja y la reactivación afectan a las dos en la misma transacción (regla 3.1).

**Modelo de datos** (lo crea el PR 0, `PR-0.md` §2.7 y §2.14; esta spec no agrega migraciones). Los nombres siguen la convención de sufijo del repo y se confirman contra el `schema.prisma` que deje el PR 0:

| Campo | Notas |
|---|---|
| `idFichaMesaEntrada` | CUID |
| `usuarioId` | `String? @unique`, cuenta vinculada. Toda ficha creada por esta spec nace con cuenta |
| `activoFichaMesaEntrada` | `Boolean @default(true)`. Baja lógica (Regla N.° 1) |
| `nombre…`, `apellido…` | identidad, texto |
| `nombreNormalizado…`, `apellidoNormalizado…` | `normalizarTexto()`; sostienen el orden y la búsqueda (P-F1) |
| `dni…` | `@unique`: único **por tipo de ficha**, activas e inactivas |
| `fechaNacimiento…` | `@db.Date` |
| `genero…` | `Genero?` (enum del schema) |
| `telefono…` | `String?` |
| `email…` | obligatorio; igual al email de la cuenta |
| `creadoPorUsuarioId`, `createdAt…` | alta (Regla N.° 2, opción (a)) |
| `modificadoPorUsuarioId`, `updatedAt…` | última modificación |
| `version` | `Int @default(0)`, concurrencia optimista (P-F1) |
| Índice | `(apellidoNormalizado…, nombreNormalizado…, dni…)` para el orden del listado |

**Estructura de archivos (Regla N.° 11):** tipos en `src/types/personal.types.ts`; Server Actions en `src/server/personal/actions.ts`; schemas en `src/server/personal/personal.schema.ts`; lógica en `src/server/personal/personal.service.ts`; servicios públicos en `src/server/personal/personal.publico.ts` (Regla N.° 3). Toda pantalla nueva llama a `exigirPermiso` (`PR-0.md` §2.7).

**Mapa de pantallas** (`docs/adicionales/mapa-pantallas-sprint-3.md`: las rutas son las «sugeridas» del mapa; las reales las fija `src/server/shared/rutas-por-rol.ts`):
| Operación (sección) | Pantalla del mapa | Ruta | Menú |
|---|---|---|---|
| Listado y búsqueda (2.3) | P-45 | `/personal` | «Personal de mesa de entrada» (solo Gerente) |
| Alta (2.1) | P-46, modo alta | `/personal/nuevo` | — |
| Detalle (2.4), desactivar (2.5), reactivar (2.6) | P-46, modo consulta + M-43 (modal de confirmación) | `/personal/[id]` | — |
| Modificación (2.2) | P-46, modo edición | `/personal/[id]/editar` | — |

**Quién construye qué (DEC-38):** HU-F-01 y HU-F-03 las toma el mismo developer. HU-F-01 crea `/personal` con el botón «Nuevo integrante» y una tabla mínima (el mismo `GET /api/personal` sin `q`); HU-F-03 le suma búsqueda y paginación. Esta spec es el contrato; el mapa decide dónde va cada cosa en la pantalla y el prototipo la muestra. Si el mapa o el prototipo y esta spec se contradicen, no se resuelve por inferencia: se avisa al PO (método del Sprint 2).

**Utilidades compartidas nuevas** (puras y sin estado; las crea la primera HU que las necesita, F-01 y F-03, y las reutiliza G, sin acoplamiento de dominio):
- `src/server/shared/identidad-persona.schema.ts` → `construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax)`: Nombre y Apellido (2–50, letras, espacios, acentos, apóstrofes y guiones, espacios colapsados), DNI solo numérico con la longitud configurada, fecha de nacimiento válida y no futura (`fechaCalendarioValidaSchema`), género opcional (`z.nativeEnum(Genero)`). Es la misma definición de `spec_modulo_D.md` §2.1 sin el contacto.
- `src/server/shared/busqueda-persona.ts` → `tokenizarBusqueda(q)`: el criterio de HU-B-05 (`spec_modulo_B.md` §2.7): menos de 2 caracteres tras `trim` se ignora, se normaliza con `normalizarTexto()` y se parte en tokens (máximo 5). Cada módulo arma su propio `where` con sus campos. `construirFiltroBusquedaAlumno()` de B **no se toca** (puede adoptarla después).

**Textos:** todos los textos visibles (mensajes, etiquetas, confirmaciones) salen del archivo central de HU-C-23. Esta spec cita los literales del backlog para identificarlos; el servicio nunca devuelve textos, lanza `ErrorDeDominio(codigo)` (`PR-0.md` §2.13).

**Alcance de esta revisión:** módulo nuevo; no hay secciones previas que preservar. Las próximas revisiones agregan secciones al final sin renumerar (`docs/adicionales/sdd-metodologia.md`).

**Fuera de alcance:** que el integrante se modifique a sí mismo desde «Mi cuenta» (HU-A-06, criterio 4, cambio de contraseña); gestión de roles; borrado físico; cierre por ausencia de caja (HU-I-12).

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- `[id]` es el CUID de `FichaMesaEntrada`. `"cuid"` en los ejemplos es ilustrativo.
- Toda ruta requiere sesión autenticada y `withPermission("personal:<accion>")` (Regla N.° 10). Las acciones son **exclusivas del rol GERENTE**; cualquier otro rol recibe `403 SIN_PERMISO` (HU-F-01 c7, HU-F-03 c5, HU-F-05 c6).
- Las operaciones de escritura usan `transaccion(fn)` y `ErrorDeDominio` (`PR-0.md` §2.16).
- `actor` en las llamadas a servicios compartidos es el actor de la sesión (forma exacta: `PR-0.md` §2.13, «Decisiones tomadas»).

---

### 2.1. Alta de un integrante (HU-F-01, criterios 1 a 4, 6 y 7)

**Ruta:** `POST /api/personal`
**Server Action equivalente:** `crearIntegrante()` en `src/server/personal/actions.ts`
**Servicio:** `crearIntegrante(input, usuarioRegistranteId)` en `src/server/personal/personal.service.ts`
**Permiso requerido:** `personal:crear`
**Pantalla:** P-46, modo alta (`/personal/nuevo`), desde «Nuevo integrante». Dos secciones: Identidad y Contacto. Errores junto al campo y sin cambios parciales (c2).
**Confirmación (HU-C-25, DEC-15):** antes de llamar al servicio, la pantalla pide «¿Estás seguro de que querés registrar a <Nombre> <Apellido> como mesa de entrada?» y avisa que se crea la cuenta con ese email y el DNI como contraseña inicial. Es una confirmación de interfaz: el servidor valida igual todo.

```typescript
// src/server/personal/personal.schema.ts
export function construirAltaIntegranteSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax).extend({
    // Contacto (HU-F-01 c1 y c2)
    email: emailContactoSchema, // obligatorio: «Ingresá el email: con él se crea la cuenta de acceso»
    telefono: campoOpcional(telefonoContactoSchema), // 8-15 dígitos, normalizado
  }).strict();
}
export type AltaIntegranteInput = z.infer<ReturnType<typeof construirAltaIntegranteSchema>>;
```
`emailContactoSchema` y `telefonoContactoSchema` son los de `src/server/shared/contacto.schema.ts` (email en minúsculas, formato válido, hasta 254 caracteres). El largo del DNI sale de `ParametroSistema` (mismos parámetros que HU-B-01 y HU-D-01). El mismo schema se usa en el formulario, la Server Action y el Route Handler. `.strict()` rechaza `activo`, `usuarioId`, rol y cualquier campo ajeno (el rol de la cuenta lo fija el tipo de ficha, HU-A-06 c2).

**Comportamiento esperado (`crearIntegrante`), todo dentro de una única `transaccion`:**
1. Unicidad de DNI contra **todas** las fichas de mesa de entrada, activas e inactivas: si existe, `409 DNI_DUPLICADO`. No se compara contra Alumno, Profesor ni Gerente (regla 3.2).
2. Unicidad del email contra las cuentas existentes con `verificarEmailNoAsociadoAOtraCuenta(tx, email)` (módulo A): `409 EMAIL_YA_ASOCIADO`, sin revelar a quién pertenece.
3. `crearCuentaParaFicha(tx, { email, dni, rol: "MESA_ENTRADA" })` (módulo A): crea la cuenta con el email como usuario, el DNI como contraseña inicial (guardada solo como hash por A) y `debeCambiarPassword = true`. Devuelve el `usuarioId`. Este módulo **nunca** ve ni guarda la contraseña (regla 3.8).
4. Insertar la ficha con `activo = true`, `usuarioId`, nombres normalizados con `normalizarTexto()`, `creadoPorUsuarioId = usuarioRegistranteId`, `version = 0` y fecha de alta.
5. Si cualquier paso falla, la transacción se revierte completa: no queda ficha sin cuenta ni cuenta sin ficha (HU-F-01 c4 y c6, HU-A-06 c2).
6. Defensa de constraints: `P2002` sobre el DNI de la ficha → `409 DNI_DUPLICADO`; `P2002` sobre `emailUsuario` → `409 EMAIL_YA_ASOCIADO`. El `catch` envuelve la transacción (mismo patrón que `spec_modulo_D.md` §2.1 paso 3).

La verificación «al salir del campo» de DNI y email (HU-F-01 c3) es una consulta de UI hacia el mismo servicio de unicidad; el servidor la repite siempre al confirmar.

**Respuesta `201 Created`:**
```json
{
  "data": {
    "id": "cuid", "nombre": "Lucía", "apellido": "Fernández", "dni": "30123456",
    "email": "lucia.fernandez@mail.com", "telefono": null, "activo": true,
    "cuenta": { "email": "lucia.fernandez@mail.com", "rol": "MESA_ENTRADA", "estado": "ACTIVA", "debeCambiarPassword": true }
  },
  "error": null
}
```
La interfaz muestra «Integrante registrado correctamente» completado con la cuenta creada según HU-A-06, criterio 5 («Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso»).

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido (email faltante: «Ingresá el email: con él se crea la cuenta de acceso»).
- `403 SIN_PERMISO` — sin `personal:crear`.
- `409 DNI_DUPLICADO` — «Ya existe un integrante de mesa de entrada con ese DNI».
- `409 EMAIL_YA_ASOCIADO` — el email ya está en uso por otra cuenta (sin decir de quién).

**Cancelar (HU-F-01 c7):** vuelve al listado sin guardar; si hay datos ingresados pide confirmación (mismo patrón `DirtyStateContext` de `spec_modulo_D.md` §2.6).

---

### 2.2. Modificar un integrante (HU-F-01, criterios 5 y 7)

**Ruta:** `PATCH /api/personal/[id]`
**Server Action equivalente:** `modificarIntegrante()` en `src/server/personal/actions.ts`
**Servicio:** `modificarIntegrante(id, input, usuarioId)` en `src/server/personal/personal.service.ts`
**Permiso requerido:** `personal:editar`
**Pantalla:** P-46, modo edición (`/personal/[id]/editar`, botón «Editar» de la ficha), con el mismo formulario del alta precargado. «Guardar» permanece deshabilitado si no hay cambios.
**Confirmación (HU-C-25, DEC-15):** «¿Estás seguro de que querés guardar los cambios de <Nombre> <Apellido>?», con aviso si cambia el email de ingreso (porque cambia también el de la cuenta). El cambio de email **no revoca sesiones** (`cambiarEmailCuenta`, `PR-0.md` §2.13).

```typescript
// Campo ausente = no se toca. El email no se puede vaciar (es el de la cuenta); el teléfono sí (null = quitar).
export function construirModificarIntegranteSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax).partial().extend({
    email: emailContactoSchema.optional(),
    telefono: telefonoContactoSchema.nullable().optional(),
    version: z.number().int().nonnegative(), // concurrencia optimista, obligatorio
  }).strict();
}
```
Cadena vacía en `telefono` no significa «quitar»: se rechaza; la UI envía `null` (mismo criterio que `spec_modulo_D.md` §2.6).

**Comportamiento esperado, en una única `transaccion`:**
1. La ficha debe existir: `404 INTEGRANTE_NO_ENCONTRADO`. Si ningún campo cambia respecto de los valores actuales: `200` con `campos_modificados: []`, sin escribir.
2. Si cambia `dni`: unicidad **excluyendo la propia ficha**, contra todas las demás (activas e inactivas): `409 DNI_DUPLICADO`.
3. Si cambia `email`: `verificarEmailNoAsociadoAOtraCuenta(tx, email)`: `409 EMAIL_YA_ASOCIADO`. Un email sin cambios no se revalida.
4. Si cambian nombre o apellido, recalcular los campos normalizados.
5. **Concurrencia optimista (Regla N.° 7):**
   ```typescript
   const r = await tx.fichaMesaEntrada.updateMany({
     where: { idFichaMesaEntrada: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ErrorDeDominio("errores.general.conflictoEdicion");
   ```
6. Solo se escriben los campos enviados cuyo valor cambia. `updatedAt…` lo actualiza Prisma.
7. Si cambió el email y la ficha tiene `usuarioId`: `cambiarEmailCuenta(tx, { usuarioId, email })` (módulo A, HU-A-06 c6) en la misma transacción. **El email de la ficha y el de la cuenta se mantienen iguales** (regla 3.3). Cambiar el DNI **no** toca la contraseña de la cuenta.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["telefono", "email"], "version": 3 }, "error": null }
```
La interfaz muestra «Integrante actualizado correctamente».

**Errores esperados:** `400 VALIDATION_ERROR` · `403 SIN_PERMISO` · `404 INTEGRANTE_NO_ENCONTRADO` · `409 DNI_DUPLICADO` · `409 EMAIL_YA_ASOCIADO` · `409 CONFLICTO_EDICION_CONCURRENTE` («La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.»).

**Supuesto (P-F6):** se puede modificar una ficha inactiva (corregir un dato no la reactiva). El DNI y el email siguen reservados.

---

### 2.3. Listado y búsqueda del personal (HU-F-03, criterios 1, 2, 4 y 5)

**Ruta:** `GET /api/personal`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarPersonal(query)` en `src/server/personal/personal.service.ts`
**Permiso requerido:** `personal:leer`
**Pantalla:** P-45 (`/personal`). Por DEC-38, HU-F-01 deja una tabla mínima sin búsqueda ni paginación y HU-F-03 completa este contrato.

```typescript
export const POR_PAGINA_PERSONAL = 10; // fijo (HU-F-03 c1): no es parámetro
export const ListarPersonalQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  q: z.string().trim().max(100).optional(), // búsqueda de HU-F-03 c2
}).strict();
```

**Comportamiento esperado:**
1. **Orden:** `apellidoNormalizado`, `nombreNormalizado` ascendente, con el DNI como último desempate (HU-F-03 c1).
2. **Búsqueda:** `tokenizarBusqueda(q)` (criterio de HU-B-05). Cada token debe coincidir de forma parcial con `apellidoNormalizado…`, `nombreNormalizado…`, o `dni…` si el token es solo dígitos; entre tokens AND, entre campos OR. Un `q` de menos de 2 caracteres se ignora y devuelve el listado completo. Opera sobre activos e inactivos.
3. **Incluye** las fichas de prueba que crea el seed del PR 0 (son filas comunes).
4. La paginación y el `total` son sobre el resultado filtrado.
5. Solo lectura: no escribe nada.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "apellido": "Fernández", "nombre": "Lucía", "dni": "30123456",
        "telefono": null, "email": "lucia.fernandez@mail.com", "activo": true }
    ],
    "pagina": 1, "por_pagina": 10, "total": 1, "total_paginas": 1
  },
  "error": null
}
```

**Comportamiento de la pantalla (cliente):**
- Columnas: Apellido, Nombre, DNI, Teléfono (`—` si falta), Email, Estado («Activo»/«Inactivo»).
- Cada fila enlaza a la ficha (`/personal/[id]`), desde donde se accede a modificar (2.2) y a desactivar o reactivar (2.5, 2.6) (HU-F-03 c3).
- **Sin integrantes** (`total = 0` y sin `q`): «Todavía no hay personal de mesa de entrada registrado», con acceso a «Nuevo integrante» (c4).
- **Sin resultados con `q`:** texto a definir en el archivo central (mismo patrón que HU-B-05, P-F6), conservando «Nuevo integrante».
- Buscador con la misma mecánica que `/alumnos` (`spec_modulo_B.md` §2.7: mínimo 2 caracteres, debounce, `pagina=1` al cambiar el texto).

**Errores esperados:** `400 VALIDATION_ERROR` (`pagina` o `q` inválidos) · `403 SIN_PERMISO`.

---

### 2.4. Detalle de la ficha (HU-F-03 criterio 3, HU-F-01 criterio 5, HU-F-05, HU-A-06 criterio 5)

**Ruta:** `GET /api/personal/[id]`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `obtenerDetalleIntegrante(id)` en `src/server/personal/personal.service.ts`
**Permiso requerido:** `personal:leer`
**Pantalla:** P-46, modo consulta (`/personal/[id]`).

**Comportamiento esperado:** devuelve todo lo que muestra la ficha del mapa (P-46) para que la pantalla no consulte nada más:
- La ficha completa, `version` (para modificar, desactivar y reactivar), fecha de alta (`creadoEl`) y de última modificación (`modificadoEl`, `null` si nunca se modificó; la pantalla muestra «Sin cambios»).
- La sección **«Cuenta de acceso»** (HU-A-06 c5): email, rol y estado, con `obtenerResumenCuenta(usuarioId)` del módulo A (P-F3). Estados: `ACTIVA` (con `debeCambiarPassword`), `INACTIVA` (ficha dada de baja) y `SIN_CUENTA` (ficha sin cuenta vinculada, DEC-14; sin acción para crearla).
- El **historial de estados** (fecha, acción, usuario y motivo, DEC-37), del más reciente al más antiguo, con `listarHistorialEstados("FICHA_MESA_ENTRADA", id)` (P-F3). El usuario se muestra con `obtenerNombresGerentes` (`spec_modulo_G.md` §2.7).
- Dos indicadores de solo lectura para que la pantalla decida antes de confirmar, **sin bloquear nada** (el servidor repite la validación en 2.5):
  - `cajaAbierta` (`cajaAbiertaDe`, módulo I): si es `true`, la pantalla muestra el rechazo de HU-F-05 c2 **en lugar** de la confirmación (el prototipo ofrece ir a «Cierres de caja»).
  - `motivoObligatorioAlDesactivar` (`usuarioRegistroOperaciones`, 2.7): la pantalla marca el motivo como obligatorio u opcional.

La pantalla muestra «Editar» solo con `personal:editar`, «Desactivar» solo si la ficha está activa y hay `personal:cambiar_estado`, y «Reactivar» solo si está inactiva y hay `personal:cambiar_estado`.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "id": "cuid", "version": 3, "activo": true,
    "nombre": "Julián", "apellido": "Ferreyra", "dni": "31222333",
    "fechaNacimiento": "1986-09-03", "genero": "MASCULINO",
    "telefono": "+541155500003", "email": "mesa.entrada@noctium.local",
    "creadoEl": "2025-02-03T12:00:00.000Z", "modificadoEl": null,
    "cuenta": { "email": "mesa.entrada@noctium.local", "rol": "MESA_ENTRADA", "estado": "ACTIVA", "debeCambiarPassword": false },
    "historialEstados": [],
    "cajaAbierta": false,
    "motivoObligatorioAlDesactivar": false
  },
  "error": null
}
```
`cuenta` es `null` si la ficha no tiene cuenta vinculada (la pantalla muestra «Sin cuenta»).

**Errores esperados:** `403 SIN_PERMISO` · `404 INTEGRANTE_NO_ENCONTRADO`.

---

### 2.5. Desactivar un integrante (HU-F-05, criterios 1 a 4 y 6)

**Ruta:** `POST /api/personal/[id]/desactivar`
**Server Action equivalente:** `desactivarIntegrante()` en `src/server/personal/actions.ts`
**Servicio:** `desactivarIntegrante(id, input, actor)` en `src/server/personal/personal.service.ts`
**Permiso requerido:** `personal:cambiar_estado`
**Pantalla:** acción «Desactivar» de la ficha (P-46), con el modal M-43: «¿Estás seguro de que querés desactivar a <integrante>? No podrá ingresar al sistema.», el aviso de que su cuenta pasa a inactiva y se cierran sus sesiones, y el campo de motivo (hasta 300 caracteres). Es reversible: no lleva «Esta acción no se puede deshacer.». Los rechazos del servidor se muestran dentro del mismo modal (HU-C-25 c6).

```typescript
export const DesactivarIntegranteSchema = z.object({
  motivo: z.string().trim().max(300).optional(), // vacío = no enviado
  version: z.number().int().nonnegative(),
}).strict();
```

**Comportamiento esperado (`desactivarIntegrante`), en una única `transaccion`:**
1. Bloquear la ficha con `SELECT … FOR UPDATE` (recurso, nivel 1 del orden de `PR-0.md` §2.10; P-F4).
2. La ficha debe existir (`404`), estar activa (`409 INTEGRANTE_YA_INACTIVO`) y tener la `version` recibida (`409 CONFLICTO_EDICION_CONCURRENTE`).
3. **Caja abierta:** `cajaAbiertaDe(tx, ficha.usuarioId)` (módulo I, solo lectura). Si tiene caja abierta: `409 CAJA_ABIERTA` — «El integrante tiene la caja abierta. Tiene que cerrarla (o hacé un cierre por ausencia) antes de desactivarlo.» (HU-F-05 c2, HU-I-12 c10). Garantía de que no se abra una caja en medio de la baja: regla 3.4.
4. **Motivo:** si el integrante registró operaciones (`usuarioRegistroOperaciones(tx, usuarioId)`, 2.7, criterio de DEC-39) y no vino `motivo`: `400 MOTIVO_REQUERIDO`. Si no registró operaciones, el motivo es opcional (HU-F-05 c1, Regla N.° 1). En la duda, se pide el motivo.
5. Cambiar el estado con condición atómica (Regla N.° 7):
   ```typescript
   const r = await tx.fichaMesaEntrada.updateMany({
     where: { idFichaMesaEntrada: id, activoFichaMesaEntrada: true, version: input.version },
     data: { activoFichaMesaEntrada: false, version: { increment: 1 }, modificadoPorUsuarioId: actor.usuarioId },
   });
   if (r.count === 0) throw new ErrorDeDominio("errores.general.conflictoEdicion");
   ```
6. Si la ficha tiene `usuarioId`: `desactivarCuenta(tx, usuarioId)` y `revocarSesiones(tx, usuarioId)` (módulo A, `sesionesValidasDesde = ahora`, `PR-0.md` §2.7). Toda sesión iniciada antes se rechaza en la próxima solicitud (RNF-SEG-04, mismo mecanismo que HU-D-08 c4).
7. `registrarCambioEstado(tx, { entidad: "FICHA_MESA_ENTRADA", id, accion: "DESACTIVAR", motivo, actor })`. El servicio compartido lo encola en `despuesDelCommit`: se escribe **después** de confirmada la transacción (Regla N.° 2, opción (b); HU-F-05 c2).

El integrante desactivado ve «La cuenta está inactiva. Comunicate con la administración» al intentar ingresar (mensaje de HU-A-01, sin cambios).

**Conservación (HU-F-05 c3 y c4):** no se borra nada. Las operaciones que registró (alumnos, turnos, pagos, etc.) conservan su `usuarioId` y siguen mostrando su nombre como responsable. Su DNI y su email siguen reservados. Sigue en el listado con la etiqueta «Inactivo».

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "activo": false, "version": 4 }, "error": null }
```
La interfaz muestra «Integrante desactivado correctamente».

**Errores esperados:**
- `400 VALIDATION_ERROR` · `400 MOTIVO_REQUERIDO` (texto a definir en el archivo central, P-F6).
- `403 SIN_PERMISO`.
- `404 INTEGRANTE_NO_ENCONTRADO`.
- `409 INTEGRANTE_YA_INACTIVO` · `409 CAJA_ABIERTA` · `409 CONFLICTO_EDICION_CONCURRENTE`.

---

### 2.6. Reactivar un integrante (HU-F-05, criterios 5 y 6)

**Ruta:** `POST /api/personal/[id]/reactivar`
**Server Action equivalente:** `reactivarIntegrante()` en `src/server/personal/actions.ts`
**Servicio:** `reactivarIntegrante(id, input, actor)` en `src/server/personal/personal.service.ts`
**Permiso requerido:** `personal:cambiar_estado`
**Pantalla:** acción «Reactivar» de la ficha inactiva (P-46), con el modal M-43: «¿Estás seguro de que querés reactivar a <integrante>?». No pide motivo. Avisa que las sesiones cerradas en la baja no se restauran.

```typescript
export const ReactivarIntegranteSchema = z.object({ version: z.number().int().nonnegative() }).strict();
```

**Comportamiento esperado, en una única `transaccion`:**
1. Bloquear la ficha (`FOR UPDATE`); debe existir (`404`), estar inactiva (`409 INTEGRANTE_YA_ACTIVO`) y tener la `version` recibida (`409 CONFLICTO_EDICION_CONCURRENTE`).
2. `updateMany` con condición atómica (`activo = false` y `version`), `activo = true`, `version + 1`, `modificadoPorUsuarioId`.
3. Si tiene `usuarioId`: `reactivarCuenta(tx, usuarioId)`. **No** se restauran las sesiones revocadas en la baja: debe iniciar sesión de nuevo (HU-F-05 c5). La marca `debeCambiarPassword` se conserva tal como estaba (HU-A-06 c7).
4. `registrarCambioEstado(tx, { entidad: "FICHA_MESA_ENTRADA", id, accion: "REACTIVAR", actor })`, después del commit. Se conservan todas las bajas y reactivaciones.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "activo": true, "version": 5 }, "error": null }`. La interfaz muestra «Integrante reactivado correctamente».

**Errores esperados:** `400 VALIDATION_ERROR` · `403 SIN_PERMISO` · `404 INTEGRANTE_NO_ENCONTRADO` · `409 INTEGRANTE_YA_ACTIVO` · `409 CONFLICTO_EDICION_CONCURRENTE`.

---

### 2.7. Servicios públicos del módulo

Conforme a la Regla N.° 3. Funciones en `src/server/personal/personal.publico.ts`. El parámetro `tx`/`db` recibe el `Prisma.TransactionClient` del llamador. Este archivo no importa nada de otros módulos de dominio (evita ciclos con Caja).

| Función | Devuelve | Consumidores |
|---|---|---|
| `bloquearIntegranteActivo(tx, usuarioId)` | `Promise<void>`. Lee la ficha vinculada a la cuenta con `SELECT … FOR SHARE`; lanza `ErrorDeDominio("errores.personal.integranteInactivo")` si no existe o está inactiva | HU-I-12 (`abrirCaja`), regla 3.4 |
| `obtenerNombresPersonal(usuarioIds, db?)` | `Record<usuarioId, "Apellido, Nombre">` | pantallas que muestren al responsable de una operación (HU-C-23: texto desde el archivo central) |

**Funciones de otros módulos que este módulo consume** (cada una debe existir en la fachada `*.publico.ts` de su dueño):

| Función | Dueño | Estado |
|---|---|---|
| `crearCuentaParaFicha`, `cambiarEmailCuenta`, `desactivarCuenta`, `reactivarCuenta`, `revocarSesiones` | A (`cuenta.service.ts`) | definidas en `PR-0.md` §2.13 |
| `verificarEmailNoAsociadoAOtraCuenta`, `obtenerResumenCuenta` | A | `verificarEmailNoAsociadoAOtraCuenta` es **existente** (`spec_modulo_A.md` 2.5); `obtenerResumenCuenta` está **definida** en `spec_modulo_A.md` 2.9 (P-A13) |
| `cajaAbiertaDe(tx, usuarioId)` | I (`caja.service.ts`) | definida en `PR-0.md` §2.13 |
| `registrarCambioEstado` | compartido | definida en `PR-0.md` §2.13 |
| `listarHistorialEstados(entidad, id, db?)` | compartido | **publicada por el PR 0** (R7-PR0-1; P-F3): ya no la agrega HU-D-08 |
| `obtenerNombresGerentes(usuarioIds, db?)` | G | `spec_modulo_G.md` §2.7 |
| `usuarioRegistroOperaciones(tx, usuarioId)` → `boolean` | compartido (ver abajo) | **nueva** (DEC-39) |

**«Registró operaciones» (DEC-39).** Cuenta cualquier registro que guarde a la persona como actor: pagos, correcciones y anulaciones; cajas, movimientos y ajustes; inscripciones hechas desde el centro (y las clases creadas, si el modelo guarda quién las creó); cambios de estado, de tarifa y de parámetros. Cada módulo dueño expone en su fachada una lectura `usuarioRegistroOperaciones(usuarioId, db?)` sobre sus propias tablas (`existe` por columna de actor): I (pagos, correcciones, anulaciones, cajas, movimientos, ajustes), C (inscripciones desde el centro; clases creadas), L (historial de tarifas), N (historial de parámetros) y el historial de estados compartido. Un agregador único, `src/server/shared/actividad-usuario.ts`, las recorre en orden y devuelve `true` si alguna lo es; **cada HU suma su propia línea** (mismo criterio que el punto de extensión de fixtures de `PR-0.md` §2.16). Las fachadas no importan el agregador, para no crear ciclos. La primera HU que lo necesita lo crea: HU-F-05 con las de I, C, L y el historial de estados; HU-N-01 suma la suya. Lo consumen HU-F-05 y HU-G-05.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside exclusivamente en `src/server/personal/personal.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. La ficha y la cuenta son una unidad
Alta, cambio de email, baja y reactivación afectan a la ficha y a su cuenta **en la misma transacción** (HU-A-06 c2, c6 y c7). Si la cuenta no se puede crear, la ficha tampoco; si la baja no puede desactivar la cuenta, la ficha sigue activa. Ningún otro código (ni el seed, salvo para las fichas de prueba) crea fichas sin pasar por `crearCuentaParaFicha`.

### 3.2. Unicidad de DNI acotada a `FichaMesaEntrada`
Doble validación (aplicativa dentro de la transacción + constraint `@unique` con captura de `P2002`), contra activas e inactivas. No hay verificación cruzada con Alumno, Profesor ni Gerente: son tablas independientes (mismo criterio que `spec_modulo_D.md` §3.2). El DNI de una ficha inactiva sigue contando (HU-F-05 c4).

### 3.3. El email de la ficha es el email de la cuenta
A diferencia de `spec_modulo_D.md` §2.6 paso 7 (donde son independientes), acá se sincronizan: cambiar uno cambia el otro, con la misma validación de unicidad y en la misma transacción (HU-A-06 c6).

### 3.4. No se puede dar de baja a quien tiene la caja abierta, ni abrir caja durante la baja
`cajaAbiertaDe` es una lectura sin bloqueo, así que por sí sola no impide que el integrante abra una caja justo entre la verificación y el commit. El contrato que lo cierra es de dos partes:
1. `desactivarIntegrante` toma `FOR UPDATE` sobre la ficha (nivel de recurso) **antes** de leer la caja.
2. `abrirCaja` (HU-I-12) llama a `bloquearIntegranteActivo(tx, usuarioId)` (`FOR SHARE` sobre la misma ficha) **antes** de insertar la caja.

Las dos transacciones se serializan sobre la fila de la ficha: si la caja se abre primero, la baja la ve y se rechaza (`CAJA_ABIERTA`); si la baja gana, `abrirCaja` encuentra la ficha inactiva y falla. El orden de bloqueo respeta `PR-0.md` §2.10 (recurso antes que caja). Se prueba con PostgreSQL real y dos transacciones concurrentes.

### 3.5. Baja lógica, nunca borrado (Regla N.° 1)
No hay `DELETE` sobre la ficha ni sobre la cuenta. El historial de bajas y reactivaciones se conserva completo (HU-F-05 c5). El motivo de la baja queda en el historial de estados.

### 3.6. Concurrencia optimista en todas las mutaciones de la ficha
Modificar, desactivar y reactivar exigen `version` y la validan con `updateMany` (Regla N.° 7); `count === 0` se informa como `CONFLICTO_EDICION_CONCURRENTE`. Mismo patrón que `spec_modulo_B.md` §3.3.

### 3.7. Solo el Gerente
Todas las rutas exigen una acción de `personal:*` que la matriz asigna únicamente a GERENTE. El rechazo `403` ocurre en el servidor aunque la interfaz oculte la opción.

### 3.8. La contraseña inicial no se registra
La contraseña inicial es el DNI y la maneja solo el módulo A (que guarda el hash). Este módulo no la recibe, no la devuelve en ninguna respuesta y no la escribe en logs ni en el historial de estados (mismo criterio que `spec_modulo_A.md` §3.4).

### 3.9. Supuestos que la HU no define (P-F6)
Se puede modificar una ficha inactiva (2.2); el texto de «sin resultados» de la búsqueda y el de «motivo requerido» se definen en el archivo central de textos.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Este módulo usa las **dos** opciones de la Regla N.° 2, según la mutación:

- **Opción (a), columnas de auditoría en la propia fila**, para el alta y la modificación: `creadoPorUsuarioId` y `createdAt…` (HU-F-01 c4); `modificadoPorUsuarioId`, `updatedAt…` y `version` (HU-F-01 c5). Se persisten en la misma operación que la mutación. Cargar el contacto en el alta no es una modificación: `modificadoPorUsuarioId` queda en `NULL`.
- **Opción (b), tabla de historial de estados**, para la baja y la reactivación, que son cambios de estado repetibles sobre la misma entidad: `registrarCambioEstado` (`PR-0.md` §2.13, tabla de 2.14) con entidad, id, acción, motivo, usuario y fecha. Se escribe **después** del commit, con reintento e idempotencia (`PR-0.md` §2.16).
- La creación de la cuenta y los cambios de contraseña generan sus propios eventos de seguridad en el módulo A (RNF-SEG-09); este módulo no los emite.

| Mutación | Mecanismo | Sección |
|---|---|---|
| Alta | (a) `creadoPorUsuarioId`, `createdAt…` | 2.1 |
| Modificación | (a) `modificadoPorUsuarioId`, `updatedAt…`, `version` | 2.2 |
| Desactivar | (b) `registrarCambioEstado` acción `DESACTIVAR` (con motivo) | 2.5 |
| Reactivar | (b) `registrarCambioEstado` acción `REACTIVAR` | 2.6 |
```
