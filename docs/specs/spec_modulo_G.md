```markdown
# Especificación Técnica — Módulo G (Gerentes)
## Noctium — Sprint 3
## Revisión 1 — Sprint 3: alta y modificación (HU-G-01), listado (HU-G-03), baja y reactivación (HU-G-05)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 · Prisma ORM (`prisma-client`) · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_F.md` (mismo diseño: **leer primero**) · `spec_modulo_A.md` §2.4 (matriz RBAC) y §2.5 (servicios de cuentas) · `spec_modulo_D.md` §2.1, §2.6 (patrón de ficha) · `spec_modulo_B.md` §2.7 (criterio de búsqueda) · `PR-0.md` §2.7, §2.9, §2.10, §2.13, §2.14, §2.16 · `schema.prisma` · `docs/adicionales/mapa-pantallas-sprint-3.md` (fichas P-47, P-48 y M-43, decisiones DEC-14, 15, 37, 38, 39 y 44) · Backlog Sprint 3 (HU-G-01, HU-G-03, HU-G-05, HU-A-06, HU-C-23)

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-G-01 | Sin spec (el módulo G no existía) | Añadidas secciones 2.1 (alta) y 2.2 (modificación) |
| HU-G-03 | Sin spec | Añadidas secciones 2.3 (listado y búsqueda) y 2.4 (detalle de la ficha) |
| HU-G-05 | Sin spec | Añadidas secciones 2.5 (desactivar) y 2.6 (reactivar) |
| Servicios públicos | — | Añadida sección 2.7 |

**Puntos a confirmar antes de implementar:**
| # | Punto | Quién |
|---|---|---|
| P-G1 | Los de P-F1, P-F2 y P-F3 de `spec_modulo_F.md` valen igual para `FichaGerente` (campos normalizados, `version`, índice de orden, nombres de permisos `gerentes:*`, funciones de cuentas y lectura del historial de estados). «Registró operaciones» lo resuelve DEC-39, igual que en F (`spec_modulo_F.md` §2.7) | PR 0 / PO |
| P-G2 | `PR-0.md` §2.13 no tiene una lectura de «cuentas activas» entre un conjunto de ids. La regla «al menos un gerente activo» (HU-G-05 c3) la necesita: `filtrarCuentasActivas(tx, usuarioIds)` en A | PR 0 |
| P-G3 | `bloquear` (`PR-0.md` §2.16) debe poder tomar **varias** fichas de gerente por id ascendente (nivel de recurso) | PR 0 |
| P-G4 | Supuesto que la HU no define (3.9): se puede modificar una ficha inactiva. (Que un gerente modifique su propia ficha y su propio email lo resuelve DEC-44 del mapa: la sesión sigue.) | PO |

---

## 1. Visión General

El Módulo G gestiona la ficha del **Gerente**: identidad, contacto, alta y baja lógica, con su cuenta de acceso (`Usuario` con rol `GERENTE`). Lo opera **solo un Gerente** sobre otros gerentes. Es gemelo de `spec_modulo_F.md`: la ficha y la cuenta son una unidad (HU-A-06), el email de la ficha es el de la cuenta, la baja es lógica y deja historial. Esta spec repite los contratos completos para poder leerse sola, pero **no repite las explicaciones**: donde dice «igual que F», el comportamiento es el mismo.

**Diferencias con el Módulo F:**
- No hay chequeo de caja abierta.
- Un gerente **no puede desactivarse a sí mismo** (HU-G-05 c2).
- No se puede desactivar al **último gerente activo** (HU-G-05 c3), con un bloqueo que cubre las desactivaciones concurrentes (regla 3.4).
- El listado marca la fila del gerente autenticado como «(vos)» (HU-G-03 c3).
- Mensajes: «Gerente registrado/actualizado/desactivado/reactivado correctamente».

**Modelo de datos** (lo crea el PR 0, `PR-0.md` §2.7 y §2.14): `FichaGerente`, con los mismos campos, restricciones e índice que `FichaMesaEntrada` (ver la tabla de `spec_modulo_F.md` §1): `idFichaGerente`, `usuarioId String? @unique`, `activoFichaGerente`, identidad y normalizados, `dniFichaGerente @unique`, contacto, auditoría y `version`. El seed deja al menos **2 gerentes de prueba con ficha** (`PR-0.md` §2.7) para probar la regla del último gerente.

**Estructura de archivos (Regla N.° 11):** `src/types/gerente.types.ts`; `src/server/gerentes/actions.ts`; `src/server/gerentes/gerente.schema.ts`; `src/server/gerentes/gerente.service.ts`; `src/server/gerentes/gerente.publico.ts`. Pantallas: `/gerentes`, `/gerentes/nuevo`, `/gerentes/[id]` (menú «Gerentes», solo Gerente). Toda pantalla nueva llama a `exigirPermiso`.

**Mapa de pantallas** (`docs/adicionales/mapa-pantallas-sprint-3.md`; rutas «sugeridas», las reales las fija `src/server/shared/rutas-por-rol.ts`):
| Operación (sección) | Pantalla del mapa | Ruta | Menú |
|---|---|---|---|
| Listado y búsqueda (2.3) | P-47 | `/gerentes` | «Gerentes» (solo Gerente) |
| Alta (2.1) | P-48, modo alta | `/gerentes/nuevo` | — |
| Detalle (2.4), desactivar (2.5), reactivar (2.6) | P-48, modo consulta + M-43 | `/gerentes/[id]` | — |
| Modificación (2.2) | P-48, modo edición | `/gerentes/[id]/editar` | — |

**Quién construye qué (DEC-38):** HU-G-01 y HU-G-03 las toma el mismo developer. HU-G-01 crea `/gerentes` con «Nuevo gerente» y una tabla mínima; HU-G-03 suma búsqueda, paginación y «(vos)». Esta spec es el contrato; el mapa decide dónde va cada cosa y el prototipo la muestra. Ante una contradicción entre ellos, se avisa al PO.

**Plan de recorte (convención 7 del backlog):** el bloque de gerentes es el paso 3. Si se recorta, no hay menú «Gerentes» y los gerentes son los del seed; esta spec no cambia, solo no se implementa.

**Utilidades compartidas:** `construirIdentidadPersonaSchema` y `tokenizarBusqueda` (definidas en `spec_modulo_F.md` §1, en `src/server/shared/`). Si HU-G-01 llega antes que HU-F-01, la primera que se mergee las crea.

**Textos:** salen del archivo central de HU-C-23. El servicio lanza `ErrorDeDominio(codigo)`, nunca devuelve textos.

**Fuera de alcance:** cambiar el rol de una cuenta; que un gerente cambie su propia contraseña (HU-A-06 c4); borrado físico; transferir permisos.

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- `[id]` es el CUID de `FichaGerente`.
- Toda ruta requiere sesión y `withPermission("gerentes:<accion>")` (Regla N.° 10). Acciones **exclusivas de GERENTE**; otros roles reciben `403 SIN_PERMISO` (HU-G-01 c6, HU-G-03 c5, HU-G-05 c7).
- Escrituras con `transaccion(fn)` y `ErrorDeDominio` (`PR-0.md` §2.16).

---

### 2.1. Alta de un gerente (HU-G-01, criterios 1 a 3, 5 y 6)

**Ruta:** `POST /api/gerentes`
**Server Action equivalente:** `crearGerente()` en `src/server/gerentes/actions.ts`
**Servicio:** `crearGerente(input, usuarioRegistranteId)` en `src/server/gerentes/gerente.service.ts`
**Permiso requerido:** `gerentes:crear`
**Pantalla:** P-48, modo alta (`/gerentes/nuevo`), desde «Nuevo gerente».
**Confirmación (HU-C-25, DEC-15):** «¿Estás seguro de que querés registrar a <Nombre> <Apellido> como gerente?», con el aviso de que se crea la cuenta con ese email y el DNI como contraseña inicial. Confirmación de interfaz; el servidor valida igual.

```typescript
// src/server/gerentes/gerente.schema.ts
export function construirAltaGerenteSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax).extend({
    email: emailContactoSchema, // obligatorio (HU-A-06): «Ingresá el email: con él se crea la cuenta de acceso»
    telefono: campoOpcional(telefonoContactoSchema),
  }).strict();
}
```
Mismos campos, validaciones y normalizaciones que HU-F-01 (`spec_modulo_F.md` §2.1). `.strict()` rechaza rol, `activo` y `usuarioId`.

**Comportamiento esperado (`crearGerente`), en una única `transaccion`:**
1. Unicidad de DNI contra **todas** las fichas de gerente, activas e inactivas: `409 DNI_DUPLICADO`.
2. `verificarEmailNoAsociadoAOtraCuenta(tx, email)`: `409 EMAIL_YA_ASOCIADO`, sin revelar a quién pertenece.
3. `crearCuentaParaFicha(tx, { email, dni, rol: "GERENTE" })`: cuenta con el DNI como contraseña inicial y `debeCambiarPassword = true`.
4. Insertar la ficha activa con `usuarioId`, normalizados, `creadoPorUsuarioId`, `version = 0`.
5. Cualquier falla revierte todo: nunca queda ficha sin cuenta ni cuenta sin ficha. `P2002` sobre DNI o sobre `emailUsuario` se traduce a los mismos `409`.

**Respuesta `201 Created`:**
```json
{
  "data": {
    "id": "cuid", "nombre": "Marcos", "apellido": "Ibarra", "dni": "27111222",
    "email": "marcos.ibarra@mail.com", "telefono": null, "activo": true,
    "cuenta": { "email": "marcos.ibarra@mail.com", "rol": "GERENTE", "estado": "ACTIVA", "debeCambiarPassword": true }
  },
  "error": null
}
```
La interfaz muestra «Gerente registrado correctamente», completado con la cuenta creada según HU-A-06, criterio 5.

**Errores esperados:** `400 VALIDATION_ERROR` · `403 SIN_PERMISO` · `409 DNI_DUPLICADO` («Ya existe un gerente registrado con ese DNI») · `409 EMAIL_YA_ASOCIADO`.

**Cancelar (HU-G-01 c6):** vuelve al listado o a la ficha sin guardar, con confirmación si hay datos ingresados o cambios.

---

### 2.2. Modificar un gerente (HU-G-01, criterios 4 y 6)

**Ruta:** `PATCH /api/gerentes/[id]`
**Server Action equivalente:** `modificarGerente()` en `src/server/gerentes/actions.ts`
**Servicio:** `modificarGerente(id, input, usuarioId)` en `src/server/gerentes/gerente.service.ts`
**Permiso requerido:** `gerentes:editar`
**Pantalla:** P-48, modo edición (`/gerentes/[id]/editar`, «Editar» de la ficha), formulario precargado; «Guardar» deshabilitado si no hay cambios.
**Confirmación (HU-C-25, DEC-15 y DEC-44):** «¿Estás seguro de que querés guardar los cambios de <Nombre> <Apellido>?», con aviso si cambia el email de ingreso. Si el gerente cambia **su propio** email, el aviso dice que la próxima vez ingresa con el email nuevo.

```typescript
export function construirModificarGerenteSchema(dniLongitudMin: number, dniLongitudMax: number) {
  return construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax).partial().extend({
    email: emailContactoSchema.optional(),
    telefono: telefonoContactoSchema.nullable().optional(), // null = quitar
    version: z.number().int().nonnegative(),
  }).strict();
}
```

**Comportamiento esperado**, idéntico a `spec_modulo_F.md` §2.2 sobre `FichaGerente`:
1. La ficha existe (`404 GERENTE_NO_ENCONTRADO`); sin cambios reales → `200` con `campos_modificados: []`, sin escribir.
2. `dni` cambiado: unicidad excluyendo la propia ficha (`409 DNI_DUPLICADO`).
3. `email` cambiado: `verificarEmailNoAsociadoAOtraCuenta` (`409 EMAIL_YA_ASOCIADO`). Si la ficha tiene cuenta, `cambiarEmailCuenta(tx, { usuarioId, email })` en la misma transacción (HU-A-06 c6). Cambiar el DNI no toca la contraseña.
4. Recalcular normalizados si cambia nombre o apellido.
5. `updateMany where { id, version }` con `version + 1` y `modificadoPorUsuarioId`; `count === 0` → `409 CONFLICTO_EDICION_CONCURRENTE` (Regla N.° 7).

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "campos_modificados": ["email"], "version": 2 }, "error": null }`. Mensaje: «Gerente actualizado correctamente».

**Errores esperados:** `400` · `403` · `404 GERENTE_NO_ENCONTRADO` · `409 DNI_DUPLICADO` · `409 EMAIL_YA_ASOCIADO` · `409 CONFLICTO_EDICION_CONCURRENTE`.

**Gerente que modifica su propia ficha (DEC-44):** está permitido. `cambiarEmailCuenta` **no revoca sesiones** (`PR-0.md` §2.13) y la sesión se identifica por `sub`, no por email, así que su sesión sigue.
**Supuesto (P-G4):** se puede modificar una ficha inactiva.

---

### 2.3. Listado y búsqueda de gerentes (HU-G-03, criterios 1, 2 y 5)

**Ruta:** `GET /api/gerentes`
**Servicio:** `listarGerentes(query, sesionUsuarioId)` en `src/server/gerentes/gerente.service.ts`
**Permiso requerido:** `gerentes:leer`
**Pantalla:** P-47 (`/gerentes`). Por DEC-38, HU-G-01 deja una tabla mínima y HU-G-03 completa este contrato. No hay estado vacío: siempre figura al menos el gerente autenticado.

```typescript
export const POR_PAGINA_GERENTES = 10; // fijo (HU-G-03 c1)
export const ListarGerentesQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  q: z.string().trim().max(100).optional(),
}).strict();
```

**Comportamiento esperado:** igual que `spec_modulo_F.md` §2.3 sobre `FichaGerente`: orden por `apellidoNormalizado`, `nombreNormalizado`, DNI; búsqueda por Nombre, Apellido o DNI con `tokenizarBusqueda` (criterio de HU-B-05); activos e inactivos; paginación sobre el resultado filtrado.

**«(vos)» (criterio 3):** cada ítem trae `esVos: true` cuando `ficha.usuarioId === sesionUsuarioId`. Lo calcula el servidor; la interfaz agrega «(vos)» junto al nombre de esa fila.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "apellido": "Ibarra", "nombre": "Marcos", "dni": "27111222",
        "telefono": null, "email": "marcos.ibarra@mail.com", "activo": true, "esVos": false }
    ],
    "pagina": 1, "por_pagina": 10, "total": 1, "total_paginas": 1
  },
  "error": null
}
```
Columnas: Apellido, Nombre, DNI, Teléfono (`—` si falta), Email, Estado. Cada fila enlaza a la ficha (criterio 4), desde donde se modifica (2.2) y se desactiva o reactiva (2.5, 2.6).

**Errores esperados:** `400 VALIDATION_ERROR` · `403 SIN_PERMISO`.

---

### 2.4. Detalle de la ficha (HU-G-03 criterio 4, HU-G-01 criterio 4, HU-G-05, HU-A-06 criterio 5)

**Ruta:** `GET /api/gerentes/[id]`
**Servicio:** `obtenerDetalleGerente(id, sesionUsuarioId)` en `src/server/gerentes/gerente.service.ts`
**Permiso requerido:** `gerentes:leer`
**Pantalla:** P-48, modo consulta (`/gerentes/[id]`).

Devuelve todo lo que muestra la ficha del mapa (P-48), con la misma forma que `spec_modulo_F.md` §2.4: ficha completa, `version`, `creadoEl`, `modificadoEl`, `cuenta` (`ACTIVA` / `INACTIVA` / `SIN_CUENTA`, rol «Gerente») con `obtenerResumenCuenta`, `historialEstados` con `listarHistorialEstados("FICHA_GERENTE", id)` (DEC-37) y `motivoObligatorioAlDesactivar` con `usuarioRegistroOperaciones` (`spec_modulo_F.md` §2.7, DEC-39). Agrega:
- `esVos`: `true` si la ficha es la del gerente autenticado.
- `esUltimoGerenteActivo`: `true` si, sin contar esta ficha, no queda ningún gerente activo con cuenta activa. Es una lectura **sin bloqueo**, solo informativa: el prototipo muestra «Debe quedar al menos un gerente activo» antes de pedir la confirmación; el servidor lo repite al confirmar (2.5 paso 4).

La pantalla muestra:
- «Editar» con `gerentes:editar`.
- «Desactivar» solo si la ficha está activa, hay `gerentes:cambiar_estado` y **no es la propia** (`esVos = false`, HU-G-05 c2).
- «Reactivar» solo si la ficha está inactiva y hay `gerentes:cambiar_estado`.

**Errores esperados:** `403 SIN_PERMISO` · `404 GERENTE_NO_ENCONTRADO`.

---

### 2.5. Desactivar un gerente (HU-G-05, criterios 1 a 5 y 7)

**Ruta:** `POST /api/gerentes/[id]/desactivar`
**Server Action equivalente:** `desactivarGerente()` en `src/server/gerentes/actions.ts`
**Servicio:** `desactivarGerente(id, input, actor)` en `src/server/gerentes/gerente.service.ts`
**Permiso requerido:** `gerentes:cambiar_estado`
**Pantalla:** acción «Desactivar» de la ficha (P-48), con el modal M-43: «¿Estás seguro de que querés desactivar a <gerente>? No podrá ingresar al sistema.», el aviso de que su cuenta pasa a inactiva y se cierran sus sesiones, y el motivo (hasta 300 caracteres). Es reversible: no lleva «Esta acción no se puede deshacer.». Los rechazos del servidor (último gerente activo, conflicto) se muestran dentro del mismo modal (HU-C-25 c6).

```typescript
export const DesactivarGerenteSchema = z.object({
  motivo: z.string().trim().max(300).optional(),
  version: z.number().int().nonnegative(),
}).strict();
```

**Comportamiento esperado, en una única `transaccion`:**
1. **No a sí mismo (criterio 2):** si `ficha.usuarioId === actor.usuarioId`, `422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO`. Se compara en el servidor contra la sesión; ocultar el botón no alcanza. Se evalúa antes de bloquear, con una lectura simple de la ficha.
2. **Bloqueo (criterio 3):** `bloquear(tx, { recursos: [fichas de gerente activas] })`: `SELECT … FOR UPDATE` sobre **todas** las fichas de gerente activas, por id ascendente (regla 3.4, P-G3). Si el objetivo no está entre ellas, se lo lee aparte: no existe (`404`) o ya está inactivo (`409 GERENTE_YA_INACTIVO`).
3. La `version` debe coincidir: `409 CONFLICTO_EDICION_CONCURRENTE`.
4. **Último gerente activo (criterio 3):** con `filtrarCuentasActivas(tx, usuarioIds)` (módulo A, P-G2) se obtienen las fichas activas **con cuenta activa** entre las bloqueadas, sin contar al objetivo. Si no queda ninguna: `409 ULTIMO_GERENTE_ACTIVO` — «Debe quedar al menos un gerente activo».
5. **Motivo:** si el gerente registró operaciones (`usuarioRegistroOperaciones(tx, usuarioId)`, criterio de DEC-39) y no vino `motivo`: `400 MOTIVO_REQUERIDO` (Regla N.° 1). En la duda, se pide el motivo.
6. Cambiar el estado con condición atómica (Regla N.° 7):
   ```typescript
   const r = await tx.fichaGerente.updateMany({
     where: { idFichaGerente: id, activoFichaGerente: true, version: input.version },
     data: { activoFichaGerente: false, version: { increment: 1 }, modificadoPorUsuarioId: actor.usuarioId },
   });
   if (r.count === 0) throw new ErrorDeDominio("errores.general.conflictoEdicion");
   ```
7. Si tiene `usuarioId`: `desactivarCuenta(tx, usuarioId)` y `revocarSesiones(tx, usuarioId)` (RNF-SEG-04, mismo mecanismo que HU-D-08 c4 y `spec_modulo_F.md` §2.5).
8. `registrarCambioEstado(tx, { entidad: "FICHA_GERENTE", id, accion: "DESACTIVAR", motivo, actor })`, que se escribe **después** del commit (Regla N.° 2, opción (b); criterio 4).

**Conservación (criterio 4):** las operaciones que registró se conservan con su `usuarioId` y su nombre. Su DNI y su email siguen reservados. Sigue en el listado como «Inactivo» (criterio 5).

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "activo": false, "version": 4 }, "error": null }`. Mensaje: «Gerente desactivado correctamente».

**Errores esperados:** `400 VALIDATION_ERROR` · `400 MOTIVO_REQUERIDO` · `403 SIN_PERMISO` · `404 GERENTE_NO_ENCONTRADO` · `409 GERENTE_YA_INACTIVO` · `409 ULTIMO_GERENTE_ACTIVO` · `409 CONFLICTO_EDICION_CONCURRENTE` · `422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO`.

---

### 2.6. Reactivar un gerente (HU-G-05, criterios 6 y 7)

**Ruta:** `POST /api/gerentes/[id]/reactivar`
**Server Action equivalente:** `reactivarGerente()` en `src/server/gerentes/actions.ts`
**Servicio:** `reactivarGerente(id, input, actor)` en `src/server/gerentes/gerente.service.ts`
**Permiso requerido:** `gerentes:cambiar_estado`
**Pantalla:** «Reactivar» en la ficha inactiva (P-48), con el modal M-43: «¿Estás seguro de que querés reactivar a <gerente>?». No pide motivo. Avisa que las sesiones cerradas en la baja no se restauran.

```typescript
export const ReactivarGerenteSchema = z.object({ version: z.number().int().nonnegative() }).strict();
```

**Comportamiento esperado:** igual que `spec_modulo_F.md` §2.6 sobre `FichaGerente`: bloquear la ficha (`FOR UPDATE`), exigir que esté inactiva (`409 GERENTE_YA_ACTIVO`) y la `version`, `updateMany` atómico, `reactivarCuenta(tx, usuarioId)` (las sesiones revocadas no se restauran: debe iniciar sesión de nuevo; se conserva `debeCambiarPassword`) y `registrarCambioEstado` con acción `REACTIVAR` después del commit. No hay regla de «último gerente»: reactivar solo suma.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "activo": true, "version": 5 }, "error": null }`. Mensaje: «Gerente reactivado correctamente».

**Errores esperados:** `400 VALIDATION_ERROR` · `403 SIN_PERMISO` · `404 GERENTE_NO_ENCONTRADO` · `409 GERENTE_YA_ACTIVO` · `409 CONFLICTO_EDICION_CONCURRENTE`.

---

### 2.7. Servicios públicos del módulo

Conforme a la Regla N.° 3. Funciones en `src/server/gerentes/gerente.publico.ts`; no importa nada de otros módulos de dominio.

| Función | Devuelve | Consumidores |
|---|---|---|
| `obtenerNombresGerentes(usuarioIds, db?)` | `Record<usuarioId, "Apellido, Nombre">` | `spec_modulo_N.md` §2.3 (usuario que cambió un parámetro) y pantallas que muestren al responsable de una operación |

**Funciones de otros módulos que este módulo consume:**

| Función | Dueño | Estado |
|---|---|---|
| `crearCuentaParaFicha`, `cambiarEmailCuenta`, `desactivarCuenta`, `reactivarCuenta`, `revocarSesiones` | A | definidas en `PR-0.md` §2.13 |
| `verificarEmailNoAsociadoAOtraCuenta`, `obtenerResumenCuenta`, `filtrarCuentasActivas` | A | `verificarEmailNoAsociadoAOtraCuenta` es **existente** (`spec_modulo_A.md` 2.5); `obtenerResumenCuenta` y `filtrarCuentasActivas` están **definidas** en `spec_modulo_A.md` 2.9 (P-A13) |
| `registrarCambioEstado` | compartido | definida en `PR-0.md` §2.13 |
| `listarHistorialEstados(entidad, id, db?)` | compartido | **publicada por el PR 0** (R7-PR0-1; P-F3): ya no la agrega HU-D-08 |
| `usuarioRegistroOperaciones(tx, usuarioId)` → `boolean` | compartido | **nueva** (DEC-39), definida en `spec_modulo_F.md` §2.7 (agregador `src/server/shared/actividad-usuario.ts`; la primera HU que la necesita la crea, HU-F-05) |

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside exclusivamente en `src/server/gerentes/gerente.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. La ficha y la cuenta son una unidad
Igual que `spec_modulo_F.md` §3.1: alta, cambio de email, baja y reactivación afectan a ficha y cuenta en la misma transacción (HU-A-06 c2, c6, c7).

### 3.2. Unicidad de DNI acotada a `FichaGerente`
Doble validación (aplicativa + `@unique` con captura de `P2002`), activas e inactivas, sin verificación cruzada con otras fichas.

### 3.3. El email de la ficha es el email de la cuenta
Se sincronizan en la misma transacción, con la misma validación de unicidad (HU-A-06 c6).

### 3.4. «Al menos un gerente activo» bajo concurrencia
Una condición en una sola sentencia no alcanza con `READ COMMITTED`: dos gerentes que se desactivan mutuamente a la vez no se bloquean entre sí y podrían dejar al centro sin gerentes (Regla N.° 7). Por eso toda desactivación toma `FOR UPDATE` sobre **todas** las fichas de gerente activas, en orden de id ascendente (el mismo orden evita interbloqueos entre desactivaciones concurrentes), y cuenta **después** de tener los bloqueos. La segunda transacción espera, vuelve a evaluar el `WHERE` con el resultado confirmado de la primera y ve una ficha menos.

Con una sola llamada de un gerente activo sobre otro gerente, la regla casi nunca se dispara (quien llama ya es un gerente activo con cuenta activa, y no puede ser el objetivo). Se mantiene porque protege exactamente el caso concurrente y los datos inconsistentes (por ejemplo, un gerente con ficha activa y cuenta inactiva). Su prueba usa PostgreSQL real: dos desactivaciones cruzadas en paralelo, con exactamente una exitosa y la otra con `ULTIMO_GERENTE_ACTIVO`.

*Alternativa descartada:* un bloqueo de asesor de transacción (`pg_advisory_xact_lock`) único para gerentes. Es válido (lo admite HU-G-05 c3), pero no bloquea las filas y exige que toda futura operación que pueda reducir los gerentes activos conozca esa clave; el bloqueo de filas protege además contra una modificación de la propia ficha.

### 3.5. Un gerente no se desactiva a sí mismo
Comparación en el servidor entre `ficha.usuarioId` y la sesión (`422 NO_PUEDE_DESACTIVARSE_A_SI_MISMO`). La interfaz oculta la acción en la propia ficha, pero el rechazo del servidor es el que vale.

### 3.6. Baja lógica y concurrencia optimista
No hay `DELETE` (Regla N.° 1). Modificar, desactivar y reactivar exigen `version` validada con `updateMany` (Regla N.° 7), igual que `spec_modulo_F.md` §3.5 y §3.6.

### 3.7. Solo el Gerente
Todas las rutas exigen una acción `gerentes:*` que la matriz asigna únicamente a GERENTE; el `403` lo emite el servidor.

### 3.8. La contraseña inicial no se registra
La maneja solo el módulo A; este módulo no la recibe, devuelve ni escribe en logs o historial (mismo criterio que `spec_modulo_F.md` §3.8).

### 3.9. Supuestos que la HU no define (P-G4)
Se puede modificar una ficha inactiva. Que un gerente modifique su propia ficha lo fija DEC-44 (2.2).

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Igual que `spec_modulo_F.md` §4:
- **Opción (a)** para alta y modificación: `creadoPorUsuarioId`, `createdAt…`, `modificadoPorUsuarioId`, `updatedAt…` y `version` en la propia fila.
- **Opción (b)** para baja y reactivación, que son cambios de estado repetibles: `registrarCambioEstado` (entidad `FICHA_GERENTE`, acciones `DESACTIVAR` y `REACTIVAR`, con motivo en la baja), escrito **después** del commit, con reintento e idempotencia (`PR-0.md` §2.16).
- Los eventos de seguridad de la cuenta (creación, cambio de contraseña) los emite el módulo A (RNF-SEG-09).

| Mutación | Mecanismo | Sección |
|---|---|---|
| Alta | (a) `creadoPorUsuarioId`, `createdAt…` | 2.1 |
| Modificación | (a) `modificadoPorUsuarioId`, `updatedAt…`, `version` | 2.2 |
| Desactivar | (b) `registrarCambioEstado` acción `DESACTIVAR` (con motivo) | 2.5 |
| Reactivar | (b) `registrarCambioEstado` acción `REACTIVAR` | 2.6 |
```
