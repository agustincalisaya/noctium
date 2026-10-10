# TASK: HU-C-24 — Vencer las reservas sin pago y gestionarlas desde mesa de entrada

**Módulo:** C (Gestionar turnos) · **Sprint:** 3 · **SP estimado:** 2.
**Contrato de referencia:** spec C §2.18.1–2.18.7, §2.16, §2.17.3 y reglas §3.14–3.20; PR 0 §2.2, §2.10, §2.11, §2.13 y §5.2–5.5. Excel G37–G42/I37, convenciones y «Cierre de pendientes» (dueño del proceso, Pendiente 14).
**RBAC:** sin permisos nuevos. El proceso no usa sesión (única excepción documentada a la Regla N.° 10). `pagos:leer` y `pagos:crear` existentes gobiernan los campos nuevos del detalle de la clase.
**Schema:** completo por PR 0; sin migraciones, cambios de seed ni dependencias.

---

## 0. Relevamiento previo a implementación

Base: rama `feature/HU-C-24-vencer-reservas-sin-pago`, HEAD `d22806d` (incluye el merge de C-22, #230), árbol limpio.

Archivos existentes a modificar:
- `src/server/turnos/inscripcion.service.ts`: `crearInscripcion` aplica `exigeInscripcionConPago` también al origen CENTRO con reserva (hoy solo ALUMNO).
- `src/server/turnos/turno.service.ts`: el centro inscribe con `conReserva = true` (2.5 agregar y 2.2 confirmar) y las respuestas suman `inscripcion` / `inscripciones` y `ofrecer_pago`.
- `src/server/turnos/turno.detalle.ts`: `inscripcion` y `puede_registrar_pago` por alumno del detalle.
- `src/types/turno.types.ts`: tipos de los campos nuevos.
- `src/lib/textos.ts`: textos nuevos del detalle de la clase y de la confirmación al inscribir.
- `src/app/(dashboard)/turnos/[id]/turno-alumnos-card.tsx`: reserva, vencimiento y acceso a «Registrar pago».
- Tests de 2.5 y 2.2 que fijaban la inscripción del centro «sin plazo»: se adaptan solo esas aserciones.

Archivos nuevos:
- `src/server/turnos/reserva.vencimiento.service.ts` y su test.
- `src/app/api/procesos/vencer-reservas/route.ts` y su test.
- `src/server/turnos/reserva.vencimiento.pg.test.ts`.
- `docs/tasks/Sprint 3/Modulo C/HU-C-24.md` (este archivo).
- `docs/testing/hu-c-24/HU-C-24.postman_collection.json`, `HU-C-24.sql` y `HU-C-24-evidencia.md`.

**Puntos detectados:**
- No existe documento independiente de developers. El disparo del proceso queda como **Anexo** al final de esta task.
- I-10 no está en `develop` (sin task, sin commit, sin pantalla `/pagos/registrar`). Las verificaciones que lo necesitan quedan como pendientes explícitos (sección 6).
- El contrato del detalle (spec §2.18.4) define `inscripcion` y `puede_registrar_pago` dentro de cada elemento de `alumnos[]`; no hay un campo `reservas` aparte.
- La ruta del proceso figuraba «a confirmar contra el código»: no existe ninguna ruta bajo `/api/procesos` y el `matcher` de `src/proxy.ts` solo cubre rutas de pantalla, así que `POST /api/procesos/vencer-reservas` queda fuera del control de sesión sin tocar el proxy.

---

## 1. Nota de alcance

C-24 agrega el proceso programado, completa el modelo de reserva del lado del centro (`conReserva = true`) y expone en el detalle de la clase qué reservas hay pendientes. La validación por `venceEl` (criterio 2) ya la traen PR 0 y C-22 en cada operación que escribe sobre las inscripciones de una clase; esta task la **prueba con el proceso detenido** y no la reimplementa.

«Registrar pago» se reparte así: C-24 ofrece la acción (al terminar la inscripción y como acceso directo en el detalle) y expone `puede_registrar_pago`; el registro del pago, su pantalla y el mensaje de reserva vencida son de HU-I-10. La acción apunta a la pantalla que define la spec I (`/pagos/registrar?alumno=<id>&clase=<id>`).

**Fuera de alcance de esta task (explícito):**
- HU-I-10: pantalla y registro del pago, y la creación de la inscripción al confirmar el pago (`origen = PAGO`).
- HU-I-06: la anulación del último pago y el plazo nuevo (criterio 5); solo se verifica cuando esté.
- HU-C-14, HU-E-02, HU-H-10, HU-N-01: verificaciones diferidas de los criterios 1, 2 y 5.
- «Quitar» por reserva: existe desde C-04/C-22 y no se modifica.
- Pantalla `/pagos/registrar?alumno=<id>&clase=<id>` (ruta que usa hoy el enlace «Registrar pago»), «Registrar pago» ante `INSCRIPCION_REQUIERE_PAGO` con el estado «Se inscribe al confirmar el pago», y la decisión sobre el segundo «Registrar pago» de la tarjeta «Pago»: diferidos a HU-I-10.
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

**Detalle** (`turno.detalle.ts`): para inscripciones vigentes y solo con `pagos:leer` (el Profesor no recibe precios), cada alumno suma `inscripcion: { id, estado_pago, vence_el, precio }` y `puede_registrar_pago`, verdadero solo en clase Disponible/Completa que no empezó, con inscripción `RESERVADA` no vencida o `PAGO_SIN_REGISTRAR`, y con `pagos:crear`. `acciones_habilitadas.registrar_pago` conserva su condición de Sprint 2.

**Errores de servicio:** `INSCRIPCION_REQUIERE_PAGO` (409, ya en el catálogo central).

### 4.3. Route Handler

**Archivo:** `src/app/api/procesos/vencer-reservas/route.ts`
**Método:** `POST`, sin body.
**Acceso:** sin sesión ni `withPermission` (excepción a la Regla N.° 10). Exige `Authorization: Bearer <CRON_SECRET>` con el secreto leído de la variable de entorno y comparado en tiempo constante. Sin secreto configurado, sin cabecera o con un valor distinto: `401` sin ejecutar nada ni revelar el motivo.

`200`: `{ "data": { "reservas_vencidas": n, "clases_afectadas": n, "ejecutado_el": "<ISO -03:00>" }, "error": null }`. Sin nada que vencer, ceros.

### 4.4. Server Action

No aplica: el proceso y el detalle se exponen por Route Handlers.

### 4.5. Trazabilidad / Auditoría (Regla N.° 2)

Patrón (a)+(historial de PR 0): cada vencimiento deja `finalizadaEl = venceEl`, `finalizadaPorActorTipo = PROCESO_AUTOMATICO` en la inscripción y una fila en `HistorialInscripcion` escrita después del commit. No se escribe `eventos_turno`: es la única excepción a la Regla N.° 10 y a su trazabilidad por usuario, porque el proceso no es un usuario.

---

## 5. Frontend

- `turno-alumnos-card.tsx`: cada alumno con `inscripcion` muestra su situación («Reservada · vence <fecha y hora>», «Pagada», «Pago sin registrar») y, si `puede_registrar_pago`, la acción «Registrar pago» hacia `/pagos/registrar?alumno=<id>&clase=<id>`. Esa pantalla es de HU-I-10: hasta que se mergee, el enlace queda sin destino (pendiente explícito). «Quitar» no cambia.
- «Agregar alumno» pide antes la confirmación de HU-C-25 con `ConfirmarAccionDialog` (sin modificar el componente): «¿Estás seguro de que querés inscribir a <Nombre Apellido> en <Materia> del <dd/mm/aaaa> a las <hh:mm>?», botones «Volver» e «Inscribir», y el motivo del rechazo del servidor dentro del mismo mensaje. Texto en `confirmaciones.inscripcion.centro`; el patrón y los datos salen del Excel (HU-C-25, criterios 1, 2 y 6) y de la spec §2.18.3.
- Tras 2.5 agregar y 2.2 confirmar, la respuesta trae `ofrecer_pago` / `inscripciones` para que la interfaz ofrezca la acción junto a cada alumno.
- Textos en `src/lib/textos.ts`, «clase» y estados en femenino; tokens de DESIGN.md.

**Fuera de alcance de frontend:** la pantalla `/pagos/registrar` y la oferta de «Registrar pago» ante `INSCRIPCION_REQUIERE_PAGO` (HU-I-10).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- `vencerReservas`: sin clases con vencidas → ceros; varias clases → una transacción por clase y totales correctos; una clase que falla no frena a las demás; el momento recibido se usa para todas.
- Route: sin cabecera, sin secreto configurado, secreto distinto o esquema distinto de Bearer → 401 sin invocar el servicio; secreto correcto → 200 con el contrato.
- Componente: al elegir un alumno aparece la confirmación con alumno, materia, día y hora; «Volver» no inscribe; «Inscribir» envía el alta, avisa y recarga; un rechazo del servidor se muestra en el mismo mensaje.
- Detalle: `inscripcion` y `puede_registrar_pago` según rol, estado de la clase, inicio y vencimiento; el Profesor no recibe los campos.
- `crearInscripcion` del centro: reserva con plazo y precio; `INSCRIPCION_REQUIERE_PAGO` con `{ alumno_id }`.

### Nivel 2 — Postman
`docs/testing/hu-c-24/HU-C-24.postman_collection.json`: proceso sin secreto y con secreto erróneo (401), con secreto correcto (200); 2.5 agregar con `ofrecer_pago`; 409 `INSCRIPCION_REQUIERE_PAGO`; detalle con y sin permiso de pagos. Sin secretos ni cookies en la colección.

### Nivel 3 — BD / TablePlus
- `npm run test:pg -- src/server/turnos/reserva.vencimiento.pg.test.ts` (base descartable aleatoria): vencimiento con fecha = `venceEl` y actor «Proceso automático»; clase Completa vuelve a Disponible; idempotencia; clase Cancelada intacta; reserva pagada intacta; **operaciones con el proceso detenido** (cupo, inscripción, cobro y listados tratan la reserva vencida como vencida).
- `docs/testing/hu-c-24/HU-C-24.sql`: consultas de solo lectura.

**Matriz CA, comandos, exit codes, omisiones y pendientes:** `docs/testing/hu-c-24/HU-C-24-evidencia.md`.

**Diferido a otras HU:** con I-10, el rechazo `La reserva venció…` en la pantalla de cobro y la inscripción al confirmar el pago (excepción del criterio 3); con I-06, el criterio 5; con C-14, la cancelación del criterio 2; con E-02 y H-10, el historial y la serie de vencidas; con N-01, el plazo configurable.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) y estado Git comprobados.
- [x] Servicio y Route Handler implementados, sin lógica de negocio en la ruta; action no aplica.
- [x] Endpoint con `{ data, error }`, 401 sin revelar el motivo y comparación en tiempo constante.
- [x] Historial escrito después del commit; sin `eventos_turno`; sin `DELETE` físico.
- [x] `conReserva = true` en 2.5 y 2.2, con `ofrecer_pago` y `409 INSCRIPCION_REQUIERE_PAGO`.
- [x] Campos del detalle de la clase con sus reglas por rol.
- [x] Frontend del detalle: reserva, vencimiento y acceso a «Registrar pago»; «Quitar» sin cambios.
- [x] Confirmación de HU-C-25 al inscribir desde el centro (componente común, textos en el catálogo).
- [x] Ninguna migración, seed, dependencia ni permiso nuevo.
- [x] Textos nuevos en el archivo central; `verificar-claves-textos` aprobado.
- [x] Tres niveles con evidencia: unitarios, PG, HTTP con sesión real (11/11), SQL manual y navegador de escritorio ejecutados; vista móvil pendiente (ver `HU-C-24-evidencia.md`).
- [ ] Ejecución del programador local cada 5 minutos en el entorno de demostración.
- [ ] Verificaciones diferidas a I-10, I-06, C-14, E-02, H-10 y N-01 (listadas en la evidencia).
- [ ] Verificaciones globales (suite completa de `vitest` y `test:pg`) y run de CI del SHA.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## Anexo — Cómo se dispara el proceso (documento de developers)

**Qué es.** `POST /api/procesos/vencer-reservas` con `Authorization: Bearer $CRON_SECRET`. Sin sesión. Cada llamada revisa las reservas vencidas y las marca; es idempotente, así que llamarlo de más no hace daño.

**Cómo se dispara.** Un programador local que llama al endpoint cada 5 minutos. No se usa Vercel Cron: en el plan Hobby los cron jobs corren como máximo una vez por día. La variable `CRON_SECRET` se define en el entorno donde corre `npm run dev` y en el del programador (el valor no se versiona; el nombre figura en `.env.example`).

Programador de ejemplo (Git Bash o Linux), con `CRON_SECRET` exportada:

```bash
while true; do
  curl -fsS -X POST http://localhost:3000/api/procesos/vencer-reservas \
    -H "Authorization: Bearer $CRON_SECRET"
  echo
  sleep 300
done
```

En PowerShell:

```powershell
while ($true) {
  curl.exe -fsS -X POST http://localhost:3000/api/procesos/vencer-reservas -H "Authorization: Bearer $env:CRON_SECRET"
  Start-Sleep -Seconds 300
}
```

Con `cron` del sistema: `*/5 * * * * curl -fsS -X POST http://localhost:3000/api/procesos/vencer-reservas -H "Authorization: Bearer $CRON_SECRET"`, con `CRON_SECRET` definida en el crontab.

**Cómo se reproduce en la demostración (paso a paso).**
1. Partir de `develop` con la base regenerada: `npx prisma migrate reset --force` (nunca `migrate dev`), indicando `DATABASE_URL` explícita.
2. Definir `CRON_SECRET` en el `.env` local y levantar la app con `npm run dev`.
3. Abrir una terminal aparte y dejar corriendo el programador de arriba (la misma variable `CRON_SECRET`).
4. Como mesa de entrada, inscribir a un alumno en una clase que empiece en pocos minutos: la reserva vence al inicio de la clase (el vencimiento es el menor entre el plazo de pago y el inicio).
5. Esperar a que pase el vencimiento y a la siguiente corrida (hasta 5 minutos): la inscripción queda «Reserva vencida», la clase vuelve a Disponible si estaba Completa y el historial registra al «Proceso automático».
6. Alternativa para acelerar, solo en la base de demostración: adelantar `venceEl` de una reserva con SQL y lanzar el `curl` una vez a mano.
7. Comprobar el rechazo: la misma llamada sin cabecera o con otro valor responde `401`.

**Quién lo arranca el día de la demo.** Tomás (carril 2), dueño del proceso según «Cierre de pendientes»: levanta la app y el programador antes de empezar y lo deja corriendo durante toda la demostración.

**Dónde mirar si no corre.** El log del servidor muestra los errores por clase; la respuesta `200` con ceros significa que no había nada para vencer, no que falló.
