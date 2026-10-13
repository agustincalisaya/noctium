# HU-C-26 — Evidencia de pruebas

**Fecha:** 13/10/2026 · **Base:** `feature/HU-C-26` sobre `develop` (`be491e4`).
Solo lo marcado «Ejecutado» tiene un comando y su salida. La colección y el SQL se corrieron contra una base **descartable** (`noctium_hu_c26_a07c5f13`: migraciones + seed completo), creada para esta HU y borrada al terminar; no se escribió en `noctium_dev` ni en `noctium_test`.

## 1. Comandos ejecutados

| # | Comando | Resultado | Exit |
|---|---|---|---|
| 1 | `npx tsc --noEmit -p .` | sin errores | 0 |
| 2 | `npx eslint` sobre `src/app/(dashboard)/reservas`, `src/app/api/reservas`, `src/server/turnos/reserva.*`, `src/lib/reservas-*`, `src/types/reserva.types.ts`, `inscripcion.lecturas.ts`, `Sidebar.tsx` | 0 errores; 1 aviso previo en `Sidebar.tsx` (`CALENDARIO` sin usar, ya estaba en `develop`) | 0 |
| 3 | `node scripts/verificar-claves-textos.ts` | «Claves de textos verificadas.» | 0 |
| 4 | `npx vitest run src/app/api/reservas` | 4 archivos, 27 tests pasan | 0 |
| 5 | `npx vitest run src/server/turnos/reserva.schema.test.ts src/server/turnos/reserva.pendiente.service.test.ts src/lib/reservas-formato.test.ts src/components/layout/Sidebar.reservas.test.tsx src/server/shared/rutas-por-rol.test.ts` | 5 archivos, 84 tests pasan | 0 |
| 6 | `npx vitest run "src/app/(dashboard)/reservas"` | 1 archivo, 15 tests pasan | 0 |
| 7 | `npx vitest run src/server/shared/errores-dominio.test.ts` | 13 tests pasan (formato de claves: ver 5) | 0 |
| 8 | `npm run test:pg -- src/server/turnos/reserva.pendiente.service.pg.test.ts src/server/turnos/inscripcion.lecturas.pg.test.ts src/server/turnos/turno.inscripciones.pg.test.ts` | base aleatoria del runner; `reserva.pendiente.service.pg.test.ts` 8/8 y `turno.inscripciones.pg.test.ts` pasan; `inscripcion.lecturas.pg.test.ts` 4/5 (ver 2) | 1 |
| 9 | Suite completa `npx vitest run` | ver 2 | 0 |
| 10 | Colección `HU-C-26.postman_collection.json` con un ejecutor propio (los scripts `test` de la colección con `chai` del proyecto; no es la app de Postman ni `newman`), contra `next dev -p 3100`, con sesiones reales de NextAuth de mesa de entrada, gerente y profesor del seed | **25/25 requests, 63/63 tests** | 0 |
| 11 | `HU-C-26.sql` completo con `psql -v …`, en una transacción `READ ONLY` | resultados en la sección 4 | 0 |
| 12 | Recorrido en Chrome headless (Playwright sobre el Chrome del sistema, sesión real de mesa de entrada), con capturas en `capturas/` | sección 5 | 0 |

## 2. Fallos que no son de esta HU

- `inscripcion.lecturas.pg.test.ts › contarInscripcionesPorMes y contarClasesPorMes…` vence el timeout de 5 s. **Falla igual en `develop` limpio** (se corrió el mismo comando en un worktree temporal de `be491e4` sin los cambios de esta HU: mismo test, mismo timeout). Esta HU no toca `contarInscripcionesPorMes`.
- En la suite completa (comando 9) fallaron por timeout de 5 s, con la máquina cargada (seed y `test:pg` en paralelo): `turno-wizard`, `turno-recurrente`, `solicitar-turno`, `resultado-examen-acciones`, `estado-integrante-dialog` y `claves-textos.test.ts` (este tarda ~14 min). Corridos aislados, `turno-recurrente` pasa 30/30 y los otros cuatro componentes pasan. Para `claves-textos` se usó el script equivalente (comando 3), que pasa. Ninguno de esos archivos lo toca esta HU.
- El único fallo real de la suite era propio y se corrigió: `errores-dominio.test.ts` exige claves sin dígitos y `ui.reservas.*.vencenEn3Horas` no cumplía. Se renombró a `vencenEnTresHoras` (comando 7).

## 3. Matriz de criterios

| CA | Qué se probó | Evidencia | Estado |
|---|---|---|---|
| 1 Menú «Reservas» y cuatro totales | Ítem de primer nivel entre «Registrar pago» y «Mi caja» (como la foto), activo en `/reservas`; los demás roles no lo ven. Totales con el importe a cobrar | `Sidebar.reservas.test.tsx`; colección 01; captura 01 | Ejecutado |
| 2 Pendientes | Solo reservadas no vencidas de clases Disponibles/Completas, por vencimiento ascendente, de a 10; columnas y formatos de la foto; «en 1 h 52 min» y en rojo con ícono y texto para lectores cuando faltan ≤ 3 h; enlace a la clase | `listado-reservas.test.tsx`; colección 02 y 03; captura 01 | Ejecutado |
| 2 Vencidas sin marcar no se listan en Pendientes | Colección 02 (`faltan_min ≥ 0` en todos); la reserva preparada con vencimiento hace 1 h no figura en Pendientes y sí en Vencidas | colección 02 y 08 | Ejecutado |
| 3 Vencidas · últimos 7 días | Orden descendente, últimos 7 días, «Vencida · sin marcar todavía» (`warning`) y «Reserva vencida» (contorno rojo), con profesor y aula; solo consulta | colección 08; `listado-reservas.test.tsx`; captura 03; `reserva.pendiente.service.pg.test.ts` (profesor y aula) | Ejecutado |
| 4 Filtros | Alumno/DNI desde 2 caracteres con debounce de 300 ms (con 1 carácter no consulta: 0 consultas en el navegador), materia y «Vencen»; se combinan, vuelven a la página 1 y actualizan la URL sin recargar (`/reservas?vencen=en_3_horas`); «Limpiar filtros» vuelve a `/reservas`; 400 con parámetros inválidos | `listado-reservas.test.tsx`; rutas (comando 4); colección 04 a 07 y 09; captura 02 | Ejecutado |
| 5 Registrar pago | Navega a `/pagos/registrar?alumno=<id>&clase=<id>`, que arranca en el paso 2 con el alumno preelegido (HU-I-10). La caja abierta la exige esa pantalla | `listado-reservas.test.tsx`; captura 07 | Ejecutado (la navegación); el cobro es de HU-I-10 |
| 6 Quitar | Confirmación de C-25 con la clave de HU-C-04, el párrafo de la foto, la leyenda irreversible y el foco inicial en «Volver»; 200 con el contrato de §2.20.4; `QUITADA_CENTRO` con fecha y usuario, sin borrar; libera el lugar (`COMPLETO → DISPONIBLE` en PG); el alumno puede volver a inscribirse | colección 10 y 15; `reserva.pendiente.service.pg.test.ts`; SQL 2, 3 y 8; capturas 04 y 06 | Ejecutado |
| 6 «Ya no está pendiente» | 409 con el texto literal para pagada, ya quitada y vencida (marcada o no); sin cambios en la fila; dos «Quitar» simultáneos: uno quita y el otro recibe 409; en la pantalla, el mensaje dentro del diálogo y la fila sigue hasta cerrarlo | colección 11 a 13; PG; SQL 6; captura 05 | Ejecutado |
| 7 Pie | «El proceso automático revisa las reservas cada 5 minutos. Hoy venció 1 reserva.» con el `vencieron_hoy` del resumen | captura 03 | Ejecutado |
| 8 Solo mesa de entrada | 403 `SIN_PERMISO` para gerente y profesor en los 4 endpoints y 401 sin sesión; `/reservas` solo `MESA_ENTRADA` en `rutas-por-rol.ts` | colección 16 a 18; rutas; `rutas-por-rol.test.ts` | Ejecutado |
| §4 `turno:alumno_quitado` ampliado | `inscripcion_id` en el payload desde Reservas y desde `DELETE /api/turnos/[id]/alumnos/[alumnoId]` (HU-C-04) | colección 15b; SQL 5; PG | Ejecutado |

## 4. Nivel 3 — Base de datos (`HU-C-26.sql`)

Variables: `quitada=cmv66ecn4024cuwego40knzfo` (caso 10), `pagada=cmv668a6300j8uweggrukhxxy` (caso 12), `sin_marcar=cmv66eda1024muwegmzsueg70` (caso 13) y `quitada_2_5=cmv66ed5j024kuwegp102xh2r` (caso 15b).

- **Consulta 2:** `QUITADA_CENTRO`, `estadoPago` `RESERVADA` y `precio` 26000 conservados, `finalizadaEl` 2026-10-13 04:40:27, actor `USUARIO` = `mesa.entrada@noctium.local`. La fila existe.
- **Consulta 3:** `seed-turno-02` sigue `DISPONIBLE` (cupo 20, 3 vigentes). La transición `COMPLETO → DISPONIBLE` se prueba en PG, con una clase de cupo 1.
- **Consulta 4:** una fila nueva `VIGENTE → QUITADA_CENTRO` con actor mesa de entrada para cada quitada; ninguna fila nueva para la pagada ni para la vencida sin marcar.
- **Consulta 5:** dos `turno:alumno_quitado`, cada uno con su `inscripcion_id` (uno desde Reservas, otro desde 2.5).
- **Consulta 6:** la pagada sigue `VIGENTE`/`PAGADA` (la fila completa es idéntica, byte a byte, a la tomada antes de la colección) y la vencida sin marcar sigue `VIGENTE`/`RESERVADA`.
- **Consulta 7:** la inscripción quitada por 2.5 queda `QUITADA_CENTRO` con fecha.
- **Consulta 8:** 904 filas en `turno_alumno`, igual que antes de correr la colección (ningún `DELETE`).

**Escenario preparado** (solo en la base descartable, no forma parte del entregable): sobre las reservas del seed se movió el `venceEl` de 6 reservas de `seed-turno-02` y `seed-turno-demo-p2` a +45 min, +1 h 30 min, +2 h, +3 h, +4 h y −1 h, para tener filas en rojo y una vencida sin marcar.

## 5. Recorrido en el navegador (`capturas/`)

Chrome headless a 1366 × 900, zona del centro, sesión real de mesa de entrada:

| Captura | Qué muestra | Comparada con la foto |
|---|---|---|
| `01-pendientes.png` | Totales (159 · $ 3.462.500 a cobrar · 2 · 3 · 1), pestañas, filtros «Materia Todas» / «Vencen Cuando sea», tabla con vencimiento en monoespaciada, «en 1 h 52 min» en rojo con ícono, DNI y reservas pendientes, clase subrayada con «Programación I · Aula 2», profesor, precio y acciones | «Reservas · Pendientes»: misma estructura, columnas y cortes de línea |
| `02-pendientes-filtro-vencen-3h.png` | `vencen=en_3_horas`: 2 filas, las dos en rojo; URL actualizada sin recargar | — |
| `03-vencidas.png` | «Venció / Alumno / Clase / Profesor / Estado», etiqueta «Vencida · sin marcar todavía» y «Reserva vencida», sin «Vencen», con el pie | «Reservas · Vencidas · últimos 7 días» |
| `04-quitar-confirmacion.png` | «¿Estás seguro de que querés quitar a Santiago Gómez de Programación I del Mié 14/10 a las 10:00?», párrafo de la foto, leyenda irreversible, «Volver» (con el foco) / «Quitar de la clase» en rojo | «Quitar una reserva pendiente» (diferencia de texto en la sección 6) |
| `05-quitar-rechazo-no-pendiente.png` | La reserva se quitó por otra vía con el diálogo abierto: «Esta reserva ya no está pendiente: se pagó o venció.» dentro del diálogo | — |
| `06-despues-de-quitar.png` | Tras «Quitar de la clase»: el toast «Reserva quitada» apareció (verificado en el recorrido) y, a ~1,5 s (refresco en modo dev), la fila salió y los pendientes bajaron de 157 a 156 | — |
| `07-registrar-pago-wizard.png` | «Registrar pago» abrió `/pagos/registrar?alumno=…&clase=seed-turno-02` en el paso 2 | «Registrar pago desde Reservas» muestra un modal; se siguió la decisión C (sin modal propio, como HU-C-24) |
| `08-movil-390.png` | 390 px: totales en 2 columnas, filtros apilados, la tabla scrollea dentro de su contenedor | — |

Consola: sin errores de la aplicación. Los dos únicos mensajes son el `409 (Conflict)` del rechazo provocado a propósito, que Chrome registra para toda respuesta no-2xx.

## 6. Observaciones y diferencias con el prototipo

- **Texto de la confirmación:** la foto dice «…quitar a Sofía Acosta **de la clase de** Física I del Mar 20/10…». Se reutilizó sin cambios `confirmaciones.inscripcion.quitar` de HU-C-04 («…de Física I del…»), por la decisión B del relevamiento; el párrafo explicativo es la clave nueva `ui.reservas.quitar.detalle`.
- **Vencida sin marcar al quitar:** el task doc (sección 6) esperaba que «el propio servicio la marca primero (`RESERVA_VENCIDA`) y después rechaza». La marca ocurre, pero dentro de la misma transacción: como el rechazo la revierte, la fila queda `VIGENTE`/`RESERVADA` hasta la próxima corrida del proceso. Lo que el criterio exige se cumple igual: nunca se quita como si siguiera pendiente. Es el mismo comportamiento que `quitarAlumnoTurno` de HU-C-04. Documentado en RULES.md.
- **Vista de teléfono:** a 390 px la página tiene scroll horizontal, pero lo produce la barra superior compartida (email, rol, «Mi cuenta» y «Cerrar sesión» termina en x = 601). Pasa igual en `/caja`, que ya está en `develop`; el contenido de `/reservas` no desborda. Queda fuera del alcance de esta HU.
- **Paginación fuera de rango:** las lecturas del PR 0 no llevan una `pagina` mayor que `total_paginas` a la última (a diferencia de `/personal`): devuelven la lista vacía. No se tocó (task, sección 1).

## 7. No ejecutado

- La colección en la app de Postman o con `newman` (se corrió con el ejecutor propio).
- Run de CI sobre el SHA (no hay commit todavía).
