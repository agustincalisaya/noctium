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

- `src/app/(dashboard)/caja/page.tsx` (de HU-I-12.md) — agrega el botón "Registrar movimiento" junto a "Cerrar caja", y en cada fila de tipo `MOVIMIENTO` del listado de ítems (ya existente) agrega la acción "Anular" cuando no está anulado y la caja sigue abierta.
- `src/lib/textos.ts` — agrega las claves de `ui.caja.movimiento.*` (modal, confirmaciones) bajo el mismo grupo que ya creó HU-I-12.md.
- `docs/DESIGN.md` §6.4 — agrega la fila de "Registrar/anular movimiento manual" (ver 0.4.1).

### 0.4. Relevar antes de asumir

1. **Feedback de "Registrar movimiento" y "Anular movimiento" en `DESIGN.md` §6.4.** Por el patrón ya fijado en HU-I-12.md (modal sobre una pantalla que no recarga del todo — `/caja` sigue mostrando el arqueo ciego debajo) y por la foto `Registrar_movimiento_manual.png` (un `Dialog` simple, sin segundo paso), esta task propone **toast** para ambas acciones (igual que "Nueva forma de pago" o "Asignar prioridad", 6.1) — a diferencia de "Cerrar caja" (HU-I-12.md, 0.4.3), acá no hace falta banner porque el usuario se queda en la misma pantalla de `/caja` y el ítem nuevo aparece directamente en la lista. Confirmar antes de implementar.
2. **Quién puede anular qué movimiento.** El criterio 3 dice "se anula con un motivo mientras la caja está abierta", sin aclarar si cualquier integrante de mesa de entrada puede anular un movimiento de **otra** caja (no la propia). `anularMovimiento` en el servicio ya rechaza eso con `404 MOVIMIENTO_NO_ENCONTRADO` si el movimiento no pertenece a la caja de quien lo pide (0.1) — esta task solo necesita confirmar que la UI nunca ofrece anular un movimiento que no sea de la caja propia abierta (no debería poder pasar, porque `/caja` solo muestra la caja propia, pero vale confirmarlo explícitamente antes de implementar la acción "Anular" en la fila).

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento.

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

- `confirmaciones.caja.registrarMovimiento`: `"¿Estás seguro de que querés registrar {tipo} de {monto}?"` (Ingreso/Egreso en minúscula según corresponda).
- `confirmaciones.caja.anularMovimiento`: `"¿Estás seguro de que querés anular este movimiento? Esta acción no se puede deshacer."`.
- `ui.caja.movimiento.tipo.ingreso` / `.egreso`, `ui.caja.movimiento.conceptoPlaceholder` (ej. "Ingreso de cambio para la caja").

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
