# Validación PO — HU-L-06 · Definir la tarifa por hora de cada materia

**Rama revisada:** `feature/prueba` @ `17f5daa` (la HU entró a `develop` con la PR #241, commit `b967acd`, merge `196ee36`).
**Fuente de verdad:** el texto de la HU pegado en el pedido de validación (no la task).
**Leído:** `prisma/schema.prisma`, `docs/RULES.md`, `docs/DESIGN.md`, `prisma/seed.ts`, `docs/specs/spec_modulo_L.md` (Revisión 3 y nota de sincronización HU-L-06), `docs/tasks/Sprint 3/Modulo L/HU-L-06.md`, `docs/testing/Modulo L/hu-l-06/README.md`. No hay en `docs/` un documento técnico de developers del Sprint 3 aparte de las specs, `PR-0.md` y `HU-Sprint-3.md`.
**Aviso sobre el seed:** el árbol de trabajo tiene `prisma/seed.ts` **modificado y sin commitear** (+101 líneas: alumnos 41..52 y un «paso 13» que inscribe reservas pendientes de pago en clases futuras). Esos cambios **no son de esta HU** y no se tocaron. La sección 6 indica qué datos dependen de ese cambio local.

**Pruebas corridas (sin modificar nada):**

| Qué | Resultado |
|---|---|
| `vitest run` de la HU (`src/server/materias`, `src/app/api/materias`, `src/app/(dashboard)/materias`, `precio-clase`) | **6 archivos, 64 tests en verde** (5 tests PG omitidos en esta corrida, sin base) |
| `npm run test:pg -- src/server/materias/materia.tarifa.pg.test.ts` (base descartable `noctium_pruebas_*`, se crea y se borra) | **5/5 en verde** (primera definición, concurrencia sin duplicar historial, rollback, precio congelado C-22/C-24/I-10, seed repetido conserva la tarifa) |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador HU-C-23) | «Claves de textos verificadas.» |
| `vitest run` completo (toda la suite unitaria) | **250 archivos / 3170 tests en verde** (51 archivos PG omitidos), sin fallos |

---

## 1. Trazabilidad de criterios

| # | Criterio (viñeta) | Dónde está implementado | Estado | Justificación |
|---|---|---|---|---|
| 1a | El listado de materias (HU-L-02) muestra la tarifa por hora de cada una | `listarMaterias(query, { conTarifa })` (`src/server/materias/materia.service.ts:164-193`) selecciona `tarifaHoraMateria` solo con `conTarifa`; `GET /api/materias` (`src/app/api/materias/route.ts:7-22`) calcula `conTarifa` en el servidor; pantalla `src/app/(dashboard)/materias/page.tsx:113,136` (columna «Tarifa por hora», «$ 12.000» o «Sin tarifa») | **CUBIERTO** | Para Gerente y Mesa. Al Profesor la columna no se le muestra y la API no manda la clave (ver 7) |
| 1b | Desde el detalle, «Cambiar tarifa» pide un importe entero en pesos, mayor que 0 | Botón en `src/app/(dashboard)/materias/[id]/page.tsx:109` (solo `materias:cambiar_tarifa` y materia activa); modal `cambiar-tarifa-dialog.tsx`; `TarifaHoraSchema` (`materia.schema.ts:53-62`: `int().positive().max(1_000_000)`), validado en cliente y en servidor (`PUT` y action) | **CUBIERTO** + **DESVÍO menor** | La task agrega un **tope de $ 1.000.000 por hora** (P-L3) que la HU no pide; el mensaje de error lo menciona («…mayor que 0 y hasta $ 1.000.000.»). Lo decidió el equipo de desarrollo, no figura como decisión del PO |
| 1c | El error se muestra junto al campo | `cambiar-tarifa-dialog.tsx:76` (`<p id="tarifa-error" role="alert">` bajo el input, `aria-invalid`, foco vuelve al campo) | **CUBIERTO** | Los rechazos del servidor (409/422) se muestran dentro de la confirmación C-25, no junto al campo (es el patrón del componente común) |
| 1d | Si el importe es igual al actual: «La tarifa es la misma que la actual» | Cliente: `cambiar-tarifa-dialog.tsx:35-38`; servidor: `cambiarTarifaMateria` (`materia.service.ts:372`) → `422 TARIFA_SIN_CAMBIO`; texto `errores.materias.tarifaSinCambio` (`textos.ts:1459`) | **CUBIERTO** | Texto literal idéntico. El servidor no escribe ni registra historial |
| 2a | Confirmación HU-C-25: «¿Estás seguro de que querés cambiar la tarifa de Física I de $ 12.000 a $ 15.000 por hora?» | `ConfirmarAccionDialog` (`src/components/shared/confirmar-accion-dialog.tsx`) desde `cambiar-tarifa-dialog.tsx:86-94`; texto `confirmaciones.materias.tarifa` (`textos.ts:1456`); montos con `formatearMonto` (`src/lib/moneda.ts`, «$ 12.000») | **CUBIERTO** | Plantilla literal; con «Física» a 12.000 → 15.000 sale «…de Física de $ 12.000 a $ 15.000 por hora?». Para una materia «Sin tarifa» usa otro texto (`confirmaciones.materias.definirTarifa`), caso que la HU no contempla (ver 5) |
| 2b | Al guardar: «Tarifa actualizada correctamente» | `onExito` → `toast.success(texto("ui.materias.tarifa.exito"))` (`cambiar-tarifa-dialog.tsx:94`; `textos.ts:1443`) + `router.refresh()` | **CUBIERTO** | Toast, como fija DESIGN §6.4 para HU-L-06 |
| 3 | Precio de una clase = tarifa × duración en horas (Física I a $ 12.000 → clase de 2 h = $ 24.000) | Helper único `precioClase` (`src/server/shared/precio-clase.ts`): `tarifa * duracionMin / 60`. Lo usan `crearInscripcion` (`inscripcion.service.ts:335-336`), el resumen del alumno (`turno.resumen-inscripcion.service.ts:47`), el cobro (`pago.service.ts:174`) y el ejemplo de la ficha (`materias/[id]/page.tsx:113`, «por hora · una clase de 2 h cuesta $ 24.000») | **CUBIERTO** | Las tarifas se leen por la fachada `obtenerTarifasPorIds` (`materia.publico.ts:42`), sin acceso directo de C/I a la tabla (Regla 3) |
| 4a | El precio se guarda en la inscripción al crearla, con la tarifa vigente: reserva del alumno (C-22 c6) | `crearInscripcion` paso 4 y 6 (`inscripcion.service.ts:334-361`): `precio` se calcula dentro de la transacción y se inserta en `TurnoAlumno.precio` (`schema.prisma:688`, NOT NULL, CHECK > 0). Único `turnoAlumno.create` del código | **CUBIERTO** | Test PG: reserva del alumno a $ 12.000 |
| 4b | … inscripción en el centro (C-24 c3) | Mismo `crearInscripcion` con `origen: "CENTRO"` | **CUBIERTO** | Test PG: nueva inscripción del centro a $ 15.000 tras el cambio |
| 4c | … inscripción al confirmar el pago (I-10) | `registrarOperacion` (`operacion.service.ts:135`) crea con `crearInscripcion` (origen PAGO) y cobra `creada.inscripcion.precio` | **CUBIERTO** | Test PG: pago directo a $ 15.000. Ese camino solo existe si el alumno tuvo una reserva vencida o cancelada sin pago (contrato de C-24/I-10, no de esta HU) |
| 4d | No cambia aunque cambie la tarifa (individual o masiva); rige solo para inscripciones nuevas (ej. Juan) | `aplicarCambiosDeTarifa` (`materia.service.ts:343-359`) solo escribe `materias` e `historial_tarifas`; el cobro de una inscripción existente usa `inscripcion.precio` (`operacion.service.ts:139-146,188`) | **CUBIERTO** (masivo **diferido** a HU-L-07) | Test PG: reserva a $ 12.000, cambio a $ 15.000, cobro a $ 12.000. El cambio masivo no existe todavía (no hay `GET/POST /api/materias/tarifas`); la función compartida ya acepta `masivo: true` |
| 5 | Toda inscripción guarda su precio al crearse, con las tarifas de prueba del seed hasta que el gerente las cambie | Seed: `MATERIAS[].tarifa` (`seed.ts:196-204`), cargada **solo en la rama `create`** del upsert (`seed.ts:1784`), así una segunda corrida no pisa cambios; sin `HistorialTarifa` inicial. Fixtures y el «paso 13» local inscriben con `crearInscripcion` | **CUBIERTO** | Test PG «seed oficial completo repetido conserva tarifa cambiada e historial». Tarifas del seed: Matemática y Física 12.000; Programación I 13.000; Bases de Datos 11.000; Química 10.500; Inglés Técnico 9.000; Historia de la Ciencia (inactiva) 9.500 |
| 6a | Cada cambio = registro nuevo con tarifa anterior, nueva, usuario, fecha y si fue masivo (Regla 8) | `historialTarifa.create` en `aplicarCambiosDeTarifa` (`materia.service.ts:354-357`), en la misma transacción que el `update` de la materia; modelo `HistorialTarifa` (`schema.prisma:555-569`) con CHECK de montos. No hay ningún `update`/`delete` de `historialTarifa` en el código | **CUBIERTO** | `masivo` siempre `false` hasta que exista HU-L-07 |
| 6b | El historial se ve en el detalle de la materia | `obtenerMateriaPorId(…, { conTarifa })` (`materia.service.ts:200-240`): orden fecha/id descendente, nombre del usuario por `obtenerNombresPersonal`; tabla en `materias/[id]/page.tsx:116-126` (Fecha, Anterior, Nueva, Usuario, Cambio: «Individual»/«Cambio masivo») | **CUBIERTO** | Sin cambios muestra «Sin cambios de tarifa.» Sin paginar (decisión de la spec) |
| 7a | Solo el Gerente cambia tarifas; el servidor responde 403 a otros roles | `PUT /api/materias/[id]/tarifa` con `withPermission("materias:cambiar_tarifa")` (`src/app/api/materias/[id]/tarifa/route.ts:8`); Server Action `cambiarTarifaMateria` con `verificarPermiso` **antes** de validar (`actions.ts:73-75`); permiso sembrado solo para GERENTE (`seed.ts:871`) | **CUBIERTO** | 403 `SIN_PERMISO` para Mesa, Profesor y Alumno |
| 7b | Mesa de entrada ve la tarifa y el precio al cobrar (I-10) | `materias:ver_tarifa` para MESA_ENTRADA (`seed.ts:872`): ve columna, ficha e historial **sin** botón; precio al cobrar en `pagos/registrar/paso-clases-alumno.tsx` y `turno-pago-card.tsx` | **CUBIERTO** | |
| 7c | El alumno ve el precio al reservar (C-20) | `turno.resumen-inscripcion.service.ts:47` y `alumno/turnos/solicitar/solicitar-turno.tsx` (texto `ui.turnos.resumen.precioFijo`) | **CUBIERTO** | El alumno **no** accede a Materias (`GET /api/materias` → 403); ve el precio guardado/calculado por C |
| 7d | El profesor no ve precios | Listado/detalle: `conTarifa` falso → las claves `tarifa_hora`/`historial_tarifas` no existen ni se seleccionan; detalle de clase: `turno.detalle.ts:46-51` no carga pagos ni precios para PROFESOR | **CUBIERTO** | Recorte en el servidor, no solo en la UI |

**Resumen:** los 7 criterios están **CUBIERTOS**. Desvíos de la task respecto de la HU: tope de $ 1.000.000 (1b), y los agregados de la sección 5 (materia inactiva, guarda de concurrencia, estado «Sin tarifa»). El cambio masivo de 4d y 6a queda para HU-L-07, como dice la propia HU.

---

## 2. Textos literales (HU-C-23)

| Texto del criterio | Clave en `src/lib/textos.ts` | Valor en el código | ¿Coincide? |
|---|---|---|---|
| «Cambiar tarifa» | `ui.materias.tarifa.cambiar` (l. 1431) | «Cambiar tarifa» | Sí |
| «La tarifa es la misma que la actual» | `errores.materias.tarifaSinCambio` (l. 1459) | «La tarifa es la misma que la actual» | Sí |
| «¿Estás seguro de que querés cambiar la tarifa de Física I de $ 12.000 a $ 15.000 por hora?» | `confirmaciones.materias.tarifa` (l. 1456) | «¿Estás seguro de que querés cambiar la tarifa de {materia} de {anterior} a {nueva} por hora?» con `formatearMonto` → «$ 12.000» | Sí (verificado el formato: `$ 9.000`, `$ 12.000`, `$ 24.000`) |
| «Tarifa actualizada correctamente» | `ui.materias.tarifa.exito` (l. 1443) | «Tarifa actualizada correctamente» | Sí |

**No hay diferencias palabra por palabra.** Única observación: en el seed la materia se llama «Física», no «Física I», así que en la prueba manual el texto saldrá con «Física».

---

## 3. Reglas de servidor

| Regla | Verificación | Estado |
|---|---|---|
| Validación Zod (Regla 6) | `CambiarTarifaSchema.strict()`: `tarifa_hora` y `tarifa_actual` obligatorias, enteras, > 0, ≤ 1.000.000; cualquier otro campo → 400 `VALIDACION` con `detalles` (`flatten`) | Cumple. Código `VALIDACION` (el de Materias), no `VALIDATION_ERROR` de la spec; documentado en la nota de sincronización |
| Permisos (Regla 10) | `withPermission("materias:cambiar_tarifa")` en la ruta, `verificarPermiso` en la action antes del Zod, `tienePermiso` para mostrar el botón | Cumple |
| Transacción y bloqueo (Regla 7) | `transaccion()` → `bloquear(tx, { recursos: { materias: [id] } })` → relectura de la fila bloqueada → chequeos (404, 422 inactiva, 409 tarifa mostrada distinta, 422 igual) → `update` + `insert` del historial. Timeout de bloqueo → 409 `TRANSACCION_OCUPADA` | Cumple con el patrón del proyecto (bloqueo pesimista de PR-0 §2.10, no el `updateMany` literal de la Regla 7; está aceptado en la spec §3.8). Test PG de dos cambios simultáneos: uno 200, otro 409, un solo registro |
| Registro nuevo, no modificación (Regla 8) | Solo `historialTarifa.create`; CHECK de montos en la migración; ningún `update`/`delete` sobre `historial_tarifas`. No toca inscripciones | Cumple |
| Trazabilidad (Regla 2) | Historial en la **misma** transacción, no después del commit | Excepción documentada en la spec (P-L6) y PR-0, **no** en `RULES.md` (ver 5) |
| Contrato `{data, error}` (Regla 5) | Ruta y action devuelven el sobre; 200 / 400 / 403 / 404 / 409 / 422 | Cumple |

### Endpoints relevantes

| Método y ruta | Permiso | Quién lo usa |
|---|---|---|
| `PUT /api/materias/[id]/tarifa` | `materias:cambiar_tarifa` (Gerente) | Cambiar tarifa (la pantalla usa la Server Action equivalente `cambiarTarifaMateria`) |
| `GET /api/materias` | `materias:leer` (+ tarifa con `materias:ver_tarifa` o `materias:cambiar_tarifa`) | Listado |
| `GET /api/materias/[id]` | ídem | Detalle + historial |

### Snippets para la consola del navegador

Iniciar sesión con el rol a probar, abrir cualquier pantalla de la app (mismo origen) y pegar en la consola (F12).

**a) PUT con Mesa de entrada o Profesor (debe dar 403):**
```js
// Toma el id de "Física" del listado (Mesa y Profesor pueden leer el listado)
const lista = await (await fetch("/api/materias")).json();
const fisica = lista.data.items.find((m) => m.nombre === "Física");
const r = await fetch(`/api/materias/${fisica.id}/tarifa`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tarifa_hora: 15000, tarifa_actual: 12000 }),
});
console.log(r.status, await r.json()); // esperado: 403 { data: null, error: { code: "SIN_PERMISO", ... } }
```

**b) PUT con Alumno (debe dar 403; el alumno no puede leer el listado, así que pegá el id):**
```js
const id = "PEGAR_ID_DE_FISICA"; // copiarlo de la URL /materias/<id> con la sesión del gerente
const r = await fetch(`/api/materias/${id}/tarifa`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tarifa_hora: 15000, tarifa_actual: 12000 }),
});
console.log(r.status, await r.json()); // esperado: 403 SIN_PERMISO
console.log((await fetch("/api/materias")).status); // esperado: 403 (el alumno no lee Materias)
```

**c) Profesor no recibe precios (debe dar 200 sin claves de tarifa):**
```js
const l = await (await fetch("/api/materias")).json();
console.log(l.data.items.some((m) => "tarifa_hora" in m)); // esperado: false
const d = await (await fetch(`/api/materias/${l.data.items[0].id}`)).json();
console.log("tarifa_hora" in d.data, "historial_tarifas" in d.data); // esperado: false false
```

**d) Gerente — rechazos del servidor (control, no 403):**
```js
const l = await (await fetch("/api/materias")).json();
const f = l.data.items.find((m) => m.nombre === "Física");
const put = (body) => fetch(`/api/materias/${f.id}/tarifa`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => console.log(r.status, (await r.json()).error?.code));
await put({ tarifa_hora: 0, tarifa_actual: f.tarifa_hora });            // 400 VALIDACION
await put({ tarifa_hora: 12000.5, tarifa_actual: f.tarifa_hora });      // 400 VALIDACION
await put({ tarifa_hora: f.tarifa_hora, tarifa_actual: f.tarifa_hora }); // 422 TARIFA_SIN_CAMBIO
await put({ tarifa_hora: 15000, tarifa_actual: 1 });                    // 409 CONFLICTO_EDICION_CONCURRENTE
```
(Ninguno de estos escribe nada. **No** ejecutar uno con datos válidos si no se quiere cambiar la tarifa real.)

---

## 4. Definición de Terminado

| Ítem | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Cumple con observación menor** | Todo lo nuevo de la HU sale de `textos.ts` y el comprobador C-23 pasa. Pero las líneas que la HU **reescribió** en la ficha y el listado conservan literales de Sprint 1: «Materia actualizada correctamente», «Modificar», «Sin profesores asociados», «Activa»/«Inactiva», «Materias» (miga de pan y título) en `materias/[id]/page.tsx:84,87,102,95` y `materias/page.tsx:40`. Son textos anteriores (migración de C-19), no bloquean |
| Ningún texto visible con «turno» | **Cumple** | Ninguna clave `ui.materias.*`, `confirmaciones.materias.*` ni `errores.materias.*` dice «turno»; la ficha dice «clase» |
| Confirmación con el componente común de HU-C-25 en toda operación que guarda | **Cumple** | La única operación que guarda (cambiar tarifa) usa `ConfirmarAccionDialog`; «Volver» conserva el importe; durante el envío no se puede cerrar ni reenviar |
| Tests en verde | **Cumple** (HU) | 64 unitarios + 5 PG de la HU en verde. Suite completa: ver nota al final de esta sección |
| DoD de la propia task | Observación | La task deja sin tildar «Tipos, textos C-23, pruebas dirigidas y CI del SHA final aprobados» y «PR exclusiva a develop», aunque la PR #241 ya se integró. El enlace a la evidencia (`../../../testing/hu-l-06/README.md`) quedó roto: la carpeta se movió a `docs/testing/Modulo L/hu-l-06/` |

**Suite unitaria completa (`npx vitest run`, 11/10/2026):** **250 archivos en verde, 51 omitidos (PG); 3170 tests en verde, 349 omitidos. Sin fallos.** La suite PG global (`npm run test:pg` sin filtro) no se corrió; solo la de esta HU.

---

## 5. Extras y violaciones

### Implementado sin que la HU lo pida
1. **Tope de $ 1.000.000 por hora** (P-L3) y su mención en el mensaje de error. La HU solo pide «entero, mayor que 0». **Decisión para el PO**: aceptarlo o pedir que se quite el tope del mensaje.
2. **Materia inactiva:** no muestra «Cambiar tarifa» y el servidor responde `422 MATERIA_INACTIVA` (P-L4). La HU no lo menciona.
3. **Guarda de concurrencia:** el cliente manda `tarifa_actual`; si otra persona la cambió, `409` con «La tarifa fue modificada por otra persona. Recargá para ver la tarifa actual.» y un botón «Recargar tarifa actual» (P-L7).
4. **Estado «Sin tarifa»:** una materia creada con el alta de HU-L-01 nace sin tarifa (columna `Int?`), muestra «Sin tarifa», la primera definición usa otra confirmación («¿…definir la tarifa de X en $ N por hora?») y deja historial con anterior «Sin tarifa». Mientras no la tenga, **no admite inscripciones** (`422 MATERIA_SIN_TARIFA`). La HU no prevé materias sin tarifa: **conviene que el PO lo sepa**, porque una materia nueva no se puede usar hasta que el gerente le ponga tarifa.
5. Texto explicativo en el listado y en el modal («La tarifa por hora define el precio de cada clase (tarifa × duración). La tarifa nueva rige para las inscripciones que se hagan desde ahora…»), ejemplo «por hora · una clase de 2 h cuesta $ X» en la ficha, y rediseño de la ficha (tarjetas «Datos de la materia», «Profesores que la dictan» con aviso de Mesa de Entradas).
6. Clave sin uso: `ui.materias.tarifa.volver` (el «Volver» lo pone el componente común).

### Violaciones a RULES.md / DESIGN.md
- **Regla 2 (menor, documentada):** `HistorialTarifa` se escribe dentro de la transacción de negocio, cuando la Regla 2 pide escribir las tablas de trazabilidad separadas después del commit. Está justificado y documentado en la spec L (P-L6, §4) y en PR-0, pero `RULES.md` no tiene la nota de excepción que sí tienen otras HU. No bloquea.
- **Regla 6 (menor):** el `[id]` de la ruta y de la action no se valida con Zod (un id inexistente da 404, no hay riesgo). Mismo criterio que el resto de las rutas de Materias.
- **DESIGN §9 / HU-C-23 (menor):** literales heredados en líneas reescritas (ver sección 4).
- **DESIGN paleta y feedback:** sin colores a mano (solo tokens: `text-destructive`, `bg-success`, `text-muted-foreground`…); feedback de éxito con toast desde modal y fila propia en §6.4. **Sin violaciones.**

---

## 6. Datos para la prueba manual

**Credenciales** (contraseña de todas: `Password123!`):

| Rol | Cuenta |
|---|---|
| Gerente | `gerente@noctium.local` (Silvia Paredes) · `gerente2@noctium.local` (Roberto Quiroga) |
| Mesa de entrada | `mesa.entrada@noctium.local` (Marta Ruiz, caja abierta por el seed) · `mesa.entrada2@noctium.local` |
| Profesor | `profesor1@noctium.local` … `profesor4@noctium.local` |
| Alumno | `alumno01@noctium.local` … `alumno06@noctium.local` |

**Materias del seed:** Matemática (MAT101, $ 12.000), **Física** (FIS101, $ 12.000), **Programación I** (PRG101, $ 13.000), Bases de Datos (BDD201, $ 11.000), Química (sin código, $ 10.500), Inglés Técnico (sin código, $ 9.000), **Historia de la Ciencia** (HIS101, **inactiva**, $ 9.500). Ninguna tiene historial al empezar.

| Criterio | Cómo probarlo |
|---|---|
| 1 | Gerente → Materias: columna «Tarifa por hora». Abrir **Física** → «Cambiar tarifa»: probar vacío, `0`, `-5`, `12000.5` (error junto al campo) y `12000` («La tarifa es la misma que la actual»). Abrir **Historia de la Ciencia**: no tiene el botón |
| 2 | Física → `15000` → «Guardar tarifa»: confirmación «¿Estás seguro de que querés cambiar la tarifa de Física de $ 12.000 a $ 15.000 por hora?». Probar «Volver» (conserva el importe) y confirmar: toast «Tarifa actualizada correctamente» |
| 3 | La ficha de Física a $ 12.000 dice «una clase de 2 h cuesta $ 24.000». Con alumno01 → «Solicitar clase» de Física: el resumen muestra tarifa × duración (2 h → $ 24.000; 1 h → $ 12.000) |
| 4 (C-22) | **Antes** de cambiar la tarifa: alumno01 reserva una clase de **Programación I** (2 h → $ 26.000). Gerente cambia Programación I de $ 13.000 a $ 15.000. alumno01 en «Mis clases» sigue viendo $ 26.000; mesa.entrada en «Registrar pago» de alumno01 ve $ 26.000. alumno02 reserva otra clase de Programación I → $ 30.000 |
| 4 (C-24) | Después del cambio, mesa.entrada inscribe en el centro a un alumno en una clase de Programación I → $ 30.000 |
| 4 (I-10) | Requiere una reserva **vencida** sin pago (ver «Preparación» abajo). Con ella, mesa.entrada → «Registrar pago» del alumno → la clase aparece como «Se inscribe al confirmar el pago» con el precio de la tarifa vigente; al cobrar, la inscripción queda con ese precio |
| 5 | Tras cada caso, en Prisma Studio (`npx prisma studio`) tabla `turno_alumno`: columna `precio` completa en todas las filas. Repetir `npx prisma db seed` no debe volver la tarifa al valor del seed ni borrar el historial |
| 6 | Ficha de Física: tabla de historial con fecha, «$ 12.000» → «$ 15.000», «Paredes, Silvia» (o como resuelva el nombre), «Individual». En Prisma Studio, tabla `historial_tarifas`: un registro por cambio, `masivo = false`. Hacer un segundo cambio y ver que se **agrega** una fila y la anterior no cambia |
| 7 | Mesa: ve columna, tarjeta e historial **sin** «Cambiar tarifa». Profesor (profesor1): Materias sin columna de tarifa ni tarjeta; detalle de una clase propia sin precios. Alumno: no tiene Materias en el menú. Snippets de la sección 3 para el 403 |
| Concurrencia (extra) | gerente en un navegador y gerente2 en una ventana privada abren el modal de la misma materia; el primero guarda; el segundo, al confirmar, ve el error de conflicto y «Recargar tarifa actual» |
| Sin tarifa (extra) | Gerente → «Nueva materia» (alta de HU-L-01): nace «Sin tarifa»; definir $ 10.000 → confirmación «definir la tarifa de…»; historial «Sin tarifa» → «$ 10.000» |

### Qué depende del seed local sin commitear
Con el `seed.ts` local (paso 13), si la base se sembró con él, ya existen reservas pendientes de pago: por ejemplo alumno02..06 en `seed-turno-13` (**Programación I**, 2 h, $ 26.000) y alumno01 en `seed-turno-14` (Física, 2 h, $ 24.000). Sirven directamente para el criterio 4: cambiar la tarifa y ver que esas reservas conservan su precio. Para verificarlo: Prisma Studio → `turno_alumno`, filtrar `turnoId = seed-turno-13`. **Con el seed commiteado** esas reservas no existen: crearlas a mano como indica la tabla (alumno reserva desde «Solicitar clase» o mesa inscribe desde el detalle de la clase).

### Preparación: reserva vencida para el caso I-10
No hay forma de producirla desde la interfaz sin esperar el plazo de pago (24 h, parámetro `plazo_pago_horas`). Opción sin tocar código: guardar este script **fuera del control de versiones** (por ejemplo `scripts/tmp-reserva-vencida.ts`, y borrarlo después), correrlo **antes** de cambiar la tarifa, una sola vez, contra la base local:

```ts
// npx tsx scripts/tmp-reserva-vencida.ts   (borrarlo después; no commitear)
// Crea, por los servicios de dominio, una reserva de alumno01 hecha "hace 48 h"
// en una clase futura de Programación I: con plazo de 24 h ya está vencida.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { crearInscripcion } from "../src/server/turnos/inscripcion.publico";
import { transaccion } from "../src/server/shared/transaccion";
import { actorUsuario } from "../src/server/shared/historial";
import { conReloj, ahora } from "../src/server/shared/reloj";

const TURNO_ID = "seed-turno-20"; // Programación I, futura, 2 h. Si falla, probar seed-turno-15
const EMAIL_ALUMNO = "alumno01@noctium.local";
const prisma = new PrismaClient();

async function main() {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: EMAIL_ALUMNO } });
  const alumno = await prisma.alumno.findUniqueOrThrow({ where: { usuarioId: usuario.idUsuario } });
  const hace48h = new Date(ahora().getTime() - 48 * 3600_000);
  const r = await conReloj(hace48h, () => transaccion(
    (tx) => crearInscripcion(tx, { turnoId: TURNO_ID, alumnoId: alumno.idAlumno, origen: "ALUMNO", conReserva: true, actor: actorUsuario(usuario.idUsuario) }),
    { db: prisma },
  ));
  console.log("Reserva creada (ya vencida):", r.inscripcion.id, "precio", r.inscripcion.precio);
}
main().catch((e) => { console.error(e.code ?? "", e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

Después: el gerente cambia Programación I a $ 15.000 y mesa.entrada registra el pago de alumno01 en esa clase → se crea una inscripción nueva a **$ 30.000** (tarifa vigente), y la reserva vencida conserva $ 26.000. Si el script responde `ALUMNO_NO_DISPONIBLE` (choque de horario) o `CUPO_INSUFICIENTE`, cambiar `TURNO_ID` por otra clase futura de Programación I del seed (`seed-turno-15`, `seed-turno-20` o `seed-turno-demo-p1`).

---

## 7. Veredicto preliminar

**Lista para prueba manual.**

**Bloqueantes:** ninguno.

**Para decidir o anotar (no bloquean):**
1. Tope de $ 1.000.000 y su mención en el mensaje de error: no lo pide la HU (aceptar o pedir que se quite).
2. Materias sin tarifa (las que se crean con el alta) no admiten inscripciones hasta que el gerente les ponga tarifa: comportamiento que la HU no prevé.
3. Rechazo del cambio en materias inactivas (422) y guarda de concurrencia (409): agregados razonables, no pedidos.
4. Literales de Sprint 1 en líneas reescritas de la ficha y el listado (migración de C-19).
5. Excepción a la Regla 2 (historial dentro de la transacción) documentada en la spec pero no en `RULES.md`.
6. El cambio masivo (criterios 4 y 6) solo se puede probar cuando exista HU-L-07.
7. `prisma/seed.ts` tiene cambios locales sin commitear, ajenos a esta HU.
