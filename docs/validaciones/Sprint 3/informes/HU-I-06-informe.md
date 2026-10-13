# Informe de validación PO — HU-I-06 · Corregir o anular un pago registrado

- **Fecha:** 13/10/2026
- **Rama revisada:** `feature/HU-C-27` (contiene `develop` @ `1f503e9`, con cambios locales de HU-C-27 que no tocan pagos). Se revisaron también las ramas remotas: ninguna contiene rutas ni pantallas de HU-I-06.
- **Fuente de verdad:** texto de la HU entregado por el PO (no la task).
- **Documentos leídos:** `prisma/schema.prisma`, `docs/RULES.md`, `docs/DESIGN.md`, `prisma/seed.ts` y `prisma/seed/fixtures/`, `docs/specs/spec_modulo_I.md` (§2.6 y §2.14), `docs/tasks/Sprint 3/PR-0.md` (documento de developers, §2.9 y §2.13), `docs/tasks/Sprint 3/HU-Sprint-3.md`.

> **Hallazgo principal:** **no existe task de HU-I-06** en `docs/tasks/Sprint 3/` (ni en `Modulo I/`, que tiene I-02, I-07, I-10, I-11, I-12 e I-12-b) y **la HU no está implementada**. Lo único que hay es la infraestructura que dejó el **PR 0**: los servicios `corregirPago`, `corregirOperacion`, `anularPago` y `puedeCorregirPago` (`src/server/pagos/correccion.service.ts`), las tablas `CorreccionPago` / `CorreccionOperacion` / `AnulacionPago`, el permiso `pagos:corregir` y algunos textos de error. **No hay endpoints** (`POST /api/pagos/[id]/correccion`, `POST /api/pagos/[id]/anulacion`, `GET /api/pagos/[id]/historial`, que pide la spec §2.14), **no hay pantallas ni botones** «Corregir» / «Anular», **no hay formulario, ni historial de cambios, ni mensajes de éxito**. Desde la interfaz, la HU no se puede probar.

---

## 1. Tabla de trazabilidad

Leyenda: **CUBIERTO** · **PARCIAL** · **NO ENCONTRADO** · **DESVÍO** (la task o la spec interpretan distinto que la HU). Como no hay task, los desvíos se comparan con la spec (`spec_modulo_I.md` §2.14) y con el PR 0.

| # | Criterio / viñeta | Dónde está (archivo · función · endpoint · componente) | Estado | Justificación |
|---|---|---|---|---|
| 1 | Acciones «Corregir» y «Anular» en cada pago de la lista «Pagos registrados» del detalle de la clase | `src/app/(dashboard)/turnos/[id]/turno-pago-card.tsx` (`TurnoPagoCard`) | **NO ENCONTRADO** | La tarjeta lista alumno, fecha, forma, comprobante y monto. No tiene acciones por pago ni recibe `puede_corregir`. |
| 1 | Acciones «Corregir» y «Anular» en el historial de pagos del alumno (HU-I-02) | `src/app/(dashboard)/alumnos/[id]/tabla-historial-pagos.tsx` (`TablaHistorialPagos`); el servidor ya calcula `puede_corregir` en `src/server/pagos/pago.service.ts:323` | **NO ENCONTRADO** | La API de historial devuelve `puede_corregir` y `cambios`, pero la tabla no los usa: no hay columna de acciones. |
| 2 | Formulario precargado con Monto, Forma de pago (solo activas) y Fecha, con las validaciones de HU-I-01/I-10 | — (servicio: `corregirPago` valida un monto positivo con hasta 2 decimales; `corregirOperacion` valida que la forma esté activa y la fecha no sea futura) | **NO ENCONTRADO** (UI y endpoint) / servicio PARCIAL | No hay formulario ni ruta. Las reglas están en el servicio, pero el motivo inválido sale como `RangeError` (sin `ErrorDeDominio`); sin el Zod de la ruta, se convertiría en un 500. |
| 2 | Pago cargado a otro alumno: se anula y mesa lo vuelve a registrar con HU-I-10; el gerente anula pero no registra | `anularPago` (servicio); el permiso `pagos:crear` es solo de MESA_ENTRADA (`prisma/seed.ts:916`) | **PARCIAL** | La regla de permisos se cumple: el gerente no tiene `pagos:crear`. La anulación no se puede hacer desde ninguna pantalla ni endpoint. |
| 2·a | Cada pago de una operación se corrige o anula por separado | `corregirPago` / `anularPago` reciben `pagoId` | **PARCIAL** (solo servicio) | Funciona a nivel de servicio (test `anularPago: uno de varios emite reemplazo…`). No hay endpoint. |
| 2·a | El total de la operación se calcula con los montos vigentes y no se guarda | `src/server/pagos/pago.vigente.ts` (`operacionVigente`, `sqlMontoVigente`), `listarPagosDeTurno`, `sumarPagosPorMes` | **CUBIERTO** (lectura) | El valor vigente se deriva de los registros nuevos en TS y en SQL; hay un test que verifica que las dos versiones coincidan. |
| 2·a | Fecha y forma son de la operación: cambiarlas registra `CorreccionOperacion`, se aplica a todos sus pagos e informa cuántas clases abarca | `corregirOperacion` → `clasesAbarcadas` | **PARCIAL** (solo servicio) | El servicio crea una corrección por campo y devuelve `clasesAbarcadas`. No hay pantalla que lo informe ni texto para el aviso. |
| 2·a | Cada corrección o anulación bloquea la operación y la inscripción en la misma transacción (Regla N.° 7) | `contextoDelPago` → `bloquear(tx, { clases, inscripciones, operaciones, cajas })` y luego revalida el alcance | **PARCIAL** | Los servicios reciben `tx` y bloquean en el orden canónico, y hay un test de dos anulaciones concurrentes. Falta la ruta que abra la `transaccion()` y encadene `corregirPago` + `corregirOperacion` en una sola. |
| 2·b | Forma de pago inactiva: se muestra con la etiqueta «Inactiva», se conserva si no se cambia y al cambiarla solo se ofrecen las activas | `corregirOperacion`: enviar la misma forma no cuenta como cambio y una forma nueva exige `verificarFormaPagoActiva` | **PARCIAL** (solo servicio) | La regla está en el servidor. No existe el selector ni la etiqueta «Inactiva» en un formulario de corrección. |
| 3 | Motivo obligatorio (hasta 300 caracteres) | `validarMotivo` en `correccion.service.ts` | **PARCIAL** | Valida de 1 a 300 caracteres después de `trim`, pero lanza `RangeError` (no hay texto ni código de error para la UI). No hay campo de motivo. |
| 3 | Se registran el valor anterior, el nuevo, el usuario y la fecha | Modelos `CorreccionPago` (monto anterior y nuevo), `CorreccionOperacion` (forma o fecha anterior y nueva), `AnulacionPago`; columnas `creadoPorUsuarioId` y `createdAt*` | **CUBIERTO** (persistencia) | Los registros nuevos guardan todos los datos que pide el criterio. |
| 3 | El detalle del pago muestra el historial de cambios | Spec §2.14.6: `GET /api/pagos/[id]/historial` + modal | **NO ENCONTRADO** | No existe la ruta ni el modal. El historial solo expone `cambios: number` (un conteo) y nadie lo muestra. |
| 3 | La corrección y la anulación no modifican el original: registro nuevo que lo referencia (Regla N.° 8); pantallas, totales e indicadores usan el valor vigente | `correccion.service.ts` (solo hace `create`); lecturas vigentes en `pago.vigente.ts`, `pago.publico.ts`, `caja.lecturas.ts`, indicadores (`sumarPagosPorMes`) | **CUBIERTO** (servicio y lecturas) | No hay `update` ni `delete` sobre `Pago`. Las lecturas, totales e indicadores usan el valor vigente. |
| 4 | Un pago anulado no se borra y se muestra con la etiqueta «Anulado» | Historial del alumno: `tabla-historial-pagos.tsx:62` (`ui.pagos.historial.anulado` = «Anulado», monto tachado). Detalle de la clase: `listarPagosDeTurno` **filtra** los anulados (`pago.publico.ts:214`) | **PARCIAL** | El historial lo cumple. En la lista «Pagos registrados» del detalle de la clase, el pago anulado **desaparece** en lugar de mostrarse con la etiqueta «Anulado». |
| 4 | Deja de sumar en los totales | `total_pagado` del historial (`pago.service.ts`), «Total registrado» del detalle (sobre pagos no anulados), `sumarPagosPorMes`, arqueo de caja | **CUBIERTO** | Todos los totales excluyen los anulados. |
| 4 | Efecto en la inscripción según HU-C-24 c5 (vuelve a «Reservada», queda «Pago sin registrar» o no se crea reserva) | `anularPago` → `recalcularEstadoPago` (`src/server/turnos/inscripcion.publico.ts`) | **PARCIAL** (solo servicio) | Hay un test PG (`…el último deja la reserva reabierta…`). No se cubren en tests los casos de clase iniciada o cancelada (→ `PAGO_SIN_REGISTRAR`) ni el de inscripción no vigente. Sin endpoint, no se puede probar a mano. |
| 5 | El gerente corrige o anula cualquier pago | `puedeCorregirPago`: GERENTE → `true` | **PARCIAL** (solo servicio) | Hay test unitario. Falta el endpoint. |
| 5 | Mesa de entrada: hasta 30 días **desde el registro** (no la fecha de pago) y con la caja del pago abierta | `puedeCorregirPago` con `registradoEn: operacion.registradaEl` y `cajaAbierta` | **PARCIAL** (solo servicio) | Usa la fecha de registro de la operación y el estado de la caja, que se revalida bajo bloqueo. Tiene tests (30 días contra 30,01 días; caja cerrada). Falta el endpoint. |
| 5 | Caja cerrada: lo hace el gerente y el dinero se registra como ajuste en una caja abierta (HU-I-12 c4) | `registrarAjuste` invocado desde los tres servicios con `cajaAjusteId`; error `errores.caja.ajusteSinCajaAbierta` | **PARCIAL** (solo servicio) | Tiene test PG. No hay selector de caja de ajuste para el gerente. |
| 5 | El servidor rechaza con 403 los intentos fuera de alcance | `errores.pago.fueraDeAlcance` → `403 FUERA_DE_ALCANCE` (`src/server/shared/errores-dominio.ts:142`); rol sin permiso → `403 SIN_PERMISO` vía `withPermission("pagos:corregir")` | **NO ENCONTRADO** (HTTP) | El mapeo existe, pero **no hay ninguna ruta** que lo exponga: hoy el intento devuelve 404 (ruta inexistente), no 403. |
| 6 | Reintegro: anular el pago de esa clase con el motivo «Reintegro»; el resto de la operación no cambia y el comprobante se reemplaza (HU-I-11 c5) | `anularPago` + `emitirReemplazo` (spec P-I8: la interfaz carga el motivo «Reintegro») | **PARCIAL** (solo servicio) | El reemplazo del comprobante está cubierto por un test. No hay interfaz que precargue «Reintegro». |
| 7 | Se informa «Pago corregido correctamente» o «Pago anulado» | — | **NO ENCONTRADO** | Ningún texto ni componente. Ver §2. |

**Desvíos detectados (spec o PR 0 contra la HU):**
- **DESVÍO menor (bloqueos, c2):** la HU pide bloquear «la operación y la inscripción del pago». El PR 0 y la spec bloquean además la **clase** y las **cajas**. Es más estricto y la spec §2.14.2 lo justifica (`recalcularEstadoPago` depende de la clase), así que **no afecta la aceptación**; queda anotado.
- **DESVÍO menor (c2, monto y forma a la vez):** la spec define que se emiten **dos comprobantes de reemplazo encadenados**. La HU no lo prohíbe, pero el usuario va a ver dos números nuevos por una sola corrección. Conviene que el PO lo confirme.
- **DESVÍO (c4, detalle de la clase):** `listarPagosDeTurno` excluye los pagos anulados, mientras que la HU pide que se muestren con la etiqueta «Anulado». La spec §2.13 los excluye a propósito en esa lectura, así que la discrepancia viene de la spec, no de un error del dev.

---

## 2. Textos literales (archivo central `src/lib/textos.ts`, HU-C-23)

| Texto del criterio | En `textos.ts` | Resultado |
|---|---|---|
| «Corregir» (acción del pago) | No hay clave `ui.pagos.*.corregir`; solo existen `ui.historial.examen.corregir` y el de asistencia, de otras HU | **NO COINCIDE (ausente)** |
| «Anular» (acción del pago) | No hay clave `ui.pagos.*.anular`; solo `ui.historial.examen.anular` y `ui.caja.movimiento.anular` | **NO COINCIDE (ausente)** |
| «Pagos registrados» | Literal hardcodeado en `turno-pago-card.tsx` (no viene de `textos.ts`) | Coincide palabra por palabra, pero **no está centralizado** |
| «Inactiva» | Existe `ui.formasPago.inactiva` = «Inactiva» (HU-I-07), pero no se usa en ningún formulario de corrección | Coincide, **sin uso** en HU-I-06 |
| «Anulado» | `ui.pagos.historial.anulado` = «Anulado» | **COINCIDE** (solo en el historial del alumno) |
| «Reintegro» (motivo) | No hay clave para el motivo precargado; `ui.profesores.estado.reintegro` lo menciona dentro de otra frase | **NO COINCIDE (ausente)** |
| «Pago corregido correctamente» | No existe | **NO COINCIDE (ausente)** |
| «Pago anulado» | No existe | **NO COINCIDE (ausente)** |

Otros textos que pide la spec y faltan: el aviso «este cambio de forma o de fecha alcanza a <N> clases», el rótulo del motivo, «Indicá qué querés corregir», el texto de la confirmación irreversible de la anulación y el error de motivo obligatorio para pagos. Los errores que sí existen (`errores.pago.anulado`, `yaAnulado`, `sinCambios`, `fueraDeAlcance`, `errores.caja.ajusteSinCajaAbierta`) no salen del texto de la HU, salvo el de caja, que es literal de HU-I-12 c4.

---

## 3. Reglas de servidor

### 3.1 Qué está y qué falta

| Regla | Servicio (PR 0) | Endpoint (HU-I-06) |
|---|---|---|
| Validación Zod previa (Regla N.° 6) | — | **Falta** `CorregirPagoSchema` / `AnularPagoSchema` (`.strict()`). Hoy el motivo inválido sería un `RangeError` y, por lo tanto, un 500. |
| RBAC (Regla N.° 10): `withPermission("pagos:corregir")` | Permiso sembrado para MESA_ENTRADA y GERENTE (`prisma/seed.ts:956-957`, migración `20261008120200_sprint3_permisos`) | **Falta** la ruta. |
| 403 fuera de alcance | `puedeCorregirPago` + `exigirAlcance` → `FUERA_DE_ALCANCE` 403, evaluado **después** de bloquear | Sin ruta no hay respuesta HTTP. |
| Transacción y bloqueos (Regla N.° 7) | `bloquear()` de clase → inscripción → operación → cajas, en una sola llamada, y relectura con todo bloqueado. Test de dos anulaciones concurrentes en verde | Falta la `transaccion()` de la ruta que encadene `corregirPago` + `corregirOperacion`. |
| Registro nuevo en lugar de modificar (Regla N.° 8) | Solo `create` de `CorreccionPago`, `CorreccionOperacion`, `AnulacionPago` y `AjusteCaja`; índice único por pago en `AnulacionPago` | — |
| Historial de estados después del commit (spec §2.14.3 paso 6) | `recalcularEstadoPago` con `actorUsuario` | Lo tiene que hacer la ruta; no existe. |

### 3.2 Endpoints relevantes y snippets para comprobar el 403

Rutas **definidas en la spec §2.14 que no existen hoy**. Con los snippets de abajo, hoy vas a ver **404** (o la página 404 de Next) en lugar del 403 esperado; esa es la evidencia de que faltan.

| Método y ruta | Permiso | Estado |
|---|---|---|
| `POST /api/pagos/[id]/correccion` | `pagos:corregir` | **No existe** |
| `POST /api/pagos/[id]/anulacion` | `pagos:corregir` | **No existe** |
| `GET /api/pagos/[id]/historial` | `pagos:leer` | **No existe** |
| `GET /api/pagos/historial?alumno_id=…` (HU-I-02, ya existe; trae `puede_corregir`) | `pagos:leer` | Existe |

Primero obtené un `pago_id` real con la sesión de **mesa de entrada o gerente** (pegalo en la consola del navegador, en `/alumnos/<id>/pagos`):

```js
// 1) Con sesión de mesa o gerente: listar los pagos del alumno y ver pago_id / puede_corregir
const alumnoId = location.pathname.split("/")[2];
const r = await fetch(`/api/pagos/historial?alumno_id=${alumnoId}`);
const j = await r.json(); console.log(r.status, j.data?.items?.map(p => ({ id: p.pago_id, monto: p.monto, anulado: p.anulado, puede_corregir: p.puede_corregir, registrado_en: p.registrado_en })));
```

Después, con la sesión de **profesor** (`profesor1@noctium.local`) o **alumno** (`alumno01@noctium.local`) (esperado: `403 SIN_PERMISO`) y con **mesa de entrada** sobre un pago de más de 30 días o con la caja cerrada (esperado: `403 FUERA_DE_ALCANCE`):

```js
const pagoId = "PEGAR_PAGO_ID";
// Corregir
let r = await fetch(`/api/pagos/${pagoId}/correccion`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ monto: "1000.00", motivo: "Prueba de permisos" }) });
console.log("correccion", r.status, await r.text());
// Anular
r = await fetch(`/api/pagos/${pagoId}/anulacion`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ motivo: "Prueba de permisos" }) });
console.log("anulacion", r.status, await r.text());
// Historial de cambios (solo profesor/alumno → 403)
r = await fetch(`/api/pagos/${pagoId}/historial`);
console.log("historial", r.status, await r.text());
```

Control del endpoint que sí existe (profesor o alumno → 403 esperado):

```js
const r = await fetch(`/api/pagos/historial?alumno_id=PEGAR_ALUMNO_ID`); console.log(r.status, await r.json());
```

---

## 4. Definición de Terminado

| Ítem | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Incumple** | Faltan todos los textos de HU-I-06 (§2). Además, «Pago», «Pagos registrados», «Ninguno todavía.» y «Total registrado» de `turno-pago-card.tsx`, el lugar donde van las acciones del c1, están hardcodeados. Ese archivo es de HU-I-01 (la migración corresponde a HU-C-19), pero HU-I-06 lo va a tener que tocar. |
| Ningún texto visible con «turno» | Sin objeto / OK | No hay textos nuevos de HU-I-06. Los textos `errores.pago.*` y `errores.caja.*` existentes no dicen «turno». |
| Confirmación con el componente común de HU-C-25 (`src/components/shared/confirmar-accion-dialog.tsx`) en toda operación que guarda | **Incumple** | No hay operación de corregir ni de anular en la UI, así que tampoco hay confirmación (la spec pide una reversible para corregir y una irreversible para anular). |
| Tests en verde | Ver §4.1 | Los tests que existen son del PR 0 (servicio). **No hay tests de HU-I-06**: rutas, componentes, 403 por rol ni los casos de §2.14.7 que faltan (`PAGO_SIN_REGISTRAR` en clase iniciada o cancelada, cierre de caja contra corrección en los dos órdenes, monto y forma a la vez). |

### 4.1 Resultado de los tests

Corridas del 13/10/2026 sobre el árbol de trabajo actual, sin modificar nada:

| Corrida | Resultado |
|---|---|
| `npx vitest run` (suite unitaria completa) | 306 archivos OK, 1 con fallos: **3 tests de `src/lib/claves-textos.test.ts` por timeout de 60 s**. Corría en paralelo con la suite PG y la máquina estaba cargada. Repetidos solos (`claves-textos.test.ts` + `correccion.alcance.test.ts`): **43/43 en verde**. |
| `npm run test:pg -- src/server/pagos` (primera vez, en paralelo con la unitaria) | 12 fallos en 4 archivos, todos por timeout de 5 s (por ejemplo, la concurrencia de comprobantes en `operacion.service.pg.test.ts`) |
| `npm run test:pg -- src/server/pagos` (repetido solo) | **13 archivos OK, 1 omitido · 85 tests OK, 4 omitidos**, incluidos los **8 tests de `correccion.service.pg.test.ts`** |

Conclusión: los fallos fueron por carga, no regresiones. Lo que está en verde es la capa del PR 0; **HU-I-06 no tiene tests propios** porque no tiene código propio.

---

## 5. Extras y violaciones

**Implementado que la HU no pide** (todo del PR 0, no de esta HU):
- Un **par de ajustes** (−total en la forma anterior y +total en la nueva) cuando se cambia la forma de un pago de una caja cerrada (spec P-I3). La HU solo dice «el dinero que se mueve se registra como ajuste»; está pendiente la decisión del PO (P-I3).
- `errores.pago.sinCambios` («Los valores son los mismos que los vigentes.»): rechaza una corrección sin cambios. Es razonable, pero no está en la HU.
- Bloqueo de la **clase** y de las **cajas**, además de la operación y la inscripción (ver Desvíos).
- `cambios: number` y `puede_corregir` en la respuesta del historial de pagos (HU-I-02), preparados para esta HU pero sin uso.

**Violaciones a RULES.md / DESIGN.md:**
- **Regla N.° 6 (Zod previa a servicios):** no aplica todavía porque no hay rutas. El servicio usa `RangeError` para el motivo y el monto, lo que obliga a que la ruta valide antes. Si no lo hace, el resultado es un 500.
- **DESIGN §9 (contrato de textos):** los literales de `turno-pago-card.tsx` (heredados de HU-I-01).
- **DESIGN §6.4:** no hay ninguna fila para «Corregir pago» ni «Anular pago» en la tabla resumen de feedback. Hay que definir Dialog + C-25 + Toast antes de implementar.
- No se encontraron `UPDATE` ni `DELETE` sobre `Pago` (Reglas N.° 1 y N.° 8 OK).

---

## 6. Datos para la prueba manual

**Credenciales** (todas con la contraseña `Password123!`, `prisma/seed.ts:41-47`):

| Rol | Cuenta | Para qué |
|---|---|---|
| Mesa de entrada (caja abierta del seed) | `mesa.entrada@noctium.local` (Ruiz, Marta) | c1, c2, c3, c5 dentro del alcance, c6 |
| Mesa de entrada 2 (caja abierta del seed) | `mesa.entrada2@noctium.local` (Ferreyra, Pablo) | c5: pago en la caja abierta de **otro** integrante; caja cerrada |
| Gerente | `gerente@noctium.local` (Paredes, Silvia) | c5: cualquier pago y caja cerrada con ajuste; c2: anula pero no registra |
| Profesor | `profesor1@noctium.local` | 403 `SIN_PERMISO` |
| Alumno | `alumno01@noctium.local` (Fernández, Sofía) | 403 `SIN_PERMISO` |

**Datos del seed que sirven:**

| Caso | Dato | Cómo llegar |
|---|---|---|
| Pago reciente, caja abierta, operación de un pago (c1, c2, c3, c4, c7) | `seed-turno-26` (Matemática, ayer 10:00, alumnos 01 a 07) y `seed-turno-27` (Programación I, anteayer 16:00): pagos en **Transferencia** registrados por `mesa.entrada` en su caja abierta | Detalle de la clase → «Pagos registrados»; o la ficha del alumno → pestaña Pagos |
| Pago de **más de 30 días** desde el registro, caja abierta (c5: mesa → 403, gerente OK) | Fixture HU-H-06: pagos de **Fernández, Sofía** (DNI 40100001) en Matemática, Giménez, 11:00, uno o dos por mes durante los últimos 23 meses, registrados con el reloj en esa fecha por `mesa.entrada` | Ficha de Fernández, Sofía → Pagos, filtrando Matemática |
| Forma de pago **inactiva** (c2·b) | «Cheque», inactiva (fixture HU-I-07) | Ver la preparación A |
| Clase futura con reservas, para anular y ver «Reservada» de nuevo (c4) | Las reservas del paso 13 del seed en clases futuras (`seed-turno-28`, `29`, `31`, `33`…) | Pagarlas desde **Registrar pago** (HU-I-10) y después anular el pago |

**Lo que falta en el seed y cómo prepararlo sin tocar código:**

- **A. Operación con forma inactiva (c2·b).** El seed no tiene ningún pago en Cheque.
  1. Con `gerente@noctium.local` → **Formas de pago** → reactivar «Cheque».
  2. Con `mesa.entrada@noctium.local` → **Registrar pago** → elegir un alumno con 2 o 3 reservas (por ejemplo, de `seed-turno-29`) → pagarlas juntas en Cheque (así queda una operación de varias clases, útil también para c2·a y c6).
  3. Con el gerente → desactivar «Cheque» otra vez.
- **B. Operación con varias clases (c2·a, c6).** Igual que A.2, en Efectivo o Transferencia.
- **C. Pago en una caja cerrada (c5, ajuste).** Con `mesa.entrada2@noctium.local` → registrar un pago (HU-I-10) → **Caja** → cerrar la caja (HU-I-12). Después, para que haya una caja abierta para el ajuste, dejá la caja de `mesa.entrada` abierta. Si `mesa.entrada2` necesita volver a abrir caja: `npm run caja:abrir -- mesa.entrada2@noctium.local`.
- **D. Anular el último pago en una clase que ya empezó o está cancelada (c4 → «Pago sin registrar»).** Usá `seed-turno-26` (ya empezó). Para una cancelada: con mesa, cancelá una clase futura que tenga un pago (después de B) y anulá ese pago.
- **E. Reintegro de alumno que canceló (c6, HU-C-14).** Con `alumno01@noctium.local`, pagá una clase futura (con mesa, como en B) → en **Mis clases** el alumno cancela su inscripción → con mesa, anulá el pago con el motivo «Reintegro». No se tiene que crear ninguna reserva.
- **F. Pago de 29 días contra 31 días exactos (borde del c5).** No hace falta: el fixture HU-H-06 ya da pagos de más de 30 días. Si querés el borde exacto, corré esto una sola vez **solo en tu base local de desarrollo**, porque viola la Regla N.° 8 a propósito como dato de prueba (reemplazá el id):

  ```bash
  npx prisma db execute --stdin <<'SQL'
  -- Retrocede 31 días el registro de UNA operación de prueba (solo base local).
  UPDATE "operaciones_pago" SET "registradaEl" = now() - interval '31 days'
  WHERE "idOperacionPago" = 'PEGAR_OPERACION_ID';
  SQL
  ```

  Los nombres están verificados contra `prisma/migrations/20261008120100_sprint3_modelo/migration.sql` (tabla `operaciones_pago`, columnas `idOperacionPago` y `registradaEl`). El id de la operación se ve en Prisma Studio (`npx prisma studio` → `OperacionPago`). Usá `interval '29 days'` para probar el caso permitido.

> Todo esto sirve **recién cuando existan la UI y las rutas de HU-I-06**. Hoy solo se puede ejecutar la preparación, no el criterio.

---

## 7. Veredicto preliminar

### **VOLVER AL DEV**

**Bloqueantes:**
1. **No hay task de HU-I-06** en `docs/tasks/Sprint 3/` y **la HU no está implementada**: solo existe la capa de servicios del PR 0.
2. **Faltan los endpoints** `POST /api/pagos/[id]/correccion`, `POST /api/pagos/[id]/anulacion` y `GET /api/pagos/[id]/historial`, con su Zod `.strict()`, `withPermission("pagos:corregir")` / `pagos:leer`, `transaccion()` y el historial de estados después del commit. Sin ellos no hay 403 comprobable (c5).
3. **c1:** faltan las acciones «Corregir» y «Anular» en «Pagos registrados» (detalle de la clase) y en el historial de pagos del alumno.
4. **c2:** falta el formulario precargado (Monto, Forma con «Inactiva», Fecha), el aviso de cuántas clases abarca y el selector de caja de ajuste para el gerente.
5. **c3:** falta el campo de motivo (obligatorio, hasta 300, con texto de error) y el **historial de cambios** en el detalle del pago.
6. **c4:** en el detalle de la clase, el pago anulado desaparece en lugar de mostrarse con la etiqueta «Anulado». Hay que decidir con el PO si se cambia la lectura de la spec.
7. **c6:** falta la anulación con el motivo «Reintegro» precargado desde la interfaz.
8. **c7:** faltan los textos «Pago corregido correctamente» y «Pago anulado» en `textos.ts` y el toast.
9. **DoD:** faltan la confirmación HU-C-25 (reversible para corregir, irreversible para anular), los textos centralizados y los tests de rutas, componentes y 403.

**Decisiones a confirmar con el PO (no bloquean):** el par de ajustes en el cambio de forma con caja cerrada (P-I3), los dos comprobantes encadenados cuando se corrigen monto y forma a la vez, y si el detalle de la clase debe listar los pagos anulados.
