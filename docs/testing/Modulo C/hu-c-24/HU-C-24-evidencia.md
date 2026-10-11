# HU-C-24 — Evidencia de pruebas

**Fecha:** 11/10/2026 · **Base:** `develop` con C-22 e I-10 integrados.
La existencia de la colección de Postman y del SQL no acredita resultados: solo lo marcado «Ejecutado» tiene un comando y su salida. Lo marcado «Lectura de código» se comprobó leyendo el archivo indicado, sin ejecutarlo.

## 1. Comandos ejecutados

| # | Comando | Resultado | Exit |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | sin errores | 0 |
| 2 | `npx eslint` sobre `turno-alumnos-card.tsx`, `turno-detalle.test.tsx`, `turno-wizard.test.tsx`, `participantes-turno.test.tsx`, `turno.detalle.ts`, `turno.detalle.test.ts`, `reserva.vencimiento.pg.test.ts` y `textos.ts` | sin avisos | 0 |
| 3 | `node scripts/verificar-claves-textos.ts` | «Claves de textos verificadas.» | 0 |
| 4 | `git diff --check` | sin errores de espacios | 0 |
| 5 | `npx vitest run "src/app/(dashboard)/turnos/[id]/turno-detalle.test.tsx" "src/app/(dashboard)/turnos/nuevo/turno-wizard.test.tsx" "src/app/(dashboard)/turnos/[id]/participantes/participantes-turno.test.tsx" src/server/turnos/turno.detalle.test.ts src/lib/terminologia-clases.test.ts src/components/shared/confirmar-accion-dialog.test.tsx` | 6 archivos, 155 tests pasan | 0 |
| 6 | `npx vitest run src/lib/claves-textos.test.ts src/lib/textos.test.ts "src/app/(dashboard)/turnos/[id]"` | 10 archivos, 131 tests pasan | 0 |
| 7 | `npx vitest run src/server/turnos/reserva.vencimiento.service.test.ts src/app/api/procesos src/server/turnos/turno.inscripciones.test.ts src/server/turnos/turno.participantes.test.ts` | 4 archivos, 54 tests pasan | 0 |
| 8 | `npm run test:pg -- src/server/turnos/turno.inscripciones.pg.test.ts src/server/turnos/reserva.vencimiento.pg.test.ts` | base descartable `noctium_pruebas_2d60c1da` (creada y borrada por el runner), 2 archivos, 20 tests pasan | 0 |

El PG corre solo con el runner de base aleatoria (`scripts/test-pg.mjs`): crea la base, aplica las migraciones, corre y la borra. No se escribió en `noctium_test` ni en una base habitual.

Recorridos manuales (ejecutados con una base descartable propia y sesiones reales; ver las secciones 3 bis, 3 ter y 3 quater):

| # | Recorrido | Resultado |
|---|---|---|
| 9 | Colección `HU-C-24.postman_collection.json`, 11 requests con un ejecutor propio (los scripts `test` de la colección con `chai` del proyecto; no es la app de Postman ni `newman`), contra `next dev -p 3100`, sesiones reales de mesa, gerente y profesor | 11/11 requests, 33/33 tests pasan |
| 10 | `HU-C-24.sql` completo, en transacción `READ ONLY` con la guarda de base descartable, para dos clases | consultas 2 y 7 en 0 filas en ambas; historial con 1 fila por vencimiento |
| 11 | Recorrido en el navegador de escritorio con mesa, gerente y profesor, y de la confirmación en 2.5 y 2.2 | sin errores de consola |
| 12 | Recorrido en el navegador del 11/10/2026 con I-10 integrada (`next dev -p 3100`, base descartable, sesiones reales de mesa, gerente y profesor): reserva → «Registrar pago» → pago; 409 → «Se inscribe al confirmar el pago» → «Pagada»; «Quitar» con foco en «Volver»; asistente y «Asignar profesor y alumnos»; gerente y profesor; proceso por HTTP y programador de 5 minutos (sección 3 quater) | Todos los pasos recorridos, con las diferencias de la sección 3 quater |

## 2. No ejecutado

- `src/server/turnos/turno.reprogramacion.pg.test.ts`: el runner respondió «La base noctium_test ya existe y no es descartable: no se corren …». Ese archivo exige la base de nombre fijo `noctium_test`, que es la compartida; no se tocó. Esta HU no modifica `reprogramarTurno`.
- Suite completa de `vitest` y `test:pg`: no se corrió (verificaciones focales).
- Vista móvil (390×844 y 844×390): sin recorrido.
- Colección en la app de Postman o con `newman`: no se ejecutó con esas herramientas.
- Run de CI sobre el SHA: pendiente.

## 3. Matriz de criterios

| CA | Qué se probó | Evidencia | Estado |
|---|---|---|---|
| 1 Vencimiento automático | Fecha = `venceEl`, actor «Proceso automático», clase `COMPLETO` → `DISPONIBLE`, inscripción no se borra, historial después del commit, sin `eventos_turno`, idempotencia (varias corridas, historial de 1 fila), frontera inclusiva (`momento = venceEl`) | `reserva.vencimiento.pg.test.ts` (comando 8), `reserva.vencimiento.service.test.ts` (comando 7) | Ejecutado |
| 1 Endpoint | 401 sin cabecera, secreto incorrecto, prefijo del secreto, esquema distinto, esquema vacío y sin `CRON_SECRET` configurado; mismo cuerpo del 401 en todos los casos; 200 con el contrato | `route.test.ts` (comando 7); por HTTP real, casos 01-04 de la colección: 401, 401, 200 con `reservas_vencidas: 2, clases_afectadas: 2` y 200 con ceros | Ejecutado |
| 1 Cada 5 minutos en la demostración | Bucle del anexo con el secreto de prueba en su terminal: dos corridas a 300 s, la de las 17:41:46 con 0 reservas vencidas y 0 clases afectadas, y la de las 17:46:46 con 1 y 1. La reserva de las 17:44:00 quedó `RESERVA_VENCIDA` con `finalizadaEl` igual al vencimiento y actor «Proceso automático» | Recorrido del 11/10/2026 (comando 12, sección 3 quater); mecanismo y pasos en el Anexo de `docs/tasks/Sprint 3/Modulo C/HU-C-24.md` | Ejecutado |
| 1 Registro en el historial de clases (HU-E-02) y serie «Reservas vencidas» (HU-H-10) | — | — | **Diferido** a E-02 y H-10 |
| 2 Validación por `venceEl` con el proceso detenido | Con una reserva vencida sin marcar: no cuenta para el cupo (se inscribe en una clase `COMPLETO`), se marca al operar con fecha = vencimiento y actor «Proceso automático», el detalle no la lista y muestra la clase `DISPONIBLE` sin escribir | `reserva.vencimiento.pg.test.ts` (comando 8) | Ejecutado para inscribir (mesa) y detalle |
| 2 Resto de las operaciones que escriben (pagar, quitar, cancelar la clase, reprogramar, registrar la clase dictada) | Marcan primero las vencidas con la misma condición (ver sección 4) | Lectura de código | Sin prueba ejecutada nueva |
| 2 Rechazo del pago de una reserva vencida | «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.» en el flujo de HU-I-10 | `operacion.service.ts:143` (ver sección 4) | Lectura de código; sin recorrido |
| 2 Cancelación propia (HU-C-14) | — | — | **Diferido** a C-14 |
| 3 Confirmación de HU-C-25 al agregar un alumno (2.5) | El mensaje aparece al elegir al alumno, con el patrón del Excel y alumno, materia, día y hora; «Volver» no inscribe; «Inscribir» sí y envía una sola alta aunque se pulse dos veces; el rechazo del servidor se muestra en el mismo mensaje | `turno-detalle.test.tsx` (comandos 5 y 6) y recorrido en el navegador | Ejecutado |
| 3 Confirmación de HU-C-25 al confirmar participantes (2.2) y «Registrar pago» por alumno | `turno-wizard.tsx` (paso 5) y `participantes-turno.tsx` piden la misma confirmación antes de `PATCH .../participantes`; «Volver» no guarda nada y conserva PENDIENTE y la selección; al confirmar, la pantalla de éxito ofrece «Registrar pago» hacia `/pagos/registrar?alumno=<id>&clase=<id>` por cada alumno de `inscripciones[]`; un rechazo del servidor se muestra dentro del mismo diálogo; dos clics seguidos en «Inscribir» envían un solo `PATCH` | `turno-wizard.test.tsx` y `participantes-turno.test.tsx` (comandos 5 y 6), recorrido en el navegador (sección 3 ter) | Ejecutado |
| 3 Inscripción del centro como reserva | 2.5: `RESERVADA`, plazo desde el alta, precio vigente, `inscripcion` y `ofrecer_pago`; 2.2: una reserva por alumno y `inscripciones[]`; `crearInscripcion` pasa `conReserva: true` | `reserva.vencimiento.pg.test.ts` y `turno.inscripciones.pg.test.ts` (comando 8), `turno.inscripciones.test.ts` y `turno.participantes.test.ts` (comando 7) | Ejecutado |
| 3 Excepción de re-inscripción | 409 `INSCRIPCION_REQUIERE_PAGO` con `{ alumno_id }`, sin crear fila, con la reserva vencida sin marcar y ya marcada; en 2.2 devuelve el mismo 409 y no emite eventos | `reserva.vencimiento.pg.test.ts` (comando 8), `turno.participantes.test.ts` (comando 7) | Ejecutado |
| 3 «Registrar pago» ante la excepción (2.5) | El rechazo `INSCRIPCION_REQUIERE_PAGO` muestra «Registrar pago» con el alumno y la clase elegidos (`/pagos/registrar?alumno=<id>&clase=<id>`); con otro rechazo no aparece | `turno-detalle.test.tsx` (comandos 5 y 6) | Ejecutado |
| 3 «Registrar pago» abre HU-I-10 con alumno y clase; creación de la inscripción al confirmar el pago | El enlace del rechazo 409 abre `/pagos/registrar` en el paso 2 con el alumno y la clase marcada como «Se inscribe al confirmar el pago»; al pagar, la inscripción se crea y la clase muestra al alumno «Pagada» (1 de 10). Los accesos por alumno del asistente y de «Asignar profesor y alumnos» llevan a la misma pantalla | Recorrido en el navegador (comando 12, sección 3 quater); código en la sección 4 | Ejecutado en el navegador |
| 4 Reservas en el detalle | `inscripcion` (`vence_el` solo si `RESERVADA`) y `puede_registrar_pago` por alumno; falso si la clase empezó o está cancelada, o sin `pagos:crear` (Gerente); omitidos sin `pagos:leer` y para el Profesor | `turno.detalle.test.ts` (comando 5), `reserva.vencimiento.pg.test.ts` (comando 8), `turno-detalle.test.tsx` (comando 5) | Ejecutado |
| 4/6 Reserva `RESERVADA` en una clase `CANCELADO` | El detalle devuelve `estado_pago = PAGO_SIN_REGISTRAR` y no envía `vence_el`; `puede_registrar_pago` es falso; la tarjeta muestra «Pago sin registrar», sin vencimiento ni «Registrar pago» | `turno.detalle.test.ts` y `turno-detalle.test.tsx` (comando 5), `reserva.vencimiento.pg.test.ts` (comando 8) | Ejecutado |
| 4 «Quitar» con confirmación (HU-C-25) | La confirmación muestra el texto con alumno, materia, día y hora, la leyenda «Esta acción no se puede deshacer.», el botón de peligro y el foco en «Volver»; «Volver» no envía; «Quitar» envía un solo `DELETE`, avisa y recarga; el rechazo del servidor se muestra en el mismo mensaje | `turno-detalle.test.tsx` (comandos 5 y 6) y recorrido en el navegador (sección 3 quater) | Ejecutado |
| 5 Plazo nuevo tras anular un pago | — | — | **Diferido** a HU-I-06 (y a N-01 para el plazo configurable) |
| 6 Clases canceladas | El proceso no toca una reserva vencida de una clase `CANCELADO` ni genera historial; el detalle las informa como «Pago sin registrar» y sin vencimiento | `reserva.vencimiento.pg.test.ts` (comando 8) | Ejecutado (el marcado previo al cancelar es de `turno.cancelacion.pg.test.ts`, no ejecutado en esta pasada) |

## 3 bis. Recorrido manual (HTTP, SQL y navegador)

Datos: base descartable propia con el seed base (el fixture de HU-E-04 falla en una base nueva con «HU-E-04 necesita la clase dictada del 06/01/2026 de HU-E-09»; el seed base de usuarios, materias, aulas, clases y cajas ya estaba cargado; no es de esta HU). Escenario preparado con un script propio sobre `seed-turno-01` y `seed-turno-02`: una reserva ya vencida sin marcar en cada una.

- **Colección:** el caso 05 creó una reserva `RESERVADA` con vencimiento a 24 h, precio 24000 y `ofrecer_pago: true`; el 06 respondió `409 INSCRIPCION_REQUIERE_PAGO` con el `alumno_id`; el detalle trajo `inscripcion` y `puede_registrar_pago: true` para mesa, `false` para gerente y ningún campo de pago para el profesor; los 401 sin sesión respondieron `SESION_INVALIDA`.
- **SQL:** tras el proceso, la inscripción vencida quedó `RESERVA_VENCIDA` con `finalizadaEl = venceEl`, actor `PROCESO_AUTOMATICO` y sin usuario; el historial tiene una fila por vencimiento; la clase sigue `DISPONIBLE`; la consulta 4 solo lista el evento del alta hecha por mesa. La consulta 6 falla si no se castea el intervalo a texto («Failed to deserialize column of type 'interval'», limitación de Prisma con ese tipo): el archivo ya lo castea.
- **Navegador (mesa):** el detalle lista a los dos alumnos con «Reservada · vence 10/10/2026, 20:49» y el acceso «Registrar pago»; el alumno cuya reserva venció no figura. «Agregar alumno» pide la confirmación («¿Estás seguro de que querés inscribir a Agustina Benítez en Matemática del 12/10/2026 a las 08:00?», «Volver» e «Inscribir»); hasta confirmar el servidor no recibe ninguna alta, «Volver» cierra y la clase sigue en «0 de 10», «Inscribir» agrega al alumno («Reservada · vence 10/10/2026, 21:05») y avisa «Alumno agregado a la clase». Con el alumno que ya tuvo una reserva vencida, el rechazo («El alumno ya tuvo una reserva sin pagar en esta clase: se inscribe recién al confirmar el pago.») aparece dentro del mismo mensaje y no se guarda nada.- **Navegador (gerente):** ve las reservas con su vencimiento, sin «Registrar pago», «Quitar» ni «Agregar alumno».
- **Navegador (profesor):** ve los alumnos sin reservas, precios ni pagos.

## 3 ter. Recorrido manual de la confirmación en 2.2

Base descartable propia (migrada + seed), `next dev -p 3100`, sesión real de mesa de entrada.

- **Asistente (`/turnos/nuevo`, paso 5):** Física → Julián Castro → martes 13/10/2026 15:00–16:00 → Sala grupal → 2 alumnos (Sofía Fernández, Lucas Martínez). Al tocar «Crear turno» se abrió el diálogo con el texto «¿Estás seguro de que querés inscribir a Sofía Fernández, Lucas Martínez en Física del 13/10/2026 a las 15:00?», botones «Volver» e «Inscribir». «Volver» cerró el diálogo sin enviar nada: el paso 5 quedó con los 2 alumnos y el Resumen intactos. Al confirmar con «Inscribir»: pantalla de turno confirmado con un «Registrar pago» por alumno, cada uno con su `alumno_id` y el mismo `clase_id` (`/pagos/registrar?alumno=<id-1>&clase=<turno-id>` y `?alumno=<id-2>&clase=<turno-id>`).
- **Participantes (`/turnos/[id]/participantes`):** el seed no trae ningún turno `PENDIENTE` con aula asignada; se llegó a esa precondición por la propia app (asignar aula sin profesor desde `/configuracion`, que habilita «Continuar con profesor y alumnos»). Con profesor (Vega, Carolina) y un alumno (Ruiz, Nicolás), «Confirmar turno» abrió el mismo diálogo («¿Estás seguro de que querés inscribir a Nicolás Ruiz en Química del 15/10/2026 a las 14:00?»); al confirmar, «Profesor y alumnos asignados correctamente» con «Registrar pago de Ruiz, Nicolás» hacia `/pagos/registrar?alumno=<id>&clase=seed-turno-11`.
- No se ejecutó en vivo el camino de rechazo del servidor (cubierto por los tests de componente `ALUMNO_NO_DISPONIBLE` y `TURNO_SIN_AULA`).

## 3 quater. Recorrido en el navegador con I-10 integrada (11/10/2026)

Base descartable con el seed base y un escenario propio de clases futuras: A (Disponible, con 2 reservas vigentes y 1 «Pago sin registrar»), B (con una reserva vencida y ya marcada de una alumna), C (cupo 1, guardada `COMPLETO` solo por una reserva vencida sin marcar), D (`CANCELADO`, con reservas), E (en curso) y un turno `PENDIENTE` con aula y sin profesor. Cuentas del seed de mesa de entrada, gerente y profesor; `next dev -p 3100` y secreto de prueba solo en esa terminal.

- **Mesa, clase A:** cada reserva muestra «Reservada · vence <fecha y hora>» y su «Registrar pago»; la inscripción sin pago muestra «Pago sin registrar» con su «Registrar pago». «Agregar alumno» abre «¿Estás seguro de que querés inscribir a Lucía Ramos en … del 14/10/2026 a las 19:00?» con «Volver» e «Inscribir»; «Volver» no agrega nada («3 de 10»); «Inscribir» la agrega («4 de 10», «Reservada · vence …») con el aviso «Alumno agregado a la clase».
- **409 → I-10 → pago, clase B:** al agregar a la alumna con la reserva vencida previa, el rechazo «El alumno ya tuvo una reserva sin pagar en esta clase: se inscribe recién al confirmar el pago.» aparece dentro del diálogo, con el botón «Registrar pago». El clic abre `/pagos/registrar` en el paso 2 con el alumno y la clase marcada como «Se inscribe al confirmar el pago». Con forma «Efectivo» y la confirmación «¿Estás seguro de que querés registrar el pago de $ 12.000 a nombre de …?», la pantalla informa «Pago registrado correctamente (1 clase)» y la clase B muestra a la alumna «Pagada» (1 de 10).
- **«Quitar», clase A:** la confirmación muestra «¿Estás seguro de que querés quitar a Lucía Ramos de … del 14/10/2026 a las 19:00?», «Esta acción no se puede deshacer.», el botón «Quitar» en rojo y el foco inicial en «Volver» (comprobado con `document.activeElement`). «Volver» no quita; «Quitar» la saca y avisa «Alumno quitado de la clase».
- **Clase D cancelada:** las dos reservas figuran «Pago sin registrar», sin vencimiento, sin «Registrar pago» por alumno ni «Quitar», y la tarjeta «Pago» no ofrece botón. **Clase E en curso:** la inscripción figura «Pago sin registrar» sin «Registrar pago» por alumno.
- **Clase C (proceso detenido):** el detalle la muestra Disponible, «0 de 1», sin el alumno de la reserva vencida, con la clase guardada `COMPLETO`.
- **Asistente (`/turnos/nuevo`):** con 2 alumnos, «Crear clase» abre «¿Estás seguro de que querés inscribir a Emilia Acosta, Zoe Aguirre en Bases de Datos del 14/10/2026 a las 14:00?»; «Volver» deja el paso 5 y el Resumen intactos; «Inscribir» muestra la clase confirmada, Disponible, con un «Registrar pago» por alumno.
- **«Asignar profesor y alumnos»:** con profesor y un alumno, «Confirmar clase» abre el mismo diálogo; «Volver» conserva el formulario; «Inscribir» muestra «Profesor y alumnos asignados correctamente», «Clase confirmada» y «Registrar pago» junto al alumno.
- **Gerente y profesor:** el gerente ve los vencimientos y estados sin «Registrar pago», «Quitar» ni «Agregar alumno», y sin botón en la tarjeta «Pago». El profesor ve los alumnos sin reservas, precios, tarjeta «Pago» ni acciones de cobro.
- **Proceso por HTTP:** sin cabecera y con secreto incorrecto, `401` con el mismo cuerpo; con el secreto de prueba, `200` con `reservas_vencidas: 2` y `clases_afectadas: 2`; una segunda llamada seguida, `0` y `0`. La clase C quedó guardada `DISPONIBLE`, las dos reservas `RESERVA_VENCIDA` con `finalizadaEl` igual al vencimiento y actor `PROCESO_AUTOMATICO`, y el historial sumó 2 filas. La ficha del alumno de la clase C, pestaña «Clases», muestra «Reserva vencida: 1» con la fila de esa clase.
- **Programador de 5 minutos:** bucle del anexo, corridas a las 17:41:46 (`0` y `0`; la reserva de las 17:44:00 todavía no vencía) y a las 17:46:46 (`1` y `1`). La reserva quedó `RESERVA_VENCIDA` con `finalizadaEl` 17:44:00 y actor `PROCESO_AUTOMATICO`; la clase muestra «0 de 10».

Observaciones del recorrido:
- En la clase en curso, la tarjeta «Pago» conserva el botón «Registrar pago» habilitado, y abre el diálogo anterior (Alumno, Monto, Forma de pago, Fecha), no el flujo de HU-I-10. Ver la sección 5.
- La pantalla de éxito del asistente dice «Clase creado correctamente.».
- Las confirmaciones de C-24 nombran «Nombre Apellido» y la confirmación del pago de I-10 «Apellido, Nombre».
- No se recorrió la cuenta de un alumno («Mis clases»), la vista móvil ni una reserva vencida en una clase cancelada.

## 4. Verificaciones por lectura de código

Comprobaciones sin ejecución, hechas leyendo el archivo indicado.

| Tema | Resultado | Archivo:línea |
|---|---|---|
| Pantalla de HU-I-10 y parámetros | La ruta `/pagos/registrar` existe y acepta `alumno` y `clase`; `clase` solo se toma si viene `alumno` | `src/app/(dashboard)/pagos/registrar/page.tsx:5-9` |
| Enlaces de C-24 | Los tres usan `/pagos/registrar?alumno=<id>&clase=<id>`, igual que la pantalla | `turno-alumnos-card.tsx:133` y `:194`, `participantes-turno.tsx:117`, `turno-wizard.tsx:386` |
| Clase donde el alumno no está inscripto | La pantalla la lista como «Se inscribe al confirmar el pago» (`SE_INSCRIBE_AL_PAGAR`) si corresponde cobrarla (clase `DISPONIBLE`/`COMPLETO`, que no empezó, con la exigencia de pagar para inscribirse) | `src/server/pagos/pago.service.ts:141-175`, `src/lib/textos.ts:862`, `estado-pago-badge.tsx:21` |
| Datos que usa «Registrar pago» ante el 409 | El 409 es `INSCRIPCION_REQUIERE_PAGO` con `{ alumno_id }`; la tarjeta ya conoce el alumno elegido y la clase, y solo necesita el código | `src/server/turnos/inscripcion.service.ts:343`, `src/server/shared/errores-dominio.ts:45`, `turno-alumnos-card.tsx:75` |
| Criterio 2: «Solicitar clase» | Ofrece las clases `DISPONIBLE` y `COMPLETO` y decide por la ocupación vigente (una clase completa solo por reservas vencidas se ofrece) | `src/server/turnos/turno.service.ts:528-549` |
| Criterio 2: estado Disponible/Completa mostrado | Se calcula con la ocupación vigente | `turno.service.ts:134` (Mis clases), `:639` (detalle y listado, con `incluirTurno` en `:48` y `:702`), `turno.publico.ts:106` y `:212`, `calendario.service.ts:133` |
| Criterio 2: inscribir | Marca antes las vencidas del alumno en otras clases y las de la clase destino | `src/server/turnos/inscripcion.service.ts:300` y `:313` |
| Criterio 2: pagar | Marca antes las vencidas de las clases cobradas y del alumno | `src/server/pagos/operacion.service.ts:110-111` |
| Criterio 2: quitar | Marca antes las vencidas de la clase | `src/server/turnos/turno.service.ts:595` |
| Criterio 2: cancelar la clase | Marca antes las vencidas (si la clase no es `PENDIENTE`) | `src/server/turnos/turno.cancelacion.service.ts:49` |
| Criterio 2: registrar la clase dictada | Marca antes las vencidas en los dos caminos de registro | `src/server/historial/clase-dictada.service.ts:116` y `:146` |
| Criterio 2: reprogramar | Marca antes las vencidas y recalcula el vencimiento de las que siguen | `src/server/turnos/turno.reprogramacion.service.ts:165`, `inscripcion.service.ts:222-225` |
| Criterio 2: desactivar al alumno | No hay operación sobre inscripciones en el módulo de alumnos: depende de HU-B-07 | `src/server/alumnos` (sin referencias a `turnoAlumno`) |
| Criterio 2: cancelar su inscripción (alumno) | Sin implementar: depende de HU-C-14 | — |
| Criterio 2: fecha y actor de lo marcado | `finalizadaEl = venceEl`, actor `PROCESO_AUTOMATICO`, sin usuario | `src/server/turnos/inscripcion.service.ts:174-175` |
| Criterio 2: rechazo del pago vencido | El flujo de HU-I-10 (modo `completo`) responde «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.»; el diálogo de Sprint 2 (modo de compatibilidad) responde con el mensaje de alumno no inscripto | `src/server/pagos/operacion.service.ts:143`, `src/lib/textos.ts:1292`, `src/server/pagos/pago.service.ts:55` y `:197` |
| Criterio 3: «Registrar pago» al terminar la inscripción | 2.5: el alumno agregado aparece en la lista con su acceso por alumno al recargar el detalle; 2.2: un acceso por alumno en la pantalla de éxito | `turno-alumnos-card.tsx:133`, `turno-wizard.tsx:386`, `participantes-turno.tsx:117` |
| Criterio 4 / HU-I-10 criterio 9: accesos del detalle | Conviven la tarjeta «Pago» (diálogo de Sprint 2: `GET /api/pagos/opciones` y `POST /api/pagos`) y el acceso por alumno (flujo de HU-I-10). El atajo del detalle está definido en la spec I §2.8: abre el flujo de HU-I-10 y se ofrece solo en clases que no empezaron (`puede_registrar_pago`). La tarjeta usa `acciones_habilitadas.registrar_pago`, por eso hoy sigue habilitada en clases iniciadas | `turno-detalle.tsx:72-77`, `registrar-pago-dialog.tsx:52` y `:120`, `turno-alumnos-card.tsx:133` |

## 5. Verificaciones diferidas

- **HU-I-10 (lectura de código):** el mensaje «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.» en la pantalla de cobro (`operacion.service.ts:143`); no se recorrió en el navegador.
- **HU-I-10 (atajo del detalle):** el atajo «Registrar pago» está definido en la spec I §2.8 (abre el flujo de HU-I-10, solo en clases que no empezaron). Hoy la tarjeta «Pago» abre el diálogo anterior y sigue habilitada en clases iniciadas. Pendiente de HU-I-10.
- **HU-C-14:** cancelación de una reserva antes del vencimiento (criterio 2) y la regla de re-reserva tras cancelar sin pago.
- **HU-I-06:** plazo nuevo después de anular el último pago (criterio 5).
- **HU-E-02 / HU-H-10:** registro «Reserva vencida» en el historial de clases y serie de reservas vencidas.
- **HU-N-01:** plazo configurable (rige el valor por defecto de 24 h).

## 6. Pendientes de Tomás

1. **Colección en Postman:** correrla en la app de Postman (o con `newman`) en una base descartable; ya se ejecutó con un ejecutor propio (11/11, 33/33). El caso 03 necesita `CRON_SECRET` en la variable `cron_secret`, sin guardarla en la colección.
2. **Navegador móvil:** detalle de una clase con reservas en pantalla angosta (390×844 y 844×390).
3. **CI:** run del SHA.
