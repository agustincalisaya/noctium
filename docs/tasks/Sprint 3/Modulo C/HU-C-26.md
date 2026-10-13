# TASK: HU-C-26 — Ver y gestionar las reservas pendientes de todas las clases

**Módulo:** C (Gestionar turnos) · **Sprint:** 3 · **SP estimado:** 3.
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` §2.20 (2.20.1 Totales, 2.20.2 Pendientes, 2.20.3 Vencidas, 2.20.4 Acciones por fila, 2.20.5 Cómo se cumplen los criterios) · reglas §3.11 (excepción de lectura cruzada) · trazabilidad §4 (`turno:alumno_quitado` ampliado) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-C-26, líneas 310-325) · `docs/tasks/Sprint 3/Modulo C/HU-C-22.md`, `HU-C-24.md` (modelo y vencimiento de la reserva, ya mergeadas) · `docs/tasks/Sprint 1/Modulo C/HU-C-04.md` (acción de quitar, patrón de referencia) · `docs/tasks/Sprint 2/Modulo B/HU-B-05.md` (criterio de búsqueda por alumno/DNI) · `docs/tasks/Sprint 3/Modulo I/HU-I-10.md` (flujo de pago, atajo por alumno/clase) · `docs/tasks/Sprint 3/Modulo I/HU-I-12.md` (caja abierta, precedente de pantalla con pestañas + filtros + paginación) · `docs/tasks/Sprint 3/Modulo C/HU-C-25.md` (`ConfirmarAccionDialog`) · `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 10, 11)
**RBAC:** `reservas:leer` (MESA_ENTRADA) — **ya existe en el seed** (`prisma/seed.ts:948`), sin permisos nuevos que crear. «Quitar» reutiliza `turnos:asignar_participantes` (MESA_ENTRADA), ya existente desde HU-C-04.
**Schema:** ya completo, sin migración. El PR 0 ya migró `TurnoAlumno` con `vigencia`, `estadoPago`, `venceEl`, `precio`, `finalizadaEl`, `finalizadaPorActorTipo`/`finalizadaPorUsuarioId`.

---

## 0. Relevamiento previo a implementación (Claude Code)

**Reglas no negociables de `docs/RULES.md` que esta task debe cumplir** (leer el archivo completo antes de implementar):
- **Regla N.° 1** — nada se borra; «Quitar» dejar la inscripción como `QUITADA_CENTRO` (igual que HU-C-04), nunca un `DELETE`.
- **Regla N.° 2** — la inscripción ya es su propia traza (opción a: `finalizadaEl`/`finalizadaPor*`) más el historial de estados del PR 0, escrito después del commit por `finalizarInscripcion` — esta task no agrega ningún mecanismo nuevo.
- **Regla N.° 3** — esta pantalla **no** lee tablas de Alumno ni de Pagos directo: usa exclusivamente las tres lecturas públicas de C (`listarReservasPendientes`, `listarReservasVencidas`, `resumenReservas`, ya expuestas por `inscripcion.publico.ts`), que a su vez ya resuelven nombre/DNI del alumno por relación (excepción ya documentada en spec §3.11, no es nueva de esta task).
- **Regla N.° 4** — ninguna regla de negocio nueva: `quitarReservaPendiente` es un envoltorio transaccional delgado sobre `marcarVencidas` y `finalizarInscripcion`, ambas ya implementadas en `inscripcion.service.ts` (PR 0).
- **Regla N.° 5 / N.° 6** — los 4 endpoints nuevos responden `{ data, error }`, con Zod antes del servicio en los 3 GET con query params.
- **Regla N.° 7** (concurrencia) — la condición atómica de «Quitar» ya la resuelve `finalizarInscripcion` con `soloSiReservaPendiente: true` (`UPDATE ... WHERE vigencia='VIGENTE' AND estadoPago='RESERVADA' AND venceEl > momento`); esta task no la reimplementa.
- **Regla N.° 10** — `reservas:leer` ya está en el seed; esta task solo agrega las entradas de `rutas-por-rol.ts` y el `matcher` del proxy.
- **Regla N.° 11** — archivos nuevos en `src/server/turnos/` (junto al resto del módulo) y `src/app/api/reservas/**`, nunca en `src/app/**`.

### 0.1. Ya existe en `develop` (verificado, no hay que crearlo de nuevo)

El PR 0, más HU-C-22/HU-C-24 (ya mergeadas), dejaron **las tres lecturas completas** en `src/server/turnos/inscripcion.lecturas.ts`, exportadas por la fachada `src/server/turnos/inscripcion.publico.ts`:

- `resumenReservas(db?)` — ya devuelve exactamente los 4 totales de §2.20.1 (`pendientes.{cantidad,importe_total}`, `vencen_en_3_horas`, `vencen_hoy`, `vencieron_hoy`), con un único `$queryRaw` sobre `turno_alumno`/`turnos`. **No hay nada que ajustar.**
- `listarReservasPendientes(filtros, db?)` — ya implementa el contrato íntegro de §2.20.2: filtros `alumno` (reutiliza `construirFiltroBusquedaAlumno` del módulo B, mismo criterio que HU-B-05), `materiaId`, `vencen` (`en_3_horas`/`hoy`/`manana`), paginación fija de a 10, orden por `venceEl` ascendente con `idInscripcion` de desempate, `faltan_min`/`vence_pronto` ya calculados, `alumno.reservas_pendientes` ya contado sobre el conjunto sin filtrar. Devuelve también `clase.aula` y `profesor`, tal como pide el criterio 2.
- `listarReservasVencidas(filtros, db?)` — ya implementa §2.20.3: últimos 7 días del centro, de la más reciente a la más antigua, incluye `RESERVA_VENCIDA` y las vencidas sin marcar (`sin_marcar: true`) de clases `DISPONIBLE`/`COMPLETO`, excluye las de clases `CANCELADO`.
- `finalizarInscripcion(tx, { inscripcionId, vigencia, actor, fecha?, soloSiReservaPendiente? })` (`inscripcion.service.ts`) — ya acepta `soloSiReservaPendiente: true` (agregado en el PR 0 pensando en esta HU, ver su comentario: "HU-C-26 criterio 6, RESERVA_NO_PENDIENTE"): la condición atómica exige además `estadoPago = 'RESERVADA' AND venceEl > momento`; si no se cumple, lanza `ErrorDeDominio("errores.reserva.noPendiente")` → `409 RESERVA_NO_PENDIENTE` con el texto exacto del criterio 6 ("Esta reserva ya no está pendiente: se pagó o venció."), **ya en `src/lib/textos.ts:1100`**. Si la inscripción no existe, lanza `errores.inscripcion.noEncontrada` → `404 INSCRIPCION_NO_ENCONTRADA` (también ya en el catálogo, `errores-dominio.ts`).
- `marcarVencidas(tx, turnoId, { momento? })` — ya implementada (HU-C-24), bloquea la clase y marca con la condición atómica; se reutiliza tal cual antes de `finalizarInscripcion` (mismo orden que `quitarAlumnoTurno` en `turno.service.ts:601-623`).
- `bloquear(tx, { clases, inscripciones })` (`src/server/shared/bloquear.ts`) — ya resuelve el orden canónico y es idempotente dentro de una misma transacción (pedir un id ya tomado no repite el `FOR UPDATE`): se puede llamar una vez al principio del servicio nuevo y `finalizarInscripcion` puede volver a pedir los mismos ids sin romper nada.
- Los códigos `RESERVA_NO_PENDIENTE` (409) e `INSCRIPCION_NO_ENCONTRADA` (404) **ya están en** `src/server/shared/errores-dominio.ts:46,49`. **No hace falta agregar ningún código ni texto de error nuevo** para esta task.
- El permiso `reservas:leer` **ya está en el seed** (`prisma/seed.ts:948`, visto en el relevamiento). **No hace falta tocar el seed de permisos.**
- `respuestaDeError()` (`src/app/api/pagos/respuesta-error.ts`, de HU-I-10) ya traduce cualquier `ErrorDeDominio` a `{ data: null, error: { code, message, detalles? } }` con el status de su catálogo — se reutiliza tal cual en los 4 Route Handlers nuevos, sin reimplementar el mapeo de errores.
- `GET /api/materias` (`materias:leer`, que mesa de entrada ya tiene) devuelve el listado de materias paginado (`por_pagina` hasta 20) — se reutiliza para poblar el `<select>` del filtro "Materia", sin crear un endpoint de opciones nuevo (ver 0.4, punto 3).
- El flujo de pago de HU-I-10 (`/pagos/registrar?alumno=<id>&clase=<id>`) ya está en `develop` y ya acepta alumno y clase preelegidos (criterio 9 de HU-I-10, ya usado por el atajo de HU-C-24 en el detalle de la clase). Esta task solo arma el enlace con esos mismos dos parámetros — no toca HU-I-10.
- `ConfirmarAccionDialog` y `fetchOLanzar` (HU-C-25) ya existen, con tests. La clave de texto `confirmaciones.inscripcion.quitar` que pide el criterio 6 **ya existe** (`src/lib/textos.ts:806`, redactada para HU-C-24/HU-C-04 con el mismo patrón "¿Estás seguro de que querés quitar a {alumno} de {materia} del {fecha} a las {hora}?") y es literalmente la misma que pide el criterio 6 de esta HU — se reutiliza tal cual, sin duplicar la clave.
- `fechaCorta`, `diaAbreviadoYFecha`, `fechaHoraDeInstante`, `formatearMonto` (`src/lib/turno-detalle.ts`, `src/lib/moneda.ts`) ya existen y cubren buena parte del formato de fecha/monto de las dos tablas.
- `CampoBusqueda`, `Pagination`, `ControlSegmentado` (`src/components/shared/`) ya existen y son genéricos — no son específicos de ningún módulo.
- El patrón completo de listado con búsqueda debounced + `replaceState` + paginador compartido, sin remontar el componente al llegar datos nuevos del servidor, **ya está implementado en `listado-personal.tsx`** (HU-F-03) — esta task replica ese mismo patrón (no lo reinventa), sumando los dos filtros propios (materia, vencen) y el cambio de pestaña.
- Precedente de pantalla con dos pestañas de solo-consulta + filtros + paginado: `/cajas` (HU-I-12, "Cajas abiertas" / "Cierres"), con un `<select>` simple para el filtro por integrante (0.4 punto 4 de esa task) — mismo criterio para el filtro de materia acá.

### 0.2. Archivos nuevos a crear (ruta exacta)

**Backend:**
- `src/server/turnos/reserva.schema.ts` — `ReservasPendientesQuerySchema` (`alumno`, `materia_id`, `vencen`, `pagina`, `.strict()`, igual al bloque ya redactado en `spec_modulo_C.md` §2.20.2) y `ReservasVencidasQuerySchema` (`alumno`, `materia_id`, `pagina`, `.strict()`, sin `vencen`, según §2.20.3).
- `src/server/turnos/reserva.pendiente.service.ts` — una sola función nueva, `quitarReservaPendiente(inscripcionId, usuarioId)`, envoltorio transaccional sobre `marcarVencidas` + `finalizarInscripcion` (ver 4.2). Nombre paralelo a `reserva.vencimiento.service.ts` (HU-C-24), que ya vive en la misma carpeta y no se toca.
- `src/types/reserva.types.ts` — tipos de respuesta que consume el frontend (`ReservaPendienteVista`, `ReservaVencidaVista`, `ResumenReservas`), derivados de los tipos ya exportados por `inscripcion.publico.ts` (`ReservaPendiente`, `ReservaVencida`) más lo que agregue el serializado JSON (fechas como string ISO).

**Route Handlers (`src/app/api/reservas/...`):**
- `resumen/route.ts` — `GET`, `reservas:leer` → `resumenReservas()`.
- `pendientes/route.ts` — `GET`, `reservas:leer` → `listarReservasPendientes()`, valida `ReservasPendientesQuerySchema`.
- `vencidas/route.ts` — `GET`, `reservas:leer` → `listarReservasVencidas()`, valida `ReservasVencidasQuerySchema`.
- `[inscripcionId]/quitar/route.ts` — `POST`, sin body, `turnos:asignar_participantes` → `quitarReservaPendiente()`.

**Frontend (`src/app/(dashboard)/reservas/`):**
- `page.tsx` — Server Component: `exigirPermiso("reservas:leer")`, lee `searchParams` (`tab`, `alumno`, `materia_id`, `vencen`, `pagina`), llama en paralelo a `resumenReservas()` y a `listarReservasPendientes()`/`listarReservasVencidas()` según `tab`, y a `listarMaterias()` para las opciones del filtro. Entrega el primer render a `ListadoReservas`.
- `resumen-reservas.tsx` — los 4 "stat cards" de §2.20.1 (foto `Reservas · Pendientes.png`), Server Component puro (sin interactividad).
- `listado-reservas.tsx` — Client Component: pestañas "Pendientes"/"Vencidas · últimos 7 días" (`ControlSegmentado` o nav de links, ver 0.4 punto 1), `CampoBusqueda` (alumno/DNI), `<select>` de materia, `<select>` "Vencen" (solo en Pendientes), tabla de cada pestaña, `Pagination`, acciones "Registrar pago" y "Quitar" por fila, mismo patrón de debounce + `replaceState` + adopción de datos nuevos sin remontar que `listado-personal.tsx`.
- `fila-reserva-pendiente.tsx` y `fila-reserva-vencida.tsx` (o una sola `tabla-reservas.tsx` con dos variantes) — filas de cada tabla, con el formato de vencimiento/"falta" y el badge rojo cuando `vence_pronto`.
- `quitar-reserva-dialog.tsx` — `ConfirmarAccionDialog` (HU-C-25) con el texto de `confirmaciones.inscripcion.quitar` (ya existente) y manejo del rechazo `RESERVA_NO_PENDIENTE` inline, igual que HU-C-04.

**Archivos de apoyo:**
- `src/lib/reservas-listado.ts` — `parametrosListadoReservas({ tab, q, materiaId, vencen, pagina })`, mismo patrón que `parametrosListadoPersonal`/`parametrosListadoGerentes`.
- `src/lib/reservas-formato.ts` — `formatearFaltan(minutos: number): string` ("en 45 min" / "en 3 h"; ver 0.4 punto 2 sobre el caso no exacto).

**Tests y evidencia:**
- `reserva.schema.test.ts`, `reserva.pendiente.service.test.ts`, `reserva.pendiente.service.pg.test.ts`.
- `src/app/api/reservas/resumen/route.test.ts`, `pendientes/route.test.ts`, `vencidas/route.test.ts`, `[inscripcionId]/quitar/route.test.ts`.
- `listado-reservas.test.tsx`, `reservas-formato.test.ts`.
- `docs/testing/Modulo C/hu-c-26/HU-C-26.postman_collection.json`.
- `docs/testing/Modulo C/hu-c-26/HU-C-26-evidencia.md`, con el SQL de nivel 3.

### 0.3. Archivos existentes a modificar (ruta exacta + qué cambia)

- `src/server/turnos/turno.service.ts` — `quitarAlumnoTurno()` (línea ~618, la llamada a `emitirEventoTurno("turno:alumno_quitado", ...)`): agrega `inscripcion_id: inscripcion.id` al payload, tal como exige la Revisión 6 de `spec_modulo_C.md` §4 ("`turno:alumno_quitado` (ampliado) ... agrega `inscripcion_id` al payload existente", aplicable a **2.5 y «Quitar» de 2.20 por igual**). Es un cambio chico y aditivo sobre código ya mergeado de HU-C-04, no sobre esta task únicamente — se señala para no dejarlo la mitad hecho (ver 0.4, punto 4).
- `src/server/shared/rutas-por-rol.ts` (y su test) — agrega `reservas: ["MESA_ENTRADA"]`.
- `src/proxy.ts` — agrega `/reservas/:path*` al `matcher`.
- `src/components/layout/Sidebar.tsx` (y su test) — ítem «Reservas» para `MESA_ENTRADA` → `/reservas`, dentro de `SECCIONES_POR_ROL.MESA_ENTRADA` (ver 0.4, punto 5, sobre dónde ubicarlo exactamente).
- `src/lib/textos.ts` — agrega las claves nuevas bajo `ui.reservas.*` (sección 4.4) — **no** agrega claves de error (0.1).
- `docs/DESIGN.md` §6.4 — agrega la fila de "Reservas" (0.4, punto 6).
- `docs/RULES.md` — sección corta «Aplicación HU-C-26» documentando el patrón `reserva.pendiente.service.ts` y el cambio aditivo al payload de `turno:alumno_quitado`.

**No se toca en esta task** (explícito, ver sección 1): `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (2.5) sigue existiendo tal cual y sigue siendo la acción "Quitar" del detalle de la clase; «Quitar» de esta pantalla usa su **propia** ruta (`POST /api/reservas/[inscripcionId]/quitar`), como aclara la nota de compatibilidad de la spec §2.20 ("no reutiliza `DELETE .../alumnos/[alumnoId]`"). Tampoco se toca `marcarVencidas`, `finalizarInscripcion` ni ninguna otra función de `inscripcion.service.ts`.

### 0.4. Puntos a relevar antes de asumir (pendientes de tu OK)

1. **Cambio de pestaña: ¿link de navegación o estado de cliente?** Se propone el mismo patrón que `/alumno` (Próximas/Anteriores, HU-C-13): cada pestaña es un `<Link href="/reservas?tab=pendientes">`/`<Link href="/reservas?tab=vencidas">` que re-renderiza `page.tsx` en el servidor (navegación de Next.js, sin recarga dura del navegador) y vuelve a la página 1; dentro de cada pestaña, los filtros (alumno, materia, vencen) son 100% cliente con debounce + `replaceState`, igual que `listado-personal.tsx`. Cumple el criterio 4 ("los filtros... se actualizan sin recargar") sin mezclar dos pestañas con forma de respuesta distinta en un solo estado de cliente. **Alternativa:** manejar también el cambio de pestaña en el cliente (sin ida al servidor), cargando ambos listados por fetch. Se recomienda la primera opción por ser la que ya usa el proyecto en un caso idéntico (dos pestañas, servidor entrega el primer render).
2. **Formato exacto de "falta" para minutos no múltiplos de 60.** Los criterios solo dan los ejemplos "en 45 min" y "en 3 h" (visibles también en la foto `Reservas · Pendientes.png`, fila superior: "Mar 06/10 22:04 · en 45 min"). No hay ejemplo para, por decir, 90 minutos. Se propone "en 1 h 30 min" (igual criterio que ya usa `duracion()` de `turno-detalle.ts` para "1 hora"/"N horas", extendido con minutos). A confirmar o ajustar antes de escribir `formatearFaltan`.
3. **Filtro "Materia": ¿reutilizar `GET /api/materias` o crear un endpoint de opciones propio?** El catálogo de materias del seed es chico (un puñado, visto en las fotos: Física I, Programación I, Inglés B2, Química I...). Se propone reutilizar `GET /api/materias?por_pagina=20` (ya accesible para mesa de entrada vía `materias:leer`) para poblar el `<select>`, sin crear un endpoint de opciones nuevo — mismo criterio de "`<select>` simple, no buscador" que usó HU-I-12 para su filtro de integrante (0.4 punto 4 de esa task). Si en algún momento el catálogo de materias supera los 20 registros, el filtro queda incompleto — limitación conocida, no bloqueante, a documentar en la task si se confirma este camino.
4. **El ajuste a `quitarAlumnoTurno()` de HU-C-04 (0.3, primer ítem): ¿se hace en esta task o se deja para una task de alcance transversal?** Es un cambio de una línea (agregar `inscripcion_id` al payload de un evento) sobre código ya cerrado de otra HU, pero el contrato que lo exige (`spec_modulo_C.md` Revisión 6 §4) ya está escrito y aplica a ambos llamadores por igual. Se recomienda hacerlo acá, documentado como nota de sincronización (igual que el propio `sdd-metodologia.md` pide hacer cuando el código real difiere de lo que la spec ya dice), porque dejarlo para "después" no tiene otra HU dueña natural.
5. **Dónde entra «Reservas» en el menú de mesa de entrada.** `Sidebar.tsx` no tiene todavía una sección obvia para esto (no es "Clases" ni "Pagos" puntual). Se propone un ítem de primer nivel, sin desplegable (como «Mi caja» o «Registrar pago»), ubicado después de «Mi caja» y antes de «Calendario» — mesa de entrada abre caja, cobra, y gestiona reservas en esa misma zona de tareas diarias. A confirmar el orden exacto; no bloquea la implementación del resto.
6. **Fila nueva en `docs/DESIGN.md` §6.4.** Se propone: `Reservas (HU-C-26) | Página completa, pestañas Pendientes/Vencidas, filtros en cliente | Ninguno propio (Registrar pago navega a /pagos/registrar; Quitar usa ConfirmarAccionDialog con toast «Reserva quitada» + recarga)`. A confirmar antes de escribir el texto final.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Los puntos 1 a 6 son candidatos de resolución, no decisiones ya tomadas — a diferencia de HU-I-12/HU-C-04, acá no hay una ronda previa de Claude Code ni un OK de equipo todavía registrado.

---

## 1. Nota de alcance

HU-C-26 es **una pantalla nueva, de solo listar y actuar sobre lo que ya existe**: no agrega ningún estado, columna ni regla de negocio al modelo de inscripción (eso ya lo cerraron HU-C-22/HU-C-24 y el PR 0). Todo lo que hace es:
1. Exponer las tres lecturas públicas de C ya implementadas (`resumenReservas`, `listarReservasPendientes`, `listarReservasVencidas`) detrás de tres Route Handlers nuevos.
2. Agregar una variante de "quitar" con su propia condición atómica (`soloSiReservaPendiente`), ya soportada por `finalizarInscripcion` pero sin ningún llamador todavía — esta task es su primer y único llamador.
3. Construir la pantalla.

El backlog lo dice explícito ("reutiliza la lectura de reservas pendientes y vencidas, la ruta «Reservas» y el permiso que trae el PR 0, el flujo de pago de HU-I-10 y la acción de quitar de HU-C-04") y por eso tiene solo 3 SP pese a sumar una pantalla completa con filtros y paginación.

**Fuera de alcance de esta task (explícito):**
- Cualquier cambio a `listarReservasPendientes`, `listarReservasVencidas`, `resumenReservas`, `marcarVencidas` o `finalizarInscripcion` — ya están completas, esta task solo las llama.
- El wizard de `/pagos/registrar` y el proceso de vencimiento (`POST /api/procesos/vencer-reservas`) — son de HU-I-10 y HU-C-24, ya mergeados; esta task solo arma el enlace y usa el dato `vencieron_hoy` que ya calcula `resumenReservas()`.
- `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (2.5, HU-C-04) — sigue existiendo tal cual, es una ruta distinta a la de esta HU (ver nota de compatibilidad de la spec).
- Cualquier publicación nueva de `construirFiltroBusquedaAlumno` en `alumno.publico.ts` (el punto abierto P-C6 de la spec) — `listarReservasPendientes`/`listarReservasVencidas` ya resuelven el filtro por alumno internamente (importan `alumno.busqueda.ts` directo, la excepción de solo lectura de §3.11), así que esta task no depende de que P-C6 se resuelva.
- Un endpoint de opciones de materia dedicado (si se confirma el punto 3 de 0.4).

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** ver en una sola pantalla las reservas sin pagar de todas las clases, ordenadas por vencimiento, y cobrarlas o quitarlas desde ahí
**Para** cobrar a tiempo las que están por vencer y liberar los lugares que no se van a pagar, sin entrar clase por clase

**SP estimado:** 3

### Criterios de aceptación — backlog literal

1. El menú de mesa de entrada tiene la opción "Reservas". Arriba se muestran cuatro totales: reservas pendientes de pago (con el importe total a cobrar), las que vencen en las próximas 3 horas, las que vencen hoy y las que vencieron hoy.
2. Pestaña "Pendientes": lista las inscripciones en estado "Reservada" de clases Disponibles o Completas cuyo vencimiento todavía no pasó (HU-C-24, criterio 2), ordenadas por vencimiento ascendente. Cada fila muestra vencimiento (día, fecha y hora, y cuánto falta: "en 45 min", "en 3 h"; en rojo si faltan 3 horas o menos), alumno (nombre, DNI y cuántas reservas pendientes tiene), clase (fecha, horario, materia y aula, con enlace al detalle), profesor y precio guardado en la inscripción (HU-L-06). Se pagina de a 10.
   - Las reservas cuyo vencimiento ya pasó no se listan aunque el proceso de HU-C-24 todavía no las haya marcado.
3. Pestaña "Vencidas · últimos 7 días": lista las reservas vencidas en los últimos 7 días, de la más reciente a la más antigua, con la fecha y hora en que vencieron y el enlace a la clase. Incluye las vencidas que el proceso todavía no marcó, con la etiqueta "Vencida · sin marcar todavía". Es solo consulta.
4. Filtros: alumno o DNI (desde 2 caracteres, mismo criterio que HU-B-05), materia y, en Pendientes, "Vencen": en las próximas 3 h, hoy o mañana. Se combinan, se actualizan sin recargar la pantalla y vuelven a la página 1; "Limpiar filtros" vuelve al listado completo.
5. "Registrar pago" en cada fila: si el alumno tiene una sola reserva pendiente, abre el registro de pago de esa clase (atajo de HU-I-10, criterio 9); si tiene varias, abre HU-I-10 con el alumno elegido y esa clase marcada, para que pueda pagar varias en una operación. Exige caja abierta (HU-I-12, criterio 2).
6. "Quitar" en cada fila: quita al alumno de la clase como HU-C-04 (la inscripción queda "Quitada por el centro" y se libera el lugar), previa confirmación de HU-C-25. Si mientras tanto la reserva se pagó o venció, se informa "Esta reserva ya no está pendiente: se pagó o venció." y no se quita.
7. Debajo se informa que el proceso automático revisa las reservas cada 5 minutos y cuántas reservas vencieron hoy.
8. Solo accesible para mesa de entrada; el servidor rechaza con 403 a otros roles. Usa la lectura compartida de inscripciones por estado de pago del PR 0 (no reimplementa la vigencia).

**Secuencia y diferidas:** ninguna — la propia justificación del backlog dice "todo lo que usa va antes" (HU-C-22, HU-C-24, HU-I-10, HU-I-12, HU-C-25, todas ya mergeadas).

---

## 3. Alcance de esta task

Implementación **frontend + backend**, conforme a `spec_modulo_C.md` §2.20 completa. Incluye:

- Schemas Zod de `reserva.schema.ts`: `ReservasPendientesQuerySchema`, `ReservasVencidasQuerySchema`.
- `quitarReservaPendiente()` en `reserva.pendiente.service.ts`.
- Los 4 Route Handlers de 0.2.
- Entradas nuevas en `rutas-por-rol.ts` y el `matcher` del proxy para `/reservas`.
- Ítem nuevo en el sidebar para mesa de entrada.
- UI: pantalla «Reservas» (`/reservas`) con los 4 totales (§2.20.1), pestañas "Pendientes"/"Vencidas · últimos 7 días" (§2.20.2/§2.20.3), filtros combinables (alumno/DNI, materia, vencen) con "Limpiar filtros", paginación de a 10, acciones "Registrar pago" y "Quitar" por fila, el pie con el aviso del proceso automático (criterio 7).
- Textos nuevos en `src/lib/textos.ts` (`ui.reservas.*`) y la fila nueva en `DESIGN.md` §6.4.
- El ajuste de una línea a `quitarAlumnoTurno()` (HU-C-04) para sumar `inscripcion_id` al payload de `turno:alumno_quitado` (0.3, 0.4 punto 4).
- Sección «Aplicación HU-C-26» en `RULES.md`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo listado en la sección 1, más:
- Cualquier código de error nuevo en `errores-dominio.ts` (ya están todos, sección 0.1).
- Cualquier cambio al contrato de `POST /api/pagos/operaciones` o a la pantalla `/pagos/registrar` (HU-I-10).
- Cualquier cambio a `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (HU-C-04, 2.5).

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/turnos/reserva.schema.ts`

```typescript
export const ReservasPendientesQuerySchema = z.object({
  alumno: z.string().trim().max(100).optional(),
  materia_id: z.string().cuid().optional(),
  vencen: z.enum(["en_3_horas", "hoy", "manana"]).optional(),
  pagina: z.coerce.number().int().positive().default(1),
}).strict();
export type ReservasPendientesQuery = z.infer<typeof ReservasPendientesQuerySchema>;

export const ReservasVencidasQuerySchema = z.object({
  alumno: z.string().trim().max(100).optional(),
  materia_id: z.string().cuid().optional(),
  pagina: z.coerce.number().int().positive().default(1),
}).strict();
export type ReservasVencidasQuery = z.infer<typeof ReservasVencidasQuerySchema>;
```

Mapeo directo a los filtros que ya aceptan `listarReservasPendientes`/`listarReservasVencidas` (`alumno`, `materiaId`, `vencen`, `pagina`) — el schema solo traduce `materia_id` (contrato HTTP, snake_case) a `materiaId` (función TS).

### 4.2. Servicio nuevo

**Archivo:** `src/server/turnos/reserva.pendiente.service.ts`
**Función:** `quitarReservaPendiente(inscripcionId: string, usuarioId: string): Promise<{ inscripcion_id: string; vigencia: "QUITADA_CENTRO"; alumnos_inscriptos: string; estado: EstadoTurno }>`

Dentro de una `transaccion()` (mismo patrón que `quitarAlumnoTurno` de `turno.service.ts:601-623`):
1. Leer `turnoId` y `cupoMaximoTurno` de la inscripción (`tx.turnoAlumno.findUnique`, sin bloqueo todavía). Si no existe → `ErrorDeDominio("errores.inscripcion.noEncontrada")` (404, ya en el catálogo).
2. `bloquear(tx, { clases: [turnoId], inscripciones: [inscripcionId] })` (orden canónico, spec §2.20.4 paso 1).
3. `marcarVencidas(tx, turnoId)` — una reserva vencida sin marcar pasa a `RESERVA_VENCIDA` antes de evaluar si se puede quitar (mismo motivo que en `quitarAlumnoTurno`: no dejar pasar una reserva vencida como si siguiera pendiente).
4. `finalizarInscripcion(tx, { inscripcionId, vigencia: "QUITADA_CENTRO", actor: actorUsuario(usuarioId), soloSiReservaPendiente: true })` — si la reserva ya no está `RESERVADA` y vigente al momento, lanza `errores.reserva.noPendiente` (409, ya en el catálogo, con el texto exacto del criterio 6).
5. Recalcular `alumnos_inscriptos` con `inscripcionesVigentes(tx, turnoId, momento)` (mismo helper que usa `quitarAlumnoTurno`).
6. Commit → **después del commit**: `emitirEventoTurno("turno:alumno_quitado", turnoId, usuarioId, { turno_id, alumno_id, inscripcion_id: inscripcionId, usuario_id })` (payload ampliado, Revisión 6) y, si `estadoTurno.cambio` fue `COMPLETO → DISPONIBLE`, también `turno:disponible_nuevamente`.

No reimplementa ninguna regla de negocio: delega todo en `marcarVencidas` y `finalizarInscripcion`, ya probadas.

**Errores de servicio reutilizados (ninguno nuevo):** `INSCRIPCION_NO_ENCONTRADA` (404), `RESERVA_NO_PENDIENTE` (409).

### 4.3. Route Handlers

Los 4 archivos de 0.2. Permisos exactos por ruta (Regla N.° 10):

| Ruta | Método | Permiso |
|---|---|---|
| `/api/reservas/resumen` | `GET` | `reservas:leer` |
| `/api/reservas/pendientes` | `GET` | `reservas:leer` |
| `/api/reservas/vencidas` | `GET` | `reservas:leer` |
| `/api/reservas/[inscripcionId]/quitar` | `POST` | `turnos:asignar_participantes` |

Patrón de error: `respuestaDeError()` de `src/app/api/pagos/respuesta-error.ts` (ya existe, HU-I-10), que ya traduce cualquier `ErrorDeDominio` a su status del catálogo. Validación Zod siempre antes del servicio en los 3 GET (Regla N.° 6); respuesta siempre `{ data, error }` (Regla N.° 5). `[inscripcionId]/quitar` no recibe body.

### 4.4. Textos nuevos en `src/lib/textos.ts`

No agrega ninguna clave de `errores.*` (0.1: ya están todas). Agrega bajo `ui.reservas.*`:
- `ui.reservas.menu`: "Reservas" (ítem del sidebar).
- `ui.reservas.titulo` / `.subtitulo`: encabezado de la pantalla.
- `ui.reservas.resumen.pendientes` / `.vencenEn3Horas` / `.vencenHoy` / `.vencieronHoy`: etiquetas de los 4 stat cards (criterio 1).
- `ui.reservas.tabs.pendientes` / `.vencidas`: "Pendientes" / "Vencidas · últimos 7 días" (criterios 2 y 3).
- `ui.reservas.columna.*`: encabezados de ambas tablas (vencimiento, alumno, clase, profesor, precio / vencióEl, estado).
- `ui.reservas.etiqueta.vencidaSinMarcar`: "Vencida · sin marcar todavía" (criterio 3, literal).
- `ui.reservas.filtros.alumnoPlaceholder` / `.alumnoEtiqueta`, `.materiaTodas`, `.vencenTodas` / `.vencenEn3Horas` / `.vencenHoy` / `.vencenManana`, `.limpiar`: filtros del criterio 4.
- `ui.reservas.vacio.pendientes` / `.vacio.vencidas` / `.vacio.conFiltro`: estados vacíos.
- `ui.reservas.pie.procesoAutomatico`: texto del criterio 7 (interpola `vencieron_hoy`).
- `ui.reservas.accion.registrarPago` / `.accion.quitar`: textos de los botones de fila.
- `ui.reservas.toastQuitada`: toast de éxito de "Quitar" (no especificado literalmente por el backlog — redacción libre, ej. "Reserva quitada").

---

## 5. Frontend

**`/reservas` (mesa de entrada, exclusivo — criterio 8):**
- Encabezado + los 4 stat cards de `resumen-reservas.tsx` (criterio 1), igual a la foto `Reservas · Pendientes.png` (84 pendientes / $ 1.134.000 a cobrar · 6 en 3h · 3 hoy · 22 vencieron hoy).
- Pestañas "Pendientes" / "Vencidas · últimos 7 días" como links (`?tab=pendientes|vencidas`, 0.4 punto 1), subrayado activo igual al patrón de `/alumno`.
- **Filtros** (criterio 4), cliente, debounce 300 ms (mismo umbral que HU-B-05/HU-F-03), combinables, vuelven a página 1 y actualizan la URL con `replaceState` sin recargar:
  - `CampoBusqueda` por alumno/DNI (desde 2 caracteres, mismo criterio que HU-B-05, ya resuelto por `listarReservasPendientes`/`listarReservasVencidas` internamente).
  - `<select>` de materia, poblado desde `GET /api/materias` (0.4 punto 3).
  - `<select>` "Vencen" (en las próximas 3 h / hoy / mañana), solo visible en la pestaña Pendientes.
  - "Limpiar filtros": vuelve a `/reservas?tab=<actual>` sin ningún parámetro de filtro.
- **Tabla "Pendientes"** (criterio 2, foto `Reservas · Pendientes.png`): columnas Vence (día, fecha y hora + "en 45 min"/"en 3 h", en rojo si `vence_pronto`), Alumno (nombre, DNI, "N reservas pendientes"), Clase (fecha, horario, materia, aula, con enlace a `/turnos/[turno_id]`), Profesor, Precio (`formatearMonto`), Acciones ("Registrar pago", "Quitar"). Paginado de a 10 con `Pagination` compartido.
- **Tabla "Vencidas · últimos 7 días"** (criterio 3, foto `Reservas · Vencidas · últimos 7 días.png`): columnas Venció (fecha y hora), Alumno, Clase (con enlace), Profesor, Estado (`Badge` "Reserva vencida" o "Vencida · sin marcar todavía" si `sin_marcar`). Sin acciones — es solo consulta. Paginado de a 10.
- **"Registrar pago"** (criterio 5): sin modal propio — navega a `/pagos/registrar?alumno=<alumno.id>&clase=<clase.turno_id>` (wizard de página completa de HU-I-10, ya implementado). La pantalla destino ya decide con sus propios datos si el alumno tiene una o varias reservas pendientes y arma el paso correspondiente (criterio 9 de HU-I-10); esta pantalla no necesita replicar esa lógica, solo pasar los dos parámetros. Si la caja no está abierta, el wizard de HU-I-10 ya resuelve el rechazo `CAJA_NO_ABIERTA` con el enlace "Abrir caja" (HU-I-12, ya implementado) — no se reimplementa acá.
- **"Quitar"** (criterio 6, foto `Quitar una reserva pendiente.png`): `quitar-reserva-dialog.tsx` con `ConfirmarAccionDialog` (HU-C-25) irreversible: "¿Estás seguro de que querés quitar a <Alumno> de <Materia> del <fecha> a las <hora>?" + "Esta acción no se puede deshacer." (clave `confirmaciones.inscripcion.quitar`, ya existente, reutilizada tal cual — igual a la foto). Botones "Volver" / "Quitar de la clase". Si el servidor rechaza con `RESERVA_NO_PENDIENTE`, el mensaje "Esta reserva ya no está pendiente: se pagó o venció." se muestra inline dentro del mismo diálogo (comportamiento nativo de `ConfirmarAccionDialog`, sin código adicional) y no se quita nada. Al confirmar: toast de éxito + `router.refresh()` (misma pantalla, la fila desaparece de "Pendientes").
- **Pie** (criterio 7): "El proceso automático revisa las reservas cada 5 minutos. Hoy vencieron {vencieron_hoy} reservas." (interpola el mismo número que ya trae `resumenReservas()`, sin consulta aparte).
- Sin resultados: estado vacío inline por pestaña, con y sin filtro aplicado (mismo patrón que HU-F-03/HU-G-03: "No se encontraron reservas para «{q}»" vs. "No hay reservas pendientes" / "No hay reservas vencidas en los últimos 7 días").
- Todos los colores y componentes siguen `docs/DESIGN.md`: tokens de shadcn/ui + Tailwind, nunca hex.

**Fuera de alcance de frontend:** cualquier modal de pago propio (se navega a HU-I-10); cualquier cambio a `turno-alumnos-card.tsx` (detalle de la clase, HU-C-24).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios

- `reserva.schema.test.ts`: los dos schemas — válidos e inválidos (`materia_id` no-CUID, `vencen` fuera de enum, `pagina` no positiva, campo extra rechazado por `.strict()`).
- `reserva.pendiente.service.test.ts` (mocks): `quitarReservaPendiente` llama a `marcarVencidas` antes que a `finalizarInscripcion`; propaga `INSCRIPCION_NO_ENCONTRADA` si la inscripción no existe, sin llamar a `bloquear`; propaga `RESERVA_NO_PENDIENTE` tal cual la lanza `finalizarInscripcion`, sin reintentar ni envolver el error.
- `reserva.pendiente.service.pg.test.ts` (PostgreSQL real): quitar una reserva `RESERVADA` vigente → `QUITADA_CENTRO`, libera el lugar, `COMPLETO → DISPONIBLE` cuando corresponde; quitar una reserva ya pagada → `409 RESERVA_NO_PENDIENTE`, sin cambios; quitar una reserva ya vencida sin marcar → el propio servicio la marca primero (`RESERVA_VENCIDA`) y después rechaza con `RESERVA_NO_PENDIENTE` (nunca la quita como si siguiera pendiente); inscripción inexistente → `404`.
- `reservas-formato.test.ts`: `formatearFaltan` — casos `45` → "en 45 min", `180` → "en 3 h", y el caso no exacto que se resuelva en 0.4 punto 2.
- Componentes (`listado-reservas.test.tsx`): cambia de pestaña y resetea filtros/página; el filtro de alumno debounce 300 ms y no dispara con 1 carácter; combina alumno + materia + vencen en una sola consulta; "Limpiar filtros" vuelve al listado completo; "Registrar pago" arma el `href` con `alumno` y `clase` correctos; "Quitar" abre la confirmación con los datos de la fila y, ante `RESERVA_NO_PENDIENTE`, muestra el mensaje inline sin cerrar el diálogo ni quitar la fila.

### Nivel 2 — Postman

`docs/testing/Modulo C/hu-c-26/HU-C-26.postman_collection.json`:
- `GET /api/reservas/resumen` → `200` con los 4 campos.
- `GET /api/reservas/pendientes` sin filtros → `200` paginado de a 10, orden por vencimiento ascendente; con `vencen=en_3_horas` → solo las que vencen en los próximos 180 min; con `alumno=<2+ caracteres>` → filtra; con `materia_id` inválido → `400 VALIDATION_ERROR`.
- `GET /api/reservas/vencidas` → `200`, incluye `sin_marcar: true` para una vencida no marcada.
- `POST /api/reservas/[inscripcionId]/quitar` sobre una reserva pendiente real → `200` con el contrato exacto de §2.20.4; sobre una ya pagada → `409 RESERVA_NO_PENDIENTE`; sobre un id inexistente → `404 INSCRIPCION_NO_ENCONTRADA`.
- Cualquiera de los 4 endpoints con un rol distinto de mesa de entrada → `403 SIN_PERMISO` (criterio 8).
- Sin secretos ni cookies en la colección.

### Nivel 3 — BD / TablePlus

- Tras "Quitar": `turno_alumno.vigencia = 'QUITADA_CENTRO'`, `finalizadaEl`/`finalizadaPorUsuarioId` poblados, fila del `turno_alumno` conservada (no `DELETE`).
- `turnos.estadoTurno` transiciona `COMPLETO → DISPONIBLE` cuando corresponde.
- Historial de estados (PR 0) tiene la fila nueva de la transición `VIGENTE → QUITADA_CENTRO`, escrita después del commit.
- `eventos_turno` tiene `turno:alumno_quitado` con `inscripcion_id` en el payload (verifica también el ajuste de 0.3 sobre `quitarAlumnoTurno`, con un `DELETE` de 2.5 aparte).

**Evidencia esperada:** Postman + SQL; capturas de `/reservas` (pestaña Pendientes con filtros, pestaña Vencidas, confirmación de "Quitar", rechazo `RESERVA_NO_PENDIENTE` dentro del diálogo), comparadas contra las 4 fotos del prototipo en `C:\Users\agust\Desktop\Imagenes HU\HU-C-26\`.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0, incluidos los 6 puntos de 0.4) confirmado antes de implementar.
- [ ] Los dos schemas Zod y `quitarReservaPendiente()` implementados, sin lógica de negocio nueva (delega en `marcarVencidas`/`finalizarInscripcion`).
- [ ] Los 4 Route Handlers responden `{ data, error }` con los status codes de §2.20.4, reutilizando `respuestaDeError()` de HU-I-10.
- [ ] Ningún código de error nuevo en `errores-dominio.ts` (ya existían todos).
- [ ] `inscripcion_id` agregado al payload de `turno:alumno_quitado` tanto en `quitarAlumnoTurno` (HU-C-04) como en `quitarReservaPendiente` (esta task), conforme a la Revisión 6 de la spec.
- [ ] Entrada `reservas: ["MESA_ENTRADA"]` agregada a `rutas-por-rol.ts` y `/reservas/:path*` al `matcher` del proxy.
- [ ] Ítem «Reservas» agregado al sidebar de mesa de entrada.
- [ ] Frontend: 4 totales, dos pestañas, los 3 filtros combinables sin recarga, paginación de a 10 en ambas, "Registrar pago" navega a `/pagos/registrar?alumno=&clase=`, "Quitar" con confirmación de HU-C-25 y manejo inline de `RESERVA_NO_PENDIENTE`, pie con el aviso del proceso automático.
- [ ] Ningún `DELETE` físico; «Quitar» dejar la inscripción como `QUITADA_CENTRO`, nunca borrarla.
- [ ] Textos nuevos agregados a `textos.ts` bajo `ui.reservas.*`, ninguno hardcodeado.
- [ ] Fila nueva de HU-C-26 agregada a `DESIGN.md` §6.4.
- [ ] Sección «Aplicación HU-C-26» agregada a `RULES.md`.
- [ ] Tests de los 3 niveles en verde, con evidencia.
- [ ] PR con diff acotado exclusivamente a esta task (el ajuste a `quitarAlumnoTurno` incluido y señalado en la descripción del PR, ya que toca un archivo de otra HU).
