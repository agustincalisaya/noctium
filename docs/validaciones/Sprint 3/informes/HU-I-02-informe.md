# Informe de validación — HU-I-02 · Ver el historial de pagos del alumno

**Fecha:** 13/10/2026 · **Validó:** asistente del PO (revisión estática del código + tests existentes + consultas de solo lectura a la base de desarrollo)
**Código revisado:** `develop` en `1f503e9` (HU-I-02 entró con el merge `8882cc2 feature/HU-F-02`). El working tree tiene cambios sin commitear de HU-C-27 que **no tocan** archivos de esta HU.
**Fuente de verdad:** el texto de la HU pasado por el PO (coincide palabra por palabra con `docs/tasks/Sprint 3/HU-Sprint-3.md` §HU-I-02).
**Task:** `docs/tasks/Sprint 3/Modulo I/HU-I-02.md` · **Contrato:** `docs/specs/spec_modulo_I.md` §2.13.

---

## 0. Resumen

La HU está implementada completa y de forma bastante fiel al contrato: dos endpoints GET de solo lectura con `pagos:leer`, la pestaña «Pagos» dentro de la ficha (`/alumnos/[id]/pagos`), los dos modos (historial / estado de pago), los filtros combinables sin recargar, el total con `Decimal` sobre todo el resultado filtrado, la paginación de a 10 en el servidor, los anulados etiquetados y fuera del total, y el atajo «Registrar pago» calculado en el servidor (nunca para el gerente). Tests dirigidos en verde (8 archivos, 129 pruebas), lint limpio y verificador de claves de textos OK.

No encontré bloqueantes. Hay **observaciones menores** (§2, §5.2): la leyenda del modo estado de pago agrega una segunda oración al literal, la paginación se muestra aunque haya una sola página (DESIGN §8.1), «Anulado» no usa `Badge`, y los datos del seed traen pagos con monto distinto del precio **sin motivo**, lo que puede confundir en la prueba del ajuste. Corregir/anular del gerente (criterio 7) queda en **verificación diferida** a HU-I-06, que todavía no tiene pantalla.

---

## 1. Tabla de trazabilidad

Archivos principales:

| Capa | Archivo |
|---|---|
| Ruta API historial | `src/app/api/pagos/historial/route.ts` (`GET`) |
| Ruta API opciones | `src/app/api/pagos/historial/opciones/route.ts` (`GET`) |
| Validación | `src/server/pagos/pago.schema.ts` → `HistorialPagosQuerySchema`, `OpcionesHistorialPagosQuerySchema` |
| Servicio | `src/server/pagos/pago.service.ts:234-342` → `listarHistorialDePagos`, `obtenerOpcionesHistorialPagos`, `paginarHistorial` |
| Lectura de pagos (I) | `src/server/pagos/pago.publico.ts` → `listarPagosDeAlumno`, `pagosDeOperaciones` |
| Lectura de inscripciones (C) | `src/server/turnos/inscripcion.lecturas.ts:70-134` → `listarInscripcionesDeAlumno` (filtro `estadoPago` + `vence_el`) |
| Página | `src/app/(dashboard)/alumnos/[id]/pagos/page.tsx` → delega en `alumnos/[id]/page.tsx` con `tab=pagos` |
| Componentes | `src/app/(dashboard)/alumnos/[id]/historial-pagos.tsx` (filtros, carga, paginación), `tabla-historial-pagos.tsx` (filas de ambos modos) |
| Utilidades de UI | `src/lib/pagos-historial-listado.ts` (parámetros de URL, formato de dinero) |
| Textos | `src/lib/textos.ts:1887-1928` (`ui.pagos.historial.*`) |
| Tipos | `src/types/pago.types.ts` (`HistorialPagosData`, `PagoHistorialItem`, `EstadoPagoHistorialItem`) |

### Criterio 1 — Pestaña «Pagos» con solo el historial

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Pestaña «Pagos» dentro de la ficha | `alumnos/[id]/page.tsx:131` (link visible si `pagos:leer`), `alumnos/[id]/pagos/page.tsx` | CUBIERTO | Mismo patrón que la pestaña «Clases»; encabezado de la ficha conservado |
| Todos los pagos con el alumno como pagador, en cualquier clase | `listarPagosDeAlumno` (`pago.publico.ts`): `operacionPago.findMany({ where: { alumnoId } })` | CUBIERTO | Todos los `Pago` tienen `operacionId` obligatorio (schema), así que no quedan pagos de Sprint 2 afuera |
| Sin resumen ni «Estado de cuenta» | — | CUBIERTO | No existe ninguna sección así (`grep` de «Estado de cuenta» sin resultados en `src/`). Solo se muestra «Total pagado», que lo pide el criterio 3 |
| Lo pendiente se ve en «Registrar pago» (HU-I-10) | — | CUBIERTO | La pestaña no lista pendientes en modo historial |

### Criterio 2 — Columnas, orden y paginación

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Fecha de pago | `tabla-historial-pagos.tsx:57` | CUBIERTO | Fecha de pago **vigente** (`vigenteDeOperacion`). Encabezado dice «Fecha», no «Fecha de pago» (ver §2) |
| Clase (fecha, hora, materia) con enlace al detalle HU-C-09 | `tabla-historial-pagos.tsx:58-62` → `/turnos/{id}` | CUBIERTO | Formato «Lun 12/10/2026 10:00 · Matemática». La URL contiene «turnos», pero no es texto visible |
| Precio de la clase (HU-L-06) | `p.precio` (`Pago.precio`, congelado en la inscripción) | CUBIERTO | No se recalcula con la tarifa actual |
| Monto cobrado | `p.monto` (vigente, con correcciones) | CUBIERTO | |
| Forma de pago | `p.forma_pago.nombre` (forma vigente de la operación) | CUBIERTO | Encabezado «Forma» |
| Usuario que lo registró | `obtenerNombresPersonal` (F) → «Apellido, Nombre» o «—» | CUBIERTO | Encabezado «Registrado por» |
| Acceso al comprobante (HU-I-11) | Link `/comprobantes/{id}` con el número | CUBIERTO | Comprobante vigente; para un anulado, el último que lo incluyó (`comprobanteDelPagoEnOperacion`) |
| Orden por fecha de pago descendente | `ordenFechaYRegistro` (`pago.publico.ts`) | CUBIERTO | Desempate por momento de registro e id |
| Paginado de a 10 | `POR_PAGINA_HISTORIAL = 10` en el servicio + `Pagination` | CUBIERTO | Página fuera de rango → última página |
| Importe ≠ precio → precio, motivo y quién lo cambió | `tabla-historial-pagos.tsx:68-71` («Ajuste: {motivo} · {actor}»), precio en su columna | CUBIERTO | Sale de `motivoAjuste` / `ajustadoPorUsuarioId` del pago (HU-I-10 c4). **Ojo datos:** los pagos del seed tienen monto ≠ precio **sin motivo** (modo `compatSprint2`), así que ahí no aparece la línea de ajuste. Ver §5.2 y §6 |
| Anulados con etiqueta «Anulado» y no suman | `tabla-historial-pagos.tsx:66-67`; total en `pago.service.ts:302` (`p.anulado ? suma : …`) | CUBIERTO | Fila atenuada, monto tachado, etiqueta textual. Total con `Prisma.Decimal` |

### Criterio 3 — Filtros del historial

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Rango de fechas de pago (Desde–Hasta) | Schema `desde/hasta` + `listarPagosDeAlumno` (fecha vigente, inclusiva) | CUBIERTO | Rótulos «Pago desde» / «Pago hasta». `desde > hasta` → 400 (la UI muestra el error genérico con «Reintentar», ver §5.2) |
| Forma de pago, incluidas inactivas usadas | `obtenerOpcionesHistorialPagos`: formas de los pagos del alumno (anulados incluidos) | CUBIERTO | No usa el catálogo de activas |
| Materia (de clases con pagos) | Mismo servicio, materias vía `obtenerClasesBasicas` (C) | CUBIERTO | Incluye materias de pagos anulados (spec §2.13.2) |
| Se combinan entre sí | Servicio: fechas y forma en I, materia en memoria tras la lectura en lote de C | CUBIERTO | |
| Sin recargar la pantalla | `historial-pagos.tsx`: `fetch` en cliente + `history.replaceState` | CUBIERTO | Descarta respuestas viejas con `AbortController` |
| Vuelven a la página 1 | `cambiar()` fija `pagina: 1` | CUBIERTO | |
| Total pagado del resultado filtrado | `total_pagado` sobre **todo** el filtrado antes de paginar | CUBIERTO | |
| «Limpiar filtros» vuelve al listado completo | Botón → `filtrosVaciosHistorialPagos` | CUBIERTO | También sale del modo estado de pago |

### Criterio 4 — Filtro «Estado de pago»

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Opciones Pagada / Reservada / Pago sin registrar | `historial-pagos.tsx:110-115` | CUBIERTO | |
| Lista clases Disponibles o Completas con inscripción vigente en ese estado, en lugar de los pagos | `listarInscripcionesDeAlumno(…, { estadoPago })`: `vigente_ahora` (`esVigenteEn` con `ahora()`) + `DISPONIBLE`/`COMPLETO` | CUBIERTO | Excluye clases canceladas e inscripciones no vigentes; una reserva vencida sin marcar no figura |
| Columnas Fecha, Materia, Profesor, Precio y estado (texto, no solo color) | `tabla-historial-pagos.tsx:85-108` | CUBIERTO | `Badge` con texto. Columna extra «Acción» para el atajo |
| «Pagada» / «Reservada · pagar antes del <fecha y hora>» / «Pago sin registrar» | `textos.ts:1900-1903` + `vence_el` formateado `dd/mm/aaaa, hh:mm` (zona del centro) | CUBIERTO | |
| Solo se combina con el rango de fechas (por fecha de la clase) | Schema `refine` (400 si viene con forma/materia); filtro por `fechaTurno` en C; rótulos «Clase desde/hasta» | CUBIERTO | |
| Forma y materia se limpian y deshabilitan, con la leyenda | `cambiar()` limpia; `disabled={modoEstado}`; leyenda `ui.pagos.historial.leyendaEstado` | PARCIAL (texto) | Comportamiento correcto; la leyenda agrega una oración al literal (ver §2) |
| «Registrar pago» solo en Reservada / Pago sin registrar, clase que no empezó y sigue Disponible/Completa, solo mesa de entrada, con alumno y clase preelegidos | Servidor: `puede_registrar_pago` (`pago.service.ts:278-280`: rol Mesa + `pagos:crear` + no Pagada + inicio > `ahora()`); UI además exige `puedeRegistrarPago`; link `/pagos/registrar?alumno=&clase=` | CUBIERTO | El estado Disponible/Completa lo garantiza el filtro de C. El gerente nunca recibe `true` |

### Criterio 5 — Quitados/cancelados y sin saldo

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Pagos de clases de las que fue quitado o canceló se siguen mostrando | `listarPagosDeAlumno` no filtra por vigencia de la inscripción | CUBIERTO | Probado en `pago.historial.pg.test.ts` (inscripción quitada) |
| No se calcula saldo ni deuda | Respuesta sin saldo/deuda; modo estado sin `total_pagado` | CUBIERTO | |

### Criterio 6 — Mensajes

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Sin pagos | `ui.pagos.historial.sinPagos` cuando no hay filtros | CUBIERTO | |
| Filtros sin resultados | `ui.pagos.historial.sinFiltros` si hay fecha, forma o materia | CUBIERTO | |
| Estado de pago sin resultados | `ui.pagos.historial.sinClases` | CUBIERTO | |

### Criterio 7 — Acceso

| Viñeta | Dónde | Estado | Justificación |
|---|---|---|---|
| Mesa de entrada y gerente | Seed: `pagos:leer` solo para `MESA_ENTRADA` y `GERENTE`; `withPermission("pagos:leer")` en ambas rutas; `exigirPermiso("pagos:leer")` en la página | CUBIERTO | |
| Gerente en modo consulta | Leyenda «Modo consulta: no editás datos, no inscribís ni registrás pagos.»; sin «Registrar pago» (servidor y UI) | CUBIERTO | |
| … salvo corregir o anular según HU-I-06 | `puede_corregir` viaja en la respuesta (`puedeCorregirPago`), sin botones | **Verificación diferida** | HU-I-06 no tiene pantalla todavía (la task lo deja fuera de alcance explícitamente). Coincide con la verificación diferida del backlog |
| Profesor no accede, 403 en el servidor | `withPermission` → 403 `SIN_PERMISO`; página → `/sin-permiso`; `rutas-por-rol.ts` `alumnos: ["MESA_ENTRADA","GERENTE"]` | CUBIERTO | Test de ruta: alumno y profesor → 403, sin sesión → 401 |
| El alumno ve sus pagos en HU-I-05 | — | Fuera de alcance | El alumno recibe 403 acá (no tiene `pagos:leer`) |

**DESVÍOS de la task respecto de la HU:** no encontré ninguno de fondo. La task y la spec interpretan los criterios igual que la HU. Dos detalles de redacción: la task describe la leyenda como «la leyenda contractual», pero el código le agrega una oración; y el ajuste toma solo `motivoAjuste` del registro (HU-I-10 c4), no correcciones posteriores. Eso es lo que dice la HU y la spec §2.13.1 lo explica.

---

## 2. Textos literales (archivo central `src/lib/textos.ts`)

| Literal de la HU | Clave | Valor en código | ¿Coincide? |
|---|---|---|---|
| «Pagos» (pestaña) | `ui.pagos.historial.tab` | «Pagos» | ✅ |
| «Estado de cuenta» (no debe existir) | — | no existe | ✅ |
| «Anulado» | `ui.pagos.historial.anulado` | «Anulado» | ✅ |
| «Limpiar filtros» | `ui.pagos.historial.limpiar` | «Limpiar filtros» | ✅ |
| «Estado de pago» | `ui.pagos.historial.estado` | «Estado de pago» | ✅ |
| «Pagada» | `ui.pagos.historial.pagada` | «Pagada» | ✅ |
| «Reservada · pagar antes del <fecha y hora>» | `reservada` + « · » + `vencimiento` | «Reservada · pagar antes del {fecha}» | ✅ |
| «Pago sin registrar» | `ui.pagos.historial.sinRegistrar` | «Pago sin registrar» | ✅ |
| «Registrar pago» | `ui.pagos.historial.registrar` | «Registrar pago» | ✅ |
| «El estado de pago solo se combina con el rango de fechas» | `ui.pagos.historial.leyendaEstado` | «El estado de pago solo se combina con el rango de fechas**. El rango filtra por fecha de la clase.**» | ❌ **No coincide palabra por palabra**: contiene el literal y le agrega una segunda oración |
| «Este alumno no tiene pagos registrados» | `ui.pagos.historial.sinPagos` | idéntico | ✅ |
| «No hay pagos para los filtros elegidos» | `ui.pagos.historial.sinFiltros` | idéntico | ✅ |
| «No hay clases con ese estado de pago en el período» | `ui.pagos.historial.sinClases` | idéntico | ✅ |

**No coincide:** solo la leyenda del modo estado de pago. El mensaje de error 400 del servidor (`refine` del schema) sí usa el literal exacto, pero ese no se muestra en pantalla.

**Rótulos que no son literales entre comillas pero difieren de la redacción del criterio 2/3** (para que decida el PO): «Fecha» (HU: Fecha de pago), «Precio» (Precio de la clase), «Forma» (Forma de pago), «Registrado por» (Usuario que lo registró), «Pago desde/Pago hasta» y «Clase desde/Clase hasta» (Desde–Hasta). Las dos claves `ui.pagos.historial.descripcion` y `ui.pagos.historial.leyendaPagos` están definidas pero no se usan.

---

## 3. Reglas de servidor

### 3.1 Endpoints

| Método y ruta | Permiso | Validación | Errores |
|---|---|---|---|
| `GET /api/pagos/historial?alumno_id=&desde=&hasta=&forma_pago_id=&materia_id=&estado_pago=&pagina=` | `pagos:leer` (Mesa, Gerente) | `HistorialPagosQuerySchema` `.strict()`: CUID, fechas calendario, `desde ≤ hasta`, `pagina` entera positiva, `estado_pago` excluye forma/materia, sin `por_pagina` | 400 `VALIDACION` (con `detalles` = `flatten()`), 401, 403 `SIN_PERMISO`, 404 `ALUMNO_NO_ENCONTRADO` |
| `GET /api/pagos/historial/opciones?alumno_id=` | `pagos:leer` | `OpcionesHistorialPagosQuerySchema` `.strict()` | 400, 401, 403, 404 |
| Página `GET /alumnos/[id]/pagos` (y `/alumnos/[id]?tab=pagos`) | `exigirPermiso("pagos:leer")` + ficha solo Mesa/Gerente | — | redirige a `/sin-permiso` o `/login` |

El atajo «Registrar pago» abre `/pagos/registrar` (HU-I-10), que revalida su propio permiso `pagos:crear` y la operación al guardar.

### 3.2 Verificaciones

| Regla | Resultado |
|---|---|
| N.° 4 (route delgada) | ✅ La ruta valida, verifica permiso y llama al servicio. La única lógica en la ruta es calcular `puedeCrearPago` (rol + `tienePermiso("pagos:crear")`), que el servicio vuelve a combinar. Es aceptable |
| N.° 5 (`{ data, error }`) | ✅ |
| N.° 6 (Zod antes del servicio, 400 con `flatten()`) | ✅ (`respuestaDeValidacion`) |
| N.° 10 (RBAC granular) | ✅ `withPermission("pagos:leer")`; 403 para Profesor y Alumno |
| N.° 3 (aislamiento) | ✅ en lo nuevo: I compone con `obtenerClasesBasicas` (C), `obtenerNombresPersonal` (F), `obtenerAlumnosBasicos` (B), `listarInscripcionesDeAlumno` (C). La extensión de C (`estadoPago`, `vence_el`) vive en la fachada de C |
| N.° 7 (condición + mutación atómica) | **No aplica**: la HU es de solo lectura, no hay mutaciones ni bloqueos. Consultar no cambia pagos, inscripciones ni caja (verificado por el dev en `pago.historial.pg.test.ts`) |
| N.° 8 (registros nuevos) | **No aplica a escritura.** La lectura respeta la regla: muestra el valor **vigente** (con `CorreccionPago` y `AnulacionPago`) sin tocar el `Pago` original |
| N.° 1 | ✅ No hay borrados |
| Totales monetarios | ✅ `Prisma.Decimal` + `toFixed(2)`; la UI formatea con `BigInt` sin pasar por `float` |
| No expone caja | ✅ `caja_abierta` es interno; no viaja en la respuesta |

### 3.3 Snippets para comprobar el 403

Iniciá sesión con la cuenta indicada, abrí la consola del navegador (F12) **en una pestaña de la app** (`http://localhost:3000/...`) y pegá:

```js
// Con sesión de PROFESOR (profesor1@noctium.local) o ALUMNO (alumno01@noctium.local): esperado 403 en ambos
const alumnoId = "cmv6qumjs000oux3gj4erp0g7"; // Fernández, Sofía (base de desarrollo al 13/10/2026)
for (const url of [
  `/api/pagos/historial?alumno_id=${alumnoId}`,
  `/api/pagos/historial?alumno_id=${alumnoId}&estado_pago=RESERVADA`,
  `/api/pagos/historial/opciones?alumno_id=${alumnoId}`,
]) {
  const r = await fetch(url, { cache: "no-store" });
  console.log(r.status, url, await r.json());
}
```

```js
// Con sesión de GERENTE (gerente@noctium.local): esperado 200 y ningún item con puede_registrar_pago = true
const r = await fetch("/api/pagos/historial?alumno_id=cmv6qumjs000oux3gj4erp0g7&estado_pago=RESERVADA", { cache: "no-store" });
const j = await r.json();
console.log(r.status, j.data.items.length, j.data.items.some((i) => i.puede_registrar_pago));
```

```js
// Con sesión de MESA DE ENTRADA: validaciones (esperado 400, 400, 400 y 404)
for (const q of [
  "alumno_id=cmv6qumjs000oux3gj4erp0g7&estado_pago=PAGADA&materia_id=x",
  "alumno_id=cmv6qumjs000oux3gj4erp0g7&desde=2026-10-10&hasta=2026-10-01",
  "alumno_id=cmv6qumjs000oux3gj4erp0g7&por_pagina=50",
  "alumno_id=cl00000000000000000000000",
]) {
  const r = await fetch(`/api/pagos/historial?${q}`, { cache: "no-store" });
  console.log(r.status, q, (await r.json()).error);
}
```

Sin sesión (ventana de incógnito, en la URL de la app): `fetch("/api/pagos/historial?alumno_id=cmv6qumjs000oux3gj4erp0g7").then(r => console.log(r.status))` → 401.
Pantalla: con profesor, entrar a `/alumnos/cmv6qumjs000oux3gj4erp0g7/pagos` → `/sin-permiso`.

> Si resembrás la base, el id de Sofía cambia: buscalo en Prisma Studio (`alumnos`, DNI `40100001`) o tomalo de la URL de su ficha.

---

## 4. Definición de Terminado

| Punto | Resultado |
|---|---|
| Textos visibles en el archivo central | ✅ Todo pasa por `texto()` con claves `ui.pagos.historial.*`. `npx tsx scripts/verificar-claves-textos.ts` → «Claves de textos verificadas». Las fechas, montos y nombres son datos, no copy |
| Ningún texto visible con «turno» | ✅ Ninguna clave usada contiene «turno». Solo aparece en URLs (`/turnos/{id}`), que no son texto visible |
| Confirmación HU-C-25 en toda operación que guarda | **No aplica**: la HU no guarda nada. El atajo navega al wizard de HU-I-10, que tiene su propia confirmación. (En la pestaña Pagos también aparece el botón de baja/reactivación del alumno de HU-B-07, que usa su propio diálogo) |
| Tests en verde | ✅ Dirigidos: **8 archivos, 129/129** (`pago.historial`, `pago.schema`, `pago.service`, `pago.publico`, rutas `historial` y `opciones`, `historial-pagos.test.tsx`, `alumnos/[id]/page.test.tsx`). Suite completa: ver §4.1. ESLint de los archivos de la HU: sin errores. Los `.pg.test.ts` (`pago.historial.pg.test.ts`, `inscripcion.lecturas.pg.test.ts`) **no los corrí**: necesitan la base aislada en `127.0.0.1:55434` y `HU_PR0_TEST_DATABASE_URL`. El dev reporta 9/9 en su evidencia |

### 4.1 Suite completa

`npx vitest run` (con el working tree actual, que incluye los cambios sin commitear de HU-C-27): **305 archivos OK, 2 con falla, 62 omitidos; 4135 pruebas OK, 2 con falla**. Las dos fallas (`src/lib/claves-textos.test.ts` y `src/server/shared/errores-dominio.test.ts`) son **timeouts** (60 s y 5 s) por la carga de la corrida en paralelo, no aserciones. Corridas solas: **2 archivos, 49/49 OK**. No las causa esta HU.

**Incumplimientos de la DoD:** ninguno bloqueante. La leyenda no literal (§2) es el único punto de la DoD de textos que no se cumple al pie de la letra.

---

## 5. Extras y violaciones a RULES.md / DESIGN.md

### 5.1 Cosas implementadas que la HU no pide (aceptables)

- **Columna «Acción»** en el modo estado de pago. Para el gerente queda vacía.
- **La fecha de la clase en el modo estado de pago es un enlace** al detalle de la clase.
- **«Original: $ X»** junto al ajuste cuando el pago además fue corregido (dato de HU-I-06).
- **Campos contractuales para HU-I-06** en la respuesta: `puede_corregir`, `cambios`, `operacion.clases`, `registrado_en`. No se muestran.
- **El botón de baja/reactivación del alumno** (HU-B-07) aparece en el encabezado de la pestaña Pagos, junto al nombre.
- **El filtro también funciona en `/alumnos/[id]?tab=pagos`** y conserva los filtros en la URL (`replaceState`), así que se pueden compartir o recargar.
- **Mensajes de error con «Reintentar»** para el historial y para las opciones.
- **La extensión de C** (`listarInscripcionesDeAlumno` con `estadoPago` y `vence_el`) es aditiva y sin el filtro conserva el comportamiento anterior.

### 5.2 Violaciones u observaciones

| # | Observación | Referencia | Severidad |
|---|---|---|---|
| 1 | La leyenda del modo estado de pago no es el literal exacto: le agrega «El rango filtra por fecha de la clase.» | HU c4 / DoD textos | Menor (decide el PO si la acepta) |
| 2 | La paginación se muestra aunque haya una sola página (`siempreVisible`) | DESIGN §8.1 «Si hay una sola página, no se muestra el control» | Menor |
| 3 | «Anulado» es un `<span>` con `bg-muted`, no un `Badge` con el aspecto de «Cancelado» como el resto de los anulados del producto (caja, HU-I-12-b) | DESIGN §6.5/§6.6 (convención de etiquetas) | Menor/cosmética |
| 4 | **Datos del seed:** los 25 pagos de Sofía (fixtures de indicadores) tienen monto ≠ precio (p. ej. $ 3.800.000 cobrado contra $ 12.000 de precio) **sin `motivoAjuste`** (modo `compatSprint2`). La fila muestra el precio pero no la línea de ajuste. El código hace lo que dice la spec, pero en la demo parece un error del criterio 2 | Seed / HU c2 viñeta 1 | Menor (datos). Para probar el ajuste, crear un pago nuevo (ver §6.4) |
| 5 | Un rango inválido (Desde > Hasta) devuelve 400 y la pantalla muestra «No se pudo cargar el historial de pagos.» + «Reintentar», en lugar de explicar el error del rango | UX | Menor |
| 5b | En modo historial, «Pago desde» y «Pago hasta» aceptan fechas futuras (`<input type="date">` sin `max`, y el schema tampoco lo limita). No tiene sentido: una fecha de pago nunca es futura (HU-I-10, «La fecha de pago no puede ser futura»), así que el filtro solo puede devolver «No hay pagos para los filtros elegidos». Sugerencia: `max` = hoy en la zona del centro, **solo en modo historial**. En modo estado de pago el rango filtra por fecha de la clase y **sí** tiene que permitir fechas futuras (las reservadas son clases futuras) | UX / coherencia con HU-I-10 (observación del PO, 13/10/2026) | Menor |
| 6 | `tabla-historial-pagos.tsx` formatea fechas con `Intl` y la zona `America/Argentina/Buenos_Aires` escrita a mano, en lugar de una utilidad común de fechas del centro | Coherencia (RULES lo exige explícitamente solo en C-27) | Menor |
| 7 | En `pago.publico.ts`, un `import` quedó en el medio del archivo (después de `turnosConPagosVigentes`) | Estilo | Cosmética |
| 8 | Las claves `ui.pagos.historial.descripcion` y `leyendaPagos` no se usan | Higiene de textos | Cosmética |
| 9 | La task indica la rama `HU-F-02` (nombre equivocado de HU) y el commit de merge se llama `feature/HU-F-02`. Para la trazabilidad, el código de I-02 entró con ese nombre | Trazabilidad | Informativa |

No encontré violaciones a las Reglas N.° 1 a 11 en el código de la HU.

---

## 6. Datos para la prueba manual

### 6.1 Credenciales (contraseña de todas: `Password123!`)

| Rol | Cuenta | Para qué |
|---|---|---|
| Mesa de entrada | `mesa.entrada@noctium.local` (Marta Ruiz), **caja abierta por el seed** | Todos los criterios; atajo «Registrar pago» |
| Mesa de entrada | `mesa.entrada2@noctium.local` (Pablo Ferreyra), caja abierta | Registrar pagos con otro usuario (columna «Registrado por») |
| Gerente | `gerente@noctium.local` (Silvia Paredes) | c7: modo consulta, sin «Registrar pago»; desactivar una forma de pago (c3) |
| Profesor | `profesor1@noctium.local` | c7: 403 y `/sin-permiso` |
| Alumno | `alumno01@noctium.local` (= Fernández, Sofía) | c7: 403; c5: cancelar su propia inscripción pagada (HU-C-14) |

### 6.2 Alumnos y clases útiles (base de desarrollo al 13/10/2026 18:52)

| Alumno (DNI) | id | Qué tiene | Sirve para |
|---|---|---|---|
| **Fernández, Sofía** (40100001) | `cmv6qumjs000oux3gj4erp0g7` | **25 pagos** (3 páginas), todos Matemática y Transferencia, ninguno anulado. Último: `seed-turno-26` 12/10 10:00 ($ 24.000) | c1, c2 (orden y paginación: 10 + 10 + 5), c3 (fechas), c6 |
| Sofía, modo **Reservada** | — | `seed-turno-01` Matemática 14/10 08:00 (Completa), `seed-turno-04` Química 15/10 14:00 (Completa), `seed-turno-08` Bases de Datos 16/10 12:00, `seed-turno-14` Física 20/10 08:00, `seed-turno-29` Matemática 27/10 08:00, `seed-turno-12` Bases de Datos 28/10 10:00. **6 filas, todas con «Registrar pago»** | c4 Reservada, vencimiento, atajo |
| Sofía, modo **Pago sin registrar** | — | 4 clases **pasadas** de Matemática (02, 05, 06 y 07/10 11:00) → **sin** «Registrar pago»; 1 **futura**: Matemática 23/10 17:00 (`cmv6qutl700iwux3gfqhybjji`) → **con** «Registrar pago» | c4: el atajo solo aparece en clases que no empezaron |
| Sofía, modo **Pagada** | — | 25 clases pagadas (todas Disponibles) | c4 Pagada, paginación del modo estado |
| Sofía, casos que **no** deben aparecer | — | Clase **Cancelada** con inscripción vigente reservada: Matemática 16/10 15:00 (`cmv6qustf00hgux3gkx6ehvm2`). Inscripciones no vigentes: reserva vencida 16/10 14:00, cancelada por el alumno 16/10 16:00, baja 16/10 17:00, quitada 23/10 14:00 | c4: no aparecen en ningún estado |
| Martínez, Lucas (40100002), López, Valentina (40100003), Pérez, Joaquín (40100006), etc. | — | 1 pago cada uno (`seed-turno-26`/`27`) | Ver un historial corto (1 página) |
| Rojas, Abril (40100024) | — | **Sin pagos** | c6: «Este alumno no tiene pagos registrados». Si además tiene inscripciones vigentes, sirve para el modo estado |

> ⚠️ **Las reservas del seed vencen 24 h después de correrlo**: en esta base, el **14/10 cerca de las 10:56** (la de `seed-turno-01` vence al inicio de la clase, 14/10 08:00). Pasado ese momento, el modo «Reservada» de Sofía queda vacío («No hay clases con ese estado de pago en el período»). Eso también sirve para probar que una reserva vencida sin marcar no figura. Para volver a tenerlas: `npx prisma migrate reset` (resiembra, decisión ya tomada por el PO) o inscribir de nuevo desde la pantalla.

### 6.3 Cómo probar cada criterio

| Criterio | Pasos |
|---|---|
| 1 | Mesa → Alumnos → Sofía → pestaña «Pagos». Solo filtros + tabla «Historial de pagos» con «Total pagado». No hay resumen ni «Estado de cuenta» |
| 2 | Columnas Fecha / Clase (link → detalle de la clase) / Precio / Monto cobrado / Forma / Registrado por («Ruiz, Marta») / Comprobante (link → comprobante). Primera fila: 12/10/2026. Página 1 = 10 filas, página 3 = 5. Ajuste y anulado: preparar con §6.4 |
| 3 | «Pago desde» 01/01/2026 → menos filas, página 1, el total cambia. Forma: aparece solo «Transferencia» (más las que agregues). Materia: «Matemática» (más las que agregues). Combinar fecha + forma + materia. Desactivar «Transferencia» (gerente → Formas de pago) → sigue en el filtro de Sofía. «Limpiar filtros» → listado completo. Verificar que la URL cambia sin recargar (F5 conserva los filtros) |
| 4 | «Estado de pago» = Reservada → 6 clases con «Reservada · pagar antes del dd/mm/aaaa, hh:mm» y «Registrar pago». Forma y Materia quedan vacías y grises, con la leyenda. «Clase desde/hasta» filtra por fecha de la clase (p. ej. 15/10–20/10 → 3 filas). «Pago sin registrar» → 5 filas: solo la del 23/10 tiene el botón. «Registrar pago» → `/pagos/registrar` con Sofía y la clase ya elegidas. Volver a «Todos»: forma y materia no se restauran |
| 5 | Ver §6.4 (pago de una clase de la que fue quitada). En la respuesta del API (pestaña Network) no hay saldo ni deuda |
| 6 | Abril Rojas → «Este alumno no tiene pagos registrados». Sofía con «Pago desde» 01/01/2030 → «No hay pagos para los filtros elegidos». Sofía, estado «Reservada» con «Clase desde» 01/01/2030 → «No hay clases con ese estado de pago en el período» |
| 7 | Gerente: ve la pestaña, la leyenda «Modo consulta…», nunca «Registrar pago» (snippet de §3.3). Profesor y alumno: snippets de §3.3 → 403; `/alumnos/<id>/pagos` → `/sin-permiso`. Corregir/anular: **diferido a HU-I-06** |

### 6.4 Preparar los casos que el seed no trae (sin tocar código)

**a) Pago con importe distinto del precio (ajuste, c2 viñeta 1), otra materia y otra forma de pago (c3).**
Con `mesa.entrada@noctium.local` → «Registrar pago» → Sofía → marcar Química `seed-turno-04` y Bases de Datos `seed-turno-08` → en Química «Modificar importe» = `18000`, motivo «Beca parcial» → forma «Efectivo» → confirmar.
En la pestaña Pagos: la fila de Química muestra Precio $ 21.000, Monto $ 18.000 y «Ajuste: Beca parcial · Ruiz, Marta». El filtro Materia ahora ofrece Química y Bases de Datos, y el filtro Forma ofrece Efectivo. En modo «Pagada» aparecen esas dos clases (y salen de «Reservada»).
Para la columna «Registrado por» con otro usuario: repetir con `mesa.entrada2@noctium.local` en `seed-turno-14`.

**b) Pago de una clase de la que el alumno fue quitado o canceló (c5).**
Opción 1 (mesa): detalle de `seed-turno-08` → lista de alumnos → «Quitar» a Sofía → confirmar. El pago de Bases de Datos sigue en la pestaña Pagos y en el total; en modo «Pagada» esa clase ya no aparece (la inscripción no está vigente).
Opción 2 (alumno): `alumno01@noctium.local` → «Mis clases» → cancelar `seed-turno-14` ya pagada (si está dentro del plazo de cancelación).

**c) Pago anulado (c2 viñeta 2).** HU-I-06 todavía no tiene pantalla. Hay que usar el servicio de dominio con un script de una sola vez. Guardalo como `scripts/tmp-anular-pago.ts`, corrélo y **borralo después** (no lo commitees):

```ts
// Uso: npx tsx scripts/tmp-anular-pago.ts <pagoId> [emailActor] [motivo]
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { anularPago } from "../src/server/pagos/correccion.service";
import { transaccion } from "../src/server/shared/transaccion";

async function main() {
  const [pagoId, email = "gerente@noctium.local", motivo = "Prueba PO HU-I-02"] = process.argv.slice(2);
  if (!pagoId) throw new Error("Falta el id del pago");
  const u = await prisma.usuario.findUniqueOrThrow({
    where: { emailUsuario: email }, select: { idUsuario: true, rolUsuario: true },
  });
  const r = await transaccion((tx) => anularPago(tx, { pagoId, motivo, usuario: { id: u.idUsuario, rol: u.rolUsuario } }));
  console.log("Pago anulado. Anulación:", r.anulacionId, "· comprobante de reemplazo:", r.comprobante?.numero ?? "ninguno");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

Para el `pagoId`, usá un pago **recién registrado en el paso a)** (su caja sigue abierta, así no hace falta una caja para el ajuste). En Prisma Studio (`npx prisma studio`) → tabla `pagos` → filtrá por `alumnoId = cmv6qumjs000oux3gj4erp0g7` y ordená por `createdAtPago` descendente. Copiá `idPago` de la fila de Bases de Datos.
Resultado esperado: la fila aparece atenuada, con el monto tachado y «Anulado»; el «Total pagado» baja en ese monto; el comprobante enlaza al último que lo incluyó; la clase vuelve a «Reservada» con un plazo nuevo (o a «Pago sin registrar»), según HU-C-24 c5. El servicio respeta la Regla N.° 8: crea una fila en `anulaciones_pago` y no modifica `pagos`.

**d) Forma de pago inactiva usada (c3).** Gerente → «Formas de pago» → desactivar «Transferencia» (motivo obligatorio porque tiene pagos) → en la pestaña Pagos de Sofía, «Transferencia» sigue en el filtro y filtra bien. **Reactivarla después** (si no, HU-I-10 deja de ofrecerla).

**e) Reserva por vencer / vencida sin marcar (c4).** Las reservas del seed vencen el 14/10 cerca de las 10:56. Para ver una vencida sin marcar, esperá ese horario sin correr el proceso de vencimiento: Sofía desaparece de «Reservada» aunque en Prisma Studio la fila siga con `vigencia = VIGENTE` y `estadoPago = RESERVADA`. Si querés forzarlo antes, en Prisma Studio editá `turno_alumno.venceEl` de **una** de sus reservas (p. ej. la de `seed-turno-29`) a una hora pasada. Es solo un dato de prueba en la base de desarrollo; resembrá al terminar.

**f) Alumno sin pagos con inscripciones (c6 + c4).** Abril Rojas: con mesa de entrada, inscribila en una clase futura desde el detalle de la clase: en «Pagos» sigue diciendo «Este alumno no tiene pagos registrados» y en el modo «Reservada» aparece la clase.

---

## 7. Veredicto preliminar

### **Lista para prueba manual**

**Bloqueantes:** ninguno.

**A resolver o aceptar en la prueba (no bloquean):**
1. La leyenda del modo estado de pago no es el literal exacto (le sobra «El rango filtra por fecha de la clase.»). Si el PO exige literalidad, es un cambio de una línea en `textos.ts`.
2. La paginación se muestra con una sola página (DESIGN §8.1).
3. «Anulado» no usa el `Badge` con el aspecto de «Cancelado».
4. Los datos del seed tienen importes distintos del precio sin motivo: para probar el ajuste, usar un pago nuevo (§6.4 a).
5. En modo historial, los filtros «Pago desde/hasta» dejan elegir fechas futuras, que nunca pueden tener pagos. Deberían tener como máximo la fecha de hoy, pero solo en ese modo: en estado de pago las fechas son de clases y tienen que admitir el futuro (§5.2 #5b).
6. Verificación diferida: corregir/anular del gerente (c7) cuando esté HU-I-06. Los anulados se pueden probar desde ya con el script de §6.4 c.
