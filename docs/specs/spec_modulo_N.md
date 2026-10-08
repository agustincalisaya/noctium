```markdown
# Especificación Técnica — Módulo N (Configuración del centro)
## Noctium — Sprint 3
## Revisión 1 — Sprint 3: parámetros del centro (HU-N-01)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 · Prisma ORM (`prisma-client`) · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` §2.4 (matriz RBAC) · `spec_modulo_G.md` §2.7 (nombres de gerentes) · `spec_modulo_C.md` (consumidores: HU-C-14, C-20, C-22, C-24) · `spec_modulo_H.md` (HU-H-07) · `PR-0.md` §2.6, §2.13, §2.14, §2.16 · `schema.prisma` (`ParametroSistema`) · `docs/adicionales/mapa-pantallas-sprint-3.md` (ficha P-50) · Backlog Sprint 3 (HU-N-01, HU-C-23, HU-C-25)

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-N-01 | Sin spec (el módulo N no existía) | Añadidas secciones 2.1 (ver), 2.2 (modificar), 2.3 (historial) y 2.4 (lectura por los consumidores) |

**Puntos a confirmar antes de implementar:**
| # | Punto | Quién |
|---|---|---|
| P-N1 | Nombres de las acciones `configuracion:leer` y `configuracion:editar`: propuestos. Los fija la tabla cerrada de `PR-0.md` §2.9 | PR 0 |
| P-N2 | Forma exacta de `HistorialParametro` y de `parametrosVigentes()` (`PR-0.md` §2.6): esta spec usa los campos de 2.3 y asume que `parametrosVigentes()` lee en cada llamada. Si guarda una caché, 2.2 paso 6 la invalida | PR 0 |
| P-N3 | La anticipación de cancelación se evalúa con el valor vigente **al cancelar** (HU-N-01 c3, marcado «a confirmar por el PO» en el backlog). La spec lo implementa así: no se guarda un límite por inscripción | PO |
| P-N4 | Los tres valores son **enteros** (HU-N-01 c2 habla de rangos de 1 a 72 y de 1 a 100). Un valor con decimales se rechaza | PO |

---

## 1. Visión General

El Módulo N expone **una sola pantalla**, «Configuración del centro», con tres parámetros que usan historias del producto final. Hasta que el Gerente los modifique rigen los valores por defecto, que carga la **migración** y mantiene el **seed** sin pisar lo que cambió esta HU (`PR-0.md` §2.6). Si HU-N-01 se recorta, los valores por defecto quedan como definitivos y ningún criterio de otra HU cambia (convención 7 del backlog).

| Parámetro | Clave en `ParametroSistema` | Rango | Defecto | Quién lo usa |
|---|---|---|---|---|
| Plazo para pagar una reserva | `plazo_pago_horas` | 1–72 h | 24 | HU-C-22, HU-C-24 (criterio 5) |
| Anticipación mínima para cancelar en línea | `cancelacion_anticipacion_horas` | 1–72 h | 24 | HU-C-14, HU-C-20 |
| Umbral de presentismo bajo | `umbral_presentismo` | 1–100 % | 75 | HU-H-07 |

**Quién escribe qué:** el módulo N es el **único que escribe** estas tres claves (después de la migración inicial). Los demás módulos las **leen** exclusivamente con `parametrosVigentes()` (`src/server/shared/parametros.ts`, `PR-0.md` §2.6), nunca la tabla directamente (Regla N.° 3). Los datos fijos del centro (`centro_nombre`, `centro_domicilio`, `centro_telefono`) y cualquier otra clave de `ParametroSistema` (por ejemplo `generacion_maxima_dias`) **no se editan** desde esta pantalla en este sprint.

**Modelo de datos** (lo crea el PR 0, sin migraciones nuevas en esta HU):
- `ParametroSistema(clave PK, valor String)`: el valor se guarda como texto; el catálogo de 2.4 lo convierte a entero.
- `HistorialParametro`: `idHistorialParametro`, `clave`, `valorAnterior`, `valorNuevo`, `usuarioId`, `fecha` (HU-N-01 c4, Regla N.° 2).

**Estructura de archivos (Regla N.° 11):** `src/types/configuracion.types.ts`; `src/server/configuracion/actions.ts`; `src/server/configuracion/configuracion.schema.ts`; `src/server/configuracion/configuracion.service.ts`; `src/server/configuracion/parametros-configurables.ts` (catálogo, 2.4). Pantalla: P-50 del mapa de pantallas (`docs/adicionales/mapa-pantallas-sprint-3.md`), ruta sugerida `/configuracion` (la real la fija `src/server/shared/rutas-por-rol.ts`), menú «Configuración del centro», solo Gerente; llama a `exigirPermiso`. El mapa decide el diseño de la pantalla y el prototipo la muestra; esta spec es el contrato. Ante una contradicción, se avisa al PO.

**Plan de recorte (convención 7 del backlog):** es el paso 1 (−2 SP). Si se recorta, no hay pantalla ni menú y los valores por defecto quedan como definitivos; esta spec no cambia, solo no se implementa.

**Textos:** todos salen del archivo central de HU-C-23 («Configuración guardada», nombres de los parámetros, unidades, mensajes de rango). El servicio lanza `ErrorDeDominio(codigo)` y nunca devuelve textos.

**Fuera de alcance:** el umbral de clases con poca inscripción (HU-H-09 y HU-H-12 salieron del alcance del producto); datos del centro; guardar el límite de cancelación en cada inscripción; recalcular reservas ya hechas.

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta requiere sesión y `withPermission("configuracion:<accion>")` (Regla N.° 10). Acciones **exclusivas de GERENTE**; otros roles reciben `403 SIN_PERMISO` (HU-N-01 c5).
- Escrituras con `transaccion(fn)` y `ErrorDeDominio` (`PR-0.md` §2.16).

---

### 2.1. Ver la configuración (HU-N-01, criterio 1)

**Ruta:** `GET /api/configuracion`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `obtenerConfiguracion()` en `src/server/configuracion/configuracion.service.ts`
**Permiso requerido:** `configuracion:leer`

**Comportamiento esperado:** lee los tres valores con `parametrosVigentes()` y los devuelve junto con los metadatos del catálogo (2.4), para que la pantalla valide el rango sin duplicarlo. Solo lectura.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "parametros": [
      { "clave": "plazo_pago_horas", "campo": "plazoPagoHoras", "valor": 24, "unidad": "h", "min": 1, "max": 72, "porDefecto": 24 },
      { "clave": "cancelacion_anticipacion_horas", "campo": "cancelacionAnticipacionHoras", "valor": 24, "unidad": "h", "min": 1, "max": 72, "porDefecto": 24 },
      { "clave": "umbral_presentismo", "campo": "umbralPresentismo", "valor": 75, "unidad": "%", "min": 1, "max": 100, "porDefecto": 75 }
    ]
  },
  "error": null
}
```
Si falta una clave en la base, es un error de datos (la migración y el seed las cargan): el servicio lanza error interno (`500`) y lo registra; **no inventa un valor**.

**Errores esperados:** `403 SIN_PERMISO`.

---

### 2.2. Modificar la configuración (HU-N-01, criterios 2, 3 y 5)

**Ruta:** `PUT /api/configuracion`
**Server Action equivalente:** `guardarConfiguracion()` en `src/server/configuracion/actions.ts`
**Servicio:** `guardarConfiguracion(input, actor)` en `src/server/configuracion/configuracion.service.ts`
**Permiso requerido:** `configuracion:editar`
**Pantalla:** P-50. «Guardar» está deshabilitado mientras no haya cambios. Al guardar, la pantalla pide la confirmación de HU-C-25 mostrando cada valor anterior → nuevo (texto en el archivo central; el prototipo usa «¿Estás seguro de que querés guardar la configuración del centro?»). Es una confirmación de interfaz: el servidor valida igual. Cada campo muestra su unidad, su rango y una leyenda de cuándo rige (ver 2.4).

```typescript
// src/server/configuracion/configuracion.schema.ts
// El rango sale del catálogo de 2.4: un solo lugar para el servidor, el formulario y el seed.
const enteroEnRango = (clave: ClaveConfigurable) =>
  z.number().int().min(CATALOGO[clave].min).max(CATALOGO[clave].max);

const valoresSchema = z.object({
  plazoPagoHoras: enteroEnRango("plazo_pago_horas"),
  cancelacionAnticipacionHoras: enteroEnRango("cancelacion_anticipacion_horas"),
  umbralPresentismo: enteroEnRango("umbral_presentismo"),
});

export const GuardarConfiguracionSchema = z.object({
  valores: valoresSchema,                 // lo que el Gerente quiere dejar
  esperados: valoresSchema,               // lo que la pantalla le mostró al abrir (concurrencia optimista); obligatorio
}).strict();
export type GuardarConfiguracionInput = z.infer<typeof GuardarConfiguracionSchema>;
```
Cada valor valida su rango y el error se muestra **junto al campo** (HU-N-01 c2). `.strict()` rechaza cualquier otra clave (por ejemplo `centro_nombre`).

**Comportamiento esperado (`guardarConfiguracion`), en una única `transaccion`:**
1. Calcular los **cambios**: los parámetros cuyo `valor` difiere de su `esperado` (lo que el usuario realmente tocó). Los que no tocó se ignoran aunque otra persona los haya cambiado mientras tanto.
2. Si no hay cambios: `200` con `cambios: []`, sin escribir ni registrar historial.
3. Procesar los cambios **en orden alfabético de clave** (evita interbloqueos entre dos guardados simultáneos).
4. **Concurrencia (Regla N.° 7):** por cada cambio, condición y mutación en una sola sentencia:
   ```typescript
   const r = await tx.parametroSistema.updateMany({
     where: { clave, valor: String(esperado) },
     data: { valor: String(nuevo) },
   });
   if (r.count === 0) throw new ErrorDeDominio("errores.configuracion.conflicto");
   ```
   `count === 0` significa que otra persona cambió ese parámetro después de que la pantalla lo mostró: `409 CONFLICTO_EDICION_CONCURRENTE`, y no se guarda **ninguno** (todo-o-nada, la transacción revierte).
5. Encolar el historial de cada cambio en `ctx.despuesDelCommit` (2.3): `{ clave, valorAnterior: esperado, valorNuevo: nuevo, usuarioId: actor.usuarioId, fecha: ahora() }`. Se escribe **después** del commit (Regla N.° 2, opción (b)).
6. Después del commit, si `parametrosVigentes()` guarda caché, invalidarla (P-N2).

**Los cambios rigen desde que se guardan y no se aplican hacia atrás** (HU-N-01 c3): este servicio **no** toca reservas ni inscripciones existentes. Cómo lo respeta cada consumidor está en 2.4.

**Respuesta `200 OK`:**
```json
{ "data": { "cambios": ["plazo_pago_horas", "umbral_presentismo"] }, "error": null }
```
La interfaz muestra «Configuración guardada» (criterio 5) cuando `cambios` no está vacío.

**Errores esperados:**
- `400 VALIDATION_ERROR` — valor fuera de rango, no entero o clave ajena (error junto al campo).
- `403 SIN_PERMISO` — sin `configuracion:editar` (HU-N-01 c5).
- `409 CONFLICTO_EDICION_CONCURRENTE` — «La configuración fue modificada por otra persona. Recargá para ver los valores actuales.» (texto en el archivo central).

---

### 2.3. Historial de cambios (HU-N-01, criterio 4)

**Ruta:** `GET /api/configuracion/historial`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarHistorialConfiguracion(query)` en `src/server/configuracion/configuracion.service.ts`
**Permiso requerido:** `configuracion:leer`
**Pantalla:** la misma `/configuracion`, debajo del formulario («se ve en la misma pantalla»).

```typescript
export const ListarHistorialQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
}).strict(); // 10 por página, fijo
```

**Comportamiento esperado:** lista los registros de `HistorialParametro` **del más reciente al más antiguo** (`fecha` descendente, `id` como desempate), paginados de a 10. Cada registro trae la clave (la interfaz muestra el nombre del parámetro), el valor anterior, el valor nuevo, el usuario y la fecha. El nombre del usuario sale de `obtenerNombresGerentes(usuarioIds)` (`spec_modulo_G.md` §2.7); si la ficha no se encuentra, la interfaz muestra el id como respaldo. Solo lectura.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "id": "cuid", "clave": "plazo_pago_horas", "valorAnterior": 24, "valorNuevo": 48,
        "usuario": { "id": "cuid", "nombre": "Ibarra, Marcos" }, "fecha": "2026-10-12T14:03:00.000Z" }
    ],
    "pagina": 1, "por_pagina": 10, "total": 1, "total_paginas": 1
  },
  "error": null
}
```
Sin cambios todavía: `items: []` (la interfaz muestra el estado vacío; el prototipo dice «Todavía no hubo cambios: rigen los valores por defecto.», texto en el archivo central).

**Errores esperados:** `400 VALIDATION_ERROR` · `403 SIN_PERMISO`.

---

### 2.4. Catálogo y contrato de lectura para los consumidores

**Catálogo** (`src/server/configuracion/parametros-configurables.ts`): una constante que es la **única** fuente del rango, la unidad y el valor por defecto de los tres parámetros. Lo usan el schema de 2.2, la respuesta de 2.1 y la prueba que compara la migración y el seed contra los mismos valores.

```typescript
export const CATALOGO = {
  plazo_pago_horas:               { campo: "plazoPagoHoras",               min: 1, max: 72,  porDefecto: 24, unidad: "h" },
  cancelacion_anticipacion_horas: { campo: "cancelacionAnticipacionHoras", min: 1, max: 72,  porDefecto: 24, unidad: "h" },
  umbral_presentismo:             { campo: "umbralPresentismo",            min: 1, max: 100, porDefecto: 75, unidad: "%" },
} as const;
export type ClaveConfigurable = keyof typeof CATALOGO;
```

**Este módulo no expone funciones públicas de escritura.** La lectura que usan los demás módulos es `parametrosVigentes()` (compartido, `PR-0.md` §2.6). Cada consumidor la llama **en el momento de decidir** y respeta la regla de «no hacia atrás» así (HU-N-01 c3):

| Parámetro | Cuándo se lee | Qué no hace |
|---|---|---|
| `plazo_pago_horas` | Al crear una reserva (HU-C-22, HU-C-24) y al reabrirla por anulación del último pago (`recalcularEstadoPago`, `PR-0.md` §2.13): se calcula `venceBaseEl = inicioPlazo + plazo vigente en ese momento` y se **guarda en la inscripción** | No recalcula reservas existentes. Una reserva conserva el vencimiento que se le informó, salvo que la clase se reprograme (`recalcularVencimientos` usa el `venceBaseEl` guardado, no vuelve a leer el parámetro) |
| `cancelacion_anticipacion_horas` | Al cancelar (HU-C-14) y al mostrar el resumen previo a inscribirse (HU-C-20, límite calculado con el valor vigente en ese momento) | **No** se guarda un límite propio en cada inscripción |
| `umbral_presentismo` | Al consultar el Índice de presentismo (HU-H-07), sobre todo el período consultado | No guarda el umbral con cada mes ni con cada consulta anterior |

Ningún consumidor copia estos valores a constantes ni los cachea más allá de la solicitud en curso.

**Única función pública de este módulo:** `usuarioRegistroOperaciones(usuarioId, db?)` en `src/server/configuracion/configuracion.publico.ts` (hay un registro de `HistorialParametro` con ese usuario). HU-N-01 la agrega y suma su línea al agregador `src/server/shared/actividad-usuario.ts` (`spec_modulo_F.md` §2.7, DEC-39); la usan HU-F-05 y HU-G-05 para saber si el motivo de la baja de un gerente es obligatorio.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside exclusivamente en `src/server/configuracion/configuracion.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Un solo escritor de los parámetros
Solo `guardarConfiguracion` modifica `plazo_pago_horas`, `cancelacion_anticipacion_horas` y `umbral_presentismo`. El resto de los módulos las lee con `parametrosVigentes()` (Regla N.° 3). La migración y el seed cargan los valores por defecto; el seed usa `upsert` con la rama de actualización vacía, así que **nunca pisa** un valor que cambió el Gerente.

### 3.2. Todo-o-nada ante conflicto
Si cualquiera de los parámetros tocados cambió mientras la pantalla estaba abierta, no se guarda ninguno. La condición va dentro del `where` del `updateMany` (Regla N.° 7); nunca `findUnique` seguido de `update`.

### 3.3. Los cambios no son retroactivos
El servicio solo cambia el valor vigente. No recorre inscripciones ni reservas. La tabla de 2.4 define, por parámetro, el momento en que se lee, y es lo que garantiza el criterio 3 del backlog.

### 3.4. El rango se define una sola vez
El rango de cada parámetro está únicamente en el catálogo de 2.4. El schema de 2.2, la respuesta de 2.1 y las pruebas leen de ahí. Un cambio de rango es un cambio en un solo archivo.

### 3.5. Solo el Gerente
Las dos acciones (`configuracion:leer` y `configuracion:editar`) son exclusivas de GERENTE en la matriz; el `403` lo emite el servidor (HU-N-01 c5).

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Este módulo usa la **opción (b)** de la Regla N.° 2: una tabla de eventos por dominio (`HistorialParametro`), porque cada parámetro puede cambiar muchas veces y hay que conservar el valor anterior, el nuevo, el usuario y la fecha de **cada** cambio (HU-N-01 c4). Una columna de auditoría en `ParametroSistema` solo guardaría el último.

- El registro se escribe **después** del commit de la modificación, desde `ctx.despuesDelCommit`, con id generado antes del commit (idempotente), hasta 3 reintentos y registro del error si falla (`PR-0.md` §2.16).
- **Consecuencia aceptada:** si el registro fallara tras los 3 reintentos, el parámetro quedaría cambiado sin su fila de historial; el error queda en el log. Es el costo de no acoplar el commit del dato a una escritura secundaria que fija la Regla N.° 2.
- `ParametroSistema` no tiene columnas de auditoría propias; el historial es la fuente de «quién y cuándo».

| Mutación | Mecanismo | Sección |
|---|---|---|
| Modificar uno o más parámetros | (b) una fila de `HistorialParametro` por parámetro cambiado | 2.2, 2.3 |
```
