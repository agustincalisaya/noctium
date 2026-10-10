# HU-C-24 — Evidencia de pruebas

**Fecha:** 09/10/2026 · **Rama:** `feature/HU-C-24-vencer-reservas-sin-pago` · **Base:** HEAD `d22806d` (incluye C-22).
La existencia de la colección de Postman y del SQL no acredita resultados: solo lo marcado «Ejecutado» tiene un comando y su salida.

## 1. Comandos ejecutados

| # | Comando | Resultado | Exit |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | sin errores | 0 |
| 2 | `npx vitest run src/server/turnos/turno.detalle.test.ts src/server/turnos/turno.inscripciones.test.ts src/server/turnos/turno.participantes.test.ts src/server/turnos/turno.autoservicio.test.ts` | 4 archivos, 87 tests pasan | 0 |
| 3 | `npx vitest run src/server/turnos/reserva.vencimiento.service.test.ts src/app/api/procesos/vencer-reservas/route.test.ts` | 2 archivos, 15 tests pasan | 0 |
| 4 | `npx vitest run "src/app/api/turnos/[id]" src/server/turnos/turno.inscripciones.test.ts src/server/turnos/turno.participantes.test.ts src/server/turnos/turno.detalle.test.ts src/server/turnos/reserva.vencimiento.service.test.ts src/app/api/procesos` | 18 archivos, 261 tests pasan | 0 |
| 5 | `npx vitest run "src/app/(dashboard)/turnos"` | 15 archivos, 187 tests pasan | 0 |
| 6 | `npx vitest run src/server/publico.aislamiento.test.ts src/lib src/proxy` | 14 archivos, 201 tests pasan | 0 |
| 7 | `npx eslint` sobre los 16 archivos modificados o nuevos de código y tests | sin avisos | 0 |
| 8 | `node scripts/verificar-claves-textos.ts` | «Claves de textos verificadas.» | 0 |
| 9 | `git diff --check` | sin errores de espacios | 0 |
| 10 | `npm run test:pg -- src/server/turnos/reserva.vencimiento.pg.test.ts src/server/turnos/turno.inscripciones.pg.test.ts src/server/turnos/turno.participantes.pg.test.ts src/server/turnos/inscripcion.service.pg.test.ts src/server/turnos/turno.reservas.pg.test.ts src/server/turnos/turno.publico.pg.test.ts src/server/pagos/operacion.service.pg.test.ts src/server/pagos/correccion.service.pg.test.ts src/server/pagos/caja.service.pg.test.ts` | base descartable `noctium_pruebas_97ae8b5f`, 9 archivos, 86 tests pasan | 0 |

| 11 | Colección `HU-C-24.postman_collection.json`, 11 requests con un ejecutor propio (los scripts `test` de la colección con `chai` del proyecto; no es la app de Postman ni `newman`), contra `next dev -p 3100` y una base descartable propia (`noctium_pruebas_<8 hex>`, migraciones + seed, ya eliminada), sesiones reales por NextAuth de mesa, gerente y profesor | 11/11 requests, 33/33 tests pasan | 0 |
| 12 | `HU-C-24.sql` completo, en transacción `READ ONLY` con la guarda de base descartable, sobre la misma base, para dos clases | consultas 2 y 7 en 0 filas en ambas; historial con 1 fila por vencimiento | 0 |
| 13 | Recorrido en Chrome (`localhost:3100`) con mesa, gerente y profesor (ver sección 3 bis) | sin errores de consola | — |
| 14 | `npx vitest run "src/app/(dashboard)/turnos/[id]/turno-detalle.test.tsx"` (incluye los 4 casos de la confirmación al agregar un alumno) | 1 archivo, 39 tests pasan | 0 |
| 15 | `npx vitest run "src/app/(dashboard)/turnos" src/lib src/components/shared` | 32 archivos, 367 tests pasan | 0 |
| 16 | `npx tsc --noEmit` · `npx eslint` (tarjeta de alumnos, su test y `textos.ts`) · `node scripts/verificar-claves-textos.ts` · `git diff --check` | sin errores | 0 / 0 / 0 / 0 |
| 17 | Recorrido en Chrome de la confirmación (mesa de entrada, base descartable nueva con el mismo escenario) | ver sección 3 bis | — |

El PG corre solo con el runner de base aleatoria (`scripts/test-pg.mjs`): crea la base, aplica las migraciones, corre y la borra. No se escribió en `noctium_test` ni en una base habitual.

**Historial de fallos durante el trabajo (conservado):**
- Primera pasada PG de `turno.inscripciones.pg.test.ts`: falló la aserción «inscribe sin plazo de pago (PAGO_SIN_REGISTRAR)». Es el contrato anterior que HU-C-24 cambia por pedido del backlog; se adaptó solo esa aserción al contrato nuevo (reserva con plazo, `inscripcion` y `ofrecer_pago`).
- Primera pasada PG de `reserva.vencimiento.pg.test.ts`: 1 de 10 falló por una aserción propia mal planteada (contaba filas `VIGENTE`, y la reserva original sigue así en la columna cuando el rechazo revierte el marcado perezoso). Se corrigió la aserción.
- Segunda pasada PG: 14 fallos en 2 archivos de pagos, entre ellos `operacion.service.pg.test.ts`. Causa comprobada en ese archivo: la prueba nueva creaba una inscripción `PAGADA` sin pago y su verificación de equivalencia «Pagada ⇔ pago» (que revisa toda la base) la detectaba (`pagos: 0`). Se rehízo el caso con `crearOperacionDePrueba`; la pasada 10 los deja en verde.

## 2. No ejecutado

- `src/server/turnos/turno.reprogramacion.pg.test.ts`: el runner respondió «La base noctium_test ya existe y no es descartable: no se corren …». Ese archivo exige la base de nombre fijo `noctium_test`, que es la compartida; no se tocó. Esta HU no modifica `reprogramarTurno`.
- Suite completa de `vitest` y `test:pg`: no se corrió (verificaciones focales). Falta antes del PR.
- Vista móvil: la herramienta del navegador no estrechó el viewport (quedó en 1280 px de ancho). Sin recorrido.
- Programador local cada 5 minutos: no se dejó corriendo (cada corrida del proceso se lanzó a mano por HTTP).
- Colección en la app de Postman o con `newman`: no se ejecutó con esas herramientas.
- Run de CI del SHA: pendiente.

## 3. Matriz de criterios

| CA | Qué se probó | Evidencia | Estado |
|---|---|---|---|
| 1 Vencimiento automático | Fecha = `venceEl`, actor «Proceso automático», clase `COMPLETO` → `DISPONIBLE`, inscripción no se borra, historial después del commit, sin `eventos_turno`, idempotencia (varias corridas, historial de 1 fila), frontera inclusiva (`momento = venceEl`) | `reserva.vencimiento.pg.test.ts` (4 casos), `reserva.vencimiento.service.test.ts` (5) | Ejecutado |
| 1 Endpoint | 401 sin cabecera, secreto incorrecto, prefijo del secreto, esquema distinto, esquema vacío y sin `CRON_SECRET` configurado; mismo cuerpo del 401 en todos los casos; 200 con el contrato | `route.test.ts` (10 tests con las variantes) | Ejecutado, también por HTTP real (casos 01-04 de la colección: 401, 401, 200 con `reservas_vencidas: 2, clases_afectadas: 2` y 200 con ceros) |
| 1 Cada 5 minutos en la demostración | Mecanismo y pasos de reproducción documentados | Anexo de `docs/tasks/Sprint 3/Modulo C/HU-C-24.md` | Documentado; el programador de 5 minutos no se ejecutó |
| 1 Registro en el historial de clases (HU-E-02) y serie «Reservas vencidas» (HU-H-10) | — | — | **Diferido** a E-02 y H-10 |
| 2 Validación por `venceEl` con el proceso detenido | Con una reserva vencida sin marcar: no cuenta para el cupo (se inscribe en una clase `COMPLETO`), se marca al operar con fecha = vencimiento y actor «Proceso automático», el detalle no la lista y muestra la clase `DISPONIBLE` sin escribir | `reserva.vencimiento.pg.test.ts` (2 casos) | Ejecutado para inscribir (mesa) y detalle |
| 2 Resto de las operaciones (quitar, cancelar la clase, reprogramar, cobrar, registrar la clase dictada) | Ya cableadas por PR 0 y C-22 (`marcarVencidas` / `marcarVencidasDelAlumno`); no se modificaron en esta HU. Rechazo de cobro con `RESERVA_VENCIDA` cubierto por `operacion.service.pg.test.ts` | `operacion.service.pg.test.ts` (pasa en la pasada 10) | Sin pruebas nuevas en esta HU |
| 2 Cancelación propia (HU-C-14); mensaje en la pantalla de cobro (HU-I-10) | — | — | **Diferido** a C-14 e I-10 |
| 3 Confirmación de HU-C-25 al agregar un alumno | El mensaje aparece al elegir al alumno, con el patrón del Excel y alumno, materia, día y hora; «Volver» no inscribe; «Inscribir» sí; el rechazo del servidor se muestra en el mismo mensaje | `turno-detalle.test.tsx` (4 casos) y recorrido en Chrome | Ejecutado |
| 3 Inscripción del centro como reserva | 2.5: `RESERVADA`, plazo desde el alta, precio vigente, `inscripcion` y `ofrecer_pago`; 2.2: una reserva por alumno y `inscripciones[]`; `crearInscripcion` pasa `conReserva: true` | `reserva.vencimiento.pg.test.ts`, `turno.inscripciones.pg.test.ts`, `turno.inscripciones.test.ts`, `turno.participantes.test.ts` | Ejecutado |
| 3 Excepción de re-inscripción | 409 `INSCRIPCION_REQUIERE_PAGO` con `{ alumno_id }`, sin crear fila, con la reserva vencida sin marcar y ya marcada; en 2.2 devuelve el mismo 409 y no emite eventos | `reserva.vencimiento.pg.test.ts`, `turno.participantes.test.ts` | Ejecutado |
| 3 «Registrar pago» abre HU-I-10 con alumno y clase; creación de la inscripción al confirmar el pago | Se ofrece el enlace a `/pagos/registrar?alumno=&clase=` | `turno-detalle.test.tsx` | La pantalla y la creación al pagar son de I-10: **Diferido** |
| 4 Reservas en el detalle | `inscripcion` (`vence_el` solo si `RESERVADA`) y `puede_registrar_pago` por alumno; falso si la clase empezó o está cancelada, o sin `pagos:crear` (Gerente); omitidos sin `pagos:leer` y para el Profesor | `turno.detalle.test.ts` (7 casos), `reserva.vencimiento.pg.test.ts` (2 casos), `turno-detalle.test.tsx` (2 casos) | Ejecutado |
| 5 Plazo nuevo tras anular un pago | — | — | **Diferido** a HU-I-06 (y a N-01 para el plazo configurable) |
| 6 Clases canceladas | El proceso no toca una reserva vencida de una clase `CANCELADO` ni genera historial | `reserva.vencimiento.pg.test.ts` | Ejecutado (el marcado previo al cancelar lo cubre `turno.cancelacion.pg.test.ts` de PR 0, no ejecutado en esta pasada) |

## 3 bis. Recorrido manual (HTTP, SQL y navegador)

Datos: base descartable propia con el seed base (el seed falló al correr el fixture HU-E-04 con «HU-E-04 necesita la clase dictada del 06/01/2026 de HU-E-09»; el seed base de usuarios, materias, aulas, clases y cajas ya estaba cargado; no es de esta HU). Escenario preparado con un script propio sobre `seed-turno-01` y `seed-turno-02`: una reserva ya vencida sin marcar en cada una.

- **Colección:** el caso 05 creó una reserva `RESERVADA` con vencimiento a 24 h, precio 24000 y `ofrecer_pago: true`; el 06 respondió `409 INSCRIPCION_REQUIERE_PAGO` con el `alumno_id`; el detalle trajo `inscripcion` y `puede_registrar_pago: true` para mesa, `false` para gerente y ningún campo de pago para el profesor; los 401 sin sesión respondieron `SESION_INVALIDA`.
- **SQL:** tras el proceso, la inscripción vencida quedó `RESERVA_VENCIDA` con `finalizadaEl = venceEl`, actor `PROCESO_AUTOMATICO` y sin usuario; el historial tiene una fila por vencimiento; la clase sigue `DISPONIBLE`; la consulta 4 solo lista el evento del alta hecha por mesa. La consulta 6 falló en la primera ejecución («Failed to deserialize column of type 'interval'», limitación de Prisma con ese tipo): se casteó a texto en el archivo y pasó.
- **Navegador (mesa):** el detalle lista a los dos alumnos con «Reservada · vence 10/10/2026, 20:49» y el acceso «Registrar pago»; el alumno cuya reserva venció no figura. «Agregar alumno» por la interfaz inscribió al instante y mostró «Reservada · vence 10/10/2026, 20:51». Al intentar agregar al alumno con reserva vencida, la tarjeta mostró «El alumno ya tuvo una reserva sin pagar en esta clase: se inscribe recién al confirmar el pago.». «Registrar pago» navegó a `/pagos/registrar?alumno=…&clase=seed-turno-01` y respondió 404 (la pantalla es de I-10).
- **Navegador (gerente):** ve las reservas con su vencimiento, sin «Registrar pago», «Quitar» ni «Agregar alumno».
- **Navegador (profesor):** ve los alumnos sin reservas, precios ni pagos.

**Hallazgos del recorrido:**
1. **Confirmación al agregar un alumno: resuelto.** La spec C §2.18.3 y la convención 9 del Excel piden la confirmación de HU-C-25 antes de guardar la inscripción desde el centro; «Agregar alumno» guardaba al instante. Ahora elegir al alumno abre `ConfirmarAccionDialog` (sin modificar el componente) con el patrón del Excel («¿Estás seguro de que querés <acción> <datos concretos>?»; datos: alumno, materia, día y hora) y los botones «Volver» e «Inscribir». El Excel y la spec fijan el patrón y los datos pero no un literal para esta acción: el texto sale del patrón con la estructura del ejemplo de «quitar» de la spec §2.20. Clave `confirmaciones.inscripcion.centro` y botón `ui.turnos.reserva.inscribir` en `src/lib/textos.ts`. Sin cambios en el servidor.
   - Verificado en Chrome (mesa de entrada, `seed-turno-01`): el mensaje muestra «¿Estás seguro de que querés inscribir a Agustina Benítez en Matemática del 12/10/2026 a las 08:00?» con «Volver» e «Inscribir»; hasta confirmar el servidor no recibió ninguna alta; «Volver» cierra y la clase sigue en «0 de 10»; «Inscribir» agrega al alumno («Reservada · vence 10/10/2026, 21:05») y avisa «Alumno agregado al turno»; con el alumno que ya tuvo una reserva vencida, el rechazo («El alumno ya tuvo una reserva sin pagar en esta clase: se inscribe recién al confirmar el pago.») aparece dentro del mismo mensaje y no se guarda nada (el servidor recibió 2 altas en total: la confirmada y la rechazada).
2. **Excepción de re-inscripción sin «Registrar pago»: diferido a HU-I-10.** La spec pide ofrecer «Registrar pago» con el estado «Se inscribe al confirmar el pago»; hoy solo se muestra el texto del error.
3. **Enlace sin destino: diferido a HU-I-10.** El enlace «Registrar pago» por alumno apunta a `/pagos/registrar?alumno=<id>&clase=<id>` (armado en `turno-alumnos-card.tsx`) y responde 404 hasta que se mergee I-10.
4. **Dos accesos a «Registrar pago»: diferido a HU-I-10.** Conviven el de la tarjeta «Pago» (Sprint 2, diálogo) y el nuevo por alumno; se decide cuál queda cuando llegue I-10.

## 4. Verificaciones diferidas

- **HU-I-10:** pantalla `/pagos/registrar?alumno=<id>&clase=<id>` (es la ruta que usa hoy el enlace «Registrar pago»; responde 404); «Registrar pago» con el estado «Se inscribe al confirmar el pago» ante `INSCRIPCION_REQUIERE_PAGO`; decidir cuál de los dos «Registrar pago» del detalle queda; mensaje «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.» en esa pantalla; creación de la inscripción al confirmar el pago (excepción del criterio 3, `origen = PAGO`) y recorrido completo reserva → pago.
- **HU-C-14:** cancelación de una reserva antes del vencimiento (criterio 2) y la regla de re-reserva tras cancelar sin pago.
- **HU-I-06:** plazo nuevo después de anular el último pago (criterio 5).
- **HU-E-02 / HU-H-10:** registro «Reserva vencida» en el historial de clases y serie de reservas vencidas.
- **HU-N-01:** plazo configurable (rige el valor por defecto de 24 h).

## 5. Pendientes de Tomás

1. **Colección en Postman:** correrla en la app de Postman (o con `newman`) en una base descartable; ya se ejecutó con un ejecutor propio (11/11, 33/33). El caso 03 necesita `CRON_SECRET` en la variable `cron_secret`, sin guardarla en la colección.
2. **Programador local:** levantar el programador del anexo y comprobar una corrida real a los 5 minutos.
3. **Navegador móvil:** detalle de una clase con reservas en pantalla angosta.
4. **CI:** run del SHA del PR.
