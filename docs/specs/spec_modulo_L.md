```markdown
# Especificación Técnica — Módulo L (Materias)
## Noctium — Sprint 1 · Sprint 2 · Sprint 3 (Revisión 3)
## Revisión 3 — Sprint 3: tarifa por hora de cada materia (HU-L-06) y cambio masivo de tarifas (HU-L-07)
## Revisión 2 — Sprint 2: modificación de materia (HU-L-03), servicios públicos documentados y ubicación de archivos

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` §2.5 y §3.3 (patrón de concurrencia optimista) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · **Revisión 3:** `PR-0.md` §2.2, §2.4, §2.9, §2.10 y §2.16 · `spec_modulo_G.md` §2.7 (nombres de gerentes) · `docs/adicionales/mapa-pantallas-sprint-3.md` (P-43, P-44, M-41, M-42; DEC-35, DEC-42, DEC-43) · Backlog Sprint 3 (HU-L-06, HU-L-07, HU-C-23, HU-C-25)

**HU contractualizadas en esta revisión:** HU-L-01 (Registrar materia), HU-L-02 (Listar materias) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-L-03 (Modificar datos de materia).

**HU contractualizadas en la Revisión 3 (Sprint 3):** HU-L-06 (Definir la tarifa por hora de cada materia) y HU-L-07 (Cambiar la tarifa de varias materias a la vez).

**Changelog — Revisión 3 (Sprint 3) — trazabilidad Backlog → Spec:**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-L-06 | Sin contrato: la materia no tenía precio | Nuevas secciones 2.7 (ver tarifa e historial) y 2.8 (cambiar la tarifa de una materia) |
| HU-L-07 | Sin contrato | Nueva sección 2.9 (lectura de materias activas con su tarifa y cambio masivo) |
| HU-L-02 | Contractualizada (Sprint 1) | Nota aditiva al final de 2.2: el listado y el detalle suman la tarifa y el historial, **solo** para quien tiene `materias:ver_tarifa`. El contrato original no se modifica |
| HU-L-01 | Contractualizada (Sprint 1) | **Sin cambio de contrato** (P-L1, decidido): el alta sigue sin recibir tarifa y la materia nace «sin tarifa» (`tarifaHora = null`); el gerente la define con 2.8. Nota en 2.1 |
| Modelo `Materia` | Sin tarifa | + `tarifaHora` (entero en pesos, **admite `null` = «sin tarifa»**; lo crea el PR 0, que hoy la pide NOT NULL: cambio pedido en P-L1). No se agrega ningún campo a la ficha de edición de 2.4 ni al alta de 2.1 |
| Modelo | — | + `HistorialTarifa` (lo crea el PR 0; ver 2.7) |
| Permisos | `materias:crear`, `materias:leer`, `materias:editar` | + `materias:ver_tarifa` (Mesa de Entrada y Gerente) y `materias:cambiar_tarifa` (Gerente), propuestos (P-L2). Filas para la matriz de `spec_modulo_A.md` §2.4: `materias:ver_tarifa` ✔ M ✔ G · `materias:cambiar_tarifa` ✔ G |
| Servicios públicos | 2.3, 2.5 y 2.6 | Nueva sección 2.10: `obtenerTarifasPorIds`. Nueva regla 3.12 (materia sin tarifa) |
| Reglas | 3.1 a 3.5 | + 3.6 a 3.11 al final del bloque, sin renumerar. 3.3 sigue vigente (se anota) |
| §4 Trazabilidad | Opción (a) | Nota de Revisión 3: `HistorialTarifa` en la misma transacción |

**Puntos a confirmar antes de implementar (Revisión 3):**
| # | Punto | Quién |
|---|---|---|
| P-L1 | **DECIDIDO (Revisión 3) — regla del equipo: nada de lo ya desarrollado se rompe; el Sprint 3 se adapta a lo existente.** El PR 0 pedía `Materia.tarifaHora` NOT NULL, y el alta de materia (HU-L-01, Sprint 1) no recibe tarifa: con la columna obligatoria el alta, sus tests y su colección Postman dejarían de funcionar. Se mantiene el alta **exactamente como está** y la tarifa pasa a admitir `null` («sin tarifa»). **Pedido al PR 0:** (i) `Materia.tarifaHora Int?` en lugar de NOT NULL; (ii) `HistorialTarifa.tarifaAnterior Int?` (la primera definición de la tarifa no tiene anterior); (iii) `precioClase` y `crearInscripcion` lanzan `MATERIA_SIN_TARIFA` cuando la materia no tiene tarifa (3.12). Las materias del seed siguen cargando su tarifa, así que los datos de prueba no cambian. `Inscripcion.precio` sigue siendo NOT NULL | PR 0 / SM |
| P-L2 | Nombres de las acciones `materias:ver_tarifa` y `materias:cambiar_tarifa`: propuestos. Los fija la tabla cerrada de `PR-0.md` §2.9, que prevé «la misma acción» para HU-L-06 y HU-L-07 y no nombra una de lectura. Hace falta una de lectura porque el Profesor tiene `materias:leer` (A §2.4) y no debe ver precios (HU-L-06 c7); si el PR 0 prefiere decidirlo por rol dentro del servicio, 2.7 cambia solo en cómo se calcula `conTarifa` | PR 0 |
| P-L3 | **Tope del importe:** el backlog solo dice «entero en pesos, mayor que 0». Esta spec agrega un tope técnico de $ 1.000.000 por hora (`TARIFA_HORA_MAX`) para que el precio de una clase de 3 horas entre en una columna entera de 32 bits. Si el PO quiere otro tope, se cambia la constante | PO |
| P-L4 | **Materia inactiva:** HU-L-07 c6 dice que las inactivas no se listan y conservan su tarifa, y que el servidor no las modifica. El backlog no dice nada del cambio individual desde la ficha de una materia inactiva. Esta spec rechaza ambos casos con `422 MATERIA_INACTIVA` (en el masivo, la solicitud completa) | PO |
| P-L5 | Forma exacta de lo que crea el PR 0: nombres de `Materia.tarifaHora` y de los campos de `HistorialTarifa` (esta spec usa `materiaId`, `tarifaAnterior` —nullable, P-L1—, `tarifaNueva`, `usuarioId`, `fecha` y `masivo`), tipo de recurso `materia` en `bloquear(tx, { recursos })`, y ubicación de `precioClase`. Además: si C o I leen `Materia.tarifaHora` directo, anotar la excepción a la Regla N.° 3 o usar `obtenerTarifasPorIds` (2.10) | PR 0 |
| P-L6 | `HistorialTarifa` se escribe **en la misma transacción** (`PR-0.md` §2.4: «todos en una transacción por operación»; mapa M-42), mientras que la Regla N.° 2 pide, para una tabla de trazabilidad separada, escribir **después** del commit (como hace `spec_modulo_N.md` con `HistorialParametro`). Esta spec sigue al PR 0 porque el registro es un dato de negocio (Regla N.° 8) y el masivo debe ser atómico. Confirmar o pasarlo a `despuesDelCommit` | SM |
| P-L7 | **Guarda de la tarifa mostrada (`tarifa_actual`):** no está en el backlog. La agrega esta spec para que la confirmación de HU-C-25 («de $ 12.000 a $ 15.000») no pueda ser falsa si otra persona cambió la tarifa en el medio, y para que un reintento no duplique el historial. Los textos del `409` salen del archivo central | SM |
| P-L8 | **Códigos con guion en el prototipo.** El prototipo muestra códigos como «FIS-1» o «MAT-3»; el alta y la modificación ya desarrolladas (2.1, 2.4) solo admiten letras y números. **Decidido (misma regla que P-L1):** la regla de los códigos no cambia; el seed del PR 0 debe cargar códigos que la cumplan (por ejemplo «FIS1»), y los guiones del prototipo son solo datos de muestra | PR 0 |

**Changelog de la Revisión 2 (resumen, trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-L-03 | Gap — «Modificación de una materia ya registrada» figuraba como fuera de alcance | Añadida sección 2.4 (aditiva, no renumera) y reglas 3.4 y 3.5 |
| HU-L-02 | Contractualizada (Sprint 1) | El detalle `GET /api/materias/[id]` (§2.2) suma `updated_at` y `version` |
| HU-L-01 | Contractualizada (Sprint 1) | Sin cambio de contrato; ubicación de archivos unificada bajo `src/server/materias/` |
| HU-D-03 y HU-D-07 (módulo D, consumidor) | Sin contrato público documentado para consumir materias | §2.3 (`bloquearMateriasParaAsociar`), §2.5 (`obtenerMateriasPorIds`) y §2.6 (`verificarMateriaActiva`, `obtenerOpcionMateriaActiva`, `listarMateriasActivas`), aditivas |

**Changelog — Revisión 2 (Sprint 2) — detalle:**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-L-03 | Gap — "Modificación de una materia ya registrada" figuraba como fuera de alcance | Nueva sección 2.4 (aditiva, no renumera). Nueva regla 3.4 |
| Servicios públicos | Solo `bloquearMateriasParaAsociar()` (§2.3) | Nueva sección 2.5: `obtenerMateriasPorIds()`, consumida por `spec_modulo_E.md` y `spec_modulo_D.md` §2.7. Nueva sección 2.6: documenta los servicios públicos que otras specs ya consumen (`verificarMateriaActiva`, `obtenerOpcionMateriaActiva`, `listarMateriasActivas`) |
| Modelo `Materia` | Sin campos de modificación | + `updatedAtMateria`, `modificadoPorUsuarioId`, `version` (concurrencia optimista, mismo patrón que `Alumno`) |
| Permisos | `materias:crear`, `materias:leer` | + `materias:editar` (GERENTE). Matriz en `spec_modulo_A.md` §2.4 |
| Ubicación de archivos | Rutas mezcladas (`app/(dashboard)/...`, `lib/schemas/...`) y servicios públicos declarados en `materia.service.ts` | Todo bajo `src/server/materias/` (`actions.ts`, `materia.schema.ts`). Los servicios públicos (§2.3, 2.5, 2.6) se declaran en `src/server/materias/materia.publico.ts` (Regla N.° 3, igual que B, C, D y E) |
| Detalle `GET /api/materias/[id]` (§2.2) | No devolvía la fecha de última modificación ni la versión | Suma `updated_at` y `version` |

**Changelog previo (trazabilidad Backlog → Spec) — HU-D-03:**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-03 (módulo D, consumidor) | Gap: el módulo L no exponía una consulta pública para revalidar materias dentro de una transacción ajena | Añadida sección 2.3 (`bloquearMateriasParaAsociar()`), aditiva. No modifica ninguna función existente. Sin renumerar. |

**Fuera de alcance de esta spec (explícito):**
- ~~Modificación de una materia ya registrada.~~ **Incorporada en Revisión 2** (2.4, ver «Actualización de alcance» más abajo).
- Baja lógica / reactivación de materias.
- Duración configurable por materia: en este sprint todo turno usa la duración estándar del centro (parámetro definido en `spec_modulo_C.md`) — la entidad `Materia` no posee campo de duración propio.
- **Revisión 3:** tarifas por duración, por profesor o por horario; descuentos; cambios de tarifa programados a futuro; ajustes por porcentaje (HU-L-07 fija un importe, no un porcentaje); recalcular o corregir el precio de inscripciones ya hechas (HU-L-06 c4); corregir o borrar un registro del historial de tarifas (3.11); paginar el historial de tarifas.

**Actualización de alcance — Revisión 2 (Sprint 2):** la **modificación de nombre y código** de una materia pasa a estar dentro de alcance (2.4). Siguen fuera: baja lógica y reactivación (cambiar `is_active`) y la duración configurable por materia, que HU-L-03 AC5 excluye expresamente, igual que en Sprint 1. La duración del turno la elige Mesa de Entradas (`spec_modulo_C.md` Revisión 4), no es un dato de la materia.

---

## 1. Visión General

El Módulo L gestiona el catálogo de materias que dicta el centro. Es una entidad base habilitante: sin materia registrada no puede asociarse un profesor (HU-D-03, `spec_modulo_D.md`) ni configurarse un turno (HU-C-03, `spec_modulo_C.md`). Solo el rol Gerente puede dar de alta materias en este sprint; su consulta (listado y detalle) está disponible para los roles que la necesiten al operar otros módulos.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `src/server/materias/materia.service.ts` (Regla N.° 4 de `docs/RULES.md`). Las funciones que otros módulos invocan (§2.3, 2.5 y 2.6) se declaran en `src/server/materias/materia.publico.ts` (Regla N.° 3), no en el servicio interno.

**Alcance de esta revisión:** la Revisión 2 es aditiva. Incorpora las secciones 2.4 (HU-L-03), 2.5 y 2.6 (servicios públicos) y las reglas 3.4 y 3.5 al final de sus bloques, sin renumerar las preexistentes 2.1–2.3 y 3.1–3.3, para no romper las referencias cruzadas de otras specs (ver `docs/adicionales/sdd-metodologia.md`). Las únicas modificaciones sobre secciones existentes son el detalle de 2.2 (suma `updated_at` y `version`) y la ubicación de archivos (servicios públicos en `materia.publico.ts`). La baja lógica, la reactivación y la duración por materia siguen fuera de alcance.

**Alcance de la Revisión 3 (Sprint 3):** agrega la **tarifa por hora** de cada materia. Con ella el precio de una clase se calcula solo (`tarifa × duración en horas`, HU-L-06 c3) y queda guardado en cada inscripción al crearla, de modo que un cambio de tarifa no altera lo ya inscripto (c4). El módulo pasa a tener dos pantallas nuevas del Gerente (cambiar la tarifa de una materia y cambiar la de varias a la vez) y un historial de cambios. Es aditiva: agrega las secciones 2.7 a 2.10 después de 2.6 y las reglas 3.6 a 3.11 al final de su bloque, sin renumerar nada. **Terminología (HU-C-19):** los textos visibles de las pantallas nuevas dicen «clase»; esta spec conserva «turno» en las secciones anteriores y en los nombres de rutas, enums y tablas, que no cambian. Todos los textos visibles salen del archivo central de HU-C-23; los servicios lanzan `ErrorDeDominio(clave)` y nunca devuelven textos.

**Plan de recorte (convención 7 del backlog):** HU-L-06 no se recorta. HU-L-07 se construye y no se recorta mientras el PO no decida otra cosa en la planning (DEC-35, Pendiente 3). Si se recortara HU-L-07, HU-L-06 sigue completa: la función `aplicarCambiosDeTarifa` y el historial son de HU-L-06 (2.8).

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Materia` y `Profesor`, incluido el parámetro `[id]` de Materia, son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("materias:<accion>")` (Regla N.° 10, middleware definido en `spec_modulo_A.md` §2.2).
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/materia.types.ts`, Server Actions en `src/server/materias/actions.ts` y services en `src/server/materias/materia.service.ts`. Imports siempre con el alias `@/`.

---

### 2.1. Alta de Materia (HU-L-01)

**Ruta:** `POST /api/materias`
**Server Action equivalente:** `crearMateria()` en `src/server/materias/actions.ts`
**Servicio:** `crearMateria()` en `src/server/materias/materia.service.ts`
**Permiso requerido:** `materias:crear` (exclusivo del rol Gerente)

```typescript
// src/server/materias/materia.schema.ts
export const CrearMateriaSchema = z.object({
  nombre: z.string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre no puede superar los 80 caracteres")
    .transform((v) => v.replace(/\s+/g, " ")), // colapsa espacios internos múltiples
  codigo: z.string()
    .trim()
    .max(10, "El código no puede superar los 10 caracteres")
    .regex(/^[A-Za-z0-9]+$/, "El código admite solo letras y números, sin espacios")
    .transform((v) => v.toUpperCase())
    .optional(),
});
export type CrearMateriaInput = z.infer<typeof CrearMateriaSchema>;
```

**Comportamiento esperado (`src/server/materias/materia.service.ts` → `crearMateria`):**
1. Calcular `nombre_normalizado = normalizarTexto(nombre)` con la utilidad compartida `normalizarTexto()` (ubicación de referencia `lib/utils/normalizar-texto.ts`, **a confirmar contra el código** porque el resto de las specs usa el prefijo `src/`; B, D, I y K remiten a esta sección para la utilidad y no definen otra ruta) (minúsculas + sin diacríticos — `"Matemática"` y `"matematica"` producen el mismo valor). Esta utilidad es de uso transversal: el mismo requisito de unicidad case/acento-insensitiva aparece en Aulas (HU-K-01) y debe reutilizarse, no reimplementarse.
2. Verificar unicidad aplicativa de `nombre_normalizado` contra **todas** las materias, activas e inactivas (`prisma.materia.findFirst({ where: { nombre_normalizado } })`, sin filtro de `is_active`). Si existe, `409 NOMBRE_DUPLICADO`, indicando en el mensaje si la materia existente está inactiva.
3. Si viene `codigo`: verificar unicidad aplicativa análoga contra `codigo` (ya normalizado a mayúsculas por el schema), también sin filtrar por `is_active`. Si existe, `409 CODIGO_DUPLICADO`.
4. Insertar con `is_active: true`, registrando `nombre`, `nombre_normalizado`, `codigo` (o `null`), fecha de alta y usuario. **Defensa adicional ante condición de carrera:** capturar la violación de constraint único de Prisma (`P2002`) sobre `nombre_normalizado`/`codigo` y traducirla al mismo shape de error `409` que el paso 2/3 — mismo patrón de doble validación (aplicativa + constraint de base) usado en el resto del proyecto ante altas concurrentes.
5. Tras el `INSERT`, emitir el evento `materia:creada` (sección 4).

**Respuesta `201 Created`:**
```json
{
  "data": { "id": "cuid", "nombre": "Matemática", "codigo": "MAT101", "is_active": true },
  "error": null
}
```

**Respuesta `409 Conflict` (nombre duplicado):**
```json
{
  "data": null,
  "error": { "code": "NOMBRE_DUPLICADO", "message": "Ya existe una materia registrada con ese nombre (inactiva)" }
}
```

**Respuesta `409 Conflict` (código duplicado):**
```json
{ "data": null, "error": { "code": "CODIGO_DUPLICADO", "message": "Ya existe una materia registrada con ese código" } }
```

**Errores esperados:** `400` (validación Zod, Regla N.° 6) · `403 SIN_PERMISO` · `409 NOMBRE_DUPLICADO` · `409 CODIGO_DUPLICADO` (ambos también ante violación `P2002`).

**Nota de sincronización (Revisión 3, resuelta — P-L1):** este alta **no cambia**: no recibe tarifa, y el `INSERT` del paso 4 sigue funcionando porque `Materia.tarifaHora` admite `null`. La materia nueva queda «sin tarifa» hasta que el Gerente la define con 2.8 (HU-L-06). Mientras no tenga tarifa, no se pueden crear inscripciones en sus clases (3.12). El formulario de alta, `CrearMateriaSchema`, los tests y la colección Postman de Sprint 1 siguen válidos tal cual.

---

### 2.2. Listado y detalle de Materias (HU-L-02)

**Ruta (listado):** `GET /api/materias`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** listado de materias en `src/server/materias/materia.service.ts` (nombre de la función: a confirmar contra el código)
**Permiso requerido:** `materias:leer` (Gerente, Mesa de Entrada, Profesor — todo rol que necesite consultar el catálogo al operar otro módulo)

```typescript
export const ListarMateriasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
export type ListarMateriasQuery = z.infer<typeof ListarMateriasQuerySchema>;
```

**Comportamiento esperado:**
- El listado **incluye materias activas e inactivas** (no aplica un filtro `is_active: true` por defecto), porque el criterio de aceptación exige mostrar la columna Estado para ambas — a diferencia del criterio de filtrado por defecto que sí aplican otras consultas del proyecto orientadas solo a registros operativos vigentes.
- Orden inicial: `nombre_normalizado` ascendente (garantiza el criterio "sin distinguir mayúsculas/acentos" del listado, no solo del alta).
- Cada ítem incluye la cantidad de profesores asociados, resuelta vía `_count` sobre la relación con `ProfesorMateria` (definida en `spec_modulo_D.md` §2.3) — no requiere una consulta separada por materia.
- Paginación server-side (`skip`/`take`), con metadatos de página en la respuesta.

**Nota de sincronización (HU-L-02) — excepción documentada a la Regla N.° 3 de `docs/RULES.md`:** el `_count` de arriba se resuelve con `prisma.materia.findMany({ include: { _count: { select: { profesores: true } } } })` desde `materia.service.ts`, es decir, consultando directamente la tabla `ProfesorMateria`. En sentido estricto, `ProfesorMateria` es la tabla de asociación de HU-D-03 (Módulo D/Profesor), y la Regla N.° 3 exige que la comunicación entre módulos ocurra vía eventos de dominio o el servicio público del otro módulo, no vía acceso directo a su tabla. Se documenta acá como excepción explícita, en vez de introducir un servicio público en Módulo D sin otro consumidor real hoy, porque `ProfesorMateria` está declarada como relación (`profesores ProfesorMateria[]`) en el propio modelo `Materia` del schema — no es una tabla interna ajena a la que Materias "se asoma" desde afuera, sino una relación N:M que ambos módulos declaran igual de explícitamente en su propio modelo. Si en el futuro el conteo necesita lógica adicional (ej. excluir profesores inactivos), se reevalúa moverlo a un servicio público de Módulo D en ese momento.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "nombre": "Matemática", "codigo": "MAT101", "profesores_count": 2, "is_active": true }
    ],
    "paginacion": { "total": 12, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Errores esperados:** `400` (query inválida, Regla N.° 6) · `403 SIN_PERMISO`.

**Ruta (detalle):** `GET /api/materias/[id]`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** detalle de materia en `src/server/materias/materia.service.ts` (nombre de la función: a confirmar contra el código)
**Permiso requerido:** `materias:leer`

**Comportamiento esperado:** modo consulta — incluye `nombre`, `codigo`, `is_active`, `created_at`, **`updated_at`** (fecha de última modificación, `updatedAtMateria`; HU-L-03 AC3), **`version`** (la lee el formulario de edición y la reenvía en el `PATCH` de 2.4) y el listado de profesores asociados (nombre y apellido) resuelto vía `ProfesorMateria` → `Profesor`.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "id": "cuid",
    "nombre": "Matemática",
    "codigo": "MAT101",
    "is_active": true,
    "created_at": "2026-03-02T14:00:00.000Z",
    "updated_at": "2026-03-05T10:30:00.000Z",
    "version": 2,
    "profesores": [{ "id": "cuid", "nombre_completo": "Pérez, Ana" }]
  },
  "error": null
}
```

**Errores esperados:** `403 SIN_PERMISO` · `404 MATERIA_NO_ENCONTRADA`.

**Nota de Revisión 3 (Sprint 3):** el listado suma `tarifa_hora` por ítem y el detalle suma `tarifa_hora` e `historial_tarifas`, **solo** cuando el llamador tiene `materias:ver_tarifa` (Mesa de Entrada y Gerente); para el Profesor la respuesta es la de arriba, sin cambios. Detalle en 2.7.

### 2.3. Consulta pública: bloquear materias para asociar (consumida por HU-D-03 y HU-D-07)

**Función:** `bloquearMateriasParaAsociar(ids: string[], tx: Prisma.TransactionClient): Promise<{ id, nombre, codigo, activa }[]>` declarada y exportada en `src/server/materias/materia.publico.ts` (Regla N.° 3), no en `materia.service.ts`.
**Consumidores**, vía llamada explícita a la capa de servicios pública (Regla N.° 3):
- `asociarMateriasProfesor()` del módulo D (`spec_modulo_D.md` §2.3, HU-D-03).
- `actualizarMateriasDeProfesor()` del módulo D (`spec_modulo_D.md` §2.7, HU-D-07), que la invoca con las materias a agregar.

No tiene Route Handler ni Server Action propios.

**Comportamiento:**
- Corre sobre el `tx` del llamador. Hace `SELECT … FROM materias WHERE "idMateria" = ANY($ids) FOR SHARE` con `$queryRaw` parametrizado, nunca concatenado.
- El bloqueo compartido impide que otra transacción cambie `activaMateria` de esas filas hasta el commit del llamador. Así, el chequeo "todas activas" sigue valiendo al momento del `INSERT` (Regla N.° 7).
- Devuelve solo las materias que existen, activas o no, con su estado en `activa`. No lanza errores: decidir qué hacer con las faltantes o las inactivas es regla de negocio del llamador.
- No muta ninguna fila de `materias`.

---

### 2.4. Modificar datos de materia (HU-L-03) — NUEVA en Revisión 2

**Ruta:** `PATCH /api/materias/[id]`
**Server Action equivalente:** `modificarMateria()` en `src/server/materias/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `modificarMateria()` en `src/server/materias/materia.service.ts`
**Permiso requerido:** `materias:editar` (exclusivo del rol Gerente)
**Pantalla:** modo edición del mismo detalle `/materias/[id]` (mapa de pantallas §1, "Ficha de materia"), con el formulario precargado con nombre y código actuales (HU-L-03 AC1). Página completa, banner inline "Materia actualizada correctamente".

```typescript
// src/server/materias/materia.schema.ts
export const ModificarMateriaSchema = CrearMateriaSchema.partial().extend({
  codigo: CrearMateriaSchema.shape.codigo.nullable(), // null = quitar el código (el alta permite materias sin código)
  version: z.number().int().nonnegative(),             // control de concurrencia optimista — obligatorio
}).strict();
export type ModificarMateriaInput = z.infer<typeof ModificarMateriaSchema>;
```
Mismas reglas de validación y normalización que el alta (2.1): `nombre` recortado, espacios internos colapsados, 2 a 80 caracteres; `codigo` alfanumérico sin espacios, hasta 10, en mayúsculas. **`.strict()` rechaza `is_active` y cualquier campo de duración** (AC5). La UI usa el mismo esquema y la misma normalización que el alta (`MateriaForm`).

**Comportamiento esperado (`materia.service.ts` → `modificarMateria`), dentro de una única `prisma.$transaction`:**
1. La materia debe existir: `404 MATERIA_NO_ENCONTRADA`. Se compara el payload contra los valores actuales; si ningún campo cambia, `200` con `campos_modificados: []` sin escribir (la UI mantiene "Guardar" deshabilitado, AC3).
2. Si cambia `nombre`: `nombreNormalizadaMateria = normalizarTexto(nombre)` y unicidad aplicativa **excluyendo la propia materia**, contra **todas** las demás, activas e inactivas: `409 NOMBRE_DUPLICADO` (con la indicación "(inactiva)" cuando corresponde, igual que 2.1). La comparación no distingue mayúsculas ni acentos (AC2).
3. Si cambia `codigo` (ya en mayúsculas por el schema): unicidad análoga excluyendo la propia materia: `409 CODIGO_DUPLICADO`.
4. **Concurrencia optimista (Regla N.° 7):** condición y mutación en una única sentencia (mismo patrón que `spec_modulo_B.md` §2.5 paso 3):
   ```typescript
   const r = await tx.materia.updateMany({
     where: { idMateria: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, updatedAtMateria: new Date(), modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
   ```
   Defensa adicional: la violación de constraint único (`P2002`) sobre `nombreNormalizadaMateria` o `codigoMateria` se traduce al mismo `409` que los pasos 2 y 3.
5. **Solo se actualizan los campos modificados** (diff, AC3); se registra la fecha de última modificación (`updatedAtMateria`, que el detalle de 2.2 devuelve como `updated_at`). `id`, `is_active` y `createdAtMateria` no son editables.
6. **Efecto sobre otros módulos:** ninguno que requiera trabajo. Turnos y profesores referencian la materia por id, así que el nuevo nombre se refleja solos en todas las pantallas. Un cambio de nombre **no** afecta a los turnos ya configurados ni reabre ninguna validación.

**Modelo (cambios en `schema.prisma`):**
```prisma
model Materia {
  // ... campos existentes ...
  updatedAtMateria       DateTime @default(now()) @updatedAt   // NUEVO
  modificadoPorUsuarioId String?                                // NUEVO, escalar sin relación
  version                Int      @default(0)                   // NUEVO
}
```

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["nombre", "codigo"], "version": 2 }, "error": null }
```

**Errores esperados:** `400` (validación, incluido cualquier campo no permitido) · `403 SIN_PERMISO` · `404 MATERIA_NO_ENCONTRADA` · `409 NOMBRE_DUPLICADO` · `409 CODIGO_DUPLICADO` · `409 CONFLICTO_EDICION_CONCURRENTE` ("La materia fue modificada por otro usuario. Recargá para ver los datos actuales.").

**Cancelar (AC4):** botón «Cancelar» del modo edición (`MateriaForm`):
- **Sin cambios sin guardar** (los valores coinciden con los cargados desde el detalle): vuelve al detalle `/materias/[id]` en modo lectura, sin diálogo y sin llamar a la API.
- **Con cambios sin guardar** (formulario marcado como modificado en `DirtyStateContext`, el mismo patrón que el alta, HU-L-01): no navega; abre un diálogo de confirmación con el título «¿Descartar los cambios?», el texto «Tenés cambios sin guardar. Si salís de esta pantalla, se van a perder.» y dos botones: «Seguir editando» (cierra el diálogo y conserva lo tipeado) y «Descartar cambios» (vuelve al detalle en modo lectura con los valores guardados, sin llamar a la API).
- El mismo diálogo aparece si se abandona la pantalla por otro camino (menú, logo, cerrar sesión), porque `DirtyStateProvider` centraliza la salida con cambios sin guardar.
- Este es el texto de referencia también para `spec_modulo_K.md` §2.4 (HU-K-03 AC4). Si el componente ya implementado usa otro texto, prevalece el existente y se actualizan L y K a la vez (a confirmar contra el código).

---

### 2.5. Servicio público: obtener materias por id (Revisión 2, consumido por `spec_modulo_E.md` y `spec_modulo_D.md` §2.7)

**Función:** `obtenerMateriasPorIds(ids: string[], db?: Prisma.TransactionClient): Promise<{ id, nombre, codigo, activa }[]>` declarada y exportada en `src/server/materias/materia.publico.ts` (Regla N.° 3).
**Comportamiento:** devuelve las materias que existen, **activas o inactivas**, con su estado en `activa`. No lanza errores por ids inexistentes (simplemente no aparecen). No bloquea filas (a diferencia de 2.3). No tiene Route Handler propio. Sirve para completar nombres en listados de otros módulos sin consultar `materias` (Regla N.° 3).

---

### 2.6. Servicios públicos del módulo (Revisión 2, documentación del contrato)

Resumen de todas las funciones que este módulo provee a otros (Regla N.° 3: el proveedor documenta su contrato). Las de 2.3 y 2.5 se detallan en sus secciones; las tres últimas las consumían otras specs sin estar escritas acá. Se declaran en `src/server/materias/materia.publico.ts`, como las de 2.3 y 2.5; las que ya existen desde Sprint 1 en otro archivo se mueven o reexportan desde ahí (ubicación actual a confirmar contra el código). Las firmas salen de lo que cada consumidor declara; hay que confirmarlas contra el código existente.

| Función | Devuelve | Consumidores |
|---|---|---|
| `bloquearMateriasParaAsociar(ids, tx)` (§2.3) | `{ id, nombre, codigo, activa }[]` de las materias existentes, con `FOR SHARE` sobre el `tx` del llamador | `spec_modulo_D.md` §2.3 (HU-D-03) y §2.7 (HU-D-07) |
| `obtenerMateriasPorIds(ids, db?)` (§2.5) | `{ id, nombre, codigo, activa }[]` de las materias existentes, activas o no | `spec_modulo_E.md`; `spec_modulo_D.md` §2.7 |
| `verificarMateriaActiva(materiaId)` | la materia si existe y está activa; si no, falla o devuelve vacío (firma exacta: a confirmar) | `spec_modulo_C.md` §2.1, §2.8; `spec_modulo_J.md` §2.2 |
| `obtenerOpcionMateriaActiva(materiaId)` | `{ id, nombre, codigo }` de una materia activa, o `null`. Además del control de actividad, devuelve nombre y código para el encabezado del calendario | `spec_modulo_J.md` §2.2 |
| `listarMateriasActivas()` | `{ id, nombre, codigo }[]` de las materias activas, para el selector de materia | `spec_modulo_J.md` §2.2 (nota) |

Origen: `verificarMateriaActiva` existe desde Sprint 1; `bloquearMateriasParaAsociar`, `obtenerMateriasPorIds`, `obtenerOpcionMateriaActiva` y `listarMateriasActivas` son aditivas (`bloquearMateriasParaAsociar` por HU-D-03; el resto en Revisión 2). **Revisión 3:** las funciones de este cuadro siguen sin devolver tarifas; la que las expone se documenta en 2.10.

---

### 2.7. Ver la tarifa y su historial (HU-L-06, criterios 1, 3, 6 y 7) — NUEVA en Revisión 3

**Rutas:** las mismas de 2.2 (`GET /api/materias` y `GET /api/materias/[id]`). No hay rutas nuevas de lectura para esta sección.
**Permiso requerido:** `materias:leer` (sin cambios) para obtener la respuesta, y **`materias:ver_tarifa`** (nuevo, Mesa de Entrada y Gerente, P-L2) para que la respuesta incluya la tarifa y el historial.
**Pantallas:** P-43 «Materias» (columna «Tarifa por hora») y P-44 «Ficha de la materia» (sección «Tarifa por hora» con el historial), `docs/adicionales/mapa-pantallas-sprint-3.md`.

**Regla de visibilidad (HU-L-06 c7):** el Profesor tiene `materias:leer` (`spec_modulo_A.md` §2.4) y **no ve precios**. Por eso la tarifa no depende de `materias:leer`: el servicio arma la respuesta con una sola función `aDtoMateria(materia, { conTarifa })` y, cuando el llamador no tiene `materias:ver_tarifa`, **las claves de tarifa no existen en la respuesta** (no van en `null` ni en `0`) y ni siquiera se seleccionan de la base. El recorte es del servidor; la interfaz no decide nada.

**Cambios sobre 2.2 (aditivos, el contrato original no se toca):**
- Cada ítem del listado suma `tarifa_hora` (entero en pesos, o `null` si la materia todavía no tiene tarifa; la interfaz muestra «Sin tarifa», texto del archivo central). Se muestra en formato «$ 12.000» (HU-C-25 c2). El listado sigue incluyendo activas e inactivas, con el mismo orden y la misma paginación.
- El detalle suma `tarifa_hora` y `historial_tarifas`.

**`historial_tarifas`:** los registros de `HistorialTarifa` (2.8 y 2.9) de la materia, **del más reciente al más antiguo** (`fecha` descendente, `id` descendente como desempate), sin paginar (el volumen es bajo; si el PO pide paginación se agrega de forma aditiva). Cada registro trae `fecha`, `tarifa_anterior` (`null` en la primera definición de la tarifa), `tarifa_nueva`, `usuario` y `masivo` (HU-L-06 c6). El nombre del usuario se resuelve con `obtenerNombresGerentes(usuarioIds)` (`spec_modulo_G.md` §2.7), una sola llamada para todo el historial; si no se puede resolver, `usuario.nombre` es `null` y la interfaz muestra el texto del archivo central. El seed **no** crea registros de historial para las tarifas iniciales: una materia que nunca cambió de tarifa devuelve `[]`.

**Respuesta `200 OK` del detalle (Gerente o Mesa de Entrada; lo nuevo está marcado):**
```json
{
  "data": {
    "id": "cuid",
    "nombre": "Física I",
    "codigo": "FIS1",
    "is_active": true,
    "created_at": "2026-03-02T14:00:00.000Z",
    "updated_at": "2026-10-08T10:30:00.000Z",
    "version": 2,
    "profesores": [{ "id": "cuid", "nombre_completo": "Ríos, Martín" }],
    "tarifa_hora": 15000,
    "historial_tarifas": [
      { "fecha": "2026-10-08T10:30:00.000Z", "tarifa_anterior": 12000, "tarifa_nueva": 15000,
        "usuario": { "id": "cuid", "nombre": "Paz, Carolina" }, "masivo": false }
    ]
  },
  "error": null
}
```
Para el Profesor la respuesta es idéntica a la de 2.2: sin `tarifa_hora` ni `historial_tarifas`.

**Ejemplo de precio (HU-L-06 c3):** la ficha muestra «una clase de 2 h cuesta $ 30.000». Si la materia no tiene tarifa no hay ejemplo y se muestra «Sin tarifa». La interfaz lo calcula con el helper compartido `precioClase` (`PR-0.md` §2.4), no con una fórmula propia: si el cálculo cambia, cambia en un solo lugar. El texto va en el archivo central.

**Alumno y precio:** el alumno ve el precio de una clase al reservar (HU-C-20) y Mesa de Entrada lo ve al cobrar (HU-I-10), pero ambos lo leen del **precio guardado en la inscripción** (`spec_modulo_C.md` / `spec_modulo_I.md`), no de este módulo. Ninguna ruta de L devuelve tarifas al Alumno ni al Profesor.

**Errores esperados:** los de 2.2 (`403 SIN_PERMISO` · `404 MATERIA_NO_ENCONTRADA`). Un llamador sin `materias:ver_tarifa` **no** recibe error: recibe la respuesta sin tarifa.

---

### 2.8. Cambiar la tarifa de una materia (HU-L-06, criterios 1, 2, 4, 5, 6 y 7) — NUEVA en Revisión 3

**Ruta:** `PUT /api/materias/[id]/tarifa`
**Server Action equivalente:** `cambiarTarifaMateria()` en `src/server/materias/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `cambiarTarifaMateria(id, input, actor)` en `src/server/materias/materia.service.ts`, que delega en la función interna `aplicarCambiosDeTarifa(tx, cambios, { masivo }, actor)`. **La misma función la reutiliza HU-L-07 (2.9)**: HU-L-06 la crea (prioridad 13) y HU-L-07 (prioridad 14) la consume (mapa, M-42: «el servicio que escribe la tarifa lo reutiliza HU-L-07»).
**Permiso requerido:** **`materias:cambiar_tarifa`** (nuevo, exclusivo del Gerente; una sola acción para HU-L-06 y HU-L-07, P-L2). Otros roles reciben `403 SIN_PERMISO` (HU-L-06 c7).
**Pantalla:** P-44, botón «Cambiar tarifa» → modal M-42 (el aviso del precio congelado va dentro del modal). Antes de guardar, la confirmación común de HU-C-25: «¿Estás seguro de que querés cambiar la tarifa de Física I de $ 12.000 a $ 15.000 por hora?». Es una confirmación de interfaz: el servidor valida igual.

```typescript
// src/server/materias/materia.schema.ts
export const TARIFA_HORA_MAX = 1_000_000; // tope técnico, ver P-L3

// Importe entero en pesos, mayor que 0 (HU-L-06 c1 y HU-L-07 c2). Los mensajes salen del archivo central (HU-C-23).
export const TarifaHoraSchema = z.number().int().positive().max(TARIFA_HORA_MAX);

export const CambiarTarifaSchema = z.object({
  tarifa_hora: TarifaHoraSchema,   // la tarifa nueva
  tarifa_actual: TarifaHoraSchema.nullable(), // la que la pantalla le mostró al gerente (concurrencia optimista); obligatoria. `null` = la pantalla mostraba «Sin tarifa»
}).strict();
export type CambiarTarifaInput = z.infer<typeof CambiarTarifaSchema>;
```
El error de validación se muestra **junto al campo** (HU-L-06 c1). `.strict()` rechaza cualquier otro campo (`nombre`, `is_active`, `version`…): esta ruta solo toca la tarifa.

**Comportamiento esperado (`cambiarTarifaMateria`), en una única `transaccion`:**
1. **Bloqueo (Regla N.° 7, `PR-0.md` §2.10):** `bloquear(tx, { recursos: [{ tipo: "materia", id }] })` (el recurso va primero en el orden canónico; forma exacta de la llamada: P-L5). Con READ COMMITTED una condición en una sola sentencia no alcanza para decidir con varios chequeos: se bloquea y se decide sobre la fila bloqueada.
2. Leer la materia ya bloqueada: no existe → `404 MATERIA_NO_ENCONTRADA`. Está inactiva → `422 MATERIA_INACTIVA` (P-L4).
3. **Guarda de concurrencia:** si `tarifaHora` de la fila ≠ `tarifa_actual` (`null` cuenta como un valor: «sin tarifa» ≠ cualquier importe) → `409 CONFLICTO_EDICION_CONCURRENTE`. Otra persona cambió la tarifa después de que la pantalla la mostró y la confirmación («de $ 12.000 a $ 15.000») ya no sería verdad. Un reintento de una solicitud que ya se aplicó también cae acá, así que no duplica el historial (P-L7).
4. Si `tarifa_hora` = `tarifaHora` actual → `422 TARIFA_SIN_CAMBIO` (nunca ocurre con una materia sin tarifa: definirla es siempre un cambio) («La tarifa es la misma que la actual», HU-L-06 c1). No escribe nada ni registra historial.
5. `aplicarCambiosDeTarifa` actualiza `Materia.tarifaHora` y `modificadoPorUsuarioId` y **inserta una fila de `HistorialTarifa`** `{ materiaId, tarifaAnterior, tarifaNueva, usuarioId, fecha: ahora(), masivo: false }` **en la misma transacción** (HU-L-06 c6, Regla N.° 8; P-L6). **No** incrementa `version`: la versión protege el nombre y el código (2.4), que esta ruta no toca, y un cambio de tarifa no debe obligar a otro gerente que está editando el nombre a recargar. `updatedAtMateria` (`@updatedAt` de Prisma) se mueve igual; la fecha autoritativa del cambio de tarifa es `HistorialTarifa.fecha`.
6. **No toca inscripciones** (HU-L-06 c4). Ver 3.6.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "tarifa_hora": 15000, "tarifa_anterior": 12000 }, "error": null }
```
`tarifa_anterior` es `null` cuando se define por primera vez la tarifa de una materia sin tarifa; la confirmación de HU-C-25 usa entonces un texto propio del archivo central («… definir la tarifa de Física I en $ 15.000 por hora?»).
```json
{ "data": { "id": "cuid", "tarifa_hora": 15000, "tarifa_anterior": null }, "error": null }
```
La interfaz muestra «Tarifa actualizada correctamente» (c2) y recarga el detalle, que ya trae el registro nuevo del historial.

**Errores esperados:**
| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | importe no entero, ≤ 0, mayor al tope, ausente o campo ajeno |
| 403 | `SIN_PERMISO` | sin `materias:cambiar_tarifa` |
| 404 | `MATERIA_NO_ENCONTRADA` | el id no existe |
| 409 | `CONFLICTO_EDICION_CONCURRENTE` | la tarifa cambió después de mostrarse (paso 3) |
| 409 | (clave `errores.transaccion.ocupada`, `PR-0.md` §2.10) | espera de bloqueo vencida: «Otra persona está modificando estos datos. Intentá de nuevo.» |
| 422 | `MATERIA_INACTIVA` | la materia está dada de baja |
| 422 | `TARIFA_SIN_CAMBIO` | el importe es igual al actual |

El servicio lanza `ErrorDeDominio(clave)` con claves del archivo central y nunca devuelve textos (HU-C-23); la columna `code` es el código estable que ve el cliente.

---

### 2.9. Cambiar la tarifa de varias materias a la vez (HU-L-07) — NUEVA en Revisión 3

Dos rutas: una lectura para armar la pantalla y una escritura.

**Pantalla:** P-43, botón «Cambiar tarifas de varias materias» (solo Gerente) → modal M-41 de dos pasos: (1) elegir materias y tarifa nueva; (2) vista previa y confirmación.
**Permiso requerido (ambas rutas):** `materias:cambiar_tarifa` (el mismo de 2.8). Otros roles: `403 SIN_PERMISO` (HU-L-07 c9).

#### 2.9.1. Materias activas con su tarifa (lectura del paso 1)

**Ruta:** `GET /api/materias/tarifas`
**Servicio:** `listarMateriasConTarifa()` en `src/server/materias/materia.service.ts`

Devuelve **todas las materias activas**, sin paginar, ordenadas por `nombre_normalizado` ascendente. Las inactivas **no se listan** y conservan su tarifa (HU-L-07 c6). Una materia sin tarifa viene con `tarifa_hora: null` y la interfaz muestra «Sin tarifa». El buscador (nombre o código, desde 2 caracteres, sin distinguir mayúsculas ni acentos), «Seleccionar todas (N)» (marca solo las que se ven con la búsqueda) y el contador de seleccionadas funcionan **en el cliente** sobre esta lista, con `normalizarTexto()` (2.1 paso 1): así la selección no se pierde al cambiar la búsqueda (HU-L-07 c1). La vista previa del paso 2 también se arma en el cliente con esta lista.

```json
{
  "data": { "items": [ { "id": "cuid", "nombre": "Física I", "codigo": "FIS1", "tarifa_hora": 12000 } ] },
  "error": null
}
```
Nota de ruteo: en Next.js el segmento estático `tarifas` tiene prioridad sobre `[id]`, y los ids son CUID, así que no hay colisión con `GET /api/materias/[id]`.
**Errores:** `403 SIN_PERMISO`.

#### 2.9.2. Aplicar el cambio masivo

**Ruta:** `POST /api/materias/tarifas`
**Server Action equivalente:** `cambiarTarifasMasivo()` en `src/server/materias/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `cambiarTarifasMasivo(input, actor)` en `src/server/materias/materia.service.ts`, sobre `aplicarCambiosDeTarifa` de 2.8 con `masivo: true`.

```typescript
export const CambiarTarifasMasivoSchema = z.object({
  tarifa_hora: TarifaHoraSchema, // la tarifa nueva, una sola para todas
  materias: z.array(
    z.object({
      id: z.string().cuid(),
      tarifa_actual: TarifaHoraSchema.nullable(), // la que la vista previa mostró para esa materia (`null` = sin tarifa)
    }).strict(),
  )
    .min(1)    // «Continuar» exige al menos una (HU-L-07 c2)
    .max(200)  // tope defensivo
    .refine((m) => new Set(m.map((x) => x.id)).size === m.length, "ids repetidos"),
}).strict();
export type CambiarTarifasMasivoInput = z.infer<typeof CambiarTarifasMasivoSchema>;
```
La interfaz envía **todas las materias seleccionadas**, incluidas las que ya tienen esa tarifa («Sin cambio», c3): el servidor las clasifica, así la regla vive en un solo lugar y la guarda de concurrencia las cubre también.

**Comportamiento esperado, en una única `transaccion` (todo o nada, HU-L-07 c5):**
1. Ordenar los ids de forma ascendente y bloquearlos **en una sola llamada**: `bloquear(tx, { recursos: ids.map((id) => ({ tipo: "materia", id })) })` (`PR-0.md` §2.10 y §2.16; P-L5).
2. Leer las materias bloqueadas. Alguna no existe → `404 MATERIA_NO_ENCONTRADA`. Alguna está inactiva → `422 MATERIA_INACTIVA` y **no se cambia ninguna**, aunque el cliente la haya enviado (HU-L-07 c6; P-L4).
3. **Guarda de concurrencia:** si alguna materia tiene `tarifaHora` ≠ su `tarifa_actual` → `409 CONFLICTO_EDICION_CONCURRENTE` y no se cambia ninguna. La interfaz recarga la lista y la vista previa.
4. Clasificar: **sin cambio** = su tarifa ya es `tarifa_hora`; **cambian** = el resto (HU-L-07 c3), incluidas las que no tenían tarifa (`null`), que quedan definidas con este cambio.
5. Si no hay ninguna que cambie: `200` con `actualizadas: 0`, sin escribir ni registrar nada. La interfaz muestra «Las materias seleccionadas ya tienen esa tarifa» (c5).
6. Si hay: tomar `fecha = ahora()` **una sola vez** y, por cada materia que cambia (en orden de id), llamar a `aplicarCambiosDeTarifa` con `masivo: true`: actualiza `tarifaHora` y `modificadoPorUsuarioId` e inserta su fila de `HistorialTarifa` (HU-L-07 c8). Todas las filas del mismo cambio masivo comparten `fecha`. Las materias «sin cambio» **no** se modifican ni dejan historial.
7. Cualquier excepción revierte la transacción completa: si una materia falla, no se cambia ninguna (c5).

**Respuesta `200 OK`:**
```json
{ "data": { "tarifa_hora": 8000, "actualizadas": 3, "sin_cambio": 1 }, "error": null }
```
La interfaz muestra «Se actualizó la tarifa de N materias» con N = `actualizadas` (c5). El N del mensaje de confirmación previo (HU-L-07 c4) son las materias que cambian, sin las «Sin cambio» (DEC-42); la interfaz lo calcula con la misma regla del paso 4.

**El cambio rige solo para las inscripciones nuevas** (c7): este servicio no toca inscripciones (3.6).

**Errores esperados:** los mismos de 2.8 (`400 VALIDATION_ERROR` también por `materias` vacío o con ids repetidos). No existe `TARIFA_SIN_CAMBIO` en el masivo: «sin cambio» no es un error sino una clasificación.

---

### 2.10. Servicios públicos agregados en Revisión 3

Se declaran en `src/server/materias/materia.publico.ts` (Regla N.° 3), igual que los de 2.3, 2.5 y 2.6.

| Función | Devuelve | Consumidores |
|---|---|---|
| `obtenerTarifasPorIds(ids, db?)` | `{ id, tarifaHora }[]` de las materias existentes, activas o no; `tarifaHora` es `null` si la materia no tiene tarifa (el consumidor debe rechazar con `MATERIA_SIN_TARIFA`, 3.12). No lanza errores por ids inexistentes y **no bloquea** filas | `spec_modulo_C.md` (`crearInscripcion`: HU-C-20, HU-C-22, HU-C-24) y `spec_modulo_I.md` (HU-I-10, «Se inscribe al confirmar el pago»), que calculan el precio con `precioClase` (`PR-0.md` §2.4) |

`obtenerMateriasPorIds` (2.5) y las demás funciones de 2.6 **no devuelven tarifa a propósito**: los consumidores de nombres (D, E, J) no tienen por qué recibir precios. `precioClase(materia, duracionMin)` es un helper compartido del PR 0, no una función de este módulo; si el PR 0 lee `Materia.tarifaHora` directamente desde C o I, hay que enrutarlo por `obtenerTarifasPorIds` o documentar la excepción a la Regla N.° 3 (P-L5).

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/materias/materia.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Unicidad case/acento-insensitiva contra el universo completo (activas + inactivas)
Tanto `nombre` como `codigo` se validan contra **todas** las materias existentes, sin excluir las dadas de baja — una materia inactiva sigue "ocupando" su nombre y código. La comparación nunca se hace sobre el valor crudo ingresado por el usuario: siempre sobre su forma normalizada (`nombre_normalizado`, `codigo` ya en mayúsculas).

### 3.2. Doble validación: aplicativa + constraint de base
Ninguna verificación de unicidad confía solo en la consulta previa al `INSERT` (riesgo de condición de carrera ante dos altas simultáneas con el mismo nombre). El constraint único de Prisma sobre `nombre_normalizado`/`codigo` es la garantía final; su violación (`P2002`) se traduce al mismo código de error de negocio que la validación aplicativa, nunca se propaga como error técnico crudo al cliente.

### 3.3. Sin campo de duración en este sprint
El servicio no expone ni acepta ningún campo relacionado a duración de clase para `Materia`. Cualquier cálculo de duración de turno usa el parámetro estándar del centro definido en `spec_modulo_C.md` — este acoplamiento es intencional y se documenta acá para que no se reintroduzca un campo de duración por materia sin antes revisar esa spec. **Revisión 3:** sigue vigente. El precio de la clase es `tarifa por hora de la materia × duración de la clase`; la duración es propiedad de la clase (la elige Mesa de Entrada), no de la materia (HU-L-06 c3, `PR-0.md` §2.4).

---

### 3.4. Modificar respeta la unicidad contra el universo completo, excluyéndose a sí misma (Revisión 2)
Igual que el alta (3.1), pero la materia que se edita **no cuenta como duplicado de sí misma**: se puede cambiar solo el código sin que el nombre "choque" consigo mismo. La comparación sigue siendo sobre la forma normalizada, nunca sobre el texto crudo. Aplica la doble validación de 3.2 (aplicativa + constraint).

### 3.5. Concurrencia optimista en la modificación (Revisión 2)
Todo `UPDATE` de una materia desde HU-L-03 exige `version` y la compara en la misma sentencia que la escritura (`spec_modulo_B.md` §3.3). Dos gerentes editando a la vez no se pisan: el segundo recibe `409 CONFLICTO_EDICION_CONCURRENTE`.

### 3.6. La tarifa rige hacia adelante y no toca inscripciones (Revisión 3)
`Materia.tarifaHora` es el **único** lugar donde vive la tarifa vigente. El precio de una inscripción ya hecha se guarda **en la inscripción** al crearla (`PR-0.md` §2.1 y §2.4) y este módulo **no lee ni escribe inscripciones**: un cambio de tarifa, individual o masivo, rige solo para las inscripciones que se creen después (HU-L-06 c4, HU-L-07 c7). Ejemplo del backlog: Juan reserva Programación I el 5/10 a $ 12.000; el 10/10 la tarifa pasa a $ 15.000; Juan paga $ 12.000.

**Los consumidores leen la tarifa sin bloquear.** Es una lectura de una sola fila: un cambio simultáneo se ordena antes o después de la inscripción y ambos resultados son válidos. No hace falta un `FOR SHARE` sobre la materia (a diferencia de 2.3, donde la regla es «materia activa»). Que la tarifa cambie entre que se muestra un importe y se confirma el cobro es un caso de HU-I-10 (DEC-28), no de este módulo.

### 3.7. Un solo servicio escribe la tarifa y su historial (Revisión 3)
`aplicarCambiosDeTarifa` (2.8) es la **única** función que escribe `Materia.tarifaHora` y `HistorialTarifa` fuera del seed. HU-L-06 y HU-L-07 la comparten; ningún otro módulo escribe esas columnas. El seed carga la tarifa inicial solo al crear la materia y **no** escribe historial ni pisa cambios posteriores (`PR-0.md` §2.4).

### 3.8. Concurrencia: bloqueo en orden y guarda de la tarifa mostrada (Revisión 3)
Todo cambio de tarifa bloquea las materias involucradas **por id ascendente, en una sola llamada** a `bloquear` y decide sobre las filas bloqueadas (Regla N.° 7: con READ COMMITTED una condición en una sola sentencia no alcanza cuando hay varios chequeos). Además compara la tarifa que la pantalla mostró (`tarifa_actual`) con la real: si difiere, `409 CONFLICTO_EDICION_CONCURRENTE` y no se cambia nada. Esta operación toma bloqueos solo del primer nivel del orden canónico (recurso), así que no puede formar un ciclo con las que bajan hasta clase, inscripción o caja.

**Convivencia con HU-L-03 (2.4):** la modificación de nombre y código usa `updateMany` con `version` y **no bloquea**. No se pisan: HU-L-03 solo escribe `nombre`, `codigo` y auditoría, y el cambio de tarifa solo `tarifaHora` y auditoría. Si coinciden, la sentencia de HU-L-03 espera el bloqueo de fila y después aplica su condición de `version`, que el cambio de tarifa no tocó.

### 3.9. Quién ve y quién cambia (Revisión 3)
- **Cambia:** solo el Gerente (`materias:cambiar_tarifa`), en 2.8 y 2.9.
- **Ve la tarifa y el historial:** Mesa de Entrada y Gerente (`materias:ver_tarifa`, DEC-43: Mesa los ve en solo lectura, sin «Cambiar tarifa»).
- **No ve precios:** Profesor y Alumno (HU-L-06 c7). La restricción se aplica **en el servidor**, recortando la respuesta (2.7), no ocultando elementos en la interfaz.

### 3.10. El importe es un entero en pesos (Revisión 3)
La tarifa es un entero mayor que 0 y menor o igual a `TARIFA_HORA_MAX`; no admite decimales. Como las duraciones permitidas de una clase son 60, 120 y 180 minutos (`PR-0.md` §2.4), `precioClase` da siempre un entero. El tope existe para que el precio de una clase de 3 horas entre en la columna entera de la inscripción (P-L3).

### 3.11. El historial no se corrige (Revisión 3)
`HistorialTarifa` es un registro de hecho consumado (Regla N.° 8): no admite `UPDATE` ni `DELETE`. Una tarifa mal cargada se corrige con un cambio nuevo, que deja su propio registro. Este módulo no tiene una acción de «deshacer».

### 3.12. Materia sin tarifa (Revisión 3, P-L1)
La tarifa admite `null` para no romper el alta de materias ya desarrollada (HU-L-01) ni ninguna materia creada antes del Sprint 3. Una materia sin tarifa:
- se lista y se abre con normalidad (la interfaz muestra «Sin tarifa») y **no impide crear clases** de esa materia;
- **no admite inscripciones nuevas**: `crearInscripcion` y el cálculo de precio de C e I rechazan con `422 MATERIA_SIN_TARIFA` (clave del archivo central, por ejemplo «Esta materia todavía no tiene tarifa. Pedile al gerente que la defina.»), porque toda inscripción guarda su precio al crearse (HU-L-06 c5) y sin tarifa no hay precio. Ese rechazo lo declaran y prueban `spec_modulo_C.md` e `spec_modulo_I.md`; esta spec solo fija el contrato (2.10);
- se corrige con 2.8 o 2.9, que tratan «sin tarifa» como un valor más en la guarda de concurrencia y registran la primera definición con `tarifa_anterior = null`.
Las materias del seed del PR 0 traen tarifa, así que los datos de prueba no se ven afectados.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Conforme a `docs/RULES.md` Regla N.° 2, el módulo usa la **opción (a) — columnas de auditoría en la propia entidad**: el alta registra `createdAtMateria`/`creadoPorUsuarioId` (HU-L-01) y la modificación registra `updatedAtMateria`, `modificadoPorUsuarioId` y `version` (ver más abajo). Alcanza porque solo se necesita la trazabilidad del ciclo de vida normal de `Materia` (quién y cuándo la creó o modificó), sin eventos discretos repetibles sobre la misma entidad. Al ser parte de la propia fila, se persiste en la misma operación; no hay tabla de eventos propia (opción b) ni escritura posterior al `COMMIT`.

El evento `materia:creada` es la notificación de dominio declarada para el alta; no es el mecanismo de trazabilidad.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `materia:creada` | Alta de materia (2.1) | `materia_id, nombre, codigo, usuario_id` |

**Nota de sincronización (HU-L-01, resuelta):** no existe event bus ni `AuditLog` en este sprint (mismo gap documentado en `spec_modulo_A.md`). A diferencia de los eventos de sesión, acá no se escribe a ninguna tabla de log separada — `EventoSeguridad` está tipado específicamente para eventos de seguridad, no es un log genérico de dominio, y crear una tabla de auditoría de negocio nueva está fuera del alcance de esta HU. La trazabilidad que pide el criterio 4 de HU-L-01 ("se registran fecha de alta y usuario") queda satisfecha por las columnas `createdAtMateria`/`creadoPorUsuarioId` que la propia fila de `Materia` ya persiste — no hace falta un evento/log aparte para eso.

**Revisión 2 (Sprint 2) — trazabilidad (Regla N.° 2).** La modificación de una materia usa la **opción (a)**: `updatedAtMateria`, `modificadoPorUsuarioId` y `version` en la propia fila; HU-L-03 AC3 ("se registra la fecha de última modificación") queda cubierta por `updatedAtMateria`. No hay evento `materia:modificada`.

**Revisión 3 (Sprint 3) — trazabilidad (Regla N.° 2 y Regla N.° 8).** El cambio de tarifa deja **un registro de `HistorialTarifa` por materia modificada** (tarifa anterior, tarifa nueva, usuario, fecha y `masivo`), además de `modificadoPorUsuarioId` y `updatedAtMateria` en la fila. A diferencia de las tablas de eventos de otros módulos, **el registro se inserta en la misma transacción que el cambio** y no después del commit: es un registro de hecho consumado que la pantalla muestra como dato del negocio (HU-L-06 c6) y que HU-L-07 debe dejar atómico con el cambio (c5, todo o nada), en línea con `PR-0.md` §2.4 y el mapa (M-42). Es una excepción acotada a la regla de «tabla separada después del commit» (P-L6). No hay evento de dominio nuevo.

| Mutación | Mecanismo | Sección |
|---|---|---|
| Cambiar la tarifa de una materia | una fila de `HistorialTarifa` (`masivo = false`), misma transacción | 2.8 |
| Cambiar la tarifa de varias materias | una fila por materia que cambia (`masivo = true`, misma `fecha`), misma transacción; las «sin cambio» no dejan registro | 2.9 |
```
