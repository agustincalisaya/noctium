# TASK: HU-C-24 — Vencer las reservas sin pago y gestionarlas desde mesa de entrada

**Módulo:** C (Gestionar turnos) · **Sprint:** 3 · **SP estimado:** 2.
**Contrato de referencia:** spec C §2.18.1–2.18.7, §2.16, §2.17.3 y reglas §3.14–3.20; PR 0 §2.2, §2.10, §2.11, §2.13 y §5.2–5.5. Excel G37–G42/I37, convenciones y «Cierre de pendientes» (dueño del proceso, Pendiente 14).
**RBAC:** sin permisos nuevos. El proceso no usa sesión (única excepción documentada a la Regla N.° 10). `pagos:leer` y `pagos:crear` existentes gobiernan los campos nuevos del detalle de la clase.
**Schema:** completo por PR 0; sin migraciones, cambios de seed ni dependencias.

---

## 0. Relevamiento previo a implementación

Base: `develop` con C-22 (#230) e I-10 integrados.

Archivos existentes a modificar:
- `src/server/turnos/inscripcion.service.ts`: `crearInscripcion` aplica `exigeInscripcionConPago` también al origen CENTRO con reserva (hoy solo ALUMNO).
- `src/server/turnos/turno.service.ts`: el centro inscribe con `conReserva = true` (2.5 agregar y 2.2 confirmar) y las respuestas suman `inscripcion` / `inscripciones` y `ofrecer_pago`.
- `src/server/turnos/turno.detalle.ts`: `inscripcion` y `puede_registrar_pago` por alumno del detalle.
- `src/types/turno.types.ts`: tipos de los campos nuevos.
- `src/lib/textos.ts`: textos nuevos del detalle de la clase y de la confirmación al inscribir.
- `src/app/(dashboard)/turnos/[id]/turno-alumnos-card.tsx`: reserva, vencimiento y acceso a «Registrar pago»; confirmación de HU-C-25 al agregar y al quitar un alumno; «Registrar pago» en el rechazo `INSCRIPCION_REQUIERE_PAGO`.
- `src/app/(dashboard)/turnos/nuevo/turno-wizard.tsx` y `src/app/(dashboard)/turnos/[id]/participantes/participantes-turno.tsx`: confirmación de HU-C-25 antes de inscribir en 2.2 y acceso a «Registrar pago» por alumno en la pantalla de éxito.
- Tests de 2.5 y 2.2 que fijaban la inscripción del centro «sin plazo»: se adaptan solo esas aserciones.

Archivos nuevos:
- `src/server/turnos/reserva.vencimiento.service.ts` y su test.
- `src/app/api/procesos/vencer-reservas/route.ts` y su test.
- `src/server/turnos/reserva.vencimiento.pg.test.ts`.
- `docs/tasks/Sprint 3/Modulo C/HU-C-24.md` (este archivo).
- `docs/testing/hu-c-24/HU-C-24.postman_collection.json`, `HU-C-24.sql` y `HU-C-24-evidencia.md`.

**Puntos detectados:**
- No existe documento independiente de developers. El disparo del proceso queda como **Anexo** al final de esta task.
- I-10 está en `develop`: la pantalla `/pagos/registrar` acepta `alumno` y `clase` preelegidos (`?alumno=<id>&clase=<id>`; `clase` solo se toma si viene `alumno`) y, para una clase donde el alumno no está inscripto y que corresponde cobrar, la lista con el estado «Se inscribe al confirmar el pago». El recorrido reserva → «Registrar pago» → pago se ejecutó en el navegador (`HU-C-24-evidencia.md`, sección 3 quater).
- El contrato del detalle (spec §2.18.4) define `inscripcion` y `puede_registrar_pago` dentro de cada elemento de `alumnos[]`; no hay un campo `reservas` aparte.
- La ruta del proceso figuraba «a confirmar contra el código»: no existe ninguna ruta bajo `/api/procesos` y el `matcher` de `src/proxy.ts` solo cubre rutas de pantalla, así que `POST /api/procesos/vencer-reservas` queda fuera del control de sesión sin tocar el proxy.

---

## 1. Nota de alcance

C-24 agrega el proceso programado, completa el modelo de reserva del lado del centro (`conReserva = true`) y expone en el detalle de la clase qué reservas hay pendientes. La validación por `venceEl` (criterio 2) ya la traen PR 0 y C-22 en cada operación que escribe sobre las inscripciones de una clase; esta task la **prueba con el proceso detenido** y no la reimplementa.

«Registrar pago» se reparte así: C-24 ofrece la acción (al terminar la inscripción, en el rechazo `INSCRIPCION_REQUIERE_PAGO` y como acceso directo por alumno en el detalle) y expone `puede_registrar_pago`; el registro del pago, su pantalla y el mensaje de reserva vencida son de HU-I-10. La acción apunta a la pantalla de HU-I-10 (`/pagos/registrar?alumno=<id>&clase=<id>`).

**Fuera de alcance de esta task (explícito):**
- HU-I-10: pantalla y registro del pago, y la creación de la inscripción al confirmar el pago (`origen = PAGO`); C-24 solo ofrece el enlace.
- HU-I-06: la anulación del último pago y el plazo nuevo (criterio 5); solo se verifica cuando esté.
- HU-C-14, HU-E-02, HU-H-10, HU-N-01: verificaciones diferidas de los criterios 1, 2 y 5.
- «Quitar» por reserva de la pantalla de reservas pendientes de todas las clases (C-26).
- El atajo «Registrar pago» de la tarjeta «Pago» del detalle de la clase (spec I §2.8) es de HU-I-10 (sección 8.2, c).
- Cola de reintentos, bloqueo global entre corridas, métricas o cualquier infraestructura de planificación.
- Migraciones, seed, permisos, dependencias y `package.json`.

**Límites declarados (no se cubren con código):**
- Dos corridas simultáneas no se coordinan entre sí: la condición atómica de `marcarVencidas` garantiza que una reserva se marca una sola vez, y la segunda corrida devuelve ceros para esa clase.
- Una clase que falla se registra en el log del servidor y se reintenta en la corrida siguiente; la respuesta no distingue corridas parciales.
- El proceso no corre solo: sin el programador del Anexo, las reservas vencidas se tratan como vencidas igual (criterio 2) pero no se marcan hasta la próxima operación sobre la clase.

---

## 2. Historia de Usuario

**Como** Personal de mesa de entrada.
**Necesito** Que las reservas sin pago venzan solas y poder ver y cobrar las reservas pendientes desde el centro.
**Para** Liberar a tiempo los lugares que no se pagan y que lo que se reserva en el mostrador siga la misma regla.

**SP estimado:** 2.

### Criterios de aceptación — Excel G37–G42

1. **Vencimiento automático.** Un proceso programado revisa las reservas cada 5 minutos. Una reserva sin pago cuya fecha y hora de vencimiento ya pasó se cancela: se libera el lugar (una clase Completa vuelve a Disponible) y la inscripción no se borra, queda registrada como «Reserva vencida» con fecha y hora. El proceso es idempotente. Las fechas se calculan en la zona horaria del centro. Corre en el entorno reproducible de demostración (puede ser local). El endpoint no usa sesión: se autentica con un secreto de variables de entorno, rechaza con 401 cualquier llamada sin ese secreto y registra cada vencimiento con el actor «Proceso automático». Es la única excepción documentada a la Regla N.° 10.
2. **Validación por fecha de vencimiento.** Toda operación que dependa de una reserva compara contra `venceEl`, no contra el estado que dejó el proceso. Se prueba con el proceso detenido. Registrar el pago de una reserva vencida informa «La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.». Las operaciones que escriben sobre las inscripciones de una clase marcan primero las vencidas con la misma condición atómica (Regla N.° 7), con fecha = vencimiento y usuario «Proceso automático».
3. **Inscripción desde el centro.** Al terminar la inscripción se ofrece «Registrar pago» (abre HU-I-10 con el alumno y la clase elegidos); si no se paga, queda como reserva con el mismo plazo. Excepción: si el alumno ya tuvo en esa clase una reserva vencida o cancelada sin pago, la inscripción se crea recién al confirmar el pago. Con varios alumnos, «Registrar pago» se ofrece junto a cada uno. La inscripción guarda el precio vigente al inscribir.
4. **Reservas en el detalle.** En el detalle de una clase Disponible o Completa que todavía no empezó, mesa de entrada ve qué alumnos tienen la reserva pendiente y cuándo vence, con acceso directo a «Registrar pago». En una clase que ya empezó o está Cancelada no se ofrece cobro.
5. **Plazo nuevo después de una anulación.** La ejecuta HU-I-06 (verificación diferida).
6. **Clases canceladas por el centro.** El proceso y la validación solo vencen reservas de clases Disponibles o Completas; al cancelar la clase se marcan antes las ya vencidas y las demás dejan de vencer.

**Secuencia y diferidas — Excel I37:** criterio 5 con HU-I-06 (plazo configurable con HU-N-01); serie «Reservas vencidas» del criterio 1 con HU-H-10; registro «Reserva vencida» en el historial con HU-E-02; cancelación del criterio 2 con HU-C-14. C-22, I-10 y C-24 son una unidad de entrega: orden de merge PR 0 → C-22 → I-10 → C-24 → I-11.

---

## 3. Alcance de esta task

Backend (proceso, ruta, `conReserva` del centro, campos del detalle) y la parte de UI del detalle de la clase que muestra la reserva y ofrece la acción. Conforme a `spec_modulo_C.md` §2.18. Incluye:
- Servicio `vencerReservas` sobre `marcarVencidas` del PR 0.
- Route Handler `POST /api/procesos/vencer-reservas` con `CRON_SECRET`.
- `crearInscripcion(origen = CENTRO, conReserva = true)` en 2.5 y 2.2, con `ofrecer_pago` y `409 INSCRIPCION_REQUIERE_PAGO`.
- `inscripcion` y `puede_registrar_pago` en `GET /api/turnos/[id]`.
- Anexo de disparo del proceso.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): lo listado como fuera de alcance en la sección 1.

---

## 4. Contrato Backend

### 4.1. Schema Zod

La ruta del proceso no recibe body ni query: no hay schema. 2.5 y 2.2 conservan sus schemas.

### 4.2. Servicio

**Archivo:** `src/server/turnos/reserva.vencimiento.service.ts`
**Función:** `vencerReservas(momento = ahora()): Promise<{ reservasVencidas: number; clasesAfectadas: number; ejecutadoEl: Date }>`

1. Lee, sin bloquear, `clasesConReservasVencidas(prisma, momento)` (clases Disponibles o Completas con alguna reserva vencida sin marcar, por id ascendente). No reescribe la condición de vencimiento.
2. Por cada clase abre una `transaccion` y llama a `marcarVencidas(tx, id, { momento })`, que bloquea la clase, actualiza con la condición atómica `vigencia = VIGENTE AND estadoPago = RESERVADA AND venceEl <= momento`, recalcula `Turno.estado` y encola el historial (actor «Proceso automático», fecha = `venceEl`) para después del commit.
3. Si una clase falla, registra el error y sigue con las demás; la corrida siguiente la reintenta.
4. Devuelve los totales de reservas y de clases efectivamente afectadas.

Idempotente: una reserva ya vencida no cumple la condición atómica. No toca clases Canceladas ni Pendientes, reservas pagadas ni pagos. No escribe `eventos_turno` (su `usuarioId` es obligatorio).

**Inscripción del centro** (`inscripcion.service.ts`, `turno.service.ts`): `crearInscripcion` con `origen = CENTRO` y `conReserva = true` consulta `exigeInscripcionConPago`; si exige, lanza `INSCRIPCION_REQUIERE_PAGO` (409) con `{ alumno_id }`. En 2.2 el caso no puede darse (la clase es nueva); por seguridad devuelve el mismo 409 y revierte la confirmación.

**Detalle** (`turno.detalle.ts`): para inscripciones vigentes y solo con `pagos:leer` (el Profesor no recibe precios), cada alumno suma `inscripcion: { id, estado_pago, vence_el, precio }` y `puede_registrar_pago`, verdadero solo en clase Disponible/Completa que no empezó, con inscripción `RESERVADA` no vencida o `PAGO_SIN_REGISTRAR`, y con `pagos:crear`. En una clase `CANCELADO`, una reserva `RESERVADA` se informa con `estado_pago = PAGO_SIN_REGISTRAR` y sin `vence_el` (las reservas de una clase cancelada dejan de vencer, §2.18.6; estado informativo según §2.17.4). `acciones_habilitadas.registrar_pago` conserva su condición de Sprint 2.

**Errores de servicio:** `INSCRIPCION_REQUIERE_PAGO` (409, ya en el catálogo central).

### 4.3. Route Handler

**Archivo:** `src/app/api/procesos/vencer-reservas/route.ts`
**Método:** `POST`, sin body.
**Acceso:** sin sesión ni `withPermission` (excepción a la Regla N.° 10). Exige `Authorization: Bearer <CRON_SECRET>` con el secreto leído de la variable de entorno y comparado en tiempo constante. Sin secreto configurado, sin cabecera o con un valor distinto: `401` sin ejecutar nada ni revelar el motivo.

`200`: `{ "data": { "reservas_vencidas": n, "clases_afectadas": n, "ejecutado_el": "<ISO -03:00>" }, "error": null }`. Sin nada que vencer, ceros.

### 4.4. Server Action

No aplica: el proceso y el detalle se exponen por Route Handlers.

### 4.5. Trazabilidad / Auditoría (Regla N.° 2)

Patrón (a)+(historial de PR 0): cada vencimiento deja `finalizadaEl = venceEl`, `finalizadaPorActorTipo = PROCESO_AUTOMATICO` en la inscripción y una fila en `HistorialInscripcion` escrita después del commit. No se escribe `eventos_turno`: es la opción (b) de la Regla N.° 2 (tabla de eventos por dominio), que esta HU no necesita porque el patrón (a) + historial ya cubre qué, cuándo y quién; elegir (a) sobre (b) no es una excepción (Regla N.° 2 no la exige). La única excepción documentada de esta HU es la del endpoint a la Regla N.° 10 (§4.3): no usa sesión porque el proceso no es un usuario, y se autentica con `CRON_SECRET`.

---

## 5. Frontend

- `turno-alumnos-card.tsx`: cada alumno con `inscripcion` muestra su situación («Reservada · vence <fecha y hora>», «Pagada», «Pago sin registrar») y, si `puede_registrar_pago`, la acción «Registrar pago» hacia `/pagos/registrar?alumno=<id>&clase=<id>` (pantalla de HU-I-10).
- «Quitar» pide antes la confirmación de HU-C-25 con `ConfirmarAccionDialog` en su variante `irreversible`: «¿Estás seguro de que querés quitar a <Nombre Apellido> de <Materia> del <dd/mm/aaaa> a las <hh:mm>?», la leyenda «Esta acción no se puede deshacer.», botón de peligro y foco inicial en «Volver»; botones «Volver» y «Quitar»; «Volver» no envía nada y el rechazo del servidor se muestra dentro del mismo mensaje (HU-C-25, criterios 3, 4 y 6, y convención 9). Texto en `confirmaciones.inscripcion.quitar`.
- «Agregar alumno» pide antes la confirmación de HU-C-25 con `ConfirmarAccionDialog` (sin modificar el componente): «¿Estás seguro de que querés inscribir a <Nombre Apellido> en <Materia> del <dd/mm/aaaa> a las <hh:mm>?», botones «Volver» e «Inscribir», y el motivo del rechazo del servidor dentro del mismo mensaje. Texto en `confirmaciones.inscripcion.centro`; el patrón y los datos salen del Excel (HU-C-25, criterios 1, 2 y 6) y de la spec §2.18.3. Si el rechazo es `INSCRIPCION_REQUIERE_PAGO` (el alumno ya tuvo en esa clase una reserva vencida o cancelada sin pago), el mensaje suma la acción «Registrar pago» hacia `/pagos/registrar?alumno=<id>&clase=<id>`; la inscripción se crea al confirmar el pago en HU-I-10.
- **2.2 confirmar** (`turno-wizard.tsx`, paso 5 «Crear turno», y `participantes-turno.tsx`, «Confirmar turno»): antes de `PATCH .../participantes` se pide la misma confirmación de HU-C-25, reusando `confirmaciones.inscripcion.centro` con los alumnos de la operación unidos por coma («Nombre Apellido, Nombre Apellido»), la materia, la fecha y la hora. Con el turno confirmado, la respuesta trae `inscripciones[]` (C §2.18.3) y la pantalla de éxito ofrece «Registrar pago» junto a cada alumno recién inscripto, hacia `/pagos/registrar?alumno=<id>&clase=<id>` (pantalla de HU-I-10). El Excel no fija un texto literal para la confirmación de varios alumnos a la vez (solo para «Agregar alumno», uno a la vez): se reutiliza el mismo patrón y componente, conforme a la convención 9 (ninguna operación modificada en el sprint guarda sin el mensaje de HU-C-25) y al criterio 7 de HU-C-25 (las confirmaciones nuevas o modificadas del sprint pasan por el componente común). Ver sección 8.
- En 2.2 no se ofrece «Registrar pago» ante `INSCRIPCION_REQUIERE_PAGO`: con la clase nueva el caso no puede darse (§2.18.3).
- Textos en `src/lib/textos.ts`, «clase» y estados en femenino; tokens de DESIGN.md.

**Fuera de alcance de frontend:** la pantalla `/pagos/registrar` (HU-I-10).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- `vencerReservas`: sin clases con vencidas → ceros; varias clases → una transacción por clase y totales correctos; una clase que falla no frena a las demás; el momento recibido se usa para todas.
- Route: sin cabecera, sin secreto configurado, secreto distinto o esquema distinto de Bearer → 401 sin invocar el servicio; secreto correcto → 200 con el contrato.
- Componente (`turno-alumnos-card.tsx`, «Agregar alumno» 2.5): al elegir un alumno aparece la confirmación con alumno, materia, día y hora; «Volver» no inscribe; «Inscribir» envía el alta, avisa y recarga; un rechazo del servidor se muestra en el mismo mensaje; con `INSCRIPCION_REQUIERE_PAGO` el mensaje suma «Registrar pago» con el alumno y la clase, y con otro rechazo no; dos clics seguidos en «Inscribir» envían una sola alta.
- Componente (`turno-detalle.test.tsx`, «Quitar»): abre la confirmación con el texto, la leyenda, el botón de peligro y el foco en «Volver», sin quitar todavía; «Volver» no envía; «Quitar» envía un solo `DELETE`, avisa y recarga; un rechazo del servidor se muestra en el mismo mensaje; dos clics seguidos envían un solo `DELETE`.
- Componente (`turno-wizard.test.tsx`, paso 5 «Crear turno» 2.2): la confirmación muestra los alumnos, la materia, la fecha y la hora; «Volver» no envía el PATCH y conserva la selección; al confirmar se ofrece «Registrar pago» por cada alumno en la pantalla de éxito; un rechazo del servidor (`ALUMNO_NO_DISPONIBLE`, `TURNO_SIN_AULA`) se muestra en el diálogo sin perder PENDIENTE ni la selección; dos clics seguidos en «Inscribir» envían un solo `PATCH`.
- Componente (`participantes-turno.test.tsx`, «Confirmar turno» 2.2): mismo patrón que el wizard — confirmación antes de guardar, «Volver» sin PATCH, «Registrar pago» por alumno al confirmar, rechazo del servidor mostrado en el diálogo y en el alumno en conflicto, y dos clics seguidos en «Inscribir» con un solo `PATCH`.
- Detalle: `inscripcion` y `puede_registrar_pago` según rol, estado de la clase, inicio y vencimiento; el Profesor no recibe los campos; una reserva `RESERVADA` de una clase `CANCELADO` sale con `estado_pago = PAGO_SIN_REGISTRAR` y sin `vence_el` (unitario y PostgreSQL), y la tarjeta la muestra como «Pago sin registrar», sin vencimiento ni acceso a cobro.
- `crearInscripcion` del centro: reserva con plazo y precio; `INSCRIPCION_REQUIERE_PAGO` con `{ alumno_id }`.

### Nivel 2 — Postman
`docs/testing/hu-c-24/HU-C-24.postman_collection.json`: proceso sin secreto y con secreto erróneo (401), con secreto correcto (200); 2.5 agregar con `ofrecer_pago`; 409 `INSCRIPCION_REQUIERE_PAGO`; detalle con y sin permiso de pagos. Sin secretos ni cookies en la colección.

### Nivel 3 — BD / TablePlus
- `npm run test:pg -- src/server/turnos/reserva.vencimiento.pg.test.ts` (base descartable aleatoria): vencimiento con fecha = `venceEl` y actor «Proceso automático»; clase Completa vuelve a Disponible; idempotencia; clase Cancelada intacta; reserva pagada intacta; **operaciones con el proceso detenido** (cupo, inscripción, cobro y listados tratan la reserva vencida como vencida).
- `docs/testing/hu-c-24/HU-C-24.sql`: consultas de solo lectura.

**Matriz CA, comandos, exit codes, omisiones y pendientes:** `docs/testing/hu-c-24/HU-C-24-evidencia.md`.

**Recorrido en el navegador con I-10 integrada:** reserva → «Registrar pago» → pago, y la excepción del criterio 3 (409 → «Se inscribe al confirmar el pago» → «Pagada») están ejecutados (`HU-C-24-evidencia.md`, sección 3 quater). El mensaje `La reserva venció…` en la pantalla de cobro se verificó por lectura de código (`operacion.service.ts:143`), sin recorrido.

**Diferido a otras HU:** con I-06, el criterio 5; con C-14, la cancelación del criterio 2; con E-02 y H-10, el historial y la serie de vencidas; con N-01, el plazo configurable.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) y estado Git comprobados.
- [x] Servicio y Route Handler implementados, sin lógica de negocio en la ruta; action no aplica.
- [x] Endpoint con `{ data, error }`, 401 sin revelar el motivo y comparación en tiempo constante.
- [x] Historial escrito después del commit; sin `eventos_turno`; sin `DELETE` físico.
- [x] `conReserva = true` en 2.5 y 2.2, con `ofrecer_pago` y `409 INSCRIPCION_REQUIERE_PAGO`.
- [x] Campos del detalle de la clase con sus reglas por rol.
- [x] Frontend del detalle: reserva, vencimiento y acceso a «Registrar pago»; «Quitar» sin cambios.
- [x] Confirmación de HU-C-25 al inscribir desde el centro en 2.5 (`turno-alumnos-card.tsx`) y en 2.2 (`turno-wizard.tsx`, `participantes-turno.tsx`); componente común, textos en el catálogo.
- [x] Confirmación de HU-C-25 al quitar un alumno (`turno-alumnos-card.tsx`), con leyenda, botón de peligro y foco en «Volver».
- [x] Pantalla de éxito de 2.2 ofrece «Registrar pago» por cada alumno recién inscripto, con `inscripciones[]` de la respuesta.
- [x] «Agregar alumno» ofrece «Registrar pago» en el rechazo `INSCRIPCION_REQUIERE_PAGO`, hacia la pantalla de HU-I-10.
- [x] Dos clics seguidos en la confirmación envían una sola petición en «Agregar alumno», «Quitar» y 2.2 (wizard y «Asignar profesor y alumnos»).
- [x] Una reserva de una clase cancelada se informa como «Pago sin registrar» y sin vencimiento en el contrato del detalle y en la tarjeta.
- [x] Ninguna migración, seed, dependencia ni permiso nuevo.
- [x] Textos nuevos en el archivo central; `verificar-claves-textos` aprobado.
- [x] Pantalla `/pagos/registrar` de HU-I-10 integrada en `develop` y enlaces de C-24 con los mismos parámetros (`alumno`, `clase`).
- [x] Anexo del proceso con la definición de `CRON_SECRET` para Git Bash y PowerShell.
- [x] Diff del cierre acotado a esta HU.
- [x] Tres niveles con evidencia: unitarios, PG, HTTP con sesión real (11/11), SQL manual y navegador de escritorio ejecutados; vista móvil pendiente (ver `HU-C-24-evidencia.md`).
- [x] Programador local cada 5 minutos ejecutado: dos corridas a 300 s (17:41:46 con 0 y 0; 17:46:46 con 1 y 1).
- [x] Recorrido en el navegador con I-10 integrada: reserva → «Registrar pago» → pago y excepción del criterio 3 (409 → «Se inscribe al confirmar el pago» → «Pagada»).
- [ ] Verificaciones diferidas a I-06, C-14, E-02, H-10 y N-01 (listadas en la evidencia).
- [ ] Atajo «Registrar pago» del detalle (HU-I-10, spec I §2.8) y revisión con el PO del texto de varios alumnos y de la leyenda de «Quitar» (sección 8.2).
- [ ] Verificaciones globales (suite completa de `vitest` y `test:pg`) y run de CI del SHA.

---

## 8. Estado de los criterios y decisiones de la HU

### 8.1. Estado de los criterios (Excel G37–G42)

| Criterio | Estado |
|---|---|
| 1 Vencimiento automático | Cumple en código y pruebas (fecha = vencimiento, actor «Proceso automático», idempotencia, zona horaria del centro, endpoint con secreto y 401). El programador de 5 minutos, ejecutado con el bucle del Anexo, vence la reserva en la corrida siguiente a su vencimiento (17:41:46 con 0 y 0; 17:46:46 con 1 y 1). Registro en el historial de clases (E-02) y serie «Reservas vencidas» (H-10): diferidos. |
| 2 Validación por vencimiento | Cumple con el proceso detenido (PostgreSQL). Cancelación propia (C-14): diferida. El rechazo «La reserva venció…» lo hace el flujo de HU-I-10; verificado por lectura de código, sin recorrido en el navegador. |
| 3 Inscripción desde el centro | Cumple en C-24: reserva con plazo y precio vigente, confirmación, «Registrar pago» por alumno (2.2) y en el rechazo `INSCRIPCION_REQUIERE_PAGO` (2.5). La creación de la inscripción al confirmar el pago es de HU-I-10: ejecutada en el navegador (409 → «Se inscribe al confirmar el pago» → «Pagada»). |
| 4 Reservas en el detalle | Cumple: reserva y vencimiento por alumno, acceso por alumno a «Registrar pago» solo en clases Disponibles o Completas que no empezaron, sin cobro por alumno en clases iniciadas o canceladas. El atajo de la tarjeta «Pago» es de HU-I-10 (sección 8.2, c). |
| 5 Plazo nuevo tras anulación | Diferido a HU-I-06 (plazo configurable: HU-N-01). |
| 6 Clases canceladas | Cumple: el proceso y la validación no vencen reservas de clases canceladas, y el detalle las informa como «Pago sin registrar» y sin vencimiento. |

### 8.2. Discrepancias y decisiones pendientes

a. **Frontera de vencimiento (nota de lectura).** El criterio 1 dice «ya pasó» en lenguaje corriente y el criterio 2 lo define: una reserva vence cuando el momento es igual o posterior a su vencimiento. La spec (§2.16, §2.18.1) y el código aplican esa definición (`momento >= venceEl`) y un test PostgreSQL fija la frontera inclusiva.

b. **Texto de confirmación con varios alumnos.** El Excel fija el texto de «Agregar alumno» (uno a la vez) y no el de varios alumnos. En 2.2 se usa el mismo patrón y la misma clave (`confirmaciones.inscripcion.centro`) con los nombres unidos por coma. Revisable con el PO.

c. **Atajo «Registrar pago» del detalle (pendiente de HU-I-10).** El atajo está definido en la spec I §2.8: abre el flujo de HU-I-10 con el alumno y la clase elegidos y se ofrece solo en clases `DISPONIBLE`/`COMPLETO` que no empezaron (`puede_registrar_pago`). Hoy la tarjeta «Pago» (diálogo de HU-I-01, `registrar-pago-dialog.tsx`, que usa `GET /api/pagos/opciones` y `POST /api/pagos` en modo de compatibilidad) abre el diálogo anterior y su botón sigue habilitado en clases iniciadas; el acceso por alumno (`/pagos/registrar?alumno=<id>&clase=<id>`) ya abre el flujo de HU-I-10 y no aparece en clases iniciadas ni canceladas. El diálogo anterior informa una reserva vencida con el mensaje de alumno no inscripto, y no con «La reserva venció…», que sí informa el flujo de HU-I-10. Lo resuelve HU-I-10; no es una decisión abierta de esta HU.

d. **«Quitar» y la leyenda irreversible.** «Quitar» pasa por la confirmación de HU-C-25 con la leyenda «Esta acción no se puede deshacer.», como fija el criterio 4 de HU-C-25, aunque la inscripción quede registrada como «Quitada por el centro» y no se borre. Revisable con el PO.

e. **SQL manual (`HU-C-24.sql`), lectura de las consultas 2 y 7.** La consulta 2 lista las inscripciones `RESERVA_VENCIDA` cuya fecha no es el vencimiento, cuyo actor no es «Proceso automático» o que tienen usuario: devolver 0 filas es lo esperado, y solo prueba algo si la clase tiene al menos una `RESERVA_VENCIDA` (en las dos clases de la prueba la había, por el proceso). En una clase cancelada, o sin vencidas, 0 filas es cierto pero vacío. La consulta 7 revisa solo inscripciones `VIGENTE`: el proceso deja fuera a las que marca como vencidas, y en la prueba las inscripciones eran reservas sin pago, así que 0 filas es lo esperado; pero no ejercita inscripciones `PAGADA`, por lo que su cobertura de «Pagada ⇔ pago no anulado» es débil. Para que la consulta 7 aporte, hay que correrla con al menos una inscripción `PAGADA` en la clase.

---

## Anexo — Cómo se dispara el proceso (documento de developers)

**Qué es.** `POST /api/procesos/vencer-reservas` con `Authorization: Bearer $CRON_SECRET`. Sin sesión. Cada llamada revisa las reservas vencidas y las marca; es idempotente, así que llamarlo de más no hace daño.

**Cómo se dispara.** Un programador local que llama al endpoint cada 5 minutos. No se usa Vercel Cron: en el plan Hobby los cron jobs corren como máximo una vez por día. La variable `CRON_SECRET` se define en el entorno donde corre `npm run dev` y en el del programador (el valor no se versiona; el nombre figura en `.env.example`). El programador corre en una terminal propia, que no hereda el `.env` de la app: ahí `CRON_SECRET` se define en esa misma terminal (`export CRON_SECRET=...` en Git Bash/Linux, `$env:CRON_SECRET = "..."` en PowerShell) antes de lanzarlo; cargarla solo en el `.env` no alcanza para esa terminal.

Definición de `CRON_SECRET` en la terminal del programador, antes de lanzarlo (`<tu-secreto>` es un valor de ejemplo: reemplazarlo por el mismo valor que tiene la app en su `.env`; no se versiona):

```bash
# Git Bash o Linux
export CRON_SECRET='<tu-secreto>'
```

```powershell
# PowerShell
$env:CRON_SECRET = '<tu-secreto>'
```

Programador de ejemplo (Git Bash o Linux), con `CRON_SECRET` exportada:

```bash
while true; do
  curl -fsS -X POST http://localhost:3000/api/procesos/vencer-reservas \
    -H "Authorization: Bearer $CRON_SECRET"
  echo
  sleep 300
done
```

En PowerShell, con `$env:CRON_SECRET` definida:

```powershell
while ($true) {
  curl.exe -fsS -X POST http://localhost:3000/api/procesos/vencer-reservas -H "Authorization: Bearer $env:CRON_SECRET"
  Start-Sleep -Seconds 300
}
```

Con `cron` del sistema: `*/5 * * * * curl -fsS -X POST http://localhost:3000/api/procesos/vencer-reservas -H "Authorization: Bearer $CRON_SECRET"`, con `CRON_SECRET` definida en el crontab.

**Cómo se reproduce en la demostración (paso a paso).**
1. Partir de `develop` con la base regenerada: `npx prisma migrate reset --force` (nunca `migrate dev`), indicando `DATABASE_URL` explícita. **Solo sobre la base de demostración: este comando borra todos los datos.**
2. Definir `CRON_SECRET` en el `.env` local y levantar la app con `npm run dev`.
3. Abrir una terminal aparte, definir `CRON_SECRET` en esa misma terminal con el comando de arriba (`export` en Git Bash, `$env:CRON_SECRET` en PowerShell; no la hereda del `.env` de la app) y dejar corriendo el programador de arriba.
4. Como mesa de entrada, inscribir a un alumno en una clase que empiece en pocos minutos: la reserva vence al inicio de la clase (el vencimiento es el menor entre el plazo de pago y el inicio).
5. Esperar a que pase el vencimiento y a la siguiente corrida (hasta 5 minutos): la inscripción queda «Reserva vencida», la clase vuelve a Disponible si estaba Completa y el historial registra al «Proceso automático».
6. Alternativa para acelerar, solo en la base de demostración: adelantar `venceEl` de una reserva con SQL y lanzar el `curl` una vez a mano.
7. Comprobar el rechazo: la misma llamada sin cabecera o con otro valor responde `401`.

**Quién lo arranca el día de la demo.** Tomás (carril 2), dueño del proceso según «Cierre de pendientes»: levanta la app y el programador antes de empezar y lo deja corriendo durante toda la demostración.

**Dónde mirar si no corre.** El log del servidor muestra los errores por clase; la respuesta `200` con ceros significa que no había nada para vencer, no que falló.
