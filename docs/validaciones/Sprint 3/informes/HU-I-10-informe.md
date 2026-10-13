# Informe de validación — HU-I-10 · Registrar pago buscando al alumno

**Fecha:** 13/10/2026 · **Rama:** `develop` (`1f503e9`) · **Rol:** asistente del PO (validación previa a la prueba manual)
**Fuente de verdad:** el texto de la HU entregado por el PO. Se contrastó contra `docs/tasks/Sprint 3/Modulo I/HU-I-10.md`, `docs/specs/spec_modulo_I.md` §2.6–2.8, `docs/RULES.md`, `docs/DESIGN.md` y `prisma/seed.ts`.
**No se modificó código, tests, schema ni seed.** Las consultas a la base de desarrollo fueron solo de lectura (`SELECT`).

---

## 0. Resumen

| | |
|---|---|
| **Veredicto preliminar** | **Volver al dev** (1 bloqueante) |
| **Bloqueante** | El botón «Registrar pago» del detalle de la clase (modal viejo de HU-I-01) sigue en pantalla: no abre el flujo nuevo, se ofrece también en clases que ya empezaron, admite pagos parciales y montos distintos del precio sin motivo, y guarda sin la confirmación de HU-C-25 (criterios 3, 9 y Definición de Terminado) |
| **Observaciones no bloqueantes** | «Usar el precio» quedó como «Usar el precio de la clase» · algunos textos visibles sin centralizar · `claves-textos.test.ts` vence por tiempo (la verificación por CLI pasa) · otras menores (ver §5) |
| **Tests** | 227/227 de la HU, 33/33 con PostgreSQL. Suite completa: 4096 en verde y 1 que vence por tiempo, ajeno a la HU |

El flujo nuevo (`/pagos/registrar` + los 3 endpoints) cumple los criterios 1 a 8 y 10. El problema está en el **punto de entrada viejo**, que la task dejó fuera de alcance «hasta que se integre HU-C-24». HU-C-24 ya está integrada (los enlaces por inscripto llevan al flujo nuevo), pero el modal viejo no se retiró.

---

## 1. Tabla de trazabilidad

Referencias de archivos relativas a la raíz del repo. `RPW` = `src/app/(dashboard)/pagos/registrar/registrar-pago-wizard.tsx`.

### Criterio 1 — Menú «Registrar pago» abre un flujo de 3 pasos

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Opción del menú | `src/components/layout/Sidebar.tsx:77` (solo en `MESA_ENTRADA`) → `/pagos/registrar` | CUBIERTO | Texto `ui.turnos.reserva.registrarPago` = «Registrar pago» |
| Alumno → Clases → Confirmación | `progreso-registrar-pago.tsx` (stepper), `RPW` (estado `paso` 1/2/3), `page.tsx` | CUBIERTO | Pasos `ui.pagos.pasos.*`: «Alumno», «Clases», «Confirmación» |

### Criterio 2 — Paso 1: buscar alumno

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Buscador por nombre, apellido o DNI | `paso-buscar-alumno.tsx` → `BuscadorAlumnos` (`turnos/buscador-alumnos.tsx`) con `endpoint="/api/pagos/buscar-alumnos"` | CUBIERTO | |
| Desde 2 caracteres | Cliente: `buscador-alumnos.tsx:32` (`length >= 2`, espera de 250 ms). Servidor: `BuscarAlumnosCobroQuerySchema` (`pago.schema.ts:36`, `min(2)`) | CUBIERTO | Doble control |
| Sin mayúsculas ni acentos (HU-B-05) | `buscarAlumnosParaCobro` → `buscarAlumnosActivos` → `construirFiltroBusquedaAlumno` (`alumno.service.ts:186`) | CUBIERTO | Mismo filtro que HU-B-05 (varias palabras en cualquier orden) |
| Solo alumnos activos | `alumno.service.ts:190` (`activoAlumno: true`, `take: 10`) | CUBIERTO | |

### Criterio 3 — Paso 2: clases del alumno

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Disponibles/Completas, inscripto, sin pago, ordenadas por fecha | `GET /api/pagos/pendientes` → `listarClasesPendientesDePago` (`pago.service.ts:119`) → `listarInscripcionesPendientesDePagoDeAlumno` (`inscripcion.lecturas.ts:168`) | CUBIERTO | `vigencia VIGENTE`, `estadoPago ≠ PAGADA`, `DISPONIBLE/COMPLETO`, orden fecha + hora |
| Columnas fecha, hora, materia, profesor, estado de pago | `paso-clases-alumno.tsx:69-74`, `estado-pago-badge.tsx` | CUBIERTO | |
| «Reservada · pagar antes del <fecha y hora>» / «Pago sin registrar» | `estado-pago-badge.tsx:17-23` | CUBIERTO | La fecha sale como «Mié 14/10 10:56» (con día abreviado) |
| – Clases que ya empezaron no se listan | `inscripcion.lecturas.ts:189` (`inicioDeTurno > momento`) | CUBIERTO | |
| – Clases con pago no se listan | `inscripcion.lecturas.ts:175` | CUBIERTO | En el flujo nuevo |
| – Sin pendientes: mensaje + buscar otro alumno | `paso-clases-alumno.tsx:42-43` y botón «Buscar otro alumno» (línea 40) | CUBIERTO | |
| – Deja sin efecto los pagos parciales de HU-I-01 | Flujo nuevo: `operacion.service.ts:145` (`INSCRIPCION_YA_PAGADA` en modo `completo`) | **PARCIAL / DESVÍO** | En el flujo nuevo, sí. Pero el modal viejo del detalle de la clase (`turnos/[id]/registrar-pago-dialog.tsx` → `POST /api/pagos`, modo `compatSprint2`) **sigue permitiendo un segundo pago de la misma inscripción** desde la interfaz. Ver criterio 9 |
| – Reservas vencidas sin marcar no se listan | `inscripcion.lecturas.ts:189` (`esVigenteEn(…, momento)`) | CUBIERTO | |
| – «Se inscribe al confirmar el pago» (excepción HU-C-24 c3) | `pago.service.ts:132-186` (`claseQueSeInscribeAlPagar`, `exigeInscripcionConPago`), enlace desde `turnos/[id]/turno-alumnos-card.tsx:197` | CUBIERTO | La fila viene marcada, con `estado_pago = SE_INSCRIBE_AL_PAGAR` |

### Criterio 4 — Selección de clases e importes

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Una casilla por clase, al menos una | `paso-clases-alumno.tsx:65`, `RPW:87-90`, `ui.pagos.clases.ningunaElegida` | CUBIERTO | El servidor también: `.min(1, "Elegí al menos una clase")` |
| Importe precargado = precio de la inscripción | `seleccion-clases.ts:25-29`; `origen_precio: "INSCRIPCION"` → «Fijado al inscribirse» | CUBIERTO | El body no lleva precio: el servidor lo lee de la inscripción (`operacion.service.ts:146`) |
| Inscripción creada al pagar: tarifa vigente × duración, indicando el origen | `pago.service.ts:170-183` (`precioClase`), «Tarifa vigente» | CUBIERTO | |
| «Modificar importe»: positivo + motivo obligatorio ≤ 300 | `seleccion-clases.ts:32-61`, `paso-clases-alumno.tsx:80-96` (`maxLength={300}`); servidor `montoSchema`/`motivoSchema` + `MOTIVO_AJUSTE_REQUERIDO` (`operacion.service.ts:150`) | CUBIERTO | |
| «Usar el precio» vuelve al precargado | `paso-clases-alumno.tsx:92-95` | CUBIERTO (texto distinto) | Dice «Usar el precio de la clase» (ver §2) |
| El gerente no registra pagos | `withPermission("pagos:crear")` + `exigirPermiso` en `page.tsx:8` | CUBIERTO | |
| Total recalculado al marcar/desmarcar/cambiar importe | `seleccion-clases.ts:45` (`totalElegido`), pie de tabla y resumen lateral | CUBIERTO | Tests en `seleccion-clases.test.ts` y en el wizard |

### Criterio 5 — Forma y fecha de pago

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Forma activa, una para toda la operación | `paso-confirmacion.tsx:62-71`, `listarFormasPagoActivas` | CUBIERTO | |
| Por defecto la preferida, si está activa | `pago.service.ts:141` (`null` si está inactiva), `RPW:64` | CUBIERTO | |
| Fecha por defecto hoy, no futura | `RPW:44` (`hoyEnZonaCentro`), `paso-confirmacion.tsx:50,74` (`max={hoy}`); servidor `FECHA_PAGO_FUTURA` (`operacion.service.ts:169`) | CUBIERTO | |
| – Repartir entre formas no es parte de la HU | — | CUBIERTO | No se implementó (correcto) |

### Criterio 6 — Confirmación de HU-C-25

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| «¿Estás seguro de que querés registrar el pago de <total> a nombre de <Alumno>?» | `paso-confirmacion.tsx:87-100` (`ConfirmarAccionDialog`, `confirmaciones.pagos.registrarOperacion`) | CUBIERTO | Componente común de HU-C-25 |
| Detalle de clases (e importes distintos del precio), forma y fecha | `paso-confirmacion.tsx:90-93` (`DetalleClases` + `ui.pagos.confirmacion.formaYFecha`) | CUBIERTO | Observación: muestra el importe cobrado y «Motivo: …», pero no el precio original al lado del importe modificado |
| Botones «Registrar pago» y «Volver» | `textoConfirmar = ui.pagos.acciones.registrar`; «Volver» lo pone el componente de HU-C-25 | CUBIERTO | |

### Criterio 7 — Registro atómico y revalidación

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Un pago por clase, misma operación (forma y fecha) | `operacion.service.ts:177-195` | CUBIERTO | `OperacionPago` + un `Pago` por ítem, con `operacionId` |
| Precio e importe; si difieren, motivo y usuario | `operacion.service.ts:183-190` (`motivoAjuste`, `ajustadoPorUsuarioId`) | CUBIERTO | |
| Única transacción, todo o nada | `registrarOperacionDePago` (`pago.service.ts:194`) envuelve todo en `transaccion()` | CUBIERTO | Probado con PostgreSQL (`pago.operacion.pg.test.ts`) |
| Inscripciones bloqueadas (Regla N.° 7) | `operacion.service.ts:101-106` (`bloquear`: alumno → clases → inscripciones → caja) | CUBIERTO | Bloqueo pesimista canónico del PR 0 (`FOR UPDATE`), aceptado en RULES/PR-0 |
| Sigue inscripto / reserva no vencida / clase no empezada / sin pago no anulado | `operacion.service.ts:137-145` | CUBIERTO | Orden de la spec: empezó → vencida → vigente → ya pagada |
| Mensaje «La clase de <Materia> del <fecha> ya empezó…» e indicación de la clase | `errores.pago.turnoYaEmpezo` + `detalles { turno_id, materia, fecha }` | CUBIERTO | |
| Vencimiento contra el momento de registro, no la fecha de pago | `operacion.service.ts:81` (`momento = ahora()` una vez) | CUBIERTO | |
| «Se inscribe…»: cupo y superposición, inscripción creada ya Pagada en la misma transacción | `operacion.service.ts:129-135` (`crearInscripcion(…, origen: "PAGO")`) | CUBIERTO | Los errores de cupo/superposición identifican la clase (línea 155) |
| Cada reserva pagada pasa a «Pagada» | `operacion.service.ts:193` (`marcarPagada`) | CUBIERTO | |

### Criterio 8 — Mensaje de éxito y comprobante

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| «Pago registrado correctamente (<N> clases)» | `RPW:129-145` (banner inline, `ui.pagos.registrado.una/varias`) | CUBIERTO | Singular «(1 clase)» |
| Ofrece ver el comprobante (HU-I-11) | `RPW:135-140` → `/comprobantes/[id]` (la ruta existe) | CUBIERTO | La task decía que se omitía; después se agregó al integrarse HU-I-11 |
| Las clases no elegidas quedan como estaban | Solo se procesan los ítems enviados | CUBIERTO | |

### Criterio 9 — Atajo desde el detalle de la clase y permisos

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Atajo por inscripto (Reservada no vencida / Pago sin registrar, clase sin empezar) que abre este flujo con la clase marcada | `turnos/[id]/turno-alumnos-card.tsx:132-134` (`puede_registrar_pago`, `turno.detalle.ts:56-76`) → `/pagos/registrar?alumno=&clase=` | CUBIERTO | Vino con HU-C-24 |
| El botón «Registrar pago» del detalle de la clase (HU-I-01) **se mantiene como atajo de este mismo flujo, solo en clases sin empezar** | `turnos/[id]/turno-detalle.tsx:72-77` → `RegistrarPagoDialog` → `POST /api/pagos` (modo `compatSprint2`) | **NO CUMPLE / DESVÍO** | El botón viejo sigue en la tarjeta «Pago». **No** abre el flujo nuevo: abre el modal de Sprint 2. Se habilita con `registrar_pago` (`turno.acciones.ts:68`), que **no mira si la clase empezó**. El modal admite clase iniciada, segundo pago de la misma inscripción y monto distinto sin motivo, y guarda **sin** `ConfirmarAccionDialog`. La task lo dejó fuera de alcance «hasta HU-C-24», pero HU-C-24 ya está integrada |
| Solo mesa de entrada; 403 a otros roles | `withPermission("pagos:crear")` en los 3 endpoints; `exigirPermiso` en la página; `rutas-por-rol.ts:23` + `proxy.ts:77` | CUBIERTO | Bug B-2 del PO ya corregido (`page.test.tsx`) |

### Criterio 10 — Caja

| Punto | Dónde | Estado | Justificación |
|---|---|---|---|
| Hace falta la caja abierta | `operacion.service.ts:86, 172-174` (`CAJA_NO_ABIERTA`, revalidada con la caja bloqueada) | CUBIERTO | El diálogo ofrece «Abrir caja» (`paso-confirmacion.tsx:96`) |
| El pago queda en esa caja | `operacion.service.ts:178` (`cajaId` en la operación) | CUBIERTO | |

---

## 2. Textos literales (archivo central `src/lib/textos.ts`)

| Texto de la HU | Clave | Texto en el código | ¿Coincide? |
|---|---|---|---|
| «Registrar pago» (menú) | `ui.turnos.reserva.registrarPago` | Registrar pago | ✅ |
| Alumno → Clases → Confirmación | `ui.pagos.pasos.*` | Alumno / Clases / Confirmación | ✅ |
| «Reservada · pagar antes del <fecha y hora>» | `ui.pagos.estado.reservada` | Reservada · pagar antes del {vence} | ✅ (formato «Mié 14/10 10:56») |
| «Pago sin registrar» | `ui.pagos.estado.pagoSinRegistrar` | Pago sin registrar | ✅ |
| «Este alumno no tiene clases pendientes de pago» | `ui.pagos.sinClasesPendientes` | igual | ✅ |
| «Se inscribe al confirmar el pago» | `ui.pagos.estado.seInscribeAlPagar` | igual | ✅ |
| «Modificar importe» | `ui.pagos.importe.modificar` | igual | ✅ |
| **«Usar el precio»** | `ui.pagos.importe.usarPrecio` | **Usar el precio de la clase** | ❌ |
| «¿Estás seguro de que querés registrar el pago de <total> a nombre de <Alumno>?» | `confirmaciones.pagos.registrarOperacion` | igual, con `{total}` y `{alumno}` | ✅ |
| «Registrar pago» / «Volver» (confirmación) | `ui.pagos.acciones.registrar` / `TEXTO_VOLVER` del componente de C-25 | Registrar pago / Volver | ✅ |
| «La clase de <Materia> del <fecha> ya empezó: el pago se hace antes de la clase.» | `errores.pago.turnoYaEmpezo` | La clase de {materia} del {fecha_dia} ya empezó: el pago se hace antes de la clase. | ✅ (fecha dd/mm/aaaa) |
| «Pago registrado correctamente (<N> clases)» | `ui.pagos.registrado.varias` / `.una` | Pago registrado correctamente ({n} clases) / (1 clase) | ✅ |

**No coincide palabra por palabra:** solo «Usar el precio» → «Usar el precio de la clase». No es bloqueante; el PO decide si lo acepta o pide el texto exacto.

---

## 3. Reglas de servidor

### 3.1 Endpoints

| Método y ruta | Permiso | Validación (Regla N.° 6) | Notas |
|---|---|---|---|
| `GET /api/pagos/buscar-alumnos?q=` | `pagos:crear` | `BuscarAlumnosCobroQuerySchema` (`.strict()`, `min(2)`) → 400 `VALIDACION` | Solo lectura |
| `GET /api/pagos/pendientes?alumno_id=&turno_id=` | `pagos:crear` | `PendientesQuerySchema` (`.strict()`, `cuid`) | 404 `ALUMNO_NO_ENCONTRADO`; con `turno_id`: 404/409/422 según §2.7.2 |
| `POST /api/pagos/operaciones` | `pagos:crear` | `RegistrarOperacionSchema` (`.strict()`, ítems 1..50, sin repetidos, `inscripcion_id` XOR `turno_id`) | 201 con operación, pagos y comprobante; errores de §2.7.6 con `detalles` |
| `GET /pagos/registrar` (página) | `exigirPermiso("pagos:crear")` | — | Otro rol → redirige a `/sin-permiso` |
| *(viejo)* `POST /api/pagos` | `pagos:crear` | `RegistrarPagoSchema` | Modo `compatSprint2`: es el que usa el modal viejo (ver bloqueante) |

### 3.2 Verificaciones

| Regla | Resultado |
|---|---|
| **Permisos / 403** | ✅ Los 3 endpoints usan `withPermission("pagos:crear")`; solo `MESA_ENTRADA` tiene el permiso (`seed.ts:911`). Gerente, profesor y alumno → `403 SIN_PERMISO` |
| **Transacción única** | ✅ `registrarOperacionDePago` → `transaccion()` → `registrarOperacion(tx, …)`; todo o nada (probado con PostgreSQL) |
| **Bloqueos (Regla N.° 7)** | ✅ Una sola llamada a `bloquear` en orden canónico (alumno → clases → inscripciones → caja). La revalidación (vigencia, pagos no anulados, caja) se lee **después** del bloqueo. Cupo y superposición, por `crearInscripcion` con los bloqueos ya tomados |
| **Registros nuevos (Regla N.° 8)** | ✅ Solo `create` sobre `OperacionPago` y `Pago`; ningún `update`/`delete` de `Pago`. El único `UPDATE` es el estado de la inscripción (`marcarPagada`), que no es un hecho consumado |
| **Respuesta `{ data, error }` (Regla N.° 5)** | ✅ `respuesta-error.ts`. Observación: el código de validación es `VALIDACION`, mientras otros módulos usan `VALIDATION_ERROR` |
| **Capa delgada (Regla N.° 4)** | ✅ Las rutas solo validan, delegan y traducen |

### 3.3 Snippets para comprobar el 403

Iniciá sesión en otra ventana con `gerente@noctium.local` (o `profesor1@noctium.local` / `alumno01@noctium.local`), contraseña `Password123!`, abrí la consola (F12) en cualquier página de la app y pegá:

```js
// 1) Paso 1 — buscar alumnos
fetch('/api/pagos/buscar-alumnos?q=fe')
  .then(r => r.json().then(b => console.log('buscar-alumnos', r.status, b)));

// 2) Paso 2 — clases pendientes (el id puede ser cualquiera: el permiso se verifica antes)
fetch('/api/pagos/pendientes?alumno_id=cmv6qumjs000oux3gj4erp0g7')
  .then(r => r.json().then(b => console.log('pendientes', r.status, b)));

// 3) Paso 3 — registrar la operación
fetch('/api/pagos/operaciones', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    alumno_id: 'cmv6qumjs000oux3gj4erp0g7',
    items: [{ inscripcion_id: 'cmv6qvsqu0288ux3g4u6yhto7', monto: '24000' }],
    forma_pago_id: 'formapago-efectivo'
  })
}).then(r => r.json().then(b => console.log('operaciones', r.status, b)));

// 4) Endpoint viejo del modal (HU-I-01)
fetch('/api/pagos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ turno_id: 'seed-turno-14', alumno_id: 'cmv6qumjs000oux3gj4erp0g7', monto: '24000', forma_pago_id: 'formapago-efectivo' })
}).then(r => r.json().then(b => console.log('POST /api/pagos', r.status, b)));
```

**Esperado en los 4:** `403` con `error.code = "SIN_PERMISO"`. Los ids son los de la base de desarrollo de hoy (Sofía Fernández y su inscripción en `seed-turno-14`). Si resembrás cambian, pero para el 403 da igual: el permiso se rechaza antes de mirar el cuerpo.

Además, con esos roles, entrar a `http://localhost:3000/pagos/registrar` tiene que redirigir a `/sin-permiso`.

---

## 4. Definición de Terminado

| Ítem | Estado | Incumplimientos |
|---|---|---|
| Textos visibles en el archivo central | ⚠️ Casi | (a) `RPW:24` `MENSAJE_ERROR_GENERICO` en el código («No se pudo completar la acción. Intentá nuevamente.»: el mismo texto ya existe en `textos.ts` con otra clave). (b) `turnos/buscador-alumnos.tsx`, que el paso 1 reutiliza: el placeholder «Nombre, apellido o DNI (mínimo 2 caracteres)» y «No se pudo buscar alumnos» están en el código (componente de HU-C-04). (c) `respuesta-error.ts`: «Parámetros inválidos» / «Datos inválidos», y los mensajes Zod de `pago.schema.ts` en el código; se ven en el diálogo si falla la validación. (d) «Volver» de `ConfirmarAccionDialog` en el código (componente de HU-C-25, no de esta HU) |
| Ningún texto visible con «turno» | ✅ | No hay textos visibles con «turno» en el flujo (solo nombres de clave e identificadores) |
| Confirmación con el componente común de HU-C-25 en toda operación que guarda | ❌ | El flujo nuevo sí la usa. **El modal viejo del detalle de la clase registra pagos sin `ConfirmarAccionDialog`** (bloqueante) |
| Tests en verde | ⚠️ | HU: 14 archivos, **227/227**. PostgreSQL (`pago.operacion`, `operacion.service`, `pago.service`, `inscripcion.lecturas`): **33/33**. Suite completa: **4096 en verde, 1 falla** (`src/lib/claves-textos.test.ts`, vence a los 60 s también corrido solo). La misma verificación por CLI (`npx tsx scripts/verificar-claves-textos.ts`) responde «Claves de textos verificadas» en 20 s: es de rendimiento, no un texto faltante, y no es de esta HU |

---

## 5. Extras y violaciones a RULES.md / DESIGN.md

### 5.1 Cosas implementadas que la HU no pide (aceptables)

- Resumen lateral (alumno con DNI, cantidad de clases y total) en los 3 pasos.
- Botón intermedio «Confirmar pago» en el paso 3 antes del diálogo, y «Continuar a confirmación» en el paso 2.
- Aviso DEC-28 «La tarifa de <Materia> cambió. Revisá el importe.» con recarga del precio sin cerrar el diálogo.
- Enlace «Abrir caja» dentro del diálogo cuando falta la caja (HU-I-12).
- Etiqueta del origen del precio y migas «Clases › Registrar pago».
- Clave muerta `ui.pagos.importe.precio` («Precio de la clase: {precio}») que no se usa.

### 5.2 Violaciones u observaciones

| # | Regla | Detalle | Gravedad |
|---|---|---|---|
| 1 | HU c9 + DoD C-25 | Modal viejo `RegistrarPagoDialog` en `turno-detalle.tsx:72` (ver §1 c9) | **Bloqueante** |
| 2 | DESIGN §6.4 | Siguen documentados «Registrar pago (HU-I-01) · `Dialog` · Toast» (línea 249) y el modal en la fila de HU-I-12 (línea 293). Hay que actualizarlos cuando se retire el modal | Menor (documental) |
| 3 | RULES N.° 11 | `RPW` y `paso-buscar-alumno.tsx` importan `../../turnos/buscador-alumnos` con ruta relativa desde otra ruta de `app/`. Un componente compartido entre pantallas debería estar en `src/components/` | Menor |
| 4 | RULES N.° 3 | `operacion.service.ts:88,137` (Módulo I) lee `tx.turnoAlumno` directo, que es una tabla de C. Es código del PR 0, no de esta task, pero la HU depende de él | Observación (fuera del alcance de la HU) |
| 5 | RULES N.° 5 | Código de validación `VALIDACION` en lugar del `VALIDATION_ERROR` de otros módulos | Menor |
| 6 | UX | Si se entra con `?clase=` de una clase ya pagada o ya empezada, el paso 2 muestra solo el error y «Buscar otro alumno», sin la lista de las demás clases pendientes del alumno | Menor |
| 7 | HU c6 | La confirmación muestra el importe cobrado y el motivo, no el precio original al lado | Menor |

Colores: sin hex ni paleta default de Tailwind. Las etiquetas usan las variantes de DESIGN §6.6 (`warning`/`outline`/`accent`) y el banner, `bg-success`. ✅

---

## 6. Datos para la prueba manual

### 6.1 Credenciales (contraseña de todas: `Password123!`)

| Rol | Cuenta | Para qué |
|---|---|---|
| Mesa de entrada | `mesa.entrada@noctium.local` (Marta Ruiz) — **caja abierta por el seed** | Flujo completo |
| Mesa de entrada | `mesa.entrada2@noctium.local` (Pablo Ferreyra) — caja abierta | Criterio 10 (cerrarla) y concurrencia |
| Gerente | `gerente@noctium.local` | 403 y `/sin-permiso`; desactivar una forma de pago |
| Profesor / Alumno | `profesor1@noctium.local` / `alumno01@noctium.local` | 403 |

### 6.2 Alumnos y clases útiles (base de desarrollo al 13/10/2026 11:42)

> ⚠️ **Las reservas del seed vencen 24 h después de correrlo.** En la base actual vencen el **14/10 alrededor de las 10:56**. Si probás después, primero resembrá (`npx prisma migrate reset`, decisión ya tomada por el PO) o las reservas no van a aparecer (lo cual igual sirve para probar la viñeta de reservas vencidas).

| Alumno (DNI) | Preferida | Clases pendientes (futuras) | Sirve para |
|---|---|---|---|
| **Fernández, Sofía** (40100001) | Efectivo | Reservadas: Matemática `seed-turno-01` 14/10 08:00 ($ 24.000), Química `seed-turno-04` 15/10 14:00 ($ 21.000), Bases de Datos `seed-turno-08` 16/10 12:00 ($ 22.000), Física `seed-turno-14` 20/10 08:00 ($ 24.000), `seed-turno-29`, `seed-turno-12`. **Pago sin registrar:** Matemática 23/10 17:00 ($ 12.000) | c3 (los dos estados y el orden), c4, c6, c7, c8 |
| Martínez, Lucas (40100002) | Transferencia | 8 reservadas (`seed-turno-01/04/08/13/14/24/29/12`) | c5 con la preferida desactivada; concurrencia |
| Pérez, Joaquín (40100006) | **Sin preferencia** | 7 reservadas | c5: arranca en «Elegí una forma de pago» |
| Rojas, Abril (40100024) | Sin preferencia | **Ninguna** | c3: «Este alumno no tiene clases pendientes de pago» |
| Paz, Bruno | — | Alumno **inactivo** | c2: no aparece en el buscador |
| Sofía + clase `cmv6quso100h8ux3gu5bdfleo` (Matemática 16/10 14:00, su reserva venció) | — | — | c3 última viñeta y c7: «Se inscribe al confirmar el pago» |

Búsquedas para c2: `fe`, `FERNÁNDEZ`, `fernandez sofia`, `sofia fernandez`, `40100001`; `f` sola no busca.

### 6.3 Cómo probar cada criterio

| Criterio | Pasos |
|---|---|
| 1 | Mesa de entrada → menú «Registrar pago» → stepper Paso 1 Alumno · Paso 2 Clases · Paso 3 Confirmación |
| 2 | Búsquedas de 6.2; con 1 carácter no busca; Bruno Paz no aparece |
| 3 | Sofía: lista ordenada por fecha con «Reservada · pagar antes del …» y una «Pago sin registrar». Abril Rojas: mensaje + «Buscar otro alumno». Para clases ya pagadas: pagá una de Sofía y volvé a buscarla: no aparece |
| 4 | Marcar y desmarcar (el total cambia). «Modificar importe» en Física: `0`, `-5`, `12000.555` → error; `20000` sin motivo → «Ingresá el motivo del cambio de importe.»; motivo de más de 300 no entra. «Usar el precio de la clase» vuelve a $ 24.000. Sin marcar nada → «Elegí al menos una clase.» |
| 5 | Sofía arranca en Efectivo; Joaquín en «Elegí una forma de pago». Fecha mañana → «La fecha de pago no puede ser futura.» Preferida inactiva: gerente → Formas de pago → desactivar «Transferencia» → Lucas sin preselección (reactivarla después) |
| 6 | «Confirmar pago» → diálogo con el título literal, la tabla, el motivo si cambió el importe, «<forma> · fecha de pago dd/mm/aaaa». «Volver» conserva todo |
| 7 | Ver 6.4 (concurrencia, reserva que vence en el medio, clase que empieza en el medio, «Se inscribe…»). En Prisma Studio, después de pagar: una fila en `operaciones_pago`, N en `pagos` con el mismo `operacionId`, `turno_alumno.estadoPago = PAGADA`, y `motivoAjuste`/`ajustadoPorUsuarioId` solo en el pago con otro importe |
| 8 | Banner «Pago registrado correctamente (2 clases)» (o «(1 clase)») + «Ver comprobante». Las no elegidas siguen pendientes |
| 9 | Detalle de `seed-turno-14` → en la lista de alumnos, «Registrar pago» de Sofía → abre el wizard con la clase marcada. **Verificar el bloqueante:** en la tarjeta «Pago» de la misma clase está el botón «Registrar pago» viejo, que abre un modal distinto y guarda sin la confirmación de C-25. Gerente: snippets de §3.3 y `/pagos/registrar` → `/sin-permiso` |
| 10 | `mesa.entrada2` → «Mi caja» → declarar el efectivo y cerrar → intentar un pago → «No se puede registrar un cobro hasta que abras una caja.» + «Abrir caja» |

### 6.4 Preparar los casos que el seed no trae (sin tocar código)

Todos con `psql` dentro del contenedor (cambiá los ids por los de tu base si resembraste):

```bash
docker exec -it noctium_db psql -U noctium -d noctium_dev
```

**A. Reserva que vence entre el paso 2 y la confirmación** (c3 viñeta de vencidas y c7 «ninguna reserva haya vencido»): dejá la reserva de Lucas en Programación I (`seed-turno-13`) venciendo en 3 minutos. Las columnas guardan UTC:

```sql
UPDATE turno_alumno
SET "venceBaseEl" = (now() AT TIME ZONE 'UTC') + interval '3 minutes',
    "venceEl"     = (now() AT TIME ZONE 'UTC') + interval '3 minutes'
WHERE "turnoId" = 'seed-turno-13' AND vigencia = 'VIGENTE' AND "estadoPago" = 'RESERVADA'
  AND "alumnoId" = (SELECT "idAlumno" FROM alumnos WHERE "dniAlumno" = '40100002');
```

Abrí el flujo de Lucas, elegí esa clase, llegá al diálogo, esperá 3 minutos y confirmá → «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.», y no se registra ninguna clase de la operación. Volvé a buscarlo: esa clase ya no aparece.

**B. Clase que empieza durante el flujo** (c7 «ya empezó»): mové `seed-turno-30` (un solo inscripto: Benítez, Agustina, DNI 40100013) a hoy, 4 minutos más tarde:

```sql
UPDATE turnos
SET "fechaTurno" = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
    "horaInicioTurno" = ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '4 minutes')::time(0)
WHERE "idTurno" = 'seed-turno-30';
```

Llegá al diálogo con esa clase y otra, esperá a que pase la hora y confirmá → «La clase de Matemática del dd/mm/aaaa ya empezó: el pago se hace antes de la clase.», sin registrar nada. ⚠️ Esto deja desfasada la proyección de horarios de esa clase: resembrá después.

**C. Concurrencia** (c7, «ninguna clase tenga ya un pago»): dos navegadores (uno normal y uno de incógnito) con `mesa.entrada` y `mesa.entrada2`, el mismo alumno y la misma clase hasta el diálogo. Confirmá en uno y después en el otro → «Esta clase ya tiene un pago registrado.»

**D. «Se inscribe al confirmar el pago»** (c3 última viñeta y c7): detalle de la clase `cmv6quso100h8ux3gu5bdfleo` → agregar a Sofía → el diálogo de inscripción ofrece «Registrar pago» → el wizard trae la clase marcada como «Se inscribe al confirmar el pago», con «Tarifa vigente». También se puede entrar directo: `/pagos/registrar?alumno=cmv6qumjs000oux3gj4erp0g7&clase=cmv6quso100h8ux3gu5bdfleo`. Para probar el rechazo por cupo, usá una clase completa donde el alumno tenga una reserva vencida.

**E. «Pago sin registrar»** si resembraste y no aparece: en Prisma Studio (`npx prisma studio`, tabla `turno_alumno`), en una fila `VIGENTE` y `RESERVADA` de una clase futura, poné a la vez `estadoPago = PAGO_SIN_REGISTRAR`, `venceBaseEl = null` y `venceEl = null` (la base exige los tres juntos).

---

## 7. Veredicto preliminar

### **Volver al dev**

**Bloqueante (1):**

1. **Criterio 9, y por arrastre criterio 3 (pagos parciales) y la Definición de Terminado (confirmación de C-25):** el botón «Registrar pago» de la tarjeta «Pago» del detalle de la clase (`src/app/(dashboard)/turnos/[id]/turno-detalle.tsx:72-77` → `registrar-pago-dialog.tsx` → `POST /api/pagos`, modo `compatSprint2`) tiene que abrir este mismo flujo con la clase marcada, o retirarse, ya que el atajo por inscripto de HU-C-24 ya cumple esa función. Hoy:
   - no abre el flujo nuevo;
   - se habilita también en clases que ya empezaron (`registrar_pago` en `turno.acciones.ts:68` no mira el inicio);
   - permite un segundo pago de la misma inscripción y un monto distinto sin motivo;
   - guarda sin `ConfirmarAccionDialog`.

   Al corregirlo, actualizar DESIGN.md §6.4 (líneas 249 y 293).

**Para corregir en la misma vuelta (no bloquean):**

- «Usar el precio de la clase» → «Usar el precio», si el PO quiere el texto literal.
- Centralizar `MENSAJE_ERROR_GENERICO` del wizard y los textos sueltos de `BuscadorAlumnos`.
- Subir el límite o acelerar `claves-textos.test.ts` para que la suite completa quede en verde.

Lo demás (criterios 1 a 8 y 10, permisos, transacción, bloqueos y registros nuevos) se puede probar a mano desde ya con los datos de §6, en paralelo con la corrección.
