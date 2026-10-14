# Informe de validación PO — HU-I-06 · Corregir o anular un pago registrado

- **Fecha:** 14/10/2026
- **Rama revisada:** `develop` @ `030e0e7` (árbol limpio). La HU entró con `feature/HU-I-06` (commits `0b5159e` → `813b0dd`, merge `b4c682a`) y `feat/doc-I-06` (`4d1d275`).
- **Fuente de verdad:** el texto de la HU que entregó el PO (no la task).
- **Documentos leídos:** `prisma/schema.prisma`, `docs/RULES.md` (incluida «Aplicación HU-I-06»), `docs/DESIGN.md` (§6 y las filas de HU-I-06 en §6.4), `prisma/seed.ts` y los fixtures `hu-h-06.ts` y `hu-i-07.ts`, `docs/specs/spec_modulo_I.md` §2.14, `docs/tasks/Sprint 3/Modulo I/HU-I-06.md` y `docs/testing/Modulo I/hu-i-06/HU-I-06-evidencia.md`.
- **Reemplaza** al informe del 13/10/2026, que se hizo antes de que la HU estuviera implementada. El anterior queda en el historial de git (`48b653b`).

> **Resumen:** la HU está implementada de punta a punta: 3 endpoints, el componente `PagoAcciones` compartido por las dos pantallas, el modal «Detalle del pago» y el selector de caja de ajuste. Toda la regla de negocio está en `correccion.service.ts` (PR 0). Los 7 criterios están **CUBIERTOS**. No encontré bloqueantes. Hay observaciones menores de textos sin centralizar y una decisión de UX para que confirme el PO (dos comprobantes de reemplazo cuando se corrigen el monto y la forma a la vez).

---

## 1. Tabla de trazabilidad

Leyenda: **CUBIERTO** · **PARCIAL** · **NO ENCONTRADO** · **DESVÍO** (la task o la spec interpretan el criterio distinto que la HU).

| # | Criterio / viñeta | Dónde está (archivo · función · endpoint · componente) | Estado | Justificación |
|---|---|---|---|---|
| 1 | «Corregir» y «Anular» en cada pago de «Pagos registrados» (detalle de la clase) | `src/app/(dashboard)/turnos/[id]/turno-pago-card.tsx` → `<PagoAcciones>` (`src/components/pagos/pago-acciones.tsx`); datos: `turno.detalle.ts` → `pagosDelDetalle` → `listarPagosDeClase(turnoId, usuario)` (`pago.publico.ts`) con `puede_corregir` | **CUBIERTO** | Los botones aparecen si `puede_corregir && !anulado`. El servidor calcula `puede_corregir` con `puedeCorregirPago`. El Profesor no recibe pagos. |
| 1 | Las mismas acciones en el historial de pagos del alumno (HU-I-02) | `src/app/(dashboard)/alumnos/[id]/tabla-historial-pagos.tsx`: columna «Acciones» con `<PagoAcciones>`; `puede_corregir` sale de `pago.service.ts:338` | **CUBIERTO** | Solo en el modo «Historial»: el modo «Estado de pago» no lista pagos. |
| 2 | Formulario precargado con Monto, Forma de pago (solo activas) y Fecha, con las validaciones de HU-I-01/HU-I-10 | `PagoAcciones.abrirCorregir` precarga los valores vigentes. Cliente: `montoNormalizado` (misma regex que `montoSchema`) y fecha `max = hoy`. Servidor: `CorregirPagoSchema` (`correccion.schema.ts`, reutiliza `montoSchema`, `formaPagoIdSchema` y `fechaCalendarioValidaSchema`) y `corregirOperacion` (`FORMA_PAGO_NO_DISPONIBLE`, `FECHA_PAGO_FUTURA`). Las formas salen de `GET /api/formas-pago/opciones` | **CUBIERTO** | Usa las mismas validaciones que el registro de HU-I-10 (`operacion.service.ts:162-169`). |
| 2 | Pago cargado a otro alumno: se anula y mesa de entrada lo vuelve a registrar con HU-I-10; el gerente anula pero no registra | Anular (`POST /api/pagos/[id]/anulacion`) + registro de HU-I-10. `pagos:crear` solo lo tiene MESA_ENTRADA (`prisma/seed.ts:916`) | **CUBIERTO** | No hay botón «Reasignar»: el caso se resuelve combinando las dos acciones, como pide la HU. |
| 2·a | Cada pago de una operación se corrige o anula por separado | `corregirPago` y `anularPago` reciben un `pagoId` | **CUBIERTO** | Test PG: «anularPago: uno de varios emite reemplazo y sigue PAGADA la otra». |
| 2·a | El total de la operación se calcula con los montos vigentes y no se guarda | `pago.vigente.ts` (`operacionVigente`, `sqlMontoVigente`) | **CUBIERTO** | `OperacionPago` no tiene columna de total. Un test compara el cálculo en SQL contra el de TypeScript. |
| 2·a | Fecha y forma son de la operación: cambiarlas registra una corrección de la operación (registro nuevo que la referencia), se aplica a todos sus pagos y se informa cuántas clases abarca | `corregirOperacion` crea una `CorreccionOperacion` por campo y devuelve `clasesAbarcadas`. UI: aviso «Este cambio alcanza a N clases de esta operación.» dentro del formulario y de la confirmación (`ui.pagos.correccion.alcanzaClases` / `alcanzaUnaClase`). La respuesta 200 trae `clases_abarcadas` | **CUBIERTO** | El aviso se calcula en el cliente con `clases_de_la_operacion` (pagos no anulados) antes de confirmar. |
| 2·a | Cada corrección o anulación bloquea la operación y la inscripción del pago en la misma transacción (Regla N.° 7) | `correccion.flujos.ts` abre una sola `transaccion()`. `contextoDelPago` llama a `bloquear(tx, { clases, inscripciones, operaciones, cajas })` (`SELECT … FOR UPDATE` en orden canónico) y relee todo ya bloqueado antes de validar | **CUBIERTO** · DESVÍO menor (más estricto) | Además de la operación y la inscripción, bloquea la clase y las cajas (spec §2.14.2). Monto y forma/fecha juntos van en la misma transacción. Hay un test de dos anulaciones simultáneas: gana una y la otra recibe `PAGO_YA_ANULADO`. |
| 2·b | Forma de pago inactiva: se muestra con la etiqueta «Inactiva» y se conserva mientras no se cambie; al cambiarla solo se ofrecen las activas | `PagoAcciones`: si la forma vigente no está entre las activas, agrega la opción `«{nombre} (Inactiva)»` (`ui.pagos.correccion.formaInactiva`). Si no se cambia, no se envía `forma_pago_id`. Servidor: enviar la misma forma no cuenta como cambio y una forma nueva exige `verificarFormaPagoActiva` | **CUBIERTO** | La etiqueta solo aparece en el selector del formulario de corrección. En la lista y en el historial la forma se ve sin etiqueta. La HU la pide en el formulario, así que alcanza. |
| 3 | Motivo obligatorio (hasta 300 caracteres) | Cliente: `textarea maxLength=300`, contador «n / 300»; «Anular pago» queda deshabilitado con el motivo vacío; Corregir valida `motivoRequerido`. Servidor: `motivoSchema` (trim, 1 a 300) en los dos schemas, más `validarMotivo` en el servicio | **CUBIERTO** | — |
| 3 | Queda registrado el valor anterior, el nuevo, el usuario y la fecha | `CorreccionPago` (monto anterior y nuevo), `CorreccionOperacion` (forma o fecha anterior y nueva), `AnulacionPago`, todas con `creadoPorUsuarioId` y `createdAt*` | **CUBIERTO** | — |
| 3 | El detalle del pago muestra ese historial de cambios | `GET /api/pagos/[id]/historial` → `obtenerHistorialDePago` (`correccion.lecturas.ts`); UI: enlace «Ver detalle» → `HistorialCambiosDialog` («Detalle del pago»: el registro arriba y «Historial de cambios» abajo, del más nuevo al más viejo) | **CUBIERTO** | Cada evento muestra su propio valor anterior → nuevo, con motivo, usuario y fecha. Las correcciones de forma y fecha aparecen en todos los pagos de la operación. |
| 3 | La corrección y la anulación no modifican el original: se guardan como registro nuevo que lo referencia (Regla N.° 8); pantallas, totales e indicadores usan el valor vigente | `correccion.service.ts` solo hace `create`; no hay `update` ni `delete` sobre `Pago`. Las lecturas usan `pago.vigente.ts` (detalle, historial, caja, `sumarPagosPorMes` de los indicadores) | **CUBIERTO** | La evidencia de nivel 3 (N1) confirma que la fila de `pagos` queda intacta. |
| 4 | Un pago anulado no se borra y se ve con la etiqueta «Anulado» | Detalle de la clase: `listarPagosDeClase` incluye los anulados; `turno-pago-card.tsx` muestra el monto tachado con el `Badge` «Anulado». Historial del alumno: monto tachado con «Anulado» | **CUBIERTO** | Se corrigió el DESVÍO del informe anterior: la lectura vieja `listarPagosDeTurno`, que ocultaba los anulados, se eliminó. |
| 4 | Deja de sumar en los totales | «Total registrado» de la tarjeta (filtra `!anulado`), `total_pagado` del historial, `sumarPagosPorMes`, arqueo de caja; el aviso de pagos al cancelar la clase cuenta solo los no anulados (`turno-detalle.tsx:58`) | **CUBIERTO** | — |
| 4 | El efecto en la inscripción lo define HU-C-24 c5 | `anularPago` → `recalcularEstadoPago` (fachada de C) con el conteo de pagos no anulados | **CUBIERTO** | Hay test PG del caso en que la reserva se reabre. El caso «Pago sin registrar» (clase iniciada) y el de inscripción no vigente están en la fachada de C y conviene probarlos a mano (ver §6). |
| 5 | El gerente corrige o anula cualquier pago | `puedeCorregirPago` devuelve `true` para GERENTE (si el pago no está anulado) | **CUBIERTO** | — |
| 5 | Mesa de entrada: solo los registrados en los últimos 30 días (desde el registro, no desde la fecha de pago) y con la caja del pago abierta | `correccion.alcance.ts` con `registradoEn = operacion.registradaEl` y `cajaAbierta`, revalidado con todo bloqueado | **CUBIERTO** | Tests: el límite de 30 días contra 30,01 días y la caja cerrada. Cualquier mesa de entrada puede corregir, no solo quien registró el pago. La HU no pide más que eso. |
| 5 | Caja cerrada: el cambio lo hace el gerente y el dinero se registra como ajuste en una caja abierta (HU-I-12 c4) | El servicio llama a `registrarAjuste` con `caja_ajuste_id`. Sin él responde `409 CAJA_DE_AJUSTE_NO_ABIERTA` y la confirmación muestra `SelectorCajaAjuste` (cajas abiertas de `GET /api/cajas`) con «Reintentar con esta caja» | **CUBIERTO** | Cambiar solo la fecha no mueve dinero, así que no pide caja de ajuste. |
| 5 | El servidor rechaza con 403 los intentos fuera de alcance | Rol sin permiso: `withPermission("pagos:corregir")` → `403 SIN_PERMISO`. Mesa de entrada fuera de alcance: `errores.pago.fueraDeAlcance` → `403 FUERA_DE_ALCANCE` | **CUBIERTO** | Lo prueban los tests de las rutas y la colección de Postman (A16, A19, C01-C03). |
| 6 | Reintegro: se anula el pago de esa clase con el motivo «Reintegro»; el resto de la operación no cambia y el comprobante se reemplaza (HU-I-11 c5) | En la confirmación de Anular, el enlace «Usar el motivo «Reintegro»» precarga `Reintegro` (editable). `anularPago` llama a `emitirReemplazo` si quedan pagos vigentes; si no, el comprobante queda «ANULADO» (marca derivada) | **CUBIERTO** | El servidor no trata el motivo de forma especial (P-I8). Cancelar desde HU-C-14 no anula automáticamente: lo hace mesa de entrada, como dice la HU. |
| 7 | Se informa «Pago corregido correctamente» o «Pago anulado» | `toast.success(texto("ui.pagos.correccion.exitoCorregir" / "exitoAnular"))` | **CUBIERTO** | Textos idénticos a la HU. |

**Desvíos y puntos para que decida el PO (ninguno bloquea):**
- **DESVÍO menor (c2, bloqueos):** se bloquean también la clase y las cajas. Es más estricto que la HU y lo justifica la spec (`recalcularEstadoPago` depende de la clase y el ajuste, de la caja). No afecta la aceptación.
- **Decisión de UX (c2):** si en una misma corrección cambian el monto **y** la forma o la fecha, se emiten **dos comprobantes de reemplazo encadenados** (spec §2.14.2, paso 5) y la respuesta devuelve el último. La HU no lo prohíbe, pero el alumno ve que el número salta dos veces. **Conviene que el PO lo confirme.**
- **Observación (c2·b):** la etiqueta se muestra como «Cheque (Inactiva)» dentro del `<select>`, con una clave propia (`ui.pagos.correccion.formaInactiva`) en lugar de reutilizar `ui.formasPago.inactiva`. El texto «Inactiva» coincide.

---

## 2. Textos literales (archivo central `src/lib/textos.ts`, HU-C-23)

| Texto del criterio | Clave en `textos.ts` | Resultado |
|---|---|---|
| «Pagos registrados» | — (escrito directamente en `turno-pago-card.tsx:33` y en el `aria-label` de la línea 37; ya estaba así antes de esta HU) | Coincide palabra por palabra, pero **no está centralizado** |
| «Corregir» | `ui.pagos.correccion.corregir` = «Corregir» | **COINCIDE** |
| «Anular» | `ui.pagos.correccion.anular` = «Anular» | **COINCIDE** |
| «Inactiva» | `ui.pagos.correccion.formaInactiva` = «{nombre} (Inactiva)» | **COINCIDE** (dentro de la opción del selector) |
| «Anulado» | `ui.pagos.correccion.anulado` = «Anulado» (detalle de la clase) · `ui.pagos.historial.anulado` = «Anulado» (historial) | **COINCIDE** |
| «Reservada» / «Pago sin registrar» (HU-C-24) | `ui.pagos.historial.reservada`, `ui.pagos.historial.sinRegistrar`, `ui.turnos.reserva.sinRegistrar` | **COINCIDE** (textos de HU-C-24 / HU-I-02) |
| «Reintegro» | `ui.pagos.correccion.motivoReintegro` = «Reintegro» | **COINCIDE** |
| «Pago corregido correctamente» | `ui.pagos.correccion.exitoCorregir` | **COINCIDE** |
| «Pago anulado» | `ui.pagos.correccion.exitoAnular` | **COINCIDE** |

**Textos que no coinciden palabra por palabra:** ninguno. La única observación es que «Pagos registrados» no está centralizado (deuda anterior a esta HU).

`npx tsx scripts/verificar-claves-textos.ts` → «Claves de textos verificadas.» (todas las claves referenciadas existen).

---

## 3. Reglas de servidor

### 3.1 Endpoints

| Método y ruta | Permiso (`withPermission`) | Roles con acceso | Zod antes del servicio | Transacción y bloqueo | Registro nuevo (Regla N.° 8) |
|---|---|---|---|---|---|
| `POST /api/pagos/{id}/correccion` | `pagos:corregir` | MESA_ENTRADA, GERENTE | `CorregirPagoSchema` (`.strict()`, pide al menos uno de monto, forma o fecha; motivo de 1 a 300; `caja_ajuste_id` CUID) → `400 VALIDACION` | `corregirPagoFlujo`: una `transaccion()` → `corregirPago` y luego `corregirOperacion`, cada uno con `bloquear` (clase → inscripción → operación → cajas) y relectura | `CorreccionPago` / `CorreccionOperacion`, comprobante de reemplazo y `AjusteCaja` si la caja está cerrada |
| `POST /api/pagos/{id}/anulacion` | `pagos:corregir` | MESA_ENTRADA, GERENTE | `AnularPagoSchema` (`.strict()`, motivo de 1 a 300, `caja_ajuste_id?`) | `anularPagoFlujo`: una `transaccion()` → `anularPago` con el mismo bloqueo; el índice único `anulaciones_pago.pagoId` responde `P2002` → `PAGO_YA_ANULADO` | `AnulacionPago`, `recalcularEstadoPago` (fachada de C), reemplazo o marca «ANULADO» del comprobante y `AjusteCaja` si la caja está cerrada |
| `GET /api/pagos/{id}/historial` | `pagos:leer` | MESA_ENTRADA, GERENTE | — (solo el id de la ruta) | Solo lectura, sin bloqueo; `Cache-Control: no-store` | — |

**Respuestas por código** (`errores-dominio.ts`, `respuestaDeError`): `PAGO_NO_ENCONTRADO` 404 · `FUERA_DE_ALCANCE` 403 · `SIN_PERMISO` 403 · `PAGO_ANULADO` / `PAGO_YA_ANULADO` / `FORMA_PAGO_NO_DISPONIBLE` / `CAJA_DE_AJUSTE_NO_ABIERTA` 409 · `SIN_CAMBIOS` / `FECHA_PAGO_FUTURA` / `VALIDACION` 400. Todas con el formato `{ data, error }` (Regla N.° 5).

**Orden de las validaciones en el servicio** (importa para las pruebas): pago anulado (409) → alcance (403) → sin cambios (400). Por eso una corrección «con los mismos valores» sirve para probar el alcance **sin escribir nada**: si el usuario está fuera de alcance devuelve 403; si está dentro, 400 `SIN_CAMBIOS`.

**Regla N.° 7:** el proyecto resuelve la concurrencia con el `bloquear` del PR 0 (`SELECT … FOR UPDATE` en orden canónico) más la relectura y la revalidación ya bloqueado, y el índice único de anulación como respaldo. La regla escrita pide `updateMany` condicionado, pero no hay ninguna fila que actualizar: todo son `create`. El patrón es el mismo que el de HU-I-10 y HU-I-12 y la HU pide explícitamente «bloquea la operación y la inscripción». Lo doy por cumplido.

**Regla N.° 2:** opción (a), con usuario y fecha en cada registro nuevo. El historial de estados de la inscripción lo escribe C después del commit (opción b).

### 3.2 Snippets para comprobar el 403 desde la consola del navegador

Iniciá sesión con el rol que querés probar en `http://localhost:3000`, abrí DevTools → Console y pegá el snippet. La cookie de sesión viaja sola porque es la misma URL. Para conseguir un `idPago`, usá la consulta Q1 de §6.2 o mirá en DevTools → Network el pedido `…/historial` que se dispara al tocar «Ver detalle».

**A. Rol sin permiso (Profesor o Alumno): las tres rutas tienen que dar `403 SIN_PERMISO`.** Es seguro: `withPermission` rechaza antes de llegar al servicio.

```js
// Sesión: profesor1@noctium.local o alumno01@noctium.local (Password123!)
const PAGO = "PEGAR_ID_PAGO";
const post = (ruta, cuerpo) => fetch(`/api/pagos/${PAGO}/${ruta}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
});
for (const [nombre, pedido] of [
  ["correccion", () => post("correccion", { monto: "1000", motivo: "Prueba 403" })],
  ["anulacion",  () => post("anulacion",  { motivo: "Prueba 403" })],
  ["historial",  () => fetch(`/api/pagos/${PAGO}/historial`)],
]) {
  const r = await pedido();
  console.log(nombre, r.status, (await r.json()).error); // esperado: 403 { code: "SIN_PERMISO", ... }
}
```

**B. Mesa de entrada fuera de alcance (pago de hace más de 30 días o caja cerrada): tiene que dar `403 FUERA_DE_ALCANCE`.** No escribe nada: reenvía el mismo monto vigente. Si el alcance fallara, la respuesta sería `400 SIN_CAMBIOS`, que también deja todo como estaba.

```js
// Sesión: mesa.entrada@noctium.local o mesa.entrada2@noctium.local (Password123!)
const PAGO = "PEGAR_ID_PAGO_FUERA_DE_ALCANCE"; // Q1: registrada_el de más de 30 días, o caja = CERRADA
const h = await (await fetch(`/api/pagos/${PAGO}/historial`)).json();
const r = await fetch(`/api/pagos/${PAGO}/correccion`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ monto: h.data.registro.monto, motivo: "Prueba de alcance (no cambia nada)" }),
});
console.log(r.status, (await r.json()).error); // esperado: 403 { code: "FUERA_DE_ALCANCE", message: "No podés modificar este pago." }
```

> ⚠️ No uses `/anulacion` para probar el alcance con Mesa de entrada o con el Gerente: si el servidor lo deja pasar, **anula el pago de verdad**. Para eso usá la corrección «sin cambios» del snippet B.

**C. Control positivo con el Gerente** (mismo pago del snippet B): tiene que dar `400 SIN_CAMBIOS`, lo que confirma que el gerente sí está dentro del alcance. Pegá el snippet B con la sesión de `gerente@noctium.local`.

---

## 4. Definición de Terminado

| Ítem | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Cumple, con observaciones menores** | Todo lo nuevo de la HU usa `texto()`. Quedan fuera: (1) `pago-acciones.tsx:36` define `MENSAJE_ERROR_GENERICO = "No se pudo completar la acción. Intentá nuevamente."` (aparece si el servidor no manda mensaje; es el mismo patrón que el PO ya pidió centralizar en HU-I-10 y que también está en `confirmar-accion-dialog.tsx` y `cerrar-caja-dialog.tsx`); (2) los mensajes de Zod del servidor «Datos inválidos» (en las dos rutas `POST`) e «Indicá qué querés corregir» (`correccion.schema.ts`). La UI valida antes de enviar, así que casi nunca se ven; (3) en `turno-pago-card.tsx`, los textos anteriores a la HU «Pago», «Pagos registrados», «Ninguno todavía.» y «Total registrado». |
| Ningún texto visible con «turno» | **Cumple** | Ninguna clave nueva de `ui.pagos.correccion.*` ni `confirmaciones.pagos.*` dice «turno». La palabra solo aparece en rutas (`/turnos/…`) y en identificadores de código. |
| Confirmación con el componente común de HU-C-25 en toda operación que guarda | **Cumple** | Corregir pasa del `Dialog` de edición a un `ConfirmarAccionDialog` reversible con anterior → nuevo. Anular usa un `ConfirmarAccionDialog` irreversible con el motivo adentro. «Reintentar con esta caja» reenvía un pedido que ya se confirmó en ese mismo diálogo. |
| Tests en verde | **Cumple para la HU** / la suite completa tiene 3 fallos **ajenos** | Tests de la HU: `npx vitest run` (correccion.*, rutas `/api/pagos/[id]`, `components/pagos`, turno-detalle, historial-pagos, pago.publico, aislamiento, turno.detalle) → **18 archivos, 269 pruebas, todas en verde**. `npm run test:pg` con los 3 `correccion.*.pg.test.ts` → **18 pruebas en verde** contra PostgreSQL real. Suite completa (`npx vitest run`): 4382 en verde y **3 en rojo, ninguno de esta HU**: `src/server/shared/actividad-usuario.test.ts` (2; el mock no contempla `historialParametro`, que agregó HU-N-01 en `068239d`) y `src/lib/claves-textos.test.ts` (1, timeout de 60 s; ya conocido. El mismo chequeo por CLI pasa). |

---

## 5. Extras y violaciones

### 5.1 Implementado sin que la HU lo pida (todo aceptable)
- **Enlace «Ver detalle» en todo pago**, incluidos los anulados y los que están fuera de alcance, para cualquier rol con `pagos:leer`. Es la forma de mostrar el «detalle del pago» del c3.
- **Selector reactivo de caja de ajuste:** solo aparece después de un `409 CAJA_DE_AJUSTE_NO_ABIERTA`. Hace falta para que el gerente pueda cumplir el c5.
- **Se eliminó `listarPagosDeTurno` / `PagoDeTurno`** y se reemplazó por `listarPagosDeClase(turnoId, usuario?)`. También se actualizaron `spec_modulo_I.md` y `spec_modulo_C.md`.
- **`puedeCorregirPago` se movió a `correccion.alcance.ts`** (con reexport) para respetar la Regla N.° 3. El test de aislamiento quedó actualizado.
- **Ajuste a HU-C-05:** el aviso de «tiene pagos» al cancelar la clase ya no cuenta los anulados (`turno-detalle.tsx:58`).
- **«Volver» desde la confirmación de Corregir** regresa al formulario con lo que ya estaba cargado.
- `aria-label` descriptivos en los botones («Corregir el pago de {alumno} ({clase})»).

### 5.2 Violaciones a RULES.md / DESIGN.md
- **Ninguna grave.** Regla N.° 1: no hay ningún `DELETE`. Regla N.° 3: `correccion.service` usa la fachada `inscripcion.publico` y `pago.publico` solo importa `correccion.alcance` (lo vigila el test de aislamiento). Regla N.° 4: las rutas son delgadas y los flujos no tienen reglas propias. Reglas N.° 5 y 6: se cumplen. Regla N.° 8: se cumple. Regla N.° 10: no hay permisos nuevos y los existentes son los correctos. Regla N.° 11: los archivos están en `src/server/pagos` y los tipos en `pago.types.ts`.
- **DESIGN.md:** colores con tokens (`destructive`, `destructive-soft`, `muted`, `primary`) y nunca hex. Los toasts coinciden con §6.1 y las filas de §6.4 coinciden con la implementación. **Menor (anterior a la HU):** `turno-pago-card.tsx` usa tamaños arbitrarios (`text-[10px]`, `text-[13px]`, `text-[11px]`) y textos escritos directamente en el componente (ver §4).

---

## 6. Datos para la prueba manual

### 6.1 Usuarios (contraseña de todos: `Password123!`)

| Usuario | Rol | Para qué |
|---|---|---|
| `mesa.entrada@noctium.local` | MESA_ENTRADA | Corregir y anular dentro del alcance. Su caja (abierta por el seed) tiene los pagos del seed y del fixture HU-H-06. |
| `mesa.entrada2@noctium.local` | MESA_ENTRADA | Registrar un pago en **su** caja y después cerrarla, para el caso de caja cerrada. |
| `gerente@noctium.local` | GERENTE | Corregir o anular cualquier pago, con caja de ajuste. Activar y desactivar «Cheque». |
| `profesor1@noctium.local` | PROFESOR | 403 `SIN_PERMISO` (snippet A). No ve la tarjeta «Pago». |
| `alumno01@noctium.local` (Fernández, Sofía) · `alumno02@noctium.local` (Martínez, Lucas) | ALUMNO | 403 `SIN_PERMISO` (snippet A). Cancelar su clase (HU-C-14) para el caso de reintegro. |

> **Estado de la base:** la evidencia del dev indica que su corrida de Postman dejó en `noctium_dev` **la caja de `mesa.entrada2@` CERRADA**, un ajuste de −$ 1.000 y correcciones de prueba. Si tu base es la misma, abrí antes una caja nueva para mesa2 (desde «Mi caja» o con `npm run caja:abrir -- mesa.entrada2@noctium.local`). Si preferís empezar de cero, `npx prisma migrate reset` regenera todo con el seed, **pero borra todos los datos de la base local**.

### 6.2 Consultas de apoyo (TablePlus / psql, solo lectura)

**Q1. Pagos con su alcance** (incluye el id, la antigüedad del registro, el estado de la caja y cuántos pagos tiene la operación):
```sql
SELECT p."idPago", a."apellidoAlumno" || ', ' || a."nombreAlumno" AS alumno, m."nombreMateria" AS materia,
       t."idTurno", t."fechaTurno", p."montoPago", f."nombreFormaPago" AS forma_original,
       o."registradaEl", (now() - o."registradaEl") > interval '30 days' AS mas_de_30_dias,
       c.estado AS caja, u."emailUsuario" AS caja_de,
       (SELECT count(*) FROM pagos p2 WHERE p2."operacionId" = o."idOperacionPago") AS pagos_operacion,
       (an."pagoId" IS NOT NULL) AS anulado
FROM pagos p
JOIN operaciones_pago o ON o."idOperacionPago" = p."operacionId"
JOIN cajas c ON c."idCaja" = o."cajaId"
JOIN usuarios u ON u."idUsuario" = c."usuarioId"
JOIN alumnos a ON a."idAlumno" = p."alumnoId"
JOIN turnos t ON t."idTurno" = p."turnoId"
JOIN materias m ON m."idMateria" = t."materiaId"
JOIN formas_pago f ON f."idFormaPago" = p."formaPagoId"
LEFT JOIN anulaciones_pago an ON an."pagoId" = p."idPago"
ORDER BY o."registradaEl" DESC;
```
(`forma_original` es la del registro original. La vigente puede ser otra si hubo una corrección de operación.)

**Q2. Después de cada acción, para verificar la Regla N.° 8 y HU-C-24 c5:**
```sql
SELECT * FROM correcciones_pago ORDER BY "createdAtCorreccionPago" DESC LIMIT 5;
SELECT * FROM correcciones_operacion ORDER BY "createdAtCorreccionOperacion" DESC LIMIT 5;
SELECT * FROM anulaciones_pago ORDER BY "createdAtAnulacionPago" DESC LIMIT 5;
SELECT * FROM ajustes_caja ORDER BY "createdAtAjusteCaja" DESC LIMIT 5;
SELECT "idInscripcion", "estadoPago", "venceEl", vigencia FROM turno_alumno WHERE "idInscripcion" = '<inscripcionId del pago>';
```
(También está `docs/testing/Modulo I/hu-i-06/HU-I-06.sql`, el script del dev.)

### 6.3 Escenarios por criterio

| Criterio | Datos del seed | Cómo probarlo |
|---|---|---|
| c1 (detalle de la clase) | **seed-turno-26** (Matemática, día operativo anterior, Giménez, Aula 2): alumnos 0-7 pagados por Transferencia, registrados por `mesa.entrada@` en su caja abierta. También seed-turno-27 (Programación I, dos días operativos antes). | `mesa.entrada@` → Clases → la clase de Matemática de ayer → tarjeta «Pago» → cada pago tiene «Corregir», «Anular» y «Ver detalle». |
| c1 (historial del alumno) | Fernández, Sofía (alumno 0) | Alumnos → Fernández, Sofía → pestaña Pagos → columna «Acciones». |
| c2 (monto) | Un pago de seed-turno-26 | Corregir → cambiar el monto → motivo → «Guardar corrección» → confirmación con «Monto: $ X → $ Y» → toast. Probar también monto 0, negativo, con 3 decimales y sin cambios (error dentro del diálogo, sin pedido al servidor). |
| c2·a (forma o fecha de una operación con varias clases) | **Hay que prepararla:** `mesa.entrada@` → «Registrar pago» (`/pagos/registrar`, HU-I-10) → alumno **Martínez, Lucas** → elegir 2 de sus reservas futuras (por ejemplo seed-turno-14 Física y seed-turno-24 Bases de Datos) → Transferencia. | En una de las dos clases → Corregir → cambiar la forma o la fecha → tiene que aparecer «Este cambio alcanza a 2 clases de esta operación.» → confirmar → abrir la **otra** clase: la forma o la fecha también cambió. «Ver detalle» de ambos pagos muestra la corrección. Q2: una fila por campo en `correcciones_operacion`. |
| c2·b (forma inactiva) | «Cheque» está inactiva en el seed (fixture HU-I-07) y ningún pago la usa. **Preparación:** `gerente@` → Formas de pago → activar «Cheque» → `mesa.entrada@` registra un pago con Cheque (cualquier reserva futura, por ejemplo Fernández en seed-turno-14) → `gerente@` vuelve a desactivar «Cheque». | Corregir ese pago → el selector muestra «Cheque (Inactiva)» seleccionada. Cambiar solo el monto: la forma se conserva. Desplegar el selector: Cheque no aparece entre las demás opciones. Snippet opcional con `forma_pago_id` de Cheque en otro pago → `409 FORMA_PAGO_NO_DISPONIBLE`. |
| c3 (motivo e historial) | Cualquiera de los anteriores | Motivo vacío: no deja confirmar. Más de 300 caracteres: el campo no acepta más. «Ver detalle» → arriba el registro y abajo los cambios, del más nuevo al más viejo, con anterior → nuevo, motivo, usuario y fecha. Q2: la fila de `pagos` no cambió. |
| c4 (anular y estado de la inscripción) | (a) **Clase pasada** (seed-turno-26) → la inscripción tiene que quedar «Pago sin registrar». (b) **Clase futura**: registrar un pago de una sola clase (por ejemplo Fernández en seed-turno-14) y anularlo → tiene que volver a «Reservada» con plazo nuevo. (c) Inscripción no vigente: ver c6. | Anular → motivo → «Anular pago» (rojo) → toast «Pago anulado» → el pago queda tachado con «Anulado» y fuera del «Total registrado» y del «Total pagado» del alumno. Sin «Corregir» ni «Anular» y con «Ver detalle». |
| c5 (más de 30 días) | Fixture **HU-H-06**: pagos de Matemática (MAT101, 11:00, Giménez) en meses anteriores, del primer alumno activo por DNI, registrados con el reloj de esa fecha en la caja abierta de `mesa.entrada@`. En Q1 tienen `mas_de_30_dias = true` y `caja = ABIERTA`. | `mesa.entrada@`: en esos pagos solo se ve «Ver detalle». Snippet B → `403 FUERA_DE_ALCANCE`. `gerente@`: ve los botones y el snippet C da `400 SIN_CAMBIOS`. |
| c5 (caja cerrada) | **Preparación:** `mesa.entrada2@` → abrir caja si no tiene → registrar un pago (por ejemplo Martínez en seed-turno-13) → «Mi caja» → cerrar la caja con el arqueo. | `mesa.entrada2@` o `mesa.entrada@`: sin botones y snippet B → 403. `gerente@`: Corregir el monto → confirmar → aparece el selector «Caja abierta donde registrar el ajuste» → elegir la de `mesa.entrada@` → «Reintentar con esta caja» → toast. Q2: un `ajustes_caja` por la diferencia. Cambiar solo la fecha no pide caja. Al terminar: `npm run caja:abrir -- mesa.entrada2@noctium.local`. |
| c5 (403 por rol) | `profesor1@`, `alumno01@` | Snippet A → `403 SIN_PERMISO` en las tres rutas. |
| c6 (reintegro) | Con la operación de 2 clases de **Martínez, Lucas** (c2·a), donde seed-turno-24 está a 7 días operativos, de sobra para la anticipación de 24 h. | `alumno02@noctium.local` → su panel → cancelar la inscripción de seed-turno-24 (HU-C-14). `mesa.entrada@` → esa clase o el historial de Lucas → Anular → «Usar el motivo «Reintegro»» → «Anular pago». Verificar: el otro pago de la operación sigue vigente, el comprobante tiene un número nuevo (el anterior figura «Reemplazado por…») y la inscripción cancelada no vuelve a ser reserva (caso «no reaparece ninguna reserva» del c4). |
| c7 | Cualquiera | Toasts «Pago corregido correctamente» y «Pago anulado». |

> Las fechas exactas de las clases dependen del día en que se corrió el seed (`diaOperativo` se cuenta desde esa fecha). Usá Q1 o el listado de Clases para ubicarlas.

---

## 7. Veredicto preliminar

### ✅ **Lista para prueba manual**

**Bloqueantes:** ninguno.

**No bloqueantes (para una próxima vuelta del dev o para que decida el PO):**
1. **PO:** confirmar si se acepta que una corrección de monto y forma o fecha a la vez emita **dos comprobantes de reemplazo** encadenados (c2).
2. `pago-acciones.tsx:36`: centralizar `MENSAJE_ERROR_GENERICO` en `textos.ts` (es la misma observación que ya se hizo en HU-I-10).
3. Mensajes de Zod escritos en el código del servidor: «Datos inválidos» (rutas `correccion` y `anulacion`) e «Indicá qué querés corregir» (`correccion.schema.ts`).
4. Deuda anterior a la HU en `turno-pago-card.tsx`: «Pago», «Pagos registrados», «Ninguno todavía.» y «Total registrado» sin centralizar.
5. Ajeno a esta HU, pero bloquea un «tests en verde» de toda la suite en `develop`: `src/server/shared/actividad-usuario.test.ts` falla desde HU-N-01 (`068239d`), porque al mock le falta `historialParametro`. `claves-textos.test.ts` falla por timeout de 60 s (ya conocido; el chequeo por CLI pasa).
