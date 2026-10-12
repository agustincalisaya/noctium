# Validación PO — HU-C-20 · Confirmar inscripción con un resumen de la clase

**Rama revisada:** `feature/prueba` @ `17f5daa` (la HU entró a `develop` con la PR #227, commit `70687d9`, merge `aeabb65`; HU-C-22 la extendió después).
**Fuente de verdad:** el texto de la HU del pedido de validación (no la task).
**Leído:** `prisma/schema.prisma`, `docs/RULES.md`, `docs/DESIGN.md` (§6.3, §6.4 y excepción HU-C-20, §9), `prisma/seed.ts`, `docs/specs/spec_modulo_C.md` (§2.14.2, §2.17.1–2.17.5 y §2.19), `docs/tasks/Sprint 3/HU-C-20.md`, `docs/tasks/Sprint 3/HU-Sprint-3.md`, `docs/tasks/Sprint 3/Modulo C/HU-C-22.md`. No hay en `docs/` un documento técnico de developers del Sprint 3 aparte de las specs, `PR-0.md` y `HU-Sprint-3.md`.
**Aviso sobre el seed:** `prisma/seed.ts` está **modificado y sin commitear** (+101 líneas: alumnos 41..52 y un «paso 13» que inscribe el plan de cada clase futura como reservas pendientes de pago). No es de esta HU y no se tocó. La sección 6 indica qué datos dependen de ese cambio local.

**Pruebas corridas (sin modificar nada):**

| Qué | Resultado |
|---|---|
| `vitest run` de la HU (servicio del resumen, rutas `inscripcion` y `inscripcion/resumen`, componente «Solicitar clase», `ConfirmarAccionDialog`) | **5 archivos, 61 tests en verde** |
| `npm run test:pg -- turno.resumen-inscripcion.service.pg.test.ts` (base descartable) | **10/10 en verde** (GET sin efectos, GET→cambio de cupo→POST rechaza, GET→superposición→POST rechaza, GET→tarifa nueva→POST, carrera por el último lugar, materia sin tarifa, clase en menos de 24 h) |
| `npm run test:pg --` `turno.reserva-alumno`, `inscripcion.service`, `turno.inscripciones` (POST que confirma) | **3 archivos, 38/38 en verde** |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador HU-C-23) | «Claves de textos verificadas.» |
| `vitest run` completo | **250 archivos / 3170 tests en verde** (51 archivos PG omitidos, sin base), sin fallos |

---

## 1. Trazabilidad de criterios

| # | Criterio (viñeta) | Dónde está implementado | Estado | Justificación |
|---|---|---|---|---|
| 1a | Al tocar «Inscribirme» no se inscribe: se abre un resumen | `inscribirse()` en `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.tsx:153-170` hace **solo** `GET /api/turnos/[id]/inscripcion/resumen`; el `POST` sale únicamente de `confirmarReserva()` (`:172-183`). El resumen es `ConfirmarAccionDialog` (`:254-284`) | **CUBIERTO** | Test de componente «Inscribirme pide GET sin POST». El GET no escribe ni bloquea (test PG con snapshot de tablas) |
| 1b | Materia | DTO `materia.nombre` (`turno.resumen-inscripcion.service.ts:55`, por la fachada `obtenerMateriasPorIds`); fila «Materia» (`solicitar-turno.tsx:267`) | **CUBIERTO** | |
| 1c | Profesor | `obtenerNombresProfesores` (`service.ts:43`); fila «Profesor» (`:268`) | **CUBIERTO** | Formato «Apellido, Nombre» |
| 1d | Día y fecha completa («Martes 13 de octubre de 2026») | `fecha` YYYY-MM-DD (`service.ts:57`); `fechaLarga()` (`src/lib/turno-detalle.ts:26`); fila «Día y fecha» (`:269`) | **CUBIERTO** | Verificado: `fechaLarga("2026-10-13")` → «Martes 13 de octubre de 2026» |
| 1e | Horario de inicio y fin | `hora_inicio`/`hora_fin` (`service.ts:58-59`); fila «Horario» «16:00–18:00» (`:270`) | **CUBIERTO** | |
| 1f | Duración | `duracion_min`; fila «Duración» «120 minutos» (`:271`) | **CUBIERTO** | Se muestra en minutos («120 minutos»), no en horas. La HU no fija el formato |
| 1g | Aula | `obtenerNombreAula` (fachada K, `src/server/aulas/aula.publico.ts`); fila «Aula» (`:272`) | **CUBIERTO** | |
| 1h | Lugares disponibles | `cupo − inscriptos` con `ocupacion(db, id, ahora())` (`service.ts:26-34`): una reserva vencida sin marcar no ocupa lugar; fila «Lugares disponibles» (`:273`) | **CUBIERTO** | |
| 2a | Precio = tarifa por hora × duración (HU-L-06) | `precioClase(tarifa, duracion)` (`service.ts:47`) con `obtenerTarifasPorIds` (fachada L); fila «Precio de la clase» con `formatearMonto` («$ 24.000») (`:274`) | **CUBIERTO** + **DESVÍO menor** | El precio del resumen se calcula al abrirlo y el `POST` vuelve a calcularlo con la tarifa vigente **al confirmar**. Si el gerente cambia la tarifa mientras el alumno mira el resumen, se guarda un precio **distinto del mostrado** y no se le avisa (ver nota abajo) |
| 2b | Recordatorio de pago en el centro + plazo de HU-C-22 | Texto `ui.turnos.resumen.precioFijo` (`:276`) + leyenda de plazo `ui.turnos.reserva.plazo` con `vence_pago_el` (`:277-282`) | **CUBIERTO** | El plazo lo agregó HU-C-22 (ya mergeada) |
| 3a | «Si todavía no pagaste, podés cancelar la reserva hasta el <vencimiento>; …» debajo del plazo | El servidor devuelve `vence_pago_el`, pero la **pantalla no muestra la leyenda** y el texto **no existe** en `src/lib/textos.ts` | **NO ENCONTRADO** · **DESVÍO** | La task y la spec (§2.17.1 «Interino», task §1) **difirieron la leyenda** a HU-C-14. La HU solo difiere la **verificación** de la regla (C-14) y del valor configurable (N-01), no la leyenda |
| 3b | «… Si ya pagaste, podés cancelar en línea hasta el <límite>» con la anticipación vigente al inscribirse (24 h) | `limite_cancelacion_en_linea = inicio − cancelacion_anticipacion_horas` (`service.ts:51,64`, `parametrosVigentes()`) se calcula y viaja en el DTO, pero **ningún componente lo lee** (solo aparece en el servicio y en `turno.types.ts:29`) | **PARCIAL** (backend sí, pantalla no) · **DESVÍO** | Mismo motivo |
| 3c | Si el límite ya pasó: «Si ya pagaste, ya no vas a poder cancelar en línea; comunicate con el centro.» | `limite_cancelacion_pasado` (`service.ts:65`), probado incluso en el instante exacto; **la pantalla no lo usa** y el texto no está en el catálogo | **PARCIAL** · **DESVÍO** | Existe otra clave parecida, `errores.inscripcion.cancelacionFueraDePlazo` («Ya no podés cancelar en línea. Comunicate con el centro»), pero es el texto de HU-C-14, no el de este criterio |
| 3d | Al cancelar rige el valor vigente (HU-C-14) y es configurable (HU-N-01) | — | **Fuera de esta HU** (verificación diferida) | HU-C-14 **no está implementada** (no existe `cancelarInscripcionPropia`, `evaluarCancelacion` ni `POST /api/turnos/[id]/inscripcion/cancelacion`; el permiso `turnos:cancelar_propia` sí está sembrado). HU-N-01 tampoco (no hay pantalla de parámetros) |
| 4a | Acción «Confirmar reserva» | `textoConfirmar = ui.turnos.resumen.confirmar` (`:261`) → `POST /api/turnos/[id]/inscripcion` con el `turno_id` del DTO; doble envío bloqueado (`envioRef`) | **CUBIERTO** | Tras éxito navega a `/alumno?inscripcion=exitosa&reserva=<id>` con el banner de C-12/C-22 (excepción documentada en DESIGN §6.4) |
| 4b | Acción «Volver», que regresa a la selección sin perder lo elegido | Botón «Volver» del componente común (`confirmar-accion-dialog.tsx:127-129`) → `onCerrar` solo borra el resumen (`:262`); `materiaId`, `profesorId` y `turnoId` quedan intactos | **CUBIERTO** | Test «Volver conserva materia, profesor y horario». Escape hace lo mismo (salvo durante el envío) |
| 5a | Al confirmar se revalida el cupo | `crearInscripcion` (`src/server/turnos/inscripcion.service.ts:295-316`): `bloquear` alumno + clase (orden canónico) → relee la clase bloqueada → `inscripcionesVigentes ≥ cupo` → `CUPO_INSUFICIENTE` | **CUBIERTO** | Tests PG «GET → cambio de cupo → POST rechaza» y «dos resúmenes del último lugar: solo una persiste» |
| 5b | Al confirmar se revalida la superposición con otras clases del alumno | `alumnoTieneClaseSuperpuesta` (`inscripcion.service.ts:332, 396-405`) + exclusión GiST de `reservas_turno` como última defensa (`:366`) | **CUBIERTO** | El GET **no** valida superposición (correcto: la HU lo pide «al confirmar»). Test PG «GET → inscripción superpuesta → POST rechaza» |
| 5c | Si algo cambió, se informa el motivo y no se inscribe | El rechazo vuelve como `{ error: { message } }`, `fetchOLanzar` lo lanza y `ConfirmarAccionDialog` lo muestra dentro del diálogo (`confirmar-accion-dialog.tsx:94-97,120-125`); la transacción se revierte | **CUBIERTO** | Mensajes: «La clase alcanzó su cupo máximo», «Ya tenés otra clase en ese horario», «La clase ya no está disponible», «El horario de la clase ya pasó» |

**Resumen:** criterios 1, 2, 4 y 5 **CUBIERTOS**. Criterio 3: la parte del plazo (que agrega HU-C-22) está; **la leyenda de cancelación no se muestra (NO ENCONTRADO / DESVÍO)**, aunque el servidor ya calcula los dos instantes que necesita.

**Nota sobre el DESVÍO del criterio 3.** La task (§1 «Nota de alcance» y la tabla de diferidas) dice «No se muestran leyendas de plazo/cancelación» y deja la leyenda para HU-C-14. Pero la HU, en sus dependencias, solo difiere la **verificación**: «la regla del criterio 3 cuando esté HU-C-14 y el valor configurable del criterio 3 cuando esté HU-N-01». El texto del criterio 3 es parte de esta HU y los datos ya están en el DTO (`vence_pago_el`, `limite_cancelacion_en_linea`, `limite_cancelacion_pasado`). Mostrarlo es un cambio de pantalla y catálogo, sin backend. El argumento del dev para no mostrarlo es razonable: hoy el alumno **no tiene cómo cancelar** porque HU-C-14 no existe, y la leyenda le prometería algo que no está. Eso lo decide el PO, no la task. Si se acepta el diferimiento, HU-C-20 no puede quedar Terminada hasta que entre HU-C-14 con la leyenda.

**Nota sobre el DESVÍO del criterio 2 (precio).** La task registra la decisión «aceptada por Tomás el 09/10/2026»: el precio mostrado en el resumen puede diferir del guardado si la tarifa cambia entre abrir el resumen y confirmar, y no se avisa ni se rechaza. Es coherente con «El precio queda fijo desde que reservás», pero el criterio 5 solo revalida cupo y superposición. **Confirmá si esa decisión es del PO.** Si no lo es, hay que definir si el `POST` rechaza («el precio cambió») o si se acepta así.

---

## 2. Textos literales (HU-C-23)

| Texto del criterio | Clave en `src/lib/textos.ts` | Valor en el código | ¿Coincide? |
|---|---|---|---|
| «Inscribirme» | `ui.turnos.solicitar.inscribirme` (l. 955) | «Inscribirme» | Sí |
| «Solicitar clase» | `ui.turnos.solicitar.titulo` (l. 926) | «Solicitar clase» | Sí |
| «Martes 13 de octubre de 2026» (formato) | `fechaLarga()` (`src/lib/turno-detalle.ts:26`) | «Martes 13 de octubre de 2026» | Sí (formateador, no es copy) |
| «El precio queda fijo desde que reservás, aunque después cambie la tarifa. Se paga en el centro.» | `ui.turnos.resumen.precioFijo` (l. 965) | idéntico | Sí |
| «Si todavía no pagaste, podés cancelar la reserva hasta el <día, fecha y hora de vencimiento>; después de cancelarla, solo vas a poder volver a inscribirte en esta clase en el centro. Si ya pagaste, podés cancelar en línea hasta el <día, fecha y hora límite>.» | — | **No existe** | **No** (falta) |
| «Si ya pagaste, ya no vas a poder cancelar en línea; comunicate con el centro.» | — | **No existe** | **No** (falta). La clave parecida `errores.inscripcion.cancelacionFueraDePlazo` dice «Ya no podés cancelar en línea. Comunicate con el centro», que es otro texto (el de HU-C-14) |
| «Confirmar reserva» | `ui.turnos.resumen.confirmar` (l. 958) | «Confirmar reserva» | Sí |
| «Volver» | Constante `TEXTO_VOLVER` en `src/components/shared/confirmar-accion-dialog.tsx:9` | «Volver» | Sí palabra por palabra, pero **no está en el archivo central** (ver 4) |
| Plazo de HU-C-22 (referido por el criterio 2/3): «Reservás tu lugar y tenés que pagarlo en el centro antes del <día, fecha y hora>. Si no lo pagás, la reserva se cancela sola.» | `ui.turnos.reserva.plazo` (l. 971) | idéntico; el hueco sale «martes 13 de octubre de 2026 a las 16:00» | Sí |

**No coinciden (por ausencia):** las dos oraciones del criterio 3.

Textos que no pide la HU pero aparecen en el resumen: título de C-25 «¿Estás seguro de que querés reservar tu lugar en la clase de {materia} del {dia} a las {hora}?» (`ui.turnos.resumen.titulo`), etiquetas «Día y fecha», «Duración», «{cantidad} minutos», «Aula», «Lugares disponibles», «Precio de la clase».

---

## 3. Reglas de servidor

### Endpoints

| Método y ruta | Permiso | Qué hace | Archivo |
|---|---|---|---|
| `GET /api/turnos/[id]/inscripcion/resumen` | `turnos:solicitar_propio` (solo ALUMNO, `seed.ts:905` y migración `sprint2_modelo`) | Resumen de solo lectura | `src/app/api/turnos/[id]/inscripcion/resumen/route.ts` |
| `POST /api/turnos/[id]/inscripcion` (sin body) | `turnos:solicitar_propio` | Confirma: crea la reserva | `src/app/api/turnos/[id]/inscripcion/route.ts` |
| `GET /api/turnos/inscripcion/opciones` | `turnos:solicitar_propio` | Opciones de la selección (HU-C-12, sin cambios de contrato) | ya existente |

| Regla | Verificación | Estado |
|---|---|---|
| Permisos / 403 (Regla 10) | Las dos rutas usan `withPermission("turnos:solicitar_propio")`: Gerente, Mesa de entrada y Profesor reciben **403 `SIN_PERMISO`** del wrapper antes de tocar el servicio. Cuenta de alumno sin ficha → 403 `SIN_PERMISO` desde el servicio. Sin sesión → 401. La página llama a `exigirPermiso` y redirige a `/sin-permiso` si no hay ficha | OK |
| Identidad | El alumno sale de la sesión (`obtenerAlumnoDeUsuario(req.auth.user.id)`); no se acepta `alumno_id` del cliente | OK |
| Validación (Regla 6) | No hay payload. El `id` de ruta no pasa por Zod: un id inexistente da 404 `TURNO_NO_ENCONTRADO` (lo fija la spec) | OK |
| Capa delgada (Regla 4) y contrato (Regla 5) | Las rutas solo llaman al servicio y traducen `{ data, error }` con status 403/404/409/422 | OK |
| Aislamiento (Regla 3) | Materia y tarifa por `materia.publico`, profesor por `profesor.publico`, aula por `aula.publico` (fachada K nueva y aditiva), alumno por `alumno.publico`. Lee la tabla `turnos`, que es de su propio módulo | OK |
| GET sin efectos | No abre transacción, no bloquea, no escribe ni emite eventos. Test PG con snapshot de clase, inscripciones, proyecciones, eventos e historial | OK |
| Transacción y bloqueo al confirmar (Regla 7) | `crearInscripcion` corre en `transaccion()`, toma `bloquear` (alumno → clase, orden canónico de PR-0) y **después** lee, cuenta y decide sobre filas bloqueadas; la superposición tiene además la exclusión GiST de `reservas_turno`. No es el `updateMany` condicionado que muestra la Regla 7, sino el bloqueo pesimista explícito que documentan spec C §3.17 y PR-0 como alternativa. La carrera por el último lugar está probada con PostgreSQL | OK (con la excepción documentada) |
| Registros nuevos, no modificar (Regla 8) | Confirmar **inserta** una fila nueva en `turnos_alumnos` (`VIGENTE`, `RESERVADA`, precio congelado); no modifica inscripciones anteriores. El historial se encola y se escribe después del commit (Regla 2 b), igual que los eventos `turno:alumno_agregado` / `turno:completado` | OK |
| Borrado físico (Regla 1) | No hay `DELETE` | OK |

### Snippets para comprobar el 403 (pegar en la consola del navegador con sesión de **Gerente, Mesa de entrada o Profesor**)

Abrí cualquier pantalla de Noctium logueado con ese rol (F12 → Consola). La clase `seed-turno-05` existe en el seed. Como el wrapper rechaza antes de llamar al servicio, el `POST` **no inscribe a nadie**.

```js
// HU-C-20: las dos rutas del alumno deben responder 403 SIN_PERMISO a otro rol.
const id = "seed-turno-05";
for (const [method, url] of [
  ["GET",  `/api/turnos/${id}/inscripcion/resumen`],
  ["POST", `/api/turnos/${id}/inscripcion`],
]) {
  const r = await fetch(url, { method, cache: "no-store" });
  console.log(method, url, "→", r.status, await r.json().catch(() => null));
}
// Esperado: GET → 403 {data:null, error:{code:"SIN_PERMISO", …}} y POST → 403 igual.
```

Contraprueba con un **alumno** (solo el GET, que no escribe): sirve también para ver los campos del criterio 3 que la pantalla no muestra.

```js
const r = await fetch("/api/turnos/seed-turno-05/inscripcion/resumen", { cache: "no-store" });
console.log(r.status, (await r.json()).data);
// Esperado 200 con precio, vence_pago_el, limite_cancelacion_en_linea (= inicio − 24 h) y limite_cancelacion_pasado.
```

---

## 4. Definición de Terminado

| Ítem | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Incumple (parcial)** | (1) Las dos oraciones del criterio 3 no existen en el catálogo (ver 2). (2) «Volver» y «Procesando…» del diálogo están como constantes en `confirmar-accion-dialog.tsx:9-12`, no en `textos.ts`. El componente es de HU-C-25, pero estos textos se ven en esta pantalla. (3) `solicitarTurnoPropio` (`turno.service.ts:494`) lanza el mensaje literal «Tu cuenta no tiene una ficha de alumno vinculada» (403, viene de C-12; el GET nuevo sí usa `ui.turnos.resumen.sinFicha`). Desde la pantalla no se llega a verlo porque la página redirige antes |
| Ningún texto visible con «turno» | **Cumple** | Pantalla, diálogo, errores del GET y del POST, miga, menú del alumno («Mis clases», «Solicitar clase») y h1 de Mis clases dicen «clase». La task nombraba «Mis turnos»/«Solicitar turno» del Sidebar y del h1 como pendientes de C-19; ya están corregidos en el código actual. Solo la URL `/alumno/turnos/solicitar` contiene «turnos» (no es texto visible) |
| Confirmación con el componente común de HU-C-25 | **Cumple** | La única operación que guarda (confirmar la reserva) pasa por `ConfirmarAccionDialog`; el rechazo se muestra dentro del diálogo |
| Tests en verde | **Cumple** | Ver tabla del inicio: 61 unitarios de la HU, 10 + 38 PG, suite completa 3170/3170, comprobador de claves OK |
| Checklist de la propia task | Abierto | La task deja sin tildar «run de GitHub» y «CA3 integrado, diferido a C-22, C-14 y N-01, no cumplido por C-20» |

---

## 5. Extras y violaciones

### Implementado sin que la HU lo pida (o más allá de ella)

- El GET rechaza **antes** de mostrar el resumen: clase inexistente (404), no disponible, ya empezada, sin lugar, alumno inactivo, ya inscripto (409) y **materia sin tarifa (422, «Esta clase todavía no tiene precio. Comunicate con el centro.»)**. Viene de la spec (P-C2). Lo que no valida es la superposición, que la HU ubica al confirmar.
- Título del diálogo en forma de pregunta (patrón C-25): «¿Estás seguro de que querés reservar tu lugar en la clase de … del … a las …?».
- El DTO incluye `cupo` (no se muestra) y `plazo_pago_horas`.
- Robustez de la pantalla: bloqueo de la selección y de «Cancelar» mientras carga o está abierto el resumen, abort de respuestas viejas, anti doble envío, guarda `signal.aborted` en las cargas de opciones (la task lo marca como arreglo fuera de alcance).
- Navegación posterior con el id de la reserva y banner de Mis clases (de HU-C-22).
- Cambios documentales: fachada K `obtenerNombreAula` (aula activa o inactiva) y nota en `spec_modulo_K.md`; excepción en DESIGN §6.4; nota de sincronización en spec C.
- Renombres «turno» → «clase» dentro de Solicitar (se solapa con HU-C-19).

### Violaciones a RULES.md / DESIGN.md

- **No se encontraron violaciones de RULES.md** atribuibles a esta HU. La Regla 7 se cumple con el bloqueo canónico documentado como excepción en spec C §3.17.
- DESIGN §9 (textos centrales): «Volver»/«Procesando…» hardcodeados en el componente común de C-25 y el literal de `solicitarTurnoPropio` (ver 4). Vienen de otras HU, pero se ven acá.
- DESIGN §6.4: el feedback (navegación + banner, sin toast) está documentado como excepción para HU-C-20, así que cumple.
- Paleta: la pantalla usa solo tokens. El fondo del diálogo común usa `bg-black/50` (color de Tailwind, no un token). Es del componente de C-25, no de esta HU.
- Observación de UX (no viola nada): después de un rechazo por cupo, «Volver» deja la lista de horarios sin refrescar, y la clase sigue apareciendo con los lugares viejos hasta recargar o cambiar la selección.

---

## 6. Datos para la prueba manual

**Credenciales:** todas con contraseña `Password123!`.

| Usuario | Rol / ficha |
|---|---|
| `alumno01@noctium.local` | Fernández, Sofía (ALUMNOS[0]) |
| `alumno02@noctium.local` | Martínez, Lucas (ALUMNOS[1]) |
| `alumno04@noctium.local` | González, Mateo (ALUMNOS[3]) |
| `gerente@noctium.local`, `mesa.entrada@noctium.local`, `profesor1@noctium.local` | Para el 403 |

**Fechas:** las clases del seed están en «días operativos» relativos al día en que se corrió el seed por primera vez (día 0 = el próximo día operativo después de esa corrida; las clases no se mueven en corridas posteriores). Mirá la fecha real en la pantalla antes de elegir. Tarifas: Matemática y Física $ 12.000/h, Programación I $ 13.000, Bases de Datos $ 11.000, Química $ 10.500, Inglés Técnico $ 9.000.

| Criterio | Usuario | Elección (Materia → Profesor → Horario) | Qué verificar |
|---|---|---|---|
| 1, 2, 4 (camino feliz) | `alumno04` | Física → Giménez, Laura → `seed-turno-05` (día operativo 1, 10:00–12:00, Aula 2, cupo 20, sin inscriptos) | Al tocar «Inscribirme» **no** se inscribe; el resumen muestra Física, «Giménez, Laura», «<Día> <n> de <mes> de <año>», 10:00–12:00, 120 minutos, Aula 2, lugares (20 o menos), **$ 24.000**, la leyenda del precio fijo y la del plazo (vence ≈ ahora + 24 h). «Volver» → siguen marcadas las tres columnas y «Tu elección». «Confirmar reserva» → Mis clases con el banner de la reserva |
| 2 (otras duraciones) | `alumno01` | Bases de Datos → Rossi → `seed-turno-06` (60 min) · Química → Vega → `seed-turno-16` (180 min) | $ 11.000 y $ 31.500 |
| 3 (plazo topeado por el inicio) | cualquiera | Una clase que empiece en menos de 24 h (día operativo 0 si estás el día anterior) | El vencimiento del plazo es la hora de inicio de la clase |
| 3 (leyenda de cancelación) | `alumno04` | Cualquiera | **Hoy no aparece** (bloqueante). Se puede ver el dato con el snippet de contraprueba de la sección 3: `limite_cancelacion_en_linea` = inicio − 24 h |
| 3 (límite ya pasado) | `alumno04` | Cualquiera, después de preparar el parámetro (abajo) | Con el snippet: `limite_cancelacion_pasado: true`. En pantalla hoy no cambia nada |
| 5 (cupo) | `alumno01` (navegador A) y `alumno02` (navegador B / incógnito) | Bases de Datos → Rossi → `seed-turno-06` (día operativo 1, 12:00–13:00, Aula 1). **Con el seed local** (paso 13) queda 9/10: 1 lugar | A abre el resumen («Lugares disponibles: 1»); B confirma; A toca «Confirmar reserva» → dentro del diálogo: «La clase alcanzó su cupo máximo»; en Mis clases de A no aparece. Alternativa: `seed-turno-21` (Matemática, Vega, 9/10) |
| 5 (superposición) | `alumno04`, dos pestañas | Pestaña A: Programación I → Rossi → `seed-turno-02` (día operativo 0, 10:00–12:00). Pestaña B: Física → (profesor de la demo) → `seed-turno-demo-p2` (día operativo 0, 10:00–12:00) | A abre el resumen; B confirma; A confirma → «Ya tenés otra clase en ese horario» y no se inscribe |
| 403 | `gerente` / `mesa.entrada` / `profesor1` | — | Snippet de la sección 3 |

### Cómo preparar lo que falta (sin tocar código)

1. **Límite de cancelación ya pasado (criterio 3c).** `npx prisma studio` → `ParametroSistema` → fila `cancelacion_anticipacion_horas` → `valor` = `500` → guardar. Abrí el resumen de cualquier clase de las próximas semanas: `limite_cancelacion_pasado` = `true`. **Volvé a poner `24` al terminar.** Con `plazo_pago_horas` podés probar el plazo de la misma forma: con `2`, vence ≈ ahora + 2 h; después volvé a `24`.
2. **Clase con un solo lugar si no tenés el seed local con el paso 13** (con el seed commiteado, las clases nacen sin inscriptos). Opción por pantalla: con `mesa.entrada` abrí el detalle de `seed-turno-06` (Aula 1, cupo 10) e inscribí 9 alumnos sin cuenta (HU-C-24, «Inscribir»), dejando 1 lugar. Opción por script de una sola vez: guardalo como `preparar-cupo.tmp.ts` en la raíz del repo, corré `npx tsx preparar-cupo.tmp.ts seed-turno-06` y **borralo después** (no lo commitees):

   ```ts
   import "dotenv/config";
   import { PrismaClient } from "@prisma/client";
   import { transaccion } from "./src/server/shared/transaccion";
   import { crearInscripcion } from "./src/server/turnos/inscripcion.publico";
   import { actorUsuario } from "./src/server/shared/historial";

   const prisma = new PrismaClient();

   async function main() {
   const turnoId = process.argv[2] ?? "seed-turno-06";
   const mesa = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } });
   const turno = await prisma.turno.findUniqueOrThrow({ where: { idTurno: turnoId } });
   const objetivo = (turno.cupoMaximoTurno ?? 0) - 1; // deja exactamente 1 lugar
   // Solo fichas activas SIN cuenta: los alumno01..06 quedan libres para probar.
   const candidatos = await prisma.alumno.findMany({ where: { activoAlumno: true, usuarioId: null }, orderBy: { idAlumno: "asc" } });
   for (const a of candidatos) {
     const vigentes = await prisma.turnoAlumno.count({ where: { turnoId, vigencia: "VIGENTE" } });
     if (vigentes >= objetivo) break;
     try {
       await transaccion((tx) => crearInscripcion(tx, { turnoId, alumnoId: a.idAlumno, origen: "CENTRO", conReserva: true, actor: actorUsuario(mesa.idUsuario) }), { db: prisma });
     } catch { /* superpuesto, ya inscripto o con reserva previa: se saltea */ }
   }
   console.log(turnoId, "vigentes:", await prisma.turnoAlumno.count({ where: { turnoId, vigencia: "VIGENTE" } }), "/", turno.cupoMaximoTurno);
   }

   main().catch(console.error).finally(() => prisma.$disconnect());
   ```
   Crea reservas con los servicios de dominio (mismas reglas que la app, como el paso 13 del seed). Ojo: las reservas vencen a las 24 h y entonces liberan el lugar.
3. **Superposición si el día operativo 0 ya pasó.** Es el único día del seed con dos clases confirmadas en el mismo horario. Con `gerente` o `mesa.entrada`, creá en `/turnos/nuevo` una clase de otra materia, con otro profesor y otra aula, a la misma fecha y hora que una clase futura en la que el alumno no esté. Por ejemplo, misma fecha y hora que `seed-turno-10` (Matemática, día operativo 3, 10:00–12:00). Después repetí el caso con esas dos clases.

---

## 7. Veredicto preliminar

**Volver al dev.**

**Bloqueantes:**

1. **Criterio 3, leyenda de cancelación: no se muestra.** Ninguna de las dos variantes aparece en el resumen («Si todavía no pagaste, podés cancelar la reserva hasta el …; … Si ya pagaste, podés cancelar en línea hasta el …» y la de «límite ya pasado»), y sus textos no existen en `src/lib/textos.ts`. La task lo difirió a HU-C-14, pero la HU solo difiere la **verificación** de la regla y del valor configurable. El backend ya devuelve `vence_pago_el`, `limite_cancelacion_en_linea` y `limite_cancelacion_pasado`, así que el arreglo es solo de pantalla y catálogo, debajo de la leyenda del plazo.
   *Si el PO decide aceptar el diferimiento* (porque HU-C-14 no está implementada y la leyenda prometería una cancelación que el alumno hoy no puede hacer), dejarlo por escrito. Con eso los criterios 1, 2, 4 y 5 quedan **listos para prueba manual**, pero HU-C-20 no puede pasar a Terminada hasta que entre HU-C-14 con la leyenda. El congelamiento del sprint es el martes 13/10 a las 23:59.

**No bloqueantes (para decidir o anotar):**

- Precio del resumen vs. precio guardado si la tarifa cambia entre el GET y el POST (DESVÍO menor del criterio 2): confirmar que la decisión «aceptada por Tomás» es del PO.
- DoD de textos: «Volver»/«Procesando…» del componente común de C-25 y el mensaje literal del 403 de `solicitarTurnoPropio` fuera del catálogo central.
- Falta el run de GitHub del workflow de textos (pendiente en la propia task).
