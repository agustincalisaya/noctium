# TASK: HU-C-22 — Reservar una clase y pagarla en el centro antes del vencimiento

**Módulo:** C (Gestionar turnos) · **Sprint:** 3 · **SP estimado:** 3.
**Contrato de referencia:** spec C §2.17.1–2.17.5, §2.16, reglas §3.14–3.20 y trazabilidad §4; PR 0 §5.2–5.5. Excel G21–G26/I21, convenciones y Cierre de pendientes.
**RBAC:** `turnos:solicitar_propio` y `turnos:leer_propios`, existentes. Identidad exclusivamente de sesión. Sin cambios de permisos.
**Schema:** completo por PR 0; sin migraciones, cambios de seed ni dependencias.

## 0. Relevamiento previo a implementación

Listado de archivos confirmado por Tomás el 09/10/2026; RULES.md excluido expresamente. Base inicial: rama `feature/hu-c22-c24`, HEAD `d9f5f7affa678e122426bdca0cbcc6a7f1158788`, árbol limpio. C-20 incluida en este HEAD (merge `aeabb65`). Sin cambios ajenos iniciales.

Archivos existentes aprobados:
- `src/server/turnos/turno.service.ts`: conectar reserva propia, datos de inscripción y confirmación por id + sesión.
- `src/server/turnos/turno.resumen-inscripcion.service.ts`: plazo y vencimiento estimados.
- `src/types/turno.types.ts`: presentación de inscripción propia.
- `src/lib/textos.ts`: textos literales y vocabulario de la UI modificada.
- `src/app/(dashboard)/alumno/page.tsx`: situación/precio y banner de inscripción propia actual.
- `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.tsx`: plazo estimado y navegación por id devuelto por POST.
- `src/server/turnos/turno.autoservicio.test.ts`.
- `src/server/turnos/turno.propios.test.ts`.
- `src/server/turnos/turno.propios.pg.test.ts`.
- `src/server/turnos/turno.resumen-inscripcion.service.test.ts`.
- `src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts`.
- `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx`.
- `docs/tasks/Sprint 3/HU-C-20.md`: únicamente evidencia de las partes habilitadas y diferidas restantes.
- `docs/specs/spec_modulo_C.md`: sincronización aditiva, con historial.
- `docs/DESIGN.md`: banner específico, con historial.

Archivos nuevos aprobados:
- `docs/tasks/Sprint 3/Modulo C/HU-C-22.md` (no existía otra task C-22 al comprobar `rg --files docs/tasks`).
- `src/server/turnos/turno.reserva-alumno.pg.test.ts`.
- `src/app/(dashboard)/alumno/page.test.tsx`.
- `src/app/api/turnos/[id]/inscripcion/route.test.ts`.
- `docs/testing/hu-c-22/HU-C-22.postman_collection.json`.
- `docs/testing/hu-c-22/HU-C-22.sql`.
- `docs/testing/hu-c-22/HU-C-22-evidencia.md`.

**Puntos detectados:**
- §2.17.4 exige `inscripcion.cancelacion`, calculada por la regla compartida C-14; no es opcional en ese contrato. La implementación de esa HU está excluida. En el relevamiento se consultó la adaptación interina a Tomás; quedó autorizada el 09/10/2026 (ver ampliación debajo). La elegibilidad y el campo del contrato final no se implementan ni se declaran probados.
- Nota para Tomás pide fixtures en `prisma/`; el paquete prohíbe editar esa carpeta. Se cumple la restricción del paquete con datos descartables fuera de `prisma/`.
- No se encontró documento independiente de developers ni mapa Sprint 3 separado. Modelo y firmas publicados en PR 0/spec C; UI reutiliza mapa Sprint 2 §2, rutas existentes y DESIGN §6/§9. El documento operativo de C-24 se verificará en su fase.
- La regresión detectó `turno.inscripciones.pg.test.ts:133–134`, fuera del listado inicial: en la pasada anterior exigía alta sin plazo y respuesta sin campos adicionales. Se consultó la adaptación puntual y quedó autorizada el 09/10/2026 (ver ampliación debajo). El fallo de la pasada anterior se conserva como evidencia histórica.

**Ampliación puntual autorizada por Tomás el 09/10/2026:**
- `src/server/turnos/turno.inscripciones.pg.test.ts`: adaptar únicamente autoservicio al contrato C-22; reloj fijo, respuesta exacta con los tres campos originales más inscripción, persistencia VIGENTE/RESERVADA, plazo/precio e identidad. Centro y rechazos conservados.
- Excepción interina de `cancelacion` aceptada en spec §2.17.4: solo listado/presentación, sin modificar límites del resumen ni POST. El campo y su regla siguen diferidos a HU-C-14, sin evidencia de ejecución por la aceptación documental.

## 1. Nota de alcance

C-22 conecta el modo de reserva de PR 0 al alumno. El centro conserva inscripción sin plazo hasta C-24. GET muestra el vencimiento si se reservase en ese instante; POST crea uno definitivo y calcula el precio con la tarifa vigente al alta (P-C1 y decisión de precio de C-20 del 09/10/2026). Puede variar el precio entre GET y POST; no se garantiza el precio del GET.

**Fuera de alcance explícito:** I-10, I-06, C-24, C-14, B-07 y N-01; cron, cobro real, cancelación propia y configuración de parámetros. No se implementan migraciones, permisos ni nuevas infraestructuras. Los estados preparados por PR 0 acreditan contratos/situaciones, no los recorridos de esas HU.

C-22, I-10 y C-24 son unidad de entrega: la frase «la reserva se cancela sola» no se acredita íntegra con esta fase. No se declara merge ni cierre de la unidad.

## 2. Historia de Usuario

**Como** Alumno.
**Necesito** Reservar mi lugar en una clase y pagarla en el centro dentro de un plazo.
**Para** Asegurar mi lugar sabiendo hasta cuándo tengo que pagar, y que los lugares que no se pagan se liberen para otros alumnos.

**SP estimado:** 3.

### Criterios de aceptación literales — Excel G21–G26

1. Al tocar “Confirmar reserva” en el resumen de HU-C-20, el alumno queda inscripto en estado “Reservada · pagar antes del <fecha y hora>”: el lugar queda ocupado (cuenta para el cupo y para la superposición de horarios).

2. Plazo de pago: la reserva se paga en el centro dentro del plazo de pago contado desde que se hizo (24 horas por defecto, configurable con HU-N-01; un cambio posterior del plazo no afecta a las reservas ya hechas; solo la reprogramación de la clase puede cambiar su vencimiento (última viñeta)) y siempre antes del inicio de la clase; vale lo que ocurra primero. Si la clase empieza antes de que termine el plazo, el vencimiento es el inicio de la clase.
     – El resumen (HU-C-20) muestra el plazo: “Reservás tu lugar y tenés que pagarlo en el centro antes del <día, fecha y hora>. Si no lo pagás, la reserva se cancela sola.”.
     – Al confirmar se informa “Reservaste tu lugar. Acercate al centro a pagar antes del <día, fecha y hora>. Si no, la reserva se cancela sola.”.
     – Si la clase se reprograma (HU-C-06), el vencimiento pasa a ser el menor entre el vencimiento sin el tope del inicio (momento de la reserva —o de la anulación que la reabrió, HU-C-24, criterio 5— más el plazo de pago vigente en ese momento) y el nuevo inicio de la clase.

3. Noctium no cobra en línea: el alumno paga en el centro y mesa de entrada registra el pago (HU-I-10). Al registrarse, la inscripción pasa a “Pagada”. El pago se vincula a la inscripción: una inscripción está “Pagada” si tiene al menos un pago no anulado. Los pagos de una inscripción cancelada no cuentan para una inscripción nueva del mismo alumno en la misma clase. Quitar a un alumno de una clase (HU-C-04) tampoco borra la inscripción: queda “Quitada por el centro” con fecha y usuario, deja de contar para el cupo y la superposición, y no impide volver a inscribirlo.

4. En “Mis clases” (HU-C-13) cada inscripción vigente muestra su estado de pago: “Reservada · pagar antes del <fecha y hora>”, “Pagada” o, si no tiene pago ni reserva vigente (estado “Pago sin registrar”, que el personal ve con ese nombre; por ejemplo, las anteriores a esta historia), “Pago pendiente · se abona en el centro” solo si la clase no empezó y sigue Disponible o Completa. Si la clase ya empezó o está Cancelada, toda inscripción vigente sin pago ni reserva vigente (por ejemplo, una creada antes de esta historia o una cuyo último pago se anuló) se muestra como “Pago sin registrar”, estado informativo, sin invitación a pagar ni acción de cobro. Las vencidas (HU-C-24) muestran “Reserva vencida”. Si el alumno ya tuvo en esa clase una reserva vencida, o canceló una reserva sin haberla pagado (HU-C-14), no puede volver a reservarla en línea: al confirmar el resumen (HU-C-20) se informa “Ya tuviste una reserva sin pagar en esta clase. Para volver a inscribirte, acercate al centro y abonala en el momento.” y no se inscribe; solo puede inscribirse en el centro pagando en el momento (HU-C-24, criterio 3). La regla no alcanza a la cancelación de una inscripción sin reserva (anterior a esta historia), a las inscripciones quitadas por el centro o dadas de baja con el alumno (HU-B-07), que se muestran como “Inscripción quitada por el centro” y “Inscripción dada de baja por el centro”, ni a una reserva reabierta por la anulación de un pago que después vence (HU-C-24, criterio 5). El servidor valida esta regla al confirmar (cambio en el flujo de HU-C-12, Solicitar clase). Así nadie retiene un lugar indefinidamente sin pagar (decisión del PO, 04/10/2026).

5. Una reserva sin pagar se puede cancelar en cualquier momento antes de su vencimiento (HU-C-14), sin el límite de anticipación, porque no tiene pago asociado.

6. Precio congelado: al confirmar la reserva, la inscripción guarda su precio (HU-L-06, criterio 4): tarifa por hora vigente de la materia × duración de la clase. Un cambio posterior de la tarifa no lo modifica. “Mis clases” (HU-C-13) muestra ese precio en cada inscripción vigente.

**Secuencia y diferidas — Excel I21:** el criterio 3 se verifica con I-10; el vencimiento/inscripción desde el centro del criterio 4 con C-24; la cancelación de los criterios 4 y 5 con C-14; la baja del criterio 4 con B-07; el plazo configurable del criterio 2 con N-01. La tarifa inicial del seed no difiere el precio. La unidad se prueba junto con I-10/C-24.

## 3. Alcance de esta task

Backend y frontend de reserva propia: POST existente, resumen existente, Mis clases, banner, tipos y catálogo. Una tarjeta por clase (vigente efectiva o más reciente), sin Pendientes, contando clases en totales/paginación. No se reactivan filas históricas ni se eliminan inscripciones.

Reprogramación y quitar se verifican desde `reprogramarTurno`/`quitarAlumnoTurno`, sin modificar sus servicios. Re-reserva aplica solo a reservas vencidas/canceladas sin pago; quedan excluidas bajas, quitadas, canceladas sin reserva y reservas reabiertas. Igualdad con `venceEl` significa vencida, incluso si coincide con el inicio de clase.

## 4. Contrato Backend

### 4.1. Schema Zod

POST sin body; conserva el contrato C-12 y no acepta identidad del cliente. GET `/api/turnos/propios` usa `MisTurnosQuerySchema`, sin cambios de query. No se crea schema nuevo. El resumen conserva contrato sin payload funcional.

### 4.2. Servicio

`solicitarTurnoPropio(turnoId, usuarioId)` resuelve alumno de sesión, invoca el núcleo existente dentro de `transaccion`, con `crearInscripcion(origen=ALUMNO, conReserva=true)`. PR 0 bloquea en orden canónico, vence perezosamente, revalida estado/cupo/alumno/superposición/tarifa/re-reserva, crea fila y calcula ocupación. Conserva los campos de Sprint 2 y suma `inscripcion: {id,estado_pago,vence_el,precio}`. Centro continúa `conReserva=false`. Eventos e historial existentes después del commit.

`obtenerResumenInscripcion(turnoId,usuarioId,db?)` conserva solo lectura. Usa un momento, `parametrosVigentes` y `calcularVencimiento`; devuelve `plazo_pago_horas`/`vence_pago_el` estimados. Tarifa/precio recalculados solo al alta.

`listarTurnosPropios(query,usuarioId,db?,momento?)` devuelve una inscripción propia por tarjeta: `{id,situacion,vence_el,precio}`, conforme a la excepción interina autorizada de spec §2.17.4. `cancelacion` y su regla corresponden a HU-C-14; no se alteran límites del resumen ni el POST. `esVigenteEn` decide la vigencia; las finalizadas preservan su situación. La reserva vencida prevalece sobre clase iniciada; una reserva restante en clase Cancelada presenta `PAGO_SIN_REGISTRAR`. `vence_el` conserva el instante guardado cuando existe; solo `RESERVADA` lo usa como invitación a pagar. No se recalcula precio ni se muta al leer.

`obtenerConfirmacionReservaPropia(inscripcionId,usuarioId,db?,momento?)` busca por id y alumno de sesión, independiente de la página/pestaña; devuelve la presentación actual o null si no pertenece/existe. La URL transporta únicamente el id; no acredita pago, precio ni vigencia.

Errores nuevos reutilizados: `409 RESERVA_PREVIA_SIN_PAGO`, `422 MATERIA_SIN_TARIFA`. Se preservan los códigos y textos legacy de C-12. No se renombran enums/rutas/modelos.

### 4.3. Route Handler

POST `/api/turnos/[id]/inscripcion`, `withPermission("turnos:solicitar_propio")`, sin cambio en su implementación delgada: ya devuelve datos del servicio y `statusDeErrorNuevo`. GET resumen con mismo permiso; propios con `turnos:leer_propios`. Respuestas `{data,error}` y errores semánticos existentes. Pruebas unitarias del route simulan el wrapper y no acreditan autenticación real.

### 4.4. Server Action

No aplica; contratos por Route Handlers y Server Component existente. No se crea action ni endpoint de confirmación.

### 4.5. Trazabilidad / Auditoría (Regla N.° 2)

Se reutilizan columnas de la inscripción y `HistorialInscripcion` de PR 0, y los eventos de C-12 después del commit. Quitar deja `QUITADA_CENTRO`, fecha y usuario, conservando fila, precio y pagos. GET/listado/banner no escriben. Ningún mecanismo nuevo.

## 5. Frontend

Mapa Sprint 2 §2, Mis clases y Solicitar clase; DESIGN §6.4/§9. Se reutiliza `ConfirmarAccionDialog`, bloqueo de doble envío, error inline y conservación de selección. Resumen informa leyenda literal del plazo estimado. POST navega a `/alumno?inscripcion=exitosa&reserva=<id>`; el banner consulta datos propios actuales, muestra el definitivo solo si sigue Reservada y no invita a pagar tras vencimiento/inicio/cancelación. Fallo de consulta muestra error, sin confirmación obsoleta.

Tarjetas muestran las situaciones y el precio guardado solo de las inscripciones vigentes efectivas. Textos nuevos/modificados en `src/lib/textos.ts`, clase y estados en femenino; se mantienen claves de errores legacy según DESIGN §9, pendientes de C-19. Se preserva paginación existente y tokens. No se agrega acción de cancelación/cobro.

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios y componentes

Servicios/route: identidad, campos originales + adicionales, plazo estimado, situaciones, id ajeno, prioridad de vigente, frontera inicio/vencimiento. Componentes reales SSR/jsdom: textos literales, datos, Volver, doble GET/POST, errores del servidor/red, id del POST, precio por vigencia, recarga y error del banner. No acredita recorrido de navegador.

### Nivel 2 — API / Postman

Colección `docs/testing/hu-c-22/HU-C-22.postman_collection.json`: GET, POST, propios, autenticación/RBAC, rechazo por reserva previa, cupo y tarifa. No contiene secretos/cookies. Distinguir preparación de colección de ejecución HTTP real; resultados en evidencia.

### Nivel 3 — BD / SQL

`npm run test:pg -- src/server/turnos/turno.reserva-alumno.pg.test.ts src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts src/server/turnos/turno.propios.pg.test.ts` usa runner/fábricas y migraciones existentes en una base nueva descartable. Guardas exigen URLs iguales; no tocar bases habituales. Cubrir persistencia, precio GET→POST/postalta, plazo original, reprogramación real, cupo/superposición/concurrencia, exclusiones y quitar. SQL de solo lectura en el archivo aprobado; no resetea ni muta.

**Matriz CA, comandos, exit codes, omisiones y pasos pendientes:** `docs/testing/hu-c-22/HU-C-22-evidencia.md`. La existencia de los archivos no acredita resultados.

## 7. Checklist de Definition of Done

- [x] Relevamiento y límites confirmados; estado Git comprobado.
- [x] Servicios y UI dentro de los archivos autorizados; route productivo existente sin modificación; action no aplica.
- [x] Campos legacy y envelope preservados; campos adicionales previstos por C-22.
- [x] GET solo lectura; eventos/historial reutilizados tras commit.
- [x] Ningún DELETE de dominio, migración, seed, dependencia ni permiso nuevo.
- [x] Textos nuevos/modificados centralizados y en femenino.
- [x] Contrato interino de `cancelacion` autorizado y documentado; campo/regla final diferidos a HU-C-14, sin acreditarlos como implementados.
- [x] Adaptación puntual de autoservicio verificada: PG 10/10, TypeScript, lint del test y sintaxis Postman aprobados.
- [ ] Verificaciones globales requeridas aprobadas; fallos históricos y comprobaciones pendientes en evidencia.
- [ ] Tres niveles y navegador acreditados según resultados reales: HTTP con sesión real 11/11, SQL y navegador de escritorio ejecutados; vista móvil pendiente.
- [ ] C-20 CA3 completo: siguen C-14/N-01 pendientes.
- [ ] Unidad con I-10/C-24 e integraciones diferidas verificadas.
- [ ] PR/run del SHA correcto/merge: pendientes.

**Contraste completo con template:** presentes secciones 0–7, 4.1–4.5, historia/SP/CA literales, alcance y exclusiones, backend/frontend, tres niveles y DoD. No falta sección. Los ítems abiertos son contratos/verificaciones/dependencias pendientes, no aprobadas.

## Entrega local — 09/10/2026

Estructura y documentación completas; dos decisiones concretas resueltas con autorización puntual; cierre funcional y verificaciones globales/recorrido pendientes según evidencia. 16 archivos existentes modificados y 7 nuevos, únicamente del listado aprobado y su ampliación; ningún cambio de C-24.
