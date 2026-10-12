# HU-C-21 — Evidencia de implementación local

12/10/2026. Aula por fecha, exclusión de fechas y «Resolver todas» en la vista
previa de «Generar varias clases» (HU-C-17), implementados en las seis fases de
la task sobre la rama `feature/HU-C-21`. Task:
`docs/tasks/Sprint 3/Modulo C/HU-C-21.md`. Contrato: `spec_modulo_C.md` §2.9.1.
Sin commit ni PR: el stage, el commit y el push los hace el autor. **No acredita
la revisión del PR ni la aceptación del PO.**

## Matriz de los ocho criterios

| CA | Cómo se verificó | Resultado |
|---|---|---|
| 1. Cada fecha con «Aula ocupada» muestra «Cambiar aula» | `turno-recurrente.test.tsx` («muestra cada fila según su situación»): «Cambiar aula» solo con `AULA_OCUPADA` y sin `solo_excluible` ni `sin_aulas_libres`. Capturas 01 y 09 | Aprobado |
| 2. Solo aulas activas libres, con capacidad; la fila pasa a «Libre · X (cambiada)» y el resto no cambia | `aulas-libres/route.test.ts` (orden, vacía, 400, 403); `turno.generacion.aulas.test.ts`; equivalencia PG contra `aulaConTurnoSuperpuesto` (`turno.generacion.pg.test.ts`, Fase 2); frontend («elegir un aula…», «Deshacer», caso borde del aula por defecto). Postman 01, 03, 04 y 06. Capturas 02, 03, 10 y 11 (el selector del recorrido no ofrece Aula 2, ocupada) | Aprobado |
| 3. «Resolver todas»: menor capacidad ≥ la original, empate por nombre; las no resueltas quedan para elegir a mano | `turno.generacion.calculo.test.ts` (`elegirAulaParaResolver`), `turno.generacion.service.test.ts` («Resolver todas» en la vista previa), PG Fase 5 (resuelve una, deja otra y confirma con las aulas derivadas), frontend «Resolver todas» (7 casos). Postman 07. Capturas 06 a 08 | Aprobado |
| 4. Sin aulas libres: «Sin aulas libres en este horario» y «Excluir»; se puede excluir cualquier fecha | Servicio (`sin_aulas_libres` en true y false, excluida sin consultas, todas excluidas → `SIN_FECHAS_EN_RANGO`); frontend (badge, solo «Excluir», excluir libres y en conflicto, última fecha deshabilitada). PG Fase 3 (la excluida no crea filas). Postman 06 y 12. SQL consulta 2. Capturas 03 y 11 | Aprobado |
| 5. «Profesor con otra clase» (profesor ocupado o clase duplicada) solo se excluye; reemplaza el aviso viejo | Servicio (`solo_excluible` para cada combinación de motivos, sin calcular aulas libres); frontend (solo «Excluir», badge sin repetir, aviso nuevo y ausencia de «Elegí otra aula para todo el rango»). La validación de HU-C-17 no cambia: sus tests siguen en verde | Aprobado |
| 6. Con otra capacidad, el cupo es el del aula nueva y la fila lo indica | Servicio (`cupo` y `cupo_aula_por_defecto`); confirmación con aula y cupo por clase (unitario y PG Fase 3); frontend («cupo X en lugar de Y» solo si difiere). SQL consulta 1 (`cupo_es_capacidad_del_aula` en todas). Capturas 03, 07 y 11 | Aprobado |
| 7. Todo o nada sobre las incluidas; se revalida cada aula elegida y el profesor al confirmar | Confirmación unitaria (conflicto no crea ni emite); PG Fase 3 punto 5 (aula elegida ocupada → 409 sin filas) y punto 6 (carrera real `23P01` sobre el aula elegida → 409); frontend (409 → vista previa nueva con las mismas elecciones). Postman 11 | Aprobado |
| 8. Resumen final: clases generadas, con aula cambiada y fechas excluidas | `ResultadoGeneracion` con `aulas_cambiadas` y `fechas_excluidas` (unitario, PG, Postman 12); banner con los tres números (frontend, con y sin cambios). Recorrido: «Se generaron 3 clases correctamente. En 1 se cambió el aula. Se excluyó 1 fecha.» Capturas 13 y 14 | Aprobado |

## Decisiones D1 a D13 y dónde se ven

| # | Dónde se ve |
|---|---|
| D1 | Servicio: `solo_excluible` y «Resolver todas» saltea esas fechas. Frontend: solo «Excluir esta fecha» con «Aula ocupada» + «Profesor con otra clase» |
| D2 | Badge «Aula ocupada» sin nombre de materia (capturas 01, 06 y 09) |
| D3 | Banner `role="status"` arriba de la tabla, sin toast (capturas 07 y 13; frontend «Resolver todas») |
| D4 | «Deshacer» quita la fecha de `aulas_por_fecha` (frontend; capturas 03, 07 y 11) |
| D5 | «Excluir esta fecha» en toda fila incluida, también las libres (capturas 01 y 09) |
| D6 | Última fecha: acción deshabilitada con su motivo visible y `aria-describedby` (frontend); servidor `SIN_FECHAS_EN_RANGO` (servicio) |
| D7 | «cupo X en lugar de Y» solo si difiere (frontend; capturas 03 y 11) |
| D8 | Toda acción vuelve a pedir la vista previa; si falla, las listas no cambian (frontend «si una acción falla…») |
| D9 | Cambiar cualquier dato del formulario vacía las listas y la vista previa (frontend D9) |
| D10 | `400 VALIDATION_ERROR` en el servicio (unitario, Postman 10); la UI nunca lo envía: elegir el aula por defecto equivale a «Deshacer» (frontend, caso borde) |
| D11 | 409 → vista previa nueva interactiva con las mismas elecciones y el aviso existente (frontend, dos casos) |
| D12 | `ConfirmarAccionDialog` con materia, profesor, cantidad, aulas cambiadas y excluidas; éxito en banner (capturas 04, 12 y 13) |
| D13 | Corrección de la cita en `spec_modulo_C.md` §2.9.1, diff separado, ya aplicado en la rama antes de esta implementación |

## Verificación final (12/10/2026)

| Comando / comprobación | Exit code | Resultado real |
|---|---:|---|
| `npm test` (suite completa) | 1 | 297 archivos: 246 aprobados, 1 fallido, 50 omitidos. Pruebas: **3.172 aprobadas, 3 fallidas, 383 omitidas** (572 s). Las 3 fallidas son de `claves-textos.test.ts` y las tres por el límite de 60 s con toda la suite en paralelo; corrido solo: 36/36 (ver «Mediciones de claves-textos») |
| Tests de la HU (unitarios, API, frontend) | 0 | 9 archivos, **197 aprobados**, 22 omitidos (los PG, que corren aparte). De HU-C-21: 95 |
| `npm run test:pg` (todas las pasadas) | 1 | Pasada principal: 47 archivos (40 aprobados, 3 fallidos, 4 omitidos); 288 aprobadas, 5 fallidas, 45 omitidas. Pasada `noctium_test`: 3 archivos, 18/18. **Pasada C-17/C-21: 22/22** (16 de HU-C-17 + 6 de HU-C-21). Pasadas con seed: `seed-asistencia` y `materia.tarifa` fallidas por tiempo; `cancelaciones` fallida (ver abajo) |
| `npm run test:pg` de los 6 archivos fallidos, sin carga | 1 | `cambio-password`, `recuperacion` y `personal`: 3 archivos, 36/36. `seed-asistencia`: 1/1. `materia.tarifa`: 5/5. `cancelaciones.service.pg.test.ts`: sigue fallando |
| `npx tsc --noEmit` | 0 | Sin errores |
| `npm run lint` | 0 | 0 errores, 1 warning preexistente (`CALENDARIO` sin uso en `Sidebar.tsx`, fuera de esta HU) |
| `npm run build` | 0 | Next 16.3.8: compilación correcta, 51 páginas; ruta `ƒ /api/turnos/generacion/aulas-libres` incluida |
| `npx tsx scripts/verificar-claves-textos.ts` | 0 | «Claves de textos verificadas.» (48 s) |
| Colección Postman ejecutada (runner Node + sesión real) | 0 | 11/11 casos ejecutados aprobados; caso 02 no ejecutado (ver «Postman») |
| `HU-C-21.sql` sobre el lote del recorrido | 0 | Todas las columnas de control en `true`; fecha excluida sin filas |

**Fallos de PostgreSQL ajenos a esta HU.** Los de la pasada principal y los de
`seed-asistencia` y `materia.tarifa` cortaron por tiempo (5 s, 10 s y 120 s)
mientras corrían en paralelo `next dev`, Chrome headless y el build del
recorrido; sin carga pasaron todos. `cancelaciones.service.pg.test.ts` falla
en su `beforeAll` al correr `prisma/seed.ts`: «Fixture E02 sin inscripción
inicial» (`prisma/seed/fixtures/hu-e-02.ts:52`). Ese test corre el seed sin
`SEED_FECHA_HOY`, así que depende de la fecha real. El fixture usa
`asignarAulaTurno`, `asignarParticipantesTurno` e inscripciones; el diff de
HU-C-21 no toca seed, fixtures, inscripciones ni esos servicios. No se
atribuye a esta HU, pero **no se comprobó contra `develop`**.

## Recorrido manual en `noctium_dev` (confirmando)

Chrome headless con perfil temporal contra `next dev` en el puerto 3001 (la
extensión de Chrome no estaba conectada), sesión de `mesa.entrada` del seed.
Fechas de febrero de 2027, sin clases previas en la base.

1. **Clase que ocupa el aula** (generada con el mismo flujo): Laura Giménez,
   Matemática, jueves 11/02/2027 10:00–11:00, Aula 2. Resumen: «Se generó 1
   clase correctamente. En ninguna se cambió el aula. No se excluyó ninguna
   fecha.»
2. **Corrida de la HU**: Martín Rossi, Programación I, franja jueves
   10:00–14:00, 1 h a las 10:00, Aula 2 por defecto, del 04/02 al 25/02/2027
   (4 fechas). El 11/02 apareció con «Aula ocupada» (captura 09).
   «Cambiar aula» ofreció las seis aulas libres sin Aula 2, por capacidad
   (captura 10); se eligió Laboratorio (15): «Libre · Laboratorio (cambiada)»
   y «cupo 15 en lugar de 20». Se excluyó el 18/02 (captura 11). Diálogo:
   «¿Estás seguro de que querés generar 3 clases de Programación I con Martín
   Rossi?» y «1 con el aula cambiada · 1 fecha excluida» (captura 12). Banner:
   «Se generaron 3 clases correctamente. En 1 se cambió el aula. Se excluyó 1
   fecha.» (captura 13).
3. **Listado** `/turnos?profesor_id=…`: las tres clases con su aula y su cupo
   (`0/20 Aula 2`, `0/15 Laboratorio`, `0/20 Aula 2`) y ninguna el 18/02
   (captura 14).
4. **SQL** (`HU-C-21.sql`, `GENERACION_ID = cmv5hggrr0007uwwsfs2xyalz`,
   `FECHA_EXCLUIDA = 2027-02-18`): 3 clases `DISPONIBLE`, 0 alumnos, cupo =
   capacidad del aula en las tres; 0 clases y 0 reservas el 18/02; reservas de
   AULA y PROFESOR coincidentes en las tres; 9 eventos con `coincide_aula`,
   `coincide_cupo` y `coincide_generacion` en `true`; resumen Aula 2 × 2,
   Laboratorio × 1.

### Datos que quedaron creados en `noctium_dev`

| Origen | `idTurno` | Fecha y hora | Materia · Profesor | Aula · cupo |
|---|---|---|---|---|
| Recorrido, clase que ocupa el aula | `cmv5hbhzk0002uwws29l44i3d` | 11/02/2027 10:00–11:00 | Matemática · Laura Giménez | Aula 2 · 20 |
| Recorrido, lote `cmv5hggrr0007uwwsfs2xyalz` | `cmv5hggrr0007uwwsfs2xyalz` | 04/02/2027 10:00–11:00 | Programación I · Martín Rossi | Aula 2 · 20 |
| Recorrido, mismo lote | `cmv5hggsk0009uwws66vwnxua` | 11/02/2027 10:00–11:00 | Programación I · Martín Rossi | Laboratorio · 15 |
| Recorrido, mismo lote | `cmv5hggsv000buwwsaqt3ysko` | 25/02/2027 10:00–11:00 | Programación I · Martín Rossi | Aula 2 · 20 |
| Postman caso 12, lote `cmv5hltrd000nuwwsawirp2e2` | `cmv5hltrd000nuwwsawirp2e2` | 11/02/2027 10:00–11:00 | Física · Valeria Zárate | Aula 10 · 30 |

Todas `DISPONIBLE`, sin alumnos, con 2 reservas y 3 eventos cada una, creadas
por `mesa.entrada`. El 18/02/2027 no tiene clases de Rossi (excluida en el
recorrido) ni de Zárate (excluida en Postman 12).

## Postman (`HU-C-21.postman_collection.json`)

12 casos del nivel 2 de la §6, sin secretos. Se ejecutaron con un runner Node
(no Newman): cada request con `fetch` dentro de Chrome headless con sesión real
y los `pm.test` de la colección evaluados con chai. Variables: Valeria Zárate,
Física, jueves 10:00, Aula 2 por defecto, rango 11/02–18/02/2027,
`fecha_conflicto` 11/02 (Aula 2 ocupada por la clase de Giménez),
`aula_cambiada_id` Aula 10, `aula_ocupada_id` Laboratorio (ocupada por Rossi),
`fecha_excluida` 18/02 y `fecha_ajena` 12/02.

| Caso | HTTP | `pm.test` |
|---|---:|---|
| 01 GET aulas libres ordenadas | 200 | 4/4 |
| 02 GET aulas libres vacía | — | No ejecutado: requiere todas las aulas activas ocupadas en ese horario; cubierto por `aulas-libres/route.test.ts` |
| 03 GET query inválida | 400 | 4/4 |
| 04 GET sin permiso (sesión PROFESOR) | 403 | 3/3 |
| 05 Vista previa de Sprint 2 | 200 | 6/6 |
| 06 Vista previa con aula por fecha y exclusión | 200 | 6/6 |
| 07 Vista previa con «Resolver todas» | 200 | 5/5 |
| 08 Confirmación con `resolver_automaticamente` | 400 | 3/3 |
| 09 Confirmación con fecha ajena | 400 | 4/4 |
| 10 Confirmación con aula igual a la por defecto (D10) | 400 | 4/4 |
| 11 Confirmación con aula elegida ocupada | 409 | 4/4 |
| 12 Confirmación con aula por fecha y exclusión | 201 | 4/4 (`aulas_cambiadas` 1, `fechas_excluidas` 1) |

El caso 12 va último a propósito: si corriera antes, el 11 vería
`TURNO_EXISTENTE` en lugar de `AULA_OCUPADA`.

## PostgreSQL automatizado (`turno.generacion.pg.test.ts`)

Base descartable por `npm run test:pg` (pasada `hu_c17_fase3`): **22/22**.
- HU-C-17: los 16 originales, con el único ajuste mecánico aprobado (ver abajo).
- Fase 2: equivalencia de la lectura agrupada de aulas libres contra
  `aulaConTurnoSuperpuesto` sobre todas las aulas activas (superpuesto,
  contiguo antes y después, `PENDIENTE` y `CANCELADO` no ocupan, otra fecha y
  otra aula) y una vista previa real con aula cambiada y fecha excluida.
- Fase 3: puntos 1 a 4 (aula y cupo por clase, excluida sin filas, reservas y
  eventos por clase, mismo `generacion_id`), punto 5 (aula elegida ocupada →
  409 sin filas) y punto 6 (carrera real `23P01` sobre el aula elegida → 409
  por HTTP, sin filas nuevas).
- Fase 5: «Resolver todas» resuelve una fecha y deja otra, y la confirmación
  con las aulas derivadas crea cada clase con su aula y su cupo.

## Compatibilidad con HU-C-17 (§1.2 y 0.5)

Un pedido sin los campos nuevos responde lo mismo que en Sprint 2 más los
campos aditivos (`turno.generacion.service.test.ts`, «un pedido de Sprint 2
suma los campos nuevos»; Postman 05). Únicos ajustes mecánicos aprobados en
los tests de HU-C-17, sin cambiar ningún valor esperado ni borrar tests:
- `turno.generacion.service.test.ts`: dos exports agregados al mock de
  `aula.publico` (`obtenerNombreAula`, `listarAulasActivasParaTurno`) y
  `toEqual` → `toMatchObject` en dos aserciones.
- `turno.generacion.pg.test.ts`: `expect.objectContaining` dentro de dos
  `expect.arrayContaining`.
- `turno-recurrente.test.tsx`: los ajustes de R3 (fixtures con los campos
  nuevos, badges leídos desde su contenedor, aviso nuevo, confirmación por el
  diálogo y 409 interactivo).

## Interpretaciones y observaciones

- **«Por nombre» (criterio 3) como orden natural.** El empate por nombre usa
  `localeCompare("es", { numeric: true })`: «Aula 2» va antes que «Aula 10».
  Después del nombre se desempata por id, para que el orden sea determinista.
  Aceptado por el PO.
- **Mediciones de `claves-textos.test.ts`** (límite de 60 s, no se modificó en
  esta HU):
  - 61,8 s en la corrida conjunta de la fase 2, con `erp-swat` corriendo;
  - 64–72 s corrido solo en la fase 3, con `erp-swat` corriendo (el
    verificador directo tardó 67 s y dio «Claves de textos verificadas.»);
  - 32 s sin carga (fase 4), 36/36.
  - En esta verificación final: 3 fallas por tiempo en `npm test` completo;
    corrido solo, 36/36 (140 s de duración del archivo con la máquina
    cargada) y el verificador directo en 48 s.
- **Barra superior en 390 px** (fuera del alcance de esta HU): en móvil se
  cortan «Mesa de entrada» y el ícono de «Mi cuenta» (capturas 05 y 08). La
  página no tiene desplazamiento horizontal; la tabla conserva el suyo (§5.8).
- **Compilación de `aulas-libres` en `next dev`**: la primera apertura del
  selector esperó a que la ruta compilara (más de 30 s con la máquina
  cargada). Es un costo de desarrollo, no del build (que la incluye).
- **Indicador de `next dev` en las capturas**: el globo «Compiling…» o la «N»
  abajo a la izquierda es la herramienta de desarrollo de Next, no la pantalla.
- **Capturas con datos de `noctium_dev`**: las 01 a 08 usan un escenario del
  seed (Aula 10 ocupada el 15/10/2026) y **no confirman**; las 09 a 14 son del
  recorrido confirmado de febrero de 2027.

## Capturas

| Archivo | Contenido |
|---|---|
| `01-vista-previa-con-conflicto.png` | Banner de conflictos, fila con «Aula ocupada», «Cambiar aula» y «Excluir esta fecha» en todas |
| `02-selector-cambiar-aula.png` | Selector en la fila, aulas libres por capacidad, sin el aula ocupada |
| `03-aula-cambiada-y-fecha-excluida.png` | «Libre · Aula 1 (cambiada)», «cupo 10 en lugar de 30», «Deshacer», fila «Excluida» con «Incluir de nuevo» y «· 1 excluida» en el resumen |
| `04-dialogo-confirmacion.png` | Confirmación de HU-C-25 con el detalle |
| `05-movil-aula-cambiada-y-excluida.png` | 390 px, tabla con desplazamiento propio |
| `06-antes-de-resolver-todas.png` | Botón «Resolver todas» con su ayuda |
| `07-despues-de-resolver-todas.png` | Banner «Se resolvió 1 fecha.», «Libre · Aula 11 (cambiada)», botón oculto, confirmación habilitada |
| `08-movil-despues-de-resolver-todas.png` | 390 px después de resolver |
| `09` a `14` (`recorrido-…`) | Recorrido confirmado: vista previa, selector, aula cambiada y excluida, diálogo, banner de éxito y listado |

## Cómo se recorta «Resolver todas» (plan de recorte, §1.4)

Tres piezas; sacarlas no toca el aula por fecha ni la exclusión.

1. **Flag del pedido** — `src/server/turnos/turno.generacion.schema.ts`: el
   campo `resolver_automaticamente` de `VistaPreviaGeneracionSchema`. Sin él,
   la vista previa rechaza el flag con 400, igual que la confirmación.
2. **Función del servidor** — `src/server/turnos/turno.generacion.service.ts`:
   `resolverTodas()` y la línea de `vistaPreviaGeneracion` que la llama (queda
   `return vistaPrevia;`). En `turno.generacion.calculo.ts`:
   `elegirAulaParaResolver()`. `calcularGeneracion` puede seguir devolviendo
   `aulasLibres` (lo usa `sin_aulas_libres`).
3. **Botón y banner de la UI** — `tabla-vista-previa-generacion.tsx`: la prop
   `onResolverTodas`, el bloque del botón y `candidatasResolverTodas()`.
   `turno-recurrente.tsx`: el estado `resueltas`, `resolverTodas()`,
   `mensajeResolverTodas()`, el banner `[data-resultado-resolver]`, la opción
   `resolver` de `solicitarVistaPrevia` y la prop que se pasa a la tabla.
   Textos: las 8 claves `ui.clases.generacion.resolver.*`.

Tests que se quitan o ajustan con ellas (cada uno en su propio bloque):
- `turno.generacion.calculo.test.ts`: describe «HU-C-21: aula que elige
  «Resolver todas»».
- `turno.generacion.service.test.ts`: describe «HU-C-21: «Resolver todas» en
  la vista previa».
- `turno.generacion.pg.test.ts`: describe «HU-C-21 Fase 5: «Resolver todas»
  (PostgreSQL)».
- `turno-recurrente.test.tsx`: describe «HU-C-21: «Resolver todas»».
- `turno.generacion.schema.test.ts`: el caso «resolver_automaticamente se
  acepta en la vista previa y se rechaza en la confirmación» pasa a esperar
  rechazo en las dos.
- `src/app/api/turnos/generacion/route.test.ts`: el caso
  «resolver_automaticamente: la vista previa lo acepta…» pasa a esperar 400 en
  las dos rutas.
- Colección Postman: el caso 07 se quita.
