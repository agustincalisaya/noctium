# TASK: HU-I-12-b — Movimientos manuales de caja

**Módulo:** I (Pagos)
**Sprint:** 3
**Contrato de referencia:** `docs/specs/spec_modulo_I.md` §2.10.3 (Registrar un movimiento manual), §2.10.4 (Anular un movimiento), §2.10.5 (errores) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-I-12, criterio 3, línea 295-296) · `docs/tasks/Sprint 3/Modulo I/HU-I-12.md` (esta task se construye sobre la pantalla `/caja` que esa entrega) · `docs/RULES.md` (Reglas N.° 1, 2, 4, 5, 6, 7, 8, 10, 11)
**RBAC:** `cajas:movimiento` (MESA_ENTRADA) — **ya existe en el seed** (`prisma/seed.ts:960`), sin permisos nuevos.
**Schema:** ya completo, sin migración. `MovimientoCaja` y `AnulacionMovimiento` ya migrados por el PR 0.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre lo siguiente.

**Reglas no negociables de `docs/RULES.md` citadas en HU-I-12.md, sección 0** — las mismas aplican acá; en particular la Regla N.° 8 (un movimiento no se edita: la corrección es un registro nuevo que anula el anterior) y la Regla N.° 7 (el egreso que no puede superar el efectivo esperado se valida dentro de la misma transacción bloqueada, nunca con una lectura previa separada).

### 0.1. Ya existe en `develop` (verificado, no hay que crearlo de nuevo)

`src/server/pagos/caja.service.ts` (PR 0, ver auditoría completa en `HU-I-12.md` §0.1) ya implementa:

- `registrarMovimiento(tx, { cajaId, usuarioId, tipo, monto, concepto })` — bloquea la caja (`bloquear`), exige `ABIERTA` (`409 CAJA_NO_ABIERTA`), valida monto > 0 y concepto de 1 a 200 caracteres, y en un **egreso** calcula el efectivo esperado dentro de la misma transacción bloqueada (vía `calcularResumen`) y rechaza con `409 EGRESO_SUPERA_EFECTIVO` si lo supera — **el mensaje no muestra el monto esperado**, para no romper el arqueo ciego (ya resuelto así en el servicio, esta task no decide nada ahí).
- `anularMovimiento(tx, { movimientoId, usuarioId, motivo })` — bloquea la caja del movimiento, exige que sea de esa caja (`404 MOVIMIENTO_NO_ENCONTRADO` si es de otro integrante, para no confirmar su existencia) y que no esté ya anulado (`409 MOVIMIENTO_YA_ANULADO`); si es un **ingreso**, valida que anularlo no deje el efectivo esperado negativo (`409 ANULACION_DEJA_EFECTIVO_NEGATIVO`, sin mostrar el esperado). La anulación es un registro nuevo (`AnulacionMovimiento`, único por movimiento, Regla N.° 8).
- Todos los `code` de error ya están en `errores-dominio.ts`/`textos.ts` (verificado en `HU-I-12.md` §0.1: `egresoSuperaEfectivo`, `anulacionDejaEfectivoNegativo`, `movimientoNoEncontrado`, `movimientoYaAnulado`).
- El permiso `cajas:movimiento` ya está en el seed.

### 0.2. Archivos nuevos a crear (ruta exacta)

- `src/server/pagos/caja.schema.ts` **se amplía** (no se crea de nuevo: lo crea HU-I-12.md) con `RegistrarMovimientoSchema` y `AnularMovimientoSchema`.
- `src/app/api/cajas/mia/movimientos/route.ts` — `POST` (registrar, §2.10.3).
- `src/app/api/cajas/mia/movimientos/[movimientoId]/anulacion/route.ts` — `POST` (anular, §2.10.4).
- `src/app/(dashboard)/caja/registrar-movimiento-dialog.tsx` — modal con tipo (Ingreso/Egreso), monto y concepto.
- `src/app/(dashboard)/caja/anular-movimiento-dialog.tsx` — modal con motivo, reutilizando `ConfirmarAccionDialog` (C-25) irreversible.
- Los `*.test.ts(x)` correspondientes.

### 0.3. Archivos existentes a modificar (ruta exacta + qué cambia)

- `src/server/pagos/caja.flujos.ts` (de HU-I-12.md) — **se amplía** (no figuraba en el relevamiento original de esta task, pero hace falta): agrega `registrarMiMovimiento` y `anularMiMovimiento`, que abren la transacción (`transaccion()`), resuelven la caja abierta propia (`cajaAbiertaDe`) y delegan en `caja.service.ts` (que no se toca). Las rutas de 0.2 no abren transacciones directamente — ese patrón vive en este archivo, igual que para abrir/declarar/cerrar en HU-I-12.md.
- `src/app/(dashboard)/caja/mi-caja.tsx` (de HU-I-12.md, **no `page.tsx`**: la tabla de ítems vive en este componente) — agrega el botón "Registrar movimiento" junto a "Cerrar caja", y en cada fila de tipo `MOVIMIENTO` del listado de ítems (ya existente) agrega la columna/acción "Anular" (sin encabezado) cuando no está anulado; se muestra solo con el permiso `cajas:movimiento`.
- `src/app/(dashboard)/caja/page.tsx` — agrega `tienePermiso("cajas:movimiento")` para pasarlo a `mi-caja.tsx`.
- `src/lib/textos.ts` — agrega las claves de `ui.caja.movimiento.*` (modal, confirmaciones) bajo el mismo grupo que ya creó HU-I-12.md.
- `docs/DESIGN.md` §6.4 — agrega la fila de "Registrar/anular movimiento manual" (ver 0.4.1).

### 0.4. Resuelto así

1. **Feedback de "Registrar movimiento" y "Anular movimiento":** toast para las dos acciones (igual que "Abrir caja", HU-I-12.md §6.4), seguido de `router.refresh()` para actualizar la lista sin recargar la página completa — a diferencia de "Cerrar caja" (HU-I-12.md, 0.4.3), acá no hace falta banner porque el usuario se queda en la misma pantalla de `/caja` y el ítem nuevo aparece directamente en la lista. Se agregan dos filas a `DESIGN.md` §6.4: "Registrar movimiento manual" y "Anular movimiento manual".
2. **Quién puede anular qué movimiento:** `/caja` solo trae la caja propia (`obtenerCajaPropia(usuarioId)`), así que la UI nunca puede ofrecer anular un movimiento ajeno. Se muestra "Anular" solo en ítems `MOVIMIENTO` con `anulado: false` y con el permiso `cajas:movimiento`. Que la caja esté abierta ya está garantizado porque la tabla de ítems solo existe cuando hay una caja abierta. Si alguien intenta un id ajeno por API, el servicio responde `404 MOVIMIENTO_NO_ENCONTRADO` (0.1).
3. **Leyenda duplicada:** `ConfirmarAccionDialog` con `irreversible` ya agrega "Esta acción no se puede deshacer." — por eso el texto de `confirmaciones.caja.anularMovimiento` (§4.3) **no** debe incluir esa frase; queda solo "¿Estás seguro de que querés anular este movimiento?" y el componente agrega la leyenda. Mismo criterio que HU-I-12.md.
4. **`CAJA_NO_ABIERTA` en el contexto de un movimiento:** el texto de servidor para ese código ("No se puede registrar un cobro hasta que abras una caja.") no aplica acá — puede pasar, por ejemplo, si el gerente cierra la caja por ausencia con el modal de movimiento todavía abierto. Se agrega un texto nuevo, **solo de UI** (no se toca el texto del servidor): `ui.caja.movimiento.cajaCerrada`: "Tu caja se cerró. Recargá la pantalla para ver su estado." El diálogo lo usa cuando el `code` de la respuesta es `CAJA_NO_ABIERTA`.
5. **Redacción del monto en la confirmación:** `confirmaciones.caja.registrarMovimiento` usa la plantilla "registrar {tipo} de {monto}" con `tipo` = "un ingreso" / "un egreso" (el artículo va en el valor de `tipo`, no en la plantilla). Ej.: "¿Estás seguro de que querés registrar un egreso de $ 1.000?".
6. **Evidencia de testing (nivel 2 y 3):** Claude Code corre la colección de Postman con `newman` contra `npm run dev` y la base local con el seed, y arma la evidencia SQL — igual que en HU-I-12.md. Las capturas de pantalla (nivel visual) no se generan por esta vía: se verifican a mano, en la conversación, igual que se hizo con HU-I-12.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

---

## 0.5. Resultado de la implementación (agregado post-implementación)

Confirmado contra el código ya escrito en `feature/HU-I-12-b` (working tree, sin commit):

- `src/server/pagos/caja.schema.ts`: `AnularMovimientoSchema` reutiliza directamente `motivoSchema` de `pago.schema.ts` (ya tiene `min(1)`/`max(300)` idéntico al de esta task) en vez de redeclarar la validación — más alineado con el reuso de `montoSchema` que ya pedía §4.1, mismo resultado.
- `src/app/(dashboard)/caja/enviar-movimiento.ts` (nuevo, no estaba en 0.2): helper de envío para los dos diálogos, análogo a `fetchOLanzar` pero que traduce `CAJA_NO_ABIERTA` al texto de UI `ui.caja.movimiento.cajaCerrada` (0.4.4) en vez del texto de servidor sobre cobros. Hacía falta porque el helper existente no expone el `code` del error.
- `src/server/pagos/caja.movimientos.pg.test.ts` (nuevo, no `caja.flujos.pg.test.ts` ampliado): los tests de integración con Postgres de `registrarMiMovimiento`/`anularMiMovimiento` se separaron en su propio archivo para no tocar los tests pg existentes de HU-I-12.
- Columna "Anular" en `mi-caja.tsx`: sin encabezado visible (como pide la foto), pero con un `<span class="sr-only">` para accesibilidad — no estaba explícitamente pedido, es un agregado razonable.
- Todo lo demás (rutas, dialogs, textos, `caja.flujos.ts`) coincide con 0.2/0.3/0.4 tal como quedaron redactados arriba.

---

## 1. Nota de alcance

Se construye sobre la pantalla `/caja` de **HU-I-12** (abrir/cerrar/arqueo ciego), que debe estar mergeada antes de empezar esta task — reutiliza su listado de ítems, su estructura de página y sus componentes de confirmación.

**Fuera de alcance de esta task (explícito):**
- **Los ajustes de caja del criterio 4** (dinero que se mueve al corregir/anular un pago de una caja cerrada): el servicio `registrarAjuste` ya existe (PR 0) pero no tiene ningún llamador hasta que exista **HU-I-06** (corregir/anular pagos), que hoy no tiene task doc ni código. Esta task no agrega ninguna UI para elegir una "caja de ajuste": eso lo decide quien implemente HU-I-06, reutilizando esta misma pantalla de `/caja` como destino, pero el flujo de elegirla es parte de esa historia, no de esta.
- Abrir o cerrar la caja, consultas del gerente, cierre por ausencia — HU-I-12.md.

**Verificación diferida:** los ajustes del criterio 4 (segunda mitad), cuando exista HU-I-06 — igual que lo deja explícito HU-I-12.md.

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** registrar un ingreso o un egreso de efectivo que no viene de un cobro, y poder anularlo si me equivoqué
**Para** que mi caja refleje todo el efectivo real que entra o sale durante mi turno

**SP estimado:** 3 (de los 8 originales de HU-I-12)

---

## 3. Alcance de esta task

Implementación **frontend + backend**, conforme a `spec_modulo_I.md` §2.10.3 y §2.10.4. Incluye:

- Los dos schemas Zod nuevos en `caja.schema.ts`.
- Los dos Route Handlers de 0.2.
- UI: "Registrar movimiento" (modal) y "Anular" por fila de movimiento en `/caja`.
- Textos nuevos bajo `ui.caja.movimiento.*` y la fila nueva en `DESIGN.md` §6.4.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo listado en la sección 1, más cualquier cambio a `caja.service.ts` (ya implementa todo lo que esta task necesita, sección 0.1).

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/pagos/caja.schema.ts` (ampliación)

```typescript
export const RegistrarMovimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  monto: montoSchema, // positivo, hasta 2 decimales — reutilizar la constante compartida de pago.schema.ts si ya está extraída (HU-I-10, §4.1), no reinventarla acá
  concepto: z.string().trim().min(1, "Ingresá el concepto").max(200, "El concepto no puede superar los 200 caracteres"),
}).strict();

export const AnularMovimientoSchema = z.object({
  motivo: z.string().trim().min(1, "Ingresá el motivo").max(300, "El motivo no puede superar los 300 caracteres"),
}).strict();
```

### 4.2. Route Handlers

| Ruta | Método | Permiso |
|---|---|---|
| `/api/cajas/mia/movimientos` | `POST` | `cajas:movimiento` |
| `/api/cajas/mia/movimientos/[movimientoId]/anulacion` | `POST` | `cajas:movimiento` |

Mismo helper `respuesta-error.ts` que el resto del módulo I (HU-I-10/HU-I-12.md).

### 4.3. Textos nuevos en `src/lib/textos.ts`

- `confirmaciones.caja.registrarMovimiento`: `"¿Estás seguro de que querés registrar {tipo} de {monto}?"`, con `tipo` = `"un ingreso"` / `"un egreso"` (el artículo va en el valor de `tipo`, no en la plantilla — ver 0.4.5).
- `confirmaciones.caja.anularMovimiento`: `"¿Estás seguro de que querés anular este movimiento?"` (sin la leyenda "Esta acción no se puede deshacer.": la agrega `ConfirmarAccionDialog` con `irreversible`, ver 0.4.3).
- `ui.caja.movimiento.tipo.ingreso` / `.egreso`, `ui.caja.movimiento.conceptoPlaceholder` (ej. "Ingreso de cambio para la caja").
- `ui.caja.movimiento.cajaCerrada`: `"Tu caja se cerró. Recargá la pantalla para ver su estado."` — texto de UI, no de servidor; usado cuando la respuesta de registrar/anular trae `code: CAJA_NO_ABIERTA` (ver 0.4.4).

---

## 5. Frontend

- **"Registrar movimiento"** (botón en `/caja`, junto a "Cerrar caja"): `Dialog` con selector Tipo (Ingreso/Egreso), campo Monto y campo Concepto (hasta 200 caracteres, con contador) → `ConfirmarAccionDialog` (C-25, no irreversible: se puede anular después) con el texto de `confirmaciones.caja.registrarMovimiento`. Éxito: toast (0.4.1) + el nuevo ítem aparece al tope de la lista sin recargar. Igual a la foto `Registrar_movimiento_manual.png`.
- **"Anular"** (acción por fila de tipo `MOVIMIENTO` no anulada): `Dialog` con el campo "Motivo" (hasta 300, obligatorio) → `ConfirmarAccionDialog` (C-25, **irreversible**, con la leyenda "Esta acción no se puede deshacer."). Éxito: toast + la fila pasa a mostrarse como anulada (texto tachado o `Badge` "Anulado", mismo criterio visual que un pago anulado en HU-I-06 cuando exista).
- Ambos reutilizan los tokens de `docs/DESIGN.md`, sin colores nuevos.

**Fuera de alcance de frontend:** cualquier UI de ajuste de caja (sección 1).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios

- `caja.schema.test.ts` (ampliación de HU-I-12.md): los dos schemas nuevos, válidos e inválidos (monto ≤ 0, concepto vacío o > 200, motivo vacío o > 300, campo extra).
- `caja.service.test.ts` **no se toca**: `registrarMovimiento`/`anularMovimiento` ya están cubiertos por el PR 0; si algún caso de esta task revela un gap, se reporta.
- Componentes: el modal de "Registrar movimiento" no deja confirmar con concepto vacío; el de "Anular" no deja confirmar sin motivo; tras anular, la fila se ve con el estado "Anulado" y sin la acción "Anular" disponible de nuevo.

### Nivel 2 — Postman

_Ejecutado por Claude Code con `newman` contra `npm run dev` y la base local con el seed (0.4.6); las capturas de pantalla se verifican a mano, por fuera de esta vía._

- `POST .../movimientos` con `tipo: INGRESO`, monto válido → `201`.
- `POST .../movimientos` con `tipo: EGRESO` que supera el efectivo esperado → `409 EGRESO_SUPERA_EFECTIVO`, sin `detalles` con el monto esperado (verificar que el cuerpo de la respuesta no lo expone en ningún campo).
- `POST .../movimientos/[id]/anulacion` dos veces sobre el mismo movimiento → la segunda `409 MOVIMIENTO_YA_ANULADO`.
- Anular un ingreso que dejaría el efectivo esperado negativo → `409 ANULACION_DEJA_EFECTIVO_NEGATIVO`, sin mostrar el esperado.
- Anular un movimiento de la caja de otro integrante → `404 MOVIMIENTO_NO_ENCONTRADO` (no `403`, para no confirmar su existencia — ya resuelto así en el servicio).
- Gerente contra cualquiera de las dos rutas → `403 SIN_PERMISO`.

### Nivel 3 — BD / TablePlus

- Tras registrar: una fila en `movimientos_caja` con `tipo`, `monto`, `concepto`, `creadoPorUsuarioId` y `createdAtMovimientoCaja`.
- Tras anular: una fila en `anulaciones_movimiento` referenciando el movimiento (único por movimiento), con `actorTipo`, `motivo`, usuario y fecha; el movimiento original no se modifica (Regla N.° 8).

**Evidencia esperada:** Postman + SQL; capturas del modal de registrar, del listado con un movimiento anulado, y del caso de error `EGRESO_SUPERA_EFECTIVO` mostrado inline sin revelar el esperado.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar, incluido el feedback de éxito (0.4.1).
- [ ] Los dos schemas Zod implementados.
- [ ] Los dos Route Handlers responden `{ data, error }` con los status codes de §2.10.5, reutilizando `respuesta-error.ts`.
- [ ] Ningún cambio a `caja.service.ts` (ya implementa todo lo necesario).
- [ ] Frontend: "Registrar movimiento" y "Anular" funcionales sobre `/caja` (HU-I-12.md).
- [ ] Ningún mensaje de error de egreso/anulación revela el efectivo esperado (arqueo ciego).
- [ ] Textos nuevos agregados a `textos.ts` bajo `ui.caja.movimiento.*`, ninguno hardcodeado.
- [ ] Fila nueva en `DESIGN.md` §6.4 (0.4.1).
- [ ] Ningún `DELETE`/`UPDATE` directo sobre `MovimientoCaja` (Regla N.° 8): la anulación es siempre un registro nuevo.
- [ ] Tests de los 3 niveles en verde, con evidencia.
- [ ] PR con diff acotado exclusivamente a esta task (sin tocar nada de HU-I-12.md salvo los dos puntos de 0.3).
