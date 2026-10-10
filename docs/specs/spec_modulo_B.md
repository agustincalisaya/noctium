```markdown
# Especificación Técnica — Módulo B (Alumno)
## Noctium — Sprint 1 · Sprint 2 · Sprint 3 (Revisión 3)
## Revisión 2 — Sprint 2: búsqueda de alumnos (HU-B-05), servicios públicos de lectura (2.8) y traspaso del catálogo `FormaPago` al Módulo I

## Revisión 3 — Sprint 3: desactivar y reactivar alumno (HU-B-07), alta con cuenta de acceso (parte de B de HU-A-06) y acceso de consulta del Gerente (08/10/2026)

**Fuente de verdad:** backlog definitivo del Sprint 3 (40 HU · 107 SP). **Referencias de esta revisión:** `PR-0.md` (§1.1 compatibilidad, §2.9 permisos, §2.10 orden de bloqueo, §2.13 servicios compartidos, §2.14 esquema, §2.16 `transaccion`, `bloquear`, `despuesDelCommit`) · `docs/adicionales/mapa-pantallas-sprint-3.md` (P-24, P-25, P-29, M-21, DEC-14, DEC-15, DEC-37) · `spec_modulo_A.md` Revisión 3 (§2.6 y §2.9) · `spec_modulo_C.md` Revisión 6 (§2.16) · `spec_modulo_E.md` Revisión 2 (R2-PR0-3) · `spec_modulo_I.md` Revisión 3 · `spec_modulo_F.md` (§2.5 y §2.7, que fijan el patrón de baja de una ficha).

**HU contractualizadas o tocadas en esta revisión:**
| HU | SP | Qué agrega a este módulo | Sección |
|---|---|---|---|
| HU-B-07 Desactivar y reactivar alumno | 5 | Baja lógica que libera las inscripciones futuras, desactiva la cuenta y revoca sus sesiones; reactivación; historial de estados; motivo | 2.10, 2.11, 2.12 |
| HU-A-06 Crear la cuenta de acceso (la parte del alumno, con HU-B-01 y HU-B-06) | — (los 5 SP son de A) | Email en el alta, cuenta creada en la misma transacción, sincronización del email, sección «Cuenta de acceso» | 2.9, 2.12; notas en 2.1, 2.2 y 2.5 |
| HU-E-02, criterio 8 | — | El Gerente consulta el listado, la búsqueda y la ficha (`alumnos:leer`); el Profesor deja de tenerlo | 2.12 y nota en 2.7 |
| HU-I-07 e HU-I-10, HU-C-26 | — | `contarAlumnosConFormaPagoPreferida`; criterio de búsqueda por palabras para el cobro y las reservas | 2.13 |

HU-B-01 a HU-B-06 y HU-B-08 (Sprint 1) y HU-B-05 (Sprint 2) **conservan sus contratos**. Las secciones 2.1 a 2.8 no se renumeran ni se reescriben: reciben una nota de Revisión 3 donde corresponde.

**Regla de esta revisión (instrucción del SM): nada de lo desarrollado en los Sprints 1 y 2 se rompe.** Esta revisión es aditiva: ninguna ruta, schema, `code` de error ni función pública de Sprint 1 y 2 cambia de firma o de resultado. Todo lo nuevo son rutas nuevas, campos opcionales nuevos en el pedido, campos extra en la respuesta, funciones nuevas y reglas que solo alcanzan a las fichas inactivas (que hasta ahora no podían existir) y a las fichas con cuenta creada por HU-A-06.

**Cómo se verificó.** El repositorio revisado trae `prisma/schema.prisma` (modelos `Alumno` y `SolicitudAutorregistro`, enum `Genero`) y no trae `src/server/alumnos/*` ni `src/server/usuarios/*`. El contraste se hizo contra el esquema real, la Revisión 2 de esta spec, el PR 0 v19, las specs A (Rev. 3), C (Rev. 6), E, F, G e I, el mapa y el backlog. Lo que depende del código ausente queda marcado «a confirmar contra el código».

**Compatibilidad con los Sprints 1 y 2 (revisada antes de entregar):**
| Elemento existente | Estado en Revisión 3 |
|---|---|
| 2.1 `POST /api/alumnos` con el cuerpo de identidad, `IdentidadAlumnoSchema`, `DNI_DUPLICADO`, `version: 0` y `alumno:creado` | **Sin cambios.** Un pedido sin `email` hace exactamente lo de hoy (ficha sin cuenta). Se admiten dos campos **opcionales** nuevos, `email` y `telefono`; con `email` la ficha y la cuenta se crean juntas (2.9, P-B1) |
| 2.2 `PATCH /api/alumnos/[id]/contacto` | **Sin cambios de ruta, schema ni códigos.** Se suma un efecto solo para fichas **con cuenta vinculada**: el email nuevo también cambia el de la cuenta (T9). Para una ficha sin cuenta el resultado es idéntico |
| 2.3 forma de pago preferida | **Sin cambios.** Se suman la lectura `contarAlumnosConFormaPagoPreferida` (2.13) y la etiqueta «Inactiva» en el detalle (2.12) |
| 2.4 listado y detalle | **Se conservan los campos de hoy.** El detalle suma campos opcionales (2.12). El listado no cambia. `alumnos:leer` pasa a Mesa de Entrada **y** Gerente (T8) |
| 2.5 `PATCH /api/alumnos/[id]` con `version` | **Sin cambios.** Ya cambiaba el email de la cuenta con `actualizarEmailCuenta`; sigue igual (T2 de la spec A) |
| 2.6 autorregistro (HU-B-08) | **Sin cambios de contrato.** Una ficha inactiva se trata como una ficha con cuenta: mismo `409 CUENTA_YA_EXISTE` y mismo mensaje (HU-B-07, criterio 5). Hasta HU-B-07 no existían fichas inactivas |
| 2.7 búsqueda (`ListarAlumnosQuerySchema`, `construirFiltroBusquedaAlumno`) | **Sin cambios de comportamiento.** `buscarAlumnosActivos(query)` conserva su resultado y su test; el criterio por palabras se ofrece con un segundo parámetro **opcional** (P-B8) |
| 2.8 funciones públicas (`obtenerAlumnoDeUsuario`, `obtenerAlumnosBasicos`, `obtenerAlumnoBasico`, `verificarAlumnoActivo`, `buscarAlumnosActivos`) | **Firmas y resultados sin cambios.** Las nuevas están en 2.13 |
| `Alumno` (esquema) | **Sin columnas nuevas.** La baja usa `activoAlumno` y `version`, que ya existen. El historial de estados es una tabla del PR 0 (`registrarCambioEstado`) |
| `EventoSeguridad`, `SolicitudAutorregistro`, `CodigoVerificacion` y los eventos de B | **Sin cambios** |
| Fichas de Sprints 1 y 2 sin cuenta | **No se migran ni se les crea cuenta** (HU-A-06, criterio 8). Se muestran como «Sin cuenta» (DEC-14) |
| Tests de Sprint 1 y 2 de 2.1 a 2.8 | **Siguen pasando sin tocarse**, incluido `alumno.busqueda.test.ts` y `publico.aislamiento.test.ts` |

**Contradicciones detectadas y cómo se resuelven (siempre «acomodarse a lo ya hecho»):**
| # | Contradicción | Resolución |
|---|---|---|
| T1 | «Fuera de alcance» de Sprint 1 y 2: la baja y la reactivación del alumno (HU-B-06 §9 las excluye; el estado no era editable) | **Superado por el backlog (HU-B-07).** `PATCH /api/alumnos/[id]` sigue sin poder cambiar `is_active`: la baja y la reactivación son rutas propias con su permiso (2.10 y 2.11). La lista de «Fuera de alcance» se conserva con una nota |
| T2 | El backlog (HU-A-06, criterio 1) hace el email obligatorio al registrar un alumno; `POST /api/alumnos` de Sprint 1 recibe solo la identidad y sus tests y colecciones Postman lo usan así | Se cumple en la **pantalla** y en el camino nuevo (con `email` la cuenta es obligatoria), y el servidor no rechaza el pedido sin `email` para no romper el contrato (`PR-0.md` §1.1, puntos 1 y 7). Decisión P-B1, con el cambio de una línea si el equipo prefiere el rechazo estricto |
| T3 | El backlog (HU-A-06, criterio 1) vuelve opcional el teléfono; `ContactoAlumnoSchema` exige «al menos teléfono o email» | No chocan: en el alta el email es obligatorio, así que la condición «al menos uno» se cumple siempre. La regla de 2.2 se conserva tal cual para el contacto de fichas anteriores |
| T4 | `spec_modulo_I.md` (P-I5) y `spec_modulo_C.md` (P-C6) piden que `buscarAlumnosActivos` adopte `construirFiltroBusquedaAlumno` **y que se actualice su test** (opción (a) de 2.7) | Se elige la forma que **no toca el test ni el selector de HU-C-04**: `buscarAlumnosActivos(query, opciones?)` con `{ porPalabras: true }` opcional (2.13, P-B8). Es la opción (b) de 2.7, ahora con el parámetro que pide el criterio nuevo |
| T5 | HU-B-07 (criterio 2): «toda operación que inscribe toma el mismo bloqueo y rechaza a un alumno inactivo». `spec_modulo_C.md` (R6-PR0-10) deja que el autoservicio pase un `alumnoActivo` leído **antes** del bloqueo | La firma de `crearInscripcion` no cambia. Se pide al PR 0 que, **después** de bloquear al alumno, vuelva a leer `activoAlumno` con `verificarAlumnoActivo(alumnoId, tx)` también cuando llegó `alumnoActivo` (R3-PR0-B3, 3.13). Sin eso, una baja y una reserva simultáneas podrían confirmarse las dos |
| T6 | HU-B-07 (criterio 1): motivo obligatorio si el alumno tiene «clases pasadas, pagos o historial académico»; B no puede leer esas tablas (Regla N.° 3) | Tres lecturas de existencia, una por módulo dueño (`alumnoTieneRegistros`, 2.13), y B las combina. Mismo patrón que `usuarioRegistroOperaciones` de la spec F (DEC-39) |
| T7 | `alumno.publico.ts` no puede importar otros módulos (2.8), pero la baja necesita a C, A, I y E; además C ya importa `alumno.publico.ts` (`verificarAlumnoActivo`) | La orquestación va en un archivo propio, `alumno.estado.service.ts`, que **no** reexporta `alumno.publico.ts`. Así no hay ciclo de importación ni se rompe `publico.aislamiento.test.ts` (P-B12) |
| T8 | La Revisión 2 de esta spec dice «`alumnos:leer` (sin cambios: exclusivo de Mesa de Entrada)»; el backlog (HU-E-02, criterio 8) da la consulta al Gerente y el PR 0 (§2.9) quita `alumnos:leer` al Profesor | **Lo manda el backlog.** Desde el Sprint 3 `alumnos:leer` es de Mesa de Entrada y Gerente. Mesa de Entrada conserva el acceso exacto de hoy; el Gerente no gana ninguna escritura (2.12). Coincide con T7 de la spec A |
| T9 | HU-A-06 (criterio 6) nombra HU-B-06 para el cambio de email de la ficha; HU-B-02 (2.2) también guarda `emailAlumno` y hoy no toca la cuenta | Se alinea 2.2 con 2.5: si la ficha tiene cuenta, el email nuevo también cambia el de la cuenta (`actualizarEmailCuenta`, la misma implementación que 2.5). Sin esto, ficha y cuenta quedarían con emails distintos |
| T10 | El valor `PREFIERO_NO_INDICAR` de `genero` en 2.1 no coincide con el enum real `Genero` del esquema (`PREFIERO_NO_INDICARLO`) | Es una discrepancia de la documentación de Sprint 1; **no se toca el código ni el esquema**. Vale el valor del enum de Prisma (a confirmar contra el código del schema Zod); la línea de 2.1 se conserva como historial |

**Changelog de Revisión 3:**
| Sección | Estado previo | Acción |
|---|---|---|
| Fuera de alcance, Visión general, Convenciones, 2.1 a 2.8, 3.1 a 3.10 y 4 | Vigentes | Nota de Revisión 3 donde cambia algo; el texto original se conserva |
| 2.9 | — | **Nueva:** alta del alumno con cuenta de acceso (HU-A-06 con HU-B-01) |
| 2.10 | — | **Nueva:** desactivar un alumno (HU-B-07, criterios 1 a 4, 6 y 8) y su pantalla de confirmación |
| 2.11 | — | **Nueva:** reactivar un alumno (HU-B-07, criterio 7) |
| 2.12 | — | **Nueva:** ficha del alumno en el Sprint 3 (Cuenta de acceso, historial de estados, modo consulta del Gerente) |
| 2.13 | — | **Nueva:** funciones públicas nuevas de B y lecturas de otros módulos que usa (complementa 2.8) |
| 3.11 a 3.17 | — | **Nuevas** reglas (alta atómica, qué cambia en la baja, bloqueo del alumno, alumno inactivo en el resto del módulo, datos sensibles, aislamiento y pruebas) |

**Puntos resueltos por el Scrum Master el 08/10/2026** (el backlog no los definía o el PR 0 los dejaba abiertos):
| # | Punto | Decisión | Informar |
|---|---|---|---|
| P-B1 | Email obligatorio en el alta (T2) | La pantalla lo exige; el servidor crea la cuenta cuando llega `email` y deja pasar un pedido sin `email` como en Sprint 1. Para exigirlo en el servidor bastaría pasar `email` a obligatorio en `RegistrarAlumnoSchema` y actualizar los tests de alta de Sprint 1: **se hace solo si el equipo lo decide**, porque esos tests cambiarían | Equipo, PO (informativo) |
| P-B2 | Permiso de la baja y la reactivación | Uno solo, nuevo: `alumnos:cambiar_estado`, solo MESA_ENTRADA (criterio 8). No se reutiliza `alumnos:editar`, para que quitar o devolver el acceso de un alumno pueda separarse de editar sus datos | Equipo (tabla cerrada del PR 0) |
| P-B3 | Rutas | `POST /api/alumnos/[id]/desactivar`, `POST /api/alumnos/[id]/reactivar` y `GET /api/alumnos/[id]/impacto-baja` (lo que muestra la confirmación M-21). Mismo patrón que `spec_modulo_F.md` §2.5 y §2.6 | Equipo |
| P-B4 | Control de edición concurrente | Ambas acciones reciben `version` y la validan con condición atómica, como la ficha de personal (F). Evita una baja doble y una baja sobre datos que alguien acaba de cambiar | Equipo |
| P-B5 | Historial de estados | `registrarCambioEstado` con `entidad: "ALUMNO"` y `accion: "DESACTIVAR"` o `"REACTIVAR"`, después del commit (PR 0 §2.10 y §2.16) | Equipo |
| P-B6 | Cuándo el motivo es obligatorio | Cuando el alumno tiene alguna inscripción en una clase ya iniciada, algún pago (incluso anulado) o algún registro de historial académico. La duda se resuelve pidiendo el motivo (Regla N.° 1) | Equipo |
| P-B7 | Cómo se muestra quién hizo cada cambio de estado | Con `obtenerNombresPersonal` de la spec F, igual que en la ficha del personal | Equipo |
| P-B8 | Buscador por palabras para HU-I-10 y HU-C-26 | `buscarAlumnosActivos(query, { porPalabras?: boolean })`: sin el parámetro, el resultado de Sprint 1; con él, el filtro de 2.7. Reemplaza el pedido P-I5 (opción (a)) | I y C (informativo) |
| P-B9 | Filtro de HU-C-26 (P-C6) | B publica `construirFiltroBusquedaAlumno(q)` en `alumno.publico.ts` (función pura, devuelve el `where`). C filtra sus reservas con él y no repite columnas | C (informativo) |
| P-B10 | Qué cuenta `contarAlumnosConFormaPagoPreferida` | **Todos** los alumnos, activos e inactivos: la preferencia sigue en la ficha de un inactivo y vuelve a usarse al reactivarlo | I (informativo) |
| P-B11 | Email de la ficha y de la cuenta | 2.2 también sincroniza la cuenta (T9) | Equipo |
| P-B12 | Dónde vive la orquestación de la baja | `src/server/alumnos/alumno.estado.service.ts` (T7) | Equipo |
| P-B13 | Qué agrega C para la baja | Una escritura, `darDeBajaInscripcionesDeAlumno`, y una lectura de existencia, en la fachada de C, **dentro del PR de HU-B-07** (`PR-0.md` §2.13: la HU agrega la lectura que le falta en la fachada del dueño). La lista de la confirmación sale de `listarInscripcionesDeAlumno` (R2-PR0-3 de la spec E), sin función nueva | C (informativo) |
| P-B14 | Reservas vencidas al dar de baja | Se marcan antes como «Reserva vencida» y no cuentan como baja ni aparecen en la lista de la confirmación (mapa M-21) | Equipo |
| P-B15 | Alumno inactivo y edición | La ficha inactiva **se puede editar** (el mapa mantiene «Editar» en la cabecera, P-25): la baja no bloquea HU-B-02, B-03 ni B-06 | Equipo |
| P-B16 | Alta de cuenta para fichas anteriores | No hay. Las fichas sin cuenta siguen siendo posibles y se muestran como «Sin cuenta» (DEC-14); se vinculan por autorregistro (HU-B-08) como hasta hoy | Equipo |

**Pedidos al PR 0 (a incorporar en el v20, sin tocar lo existente):**
| # | Pedido | Dónde |
|---|---|---|
| R3-PR0-B1 | Acción nueva `alumnos:cambiar_estado` en la tabla cerrada de permisos: solo MESA_ENTRADA, en migración y seed. `alumnos:leer` pasa a MESA_ENTRADA y GERENTE (convención 8 d) y se quita al PROFESOR (8 g) en el mismo cambio (ya listado en §2.9) | `PR-0.md` §2.9 |
| R3-PR0-B2 | Historial de estados: la entidad `"ALUMNO"` y las acciones `"DESACTIVAR"` y `"REACTIVAR"` entre los valores admitidos; `listarHistorialEstados("ALUMNO", id)` incluido | `PR-0.md` §2.13 y §2.14 |
| R3-PR0-B3 | `crearInscripcion` (y todo servicio que inscribe) llama a `verificarAlumnoActivo(alumnoId, tx)` **después** de bloquear al alumno, aunque le hayan pasado `alumnoActivo`. La firma no cambia | `PR-0.md` §2.13 |
| R3-PR0-B4 | Anotar en «Lo usan» de la inscripción que HU-B-07 agrega a la fachada de C `darDeBajaInscripcionesDeAlumno` y `alumnoTieneRegistros`, y que I y E agregan su `alumnoTieneRegistros` | `PR-0.md` §2.13 |
| R3-PR0-B5 | `src/server/shared/rutas-por-rol.ts`: `/alumnos` y `/alumnos/[id]` también para GERENTE (ya previsto en §2.9); sin ruta nueva en pantalla para la baja (es un modal de la ficha) | `PR-0.md` §2.9 |

**Efectos sobre otras specs:** **A** (2.8: sumar `alumnos:cambiar_estado` a la matriz; 2.9: las funciones que B usa); **C** (2.15/2.16: las dos funciones de 2.13 y la relectura bajo bloqueo de T5; P-C6 queda resuelto con P-B9); **E** (`alumnoTieneRegistros` en `historial.publico.ts`; la baja del alumno ya figura en el historial de clases de HU-E-02 por la vigencia `BAJA_ALUMNO` de C); **I** (`contarAlumnosConFormaPagoPreferida`, `alumnoTieneRegistros` de pagos y el cambio de P-I5 a `buscarAlumnosActivos(q, { porPalabras: true })`); **H** (la serie «Bajas» de HU-H-10 sale de las inscripciones `BAJA_ALUMNO` de C, sin cambios en esta spec); **D** (HU-D-01 aplica el mismo patrón de alta con cuenta; `listarHistorialEstados` la publica el PR 0, R7-PR0-1); **F y G** (`obtenerNombresPersonal` de F lo usa B para el historial).

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod · bcryptjs
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 2, 3, 4, 5, 6, 7, 9, 10, 11) · `spec_modulo_A.md` (sesión, JWT, `EventoSeguridad`) · `spec_modulo_I.md` (Pagos, §2.3, dueño de `FormaPago`) · `spec_modulo_C.md` Revisión 5 · `spec_modulo_H.md` (Indicadores) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-B-05 | Gap — no contractualizada (la búsqueda figuraba fuera de alcance) | Añadida sección 2.7 (aditiva, no renumera). Amplía 2.4 |
| HU-B-03 | Contractualizada (Sprint 1) | Sección 2.3 alineada: el catálogo `FormaPago` pasa al Módulo I; códigos `404 FORMA_PAGO_NO_ENCONTRADA` / `409 FORMA_PAGO_NO_DISPONIBLE`. Sin cambio de ruta ni de permiso |
| HU-B-04 | Contractualizada (Sprint 1) | Sección 2.4 recibe el parámetro opcional `q` (definición única en 2.7) |
| HU-B-01, HU-B-02, HU-B-06, HU-B-08 | Contractualizadas (Sprint 1) | Sin cambios de contrato (2.1, 2.2, 2.5, 2.6). Se completan los campos de la plantilla (Servicio, Errores esperados) |
| — (Regla N.° 3, servicios públicos) | Solo `buscarAlumnosActivos()` y `verificarAlumnoActivo()` | Añadida sección 2.8 (4 funciones nuevas y códigos de `verificarAlumnoActivo()`) |
| — (§3) | Reglas 3.1 a 3.8 | Añadidas las reglas 3.9 y 3.10 |

**Nota aditiva — 01/10/2026 (`spec_modulo_H.md` Revisión 2):** `contarAlumnosNuevosPorMes()` (2.8) se **retira** del código porque su único consumidor, la HU-H-02 original (alumnos nuevos por mes), fue reemplazado por la tasa de ocupación. El tipo `AlumnosNuevosPorMes` de `alumno.types.ts` se retira con ella. La fila y la descripción de 2.8 se conservan tachadas como historial. No cambia ningún otro contrato.

**HU contractualizadas en esta revisión:** HU-B-01 (Identidad), HU-B-02 (Contacto), HU-B-03 (Forma de pago preferida), HU-B-04 (Listado), HU-B-06 (Modificación), HU-B-08 (Autorregistro) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-B-05 (Búsqueda inteligente de alumnos). Además provee los servicios públicos que consumen HU-C-12/C-13 (`spec_modulo_C.md`), HU-I-01 (`spec_modulo_I.md`), HU-H-02 (`spec_modulo_H.md`) y HU-E-01/E-05/E-06 (`spec_modulo_E.md`).

**Changelog — Revisión 2 (Sprint 2):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-B-05 | Gap — "Búsqueda avanzada / filtros combinados" figuraba como fuera de alcance | Nueva sección 2.7 (aditiva, no renumera). Amplía 2.4 |
| Servicios públicos | Solo `buscarAlumnosActivos()` y `verificarAlumnoActivo()` (consumidos por Turnos) | Nueva sección 2.8: 4 funciones nuevas (incluye `obtenerAlumnosBasicos()`, que usa HU-I-01 para proponer la forma de pago preferida del alumno que paga, y también HU-E-01 para los nombres del registro de clase). Además fija los códigos `ALUMNO_NO_ENCONTRADO` / `ALUMNO_INACTIVO` de `verificarAlumnoActivo()` |
| `FormaPago` | B la lee directamente del catálogo | Pasa a ser propiedad del Módulo I. B la consume por `verificarFormaPagoActiva()` / `existeFormaPago()` / `obtenerFormaPago()` (`spec_modulo_I.md` §2.3). **Sin cambio de ruta ni de permiso.** Códigos de 2.3 alineados con `spec_modulo_I.md` §2.4: `404 FORMA_PAGO_NO_ENCONTRADA` (inexistente) y `409 FORMA_PAGO_NO_DISPONIBLE` (inactiva) |
| §3 | 3.1 a 3.8 | Regla 3.9: criterio de búsqueda compartido con el selector de Turnos |

**Actualización del 29/09/2026 (implementación del PR 0', sin renumerar secciones):**
| Sección | Estado previo | Acción |
|---|---|---|
| 2.8 (`contarAlumnosNuevosPorMes`) | La fórmula aplicaba `AT TIME ZONE 'America/Argentina/Buenos_Aires'` directamente sobre `createdAtAlumno` | **Corregida:** `createdAtAlumno` es `TIMESTAMP(3)` **sin zona** y Prisma lo guarda en UTC; hay que pasar primero por `AT TIME ZONE 'UTC'`. Sin la corrección el mes quedaba corrido 3 horas |
| 2.8 (`verificarAlumnoActivo`) | Firma y propagación de errores «a confirmar» | Fijadas: `verificarAlumnoActivo(alumnoId, db?)` lanza `ServiceError` con `ALUMNO_NO_ENCONTRADO` / `ALUMNO_INACTIVO`. `alumno.service.ts` conserva la versión interna que devuelve `boolean` (la usa Turnos hasta que migre) |
| 2.8 (imports) | «No importa nada de otros módulos» | Se precisa qué sí puede importar (ver nota al inicio de 2.8) |

**Fuera de alcance de esta spec (explícito):**

> **Revisión 3 (Sprint 3).** Esta lista queda como estaba y el backlog del Sprint 3 la supera en tres puntos, sin borrar nada de ella: (1) la **baja lógica y la reactivación del alumno** entran con HU-B-07 (2.10 y 2.11); `PATCH /api/alumnos/[id]` sigue sin poder cambiar el estado; (2) la **recuperación de contraseña** pasa a ser HU-A-05, de `spec_modulo_A.md`, y alcanza también a las cuentas del autorregistro; (3) el **alta con cuenta** de la ficha (HU-A-06) se agrega en 2.9. Siguen fuera de alcance: los filtros combinados (estado, forma de pago, fecha de alta), el envío real de código OTP por un proveedor propio de este módulo, y crear cuentas para fichas anteriores (HU-A-06, criterio 8).

- Filtros combinados en el listado (estado, forma de pago, fecha de alta). ~~Búsqueda por texto~~: **incorporada en Revisión 2** (2.7).
- Baja lógica y reactivación del alumno (HU-B-06 §9 lo excluye explícitamente — el estado no es editable esta iteración).
- Recuperación de contraseña del autorregistro (cubierto por `spec_modulo_A.md`, fuera de alcance del Sprint).
- Envío real de email/SMS: el servicio de notificación (envío del código OTP) se referencia como interfaz (ubicación a confirmar contra el código; la convención del proyecto es `src/server/<módulo>/`, Regla N.° 11) pero su implementación de proveedor externo no es parte de esta spec.

**Actualización de alcance — Revisión 2 (Sprint 2):** la **búsqueda por texto** en el listado (2.7) pasa a estar dentro de alcance. Siguen fuera de alcance: filtros combinados (estado, forma de pago, fecha de alta) y la baja/reactivación del alumno.

---

### Sincronización HU-E-02 — 09/10/2026

E02 implementa `/alumnos/[id]/clases` y `GET /api/alumnos/[id]/clases` exclusivamente para Mesa/Gerente, con nueve resultados, filtros combinados inclusivos, resumen filtrado y paginación de diez. La migración nueva `20261009180000_hu_e02_alcance_profesor` retira solo `PROFESOR alumnos:leer`; seed mantiene esa revocación. El historial del Profesor se renderiza en `/turnos/[id]/alumnos/[alumnoId]/historial`, verificando clase propia y materia, sin ficha general ni datos de contacto. Permisos se leen por solicitud y afectan sesiones existentes.

Figuras 66–67: pestaña Clases y aviso de modo consulta; no se agregan Desactivar ni Pagos, historias aún fuera del alcance. Sidebar conservado por instrucción del usuario; su enlace general de Profesor queda rechazado por ruta y API. Fixtures usan fachadas PR0 para estados C14/C24/B07 sin declarar completadas esas historias. Changelog aditivo: integración E02 y revocación de compatibilidad de Sprint 2.

## 1. Visión General

> **Revisión 3 (Sprint 3).** El módulo suma tres capacidades, todas aditivas: (1) el alta de un alumno puede crear **junto con la ficha su cuenta de acceso** —email como usuario, DNI como contraseña inicial, cambio obligatorio en el primer ingreso—, siempre vía los servicios de A (2.9); (2) Mesa de Entrada puede **desactivar y reactivar** al alumno, lo que libera sus inscripciones futuras, desactiva su cuenta y cierra sus sesiones, sin borrar nada (2.10 y 2.11); (3) el **Gerente** consulta la sección Alumnos en modo lectura (2.12). Las dos entidades siguen separadas: una ficha puede no tener cuenta (las anteriores al Sprint 3 y las creadas sin email) y baja y cuenta se mueven juntas solo cuando existe la cuenta. La separación de módulos se mantiene: B nunca escribe en `usuarios` ni lee clases, pagos o historial; usa las fachadas de A, C, I y E (2.13).


El Módulo B gestiona la **ficha de Alumno** (identidad, contacto, forma de pago preferida) y el flujo de **autorregistro de cuenta**. Es importante distinguir dos entidades relacionadas pero independientes:

- **`Alumno`** — la ficha de datos, que puede existir sin acceso al sistema (creada por Mesa de Entrada).
- **`Usuario`** (Módulo A) — la cuenta de acceso, con rol `ALUMNO`, opcionalmente vinculada a una ficha (`Alumno.usuario_id`, nullable).

Un `Alumno` puede crearse con cuenta simultánea (si Mesa de Entrada lo registra pensando en que el propio alumno accederá) o sin cuenta (caso más común en este sprint); una cuenta puede sumarse después vía autorregistro (HU-B-08), que vincula la nueva cuenta a la ficha existente en lugar de duplicarla.

**Alcance de esta revisión:** la Revisión 2 es **aditiva**: agrega la sección 2.7 (búsqueda de alumnos, HU-B-05) y la sección 2.8 (servicios públicos, Regla N.° 3), y las reglas 3.9 y 3.10. Las secciones 2.1 a 2.6 (Sprint 1) **no se renumeran**, porque otras specs las citan por número (ver `docs/adicionales/sdd-metodologia.md`); 2.3 y 2.4 solo reciben notas de revisión sin cambiar ruta ni permiso.

**Nota — forma de pago preferida no es el Módulo de Pagos:** el campo definido en HU-B-03 es exclusivamente una preferencia de UX para prellenar futuras operaciones (hoy, la forma de pago propuesta en el modal de registrar pago de HU-I-01), resuelta contra un catálogo precargado de **nombres genéricos** (seed con cuatro formas: `Efectivo`, `Transferencia`, `Débito`, `Mercado Pago`, según `spec_modulo_I.md`, changelog, fila «Modelo `FormaPago`»; el contenido exacto de `seed.ts` está a confirmar contra el código). No se solicita ni almacena ningún dato financiero sensible (número de tarjeta, CBU, etc.). El Módulo I (Pagos, `spec_modulo_I.md`, Sprint 2) gestiona transacciones reales y es una entidad completamente distinta — esta spec no lo anticipa ni lo reemplaza.

**Aislamiento de dominio (Regla N.° 3 de `docs/RULES.md`):** la tabla `Usuario` es propiedad del Módulo A. Este módulo **nunca** escribe directamente sobre `Usuario` — toda creación o vinculación de cuenta (HU-B-08) invoca el servicio público `crearCuentaConCredenciales()` expuesto por `src/server/usuarios/usuario.service.ts` (Módulo A).

---

## 2. Interfaces y Contratos

### Convenciones generales

> **Revisión 3.** Valen para las secciones nuevas. Archivos nuevos (Regla N.° 11), sin mover nada existente: `alumno.estado.service.ts` (baja, reactivación e impacto) en `src/server/alumnos/`, los schemas nuevos se agregan a `alumno.schema.ts`, las Server Actions a `actions.ts`, los tipos a `src/types/alumno.types.ts` y los Route Handlers en `app/api/alumnos/[id]/{desactivar,reactivar,impacto-baja}/route.ts`. Las operaciones de estado usan `transaccion`, `bloquear` y `registrarCambioEstado` del PR 0 y devuelven `ErrorDeDominio`, que **extiende** `ServiceError`: los `code` de error que ya existían (`DNI_DUPLICADO`, `EMAIL_YA_ASOCIADO`, `ALUMNO_NO_ENCONTRADO`, `CONFLICTO_EDICION_CONCURRENTE`…) se conservan. Los permisos de cada ruta nueva están en las secciones y en la matriz de `spec_modulo_A.md` 2.8.

- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6. Las Server Actions ligadas a `useActionState` siguen la excepción de la Regla N.° 5.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/alumno.types.ts`, Server Actions en `src/server/alumnos/actions.ts` y services en `src/server/alumnos/alumno.service.ts` (autorregistro: `src/server/alumnos/autorregistro.service.ts`). Imports siempre con el alias `@/`. Los nombres exactos de funciones de servicio que la spec no fijaba están marcados «a confirmar contra el código».
- Los identificadores de `Alumno` y `FormaPago` son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo. El `solicitud_id` de HU-B-08 no corresponde a esas entidades ni está modelado en el esquema vigente: conserva su contrato UUID independiente.
- Toda ruta protegida requiere `withPermission("alumnos:<accion>")` (Regla N.° 10); el autorregistro (2.6) es la única superficie **pública** (sin sesión) de este módulo.
- Los schemas de identidad y contacto de 2.1/2.2 son reutilizados sin duplicación por el autorregistro (2.6) y por la modificación (2.5) — se componen, no se reescriben.

---

### 2.1. Alta de identidad del alumno (HU-B-01)

> **Revisión 3.** **Sin cambios** para un pedido que trae solo la identidad: la ruta, el schema, los pasos 1 a 5, los errores y la respuesta son los de Sprint 1. El cuerpo admite dos campos **opcionales** nuevos, `email` y `telefono`; con `email` la ficha y la cuenta de acceso se crean en la misma transacción (2.9, HU-A-06). Nota de documentación: el valor `PREFIERO_NO_INDICAR` de `genero` aparece así en este bloque de Sprint 1; el enum del esquema es `PREFIERO_NO_INDICARLO` (T10, a confirmar contra el código del schema Zod).


**Ruta:** `POST /api/alumnos`
**Server Action equivalente:** `crearAlumno()` en `src/server/alumnos/actions.ts`
**Servicio:** `crearAlumno()` en `src/server/alumnos/alumno.service.ts`
**Permiso requerido:** `alumnos:crear` (Mesa de Entrada)

```typescript
// src/server/alumnos/alumno.schema.ts (misma ruta que cita 2.7)
export const IdentidadAlumnoSchema = z.object({
  nombre: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  apellido: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  dni: z.string().trim()
    .regex(/^\d+$/, "Ingresá el DNI solo con números")
    .length(DNI_LONGITUD, `El DNI debe tener ${DNI_LONGITUD} dígitos`), // DNI_LONGITUD: parámetro configurable
  fecha_nacimiento: fechaCalendarioValidaSchema // ver nota de validación de calendario, abajo
    .refine((d) => d <= new Date(), "La fecha de nacimiento no puede ser futura"),
  genero: z.enum(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICAR"]).optional(),
});
export type IdentidadAlumnoInput = z.infer<typeof IdentidadAlumnoSchema>;
```

**Nota técnica — validación estricta de calendario:** `z.coerce.date()` sobre un `Date` nativo de JS "corrige" fechas inexistentes (`31/02` se interpreta como `03/03`). `fechaCalendarioValidaSchema` (ruta a confirmar contra el código: antes figuraba como `lib/schemas/shared/fecha.schema.ts`, convención anterior a la Regla N.° 11; ninguna otra spec fija la ubicación real) usa un parseo estricto (ej. `date-fns` `parse` + `isValid`) que **rechaza** explícitamente una fecha inexistente en lugar de reinterpretarla — utilidad compartida, reutilizable por cualquier otro módulo que reciba fechas de calendario (Profesor, Turno).

**Comportamiento esperado (`src/server/alumnos/alumno.service.ts` → `crearAlumno`):**
1. Verificar unicidad aplicativa de `dni` contra **todos** los alumnos, activos e inactivos (`prisma.alumno.findFirst({ where: { dni } })`).
2. Si existe: `409 DNI_DUPLICADO`, indicando en el mensaje si la ficha existente está inactiva.
3. **Revalidación inmediatamente antes del `INSERT`** (mismo `findFirst`, dentro de la misma operación de servicio) para reducir la ventana de una alta duplicada simultánea, más **defensa de constraint único** (`P2002` sobre `dni`) capturada y traducida al mismo error `409`.
4. Insertar con `is_active: true`, `version: 0` (ver concurrencia optimista, sección 3.3), fecha de alta y usuario registrante.
5. Emitir `alumno:creado` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "nombre": "Ana", "apellido": "Pérez", "dni": "30123456", "is_active": true }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "DNI_DUPLICADO", "message": "Ya existe un alumno registrado con ese DNI" } }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido según `IdentidadAlumnoSchema` (incluye fecha de calendario inexistente o futura).
- `409 DNI_DUPLICADO` — el DNI ya existe en una ficha activa o inactiva (también ante `P2002`); el mensaje indica si la ficha existente está inactiva.

---

### 2.2. Registrar datos de contacto (HU-B-02)

> **Revisión 3.** Ruta, schema, validaciones y códigos **sin cambios**. Un solo efecto nuevo, que no alcanza a las fichas sin cuenta: si la ficha tiene cuenta vinculada (`usuarioId`), el email nuevo también cambia el de la cuenta, con la misma validación de unicidad y el mismo `409 EMAIL_YA_ASOCIADO`, llamando a `actualizarEmailCuenta()` dentro de la misma operación, como ya hace 2.5 (T9, HU-A-06 criterio 6). Una ficha con cuenta no puede quedarse sin email. La regla «al menos un teléfono o un email» se conserva para el contacto de fichas anteriores.


**Ruta:** `PATCH /api/alumnos/[id]/contacto`
**Server Action equivalente:** `actualizarContactoAlumno()` en `src/server/alumnos/actions.ts`
**Servicio:** `actualizarContactoAlumno()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `alumnos:editar`

```typescript
export const ContactoAlumnoSchema = z.object({
  telefono: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254).optional(),
}).refine((d) => d.telefono || d.email, {
  message: "Ingresá al menos un teléfono o un email de contacto",
  path: ["telefono"],
});
export type ContactoAlumnoInput = z.infer<typeof ContactoAlumnoSchema>;
```

**Comportamiento esperado:**
1. Si viene `telefono`: normalizar eliminando espacios/guiones/paréntesis pero **conservando el `+` inicial** (`normalizarTelefono()`, utilidad compartida — mismo requisito en `spec_modulo_D.md` §2.2; ubicación exacta a confirmar contra el código: `spec_modulo_D.md` §2.1 ubica los schemas de contacto compartidos en `src/server/shared/contacto.schema.ts`). Validar longitud entre 8 y 15 dígitos, contando solo dígitos (el `+` no cuenta para la longitud).
2. Si viene `email`: dado que este email es el que eventualmente usará el alumno para autorregistrarse (HU-B-08), se valida su unicidad contra `Usuario.email` de **cualquier cuenta existente**, sin consultar la tabla `usuarios` (Regla N.° 3): por un servicio público del Módulo A (`verificarEmailNoAsociadoAOtraCuenta()`, nombre que cita `spec_modulo_D.md` §2.1; firma a confirmar, ver `spec_modulo_A.md` §2.4) — si ya pertenece a otra cuenta, `409 EMAIL_YA_ASOCIADO`, con un mensaje que **no revela a quién pertenece** esa cuenta.
3. Actualiza únicamente los campos provistos, `updated_at`. Operación de una sola tabla, no requiere `$transaction` multi-tabla.
4. Emitir `alumno:contacto_actualizado` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "telefono": "+5493871234567", "email": "ana.perez@mail.com" }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "EMAIL_YA_ASOCIADO", "message": "Ese email ya está asociado a una cuenta existente" } }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — ni teléfono ni email, teléfono fuera de 8 a 15 dígitos o email inválido.
- `404 ALUMNO_NO_ENCONTRADO` — la ficha `[id]` no existe (no estaba explicitado en esta sección; a confirmar contra el código).
- `409 EMAIL_YA_ASOCIADO` — el email ya pertenece a otra cuenta; el mensaje no revela a quién.

---

### 2.3. Asociar alumno a forma de pago preferida (HU-B-03)

> **Revisión 3.** **Sin cambios.** La preferida de un alumno sigue guardada aunque la forma de pago se desactive (HU-I-07): el detalle la muestra con la etiqueta «Inactiva» (2.12) y HU-I-10 no la propone. `contarAlumnosConFormaPagoPreferida` (2.13) permite a Pagos avisar cuántos alumnos la tienen antes de desactivar una forma.


> **Revisión 2 (Sprint 2).** El catálogo de formas de pago pasa a ser del **Módulo I** (`spec_modulo_I.md`). La función `listarFormasPagoActivas()` que hoy vive en `alumno.service.ts` se **mueve** a Pagos (`forma-pago.publico.ts`); B la importa de allí. Donde esta sección pide "verificar que la `FormaPago` exista y esté activa", el servicio debe invocar `verificarFormaPagoActiva(forma_pago_id)` (y `existeFormaPago()` para distinguir `FORMA_PAGO_NO_ENCONTRADA` de `FORMA_PAGO_NO_DISPONIBLE`) en lugar de leer la tabla `formas_pago`. **Sin cambios de ruta, permiso ni mensajes.** Los códigos se alinean con `spec_modulo_I.md` §2.4: una forma **inexistente** responde `404 FORMA_PAGO_NO_ENCONTRADA` y una forma **inactiva** `409 FORMA_PAGO_NO_DISPONIBLE`. El nombre de la forma de pago en el detalle (2.4) se resuelve con `obtenerFormaPago()`, que devuelve también las formas desactivadas (3.5).

**Ruta:** `PATCH /api/alumnos/[id]/forma-pago`
**Server Action equivalente:** `actualizarFormaPagoPreferida()` en `src/server/alumnos/actions.ts`
**Servicio:** `actualizarFormaPagoPreferida()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `alumnos:editar`

```typescript
export const FormaPagoPreferidaSchema = z.object({
  forma_pago_id: z.string().cuid().nullable(), // null = "Sin preferencia"
});
export type FormaPagoPreferidaInput = z.infer<typeof FormaPagoPreferidaSchema>;
```

**Modelo de referencia:** catálogo `FormaPago` (`id`, `nombre`, `is_active`), precargado por seed desde Sprint 1 con cuatro formas (`Efectivo`, `Transferencia`, `Débito`, `Mercado Pago`; ver `spec_modulo_I.md`, changelog, fila «Modelo `FormaPago`»; contenido exacto de `seed.ts`: a confirmar contra el código) — sin ningún campo de dato financiero.

**Comportamiento esperado:**
1. Si `forma_pago_id` no es `null`: verificar que la `FormaPago` exista y tenga `is_active: true` **en el momento de confirmar** (no basta con haber estado activa cuando se abrió el formulario). Si no existe (`existeFormaPago()` devuelve `false`): `404 FORMA_PAGO_NO_ENCONTRADA`. Si existe pero está inactiva: `409 FORMA_PAGO_NO_DISPONIBLE`, se informa el cambio. En ambos casos no se guarda.
2. Actualiza `Alumno.forma_pago_preferida_id`, reemplazando cualquier preferencia anterior (constraint: una sola preferencia por alumno, ya garantizado por ser un único campo FK nullable, no una tabla de relación N:M).
3. **Regla de no retroactividad (análoga a la de costeo del proyecto de referencia):** cambiar o quitar la preferencia **no** modifica ningún pago histórico — cada pago conserva la forma de pago con la que fue registrado (Módulo I, `spec_modulo_I.md`). El turno no lleva forma de pago (HU-C-11 retirada en el backlog v2): la forma de pago vive solo en el `Pago`. Este campo es únicamente el valor por defecto sugerido en operaciones futuras.
4. Emitir `alumno:forma_pago_actualizada` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "forma_pago_preferida_id": "cuid" }, "error": null }
```

**Errores esperados:** (los dos de la forma de pago, como en `spec_modulo_I.md` §2.4)
- `400 VALIDATION_ERROR` — `forma_pago_id` no es un CUID ni `null`.
- `404 ALUMNO_NO_ENCONTRADO` — la ficha `[id]` no existe (no estaba explicitado en esta sección; a confirmar contra el código).
- `404 FORMA_PAGO_NO_ENCONTRADA` — la forma no existe.
- `409 FORMA_PAGO_NO_DISPONIBLE` — la forma existe pero está inactiva.

---

### 2.4. Listado y detalle de alumnos (HU-B-04)

> **Revisión 3.** El listado y los campos del detalle **no cambian**. Cambian dos cosas, ambas mandadas por el backlog: `alumnos:leer` pasa a ser de Mesa de Entrada **y Gerente** (HU-E-02, criterio 8; el Profesor lo pierde, `PR-0.md` §2.9), y el detalle suma campos opcionales —`cuenta`, `historial_estados` y `forma_pago_preferida_activa`— descritos en 2.12. Los alumnos dados de baja siguen apareciendo, con la etiqueta «Inactivo» en la columna Estado.


> **Revisión 2 (Sprint 2).** `ListarAlumnosQuerySchema` agrega el parámetro opcional `q` (búsqueda de 2.7). **Definición única en 2.7** (`pagina`, `por_pagina` y `q`); acá no se repite. Sin `q`, el comportamiento y la respuesta son los de siempre.

**Ruta (listado):** `GET /api/alumnos`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarAlumnos()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `alumnos:leer`

**Parámetros de query:** `pagina` (default 1), `por_pagina` (máximo 20, default 20) y `q` opcional; el schema Zod `ListarAlumnosQuerySchema` se define **una sola vez, en 2.7**.

**Comportamiento esperado:**
- Incluye alumnos activos e inactivos (la columna Estado los distingue; no hay filtro de baja/reactivación en este sprint, ver "Fuera de alcance").
- Orden inicial: `apellido_normalizado, nombre_normalizado` ascendente (sin distinguir mayúsculas/acentos, misma utilidad `normalizarTexto()` de `spec_modulo_L.md`), `dni` como segundo criterio de desempate.
- Cada ítem: apellido, nombre, DNI, teléfono (`"—"` si ausente), email (`"—"` si ausente), estado.
- Paginación server-side con metadatos.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [{ "id": "cuid", "apellido": "Pérez", "nombre": "Ana", "dni": "30123456", "telefono": "+5493871234567", "email": "—", "is_active": true }],
    "paginacion": { "total": 48, "pagina_actual": 1, "total_paginas": 3, "por_pagina": 20 }
  },
  "error": null
}
```

**Ruta (detalle):** `GET /api/alumnos/[id]` — identidad, contacto, forma de pago preferida (nombre resuelto, no solo el id), estado, fecha de alta. Servicio: `obtenerAlumno()` en `alumno.service.ts` (nombre a confirmar contra el código); permiso `alumnos:leer`; Server Action: — (solo Route Handler).

**Errores esperados:**
- `400 VALIDATION_ERROR` — parámetros de query inválidos (`pagina`, `por_pagina` mayor a 20, `q`, ver 2.7).
- `404 ALUMNO_NO_ENCONTRADO` — detalle de una ficha inexistente (a confirmar contra el código).

---

### 2.5. Modificación de datos del alumno (HU-B-06)

> **Revisión 3.** **Sin cambios** de ruta, schema, pasos, concurrencia optimista ni códigos. Ya cambiaba el email de la cuenta vinculada con `actualizarEmailCuenta()`, y eso es lo que pide HU-A-06 (criterio 6). Se puede editar una ficha inactiva (3.14). Desde la pantalla, guardar pide la confirmación de HU-C-25 y avisa si cambia el email de ingreso (mapa DEC-15). `is_active` sigue sin ser editable desde este endpoint: la baja y la reactivación son 2.10 y 2.11.


**Ruta:** `PATCH /api/alumnos/[id]`
**Server Action equivalente:** `modificarAlumno()` en `src/server/alumnos/actions.ts`
**Servicio:** `modificarAlumno()` en `src/server/alumnos/alumno.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `alumnos:editar`

```typescript
export const ModificarAlumnoSchema = IdentidadAlumnoSchema.partial()
  .merge(ContactoAlumnoSchema.partial())
  .extend({
    forma_pago_id: z.string().cuid().nullable().optional(),
    version: z.number().int().nonnegative(), // control de concurrencia optimista — obligatorio, no opcional
  })
  .strict();
export type ModificarAlumnoInput = z.infer<typeof ModificarAlumnoSchema>;
```

**Paso previo (sin numerar, para no mover la numeración que citan otras specs):** dentro de la transacción, leer la ficha por `id`. Si no existe: `404 ALUMNO_NO_ENCONTRADO`. Así, `count === 0` en el paso 3 solo puede significar una edición concurrente.

**Comportamiento esperado:**
1. Si viene `dni`: validar unicidad excluyendo la propia ficha (`id != alumnoId`), contra activas e inactivas — mismo criterio que 2.1.
2. Si viene `email`: validar unicidad contra `Usuario.email` — mismo criterio que 2.2. Si la ficha ya tiene una cuenta vinculada (`Alumno.usuario_id` no nulo), el cambio de email **también actualiza `Usuario.email`** dentro de la misma transacción (ambas tablas son parte de la misma operación de negocio "cambiar el email de contacto/acceso del alumno" — no es una violación del aislamiento de Módulo A porque se invoca el servicio público `actualizarEmailCuenta()` de `src/server/usuarios/usuario.service.ts`, nunca un `UPDATE` directo sobre `Usuario`).
3. **Concurrencia optimista (Regla N.° 7 de `docs/RULES.md`, aplicada aquí a un `UPDATE` en lugar de un decremento de stock):**
   ```typescript
   const resultado = await tx.alumno.updateMany({
     where: { id: alumnoId, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, updated_at: new Date() },
   });
   if (resultado.count === 0) {
     throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
     // La existencia de la ficha ya se verificó en el «paso previo» (antes del paso 1),
     // así que count === 0 significa que alguien más la modificó entre que el cliente
     // cargó el formulario y confirmó (la `version` ya no coincide).
   }
   ```
4. Solo se escriben los campos efectivamente provistos en el payload (diff) — `id`, `is_active` y `created_at` nunca son editables desde este endpoint.
5. Emitir `alumno:actualizado` con `campos_modificados` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["telefono", "forma_pago_id"], "version": 4 }, "error": null }
```

**Respuesta `409 Conflict` (edición concurrente):**
```json
{ "data": null, "error": { "code": "CONFLICTO_EDICION_CONCURRENTE", "message": "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." } }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido (el schema es `.strict()` y `version` es obligatoria).
- `404 ALUMNO_NO_ENCONTRADO` — la ficha no existe («paso previo»).
- `409 DNI_DUPLICADO` — el `dni` nuevo pertenece a otra ficha (mismo criterio que 2.1).
- `409 EMAIL_YA_ASOCIADO` — el email nuevo pertenece a otra cuenta (mismo criterio que 2.2).
- `409 CONFLICTO_EDICION_CONCURRENTE` — la `version` ya no coincide.
- Si viene `forma_pago_id`: `404 FORMA_PAGO_NO_ENCONTRADA` / `409 FORMA_PAGO_NO_DISPONIBLE` como en 2.3 (a confirmar contra el código; esta sección no lo explicitaba).

---

### 2.6. Autorregistro del alumno (HU-B-08)

> **Revisión 3.** **Sin cambios de contrato.** El autorregistro no cambia: el alumno define su contraseña al registrarse y su cuenta **no** queda con la marca «Debe cambiar la contraseña» (HU-A-06, criterio 8). Una sola regla nueva, para las fichas dadas de baja (HU-B-07, criterio 5): si la ficha encontrada por DNI está **inactiva**, tenga o no cuenta, se responde `409 CUENTA_YA_EXISTE` con el mismo mensaje y cuerpo de la rama (c) (3.14). Hasta HU-B-07 no existían fichas inactivas, así que ningún caso de Sprint 1 cambia.


**Superficie pública** (sin sesión), accesible desde "Crear cuenta" del login. **Permiso requerido:** público (sin sesión; no pasa por `withPermission`), acotado por rate limit por IP.

**Ruta (paso 1 — registro):** `POST /api/auth/autorregistro`
**Server Action equivalente:** `iniciarAutorregistro()` en `src/server/alumnos/actions.ts` (antes citada en `app/(public)/autorregistro/actions.ts`, ubicación anterior a la Regla N.° 11; ubicación real: a confirmar contra el código)
**Servicio:** `iniciarAutorregistro()` en `src/server/alumnos/autorregistro.service.ts`

```typescript
export const AutorregistroAlumnoSchema = IdentidadAlumnoSchema
  .merge(ContactoAlumnoSchema.pick({ telefono: true }))
  .extend({
    email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254), // obligatorio acá, a diferencia de ContactoAlumnoSchema
    password: politicaPasswordSchema, // ver "Punto abierto" más abajo
    confirmacion_password: z.string(),
    acepta_terminos: z.literal(true, { errorMap: () => ({ message: "Debés aceptar los términos de uso y tratamiento de datos" }) }),
  })
  .refine((d) => d.password === d.confirmacion_password, {
    message: "Las contraseñas no coinciden", path: ["confirmacion_password"],
  })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0].toLowerCase()), {
    message: "La contraseña no puede contener tu email", path: ["password"],
  })
  .refine((d) => !d.password.includes(d.dni), {
    message: "La contraseña no puede contener tu DNI", path: ["password"],
  });
export type AutorregistroAlumnoInput = z.infer<typeof AutorregistroAlumnoSchema>;
```

**Política de contraseña (HU-B-08, Sprint 1, ya implementada):** el criterio de aceptación dice que la contraseña "cumple la política de seguridad configurada" y que no puede coincidir con el email ni con el DNI; no fija las reglas concretas. La HU está en Done, así que la política vigente es la que implementa el código. Los valores que esta spec proponía (mínimo 8 caracteres, una mayúscula, una minúscula y un número) eran una propuesta y **no son contrato**: la política real está **a confirmar contra el código** (ver pendientes de repo). No es un punto abierto para el PO.

**Comportamiento esperado (`src/server/alumnos/autorregistro.service.ts` → `iniciarAutorregistro`):**
1. Verificar rate limit por IP (tabla operativa `IntentoRegistro`, mismo patrón síncrono que `IntentoLoginFallido` de `spec_modulo_A.md` §3.3): máximo 5 registros por IP por hora.
2. Verificar que no exista ya un `Usuario` con ese `email` → si existe, `409 CUENTA_YA_EXISTE`, mensaje genérico: "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada."
3. Buscar `Alumno` por `dni`:
   - **(a) No existe ninguna ficha:** crear `Alumno` (mismos datos y validaciones que 2.1) **y** la cuenta `Usuario` (rol `ALUMNO`, vía el servicio público de Módulo A `crearCuentaConCredenciales()`) **en una única `prisma.$transaction`** — si cualquier parte falla, no se crea nada. Responde éxito directo (sin paso de verificación de código).
   - **(b) Existe una ficha con `usuario_id: null` (sin cuenta vinculada):** no se duplica la ficha. Si `Alumno.email` está registrado (dato de contacto ya cargado por Mesa de Entrada, HU-B-02) y coincide con el flujo esperado, se inicia el circuito de verificación por código (paso 2, abajo) contra ese email — **no** contra el email recién tipeado en el formulario, para no permitir que alguien reclame una ficha ajena usando un email propio. Se persiste una `SolicitudAutorregistro` (ver 3.6) con el `password_hash` ya calculado (bcrypt, costo 12, salt único — nunca en texto plano), pendiente de confirmación.
   - **(c) Existe una ficha con `usuario_id` ya asignado:** mismo tratamiento que (b)-existe-cuenta: `409 CUENTA_YA_EXISTE`, mismo mensaje genérico que el paso 2 (no distinguible desde el cliente).
   - **(d) Existe una ficha sin cuenta pero sin email verificable, o el email no coincide con el de contacto registrado:** se deriva a Mesa de Entrada **sin revelar cuál dato no coincidió ni información de la ficha existente**: "No pudimos completar el registro en línea. Acercate a mesa de entrada para vincular tu cuenta." (`200 OK` con este mensaje — no es un error, es el resultado esperado del flujo, igual que el resto de estas ramas no deben ser distinguibles entre sí por un atacante).
4. Registrar aceptación de términos (`AceptacionTerminos`: `version_terminos`, `fecha_hora`) — se persiste al momento de crear la cuenta (rama a) o al confirmar el código (rama b, ver 2.6 paso 2), nunca antes de que la cuenta exista realmente.
5. Emitir el evento correspondiente (sección 4) — como evento de seguridad, mismo canal de auditoría que Módulo A.

**Ruta (paso 2 — verificación de código, solo rama b):** `POST /api/auth/autorregistro/verificar-codigo`
**Server Action equivalente:** `confirmarCodigoAutorregistro()` (nombre a confirmar contra el código) en `src/server/alumnos/actions.ts`
**Servicio:** `confirmarCodigoAutorregistro(solicitudId, codigo)` en `src/server/alumnos/autorregistro.service.ts`
**Permiso requerido:** público (sin sesión)

```typescript
export const VerificarCodigoAutorregistroSchema = z.object({
  solicitud_id: z.string().uuid(),
  codigo: z.string().length(6).regex(/^\d{6}$/),
});
```

**Comportamiento esperado:**
1. Generación del código (al crear la `SolicitudAutorregistro` en el paso 1-b): 6 dígitos con `crypto.randomInt()` (RNG criptográficamente seguro). En base se persiste **solo** `HMAC-SHA256(codigo, CODIGO_OTP_SECRET)` — nunca el código en texto plano. `CODIGO_OTP_SECRET` es una variable de entorno (Regla N.° 9).
2. Verificación: recalcular el HMAC del `codigo` recibido y compararlo contra el almacenado con una función de **comparación en tiempo constante** (`crypto.timingSafeEqual`), nunca `===`.
3. Precondiciones: código no vencido (`expira_en > now`), intentos restantes `> 0` (se decrementa en cada intento fallido, tope configurable). Si falla cualquiera: error específico, sin revelar cuál parte del código estuvo mal.
4. Éxito: dentro de `prisma.$transaction`, crea el `Usuario` (vía `crearCuentaConCredenciales()` de Módulo A, usando el `password_hash` ya guardado en la solicitud), vincula `Alumno.usuario_id`, marca la `SolicitudAutorregistro` como consumida, registra `AceptacionTerminos`.
5. Emitir `alumno:autorregistro_completado` (vía = `VINCULACION_OTP`).

**Ruta (reenvío de código):** `POST /api/auth/autorregistro/reenviar-codigo`
**Servicio:** función de reenvío en `autorregistro.service.ts` (nombre a confirmar contra el código) · **Permiso requerido:** público (sin sesión)
- Invalida el código anterior (nuevo hash sobrescribe al anterior; el viejo deja de ser válido de inmediato, no solo al vencer).
- Rate limit: máximo 3 reenvíos por hora, mínimo 60 segundos entre reenvíos consecutivos.
- El email de destino se muestra siempre enmascarado en la respuesta (`j***@gmail.com`), nunca completo.

**Respuesta `200 OK` (registro directo, rama a):**
```json
{ "data": { "via": "DIRECTO", "email": "ana.perez@mail.com" }, "error": null }
```

**Respuesta `202 Accepted` (pendiente de verificación, rama b):**
```json
{ "data": { "via": "VERIFICACION_REQUERIDA", "solicitud_id": "uuid", "email_enmascarado": "a***@mail.com" }, "error": null }
```

**Respuesta `200 OK` (derivado a mesa de entrada, rama d — no es error):**
```json
{ "data": { "via": "DERIVADO_MESA_ENTRADA" }, "error": null }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido (`AutorregistroAlumnoSchema` o `VerificarCodigoAutorregistroSchema`).
- `409 CUENTA_YA_EXISTE` — ya hay un `Usuario` con ese email (paso 2) o la ficha ya tiene cuenta vinculada (rama c); mensaje genérico, indistinguible.
- Rate limit por IP excedido (registro: 5 por hora) o de reenvíos (3 por hora, 60 s entre reenvíos): código y status a confirmar contra el código (`spec_modulo_A.md` §3.3 usa `RATE_LIMIT_EXCEDIDO` para el login).
- Verificación de código fallida (código vencido, sin intentos restantes o incorrecto): error específico sin revelar qué parte falló; código y status a confirmar contra el código.
- La rama (d) no es un error: responde `200` con `via: "DERIVADO_MESA_ENTRADA"`.

---

### 2.7. Búsqueda de alumnos en el listado (HU-B-05) — NUEVA en Revisión 2

> **Revisión 3.** Comportamiento, orden, paginación y errores **sin cambios**. Dos precisiones: el permiso `alumnos:leer` ya no es «exclusivo de Mesa de Entrada»: lo tiene también el Gerente (2.12); y de las opciones (a) y (b) del párrafo «Criterio compartido con Turnos» se mantiene la **(b)**: el selector de HU-C-04 no cambia. El criterio por palabras que piden HU-I-10 y HU-C-26 se ofrece sin tocar ese selector ni su test (2.13, P-B8 y P-B9).


**Ruta:** la misma de 2.4, `GET /api/alumnos` — **no es una pantalla nueva**: un campo de búsqueda sobre `/alumnos` (mapa de pantallas §1, fila HU-B-05).
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarAlumnos()` con el filtro de `construirFiltroBusquedaAlumno()` (`src/server/alumnos/alumno.busqueda.ts`), en `alumno.service.ts` (nombre de la función de listado: a confirmar contra el código)
**Permiso requerido:** `alumnos:leer` (sin cambios: exclusivo de Mesa de Entrada)

```typescript
// src/server/alumnos/alumno.schema.ts — definición ÚNICA de ListarAlumnosQuerySchema (2.4 remite acá)
export const ListarAlumnosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
  q: z.string().trim().max(100).optional(), // HU-B-05
});
```

**Comportamiento esperado:**
1. Si `q` tiene menos de **2 caracteres** tras el `trim`, se **ignora** (equivale a no buscar). La UI no lo envía (AC1, umbral de 2 caracteres); la regla evita que un `q` de un carácter devuelva un listado engañoso.
2. Se normaliza con `normalizarTexto(q)` (minúsculas y sin acentos, la utilidad de `spec_modulo_L.md`) y se parte en **tokens** por espacios (máximo 5).
3. **Cada token** debe coincidir, de forma **parcial** (`contains`), con al menos uno de estos campos de la ficha: `apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno`, o `dniAlumno` cuando el token es solo dígitos. Entre tokens es **AND**; entre campos, **OR**. Así "juan perez" y "perez juan" encuentran a Juan Pérez (AC2, varias palabras en cualquier orden), "gom" encuentra "Gómez" y "Gomez" (AC1, coincidencia parcial sin distinguir mayúsculas ni acentos), y "3012" encuentra por DNI parcial (AC1, filtra por Apellido, Nombre o DNI).
4. La búsqueda opera sobre **alumnos activos e inactivos**, igual que el listado (AC de HU-B-04): el estado se sigue mostrando en la columna Estado.
5. El **orden es el del listado** (`apellidoNormalizadoAlumno`, `nombreNormalizadoAlumno`, `dniAlumno`), **no por relevancia** (AC7); la **paginación y el `total` son sobre el resultado filtrado**, no sobre el total (AC4). Sin `q` válido (texto borrado o de menos de 2 caracteres) se devuelve el listado completo, sin filtro y con el orden original apellido, nombre ascendente (AC6). El orden por defecto es el de 2.4.
6. Sin coincidencias: `200` con `items: []`. El mensaje "No se encontraron alumnos para «texto»" con la opción "Nuevo alumno" es responsabilidad de la UI (AC5): el texto se muestra tal como quedó tras el `trim`, y el acceso a "Nuevo alumno" (`alumnos:crear`) se conserva.

**Respuesta `200 OK`:** la misma de 2.4 (mismo formato de fila que el listado original, AC3).

**Errores esperados:**
- `400 VALIDATION_ERROR` — `pagina`, `por_pagina` (máximo 20) o `q` (máximo 100 caracteres) inválidos según `ListarAlumnosQuerySchema`. Un `q` de menos de 2 caracteres no es un error: se ignora.

**Comportamiento de la pantalla `/alumnos` (cliente) — AC3 y AC4:**
- **Actualización sin recargar la pantalla completa (AC3):** al escribir en el campo de búsqueda, el cliente llama a `GET /api/alumnos?q=<texto>&pagina=<n>&por_pagina=20` con un **debounce de 300 ms** contado desde la última tecla, y reemplaza solo la tabla de resultados y el paginador. No hay navegación ni recarga de la página completa. Mientras la petición está en curso se muestra un **estado de carga** en la zona de resultados; el campo de búsqueda no se deshabilita ni pierde el foco. Si llega la respuesta de una petición anterior a la última enviada, se descarta: solo cuenta la del texto vigente. (Los 300 ms son una decisión de diseño de esta spec: el AC no fija milisegundos.)
- **Página 1 al cambiar el texto (AC4):** cada vez que cambia el texto de búsqueda, la petición pide `pagina=1`. Cambiar de página con el paginador conserva `q` y navega sobre el resultado filtrado (`total` y `total_paginas` son los del filtrado).
- **Umbral y borrado (AC1, AC6):** con menos de 2 caracteres tras el `trim` (incluido el campo vacío) el cliente no envía `q` y pide el listado completo, también en `pagina=1`.

**Fuera de alcance:** filtros combinados por estado, forma de pago u otro criterio (AC8), búsqueda por email o teléfono, ordenamiento por relevancia, autocompletado del servidor.

**Criterio compartido con Turnos:** el selector de alumnos de HU-C-04 (`buscarAlumnosActivos(query)`, en `alumno.service.ts`) usa **el mismo umbral y la misma normalización** (mínimo 2 caracteres, normalizado, parcial), pero devuelve **solo activos y como máximo 10 resultados**. **Diferencia real que hay que respetar:** hoy el selector busca el **texto completo** contra nombre, apellido y DNI con un único `OR` (sin tokens), y `alumno.busqueda.test.ts` mockea exactamente esa forma (`where.OR`). Con un solo token, el filtro de tokens de 2.7 da el mismo resultado; con varios ("juan perez") el selector actual **no** encuentra nada. Se extrae `construirFiltroBusquedaAlumno(q)` en `src/server/alumnos/alumno.busqueda.ts` y, para no romper el selector ya verificado en Sprint 1, el desarrollador elige: (a) que el selector lo adopte y se actualice ese test, o (b) dejar el selector como está y agregar un test de paridad para un solo token. Cualquiera de las dos es válida; lo que no se admite es que diverjan sin test.

---

### 2.8. Servicios públicos del módulo (Regla N.° 3) — NUEVA en Revisión 2

> **Revisión 3.** La tabla **no cambia**: ninguna función conserva menos que antes. Las funciones nuevas de B y las lecturas que B consume de otros módulos están en 2.13. `alumno.publico.ts` sigue sin importar módulos de dominio.


Conforme a la Regla N.° 3: se declaran en `src/server/alumnos/alumno.publico.ts`. **No importa nada de otros módulos.** El parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador.

**Qué puede importar `alumno.publico.ts` (precisión del 29/09/2026):** `@prisma/client` (solo tipos), `@/lib/prisma`, `@/server/shared/*`, `@/types/alumno.types` y, únicamente para **reexportar** funciones existentes con la firma de esta tabla, el service de su propio módulo (`@/server/alumnos/alumno.service`, siempre con el alias `@/`, Regla N.° 11). También puede importar **utilidades puras de `src/lib/`** (sin `prisma` ni imports de `src/server/**`). Nada de otros módulos de dominio; lo verifica `src/server/publico.aislamiento.test.ts`.

| Función | Devuelve | Consumidores |
|---|---|---|
| `obtenerAlumnoDeUsuario(usuarioId, db?)` | `{ id, activo } \| null`: la ficha vinculada a la cuenta (`Alumno.usuarioId`) | `spec_modulo_C.md` §2.14 (autoservicio) |
| `obtenerAlumnosBasicos(ids, db?)` | `{ id, nombre, apellido, dni, activo, forma_pago_preferida_id }[]` (lote, activos o inactivos, ids inexistentes simplemente no aparecen). `forma_pago_preferida_id` es `null` si el alumno está "Sin preferencia" | `spec_modulo_I.md` §2.3 (`listarPagosDeTurno`), §2.4 y §2.5 (alumno que paga y forma de pago propuesta); `spec_modulo_E.md` §2.1 (`GET` del registro de clase: nombres de los inscriptos, en lote) |
| `obtenerAlumnoBasico(id, db?)` | `{ id, nombre, apellido, activo } \| null`, activo o inactivo | `spec_modulo_E.md` §2.3 (nombre del alumno en el historial; E la cita también en su §3.5) |
| `verificarAlumnoActivo(alumnoId, db?)` | `Promise<void>`. Verifica que la ficha exista y esté activa, **distinguiendo** los dos fallos con los códigos `ALUMNO_NO_ENCONTRADO` (no existe) y `ALUMNO_INACTIVO` (existe con `activo = false`), lanzados como `ServiceError`; ver «Códigos de `verificarAlumnoActivo()`» abajo. **Versión pública nueva (29/09/2026):** `alumno.service.ts` conserva su `verificarAlumnoActivo` interna, que devuelve `boolean` y sigue usando Turnos hasta que migre | `spec_modulo_C.md` §2.2, §2.5; `spec_modulo_E.md` §2.2. **No** lo consume C §2.14 (autoservicio: usa el `activo` de `obtenerAlumnoDeUsuario()`) |
| `buscarAlumnosActivos(query)` | `{ id, nombre, apellido, dni }[]`, solo activos, máximo 10; activación desde 2 caracteres, coincidencia parcial sobre columnas normalizadas (**existente de Sprint 1**, `alumno.service.ts`; ver «Criterio compartido con Turnos» en 2.7) | `spec_modulo_C.md` §2.5 |
| ~~`contarAlumnosNuevosPorMes(desde, hasta, db?)`~~ — **RETIRADA el 01/10/2026** | `{ mes: "YYYY-MM", cantidad }[]`, **solo los meses con datos** (los ceros los completa H) | ~~`spec_modulo_H.md` §2.1~~: sin consumidores desde la Revisión 2 de H (HU-H-02 original reemplazada por la tasa de ocupación) |

**Códigos de `verificarAlumnoActivo()`:** ficha inexistente → `ALUMNO_NO_ENCONTRADO`; ficha existente inactiva → `ALUMNO_INACTIVO`; activa → resuelve sin error. Lo que esta spec contractualiza es la **distinción** de ambos casos con esos códigos (B es quien la resuelve, para que los consumidores no la reimplementen leyendo `alumnos`). Se propagan como `ServiceError` con ese `code` (mensajes internos «El alumno ya no existe» y «El alumno está inactivo»; el consumidor decide qué mostrar). Resuelto el 29/09/2026. La traducción a HTTP es del consumidor: `spec_modulo_E.md` §2.2 responde `404 ALUMNO_NO_ENCONTRADO` / `409 ALUMNO_INACTIVO`; C §2.2 y §2.5 rechazan e informan cuál alumno es inválido.

**`contarAlumnosNuevosPorMes`** *(retirada el 01/10/2026, se conserva como historial)***:** `desde` y `hasta` son meses `AAAA-MM`. Cuenta **todas** las fichas (activas o inactivas, con o sin cuenta de acceso) agrupadas por el mes de `createdAtAlumno` **en `America/Argentina/Buenos_Aires`**, no en UTC. Implementación con `$queryRaw` parametrizado (`Prisma.sql`, nunca SQL concatenado). **Fórmula corregida el 29/09/2026:** `createdAtAlumno` es `TIMESTAMP(3)` **sin zona** y se guarda en UTC, por lo que primero se lo interpreta como UTC y después se lo convierte a la zona del centro: `to_char(("createdAtAlumno" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM')`. El filtro compara ese `AAAA-MM` como texto, inclusivo en ambos extremos (`mes >= desde AND mes <= hasta`), con `GROUP BY mes ORDER BY mes`. Antes de consultar valida que `desde` y `hasta` tengan formato `AAAA-MM` y que `desde <= hasta`; es una defensa: la validación de negocio (rango máximo, meses futuros) es del módulo H. Un alta hecha a las `2026-10-01T01:30:00Z` (30/09 22:30 en Buenos Aires) cuenta en `2026-09`.

---

### 2.9. Alta del alumno con cuenta de acceso (HU-A-06 con HU-B-01) — NUEVA en Revisión 3

**Qué resuelve.** Cuando Mesa de Entrada registra a un alumno, la ficha y la cuenta de acceso se crean **en la misma transacción**: el usuario es el email, la contraseña inicial es el DNI y la cuenta queda marcada «Debe cambiar la contraseña» (HU-A-06, criterios 1, 2, 3 y 5). La cuenta y la marca son de A (`spec_modulo_A.md` 2.6); B solo las pide.

**Ruta:** la de 2.1, `POST /api/alumnos` · **Server Action equivalente:** `crearAlumno()` (la de 2.1) · **Servicio:** `crearAlumno()` en `alumno.service.ts` (el de 2.1; nombre a confirmar contra el código) · **Permiso requerido:** `alumnos:crear` (sin cambios).

No hay ruta nueva: el cuerpo de 2.1 suma dos campos **opcionales**.

```typescript
// src/server/alumnos/alumno.schema.ts (se agrega; IdentidadAlumnoSchema no se modifica)
export const RegistrarAlumnoSchema = IdentidadAlumnoSchema.extend({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254).optional(), // HU-A-06 c1; la pantalla lo exige (P-B1)
  telefono: z.string().trim().optional(),                                                     // pasa a ser opcional
});
export type RegistrarAlumnoInput = z.infer<typeof RegistrarAlumnoSchema>;
```

**Comportamiento esperado.**
- **Sin `email`:** exactamente el comportamiento de 2.1, pasos 1 a 5. No se crea cuenta (la ficha queda «Sin cuenta»). Es el camino que usan los tests y las colecciones de Sprint 1 y 2.
- **Con `email`:** se valida además `telefono` si vino (`normalizarTelefono()`, 8 a 15 dígitos, igual que 2.2) y se sigue este orden:
  1. Unicidad del DNI contra todas las fichas, activas e inactivas (2.1, pasos 1 y 2): `409 DNI_DUPLICADO`.
  2. En **una única `transaccion`** (PR 0 §2.16):
     1. Revalidar el DNI (2.1, paso 3).
     2. `crearCuentaParaFicha(tx, { email, dni, rol: "ALUMNO", ip })` (A, 2.6.1): crea el `Usuario` con el DNI como contraseña inicial —guardada solo como hash—, la marca `debeCambiarPassword` y el evento de seguridad `CUENTA_CREADA`. Si el email ya pertenece a otra cuenta: `409 EMAIL_YA_ASOCIADO`, sin revelar de quién, y no se crea nada.
     3. Insertar el `Alumno` con `usuarioId` = la cuenta creada, `emailAlumno` y `telefonoAlumno`, `activoAlumno = true`, `version = 0` y el usuario registrante (2.1, paso 4).
  3. Si la inserción falla por el índice único del DNI (`P2002`), el error se captura **fuera** de la transacción —que ya se deshizo— y se traduce al mismo `409 DNI_DUPLICADO`. La cuenta no queda creada: **si no se puede crear la cuenta tampoco se registra la ficha, y al revés** (HU-A-06, criterio 2).
  4. Emitir `alumno:creado` (4), después del commit.
- El rol lo fija B (`ALUMNO`); nunca viene del cliente (criterio 2).
- La ficha **no** crea cuentas retroactivas: modificar una ficha anterior, aunque se le cargue un email, no crea su cuenta (HU-A-06, criterio 8; P-B16).

**Respuesta `201 Created`:** la de 2.1 más un campo extra opcional.
```json
{ "data": { "id": "cuid", "nombre": "Ana", "apellido": "Pérez", "dni": "30123456", "is_active": true,
            "cuenta": { "creada": true, "debe_cambiar_password": true } }, "error": null }
```
Sin `email`, `cuenta` es `{ "creada": false }`. El DNI que ya devolvía 2.1 es el único dato personal de la respuesta; **nunca** se devuelve ni se registra la contraseña inicial (3.15).

**Pantalla (`/alumnos/nuevo`, P-29).** El formulario de HU-B-01 suma el campo **Email**, obligatorio, con la ayuda «Ingresá el email: con él se crea la cuenta de acceso», y deja el **Teléfono** como opcional. Antes de guardar pide la confirmación de HU-C-25. Al terminar muestra «Alumno registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.» (HU-A-06, criterio 5; los textos van al archivo central, HU-C-23). El aviso de email en uso no revela a quién pertenece.

**Errores esperados** (se suman a los de 2.1):
- `400 VALIDATION_ERROR` — `email` inválido o `telefono` fuera de 8 a 15 dígitos.
- `409 EMAIL_YA_ASOCIADO` — el email pertenece a otra cuenta; se muestra junto al campo, sin revelar a quién.
- `409 DNI_DUPLICADO` — como en 2.1.
- `409 TRANSACCION_OCUPADA` — la transacción no pudo tomar sus bloqueos (PR 0 §2.16).

**Carreras (Regla N.° 7).** Dos altas con el mismo email: A resuelve con `INSERT … ON CONFLICT DO NOTHING RETURNING`, una gana y la otra recibe `409 EMAIL_YA_ASOCIADO`. Dos altas con el mismo DNI: gana la del índice único y la otra recibe `409 DNI_DUPLICADO`, sin cuenta huérfana (la transacción se deshace entera).

---

### 2.10. Desactivar un alumno (HU-B-07, criterios 1 a 4, 6 y 8) — NUEVA en Revisión 3

**Qué resuelve.** Mesa de Entrada da de baja a un alumno que deja de asistir: la ficha pasa a inactiva (baja lógica, Regla N.° 1), se lo quita de sus clases futuras, su cuenta se desactiva y sus sesiones se cierran. Todo lo ya registrado —clases pasadas, clases dictadas, exámenes y pagos— queda como está.

**Archivos (Regla N.° 11):** `src/server/alumnos/alumno.estado.service.ts` (`obtenerImpactoBajaAlumno`, `desactivarAlumno`, `reactivarAlumno`; T7), schemas en `alumno.schema.ts` (se agregan), Route Handlers en `app/api/alumnos/[id]/desactivar/route.ts`, `app/api/alumnos/[id]/reactivar/route.ts` y `app/api/alumnos/[id]/impacto-baja/route.ts`, Server Actions en `src/server/alumnos/actions.ts` (se agregan), tipos en `src/types/alumno.types.ts`. Ninguna ruta ni función existente se mueve.

#### 2.10.1. Qué se pierde al desactivar — la confirmación (criterio 1)

**Ruta:** `GET /api/alumnos/[id]/impacto-baja` · **Servicio:** `obtenerImpactoBajaAlumno(id)` · **Permiso requerido:** `alumnos:cambiar_estado` · **Server Action equivalente:** — (solo Route Handler)

Devuelve lo que muestra la confirmación M-21. Es **informativo**: el servidor lo recalcula al confirmar (2.10.2).

**Comportamiento esperado.**
1. La ficha debe existir (`404 ALUMNO_NO_ENCONTRADO`) y estar activa (`409 ALUMNO_YA_INACTIVO`).
2. Inscripciones a clases futuras: `listarInscripcionesDeAlumno(id, { desde: <hoy> })` (módulo C, R2-PR0-3 de `spec_modulo_E.md`), de las que se conservan las que cumplen **las tres** condiciones: `vigente_ahora` (una reserva sin pagar ya vencida **no** cuenta, P-B14), clase en estado `DISPONIBLE` o `COMPLETO`, e inicio **posterior** al momento actual en la zona del centro (una clase en curso ya no es futura, convención 4). Orden: fecha y hora ascendentes, `inscripcion_id`.
3. `motivo_obligatorio`: verdadero si el alumno tiene registros (2.13, `tieneRegistrosAlumno`).

```json
{ "data": {
    "alumno": { "id": "cuid", "nombre": "Ana", "apellido": "Pérez" },
    "total": 2,
    "inscripciones_futuras": [
      { "inscripcion_id": "cuid", "turno_id": "cuid", "fecha": "2026-10-14", "hora_inicio": "10:00", "hora_fin": "11:00",
        "materia": { "id": "cuid", "nombre": "Inglés" }, "profesor": { "id": "cuid", "nombre_para_mostrar": "Gómez, Laura" } }
    ],
    "motivo_obligatorio": true
  }, "error": null }
```
La interfaz arma con esto el texto del criterio 1: «¿Estás seguro de que querés desactivar a <alumno>? Está inscripto en N clases futuras: al desactivarlo se lo quitará de esas clases y esas inscripciones no se restaurarán si lo reactivás.», con la lista (fecha, hora, materia, profesor). Con `total = 0` usa el patrón de HU-C-25 con los datos del alumno. **No** dice «Esta acción no se puede deshacer.» (la baja es reversible, HU-C-25 c4). `profesor` puede ser `null`.

**Errores esperados:** `401 SESION_INVALIDA` · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO` · `409 ALUMNO_YA_INACTIVO`.

#### 2.10.2. Desactivar (criterios 2, 3, 4, 6 y 8)

**Ruta:** `POST /api/alumnos/[id]/desactivar` · **Server Action equivalente:** `desactivarAlumno()` en `src/server/alumnos/actions.ts` · **Servicio:** `desactivarAlumno(id, input, actor)` en `alumno.estado.service.ts` · **Permiso requerido:** `alumnos:cambiar_estado` (solo Mesa de Entrada; cualquier otro rol recibe `403 SIN_PERMISO`, criterio 8).

```typescript
// src/server/alumnos/alumno.schema.ts (se agrega)
export const DesactivarAlumnoSchema = z.object({
  motivo: z.string().trim().max(300).optional(),   // vacío = no enviado; hasta 300 caracteres
  version: z.number().int().nonnegative(),
}).strict();
```

**Comportamiento esperado, en una única `transaccion` (PR 0 §2.16), con los bloqueos en el orden de `PR-0.md` §2.10 (recurso → clase → inscripción):**
1. **Bloquear la ficha** con `SELECT … FOR UPDATE` (el alumno es un recurso, nivel 1). Es el **mismo bloqueo** que toma toda operación que inscribe (HU-C-04, C-18, C-12/C-20, la excepción de C-24 y el cobro de HU-I-10): una baja y una inscripción simultáneas no pueden confirmarse las dos (criterio 2, última viñeta; Regla N.° 7). Las operaciones que inscriben vuelven a leer `activoAlumno` **después** de bloquear (3.13).
2. La ficha debe existir (`404 ALUMNO_NO_ENCONTRADO`), estar activa (`409 ALUMNO_YA_INACTIVO`) y tener la `version` recibida (`409 CONFLICTO_EDICION_CONCURRENTE`).
3. **Motivo:** si `tieneRegistrosAlumno` (2.13) es verdadero y no vino `motivo`: `400 MOTIVO_REQUERIDO` (criterio 1; Regla N.° 1). Si no tiene registros, el motivo es opcional.
4. Cambiar el estado con condición atómica (Regla N.° 7), igual que 3.3:
   ```typescript
   const r = await tx.alumno.updateMany({
     where: { idAlumno: id, activoAlumno: true, version: input.version },
     data: { activoAlumno: false, version: { increment: 1 }, modificadoPorUsuarioId: actor.usuarioId },
   });
   if (r.count === 0) throw new ErrorDeDominio("errores.general.conflictoEdicion");
   ```
5. **Quitarlo de sus clases futuras:** `darDeBajaInscripcionesDeAlumno(tx, { alumnoId: id, actor })` (módulo C, 2.13). C bloquea las clases implicadas (por id ascendente) y sus inscripciones, y por cada clase **futura `DISPONIBLE` o `COMPLETO`**:
   - marca antes como `RESERVA_VENCIDA` las reservas ya vencidas del alumno (`marcarVencidasDelAlumno`), que **no** cuentan como baja;
   - finaliza cada inscripción vigente —pagada o reservada— con la vigencia **`BAJA_ALUMNO`**, con la fecha y el usuario (no se borra: queda para el historial de HU-E-02 y la serie «Bajas» de HU-H-10);
   - recalcula el estado de la clase: la que estaba `COMPLETO` vuelve a `DISPONIBLE` (regla de cupo vigente).
   No toca: las inscripciones a clases pasadas o en curso, las clases dictadas, los exámenes, los pagos, ni las clases `PENDIENTE` (que al continuar su configuración rechazan al alumno inactivo, 3.14).
6. **Cuenta:** si la ficha tiene `usuarioId`, `desactivarCuenta(tx, usuarioId)` (módulo A, 2.9): la cuenta pasa a inactiva y se revocan **todas** sus sesiones (`sesionesValidasDesde = ahora`, RNF-SEG-04; mismo mecanismo que HU-D-08, criterio 4). Al intentar ingresar recibe el mensaje de cuenta inactiva de HU-A-01 («La cuenta está inactiva. Comunicate con la administración»). Una ficha sin cuenta se desactiva igual.
7. `registrarCambioEstado(tx, { entidad: "ALUMNO", id, accion: "DESACTIVAR", motivo, actor })` (PR 0 §2.13). El servicio compartido lo encola en `despuesDelCommit`: se escribe **después** de confirmada la transacción (Regla N.° 2, opción (b); criterio 2).

**Pagos (criterio 6).** No se modifican. Si el centro devuelve dinero de una clase de la que se lo quitó, lo registra anulando el pago con el motivo «Reintegro» (HU-I-06, criterio 6; verificación diferida hasta HU-I-06). Esta spec no toca pagos ni cajas.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "activo": false, "version": 5, "inscripciones_quitadas": 2 }, "error": null }
```
La interfaz muestra «Alumno desactivado correctamente» (criterio 4). El alumno sigue en el listado (2.4) y en la búsqueda (2.7) con la etiqueta «Inactivo», y deja de ofrecerse al inscribir (`buscarAlumnosActivos` y `verificarAlumnoActivo`, sin cambios).

**Errores esperados:**
- `400 VALIDATION_ERROR` · `400 MOTIVO_REQUERIDO` (texto a definir en el archivo central, HU-C-23).
- `401 SESION_INVALIDA` · `403 SIN_PERMISO`.
- `404 ALUMNO_NO_ENCONTRADO`.
- `409 ALUMNO_YA_INACTIVO` · `409 CONFLICTO_EDICION_CONCURRENTE` · `409 TRANSACCION_OCUPADA`.

Si el servidor rechaza la baja, el motivo se muestra dentro del mismo modal (HU-C-25 c6). Es una operación reversible: su confirmación no lleva «Esta acción no se puede deshacer.», pero **sí** explica el efecto que no se restaura (criterio 1).

---

### 2.11. Reactivar un alumno (HU-B-07, criterio 7) — NUEVA en Revisión 3

**Ruta:** `POST /api/alumnos/[id]/reactivar` · **Server Action equivalente:** `reactivarAlumno()` en `src/server/alumnos/actions.ts` · **Servicio:** `reactivarAlumno(id, input, actor)` en `alumno.estado.service.ts` · **Permiso requerido:** `alumnos:cambiar_estado` (solo Mesa de Entrada).

```typescript
export const ReactivarAlumnoSchema = z.object({ version: z.number().int().nonnegative() }).strict();
```

**Comportamiento esperado, en una única `transaccion`:**
1. Bloquear la ficha (`FOR UPDATE`, nivel 1). Debe existir (`404 ALUMNO_NO_ENCONTRADO`), estar inactiva (`409 ALUMNO_YA_ACTIVO`) y tener la `version` recibida (`409 CONFLICTO_EDICION_CONCURRENTE`).
2. `updateMany` con condición atómica (`activoAlumno = false` y `version`): `activoAlumno = true`, `version + 1`, `modificadoPorUsuarioId`.
3. Si tiene `usuarioId`: `reactivarCuenta(tx, usuarioId)` (módulo A). **No** se restauran las sesiones revocadas en la baja: debe iniciar sesión de nuevo. La marca `debeCambiarPassword` se conserva tal como estaba (HU-A-06, criterio 7): quien nunca cambió la contraseña inicial sigue obligado.
4. `registrarCambioEstado(tx, { entidad: "ALUMNO", id, accion: "REACTIVAR", actor })`, después del commit. Se conservan todas las bajas y reactivaciones del historial.
5. **No se restauran** las inscripciones que se le quitaron: su lugar pudo haberse ocupado. Siguen como `BAJA_ALUMNO`. El alumno vuelve a ofrecerse al inscribir (HU-C-04, C-18, C-12) y debe inscribirse de nuevo si corresponde.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "activo": true, "version": 6 }, "error": null }`. La interfaz pide la confirmación «¿Estás seguro de que querés reactivar a <alumno>?» (reversible, sin motivo) y, al terminar, muestra «Alumno reactivado correctamente» y «Las inscripciones anteriores no se restauran. Inscribilo de nuevo si corresponde.» (criterio 7). En «Mis clases» (HU-C-13) las inscripciones quitadas siguen mostrándose como «Inscripción dada de baja por el centro» (la etiqueta es de C).

**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO` · `404 ALUMNO_NO_ENCONTRADO` · `409 ALUMNO_YA_ACTIVO` · `409 CONFLICTO_EDICION_CONCURRENTE` · `409 TRANSACCION_OCUPADA`.

El DNI y el email del alumno inactivo **siguen contando para la unicidad** (3.14): reactivar no puede chocar con un alta nueva.

---

### 2.12. Ficha del alumno en el Sprint 3: cuenta de acceso, historial de estados y consulta del Gerente (HU-A-06 c5 y c7, HU-B-07, HU-E-02 c8) — NUEVA en Revisión 3

**Ruta:** las de 2.4, `GET /api/alumnos` y `GET /api/alumnos/[id]` · **Servicio:** `listarAlumnos()` y `obtenerAlumno()` (los de 2.4) · **Permiso requerido:** `alumnos:leer`, que desde el Sprint 3 tienen **Mesa de Entrada y Gerente** (T8). El Profesor y el Alumno reciben `403 SIN_PERMISO`.

**Qué no cambia.** El listado (2.4 y 2.7) es el mismo, con la misma respuesta: los inactivos ya figuraban con la columna Estado, y ahora esa etiqueta también los alcanza a los que da de baja HU-B-07 (criterio 4). El detalle conserva todos sus campos.

**Campos opcionales nuevos del detalle** (`GET /api/alumnos/[id]`):
```json
{ "data": {
    "…": "campos de hoy sin cambios",
    "forma_pago_preferida_activa": true,
    "cuenta": { "estado": "ACTIVA", "email": "ana.perez@mail.com", "rol": "ALUMNO", "debe_cambiar_password": true },
    "historial_estados": [
      { "fecha": "2026-10-12T14:03:00-03:00", "accion": "DESACTIVAR", "usuario": { "id": "cuid", "nombre_para_mostrar": "Ruiz, Marta" }, "motivo": "Se mudó" }
    ]
  }, "error": null }
```
- **`cuenta`** (HU-A-06, criterio 5): sale de `obtenerResumenCuenta(alumno.usuarioId)` (módulo A, 2.9). `estado` es `ACTIVA`, `INACTIVA` (la ficha está dada de baja, criterio 7) o `SIN_CUENTA` (ficha anterior a HU-A-06 o creada sin email: DEC-14, sin acción para crearla). La interfaz escribe «Activa · debe cambiar la contraseña» (con la marca), «Activa», «Inactiva» o «Sin cuenta». Nunca trae el hash.
- **`historial_estados`**: `listarHistorialEstados("ALUMNO", id)` (servicio compartido, R3-PR0-B2), del más reciente al más antiguo; `usuario` se resuelve en lote con `obtenerNombresPersonal` (spec F, P-B7) y puede ser `null`. Lo ven los mismos roles que pueden abrir la ficha (DEC-37).
- **`forma_pago_preferida_activa`**: `true`, `false` o `null` (sin preferencia). Sale de `obtenerFormaPago()` (módulo I), que devuelve también las formas desactivadas; con `false` la interfaz muestra la etiqueta «Inactiva» junto al nombre (HU-I-07, criterio 5). La preferencia se conserva: 2.3 y 3.5 no cambian.

**Modo consulta del Gerente (HU-E-02, criterio 8).** El Gerente ve el listado, la búsqueda y la ficha (Datos, Clases, Historial académico y Pagos, estas tres de E e I). No tiene `alumnos:crear`, `alumnos:editar` ni `alumnos:cambiar_estado`: toda escritura de este módulo le responde `403 SIN_PERMISO`, igual que hoy. La interfaz oculta «Editar», «Desactivar alumno», «Reactivar» y «Nuevo alumno» según el permiso de cada acción. Mesa de Entrada conserva exactamente lo que tiene hoy.

**Pantallas (mapa P-24 y P-25).** Etiqueta «Inactivo» en la cabecera, el listado y la búsqueda; en la cabecera, «Desactivar alumno» si está activo y «Reactivar» si está inactivo (solo con `alumnos:cambiar_estado`), más «Editar»; cambiar de pestaña no pide confirmación (HU-C-25 c5). Sección «Cuenta de acceso» y «Historial de estados» en la pestaña Datos. Los textos van al archivo central (HU-C-23).

---

### 2.13. Servicios públicos del módulo en el Sprint 3 (Regla N.° 3) — NUEVA en Revisión 3

Complementa 2.8, cuyas funciones **no cambian de firma ni de resultado**. Las nuevas de B se declaran en `src/server/alumnos/alumno.publico.ts`, que sigue **sin importar nada de otros módulos** (T7); solo leen la tabla `alumnos`. La orquestación de la baja (2.10 y 2.11) está en `alumno.estado.service.ts`, que no forma parte de la fachada.

#### 2.13.1. Lo que B agrega a su fachada

| Función | Devuelve | Consumidores |
|---|---|---|
| `contarAlumnosConFormaPagoPreferida(formaPagoId, db?)` | `number`: cantidad de fichas —**activas e inactivas**, P-B10— con esa forma de pago como preferida. Lectura sin bloqueo (`count` sobre `formaPagoPreferidaId`) | `spec_modulo_I.md` (HU-I-07: `GET /api/formas-pago/[id]/impacto`) |
| `construirFiltroBusquedaAlumno(q)` | `Prisma.AlumnoWhereInput \| null`. Función **pura**: el filtro de 2.7 (normalizado, parcial, tokens en AND, campos en OR). `null` si `q` tiene menos de 2 caracteres tras el `trim` (equivale a no buscar). Se publica para que ningún otro módulo repita las columnas normalizadas (P-B9) | `spec_modulo_C.md` (HU-C-26: filtro por alumno) |
| `buscarAlumnosActivos(query, opciones?)` | **La misma función de 2.8.** Sin `opciones`, comportamiento y resultado de Sprint 1 (texto completo contra nombre, apellido y DNI con un único `OR`; `alumno.busqueda.test.ts` no cambia). Con `{ porPalabras: true }` aplica `construirFiltroBusquedaAlumno`: varias palabras en cualquier orden. Siempre solo activos, máximo 10, `{ id, nombre, apellido, dni }[]` (P-B8) | Sin `opciones`: `spec_modulo_C.md` §2.5 (selector de HU-C-04). Con `{ porPalabras: true }`: `spec_modulo_I.md` (`buscarAlumnosParaCobro`, HU-I-10, criterio 2) |

`verificarAlumnoActivo(alumnoId, db?)` (2.8) no cambia. Para que HU-B-07 funcione hay que **llamarla después de bloquear la ficha**: bajo `READ COMMITTED` la lectura posterior al `FOR UPDATE` ve el valor confirmado por la baja (3.13).

#### 2.13.2. Lo que B consume de otros módulos

| Función | Dueño | Para qué la usa B | Estado |
|---|---|---|---|
| `crearCuentaParaFicha(tx, { email, dni, rol, ip? })` | A (`cuenta.service.ts`) | Alta con cuenta (2.9) | `spec_modulo_A.md` 2.9 |
| `actualizarEmailCuenta(...)` | A (`usuario.service.ts`) | Email de la ficha → cuenta (2.2 y 2.5) | **Existente** |
| `desactivarCuenta(tx, usuarioId)` y `reactivarCuenta(tx, usuarioId)` | A | Baja y reactivación (2.10 y 2.11) | `spec_modulo_A.md` 2.9 |
| `obtenerResumenCuenta(usuarioId \| null, db?)` | A | Sección «Cuenta de acceso» (2.12) | `spec_modulo_A.md` 2.9 |
| `listarInscripcionesDeAlumno(alumnoId, { desde?, hasta? }, db?)` | C | Lista de la confirmación (2.10.1) | `PR-0.md` §2.13; `spec_modulo_E.md` R2-PR0-3 |
| `darDeBajaInscripcionesDeAlumno(tx, { alumnoId, actor })` | C (`inscripcion.publico.ts`) | Quitarlo de sus clases futuras (2.10.2, paso 5) | **Nueva**, ver abajo |
| `alumnoTieneRegistros(alumnoId, db?)` | C, I, E (cada fachada) | Motivo obligatorio (2.10.2, paso 3) | **Nuevas**, ver abajo |
| `registrarCambioEstado(tx, …)` y `listarHistorialEstados(entidad, id, db?)` | compartido | Historial de estados | `PR-0.md` §2.13; la lectura la publica el PR 0 (R7-PR0-1), no una HU |
| `obtenerNombresPersonal(usuarioIds, db?)` | F | Quién hizo cada cambio de estado | `spec_modulo_F.md` §2.7 |
| `obtenerFormaPago(id, db?)` | I | Etiqueta «Inactiva» (2.12) | **Existente** (`spec_modulo_I.md`) |
| `transaccion`, `bloquear`, `ahora()` | PR 0 | Transacción, bloqueos y reloj | `PR-0.md` §2.16 y §2.13 |

**`darDeBajaInscripcionesDeAlumno(tx, { alumnoId, actor })`** → `{ quitadas: { inscripcion_id, turno_id }[], reservas_vencidas_marcadas: number }`. La agrega el PR de HU-B-07 en la fachada de C (`PR-0.md` §2.13). Condiciones:
- **El llamador ya tiene bloqueada la ficha del alumno** (nivel 1). C toma, en **una sola** llamada a `bloquear`, las clases candidatas por id ascendente y sus inscripciones (niveles 2 y 3), sin volver a bloquear hacia atrás.
- Las clases candidatas se leen antes de bloquear y se **revalidan ya bloqueadas**: solo se procesan las que siguen `DISPONIBLE` o `COMPLETO` con inicio posterior a `ahora()`. Como el alumno está bloqueado, nadie puede sumarle una inscripción nueva entre la lectura y el bloqueo.
- Marca primero con `marcarVencidasDelAlumno` las reservas vencidas (no son bajas); después finaliza con `finalizarInscripcion(vigencia: "BAJA_ALUMNO", actor)` cada inscripción que sigue `VIGENTE`, con condición atómica sobre la vigencia, y recalcula el estado de cada clase (`COMPLETO → DISPONIBLE`).
- No toca clases pasadas o en curso, clases `PENDIENTE` ni `CANCELADO`, pagos, clases dictadas ni exámenes. Es idempotente: sin inscripciones vigentes futuras devuelve `quitadas: []`.

**`alumnoTieneRegistros(alumnoId, db?)` → `boolean`**, una por módulo dueño, solo lectura (existencia, `LIMIT 1`):
- **C:** el alumno tiene alguna inscripción —en cualquier vigencia— en una clase cuyo inicio ya pasó (`≤ ahora()`).
- **I:** el alumno tiene algún pago, incluso anulado o corregido.
- **E:** el alumno figura en alguna clase dictada (`ClaseDictadaAlumno`, también de una clase anulada), tiene algún resultado de examen o alguna indicación académica.

`tieneRegistrosAlumno(alumnoId, db?)` es el agregador privado de `alumno.estado.service.ts`: las llama en ese orden y corta en la primera verdadera. Mismo criterio que `usuarioRegistroOperaciones` de `spec_modulo_F.md` §2.7.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/alumnos/*.service.ts` (`alumno.service.ts`, `autorregistro.service.ts`). Route Handlers y Server Actions son capa delgada (Regla N.° 4 de `docs/RULES.md`).

### 3.1. Ficha (`Alumno`) y Cuenta (`Usuario`) son entidades separadas

> **Revisión 3.** Se conserva: un `Alumno` puede no tener cuenta. Desde el Sprint 3 las fichas que registra Mesa de Entrada con email nacen con cuenta (2.9), pero los servicios de B siguen sin asumirla: la ficha sin cuenta es el caso de las fichas anteriores y de las creadas sin email.

Ningún servicio de este módulo asume que un `Alumno` tiene cuenta. `Alumno.usuario_id` es nullable y su ausencia es el caso esperado por defecto en altas hechas por Mesa de Entrada.

### 3.2. Aislamiento de dominio: la tabla `Usuario` no se escribe directamente

> **Revisión 3.** Se conserva y alcanza a las funciones nuevas: `crearCuentaParaFicha`, `desactivarCuenta` y `reactivarCuenta` son de A (`spec_modulo_A.md` 2.9). B las llama; nunca escribe en `usuarios`.

Toda creación o modificación de `Usuario` originada en este módulo (autorregistro, cambio de email vinculado) pasa por los servicios públicos de `src/server/usuarios/usuario.service.ts` (Módulo A) — nunca un `prisma.usuario.create()`/`update()` directo desde `src/server/alumnos/*` (Regla N.° 3).

### 3.3. Concurrencia optimista en modificación de ficha

> **Revisión 3.** El mismo patrón rige la baja y la reactivación (`updateMany` con `version` y `activoAlumno` como condición, 2.10.2 y 2.11), además del bloqueo de la ficha (3.13).

Todo `UPDATE` sobre `Alumno` desde HU-B-06 aplica el patrón de condición-y-mutación-atómica de la Regla N.° 7, usando `version` como campo de control en lugar de una cantidad de stock — mismo mecanismo, mismo principio: la condición (`version` sin cambios) y la mutación (aplicar cambios + incrementar `version`) ocurren en una única sentencia, nunca en un `findUnique` + `update` separados.

### 3.4. Unicidad de DNI contra el universo completo (activas + inactivas)

> **Revisión 3.** Ahora hay fichas inactivas de verdad (HU-B-07): siguen ocupando su DNI y el email de su cuenta (3.14).

Igual que `spec_modulo_L.md` §3.1: una ficha inactiva sigue "ocupando" su DNI. Doble validación (aplicativa + constraint `P2002`), igual patrón.

### 3.5. Forma de pago preferida es un valor por defecto, no un compromiso retroactivo

> **Revisión 3.** Sin cambios. La preferida inactiva se conserva y se muestra con la etiqueta «Inactiva» (2.12).

Cambiarla no reescribe ningún pago ya registrado (regla de no retroactividad, sección 2.3).

### 3.6. Códigos de verificación (OTP): solo hash, comparación en tiempo constante, un solo uso
- Se persiste únicamente `HMAC-SHA256(codigo, CODIGO_OTP_SECRET)`, nunca el código en claro.
- La comparación usa `crypto.timingSafeEqual`, nunca `===` (mitigación de timing attack, mismo principio que la verificación de contraseña de `spec_modulo_A.md` §3.1).
- Un código consumido o reemplazado por un reenvío deja de ser válido de inmediato — no queda como alternativa válida "por las dudas".

### 3.7. Rate limiting operacional, tabla síncrona (no vía evento)
`IntentoRegistro` (registro) y el contador de reenvíos de código se escriben de forma síncrona en el propio servicio — mismo razonamiento que `spec_modulo_A.md` §3.3: el límite debe estar disponible para la siguiente solicitud sin depender de un proceso asíncrono.

### 3.8. Ningún dato sensible en logs ni en tablas de eventos
`password`, `password_hash`, el código OTP en claro y su HMAC no se guardan jamás en `EventoSeguridad`, en `IntentoRegistro` ni en logs de aplicación — mismo principio que `spec_modulo_A.md` §3.4.

---

### 3.9. Un solo criterio de búsqueda de alumnos (Revisión 2)

> **Revisión 3.** Sigue valiendo. `construirFiltroBusquedaAlumno` se publica (2.13) para que HU-C-26 no repita las columnas, y `buscarAlumnosActivos` lo usa solo cuando se le pide `{ porPalabras: true }` (P-B8).

El listado de Mesa de Entrada (2.7) y el selector de Turnos comparten `construirFiltroBusquedaAlumno()`: mismo umbral de 2 caracteres, misma normalización, misma coincidencia parcial. Solo difieren en lo que devuelven (todos vs. solo activos, paginado vs. tope de 10). Si el criterio cambia, cambia para ambos.

### 3.10. Los meses de un alta se miden en la zona horaria del centro (Revisión 2)
`createdAtAlumno` es un timestamp sin zona guardado en UTC: agrupar por mes en UTC asignaría al mes siguiente las altas hechas de noche. `contarAlumnosNuevosPorMes()` agrupa siempre en `America/Argentina/Buenos_Aires`, convirtiendo primero de UTC (ver 2.8).

### 3.11. La ficha y la cuenta del alta se crean juntas o no se crean — NUEVA en Revisión 3
Con `email`, `crearAlumno` crea el `Usuario` (vía `crearCuentaParaFicha` de A) y la `Alumno` en la **misma** `transaccion`: si falla una, no existe la otra (HU-A-06, criterio 2). El DNI —que es la contraseña inicial— se guarda solo como hash y nunca se escribe en eventos, logs ni respuestas (3.15). La captura de `P2002` del DNI se hace **fuera** de la transacción (una vez deshecha), nunca dentro. Sin `email`, el alta es la de Sprint 1, sin cuenta. B nunca escribe en `usuarios` (3.2).

### 3.12. Qué cambia y qué no con la baja (Regla N.° 1) — NUEVA en Revisión 3
- **Cambia:** `activoAlumno`, `version` y `modificadoPorUsuarioId` de la ficha; la vigencia de sus inscripciones a clases futuras `DISPONIBLE` o `COMPLETO` (pasan a `BAJA_ALUMNO`, con fecha y usuario); el estado `COMPLETO → DISPONIBLE` de esas clases; el estado de su cuenta (inactiva) y sus sesiones (revocadas).
- **No cambia:** la ficha no se borra; las inscripciones no se borran (se finalizan); las inscripciones a clases pasadas o en curso, las clases dictadas, los exámenes, las indicaciones y los pagos quedan intactos; las clases `PENDIENTE` tampoco se tocan.
- **Se conserva:** el DNI y el email de la cuenta siguen reservados (3.14). La marca «Debe cambiar la contraseña» no se toca (A, 3.8).
- **No se restaura** al reactivar: ni las inscripciones quitadas ni las sesiones revocadas (2.11).
- Una reserva sin pagar que ya venció **no es una baja**: se marca «Reserva vencida» antes (P-B14), por lo que no figura en la serie «Bajas» de HU-H-10.

### 3.13. El bloqueo del alumno — NUEVA en Revisión 3
- La baja, la reactivación y toda operación que inscribe toman el **mismo** bloqueo de la ficha del alumno (nivel 1 del orden de `PR-0.md` §2.10: recurso → clase → inscripción → operación de pago → caja). La baja lo toma primero y C bloquea después las clases y las inscripciones, siempre en ese orden y por id ascendente; la cuenta de A se modifica al final y ningún flujo la bloquea antes que la ficha.
- Quien inscribe debe leer `activoAlumno` **después** de bloquear la ficha: `verificarAlumnoActivo(alumnoId, tx)` tras el `bloquear`, **también** cuando el llamador trae un `alumnoActivo` leído antes (autoservicio, `spec_modulo_C.md` 2.5 paso 2). El valor leído antes del bloqueo solo sirve para responder rápido; la decisión es la posterior (R3-PR0-B3).
- Efecto buscado (criterio 2): una inscripción y una baja simultáneas no pueden confirmarse las dos. O gana la baja y la inscripción responde `409 ALUMNO_INACTIVO`, o gana la inscripción y la baja la quita junto con las demás.
- Dos bajas simultáneas: la segunda ve la ficha inactiva (`409 ALUMNO_YA_INACTIVO`) o una `version` distinta (`409 CONFLICTO_EDICION_CONCURRENTE`). Las esperas de bloqueo vencen a los 5 s con `409 TRANSACCION_OCUPADA`.

### 3.14. El alumno inactivo en el resto del módulo — NUEVA en Revisión 3
- **Unicidad:** el DNI de una ficha inactiva sigue ocupado (3.4) y el email de su cuenta sigue en uso (`verificarEmailNoAsociadoAOtraCuenta` no filtra por estado). Un alta nueva con esos datos responde `409 DNI_DUPLICADO` (el mensaje indica que la ficha existente está inactiva, 2.1) o `409 EMAIL_YA_ASOCIADO`.
- **Autorregistro (2.6, HU-B-07 c5):** si la ficha encontrada por DNI está **inactiva**, tenga o no cuenta, no se crea ni se vincula ninguna cuenta: se responde `409 CUENTA_YA_EXISTE` con el mismo mensaje y el mismo cuerpo que la rama (c) —«Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada.»—, indistinguible desde el cliente. No se genera código ni se envía nada.
- **Búsqueda y selectores:** el listado y la búsqueda (2.4 y 2.7) muestran a los inactivos con la etiqueta «Inactivo»; `buscarAlumnosActivos` no los devuelve y `verificarAlumnoActivo` responde `ALUMNO_INACTIVO`, de modo que no se ofrecen al inscribir (HU-C-04, C-18) ni al cobrar (HU-I-10).
- **Clases `PENDIENTE`:** al continuar su configuración, el paso de alumnos rechaza al inactivo con `ALUMNO_INACTIVO` (cambio en el flujo de HU-C-18, que ya usa `verificarAlumnoActivo`; ver `spec_modulo_C.md` 2.2, paso 3).
- **Edición:** la ficha inactiva **se puede editar** (2.2, 2.3 y 2.5 no cambian). Lo único que no cambia desde `PATCH /api/alumnos/[id]` es el estado (T1). Editar el email de una ficha inactiva con cuenta cambia el de su cuenta inactiva (T9).
- **Reactivación:** no hace falta revalidar unicidad, porque el DNI y el email nunca se liberaron.

### 3.15. Ningún dato sensible en logs, eventos ni respuestas (extiende 3.8) — NUEVA en Revisión 3
No se registran ni se devuelven: el DNI usado como contraseña inicial, ninguna contraseña, ningún hash, y el motivo de la baja en logs de aplicación (el motivo vive solo en el historial de estados). El detalle de 2.12 nunca trae `passwordHash`. Las respuestas de 2.9 a 2.12 llevan `Cache-Control: no-store` (lo agrega `withPermission`).

### 3.16. Aislamiento de dominio (Regla N.° 3) — NUEVA en Revisión 3
`alumno.publico.ts` sigue sin importar módulos de dominio y solo lee `alumnos`. `alumno.estado.service.ts` llama a C, I, E, A y F **solo por sus fachadas** (`*.publico.ts`; A por `cuenta.service.ts` y `usuario.service.ts`, sus archivos de cuentas). Ninguna consulta toca `turnos`, `turno_alumno`, `pagos`, `usuarios`, `clases_dictadas` ni otra tabla ajena. `publico.aislamiento.test.ts` sigue pasando sin cambios.

### 3.17. Pruebas obligatorias (módulo B, Revisión 3) — NUEVA en Revisión 3
1. **Los tests de Sprint 1 y 2 de 2.1 a 2.8 siguen pasando sin tocarse**, incluidos `alumno.busqueda.test.ts` (forma `where.OR` del selector) y `publico.aislamiento.test.ts`. Solo se agregan casos.
2. **Alta (2.9):** sin `email`, idéntica a Sprint 1 (201, sin cuenta, mismos errores); con `email`, ficha y cuenta creadas juntas con rol `ALUMNO` y la marca, hash del DNI (nunca en claro); `EMAIL_YA_ASOCIADO` sin revelar de quién; **si la cuenta falla no hay ficha y si la ficha falla no hay cuenta**; dos altas simultáneas con el mismo DNI y con el mismo email (una gana, sin cuenta huérfana); teléfono opcional y su validación; evento `alumno:creado` después del commit.
3. **Baja (2.10), con PostgreSQL real:** quita solo clases futuras `DISPONIBLE` o `COMPLETO` (una clase en curso, una pasada, una `PENDIENTE` y una `CANCELADO` no se tocan); la `COMPLETO` vuelve a `DISPONIBLE`; las inscripciones quedan `BAJA_ALUMNO` con fecha y usuario y no se borran; una reserva vencida sin marcar se marca «Reserva vencida» y **no** es baja (incluido el borde `venceEl = ahora`); pagos, clases dictadas y exámenes intactos; la cuenta queda inactiva y la sesión abierta responde `401` en la próxima solicitud; el historial se escribe **después** del commit y con reintento; `MOTIVO_REQUERIDO` con registros en C, en I o en E (un caso por cada uno) y motivo opcional sin registros; `CONFLICTO_EDICION_CONCURRENTE`; `ALUMNO_YA_INACTIVO`; una ficha sin cuenta se desactiva igual; la lista de `impacto-baja` coincide con lo que quita la baja.
4. **Concurrencia:** una inscripción (mesa de entrada y autoservicio con `alumnoActivo` ya leído) contra una baja simultánea: nunca quedan las dos (resultado A: baja y `409 ALUMNO_INACTIVO`; resultado B: inscripción quitada por la baja); dos bajas simultáneas; el orden de bloqueo no genera interbloqueo contra `registrarOperacion` de HU-I-10.
5. **Reactivación (2.11):** cuenta activa, sesiones **no** restauradas, marca conservada, inscripciones **no** restauradas, vuelve a ofrecerse al inscribir; historial con cada baja y reactivación.
6. **Permisos:** `alumnos:cambiar_estado` solo Mesa de Entrada (Gerente, Profesor y Alumno `403`, también en `impacto-baja`); `alumnos:leer` Mesa de Entrada y Gerente `200`, Profesor y Alumno `403`; el Gerente `403` en toda escritura. La matriz se prueba **después** de correr el seed.
7. **Autorregistro con ficha inactiva (con y sin cuenta):** `409 CUENTA_YA_EXISTE`, mismo cuerpo que la rama (c), sin código ni cuenta; las ramas (a) a (d) de Sprint 1 no cambian.
8. **Email (T9):** 2.2 y 2.5 cambian el email de la cuenta cuando la ficha tiene `usuarioId` y no tocan nada cuando no lo tiene; unicidad en ambos.
9. **Detalle (2.12):** `cuenta` en sus tres estados, `historial_estados` ordenado y con nombres, `forma_pago_preferida_activa` con una forma inactiva; sin `passwordHash` en ninguna respuesta.
10. **Funciones públicas (2.13):** `contarAlumnosConFormaPagoPreferida` cuenta activos e inactivos; `construirFiltroBusquedaAlumno` equivale al filtro de 2.7 (pruebas de paridad con un solo token y con varias palabras); `buscarAlumnosActivos(query)` sin `opciones` sigue devolviendo lo de Sprint 1 y con `{ porPalabras: true }` encuentra «juan perez».

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

> **Revisión 3.** Los eventos y la opción (b) de esta sección no cambian. Los de la baja y la reactivación están en la nota al final de la sección.


**Opción usada: (b), escritura directa y síncrona a una tabla de eventos por dominio.** Motivo: la ficha admite múltiples eventos discretos y repetibles a lo largo del tiempo (contacto, forma de pago, modificaciones, códigos de verificación e intentos de autorregistro), varios de ellos eventos de seguridad. La ficha conserva además sus columnas de ciclo de vida (`created_at`, `updated_at`, `version`, usuario registrante, opción (a)), que no reemplazan a los eventos.

Conforme a `docs/RULES.md` Regla N.° 2: todo evento (opción b) se escribe después de que `prisma.$transaction` resuelva, nunca dentro de la transacción de negocio. Los eventos de este módulo relacionados a cuentas (autorregistro) son, además, eventos de seguridad — misma tabla `EventoSeguridad` que `spec_modulo_A.md` §4 (tipos ya existentes en el enum: `REGISTRO_CUENTA`, `VERIFICACION_CODIGO_EXITOSA`, `VERIFICACION_CODIGO_FALLIDA`, `CODIGO_VERIFICACION_GENERADO`, `AUTORREGISTRO_DERIVADO_MESA_ENTRADA`). Los nombres `alumno:*` de la tabla siguiente son nombres lógicos del evento; su mapeo exacto a `tipoEvento` y los campos que realmente guarda `EventoSeguridad` (`usuarioId`, `emailEvento`, `ipEvento`, sin payload libre) quedan **a confirmar contra el código**; en particular, `valor_anterior`/`valor_nuevo` no existen en ninguna tabla.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `alumno:creado` | Alta directa (2.1) | `alumno_id, dni, usuario_registrante_id` |
| `alumno:contacto_actualizado` | Contacto (2.2) | `alumno_id, campos_modificados, usuario_id` |
| `alumno:forma_pago_actualizada` | Forma de pago (2.3) | `alumno_id, forma_pago_id, usuario_id` |
| `alumno:actualizado` | Modificación (2.5) | `alumno_id, campos_modificados, valor_anterior, valor_nuevo, usuario_id` |
| `alumno:autorregistro_completado` | Autorregistro exitoso (2.6, rama a o verificación de código) | `alumno_id, usuario_id, via: "DIRECTO" \| "VINCULACION_OTP"` |
| `alumno:codigo_verificacion_generado` | Envío/reenvío de código (2.6) | `alumno_id, solicitud_id, ip` — **nunca** el código |
| `alumno:autorregistro_derivado_mesa_entrada` | Rama (d), datos no coinciden (2.6) | `dni, ip` — nunca detalle de qué no coincidió |

**Revisión 2 (Sprint 2).** La búsqueda (2.7) y los servicios públicos (2.8) son de solo lectura: **no emiten eventos**.

> **Revisión 3 (Sprint 3).** Los eventos de Sprint 1 y 2 no cambian. Se suman:
>
> | Evento | Disparado por | Payload mínimo |
> |---|---|---|
> | `alumno:desactivado` | Baja (2.10.2). Se escribe con `registrarCambioEstado` (`entidad: "ALUMNO"`, `accion: "DESACTIVAR"`) en el historial de estados del PR 0, **después del commit** y con reintento | `alumno_id, usuario_id, motivo, fecha` (y `inscripciones_quitadas` en la respuesta, no en el historial) |
> | `alumno:reactivado` | Reactivación (2.11). `registrarCambioEstado` con `accion: "REACTIVAR"` | `alumno_id, usuario_id, fecha` |
>
> Qué cambia en lo existente: `alumno:creado` (2.9) sigue emitiéndose igual y, cuando se crea la cuenta, A registra aparte su evento de seguridad `CUENTA_CREADA` (`spec_modulo_A.md` 4); B no lo emite. La finalización de cada inscripción deja su propia transición en el historial de la inscripción que mantiene C (`spec_modulo_C.md` 2.16.1). La ficha conserva las columnas de la opción (a) (`updatedAtAlumno`, `modificadoPorUsuarioId`, `version`). La lectura del historial (`listarHistorialEstados`) y las consultas de 2.10.1 y 2.12 son de solo lectura y **no emiten eventos**.
```

### Nota aditiva de sincronización HU-I-07 (10/10/2026)

`alumno.publico.ts` implementa `contarAlumnosConFormaPagoPreferida(id, db?)`, pendiente en develop; cuenta activos e inactivos (P-B10). `obtenerDetalleAlumno` agrega `forma_pago_preferida_activa` sin cambiar campos anteriores. La ficha muestra Inactiva junto al nombre y la edición conserva el valor persistido hasta que el usuario elige explícitamente otra opción; las opciones siguen siendo solo activas. No cambia el contrato de escritura de B-03.
