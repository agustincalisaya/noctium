# Validación PO — HU-E-09 · Registrar asistencia individual por clase

**Rama revisada:** `feature/prueba` @ `17f5daa` (la HU entró a `develop` con la PR #217, commit `1d699a7`; después la tocaron E-07 `c95786a`, E-11 `fb6ab48` y C-19 `e6e20ca`).
**Fuente de verdad:** el texto de la HU pegado en el pedido de validación (no la task).
**Leído:** `prisma/schema.prisma`, `docs/RULES.md`, `docs/DESIGN.md`, `prisma/seed.ts`, `docs/specs/spec_modulo_E.md` (Revisión 2: T2, T4, P-E1, §2.1, §2.5.2, §2.6, §2.12, §3.12), `docs/tasks/Sprint 3/Modulo E/HU-E-09.md`, `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-E-09, HU-C-25 y Definición de Terminado), `docs/testing/Modulo E/hu-e-09/HU-E-09-evidencia.md`. No hay en `docs/` un documento técnico de developers del Sprint 3 aparte de las specs, `PR-0.md` y `HU-Sprint-3.md`.
**Aviso sobre el seed:** el árbol de trabajo tiene `prisma/seed.ts` **modificado y sin commitear** (alumnos 41..52 y un «paso 13» que inscribe reservas en clases futuras). No es de esta HU y no se tocó. La sección 6 indica qué datos dependen de ese cambio.

**Pruebas corridas (sin modificar nada):**

| Qué | Resultado |
|---|---|
| `vitest run` de la HU (`src/server/historial`, `src/app/api/turnos/[id]/clase-dictada`, `src/app/(dashboard)/turnos/[id]`, `src/app/(dashboard)/alumnos/[id]`, `mi-historial`, `turno.acciones.test.ts`) | **37 archivos, 330 tests en verde** (9 archivos PG omitidos en esa corrida) |
| `npm run test:pg -- clase-dictada.service.pg.test.ts asistencia.pg.test.ts mi-historial.pg.test.ts seed-asistencia.pg.test.ts` (base descartable, se crea y se borra) | **16/16 en verde** (snapshot + auditoría sin tocar pagos, sin cuerpo = sin control, rollback de validación, reserva vencida excluida, concurrencia con un único ganador, re-registro tras anulación, fin exacto, entrada HTTP, seed repetido) |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador HU-C-23) | «Claves de textos verificadas.» |
| `npx vitest run` completo | **250 archivos / 3170 tests en verde** (51 archivos PG omitidos), sin fallos |

---

## 1. Trazabilidad de criterios

| # | Criterio (viñeta) | Dónde está implementado | Estado | Justificación |
|---|---|---|---|---|
| 1a | En el detalle de una clase **que ya empezó** y no se registró, la lista de inscriptos muestra Presente/Ausente a la derecha de cada alumno | `turno-alumnos-card.tsx:50-51` (`iniciada` = inicio ≤ ahora, refresco cada 30 s; `editable` = permiso `clases:registrar` + sin `clase_dictada` + iniciada + Disponible/Completa) y botones por alumno `:115-122` | **CUBIERTO** | Las opciones aparecen desde el inicio de la clase, para Mesa y para el Profesor de esa clase (el Profesor solo abre sus propias clases: `obtenerTurno` lo exige) |
| 1b | … y «Registrar clase dictada» guarda la clase **que ya empezó** | Botón en `turno-clase-card.tsx:70` deshabilitado salvo `acciones_habilitadas.registrar_clase` (`turno.acciones.ts:69-72`: exige `turnoYaTermino`); servidor `prepararClase` (`clase-dictada.service.ts:73-76`) → `409 CLASE_NO_FINALIZADA` | **DESVÍO** | La HU habla de una clase que **ya empezó**; la task/spec (T2, P-E1) conservan la regla de Sprint 2 (Q7c): se registra recién cuando la clase **terminó**. Entre el inicio y el fin se ven las marcas pero el botón está deshabilitado con «Podés registrarla cuando la clase haya terminado.», y si se recarga la página se pierden las marcas (lo dice P-E1). La decisión la tomó el Scrum Master el 08/10 y figura como «informativo» al PO: **el PO tiene que aceptarla o rechazarla** |
| 1c | Solo alumnos con inscripción vigente (sin canceladas, reservas vencidas, bajas ni quitadas por el centro) | Lista: `turno.alumnos` de C filtrado con `filtroVigenteEn(ahora)` (`turno.service.ts:48`, `inscripcion.vigencia.ts`); servidor: `marcarVencidas` + `inscripcionesVigentes` (`clase-dictada.service.ts:146-150`) | **CUBIERTO** | Una reserva cuyo vencimiento pasó no figura aunque todavía no esté marcada. Test PG «excluye reserva vencida». Visto en la base local: la clase H-10 del 22/09/2025 tiene canceladas, quitada, baja y vencidas, y solo lista a Martínez (ver 6) |
| 1d | Todos vienen marcados como Presente | `seleccion[id] ?? "PRESENTE"` (`turno-alumnos-card.tsx:53,117`) | **CUBIERTO** | |
| 1e | Elegida en verde (Presente) o rojo (Ausente), siempre con texto | Presente elegido: `bg-attendance-selected text-card`; Ausente: `bg-destructive text-card`; no elegido: borde neutro. Texto «Presente»/«Ausente» y `aria-pressed` (`:117-120`), grupo con `aria-label` «Asistencia de {alumno}» | **CUBIERTO** | Tokens de DESIGN (`--attendance-selected` documentado en DESIGN «Selección de asistencia») |
| 1f | Debajo de la lista, «Registrar clase dictada» guarda la clase con la asistencia | `TurnoClaseCard` dentro de la misma sección, después de la lista (`turno-alumnos-card.tsx:183-191`); envía siempre `{ asistencias }` (`turno-clase-card.tsx:34-36`) | **CUBIERTO** (con el desvío de 1b) | Confirmación con `ConfirmarAccionDialog` y toast «Clase dictada registrada correctamente». El texto de la confirmación **no sigue el patrón de HU-C-25** (ver 4) |
| 1g | Sin formulario ni recuadro aparte para la asistencia | Las opciones están en la misma fila de cada alumno; el registro es un bloque con `border-t` dentro de la tarjeta «Alumnos inscriptos» | **CUBIERTO** | |
| 1h | «Marcar todos ausentes / presentes» | Botón único que alterna (`turno-alumnos-card.tsx:145`): dice «Marcar todos ausentes» salvo que **todos** estén ausentes, en cuyo caso dice «Marcar todos presentes» | **CUBIERTO** (observación) | Con una selección mezclada solo ofrece «Marcar todos ausentes»; para volver a «todos presentes» hay que pasar primero por «todos ausentes». Se ve solo con al menos un inscripto |
| 1i | Una vez registrada, la misma lista muestra «Presente» (verde) o «Ausente» (rojo) con el total | Etiqueta por alumno (`:123-125`: `bg-success` / `bg-destructive-soft`) y total `ui.historial.asistencia.totales` (`:159`), leídos del `GET /api/turnos/[id]/clase-dictada` (valor vigente) | **CUBIERTO** (observación de texto) | El total dice «2 presentes · 1 ausentes»: con 1 queda en plural (ver 2) |
| 1j | Las clases «sin control de asistencia» se muestran como tales | Etiqueta gris «Sin control de asistencia» por alumno y «Clase sin control de asistencia» en lugar del total | **CUBIERTO** | |
| 2 | Al confirmar se guarda la asistencia de cada alumno junto con la clase, en la misma transacción | `registrarClaseDictadaDesdeSolicitud` (`clase-dictada.service.ts:140-157`): una `transaccion()` → `bloquear` → validaciones → `INSERT … ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING` → `createMany` de `ClaseDictadaAlumno` con `estadoAsistencia`; `conControlAsistencia = true` | **CUBIERTO** | Test PG «validación incompleta revierte todo y no genera clase parcial» y «dos registros simultáneos tienen un ganador» |
| 3a | Historial académico (HU-E-05) muestra por clase dictada «Asistió» (verde) o «Ausente» (rojo), con texto | `historial.service.ts` (`asistencia` vigente por ítem); `historial-academico.tsx:144` (`bg-success` «Asistió», `bg-destructive-soft` «Ausente», gris «Asistió (sin control de asistencia)») | **CUBIERTO** | Mesa y Gerente por la ficha; Profesor por `/turnos/[id]/alumnos/[alumnoId]/historial`, solo la materia de su clase |
| 3b | Mismo dato en «Mi historial» (HU-E-08) | `mi-historial.tsx:58` («Asistió» con `Badge success`, «Ausente» con `bg-destructive-soft`) | **CUBIERTO** | Diferencia menor: ahí «Asistió (sin control de asistencia)» sale en **verde**, en la ficha en **gris** |
| 3c | Porcentaje de asistencia por materia (presentes / clases dictadas en que estaba inscripto) | `asistenciaDeAlumno` (`historial.publico.ts:80-94`): presentes ÷ (presentes + ausentes) de clases con control, redondeo entero, excluye anuladas; se muestra en «Asistencia por materia» (`historial-academico.tsx:72-79`, `mi-historial.tsx:43`) | **CUBIERTO** | Es del historial completo, no depende del filtro ni de la página. Con solo clases sin control muestra «Sin clases con control de asistencia». Formato distinto: «64 % de asistencia» (ficha) y «64% de asistencia» (Mi historial) |
| 4 | Las clases registradas antes de esta HU se muestran «Asistió (sin control de asistencia)» y no cuentan para el porcentaje | `estadoAsistencia NULL` + `conControlAsistencia = false` (schema `:972,993`); el porcentaje solo cuenta `con_control`; aviso «{n} clases sin control excluidas del porcentaje» | **CUBIERTO** | El `POST` sin cuerpo (contrato Sprint 2) sigue creando clases sin control; la pantalla nunca lo usa |
| 5 | Ausente no tiene reintegro ni cambio automático en pagos | El servicio no escribe en tablas de C ni de I (solo `marcarVencidas`, que marca reservas ya vencidas); spec §3.12 | **CUBIERTO** | Test PG «guarda snapshot, asistencia y auditoría juntos sin alterar inscripción ni pagos» |
| 6 | Corregir la asistencia registrada se resuelve en HU-E-11 | La HU no corrige: si ya hay clase no anulada, el `POST` devuelve la existente (`200 ya_existia`) sin usar las marcas. E-11 ya está mergeada: «Corregir asistencia» y «Anular registro» aparecen en la misma lista | **CUBIERTO** | |

**Resumen:** todos los criterios están implementados. Un **DESVÍO** de la task respecto de la HU (1b: se registra al **terminar** la clase, no al empezar) que el PO no aprobó explícitamente, y observaciones de texto y de interfaz (secciones 2, 4 y 5).

---

## 2. Textos literales (HU-C-23)

| Texto del criterio | Clave en `src/lib/textos.ts` | Valor en el código | ¿Coincide? |
|---|---|---|---|
| Presente | `ui.historial.asistencia.presente` (l. 663) | «Presente» | Sí |
| Ausente | `ui.historial.asistencia.ausente` (l. 664) | «Ausente» | Sí |
| «Registrar clase dictada» | `ui.historial.asistencia.registrar` (l. 670) | «Registrar clase dictada» | Sí |
| «Marcar todos ausentes / presentes» | `ui.historial.asistencia.marcarAusentes` / `marcarPresentes` (l. 667-668) | «Marcar todos ausentes» / «Marcar todos presentes» (un botón que alterna) | Sí (la barra de la HU se lee como alternativa) |
| «Presente» / «Ausente» ya registrados | mismas claves | idem | Sí |
| «sin control de asistencia» | `ui.clases.interfaz.sinControlDeAsistencia` (l. 380) / `claseSinControlDeAsistencia` (l. 383) | «Sin control de asistencia» / «Clase sin control de asistencia» | Sí (mayúscula inicial) |
| «Asistió» | `ui.historial.asistencia.asistio` (l. 665), `ui.historial.propio.presente` (l. 628) | «Asistió» | Sí |
| «Ausente» (historial) | `ui.historial.asistencia.ausente`, `ui.historial.propio.ausente` (l. 629) | «Ausente» | Sí |
| «Asistió (sin control de asistencia)» | `ui.historial.asistencia.sinControl` (l. 666), `ui.historial.propio.sinControl` (l. 630) | «Asistió (sin control de asistencia)» | Sí |

**No hay diferencias palabra por palabra con los textos entre comillas de la HU.**

Otros textos visibles de la HU (no citados en los criterios) con defectos:
- `ui.historial.asistencia.totales` = «{presentes} presentes · {ausentes} ausentes» → con un ausente se ve **«2 presentes · 1 ausentes»** (el caso del seed del 06/01). Falta singular/plural.
- Confirmación: `ui.historial.asistencia.confirmar` = «¿Registrar la clase de {materia} del {fecha}?» y `…confirmacion` = «Horario: {horaInicio}–{horaFin}. Presentes: {presentes}. Ausentes: {ausentes}.». **No sigue el texto que fija HU-C-25** (criterio 3: «¿Estás seguro de que querés registrar la clase dictada de Matemática II del martes 6/10 a las 16:00, con 5 presentes y 2 ausentes?»). Ver sección 4.
- Mensajes del servidor que la pantalla puede mostrar dentro de la confirmación y **no salen del archivo central**: «La clase todavía no terminó» y «No tenés permisos para registrar o consultar esta clase» (`clase-dictada.service.ts:22,25`; la primera existe como `errores.claseDictada.noFinalizada` pero no se usa), «El cuerpo debe ser JSON válido» y «La asistencia no es válida» (`route.ts:27,29`, solo por API).

---

## 3. Reglas de servidor

| Regla | Verificación | Estado |
|---|---|---|
| Validación Zod (Regla 6) | El handler lee el cuerpo como texto: vacío → contrato Sprint 2 (sin control); JSON inválido → `400 VALIDACION`; `RegistrarClaseDictadaSchema` `.strict()` (array ≤ 500 de `{ alumno_id, estado: PRESENTE\|AUSENTE }` estrictos) → `400 VALIDACION` con `detalles` (`flatten`). En el servicio, conjunto exacto contra los vigentes → `400 ASISTENCIA_INCOMPLETA` con `{ faltan, sobran, repetidos }` | Cumple. El `[id]` de la ruta no se valida con Zod (un id inexistente da 404) |
| Permisos (Regla 10) | `POST`: `withPermission("clases:registrar")` (Mesa y Profesor; Gerente y Alumno → 403). Además el servicio rechaza otro rol y al Profesor que no es el de la clase → `403 SIN_PERMISO`. `GET`: `withPermission("historial:leer")` (Mesa, Gerente, Profesor); Profesor ajeno → 403 | Cumple |
| Transacción y bloqueo (Regla 7) | `transaccion()` (lock_timeout → `409 TRANSACCION_OCUPADA`) → `bloquear(tx, { clases: [turnoId] })` (FOR UPDATE canónico) → relectura → validaciones → `INSERT … ON CONFLICT … DO NOTHING` (condición y alta en una sola sentencia; 0 filas = otro ganó y se devuelve el existente con `ya_existia`) | Cumple con el patrón del proyecto (bloqueo pesimista de PR-0, documentado en RULES «Sprint 3 — Registro de asistencia») |
| Registros nuevos, no modificación (Regla 8) | Solo `INSERT` de `clases_dictadas` y `createMany` de `clases_dictadas_alumnos`. Un segundo `POST` no edita: devuelve el existente. No hay `update`/`delete` sobre asistencia en todo `src/` (el único `updateMany` es la marca de anulación de E-11, excepción documentada en PR-0 §2.8) | Cumple |
| Trazabilidad (Regla 2) | Opción (a): `createdAtClaseDictada` y `creadoPorUsuarioId` en la misma fila; los eventos de vencimiento que encola C se escriben después del commit y se descartan si hay rollback (test PG) | Cumple |
| Contrato `{data, error}` (Regla 5) | 201 nuevo / 200 existente; 400 / 403 / 404 / 409 con `{ code, message, detalles? }` | Cumple |

### Endpoints relevantes

| Método y ruta | Permiso | Uso |
|---|---|---|
| `POST /api/turnos/[id]/clase-dictada` | `clases:registrar` (Mesa, Profesor de la clase) | Registrar la clase dictada con asistencia |
| `GET /api/turnos/[id]/clase-dictada` | `historial:leer` (Mesa, Gerente, Profesor de la clase) | Asistencia guardada, totales, acciones |
| `GET /api/turnos/[id]` | detalle de C | Lista de inscriptos vigentes y `acciones_habilitadas.registrar_clase` |
| `GET /api/alumnos/[id]/historial` · `GET /api/mi-historial` | `historial:leer` · `historial:leer_propio` | «Asistió»/«Ausente» y porcentaje por materia |

### Snippets para la consola del navegador

Iniciar sesión con el rol a probar, abrir cualquier pantalla de la app (mismo origen) y pegar en la consola (F12). El id de la clase se copia de la URL `/turnos/<id>` con la sesión de Mesa. Ids en la base local actual (cambian si se vuelve a correr el seed sobre una base vacía): clase pendiente del 05/01 `cmv4mcsam009uux8c92cm2cix`, clase con control del 06/01 `cmv4mcsl600acux8csc1xov9m`.

Por seguridad los `POST` mandan `asistencias: []`: si por error el servidor dejara pasar el pedido, en una clase con inscriptos respondería `400 ASISTENCIA_INCOMPLETA` y no guardaría nada.

**a) POST con Gerente o Alumno (debe dar 403):**
```js
const turnoId = "cmv4mcsam009uux8c92cm2cix"; // clase pendiente del 05/01
const r = await fetch(`/api/turnos/${turnoId}/clase-dictada`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ asistencias: [] }),
});
console.log(r.status, await r.json()); // esperado: 403 { data: null, error: { code: "SIN_PERMISO", ... } }
```

**b) POST con un Profesor que no es el de la clase (profesor2 sobre una clase de profesor1, debe dar 403):**
```js
const turnoId = "cmv4mcsam009uux8c92cm2cix";
const r = await fetch(`/api/turnos/${turnoId}/clase-dictada`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ asistencias: [] }),
});
console.log(r.status, await r.json()); // esperado: 403 SIN_PERMISO «No tenés permisos para registrar o consultar esta clase»
```

**c) GET de la asistencia con Alumno (403) y con profesor2 sobre la clase de profesor1 (403):**
```js
const r = await fetch("/api/turnos/cmv4mcsl600acux8csc1xov9m/clase-dictada");
console.log(r.status, await r.json()); // esperado: 403 SIN_PERMISO
```

**d) Mesa de entrada — rechazos del servidor (control, no 403; ninguno guarda):**
```js
const turnoId = "cmv4mcsam009uux8c92cm2cix";
const post = (cuerpo) => fetch(`/api/turnos/${turnoId}/clase-dictada`, { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo })
  .then(async (r) => { const j = await r.json(); console.log(r.status, j.error?.code, j.error?.detalles ?? ""); });
await post("{no es json");                                                   // 400 VALIDACION
await post(JSON.stringify({ asistencias: [{ alumno_id: "x", estado: "TARDE" }] })); // 400 VALIDACION (estado inválido)
await post(JSON.stringify({ asistencias: [], extra: 1 }));                   // 400 VALIDACION (campo desconocido)
await post(JSON.stringify({ asistencias: [] }));                             // 400 ASISTENCIA_INCOMPLETA { faltan: [3 ids], sobran: [], repetidos: [] }
```
Para `409 CLASE_NO_FINALIZADA`, repetir la última línea con el id de una clase futura con inscriptos (por ejemplo `seed-turno-10`); responde 409 antes de mirar las marcas. **No** mandar un cuerpo completo y válido si no se quiere registrar la clase.

---

## 4. Definición de Terminado

| Ítem | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Cumple con observaciones** | Todo lo nuevo de la pantalla sale de `textos.ts` y el comprobador C-23 pasa. Fuera del catálogo: los mensajes del servidor de la sección 2 («La clase todavía no terminó», «No tenés permisos…», «El cuerpo debe ser JSON válido», «La asistencia no es válida») y literales de Sprint 2 que siguen en `historial-academico.tsx` («Clase dictada», «Examen», «Cargando historial académico…», «Reintentar», «Materia: Todas», «registro/registros», mensajes de vacío), archivo que esta HU modificó |
| Ningún texto visible con «turno» | **Cumple** | Ninguna clave usada por la lista, la confirmación, el historial ni los errores de la HU dice «turno» |
| Confirmación con el componente común de HU-C-25 en toda operación que guarda | **No cumple el patrón de C-25** | Usa `ConfirmarAccionDialog` (el componente común) con materia, fecha, horario y cantidades, y muestra los rechazos del servidor dentro del mismo diálogo. Pero: (1) el título es «¿Registrar la clase de Matemática del 05/01/2026?» en lugar del patrón obligatorio «¿Estás seguro de que querés registrar la clase dictada de … del <día> a las <hora>, con N presentes y M ausentes?» (C-25 criterios 1 y 3, que dan este ejemplo literal); (2) se marcó `irreversible`: botón rojo y «Esta acción no se puede deshacer.», cuando C-25 criterio 4 lo reserva para anular, cancelar, quitar y cerrar caja, y el registro **sí** se puede anular con HU-E-11 |
| Tests en verde | **Cumple** | 330 unitarios + 16 PG de la HU; suite completa 3170 en verde |

---

## 5. Extras y violaciones

### Implementado sin que la HU lo pida
1. **Marcas antes del fin de la clase que no se guardan:** si se marca durante la clase y se recarga antes de que termine, se pierden (P-E1). Consecuencia directa del desvío 1b.
2. **El botón no se habilita solo al terminar la clase:** la lista se actualiza cada 30 s, pero `acciones_habilitadas` viene del servidor al cargar la página; hay que recargar al terminar la clase para que «Registrar clase dictada» se habilite (y eso borra las marcas hechas durante la clase).
3. **Encabezado «Alumno · Asistencia»** sobre la lista de inscriptos en cualquier clase, también en clases futuras donde no hay columna de asistencia.
4. **Leyendas de estado** junto al registro: «La clase ya pasó y todavía no se registró.», «Podés registrarla cuando la clase haya terminado.», «Solo se puede registrar una clase disponible o completa.» y «Clase dictada registrada el dd/mm/aaaa.».
5. **Contrato de API sin cuerpo** (Sprint 2) que sigue creando clases «sin control» y límite de 500 marcas por pedido. Correcto por compatibilidad; la pantalla nunca lo usa.
6. Cambio en `src/server/turnos/turno.validaciones.ts` (reloj inyectable) para poder sembrar clases históricas: técnico, sin efecto visible.

### Violaciones a RULES.md / DESIGN.md
- **DESIGN §3 (menor):** «Registrar clase dictada» es un botón `outline` (y rojo en la confirmación por `irreversible`); la acción principal de la vista debería ser `primary`.
- **DESIGN §6.4 (menor):** la tabla todavía dice «Registrar clase dictada (HU-E-01) — `AlertDialog` (confirmación simple) — Toast»; la HU cambió la presentación (marcas en la lista, confirmación con cantidades) y no actualizó la fila.
- **DESIGN §9 / HU-C-23 (menor):** mensajes del servidor y literales de Sprint 2 fuera del catálogo (sección 4).
- **Regla 3 (menor, no es de esta HU):** `obtenerRegistroClaseDictada` lee `rolPermiso` (tabla del módulo A) directamente para calcular `acciones`; lo agregaron E-07/E-11 en la misma función que usa esta HU.
- **Regla 6 (menor):** el `[id]` de la ruta no pasa por Zod (mismo criterio que el resto de las rutas de clases).
- Paleta: solo tokens (`bg-attendance-selected`, `bg-destructive`, `bg-success`, `bg-destructive-soft`, `text-muted-foreground`). **Sin colores a mano.**

---

## 6. Datos para la prueba manual

**Credenciales** (contraseña de todas: `Password123!`):

| Rol | Cuenta |
|---|---|
| Mesa de entrada | `mesa.entrada@noctium.local` (Marta Ruiz) · `mesa.entrada2@noctium.local` |
| Profesor | `profesor1@noctium.local` (Laura Giménez, dueña de las clases de la HU) · `profesor2@noctium.local` (ajeno) |
| Gerente | `gerente@noctium.local` |
| Alumno | `alumno01@noctium.local` (Fernández, Sofía) · `alumno02@` (Martínez, Lucas) · `alumno03@` (López, Valentina) |

**Clases del seed de la HU** (fixture `prisma/seed/fixtures/hu-e-09.ts`: Matemática, profesor1, 11:00–12:00, alumnos Fernández, Martínez y López):

| Fecha | Estado en la base local | Id local |
|---|---|---|
| Lun 05/01/2026 | **Sin registrar**, 3 inscriptos vigentes | `cmv4mcsam009uux8c92cm2cix` |
| Mar 06/01/2026 | Con control: Fernández y López Presente, Martínez Ausente (además tiene observaciones e indicación de E-07/E-04) | `cmv4mcsl600acux8csc1xov9m` |
| Mié 07/01/2026 | Sin control (registro antiguo) | `cmv4mcsv700auux8cuxqeq6o6` |

Porcentajes actuales (Matemática, sumando los fixtures de E-08, E-11, H-07 y E-02): Fernández **64 %** (7 de 11, 3 sin control), Martínez **63 %** (5 de 8), López **50 %** (4 de 8); Física 100 % para los tres.

| Criterio | Cómo probarlo |
|---|---|
| 1 (lista y marcas) | profesor1 o mesa.entrada → `/turnos/cmv4mcsam009uux8c92cm2cix`: los 3 alumnos con Presente (verde, marcado) y Ausente a la derecha. Tocar Ausente en Fernández (rojo, con texto). «Marcar todos ausentes» → los 3 en rojo y el botón pasa a «Marcar todos presentes». Con teclado: Tab llega a cada opción y Enter/Espacio la cambia |
| 1 (registro) | Dejar, por ejemplo, Fernández Ausente y los otros Presente → «Registrar clase dictada» → confirmación (anotar el texto: ver sección 4) → confirmar → toast «Clase dictada registrada correctamente»; la misma lista muestra «Ausente» en rojo / «Presente» en verde y «2 presentes · 1 ausentes» |
| 1 (vigentes) | Sin registrar nada: mesa.entrada → `/turnos/cmv4mdec601raux8cbzjpwhnn` (Matemática 22/09/2025, fixture H-10). En la base tiene a López y Martínez cancelados por el alumno, Pérez quitado por el centro, Rodríguez dado de baja, Fernández y Sánchez con reserva vencida y Ríos con una reserva vencida sin marcar: **la lista solo muestra a Martínez, Lucas** (su inscripción vigente). Otra igual: `/turnos/cmv4mdd1s01osux8c21eo8ybg` (24/11/2025). Mirar alcanza; si se registra, el vencimiento de Ríos queda marcado y cambia el dato de H-10 |
| 1 (clase en curso) | **Hoy 12/10 de 08:00 a 10:00**: profesor1 → `/turnos/seed-turno-01` (Matemática). Durante la clase se ven las marcas y el botón deshabilitado con «Podés registrarla cuando la clase haya terminado.» (desvío 1b). Las 9 reservas vencen a las 08:00, así que **solo debería quedar Fernández, Sofía** (pagada). Después de las 10:00 recargar y registrar. Depende del seed local sin commitear (paso 13) y de la fecha en que se corrió el seed (`seed-turno-01` es el primer día operativo desde el seed) |
| 1 (sin control) | `/turnos/cmv4mcsv700auux8cuxqeq6o6` (07/01): cada alumno «Sin control de asistencia» y «Clase sin control de asistencia» en lugar del total |
| 2 | Después del registro del 05/01, en Prisma Studio (`npx prisma studio`): `clases_dictadas` con `turnoId = cmv4mcsam009uux8c92cm2cix`, `conControlAsistencia = true`, `creadoPorUsuarioId` y fecha; `clases_dictadas_alumnos` con 3 filas y sus estados. Hacer el snippet 3 d) antes y ver que no se crea nada |
| 3 | mesa.entrada → Alumnos → Fernández, Sofía → pestaña Historial académico: el 05/01 «Ausente» en rojo, el 06/01 «Asistió» en verde, el 07/01 «Asistió (sin control de asistencia)» en gris; «Asistencia por materia» Matemática pasa de 64 % a **58 %** (7 de 12). Martínez pasa a **67 %** (6 de 9), López a **56 %** (5 de 9). Con alumno01 → Mi historial: mismas etiquetas y porcentajes. Con profesor1, desde el detalle de la clase → «Ver historial» del alumno: solo Matemática |
| 4 | En el mismo historial: el 07/01 dice «Asistió (sin control de asistencia)» y debajo del porcentaje «N clases sin control excluidas del porcentaje»; el porcentaje no cambia por esa clase |
| 5 | Antes y después de registrar con Ausente, en Prisma Studio: `turno_alumno` de Fernández en esa clase (estado de pago, precio, vigencia) y `pagos` del alumno sin cambios. En la pantalla «Registrar pago» de mesa.entrada, el alumno no recibe reintegro ni crédito |
| 6 | En la clase ya registrada aparecen «Corregir asistencia» y «Anular registro de clase dictada» (HU-E-11). Un segundo `POST` con otras marcas (snippet d con un cuerpo completo) devuelve `200 ya_existia: true` y no cambia nada |
| Roles | Gerente abre la clase: ve la lista y, si está registrada, las etiquetas, sin opciones ni botón. Snippets de la sección 3 para el 403 |

### Repetir la prueba del registro (la clase del 05/01 se registra una sola vez)
- **Sin código:** mesa.entrada → clase del 05/01 ya registrada → «Anular registro de clase dictada» (HU-E-11, pide motivo). La clase vuelve a «sin registrar» y se puede registrar de nuevo; el registro anulado se conserva (Regla 8).
- **Con un script de una sola vez** que crea otra clase igual, sin registrar, con los mismos servicios del seed. Guardarlo **fuera del control de versiones** (por ejemplo `scripts/tmp-clase-e09.ts`, y borrarlo después) y correrlo contra la base local:

```ts
// npx tsx scripts/tmp-clase-e09.ts   (borrarlo después; no commitear)
// Crea, por los servicios de dominio, una clase de Matemática de profesor1 del
// 08/01/2026 11:00–12:00 con 4 alumnos inscriptos y SIN registrar como dictada.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { sembrarClaseAsistencia } from "../prisma/seed/fixtures/hu-e-09";

const FECHA = "2026-01-08"; // si falla por disponibilidad, probar "2026-01-13"
const prisma = new PrismaClient();

async function main() {
  const [usuario, profesor, materia, aula, alumnos] = await Promise.all([
    prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "mesa.entrada@noctium.local" } }),
    prisma.profesor.findFirstOrThrow({ where: { emailProfesor: "profesor1@noctium.local" } }),
    prisma.materia.findFirstOrThrow({ where: { nombreMateria: "Matemática" } }),
    prisma.aula.findFirstOrThrow({ where: { activaAula: true, capacidadAula: { gte: 4 } }, orderBy: { capacidadAula: "desc" } }),
    prisma.alumno.findMany({ where: { activoAlumno: true }, orderBy: { dniAlumno: "asc" }, take: 4 }),
  ]);
  const { turnoId, inscripciones } = await sembrarClaseAsistencia({ prisma }, {
    fecha: FECHA, hora: "11:00", materiaId: materia.idMateria, profesorId: profesor.idProfesor, aulaId: aula.idAula,
    usuarioId: usuario.idUsuario, alumnoIds: alumnos.map((a) => a.idAlumno), registrar: false,
  });
  console.log(`Clase lista: /turnos/${turnoId} (${inscripciones.length} inscriptos)`);
}
main().catch((e) => { console.error(e.code ?? "", e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

Correrlo dos veces no duplica la clase (busca por fecha, hora, profesor y materia). Con 4 alumnos (se suma González, Mateo) se prueba mejor «Marcar todos».

### Qué depende del seed local sin commitear
Solo el caso «clase en curso» con `seed-turno-01` (sus 9 reservas las crea el paso 13). Las clases del 05/01, 06/01 y 07/01 y las de H-10 vienen de fixtures commiteados.

---

## 7. Veredicto preliminar

**Volver al dev** (cambios chicos; el comportamiento de fondo funciona y se puede ir probando en paralelo con los datos de la sección 6).

**Bloqueantes:**
1. **Confirmación fuera del patrón de HU-C-25 (Definición de Terminado):** debe decir «¿Estás seguro de que querés registrar la clase dictada de <materia> del <día> a las <hora>, con N presentes y M ausentes?» (C-25 criterios 1 y 3) y no tiene que marcarse como irreversible (botón rojo y «Esta acción no se puede deshacer.»), porque el registro se anula con HU-E-11 (C-25 criterio 4).
2. **Desvío del momento de registro (criterio 1):** la HU dice «una clase que ya empezó»; el sistema registra recién cuando la clase **termina** (decisión del Scrum Master P-E1, informada pero no aprobada por el PO). **Deja de ser bloqueante si el PO la acepta**; si no, hay que habilitar el registro desde el inicio de la clase (servidor y botón).

**Para corregir junto (no bloquean):**
3. «1 ausentes»: singular/plural en el total de la lista.
4. Mensajes del servidor fuera del catálogo («La clase todavía no terminó» —ya existe la clave—, «No tenés permisos para registrar o consultar esta clase», «El cuerpo debe ser JSON válido», «La asistencia no es válida») y literales de Sprint 2 en `historial-academico.tsx`.
5. Al terminar la clase hay que recargar la página para habilitar el botón, y eso borra las marcas tomadas durante la clase.
6. «Marcar todos presentes» solo aparece cuando todos están ausentes.
7. Detalles de presentación: botón principal `outline`, encabezado «Alumno · Asistencia» en clases futuras, «Asistió (sin control…)» gris en la ficha y verde en Mi historial, «64 %» contra «64%».
8. DESIGN §6.4 sin actualizar para la nueva presentación del registro; lectura directa de `rolPermiso` (Regla 3) en la misma función, agregada por E-07/E-11.
9. `prisma/seed.ts` tiene cambios locales sin commitear, ajenos a esta HU.
