# Evidencia HU-B-07

## Resultado

HU-B-07 está implementada y verificada localmente en `feature/hu-restantes`: los ocho criterios del Excel (filas 133 a 140) cumplen con las pruebas de las secciones siguientes. Quedan pendientes ⏳ el recorrido de navegador (M-21) y el CI sobre el SHA del PR. SHA del PR: ⏳ se completa al abrirlo.

## Matriz de criterios

| CA | Cumple | Evidencia |
|---|---|---|
| 1 | Sí (la interfaz, ⏳ en navegador) | `estado-alumno-dialog.test.tsx` (19): pedido del impacto, «1 clase futura» / «N clases futuras», lista fecha dd/mm/aaaa · hora · materia · profesor, motivo opcional sin registros, obligatorio con registros, tope de 300. `alumno.estado.impacto.test.ts` (6): fecha de corte `desde`, las tres condiciones y el orden. PG: impacto igual a lo que quita la baja, motivo obligatorio con registros en C, en I y en E, corte en la hora local del centro. Postman: impacto 200, 400 sin motivo con registros |
| 2 | Sí. «Baja del alumno» en el historial de la inscripción (E-02) y serie «Bajas» (H-10): diferidos | PG: `BAJA_ALUMNO` con fecha y actor, sin borrar; Completa pasa a Disponible; clases en curso, pasadas, Pendientes y Canceladas intactas; la baja no bloquea ni toca clases pasadas o en curso (reserva vencida sin marcar intacta) y marca la de una clase futura; pagos y dictadas intactos; historial de estados después del commit (4 pruebas: fallo antes del commit, visibilidad, reintento, error persistente); rollback ante un fallo posterior; concurrencia con intercalado forzado contra altas de mesa y autoservicio, «Registrar pago», cobro de I-10, continuar una clase Pendiente (C-18), otra baja y la reactivación. Postman: desactivar 200 con `inscripciones_quitadas` igual al impacto; SQL: bloque de aserciones de la baja |
| 3 | Sí | PG: cuenta inactiva, `sesionesValidasDesdeUsuario` fijado y 401 `SESION_INVALIDA` para la sesión abierta (token simulado, ver límites). SQL: aserción de cuenta inactiva y sesiones revocadas |
| 4 | Sí (toast, ⏳ en navegador) | Componente: toast «Alumno desactivado correctamente». PG: la inscripción de mesa, autoservicio, C-18 y «Registrar pago» rechaza al alumno inactivo. `alumno.publico.test.ts` (14) |
| 5 | Sí | PG, grupo «email de contacto de una ficha inactiva» (8): ficha inactiva sin cuenta, con cuenta y con el email guardado en otra capitalización, con otro DNI, responden `CUENTA_YA_EXISTE` con el mismo código y mensaje que la rama (c) y sin altas ni solicitudes; la rama (b); una ficha activa con ese email sigue como en el Sprint 1; baja concurrente y orden inverso. `autorregistro.service.test.ts` (41) y `verificar-codigo/route.test.ts` (9, incluye 409 `TRANSACCION_OCUPADA`). Confirmación del código: gana la baja → `CUENTA_YA_EXISTE`, gana la confirmación → cuenta creada y luego desactivada |
| 6 | Sí. Reintegro (I-06): diferido | PG: pagos idénticos antes y después, sin anulaciones. SQL: pagos intactos |
| 7 | Sí (aviso e interfaz, ⏳ en navegador) | Componente: confirmación «¿Estás seguro de que querés reactivar a Ana Pérez?», toast «Alumno reactivado correctamente» con «Las inscripciones anteriores no se restauran. Inscribilo de nuevo si corresponde.». PG: cuenta activa, sesiones no restauradas, inscripciones no restauradas, vuelve a inscribirse, historial con ambas acciones. `alumno/page.test.tsx`: etiqueta «Inscripción dada de baja por el centro» en «Mis clases». SQL: bloque de aserciones de la reactivación |
| 8 | Sí | `alumno.estado.permisos.pg.test.ts`: con `withPermission` y `rol_permiso` reales, los cuatro roles contra impacto, desactivar y reactivar (200 solo Mesa de Entrada; 403 `SIN_PERMISO` Gerente, Profesor y Alumno, sin huella en ficha, versión ni historial); ficha: 200 Mesa y Gerente, 403 Profesor y Alumno, 401 sin sesión; matriz de `rol_permiso` idéntica antes y después del seed completo (91 filas). Postman: 403 de los tres roles en las tres rutas y en la ficha |

## Verificaciones

Corridas del 12/10/2026 sobre el árbol final de la rama (cambios del delta desde `f7ff819` más el árbol de trabajo).

| # | Comando | Exit | Resultado |
|---|---|---:|---|
| 1 | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 0 | Sin errores |
| 2 | `eslint` sobre los 59 `.ts/.tsx` añadidos o modificados desde `f7ff819` | 0 | 59 archivos analizados, 0 errores, 0 advertencias |
| 3 | `node node_modules/vitest/vitest.mjs run --no-cache` sobre los archivos de B-07, C-13, C-14, C-20, C-24, L-06, L-07, D-08, B-08, ficha de alumno, aislamiento público e I-10 (32 archivos) | 0 | 477 aprobadas, 0 fallidas |
| 4 | `node node_modules/vitest/vitest.mjs run --no-cache` (suite completa, sin base PG) | 0 | 258 archivos aprobados y 54 omitidos; 3298 pruebas aprobadas, 432 omitidas (las PG sin base) |
| 5 | `node scripts/verificar-claves-textos.ts` | 0 | Claves de textos verificadas |
| 6 | `git diff --check f7ff819` | 0 | Sin hallazgos |
| 7 | `npm run test:pg -- <33 archivos PG de alumnos, materias, pagos, shared, usuarios, turnos (sin los tres con guarda de nombre fijo ni turno.generacion), profesor.estado y clases-alumno>` | 0 | 31 archivos y 286 pruebas en la base compartida; `alumno.estado.permisos.pg.test.ts` (2) y `materia.tarifa.pg.test.ts` (5) con seed completo en base propia: 293 pruebas aprobadas. Bases `noctium_pruebas_<8 hex>` creadas, migradas y borradas por el ejecutor |
| 7b | `npm run test:pg -- src/server/alumnos/alumno.estado.pg.test.ts src/server/alumnos/alumno.estado.permisos.pg.test.ts` | 0 | `alumno.estado.pg`: 38; `alumno.estado.permisos.pg`: 2 |
| 8 | `npm run build` | 0 | Compilación de producción correcta |
| 9 | Postman: `HU-B-07.postman_collection.json` con un ejecutor mínimo de Node (no hay `newman`), contra `next dev -p 3100` sobre una base descartable con migraciones y seed completo, sesiones obtenidas por el login real | 0 | 29 solicitudes, 104 aserciones, 0 fallidas |
| 10 | SQL: bloques de aserciones de `HU-B-07.sql` con `psql -v ON_ERROR_STOP=1` (`docker exec`), en la base descartable, después de «Desactivar — 200» y de «Reactivar — 200» | 0 | Ambos bloques correctos; cada uno falla en el estado equivocado (el de la baja con la ficha activa, el de la reactivación antes de reactivar) y el de la reactivación falla si falta la baja en el historial, si se restaura una inscripción o si se borra la marca de sesiones |
| 11 | Barrido de palabras de proceso sobre estos archivos | — | Sin coincidencias |

Detalle de las pruebas de B-07 (aprobadas en las corridas 3 y 7): unitarias y de componente por archivo: `autorregistro.service.test` 41, `actions.estado.test` 16, `estado-alumno-dialog.test` 19, `historial-estados-alumno.test` 3, `alumnos/[id]/route.test` 3, `verificar-codigo/route.test` 9, `alumno.estado.impacto.test` 6, `alumno.estado.routes.test` 5, `alumno.estado.service.test` 2, `alumnos/[id]/page.test` 3. Regresión: `alumno.schema.autorregistro.test` 14 (B-08), `alumno.cuenta.test` 16, `alumno.publico.test` 14, `publico.aislamiento.test` 50, `profesor.estado.*` (D-08), `pago.service.test` 35 e I-10 en PG.

## Pruebas nuevas y sensibilidad verificada

La sensibilidad se comprobó revirtiendo de forma temporal solo la regla indicada, con copia del archivo fuera del repositorio; la prueba falló y el archivo se restauró idéntico.

| Regla | Prueba | Mutación probada | Resultado |
|---|---|---|---|
| Email de contacto de una ficha inactiva | PG, grupo del criterio 5 | Sin ambas comprobaciones / sin la de la transacción / sin la previa | Fallan 5 / 1 (baja concurrente) / 1 (rama b) |
| Relectura bajo bloqueo al confirmar el código | PG, «código de autorregistro confirmado contra la baja» | Sin la relectura de `activoAlumno` y la condición del `updateMany` / sin `bloquear` | Falla «gana la baja» / falla «gana la confirmación» |
| Historial después del commit | PG, «después del commit, nunca dentro de la transacción» | Escribir el historial de inmediato, antes de encolar | Fallan las 4 pruebas del grupo |
| Clases futuras antes de bloquear | PG, «la baja no bloquea ni toca las clases pasadas o en curso» | Sin el filtro de inicio posterior | Falla |
| Impacto con `desde` | `alumno.estado.impacto.test.ts` | Sin `desde` | Fallan 3 |
| Detalle con `historial_estados` | `alumnos/[id]/route.test.ts` | Ruta con el código anterior | Fallan 2 |
| Rutas con `alumnos:cambiar_estado` | `alumno.estado.permisos.pg.test.ts` | `desactivar` con el permiso `alumnos:leer` | Falla («desactivar como GERENTE: 200 en vez de 403») |
| Server Action: permiso antes de validar | `actions.estado.test.ts` | Validar antes de verificar el permiso | Fallan 4 |
| `TRANSACCION_OCUPADA` en `verificar-codigo` | `verificar-codigo/route.test.ts` | Ruta sin el mapeo | Falla 1 |
| Diálogo M-21 | `estado-alumno-dialog.test.tsx` | Motivo obligatorio sin efecto / singular roto / tope de 300 / sin descripción del toast / sin propagar el error del servidor | Fallan 1 / 1 / 1 / 1 / 6 |

Intercalado forzado (sin esperas fijas): la primera operación retiene el bloqueo con la transacción abierta y las siguientes se lanzan y esperan en la base (se verifica en `pg_stat_activity` con `wait_event_type = 'Lock'`) antes de soltarla. Cada prueba afirma el resultado exacto de los dos órdenes: confirmación del código contra la baja, baja contra reactivación, baja contra continuar una clase Pendiente, baja contra el alta del centro y contra «Registrar pago», baja contra el cobro de I-10, y dos bajas con la misma versión.

## Límites

- La sesión 401 se verifica con `verificarPermiso` y la cuenta real en PostgreSQL, simulando el token; no reemplaza un recorrido con la cookie de una sesión revocada.
- `alumno.estado.permisos.pg.test.ts` usa `withPermission` y `rol_permiso` reales, pero simula la cookie y el envoltorio `auth` de NextAuth. El recorrido de Postman usa sesiones reales obtenidas por el formulario de login.
- Los datos de Postman y SQL (alumno con una clase pasada pagada y una inscripción futura) se insertaron directamente en la base descartable; no prueban los flujos de C ni de I que los crean.
- El seed completo termina con el reloj fijado en el 11/10/2026 (`SEED_FECHA_HOY=2026-10-11`). Con el reloj real del 12/10/2026 el fixture de HU-E-02 del seed falla con «Fixture E02 sin inscripción inicial», después de crear los datos base; es ajeno a esta HU.
- Una comprobación pendiente no se considera aprobada.

## Pendientes y diferidos

- ⏳ Recorrido de navegador de M-21 (impacto, doble envío, error dentro del diálogo, recarga e historial): a cargo de Tomás.
- ⏳ CI sobre el SHA del PR.
- Diferido a HU-E-02: pantalla del historial de la inscripción (criterios 2 y 7). Diferido a HU-H-10: serie «Bajas» (criterio 2). Diferido a HU-I-06: reintegro (criterio 6). Los verifica quien integre cada una (convención 1 del Excel); esta HU deja los datos correctos (`BAJA_ALUMNO` con fecha y actor, pagos intactos).
