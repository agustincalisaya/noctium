```markdown
# Especificación Técnica — Módulo D (Profesor)
## Noctium — Sprint 1 · Sprint 2 · Sprint 3 (Revisión 3)
## Revisión 2 — Sprint 2: modificación de la ficha (HU-D-06) y de las materias asociadas (HU-D-07), y ampliación de los servicios públicos

## Revisión 3 — Sprint 3: desactivar y reactivar profesor (HU-D-08), alta y modificación con cuenta de acceso (parte de D de HU-A-06) y acceso de consulta del Gerente (08/10/2026)

**Fuente de verdad:** backlog definitivo del Sprint 3 (40 HU · 107 SP). **Referencias de esta revisión:** `PR-0.md` (§1.1 compatibilidad, §2.7 cuentas y sesiones, §2.9 permisos, §2.10 orden de bloqueo, §2.13 servicios compartidos, §2.14 esquema, §2.16 `transaccion`, `bloquear`, `despuesDelCommit`) · `docs/adicionales/mapa-pantallas-sprint-3.md` (P-40, P-41, P-42, M-40, M-43, DEC-14, DEC-15, DEC-36, DEC-37) · `spec_modulo_A.md` Revisión 3 (§2.8 y §2.9) · `spec_modulo_B.md` Revisión 3 (§2.10, patrón de baja de una ficha con cuenta) · `spec_modulo_C.md` Revisión 6 (§2.10, §2.15, §3.17) · `spec_modulo_F.md` (§2.5 y §2.6, mismo patrón de baja y reactivación) · `spec_modulo_H.md` Revisión 3 (§2.8.4).

**HU contractualizadas o tocadas en esta revisión:**
| HU | SP | Qué agrega a este módulo | Sección |
|---|---|---|---|
| HU-D-08 Desactivar y reactivar profesor | 5 | Baja lógica bloqueada por clases futuras, modal para resolverlas (cancelar o cambiar de profesor, en lote), desactivación de la cuenta y cierre de sesiones, reactivación, historial de estados, motivo | 2.10, 2.11, 2.12 |
| HU-A-06 Crear la cuenta de acceso (la parte del profesor, con HU-D-01 y HU-D-06) | — (los 5 SP son de A) | Con email, la ficha y la cuenta se crean juntas; el email de la ficha es el de la cuenta; sección «Cuenta de acceso» | 2.9, 2.12; notas en 2.1, 2.2, 2.5 y 2.6 |
| Convención 8 d (HU-D-08, criterio 8) | — | El Gerente consulta el listado y la ficha (`profesores:leer`) y es el único que desactiva y reactiva (`profesores:cambiar_estado`); Mesa de Entrada sigue siendo la única que crea y edita | 2.12 |
| HU-H-03 (criterio 4) | — | `obtenerProfesoresBasicos`, que informa si el profesor está activo | 2.13 |

HU-D-01 a HU-D-07 (Sprint 1 y 2) **conservan sus contratos**. Las secciones 2.1 a 2.8 y 3.1 a 3.7 no se renumeran ni se reescriben: reciben una nota de Revisión 3 donde corresponde.

**Regla de esta revisión (instrucción del SM): nada de lo desarrollado en los Sprints 1 y 2 se rompe.** Esta revisión es aditiva: ninguna ruta, schema, `code` de error ni función pública de Sprint 1 y 2 cambia de firma o de resultado, salvo los tres efectos que manda el backlog y que se listan aparte (T3, T4 y T5). Todo lo nuevo son rutas nuevas, campos opcionales en el pedido, campos extra en la respuesta, funciones nuevas y reglas que solo alcanzan a las fichas inactivas (que hasta ahora no podían existir) y a las fichas con cuenta.

**Cómo se verificó.** El repositorio revisado trae `prisma/schema.prisma` (modelo `Profesor` con `usuarioId` opcional y único, `activoProfesor`, `version`, `modificadoPorUsuarioId`) y no trae `src/server/profesores/*` ni `src/server/turnos/*`. El contraste se hizo contra el esquema real, la Revisión 2 de esta spec, el PR 0 v19, las specs A (Rev. 3), B (Rev. 3), C (Rev. 6), E, F, G, H e I, el mapa y el backlog. Lo que depende del código ausente queda marcado «a confirmar contra el código».

**Compatibilidad con los Sprints 1 y 2 (revisada antes de entregar):**
| Elemento existente | Estado en Revisión 3 |
|---|---|
| 2.1 `POST /api/profesores` (identidad y contacto opcional, `409 DNI_DUPLICADO`, `409 EMAIL_YA_ASOCIADO`, wizard de 3 pasos) | **Sin cambios de ruta, schema ni códigos.** Un pedido **sin** `email` hace exactamente lo de hoy (ficha sin cuenta). Un pedido **con** `email` crea además la cuenta en la misma transacción (2.9, T4). La respuesta suma un campo extra opcional, `cuenta` |
| 2.2 `PATCH /api/profesores/[id]/contacto` | **Sin cambios de ruta, schema ni códigos.** Se suma un efecto solo para fichas **con cuenta**: el email nuevo también cambia el de la cuenta (T5). Para una ficha sin cuenta el resultado es idéntico |
| 2.3 y 2.4 (materias y horario) | **Sin cambios.** Siguen rechazando al profesor inactivo con `409 PROFESOR_INACTIVO`; la materia asociada y el horario se conservan en la baja y vuelven a regir al reactivar |
| 2.5 listado y detalle | **Se conservan los campos de hoy.** El detalle suma campos opcionales (`cuenta`, `historial_estados`, 2.12). El listado no cambia y ya incluía a los inactivos. `profesores:leer` pasa a Mesa de Entrada **y** Gerente (T3) |
| 2.6 `PATCH /api/profesores/[id]` con `version` | **Sin cambios de ruta, schema ni códigos.** El paso 7 («el email de contacto y el de la cuenta son independientes») deja de valer **solo** para fichas con cuenta (T5) |
| 2.7 `PUT .../materias` y `GET .../materias/[materiaId]/turnos-futuros` | **Sin cambios.** La lista del modal «Ver turnos» de D-07 sigue siendo por materia; la de D-08 es otra ruta (2.10.2) |
| 2.8 servicios públicos (`listarOpcionesProfesoresActivos`, `obtenerHorariosDeAtencion`, `obtenerNombresProfesores`, `profesorActivoDictaMateria`, `obtenerOpcionProfesorDeUsuario`, `obtenerOpcionProfesorActivo`, `obtenerMateriasDelProfesor`, `listarProfesoresActivosPorMateria`, `estaDentroDeHorarioAtencion`) | **Firmas y resultados sin cambios.** Las nuevas están en 2.13 |
| `Profesor` (esquema) | **Sin columnas nuevas.** La baja usa `activoProfesor` y `version`, que ya existen. El historial de estados es una tabla del PR 0 (`registrarCambioEstado`) |
| Fichas de Sprints 1 y 2 sin cuenta | **No se migran ni se les crea cuenta** (HU-A-06, criterio 8). Se muestran como «Sin cuenta» (DEC-14) |
| Tests de Sprint 1 y 2 de 2.1 a 2.8 | **Siguen pasando sin tocarse**, salvo los tres que fijaban lo que manda cambiar el backlog: la prueba de la matriz de permisos que dejaba `profesores:leer` solo para Mesa de Entrada (T3), la del alta con `email` (T4) y la de la independencia del email (T5). Se ajustan en la HU que los cambia (`PR-0.md` §1.1) |
| Textos de pantalla («turno», «clase») | Los `code` y los nombres técnicos no cambian; el texto visible sale del archivo central (HU-C-23, HU-C-19) |

**Contradicciones detectadas y cómo se resuelven (siempre «acomodarse a lo ya hecho»):**
| # | Contradicción | Resolución |
|---|---|---|
| T1 | «Fuera de alcance» de Sprint 1 y 2: la baja lógica y la reactivación del profesor, y la gestión de su cuenta | **Superado por el backlog (HU-D-08, HU-A-06).** `PATCH /api/profesores/[id]` sigue sin poder cambiar `is_active` (`.strict()`): la baja y la reactivación son rutas propias con su permiso (2.10 y 2.11). La lista de «Fuera de alcance» se conserva con una nota |
| T2 | La sección 1 y 3.1 dicen que registrar un profesor **no** crea cuenta y que `usuario_id` queda nulo todo el sprint | Vale para Sprint 1 y 2 y para toda ficha creada **sin email**. Desde HU-A-06 una ficha creada **con email** nace con cuenta (2.9). La ficha y la cuenta siguen siendo entidades separadas: puede haber fichas sin cuenta (3.1) |
| T3 | La matriz de Sprint 2 y R2-1 dejan `profesores:*` exclusivos de Mesa de Entrada; el backlog (HU-D-08, convención 8 d) le da al Gerente la consulta y la baja | **Lo manda el backlog** (`spec_modulo_A.md` T8). `profesores:leer` pasa a Mesa de Entrada y Gerente; `profesores:crear` y `profesores:editar` **siguen exclusivas de Mesa de Entrada**; se agrega `profesores:cambiar_estado`, solo del Gerente. El Gerente no gana ninguna escritura sobre la ficha, las materias ni el horario. R2-1 se conserva como historial |
| T4 | HU-A-06 (criterio 1) hace el email obligatorio al registrar un profesor; 2.1 lo trata como opcional y los tests de Sprint 2 con `email` verifican que **no** se crea cuenta | **Se cumple en la pantalla** (campo obligatorio) y en el camino con `email` (la cuenta es obligatoria); el servidor **no rechaza** el pedido sin `email`, para no romper el contrato de 2.1 (P-D1). **Efecto inevitable, mandado por el backlog (HU-A-06, criterio 2):** un pedido con `email` ahora también crea la cuenta; el test de Sprint 2 que fija `usuarioId = null` con `email` se ajusta en HU-A-06 |
| T5 | HU-A-06 (criterio 6) pide que cambiar el email de la ficha cambie el de la cuenta; 2.6 paso 7 dice que son independientes | **Lo manda el backlog** y alcanza solo a fichas **con cuenta** (`usuarioId` no nulo): 2.2 y 2.6 llaman a `cambiarEmailCuenta` en la misma transacción. Una ficha con cuenta no puede quedarse sin email (3.13). Una ficha sin cuenta se comporta exactamente como hoy. Se ajusta el test que fijaba la independencia |
| T6 | HU-D-08 (criterio 2) pide que el Gerente cancele clases futuras y las pase a otro profesor, pero `turnos:cancelar` es exclusivo de Mesa de Entrada (`spec_modulo_C.md` 2.10) y C no tiene ninguna operación que cambie el profesor de una clase `DISPONIBLE` o `COMPLETO` (2.1 solo modifica `PENDIENTE`; 2.11 no admite profesor) | `turnos:cancelar` **no cambia**. El Gerente actúa solo por las rutas de 2.10, con `profesores:cambiar_estado` y el helper de alcance del PR 0. C agrega **funciones nuevas** (2.13.3) —cancelar por baja y cambiar de profesor—, sin tocar sus rutas ni sus funciones existentes |
| T7 | HU-D-08 (criterio 2, último punto): crear una clase, pasarla de `PENDIENTE` a `DISPONIBLE` o reprogramarla con ese profesor toma el mismo bloqueo y verifica que siga activo | Las tres operaciones de C ya validan al profesor activo con `obtenerOpcionProfesorActivo` (a confirmar contra el código); lo nuevo es el **bloqueo** del profesor, que se pide a C como un cambio interno aditivo (2.13.3, P-D5). La firma y los códigos de error de esas operaciones no cambian |
| T8 | HU-D-08 (criterio 5): el profesor inactivo no se ofrece en «Nueva clase», la generación masiva, «Solicitar clase» ni el calendario | Ya se cumple: `listarOpcionesProfesoresActivos`, `listarProfesoresActivosPorMateria` y `obtenerOpcionProfesorActivo` devuelven solo activos (2.8). Lo que hay que **probar** es que `obtenerNombresProfesores` y `obtenerOpcionProfesorDeUsuario` **sí** resuelven a un inactivo, para que sus clases pasadas, historiales e indicadores sigan mostrando el nombre (P-D12) |
| T9 | La confirmación de HU-D-06 al guardar y de HU-D-01 al registrar no existían (HU-C-25 las agrega en el Sprint 3) | Es de pantalla: no cambia ninguna ruta. Los textos van al archivo central (HU-C-23) |
| T10 | El valor `PREFIERO_NO_INDICAR` de `genero` en el bloque de 2.1 no coincide con el enum real `Genero` del esquema (`PREFIERO_NO_INDICARLO`) | Discrepancia de **documentación** de Sprint 1, no un cambio de comportamiento: el código usa el enum del esquema. El bloque de 2.1 se conserva tal cual y se anota; a confirmar contra el schema Zod real. Misma nota que `spec_modulo_B.md` (T10) |

**Changelog de Revisión 3:**
| Sección | Estado previo | Acción |
|---|---|---|
| Fuera de alcance, Visión general, Convenciones, 2.1 a 2.8, 3.1 a 3.7 y 4 | Vigentes | Nota de Revisión 3 donde cambia algo; el texto original se conserva |
| 2.9 | — | **Nueva:** alta del profesor con cuenta de acceso (HU-A-06 con HU-D-01) y sincronización del email (HU-D-02, HU-D-06) |
| 2.10 | — | **Nueva:** desactivar un profesor (HU-D-08, criterios 1 a 4, 6 y 8), con su modal de clases futuras (2.10.2 a 2.10.5) |
| 2.11 | — | **Nueva:** reactivar un profesor (HU-D-08, criterio 7) |
| 2.12 | — | **Nueva:** ficha ampliada (cuenta de acceso, historial de estados) y acceso de consulta del Gerente (HU-D-08, criterio 8; HU-A-06, criterio 5) |
| 2.13 | — | **Nueva:** servicios públicos nuevos de D, funciones de otros módulos que D consume, pedidos a C, E e I y seed de escenarios |
| 3.8 a 3.17 | — | **Nuevas:** reglas de la baja, el bloqueo del profesor, el lote, el alcance del Gerente, la cuenta, el profesor inactivo, el aislamiento y las pruebas obligatorias |
| 4 | Opción (a) | Nota: la baja y la reactivación se registran en el historial de estados del PR 0 (opción (b)), además de las columnas de auditoría |

**Decisiones del Scrum Master (puntos abiertos resueltos; el SM las decidió y se registran para quien implemente):**
| # | Punto | Decisión | A quién avisar |
|---|---|---|---|
| P-D1 | ¿El servidor rechaza el alta sin `email`? | **No.** La pantalla lo exige; el servidor conserva el contrato de 2.1 (sin `email` no hay cuenta). Si el equipo prefiere el rechazo estricto, es un cambio de una línea en el schema de 2.9 | Equipo, quien tome HU-A-06 |
| P-D2 | Permisos de la baja | **Una sola acción nueva, `profesores:cambiar_estado`** (solo Gerente), para desactivar, reactivar y las acciones sobre las clases futuras del profesor. El alcance de cada clase lo valida el helper `gerentePuedeGestionarClaseDeBaja` del PR 0. No se crean permisos sobre `turnos:*` | PR 0, spec A (matriz 2.8) |
| P-D3 | Nombres de campos de los contratos nuevos | **snake_case**, como 2.6 y 2.7 (`turno_ids`, `profesor_destino_id`, `clases_futuras`). **Excepción:** los campos que se agregan a un contrato existente siguen la convención de ese contrato; el detalle de 2.5 es camelCase, así que suma `cuenta` e `historialEstados`. Rutas y funciones usan el nombre técnico «turno» (convención 2); el texto visible dice «clase» | Equipo |
| P-D4 | Tamaño del lote | **Hasta 100 clases por pedido.** «Seleccionar todas» con más de 100 se envía en tandas secuenciales desde la pantalla; el resultado se suma | Equipo |
| P-D5 | Cómo se evita que una clase nueva se cree mientras se da de baja al profesor | La baja toma el bloqueo exclusivo de la fila del profesor (recurso, `bloquear`) y cuenta las clases con ese bloqueo. Toda operación de C que deja una clase `DISPONIBLE` o `COMPLETO` con ese profesor (2.2, 2.9, 2.11 y la nueva de cambio de profesor) agrega al profesor a **su** llamada a `bloquear` y vuelve a leer `obtenerOpcionProfesorActivo(…, tx)`. No hay un bloqueo anidado dentro de D | C, PR 0 |
| P-D6 | Lote: transacción por clase y alcance | Cada clase se cancela o cambia en **su propia transacción**; un fallo no frena a las demás. Antes de procesar nada se verifica que **todos** los ids sean clases de ese profesor: si alguno no lo es, `403` sin tocar nada. Una clase que dejó de ser futura o ya está cancelada **no** es un 403: queda en `no_procesadas` con su motivo | C |
| P-D7 | Cuándo el motivo es obligatorio | Si el profesor tiene **clases pasadas** (C) **o** registros académicos (E). Ante la duda, se pide (mismo criterio que la spec F) | C, E |
| P-D8 | Quién hizo cada cambio de estado | Se resuelve con `obtenerNombresGerentes` (spec G): solo el Gerente desactiva y reactiva. Si no se encuentra, `usuario: null` | Equipo |
| P-D9 | Clases `PENDIENTE` del profesor | No bloquean; se informan (`pendientes_afectados`). Al pasar a `DISPONIBLE` con un profesor inactivo, 2.2 de C las rechaza como hoy y la pantalla pide elegir uno activo | C |
| P-D10 | Ficha inactiva | Se puede **modificar** la ficha (2.6 no valida `activo` y no cambia); 2.3, 2.4 y 2.7 siguen rechazando al inactivo con `409 PROFESOR_INACTIVO`. Editar el email de una ficha inactiva cambia también el de su cuenta inactiva | Equipo |
| P-D11 | Profesor destino del cambio | Tiene que estar **activo, dictar la materia** y ser distinto del que se da de baja. Ofrece la lista `listarProfesoresActivosPorMateria` menos el origen | Equipo |
| P-D12 | Nombres de profesores inactivos | `obtenerNombresProfesores` y `obtenerOpcionProfesorDeUsuario` **no filtran por activo** (ya figura así en 2.8); se agregan pruebas que lo fijan | Equipo |
| P-D13 | Email con cuenta | Con cuenta vinculada, el email **no se puede quitar** (es el usuario de la cuenta): `400 VALIDATION_ERROR` en el campo `email` | Equipo |
| P-D14 | Lecturas de «tiene historia» | Dos funciones nuevas de solo lectura: `profesorTieneClasesPasadas` (C) y `profesorTieneRegistros` (E) (2.13.3). D las combina | C, E |
| P-D15 | Cambio de profesor en lote | El servidor exige **una sola materia** por pedido (`400 MATERIAS_DISTINTAS`), aunque la pantalla ya lo impida. En la previsualización, si el destino no cumple dos condiciones, se informa primero `FUERA_DE_HORARIO` y después `OCUPADO` | Equipo |
| P-D16 | Selección de «todas las clases» | `seleccion` de la lista del modal trae hasta **500** clases (`truncada: true` si hay más); la pantalla procesa en tandas de 100 y vuelve a pedir la lista | Equipo |

**Pedidos al PR 0 (para la v20):**
| ID | Pedido | Dónde |
|---|---|---|
| R3-PR0-D1 | Historial de estados: la entidad `"PROFESOR"` y las acciones `"DESACTIVAR"` y `"REACTIVAR"` entre los valores admitidos; `listarHistorialEstados("PROFESOR", id)` publicada en la etapa 2 (R7-PR0-1) | `PR-0.md` §2.13 y §2.14 |
| R3-PR0-D2 | Permisos: `profesores:leer` también para GERENTE; acción nueva `profesores:cambiar_estado` solo para GERENTE (migración **y** seed); quitar `profesores:leer` de `ACCIONES_SOLO_MESA_ENTRADA`; helper `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId, db?)` con `db?` opcional, cuyo contrato es: verdadero si la clase pertenece al profesor indicado, **sin mirar estado ni fecha** (que sea futura y `DISPONIBLE` o `COMPLETO` lo exige la función de C que la procesa, 3.11) | `PR-0.md` §2.9 |
| R3-PR0-D3 | `bloquear` acepta al **profesor** como recurso (nivel 1 del orden, `FOR UPDATE`). El PR 0 §2.10 ya lo nombra: se pide confirmar que quedó implementado | `PR-0.md` §2.10 y §2.16 |
| R3-PR0-D4 | Confirmar contra la migración que el trigger `turno_sincronizar_reservas` escucha `UPDATE OF "profesorId"`. `spec_modulo_C.md` 2.11 ya lo releva así (`… "profesorId", "aulaId"`), por lo que **no se espera ningún cambio**; si el SQL real no lo incluyera, extenderlo con una migración **aditiva** que sume la columna a la lista. Sin eso, cambiar el profesor de una clase no actualizaría la reserva del profesor | migraciones |
| R3-PR0-D5 | Seed de escenarios para HU-D-08 (2.13.4): profesor con clases futuras de dos materias, profesor sin ninguna clase, profesor con clases pasadas, profesor inactivo con cuenta, y dos profesores destino (uno compatible, uno ocupado o fuera de horario). Todo con los servicios de 2.13 | `PR-0.md` §2.15 y §2.16 |
| R3-PR0-D6 | `rutas-por-rol.ts` y `matcher`: `/profesores` y `/profesores/[id]` también para el Gerente (consulta); `/profesores/nuevo` y las acciones de edición siguen siendo solo de Mesa de Entrada | `PR-0.md` §2.9 |
| R3-PR0-D7 | Tabla de compatibilidad §1.1: dos filas, «con `email`, el alta de profesor crea la cuenta» (T4) y «con cuenta, el email de la ficha es el de la cuenta» (T5) | `PR-0.md` §1.1 |
| R3-PR0-D8 | Si `tipoEvento` de `eventos_turno` es un enum, sumar `turno:profesor_cambiado` (2.13.3) | `PR-0.md` §2.14 |

**Efectos sobre otras specs (se anotan al revisarlas):** **A** (2.8: sumar `profesores:cambiar_estado` a la matriz, solo Gerente; `profesores:leer` ya figura para el Gerente; 2.9: las funciones que D usa); **C** (2.15: las funciones nuevas de 2.13.3 y el bloqueo del profesor en 2.2, 2.9 y 2.11; evento nuevo `turno:profesor_cambiado` en la sección 4); **E** (`profesorTieneRegistros` en su fachada); **I** (`turnosConPagosVigentes` en su fachada); **F y G** (la fila de `listarHistorialEstados` pasa a «publicada por el PR 0»); **H** (`obtenerProfesoresBasicos` ya la pide su 2.8.4: queda definida en 2.13); **J** (sin cambios: el selector ya usa solo activos).

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (`prisma-client`) · Zod
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 10, 11) · `spec_modulo_A.md` (sesión/RBAC) · `spec_modulo_L.md` (Materias) · `spec_modulo_B.md` (patrón de contacto/DNI, como referencia de diseño) · `spec_modulo_C.md` Revisión 5 (§2.15, servicios públicos) · `spec_modulo_A.md` §2.4 (matriz RBAC) · `spec_modulo_B.md` §2.5 y §3.3 (patrón de modificación) · `schema.prisma` · `docs/tasks/HU-Sprint-1.md` · `docs/tasks/Sprint 2/HU-Sprint-2.md`

**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-01 | Contractualizada en Sprint 1 (§2.1, alta solo con identidad) | Anotada §2.1 (contacto opcional en el alta y wizard posterior); sin renumerar |
| HU-D-02 | Contractualizada en Sprint 1 (§2.2) | Anotada §2.2 (el contacto también puede cargarse en el alta); sin renumerar |
| HU-D-03 | Contractualizada en Sprint 1 (§2.3) | Anotada §2.3 y §4 (opción (a) de la Regla N.° 2); sin renumerar |
| HU-D-04 | Contractualizada en Sprint 1 (§2.4) | Anotada §2.4 (parámetros desde `ParametroSistema`, «Contrato para HU-C-04») y §4; sin renumerar |
| HU-D-05 | Contractualizada en Sprint 1 (§2.5) | Anotada §2.5 (entrada al modo edición, `version` y `activa` en el detalle); sin renumerar |
| HU-D-06 | Gap — no contractualizada | Añadida sección 2.6 |
| HU-D-07 | Gap — no contractualizada | Añadida sección 2.7 (incluye la ruta `GET .../turnos-futuros`) |

**HU contractualizadas en esta revisión:** HU-D-01 (Identidad), HU-D-02 (Contacto), HU-D-03 (Asociación a materias), HU-D-04 (Horario de atención), HU-D-05 (Listado) — Sprint 1.

**HU contractualizadas en la Revisión 2 (Sprint 2):** HU-D-06 (Modificar datos de un profesor), HU-D-07 (Modificar las materias asociadas a un profesor).

**Changelog — Revisión 2 (Sprint 2):**
| HU / sección | Estado previo | Acción |
|---|---|---|
| HU-D-06 | Gap — "Modificación de una ficha de profesor ya registrada" figuraba como fuera de alcance | Nueva sección 2.6 (aditiva, no renumera) |
| HU-D-07 | Gap | Nueva sección 2.7, con su ruta propia `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros` (lista del modal «Ver turnos»). Regla 3.6 |
| Servicios públicos | `profesorActivoDictaMateria()` (existente) | Nueva sección 2.8: 4 funciones nuevas para Turnos (`spec_modulo_C.md` Revisión 5) y Historial, más `obtenerOpcionProfesorDeUsuario()` y `obtenerOpcionProfesorActivo()` (nuevas en Revisión 2, consumidas por Turnos, Historial y Calendario) |
| Modelo `Profesor` | Tiene `modificadoPorUsuarioId` y `updatedAtProfesor` | + `version` (concurrencia optimista, mismo patrón que `Alumno`) |

**Actualización del 29/09/2026 (implementación del PR 0', sin renumerar secciones):**
| Sección | Estado previo | Acción |
|---|---|---|
| 2.8 | Varias firmas marcadas «forma exacta: a confirmar» | **Confirmadas contra el código** (ver tabla): `OpcionProfesor = { id, nombreParaMostrar }`, con `db?` opcional en todas |
| 2.8 (`obtenerMateriasDelProfesor`) | «Materias activas» | Devuelve **todas** las materias asociadas con el campo `activa`; el consumidor filtra (el calendario ya consume esa forma) |
| 2.8 (`profesorActivoDictaMateria`) | Requisito de `FOR SHARE` con `db` | Implementado en `profesor.publico.ts`: con `db` lee `profesor_materia` con `FOR SHARE OF`; sin `db` delega en la del service |
| 2.8 (imports) | «No importa nada de otros módulos» | Se precisa qué sí puede importar (ver nota al inicio de 2.8) |
| Permisos | `profesores:crear`, `profesores:editar`, `profesores:leer` **exclusivos de Mesa de Entrada** (`seed.ts`, `ACCIONES_SOLO_MESA_ENTRADA`) | **Sin cambios.** El backlog v2 corrigió HU-D-06/D-07 a "Como personal de mesa de entrada" (R2-1 resuelto) |

## ✅ RESUELTO — R2-1 (antes Q12): quién modifica un profesor

> **Revisión 3 (Sprint 3).** R2-1 se conserva como historial y sigue valiendo para **modificar**: los datos y las materias del profesor los edita solo Mesa de Entrada (`profesores:crear` y `profesores:editar` no cambian; decisión del PO, 05/10/2026). Lo que cambia es la **consulta y la baja**: el backlog del Sprint 3 (convención 8 d y HU-D-08, criterio 8) deja sin efecto «el Gerente no administra Profesores». `profesores:leer` pasa a Mesa de Entrada **y** Gerente, se agrega `profesores:cambiar_estado` solo para el Gerente y `ACCIONES_SOLO_MESA_ENTRADA` del seed deja de contener `profesores:leer` (T3; `PR-0.md` §2.9). La fila «Permisos … Sin cambios» de la actualización del 29/09/2026 queda superada por esto.


Las HU-D-06 y HU-D-07 se escribían "Como Gerente", lo que chocaba con `seed.ts` (las tres acciones `profesores:*` son **exclusivas de Mesa de Entrada**). El backlog v2 del 28/09/2026 las corrigió a **"Como personal de mesa de entrada"**: la matriz de permisos **no cambia**. `profesores:editar` y `profesores:leer` siguen siendo solo de Mesa de Entrada, y `ACCIONES_SOLO_MESA_ENTRADA` del seed queda como está. El Gerente **no** modifica profesores en este sprint.

**Changelog (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-D-03 | §2.3 contractualizada en snake_case, con rutas `lib/`/`app/` y `@@unique`; §4 declara el evento `profesor:materias_asociadas` | Anotada §2.3 (nota de sincronización) y §4 (el módulo D usa la opción (a) de la Regla N.° 2). Sin renumerar. |
| HU-D-04 | §2.4 contractualizada en snake_case con días fijos L-S y `GRANULARIDAD_MINUTOS` constante; §4 declara `profesor:horario_registrado` | Anotada §2.4 (nota de sincronización + "Contrato para HU-C-04") y §4. Días, franja y granularidad salen de `ParametroSistema`. Sin renumerar. |
| HU-D-01 / HU-D-02 (ajuste) | §2.1 alta solo con identidad; §2.2 contacto como paso separado, desde la ficha | Anotada §2.1 (nota de sincronización: contacto opcional en el alta, en la misma transacción, y acciones posteriores al alta) y §2.2 (referencia). Sin renumerar. |

**Fuera de alcance de esta spec (explícito):**

> **Revisión 3 (Sprint 3).** Esta lista queda como estaba y el backlog del Sprint 3 la supera en tres puntos, sin borrar nada de ella: (1) la **baja lógica y la reactivación del profesor** entran con HU-D-08 (2.10 y 2.11); `PATCH /api/profesores/[id]` sigue sin poder cambiar el estado; (2) la **gestión de la cuenta de acceso** entra en lo que pide HU-A-06: el alta con cuenta y el email sincronizado (2.9) y la baja y reactivación de la cuenta junto con la ficha (2.10 y 2.11); la recuperación de contraseña es HU-A-05, de `spec_modulo_A.md`; (3) el **Gerente** consulta la sección Profesores y es el único que da de baja y reactiva (2.12). Siguen fuera de alcance: modificar el horario de atención, crear cuentas para fichas anteriores (HU-A-06, criterio 8) y vincular o desvincular una cuenta a mano.

- ~~Modificación de una ficha de profesor ya registrada.~~ **Incorporada en Revisión 2** (2.6 y 2.7, ver «Actualización de alcance» más abajo).
- Baja lógica / reactivación del profesor.
- Gestión de la cuenta de acceso del profesor: alta, vinculación o administración de su `Usuario` — se gestiona por un proceso independiente, fuera de esta spec (ver nota de aislamiento en sección 1).

**Actualización de alcance — Revisión 2 (Sprint 2):** la **modificación de identidad y contacto** (2.6) y de las **materias asociadas** (2.7) pasan a estar dentro de alcance. Siguen fuera: baja lógica y reactivación (HU-D-08, Sprint 3), modificar el horario de atención y la cuenta de acceso.

---

## 1. Visión General

> **Revisión 3 (Sprint 3).** El módulo suma tres capacidades, todas aditivas: (1) el alta de un profesor puede crear **junto con la ficha su cuenta de acceso** —email como usuario, DNI como contraseña inicial, cambio obligatorio en el primer ingreso—, siempre vía los servicios de A (2.9); (2) el **Gerente** puede **desactivar y reactivar** al profesor, lo que exige resolver antes sus clases futuras (cancelarlas o pasarlas a otro profesor), desactiva su cuenta y cierra sus sesiones, sin borrar nada (2.10 y 2.11); (3) el Gerente consulta la sección Profesores en modo lectura (2.12). La «nota explícita» de abajo (sin cuenta de acceso) sigue valiendo para las fichas anteriores y para las creadas sin email: la ficha y la cuenta siguen siendo entidades separadas y puede haber fichas «Sin cuenta». La separación de módulos se mantiene: D nunca escribe en `usuarios` ni lee clases, pagos o historial; usa las fachadas de A, C, E, I y L (2.13).


El Módulo D gestiona la ficha del Profesor: identidad, contacto, las materias que puede dictar y su horario recurrente de atención semanal — insumos que HU-C-04 (`spec_modulo_C.md`) consulta para validar disponibilidad al asignar un profesor a un turno.

**Nota explícita — sin cuenta de acceso en esta spec:** a diferencia del Módulo B (Alumno), registrar una ficha de Profesor **no** crea ni vincula ninguna cuenta (`Usuario`) de forma automática. El criterio de aceptación de HU-D-01 lo establece de forma explícita: "las cuentas se administran de manera independiente". El campo de vínculo (`Profesor.usuario_id`, si el modelo de datos lo contempla) permanece sin asignar durante todo este sprint; el proceso que eventualmente lo complete es responsabilidad de una HU futura, no de esta.

Implementación estándar del proyecto: Route Handler / Server Action delgados que delegan en `src/server/profesores/*.service.ts` (Regla N.° 4 de `docs/RULES.md`). Los schemas de identidad y contacto reutilizan las mismas utilidades compartidas que `spec_modulo_B.md` (`fechaCalendarioValidaSchema`, `normalizarTexto()`, `normalizarTelefono()`) — utilidades de validación transversales, no acoplamiento de dominio: reutilizar una función de `lib/utils/` o `lib/schemas/shared/` (rutas heredadas de la Revisión 1, que `spec_modulo_B.md` y `spec_modulo_L.md` todavía citan así: **a confirmar contra el código**) no viola la Regla N.° 3 de aislamiento, que aplica a datos y lógica de negocio de otro módulo, no a utilidades puras sin estado.

**Alcance de esta revisión:** las secciones 2.6 (HU-D-06) y 2.7 (HU-D-07) son nuevas y aditivas, y 2.8 amplía los servicios públicos. Las secciones 2.1 a 2.5 (Sprint 1) no se renumeran: se anotan con notas de sincronización, para que las referencias cruzadas de otras specs (`spec_modulo_C.md`, `spec_modulo_E.md`, `spec_modulo_J.md`, `spec_modulo_L.md`) sigan siendo válidas (ver `docs/adicionales/sdd-metodologia.md`).

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales

> **Revisión 3.** Valen para las secciones nuevas. Archivos nuevos (Regla N.° 11), sin mover nada existente: `profesor.estado.service.ts` (baja, reactivación y lote de clases) en `src/server/profesores/`, los schemas nuevos se agregan a `profesor.schema.ts`, las Server Actions a `actions.ts`, los tipos a `src/types/profesor.types.ts` y los Route Handlers en `app/api/profesores/[id]/{desactivar,reactivar,impacto-baja,turnos-futuros}/`. Las operaciones de estado usan `transaccion`, `bloquear` y `registrarCambioEstado` del PR 0 y devuelven `ErrorDeDominio`, que **extiende** `ServiceError`: los `code` de error que ya existían (`DNI_DUPLICADO`, `EMAIL_YA_ASOCIADO`, `PROFESOR_NO_ENCONTRADO`, `PROFESOR_INACTIVO`, `CONFLICTO_EDICION_CONCURRENTE`…) se conservan. Los contratos nuevos usan snake_case (como 2.6 y 2.7); los campos que se agregan a un contrato existente siguen la convención de ese contrato. Los permisos de cada ruta nueva están en las secciones y en la matriz de `spec_modulo_A.md` 2.8.

- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los identificadores de `Profesor`, `Materia` y `HorarioProfesor` son CUID según `schema.prisma`; `"cuid"` en los ejemplos es un marcador ilustrativo. El parámetro `[id]` refiere a `Profesor`.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("profesores:<accion>")` (Regla N.° 10).
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/profesor.types.ts`, Server Actions en `src/server/profesores/actions.ts` y services en `src/server/profesores/profesor.service.ts`. Imports siempre con el alias `@/`.

---

### 2.1. Alta de identidad del profesor (HU-D-01)

> **Revisión 3.** **Sin cambios de ruta, schema, pasos, códigos ni wizard** para un pedido sin `email`. Con `email` la ficha y la cuenta de acceso se crean en la misma transacción (2.9.1, HU-A-06): el paso 4 («`usuario_id: null`») vale solo cuando no hay `email`, y la respuesta suma un campo extra opcional, `cuenta`. La pantalla pide el email como obligatorio (P-D1). La unicidad de DNI sigue alcanzando a las fichas inactivas (3.14). Nota de documentación (T10): el valor `PREFIERO_NO_INDICAR` de `genero` aparece así en el bloque de abajo; el enum del esquema es `PREFIERO_NO_INDICARLO` (a confirmar contra el código del schema Zod).


**Ruta:** `POST /api/profesores`
**Server Action equivalente:** `crearProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `crearProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:crear` (exclusivo del rol Mesa de Entrada)

```typescript
// src/server/profesores/profesor.schema.ts (Regla N.° 11; en el código se construye con construirIdentidadProfesorSchema(), ver la nota de §2.1)
export const IdentidadProfesorSchema = z.object({
  nombre: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  apellido: z.string().trim().min(2).max(50)
    .regex(/^[\p{L}\s'-]+$/u, "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones")
    .transform((v) => v.replace(/\s+/g, " ")),
  dni: z.string().trim().regex(/^\d+$/, "Ingresá el DNI solo con números").length(DNI_LONGITUD),
  fecha_nacimiento: fechaCalendarioValidaSchema.refine((d) => d <= new Date(), "La fecha de nacimiento no puede ser futura"),
  genero: z.enum(["MASCULINO", "FEMENINO", "OTRO", "PREFIERO_NO_INDICAR"]).optional(),
});
export type IdentidadProfesorInput = z.infer<typeof IdentidadProfesorSchema>;
```

**Nota — unicidad de DNI acotada a `Profesor`, no compartida con `Alumno`:** son entidades y tablas independientes. Una misma persona podría, en teoría, tener ficha de Alumno y de Profesor con el mismo DNI sin que eso sea un conflicto para este sistema — ningún criterio de aceptación pide lo contrario, así que la spec no introduce esa restricción por su cuenta.

**Comportamiento esperado (`src/server/profesores/profesor.service.ts` → `crearProfesor`):**
1. Verificar unicidad aplicativa de `dni` contra **todos** los profesores, activos e inactivos.
2. Si existe: `409 DNI_DUPLICADO`.
3. Revalidación inmediatamente antes del `INSERT` + defensa de constraint único (`P2002`) — mismo patrón que `spec_modulo_L.md` §3.2 y `spec_modulo_B.md` §3.4.
4. Insertar con `is_active: true`, `usuario_id: null` (sin cuenta — ver nota de la sección 1), fecha de alta y usuario registrante.
5. Emitir `profesor:creado` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "nombre": "Ana", "apellido": "Gómez", "dni": "28456789", "is_active": true }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "DNI_DUPLICADO", "message": "Ya existe un profesor registrado con ese DNI" } }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — payload inválido (identidad, y contacto si viene).
- `403 SIN_PERMISO` — sin `profesores:crear`.
- `409 DNI_DUPLICADO` — ya existe un profesor con ese DNI (activo o inactivo).
- `409 EMAIL_YA_ASOCIADO` — el email opcional ya está asociado a otra cuenta (ver la nota de sincronización siguiente).

**Nota de sincronización (ajuste HU-D-01/HU-D-02, resuelta — `docs/tasks/Sprint 1/HU-D-01-D-02-alta-con-contacto.md`):**
- **Contacto opcional en el alta:** "Nuevo profesor" suma la sección "Datos de contacto" (`telefono`, `email`). Si los dos quedan vacíos, el alta es solo de identidad, como antes. Si se completa alguno, se aplican las reglas de §2.2 (teléfono normalizado de 8-15 dígitos, email en minúsculas de hasta 254 caracteres, unicidad frente a cuentas sin revelar a quién pertenece), **salvo** "al menos uno", que sigue siendo exclusiva de §2.2.
- **Desviación de `HU-Sprint-1.md`:** HU-D-01 c4 y HU-D-02 c1 definen el contacto como un paso separado desde la ficha. §2.2 se mantiene para cargarlo o modificarlo después. Ofrecer contacto, materias y horario al terminar el alta **no** es una desviación: lo pide HU-D-01 c4.
- **Rutas y nombres reales (Regla N.° 11), camelCase:**
  - Schema `construirAltaProfesorSchema(dniLongitudMin, dniLongitudMax)` en `src/server/profesores/profesor.schema.ts`: `construirIdentidadProfesorSchema()` extendido con `campoOpcional(telefonoContactoSchema)` y `campoOpcional(emailContactoSchema)` de `src/server/shared/contacto.schema.ts`. Mismo schema en el formulario, la Server Action y el Route Handler.
  - Servicio `crearProfesor(input, usuarioRegistranteId)` en `src/server/profesores/profesor.service.ts`. La unicidad del email usa `verificarEmailNoAsociadoAOtraCuenta()`, la misma función que `actualizarContactoProfesor()` (§2.2) y que `modificarProfesor()` (§2.6 paso 3). Proveedor y firma de `verificarEmailNoAsociadoAOtraCuenta()`: **a confirmar contra el código** (no figura entre los servicios públicos de `spec_modulo_A.md` §2.4).
- **Atomicidad:** unicidad de DNI, unicidad del email (solo si vino) e `INSERT` con identidad y contacto en una única `prisma.$transaction`. Cualquier rechazo deja la base sin cambios. El catch de `P2002` sobre `dniProfesor` envuelve la transacción.
- **Trazabilidad (Regla N.° 2, opción (a)):** `createdAtProfesor` y `creadoPorUsuarioId`, como antes. Cargar contacto en el alta no es una modificación: `modificadoPorUsuarioId` queda en `NULL`.
- **`POST /api/profesores`:** acepta `telefono` y `email` opcionales. `201` devuelve además `telefono` y `email` (`null` si no se cargaron). Nuevo `409 EMAIL_YA_ASOCIADO` ("Ese email ya está asociado a otra cuenta"). La Server Action `crearProfesor()` lo devuelve como error del campo `email`.
- **Después del alta, wizard lineal de 3 pasos** (reemplaza la pantalla de éxito con acciones sueltas). Cada paso muestra el indicador "Paso N de 3: <nombre>" (`StepperAltaProfesor`). Los avisos de éxito son toasts no bloqueantes (`src/components/ui/toast.tsx`, Base UI, arriba al centro, se ocultan solos a los 3,5 s). La navegación al paso siguiente no espera a que el usuario los cierre:
  1. **Datos** (`/profesores/nuevo`, obligatorio, sin opción de saltearlo): al confirmar el alta aparece el toast "Profesor registrado correctamente" y se avanza a `/profesores/<id>/materias?alta=1`.
  2. **Materias** (§2.3 con `?alta=1`): mismo encabezado "Apellido, Nombre · DNI". Al guardar aparece el toast "Materias asignadas correctamente" (HU-D-03; el guardado de solo materias desde la ficha usa el mismo texto, por decisión del PO sobre HU-D-07 AC4, §2.7 «Mensajes al guardar») y se avanza a `/profesores/horarios/nuevo?profesorId=<id>&alta=1`. El link secundario "Completar esto más tarde" reemplaza a "Cancelar" y lleva a la ficha. Si no hay materias activas, se ofrece "Continuar con el horario".
  3. **Horario** (§2.4 con `?alta=1`): el mismo encabezado reemplaza al selector de profesor. Cada intervalo guardado muestra el toast "Horario registrado correctamente" y la pantalla se mantiene para cargar otro, con día y horas en blanco. Fuera del wizard el día se conserva, como define HU-D-04. Sin intervalos se ofrece "Completar esto más tarde" y, con al menos uno, "Finalizar". Los dos llevan a la ficha. Si el id no corresponde a un profesor activo, la pantalla funciona en su modo normal.
  - "Cargar datos de contacto" ya no se ofrece al terminar el alta: el contacto es opcional en el paso 1 y se carga después desde la ficha (§2.2).
  - Sin `?alta=1`, las pantallas de §2.3 y §2.4 se comportan como antes, cuando se entra desde la ficha.
  - **Horario sin materias asociadas:** aviso (`bg-warning`) con link a asignar materias, sin bloquear el registro. El horario es independiente de la materia (§2.4) y el servidor no exige materias.

---

### 2.2. Registrar datos de contacto (HU-D-02)

> **Revisión 3.** **Sin cambios de ruta, schema ni códigos.** Solo para una ficha **con cuenta**, el email nuevo también cambia el de la cuenta, en la misma transacción (2.9.2, T5); el paso 2 deja de ser solo «defensivo». Para una ficha sin cuenta el resultado es idéntico al de Sprint 1.


**Ruta:** `PATCH /api/profesores/[id]/contacto`
**Server Action equivalente:** `actualizarContactoProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `actualizarContactoProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar`

```typescript
// Base sin `.refine`: es la que componen otros schemas (p. ej. 2.6). En Zod 4,
// `.partial()` / `.merge()` sobre un objeto con `.refine` a nivel objeto puede fallar.
export const ContactoBaseSchema = z.object({
  telefono: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254).optional(),
});
// Alta de contacto (2.2): exige al menos uno.
export const ContactoProfesorSchema = ContactoBaseSchema.refine((d) => d.telefono || d.email, {
  message: "Ingresá al menos un teléfono o un email de contacto",
  path: ["telefono"],
});
export type ContactoProfesorInput = z.infer<typeof ContactoProfesorSchema>;
```

**Comportamiento esperado:**
1. `telefono`: misma normalización que `spec_modulo_B.md` §2.2 (`lib/utils/normalizar-telefono.ts`, ruta a confirmar contra el código; 8-15 dígitos, conserva `+` inicial).
2. `email`: si se provee, se valida su unicidad contra `Usuario.email` de cualquier cuenta existente — **defensivo**, ya que este módulo no crea cuentas, pero el email de contacto podría coincidir con uno ya usado por otra cuenta si en el futuro se vincula manualmente; el aviso no revela a quién pertenece (`409 EMAIL_YA_ASOCIADO`), mismo criterio que `spec_modulo_B.md` §2.2. Qué módulo provee la comprobación contra `Usuario.email` y con qué firma (`verificarEmailNoAsociadoAOtraCuenta()`): **a confirmar contra el código**.
3. Actualiza únicamente los campos provistos, `updated_at`.
4. Emitir `profesor:contacto_actualizado` (sección 4).

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "telefono": "+5493874445566", "email": "ana.gomez@mail.com" }, "error": null }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — formato inválido, o ni teléfono ni email («Ingresá al menos un teléfono o un email de contacto»).
- `403 SIN_PERMISO` — sin `profesores:editar`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente (mismo código que 2.3 y 2.6; a confirmar contra el código para esta operación).
- `409 EMAIL_YA_ASOCIADO` — el email ya está asociado a otra cuenta.

**Nota (ajuste HU-D-01/HU-D-02):** el contacto también puede cargarse en el alta (nota de sincronización de §2.1), con las mismas reglas de esta sección salvo "al menos uno". Esta sección sigue siendo la forma de cargarlo o modificarlo después, desde la ficha, sin cambios de comportamiento.

---

### 2.3. Asociar profesor a materias (HU-D-03)

> **Revisión 3.** **Sin cambios.** Sigue rechazando al profesor inactivo con `409 PROFESOR_INACTIVO` (paso 1) y las asociaciones se conservan en la baja (3.8).


**Ruta:** `POST /api/profesores/[id]/materias`
**Server Action equivalente:** `asociarMateriasProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `asociarMateriasAProfesor()` en `src/server/profesores/profesor.service.ts` — es el nombre con que `spec_modulo_L.md` §2.3 declara a este módulo como consumidor de `bloquearMateriasParaAsociar()` (nombre y firma exactos: a confirmar contra el código). La modificación de §2.7 (`actualizarMateriasDeProfesor`) llama a la misma función de L.
**Permiso requerido:** `profesores:editar`

```typescript
export const AsociarMateriasProfesorSchema = z.object({
  materia_ids: z.array(z.string().cuid()).min(1, "Seleccioná al menos una materia"),
});
export type AsociarMateriasProfesorInput = z.infer<typeof AsociarMateriasProfesorSchema>;
```

**Modelo de referencia:** `ProfesorMateria` (`profesor_id`, `materia_id`), constraint único compuesto `@@unique([profesor_id, materia_id])`.

**Comportamiento esperado, dentro de `prisma.$transaction` (todo-o-nada):**
1. Verificar que el `Profesor` esté `is_active: true`. Solo se asocian materias a profesores activos.
2. Resolver cuáles de los `materia_ids` recibidos **ya** están asociadas a este profesor. Si alguno lo está: `409 MATERIA_YA_ASOCIADA` — el servidor rechaza el duplicado como defensa (la UI ya impide reseleccionar una materia marcada, esto cubre una llamada directa a la API).
3. **Revalidar que todas las materias del lote sigan `is_active: true` al momento de confirmar** (no alcanza con que lo estuvieran cuando se abrió el formulario). Si **alguna** dejó de estar activa: se aborta la operación completa (no se guarda ninguna asociación de ese lote, ni siquiera las que sí seguían válidas), y se informa específicamente cuál/cuáles materias dejaron de estar activas, para que el cliente las quite de la selección y reconfirme — `409 MATERIA_INACTIVA`, incluyendo la lista de ids problemáticos en el error.
4. Si todo es válido: insertar todas las asociaciones del lote en una única operación (`createMany`).
5. Emitir `profesor:materias_asociadas` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "profesor_id": "cuid", "materias_asociadas": ["cuid-materia-1", "cuid-materia-2"] }, "error": null }
```

**Respuesta `409 Conflict` (materia inactiva en el lote):**
```json
{
  "data": null,
  "error": { "code": "MATERIA_INACTIVA", "message": "La materia 'Física' ya no está activa", "materia_ids_invalidas": ["cuid-materia-2"] }
}
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — `materia_ids` vacío o con ids inválidos.
- `403 SIN_PERMISO` — sin `profesores:editar`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente.
- `404 MATERIA_NO_ENCONTRADA` — algún id no corresponde a ninguna materia.
- `409 PROFESOR_INACTIVO` — el profesor no está activo.
- `409 MATERIA_YA_ASOCIADA` — alguna materia del lote ya está asociada al profesor.
- `409 MATERIA_INACTIVA` — alguna materia del lote dejó de estar activa (con `materia_ids_invalidas`; no se guarda ninguna).

**Nota de sincronización (HU-D-03, resuelta):**
- **Rutas reales (Regla N.° 11):** Server Action en `src/server/profesores/actions.ts`, servicio en `src/server/profesores/profesor.service.ts`, schema en `src/server/profesores/profesor.schema.ts`, tipos en `src/types/profesor.types.ts`. Route Handler en `src/app/api/profesores/[id]/materias/route.ts`.
- **camelCase**, igual que HU-D-01/D-02: el payload es `materiaIds`; la respuesta `201` es `{ profesorId, materiasAsociadas }`; los errores `409` llevan `materiaIdsInvalidas`.
- **Modelo:** la unicidad de `ProfesorMateria` es la PK compuesta `@@id([profesorId, materiaId])`, no un `@@unique`. Un `P2002` sobre ella se traduce a `MATERIA_YA_ASOCIADA`.
- **Zod 4:** `z.cuid()` en lugar del deprecado `z.string().cuid()`.
- **Códigos que esta sección no definía:**
  - `404 PROFESOR_NO_ENCONTRADO`: profesor inexistente.
  - `409 PROFESOR_INACTIVO`: profesor inactivo (paso 1).
  - `404 MATERIA_NO_ENCONTRADA`: algún id no corresponde a ninguna materia.
- **Orden de validación:** igual que arriba. `MATERIA_INACTIVA` se lanza **después** del chequeo de duplicados (paso 2).
- **Atomicidad (Regla N.° 7):**
  - el paso 1 es un `updateMany` condicionado a `activoProfesor: true`, que además registra `modificadoPorUsuarioId`;
  - el paso 3 usa `bloquearMateriasParaAsociar()` de `spec_modulo_L.md` §2.3, que bloquea las materias con `FOR SHARE` dentro de la misma transacción.
- **Paso 5 (evento):** no se emite. Ver la nota de §4.

---

### 2.4. Registrar horario de atención del profesor (HU-D-04)

> **Revisión 3.** **Sin cambios.** Sigue rechazando al profesor inactivo; el horario se conserva en la baja y vuelve a regir al reactivar (2.11). `estaDentroDeHorarioAtencion` no mira el estado del profesor, como hasta hoy: el cambio de profesor de 2.10.5 verifica la actividad aparte.


**Ruta:** `POST /api/profesores/[id]/horarios`
**Server Action equivalente:** `registrarHorarioProfesor()` en `src/server/profesores/actions.ts`
**Servicio:** `registrarHorarioProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar`

```typescript
const horaSchema = z.string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:MM, 24h)")
  .refine((h) => Number(h.split(":")[1]) % GRANULARIDAD_MINUTOS === 0, {
    message: `El horario debe ajustarse a intervalos de ${GRANULARIDAD_MINUTOS} minutos`,
  });

export const RegistrarHorarioProfesorSchema = z.object({
  dia_semana: z.enum(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]),
  hora_inicio: horaSchema,
  hora_fin: horaSchema,
}).refine((d) => d.hora_inicio < d.hora_fin, {
  message: "La hora de inicio debe ser anterior a la hora de fin",
  path: ["hora_fin"],
});
export type RegistrarHorarioProfesorInput = z.infer<typeof RegistrarHorarioProfesorSchema>;
```

**Naturaleza del registro — recurrente y sin fecha:** `HorarioProfesor` no tiene columna de fecha: representa un patrón semanal que se repite indefinidamente (todos los Lunes 10-12, por ejemplo), independiente de la materia. `spec_modulo_C.md` (HU-C-04) lo consulta contra el día de semana del turno propuesto, no contra una fecha puntual.

**Comportamiento esperado:**
1. Verificar que el `Profesor` esté `is_active: true`.
2. Verificar que `dia_semana` sea uno de los días operativos del centro (parámetro `DIAS_OPERATIVOS`) y que el intervalo `[hora_inicio, hora_fin)` esté completamente contenido en el horario operativo (`HORA_APERTURA`, `HORA_CIERRE`). Si no: `400 FUERA_DE_HORARIO_OPERATIVO`, indicando la franja permitida.
3. **Validación de superposición** contra los `HorarioProfesor` ya registrados del mismo profesor en el mismo `dia_semana`. Regla de superposición explícita: dos intervalos `[a1, a2)` y `[b1, b2)` se superponen **si y solo si** `a1 < b2 AND b1 < a2`. Bajo esta fórmula, dos intervalos contiguos (`a2 == b1`, ej. `10:00–12:00` y `12:00–14:00`) **no** se consideran superpuestos — cumple el criterio de aceptación explícito de HU-D-04 §4.
4. Si hay superposición: `409 HORARIO_SUPERPUESTO`, identificando el día y el intervalo en conflicto. No se guarda el nuevo horario.
5. Si es válido: inserta el nuevo `HorarioProfesor`. Operación de una sola tabla, transaccional simple.
6. Emitir `profesor:horario_registrado` (sección 4).

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "dia_semana": "LUNES", "hora_inicio": "10:00", "hora_fin": "12:00" }, "error": null }
```

**Respuesta `409 Conflict` (superposición):**
```json
{
  "data": null,
  "error": { "code": "HORARIO_SUPERPUESTO", "message": "El intervalo se superpone con Lunes 10:00–12:00" }
}
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — formato de hora inválido.
- `400 DIA_NO_OPERATIVO` / `400 HORA_NO_GRANULAR` / `400 HORARIO_INVERTIDO` / `400 FUERA_DE_HORARIO_OPERATIVO` — según el paso 2 y la nota de sincronización siguiente.
- `403 SIN_PERMISO` — sin `profesores:editar`.
- `404 PROFESOR_NO_ENCONTRADO` — profesor inexistente.
- `409 PROFESOR_INACTIVO` — el profesor no está activo.
- `409 HORARIO_SUPERPUESTO` — el intervalo se superpone con uno ya registrado ese día.

**Nota de sincronización (HU-D-04, resuelta):**
- **Rutas reales (Regla N.° 11):**
  - Server Action `registrarHorarioProfesor(formData)` en `src/server/profesores/actions.ts`.
  - Servicio `registrarHorarioProfesor(input, usuarioId)` en `src/server/profesores/profesor.service.ts`.
  - Schema `construirRegistrarHorarioSchema(parametros)` en `src/server/profesores/profesor.schema.ts`.
  - Helpers puros (compartidos cliente/servidor) en `src/lib/horario-atencion.ts`.
  - Route Handler `POST /api/profesores/[id]/horarios` en `src/app/api/profesores/[id]/horarios/route.ts`.
  - UI: `/profesores/horarios/nuevo?profesorId=<id>` y la sección "Horario de atención" de la ficha.
- **camelCase**, igual que HU-D-03: payload `{ diaSemana, horaInicio, horaFin }` (el `profesorId` va en la ruta, o en el `FormData` de la action). La respuesta `201` es `{ id, diaSemana, horaInicio, horaFin }`.
- **Modelo:** se usa el `HorarioProfesor` existente, sin cambios de schema. Las horas son `@db.Time`, igual que `Turno.horaInicioTurno`. El servicio las convierte a minutos desde las 00:00 para comparar. La UI y los contratos usan `"HH:mm"`.
- **Parámetros:** no se hardcodean. `obtenerParametrosHorarioOperativo()` (`src/server/shared/parametros.ts`) lee de `ParametroSistema` las mismas claves que Turnos:
  - `dias_operativos`
  - `horario_operativo_desde` / `horario_operativo_hasta`
  - `granularidad_turno_minutos`
  El schema se construye con esos valores, como `construirIdentidadProfesorSchema` con el DNI.
- **Validaciones:** el schema y el servicio comparten `validarIntervaloHorario()`. Códigos:
  - `400 DIA_NO_OPERATIVO`, `400 HORA_NO_GRANULAR`, `400 HORARIO_INVERTIDO` y `400 FUERA_DE_HORARIO_OPERATIVO`, con el mensaje "El horario debe estar dentro del horario operativo del centro (08:00 a 20:00)". Se devuelven como error de validación del campo.
  - `404 PROFESOR_NO_ENCONTRADO`
  - `409 PROFESOR_INACTIVO`
  - `409 HORARIO_SUPERPUESTO`
- **Atomicidad (Regla N.° 7):** una sola `$transaction` hace tres pasos:
  1. Un `updateMany` condicionado a `activoProfesor: true`, que registra `modificadoPorUsuarioId` (mismo patrón que HU-D-03). También bloquea la fila del profesor hasta el commit.
  2. La búsqueda de superposición en el mismo día.
  3. El `INSERT`.
  Si llegan dos altas simultáneas para el mismo profesor, se serializan. La segunda ve el intervalo de la primera y se rechaza.
- **Trazabilidad:** opción (a) de la Regla N.° 2. Se usan `createdAtHorario` y `creadoPorUsuarioId` de la fila. No se emite `profesor:horario_registrado` (ver §4).
- **Resumen semanal:** `ResumenSemanalHorarios` (`src/components/shared/resumen-semanal-horarios.tsx`) recibe el resultado de `obtenerHorariosDelProfesor()`. Agrupa por día y ordena por hora de inicio. HU-D-05 lo reutiliza en el detalle.

#### Contrato para HU-C-04

Servicio público del módulo D (Regla N.° 3) para validar la disponibilidad del profesor al asignar un turno. No hace falta leer `horarios_profesor` directamente.

```typescript
// src/server/profesores/profesor.service.ts
export async function estaDentroDeHorarioAtencion(
  profesorId: string,
  fecha: Date,        // fecha calendario @db.Date (medianoche UTC), como Turno.fechaTurno
  horaInicio: string, // "HH:mm", 24 h
  horaFin: string,    // "HH:mm", 24 h, posterior a horaInicio
  db?: Prisma.TransactionClient, // opcional: para correr dentro de la transacción de quien llama
): Promise<boolean>;

// Helper puro de superposición (regla única del proyecto, §3.4). Se exporta
// desde src/lib/horario-atencion.ts (usable también en cliente) y se
// re-exporta desde profesor.service.ts.
export function intervalosSeSuperponen(
  a: { inicio: number; fin: number }, // minutos desde las 00:00, [inicio, fin)
  b: { inicio: number; fin: number },
): boolean; // a.inicio < b.fin && b.inicio < a.fin — los contiguos NO se superponen
```

**Formato de horas:** strings `"HH:mm"` en 24 h con cero a la izquierda (`"08:00"`, `"13:30"`, nunca `"8:00"`), validadas con `HORA_REGEX` de `src/lib/horario-atencion.ts`. Internamente se comparan como minutos desde las 00:00. En base, `HorarioProfesor` guarda `@db.Time`, que Prisma lee como `Date` 1970-01-01 UTC. Quien llama no manipula ese formato.

**Qué devuelve:**
- Devuelve `true` si el intervalo `[horaInicio, horaFin)` cae **completo** dentro de **un** horario de atención del profesor. Se consideran solo los horarios del día de la semana de `fecha` (`getUTCDay()`). Los bordes cuentan: un turno 10:00–12:00 entra en un horario 10:00–12:00.
- No combina horarios contiguos. Un turno 11:00–13:00 contra 10:00–12:00 + 12:00–14:00 devuelve `false`.
- Devuelve `false` si alguna hora no tiene formato `HH:mm` o si `horaInicio >= horaFin`.
- No verifica que el profesor esté activo ni que dicte la materia. Para eso está `profesorActivoDictaMateria(profesorId, materiaId)`.
- Para pasar de/a minutos: `horaAMinutos("10:30") === 630` y `minutosAHora(630) === "10:30"`, en `src/lib/horario-atencion.ts`.

Ejemplo de uso (HU-C-04, dentro de la transacción de asignación):

```typescript
import { estaDentroDeHorarioAtencion } from "@/server/profesores/profesor.service";
import { horaAMinutos, minutosAHora } from "@/lib/horario-atencion";
import { ServiceError } from "@/server/shared/service-error";

// turno: fila de Turno ya leída; tx: Prisma.TransactionClient de la asignación.
const inicio = minutosAHora(turno.horaInicioTurno.getUTCHours() * 60 + turno.horaInicioTurno.getUTCMinutes());
const fin = minutosAHora(horaAMinutos(inicio) + turno.duracionMinutosTurno);

if (!(await estaDentroDeHorarioAtencion(profesorId, turno.fechaTurno, inicio, fin, tx))) {
  throw new ServiceError("PROFESOR_FUERA_DE_HORARIO", "El turno está fuera del horario de atención del profesor");
}

// Llamada directa, fuera de una transacción (usa el cliente global):
await estaDentroDeHorarioAtencion(profesorId, new Date(Date.UTC(2026, 8, 21)), "10:00", "12:00"); // lunes
```

---

### 2.5. Listado y detalle de profesores (HU-D-05)

> **Revisión 3.** El listado y los campos del detalle **no cambian**. Cambian dos cosas, ambas mandadas por el backlog: `profesores:leer` pasa a ser de Mesa de Entrada **y Gerente** (HU-D-08, criterio 8; la frase «El Gerente no abre la ficha» de la nota de sincronización queda superada), y el detalle suma campos opcionales —`cuenta` e `historialEstados`— descritos en 2.12. Los profesores dados de baja siguen apareciendo, con la etiqueta «Inactivo». «Editar» sigue visible solo con `profesores:editar`.


**Ruta (listado):** `GET /api/profesores`
**Server Action equivalente:** — (solo Route Handler)
**Servicio (listado):** `listarProfesores()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:leer`

```typescript
export const ListarProfesoresQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
```

**Comportamiento esperado:**
- Orden inicial: `apellido_normalizado, nombre_normalizado` ascendente, `dni` como segundo criterio de desempate — mismo criterio que `spec_modulo_B.md` §2.4.
- Cada ítem: apellido, nombre, DNI, contacto (`telefono`/`email`, `"—"` si ausentes), materias asociadas **resumidas** (ej. `"Matemática, Física +2"` cuando son más de 2 — se listan las primeras 2 por nombre y se indica el resto como contador, sin impedir ver el detalle completo), estado.
- Incluye profesores activos e inactivos (columna Estado los distingue).
- Paginación server-side con metadatos.

**Ruta (detalle):** `GET /api/profesores/[id]` (**Server Action equivalente:** — (solo Route Handler); **Servicio:** `obtenerDetalleProfesor()` en `src/server/profesores/profesor.service.ts`) — identidad completa, contacto, listado completo de materias asociadas, y horarios **agrupados por día de la semana** (resumen semanal legible, ej. `{ LUNES: [{hora_inicio, hora_fin}], MARTES: [...] }`).

**Respuesta `200 OK` (detalle):**
```json
{
  "data": {
    "id": "cuid",
    "apellido": "Gómez", "nombre": "Ana", "dni": "28456789", "is_active": true, "version": 3,
    "contacto": { "telefono": "+5493874445566", "email": "ana.gomez@mail.com" },
    "materias": [{ "id": "cuid", "nombre": "Matemática", "codigo": "MAT101", "activa": true }],
    "horarios": { "LUNES": [{ "hora_inicio": "10:00", "hora_fin": "12:00" }], "MARTES": [] }
  },
  "error": null
}
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — query del listado inválida (`pagina`, `por_pagina`).
- `403 SIN_PERMISO` — sin `profesores:leer`.
- `404 PROFESOR_NO_ENCONTRADO` — solo en el detalle, profesor inexistente.

**Nota de sincronización (HU-D-05, resuelta):**
- **Rutas reales (Regla N.° 11):**
  - Servicios `listarProfesores(query)`, `obtenerDetalleProfesor(id)` y `listarOpcionesProfesoresActivos()` en `src/server/profesores/profesor.service.ts`.
  - Schema `ListarProfesoresQuerySchema` en `src/server/profesores/profesor.schema.ts`.
  - Helpers puros en `src/lib/profesor-listado.ts` (`resumirMaterias`, `clavesOrdenProfesor`) y en `src/lib/horario-atencion.ts` (`agruparHorariosPorDia`, `formatearIntervalos`).
  - UI: `/profesores?pagina=N` y `/profesores/[id]?pagina=N`. Route Handlers `GET /api/profesores` y `GET /api/profesores/[id]`.
- **Orden:** columnas `apellidoNormalizadoProfesor` / `nombreNormalizadoProfesor` (con `normalizarTexto()`, igual que Alumno en HU-B-04), más `dniProfesor` como desempate. Migración `20260923200000_profesor_nombre_normalizado_y_leer_permiso`, que también completa las filas existentes.
- **Permiso:** `profesores:leer`, exclusivo de Mesa de Entrada (migración + seed; coincide con `spec_modulo_A.md` §2.4 y con el changelog de esta spec). El Gerente no abre la ficha. El detalle muestra los accesos de edición de HU-D-02/03/04 solo con `profesores:editar`.
- **Entrada al modo edición (HU-D-06 AC1, HU-D-07 AC1):** con `profesores:editar`, el detalle `/profesores/[id]` muestra además el botón «Editar», que abre el modo edición de §2.6/§2.7 en esa misma pantalla, con el formulario precargado. Sin ese permiso el botón no se muestra (el Gerente no lo ve). Para precargar y para la concurrencia optimista, el detalle devuelve también `version` y, en cada materia asociada, `activa` (necesario para marcar las materias inactivas, ver §2.7); ambos campos son aditivos y no cambian el resto del contrato.
- **camelCase**, igual que HU-D-03/04. El detalle devuelve `{ ..., contacto: { telefono, email }, horarios: { LUNES: [{ horaInicio, horaFin }] } }`. Solo aparecen los días que tienen horarios.
- **Materias:** se ordenan por nombre normalizado. El listado muestra las 2 primeras y un contador (`"Física, Matemática +2"`); el detalle, todas.
- **Contrato para `spec_modulo_C.md` §2.7 (unificado en Revisión 2):** `listarOpcionesProfesoresActivos(): Promise<{ id: string; nombre: string; apellido: string; nombreParaMostrar: string }[]>`, expuesta desde `src/server/profesores/profesor.publico.ts` (2.8). Devuelve los activos con el mismo orden que el listado; `nombreParaMostrar` es `"Apellido, Nombre"`. Reemplaza a `listarProfesoresActivosOpciones()`, que ya no existe.

---

### 2.6. Modificar datos del profesor (HU-D-06) — NUEVA en Revisión 2

> **Revisión 3.** **Sin cambios de ruta, schema, pasos, concurrencia optimista ni códigos.** Dos precisiones, la primera mandada por el backlog (HU-A-06, criterio 6): (1) el paso 7 («el email de contacto y el de la cuenta son independientes») deja de valer **solo** para fichas con cuenta: el email nuevo cambia también el de la cuenta (2.9.2), y una ficha con cuenta no puede quedarse sin email (3.13); (2) se puede modificar una ficha inactiva (P-D10). `is_active` sigue sin ser editable desde este endpoint: la baja y la reactivación son 2.10 y 2.11. Desde la pantalla, guardar pide la confirmación de HU-C-25 y avisa si cambia el email de ingreso (mapa DEC-15).


**Ruta:** `PATCH /api/profesores/[id]` (Route Handler en `src/app/api/profesores/[id]/route.ts`)
**Server Action equivalente:** `modificarProfesor()` en `src/server/profesores/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `modificarProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar` (exclusivo de Mesa de Entrada)
**Pantalla:** modo edición de la ficha `/profesores/[id]` (mapa de pantallas §1, "Ficha de profesor"): un único formulario con identidad, contacto y materias, con un solo botón "Guardar cambios". Página completa, banner inline. Mismo patrón que HU-B-06.
**Entrada (HU-D-06 AC1):** desde el detalle del profesor (2.5), con el botón «Editar» (solo con `profesores:editar`). Abre el mismo `/profesores/[id]` en modo edición, con el formulario **precargado** con la identidad y el contacto actuales, las materias actuales (2.7) y la `version` de la ficha.
**Cancelar (HU-D-06 AC4):** vuelve al detalle en modo lectura sin guardar. Si hay cambios sin guardar (en identidad, contacto o materias: el formulario es uno solo), pide confirmación antes de descartarlos; sin cambios, vuelve directo. Mismo patrón `DirtyStateContext` que el alta y que `spec_modulo_K.md` §2.4 y `spec_modulo_L.md` §2.4: el formulario marca el estado "sucio" en el contexto y el diálogo de confirmación protege también la navegación por menú, logo y links (`LinkProtegido`) y la recarga o cierre de la pestaña (`beforeunload`).

```typescript
// src/server/profesores/profesor.schema.ts
// Contacto al modificar: campo ausente = no se toca; null = quitar ese medio; string = nuevo valor.
// Cadena vacía o solo espacios NO significa «quitar»: se rechaza (la UI envía null cuando Mesa vacía un dato que tenía).
export const ContactoModificacionSchema = z.object({
  telefono: z.string().trim().min(1, "Ingresá un teléfono válido").nullable().optional(),
  email: z.string().trim().toLowerCase().min(1, "Ingresá un email válido").email("Ingresá un email válido").max(254).nullable().optional(),
});
export const ModificarProfesorSchema = IdentidadProfesorSchema.partial()
  .extend({
    ...ContactoModificacionSchema.shape, // sin «al menos uno»: se aplica en el servicio (paso 3)
    version: z.number().int().nonnegative(), // concurrencia optimista — obligatorio
  })
  .strict();
export type ModificarProfesorInput = z.infer<typeof ModificarProfesorSchema>;
```
`IdentidadProfesorSchema` se construye con `construirIdentidadProfesorSchema(parametros)` (largo del DNI desde `ParametroSistema`, igual que 2.1): identidad con las **mismas validaciones que el alta** (HU-D-06 AC1). Un `telefono` o `email` con valor recibe el mismo formato y la misma normalización que 2.2 (8-15 dígitos, email en minúsculas de hasta 254 caracteres). `.strict()` rechaza `is_active`, `usuario_id` y cualquier campo ajeno (AC5). La regla «al menos un medio de contacto» tiene la excepción del paso 3 (HU-D-06 AC1, ver N-2).

**Comportamiento esperado (`profesor.service.ts` → `modificarProfesor`), dentro de una única `prisma.$transaction`:**
1. El profesor debe existir: `404 PROFESOR_NO_ENCONTRADO`. Si ningún campo cambia respecto de los valores actuales: `200` con `campos_modificados: []` sin escribir.
2. Si viene `dni`: unicidad **excluyendo al propio profesor**, contra todos los demás, activos e inactivos: mismo código y criterio que 2.1 (`409 DNI_DUPLICADO`). Defensa del constraint (`P2002`) traducida al mismo `409`.
3. **Contacto — aprobado por el PO el 29/09/2026 (N-2).** Solo aplica si el request incluye `telefono` o `email` (con valor o `null`):
   - Si el request **no** incluye ninguno de los dos, no se valida contacto: un profesor dado de alta solo con identidad (2.1) puede corregir su DNI, nombre o apellido sin inventarle un medio de contacto.
   - Si incluye alguno, se arma el **estado resultante**: por cada medio, ausente = valor actual, `null` = vacío, string = valor nuevo (con el formato de 2.2).
   - **No puede quedar sin ningún medio:** si el profesor **ya tenía** al menos un medio y el estado resultante no tiene ninguno (p. ej. `{ "telefono": null }` cuando el email ya estaba vacío), se rechaza con `400` y el mensaje de 2.2 ("Ingresá al menos un teléfono o un email de contacto", campo `telefono`); la ficha no cambia. Modificar no puede dejarlo sin el último que tenía. Si no tenía ninguno y el request no agrega ninguno (p. ej. `email: null` sobre un email ya vacío), no es error ni cambio.
   - **Unicidad del email:** si `email` es un string distinto del actual, se valida con `verificarEmailNoAsociadoAOtraCuenta()`, igual que el alta (2.1) y 2.2 paso 2: `409 EMAIL_YA_ASOCIADO` ("Ese email ya está asociado a otra cuenta"), sin revelar a quién pertenece. Un email sin cambios no se revalida.
4. Si cambian `nombre` o `apellido`: recalcular `nombreNormalizadoProfesor` y `apellidoNormalizadoProfesor` con `normalizarTexto()`. Mantiene el orden del listado (`profesores_orden_listado_idx`).
5. **Concurrencia optimista (Regla N.° 7):**
   ```typescript
   const r = await tx.profesor.updateMany({
     where: { idProfesor: id, version: input.version },
     data: { ...camposModificados, version: { increment: 1 }, modificadoPorUsuarioId: usuarioId },
   });
   if (r.count === 0) throw new ServiceError("CONFLICTO_EDICION_CONCURRENTE");
   ```
6. Solo se escriben los campos enviados cuyo valor cambia (diff, AC3). Quitar un medio (`null`) deja la columna en `NULL` y cuenta en `campos_modificados`. `updatedAtProfesor` lo actualiza Prisma (`@updatedAt`).
7. **El email de contacto y el email de la cuenta de acceso son independientes** (3.1): cambiar el primero **no** modifica `Usuario.emailUsuario`. Es distinto de HU-B-06, donde el alumno con cuenta sí sincroniza ambos.

**Modelo (cambio en `schema.prisma`):** `Profesor` agrega `version Int @default(0)`. Migración aditiva.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "campos_modificados": ["telefono", "email"], "version": 3 }, "error": null }
```
**Errores esperados:** `400` (validación, incluido «no puede quedar sin ningún medio de contacto») · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `409 DNI_DUPLICADO` · `409 EMAIL_YA_ASOCIADO` ("Ese email ya está asociado a otra cuenta") · `409 CONFLICTO_EDICION_CONCURRENTE` ("La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.").

---

### 2.7. Modificar las materias asociadas a un profesor (HU-D-07) — NUEVA en Revisión 2

> **Revisión 3.** **Sin cambios.** El modal «Ver turnos» de este flujo sigue siendo por materia y su ruta propia (`GET …/materias/[materiaId]/turnos-futuros`) no cambia; la lista de HU-D-08 es otra ruta, de todas las materias (2.10.2). La ruta ahora también la puede consultar el Gerente (`profesores:leer`), solo lectura. Quitar una materia con clases futuras sigue bloqueado como en el Sprint 2.


**Ruta:** `PUT /api/profesores/[id]/materias` (Route Handler en `src/app/api/profesores/[id]/materias/route.ts`)
**Server Action equivalente:** `actualizarMateriasProfesor()` en `src/server/profesores/actions.ts` (nombre a confirmar contra el código)
**Servicio:** `actualizarMateriasDeProfesor()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:editar` (exclusivo de Mesa de Entrada)
**Pantalla:** dentro del mismo modo edición de 2.6: buscador + casillas de las materias activas, con las actuales marcadas (mismo selector de HU-D-03). Cancelar y la confirmación ante cambios sin guardar son las de 2.6 y alcanzan también a los cambios de materias. Las materias asociadas que estén inactivas se listan igual, marcadas (regla siguiente).

```typescript
export const ActualizarMateriasProfesorSchema = z.object({
  materia_ids: z.array(z.string().cuid()).max(100)
    .refine((ids) => new Set(ids).size === ids.length, "No repitas materias"),
}).strict(); // el CONJUNTO FINAL deseado; puede quedar vacío
```
Se envía el **conjunto final**, no altas y bajas sueltas: el servidor calcula la diferencia. Un profesor sin materias es un estado válido (2.4 ya lo contempla con un aviso, sin bloquear).

**Materias asociadas que están inactivas (HU-D-07 AC1):** el selector lista las materias activas **más todas las que el profesor ya tiene asociadas, aunque estén inactivas** (dato `activa` del detalle, 2.5). Las inactivas aparecen **tildadas y con la etiqueta «Inactiva»**, para que no se quiten por accidente al enviar el conjunto final; solo dejan de estar asociadas si Mesa de Entrada las destilda de forma explícita. Una materia inactiva que el profesor no tiene asociada no se ofrece. En el servidor, una inactiva que ya estaba asociada y sigue en el conjunto no está en `agregar`, así que no se revalida ni da `MATERIA_INACTIVA`; quitarla sigue la misma regla de turnos futuros que cualquier otra (paso 4). `MATERIA_INACTIVA` solo aplica a las materias que se intentan **agregar**.

**Comportamiento esperado (`profesor.service.ts` → `actualizarMateriasDeProfesor`), en una única `prisma.$transaction`, todo o nada (3.3):**
1. Tomar la fila del profesor: `updateMany` con `where: { idProfesor: id, activoProfesor: true }` que solo registra `modificadoPorUsuarioId`; bloquea la fila hasta el `COMMIT` (patrón de 2.3). `count === 0`: `404 PROFESOR_NO_ENCONTRADO` o `409 PROFESOR_INACTIVO`.
2. Leer el conjunto actual y calcular `agregar = deseado − actual` y `quitar = actual − deseado`. Si ambos están vacíos: `200` con `sin_cambios: true`.
3. **Agregar:** `bloquearMateriasParaAsociar(agregar, tx)` (`spec_modulo_L.md` §2.3): todas las de `agregar` deben existir y estar activas, con los mismos códigos y mensajes que 2.3 (`404 MATERIA_NO_ENCONTRADA` si algún id no existe; `409 MATERIA_INACTIVA` con `materia_ids_invalidas`). Insertar `ProfesorMateria` con `createdAtProfesorMateria` y `creadoPorUsuarioId`.
4. **Quitar (HU-D-07 AC3):** por cada materia a quitar, **en este orden**: (a) eliminar la fila `ProfesorMateria`; (b) invocar `contarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, tx)` (`spec_modulo_C.md` §2.15); (c) si `confirmados > 0`, acumular `{ materia_id, cantidad }`. Si al final hay al menos una materia con turnos futuros: lanzar `409 MATERIA_CON_TURNOS_FUTUROS` con el mensaje literal de la HU, **indicando cuántos**: "No se puede quitar: el profesor tiene N turnos futuros de esta materia" (N = `confirmados` de esa materia; redacción del backlog del 28/09), y `detalle: [{ materia_id, cantidad }]`; **toda la transacción se revierte**, la materia sigue asociada y no se quita ninguna.
   - **Presentación del rechazo (HU-D-07 AC3, backlog del 28/09):** (1) la **casilla de la materia bloqueada vuelve a quedar tildada**; el resto de los cambios del formulario queda **sin guardar** y se puede reintentar (el guardado es todo o nada). (2) **Debajo de esa materia** aparece el aviso corto "No se puede quitar: el profesor tiene N turnos futuros de esta materia" con el enlace **"Ver turnos"**. (3) "Ver turnos" abre un **modal** con el mensaje "El profesor tiene N turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar." (N = `total` de la ruta de «Lista de turnos futuros», más abajo) y la lista de turnos con **fecha, hora, aula, cupo ocupado (p. ej. 3/5) y estado**, **paginada de a 10**, que sale de esa misma ruta. (4) Cada turno enlaza a su Detalle de turno, que se abre **en una pestaña nueva** (`target="_blank"` con `rel="noopener"`) para no perder los cambios de la ficha; ahí Mesa de Entrada puede cancelarlo (HU-C-05). Resueltos todos, reintenta quitar la materia. Todo esto es interfaz: el servidor solo devuelve el `409` con `detalle`.
   - **De dónde sale la lista:** de la ruta propia `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros?pagina=n` (sección «Lista de turnos futuros para el modal», debajo de los errores de esta sección), que llama al servicio público de Turnos `listarTurnosFuturosDeProfesorPorMateria()` (`spec_modulo_C.md` §2.15). No se usa el listado `GET /api/turnos` (`spec_modulo_C.md` §2.7 no acepta filtros por materia ni por estado, HU-C-02 AC6). Los turnos **pasados o cancelados no bloquean** la desasociación.
   - **El orden (a) → (b) es deliberado:** el `DELETE` toma un bloqueo exclusivo sobre la fila; `profesorActivoDictaMateria(…, tx)` de Turnos toma `FOR SHARE` sobre esa misma fila (2.8). Si Mesa está creando un turno justo ahora, el `DELETE` espera a que confirme y el recuento posterior lo ve; si llega después, ya no encuentra la asociación y la rechaza. Es lo que impide dejar un turno futuro con un profesor que ya no dicta la materia (Regla N.° 7).
   - "Turno futuro" = `DISPONIBLE` o `COMPLETO` con `fecha + hora_inicio` posterior a ahora. Los turnos **pasados no bloquean**, y siguen mostrando esa materia (HU-D-07 AC3; el historial no se altera).
   - Los turnos `PENDIENTE` de ese profesor y materia **no bloquean** (la HU los excluye), pero pasarán a fallar con `PROFESOR_NO_DICTA_MATERIA` al confirmarse (`spec_modulo_C.md` §2.2). La respuesta informa cuántos hay (`pendientes_afectados`) para que la UI los avise (se mantiene por decisión del PO, 29/09/2026: aviso informativo fuera de los AC).
5. **No se toca el horario de atención (AC5, reformulado en el backlog v2):** `HorarioProfesor` no tiene `materiaId` (es un patrón semanal general del profesor), así que quitar una materia no afecta ni modifica ningún horario y no hay franjas huérfanas. AC5 no requiere trabajo adicional.
6. La baja del vínculo `ProfesorMateria` es un `DELETE` físico sobre una tabla de asociación: excepción documentada a la Regla N.° 1, igual que la baja de `TurnoAlumno` (`spec_modulo_C.md` §3.13). Se conserva la trazabilidad de las altas (`creadoPorUsuarioId`); la baja queda reflejada en `modificadoPorUsuarioId` del profesor.

**Respuesta `200 OK`:**
```json
{ "data": { "agregadas": ["cuid"], "quitadas": [], "pendientes_afectados": 0, "sin_cambios": false }, "error": null }
```
Si el conjunto enviado coincide con el actual (paso 2), la respuesta es `200` con `{ "agregadas": [], "quitadas": [], "pendientes_afectados": 0, "sin_cambios": true }`: no se escribe nada y equivale a no haber llamado a 2.7 (no muestra mensaje de éxito propio).

**Convención de nombres de campos:** el `POST` de §2.3 conserva los nombres del código de Sprint 1 (camelCase: `materiaIds`, `materiaIdsInvalidas`); los contratos nuevos de Sprint 2 (§2.6, §2.7 y la ruta de turnos futuros) usan snake_case (`materia_ids`, `materia_ids_invalidas`, `campos_modificados`, `pendientes_afectados`, `sin_cambios`), como el resto de los módulos nuevos. No se renombra el `POST` existente porque no es parte de estas HU.

**Errores esperados:** `400` · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `404 MATERIA_NO_ENCONTRADA` (algún id de `agregar` no corresponde a ninguna materia, como en 2.3) · `409 PROFESOR_INACTIVO` · `409 MATERIA_INACTIVA` (con `materia_ids_invalidas`) · `409 MATERIA_CON_TURNOS_FUTUROS` (con `detalle: [{ materia_id, cantidad }]`).

#### Lista de turnos futuros para el modal «Ver turnos» (HU-D-07 AC3)

**Ruta:** `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros?pagina=n`
**Route Handler:** `src/app/api/profesores/[id]/materias/[materiaId]/turnos-futuros/route.ts`
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarTurnosFuturosDeMateria()` en `src/server/profesores/profesor.service.ts`
**Permiso requerido:** `profesores:leer` (exclusivo de Mesa de Entrada, como el resto de la ficha)

```typescript
// src/server/profesores/profesor.schema.ts
export const ListarTurnosFuturosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
}).strict(); // por_pagina no es parámetro: es fijo, 10
```

**Comportamiento (`profesor.service.ts` → `listarTurnosFuturosDeMateria(profesorId, materiaId, pagina)`):**
1. El profesor debe existir: `404 PROFESOR_NO_ENCONTRADO`. La materia debe existir, activa o inactiva (`obtenerMateriasPorIds()`, `spec_modulo_L.md` §2.5): `404 MATERIA_NO_ENCONTRADA`.
2. Delegar en `listarTurnosFuturosDeProfesorPorMateria(profesorId, materiaId, { pagina, porPagina: 10 })` de `spec_modulo_C.md` §2.15 (servicio público de Turnos: este módulo nunca lee la tabla `turnos`, Regla N.° 3). Devuelve solo turnos `DISPONIBLE`/`COMPLETO` con `fecha + hora_inicio` posterior a ahora; los pasados, `CANCELADO` y `PENDIENTE` no aparecen. Orden cronológico ascendente (fecha y hora de inicio; a confirmar con C §2.15).
3. No exige que la materia siga asociada al profesor (tras el rechazo de 2.7 el vínculo se conservó, porque la transacción se revirtió); solo lectura, sin transacción.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [
      { "turno_id": "cuid", "fecha": "2026-10-06", "hora_inicio": "10:00", "hora_fin": "11:00", "aula": "Aula 2", "alumnos_inscriptos": "3/5", "estado": "DISPONIBLE" }
    ],
    "total": 12, "pagina": 1, "por_pagina": 10
  },
  "error": null
}
```
**Errores esperados:** `400` (`pagina` inválida o parámetro ajeno) · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `404 MATERIA_NO_ENCONTRADA`.

Cada fila enlaza, por su `turno_id`, al Detalle de turno (`spec_modulo_C.md` §2.4), que se abre en pestaña nueva.

**Guardado desde la UI:** el mapa de pantallas pide un solo "Guardar cambios" para toda la ficha, pero son dos endpoints (2.6 y 2.7). La UI llama **primero a 2.7** (la regla de negocio que más probablemente falle) y **después a 2.6**. Si 2.6 falla, las materias ya quedaron guardadas y el banner lo informa: no hay transacción entre los dos.

**Mensajes al guardar (HU-D-06 AC3, HU-D-07 AC4):**
| Caso | Llamadas | Mensaje |
|---|---|---|
| Cambiaron datos (con o sin materias) y todo salió bien | 2.7 (si hubo cambios de materias) y 2.6 | «Profesor actualizado correctamente» |
| Solo cambiaron las materias | 2.7 | «Materias asignadas correctamente» (el mismo del wizard de alta, HU-D-03) |
| 2.7 salió bien y 2.6 falló | 2.7 ok, 2.6 error | Banner: «Las materias se guardaron, pero los datos no: <error>» (el formulario conserva lo escrito y se reintenta solo 2.6) |
| 2.7 falló | 2.7 error | El error de 2.7 (p. ej. `MATERIA_CON_TURNOS_FUTUROS`); 2.6 no se llama |

**Mensaje de HU-D-07 AC4 (decisión del PO, 29/09/2026):** al guardar solo las materias desde la ficha se muestra «Materias asignadas correctamente», el mismo texto que el wizard de alta (HU-D-03, ya en Done, sin cambios de código). El AC cita el literal «Materias del profesor actualizadas» pero también pide que sea el «mismo mensaje que el de la asociación inicial»; los dos textos del backlog no coinciden y el PO resolvió unificar con el del wizard. Divergencia respecto del literal entrecomillado del AC, aceptada por el PO.


**Nota de sincronización (HU-D-07, implementada el 01/10/2026 — `docs/tasks/Sprint 2/HU-D-07.md` §11):**
- **Nombres reales (Regla N.° 11):** Server Action `actualizarMateriasProfesor(profesorId, materiaIds: string[])` en `src/server/profesores/actions.ts` (recibe el arreglo, no `FormData`: el conjunto vacío es válido); servicios `actualizarMateriasDeProfesor()` y `listarTurnosFuturosDeMateria()` en `profesor.service.ts`; schemas `ActualizarMateriasProfesorSchema` (`z.cuid()` de Zod 4) y `ListarTurnosFuturosQuerySchema` en `profesor.schema.ts`; `PUT` en `src/app/api/profesores/[id]/materias/route.ts`.
- **`version`:** el paso 1 **no** la incrementa. La UI guarda después 2.6 con la `version` precargada; si 2.7 la subiera, 2.6 daría un conflicto falso.
- **`409 MATERIA_CON_TURNOS_FUTUROS`:** con una sola materia, `message` es el literal de la HU con su N; con varias, un mensaje general, y la UI arma un aviso por materia con `detalle[].cantidad`.
- **Mensaje de AC4:** la implementación usa el literal del AC, «Materias del profesor actualizadas» (`?actualizada=materias`), que coincide con el mensaje de HU-D-03 fuera del wizard. **Pendiente de confirmación del PO** frente a la nota «Mensaje de HU-D-07 AC4» de arriba.
- **Pendiente (Regla N.° 2):** de las bajas solo queda `Profesor.modificadoPorUsuarioId`/`updatedAtProfesor`; no se registra qué materia se quitó. Sin tabla nueva hasta que se decida.

---

### 2.8. Servicios públicos del módulo

> **Revisión 3.** La tabla **no cambia**: ninguna función conserva menos que antes. La función nueva de D (`obtenerProfesoresBasicos`) y las lecturas que D consume de otros módulos están en 2.13. `profesor.publico.ts` sigue sin importar módulos de dominio. `obtenerNombresProfesores` y `obtenerOpcionProfesorDeUsuario` siguen sin filtrar por activo, y ahora hay fichas inactivas de verdad (P-D12).


Conforme a la Regla N.° 3 (ampliados en Revisión 2). Funciones en `src/server/profesores/profesor.publico.ts`. **No importa nada de otros módulos** (evita ciclos con Turnos). El parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador.

**Qué puede importar `profesor.publico.ts` (precisión del 29/09/2026):** `@prisma/client` (solo tipos), `@/lib/prisma`, `@/server/shared/*`, `@/types/profesor.types` y, únicamente para **reexportar** o delegar en funciones existentes, el service de su propio módulo (`@/server/profesores/profesor.service`, siempre con el alias `@/`, Regla N.° 11). También puede importar **utilidades puras de `src/lib/`** (sin `prisma` ni imports de `src/server/**`): hoy `@/lib/profesor-listado` (formato «Apellido, Nombre») y `@/lib/horario-atencion` (formato de hora), para que el público y el service compartan un único formato. Nada de otros módulos de dominio; lo verifica `src/server/publico.aislamiento.test.ts`.

| Función | Devuelve | Consumidores |
|---|---|---|
| `listarOpcionesProfesoresActivos(db?)` | `{ id, nombre, apellido, nombreParaMostrar }[]`, orden `apellidoNormalizado, nombreNormalizado` (con el DNI como último desempate, igual que el service) (**unifica** la función de 2.5; ya no hay una segunda) | `spec_modulo_C.md` §2.7 (filtro del Gerente) |
| `obtenerHorariosDeAtencion(profesorId, db?)` | `{ horario_id, dia_semana, hora_inicio, hora_fin }[]`, orden día y hora. `dia_semana` es el valor del enum (`"LUNES"` … `"DOMINGO"`) y `hora_inicio` / `hora_fin` son `"HH:mm"` en 24 h con cero a la izquierda (formato confirmado el 29/09/2026) | `spec_modulo_C.md` §2.8, §2.9 |
| `obtenerHorarioDeProfesor(profesorId, horarioId, db?)` | la fila anterior, o `null` si no pertenece a ese profesor | `spec_modulo_C.md` §2.9 |
| `obtenerNombresProfesores(ids, db?)` | `Record<id, "Apellido, Nombre">` | `spec_modulo_E.md` §2.3 |
| `profesorActivoDictaMateria(profesorId, materiaId, db?)` | `boolean` (**existente**) | `spec_modulo_C.md` §2.1, §2.2, §2.8, §2.9 |

**Otros servicios públicos de este módulo que consumen otras specs** (documentados aquí por la Regla N.° 3; las firmas salen de lo que cada consumidor declara y hay que confirmarlas contra el código existente):

| Función | Devuelve | Consumidores | Origen |
|---|---|---|---|
| `listarProfesoresActivosPorMateria(materiaId, db?)` | `{ id, nombre, apellido }[]`, orden apellido, nombre e id. **Reexportada** desde el service (firma confirmada el 29/09/2026) | `spec_modulo_C.md` §2.2 paso 4, §2.6, §2.8.1 | existente (Sprint 1) |
| `estaDentroDeHorarioAtencion(profesorId, fecha, horaInicio, horaFin, db?)` | `boolean` (contrato completo en 2.4). **Reexportada** desde `profesor.service.ts` por `profesor.publico.ts` (29/09/2026) | `spec_modulo_C.md` §2.1, §2.2, §2.6, §2.11 | existente (HU-D-04) |
| `obtenerOpcionProfesorDeUsuario(usuarioId, db?)` | `{ id, nombreParaMostrar } \| null`: la opción de profesor de la ficha vinculada a la cuenta (`Profesor.usuarioId`), o `null` si no tiene ficha. **No filtra por activo** (forma confirmada el 29/09/2026) | `spec_modulo_C.md` §2.4, §2.7; `spec_modulo_E.md` §2.1, §2.2, §2.3; `spec_modulo_J.md` §2.1, §2.2 | nueva (Revisión 2) |
| `obtenerOpcionProfesorActivo(profesorId, db?)` | `{ id, nombreParaMostrar } \| null`: la opción de un profesor **activo**, o `null` (forma confirmada el 29/09/2026) | `spec_modulo_C.md` §2.1, §2.2; `spec_modulo_J.md` §2.1, §2.2 | nueva (Revisión 2) |
| `obtenerMateriasDelProfesor(profesorId, db?)` | `{ id, nombre, codigo: string \| null, activa: boolean }[]`: **todas** las materias asociadas, activas o inactivas, con el campo `activa`; quien la consume filtra (p. ej. el Profesor en `spec_modulo_J.md` §2.2 solo opera materias activas) | `spec_modulo_J.md` §2.2 (nota) | existente; publicada en `profesor.publico.ts` (29/09/2026) |

**Requisito nuevo sobre `profesorActivoDictaMateria`:** cuando recibe `db` (o sea, dentro de una transacción), debe leer la fila de `profesor_materia` con **`SELECT … FOR SHARE`**. Es la contraparte del bloqueo de 2.7 paso 4. Sin `db`, se comporta como hasta ahora. **Implementado el 29/09/2026** en `profesor.publico.ts`: el parámetro `db` no tiene valor por defecto (para distinguir «con `db`» de «sin `db`»); sin `db` delega en la versión del service, y con `db` reproduce sus mismas condiciones (profesor activo y relación con la materia) con `FOR SHARE OF` sobre `profesor_materia` únicamente, sin bloquear la fila del profesor.

---

### 2.9. Alta del profesor con cuenta de acceso y sincronización del email (HU-A-06 con HU-D-01, HU-D-02 y HU-D-06) — NUEVA en Revisión 3

**Qué resuelve.** Cuando Mesa de Entrada registra a un profesor con email, la ficha y la cuenta de acceso se crean **en la misma transacción**: el usuario es el email, la contraseña inicial es el DNI y la cuenta queda marcada «Debe cambiar la contraseña» (HU-A-06, criterios 1, 2, 3 y 5). Desde ahí, el email de la ficha es el de la cuenta (criterio 6). La cuenta y la marca son de A (`spec_modulo_A.md` 2.6 y 2.9); D solo las pide.

#### 2.9.1. Alta con cuenta (HU-A-06, criterios 1, 2, 3 y 5)

**Ruta:** la de 2.1, `POST /api/profesores` · **Server Action equivalente:** `crearProfesor()` (la de 2.1) · **Servicio:** `crearProfesor(input, usuarioRegistranteId)` en `profesor.service.ts` (el de 2.1) · **Permiso requerido:** `profesores:crear` (sin cambios; solo Mesa de Entrada).

**No hay ruta ni schema nuevos.** El schema de 2.1 (`construirAltaProfesorSchema`) ya admite `telefono` y `email` opcionales; no cambia. Lo que cambia es el efecto de enviar `email`.

**Comportamiento esperado.**
- **Sin `email`:** exactamente el comportamiento de 2.1, pasos 1 a 5. No se crea cuenta y `usuarioId` queda nulo (la ficha queda «Sin cuenta»). Es el camino que usan los tests y las colecciones de Sprint 1 y 2 (P-D1).
- **Con `email`:** se valida `telefono` si vino (igual que 2.2) y se sigue este orden:
  1. Unicidad del DNI contra todas las fichas, activas e inactivas (2.1, pasos 1 y 2): `409 DNI_DUPLICADO`.
  2. Unicidad del email frente a las cuentas (`verificarEmailNoAsociadoAOtraCuenta`, igual que hoy): `409 EMAIL_YA_ASOCIADO`, sin revelar de quién.
  3. En **una única `transaccion`** (PR 0 §2.16, en lugar de `prisma.$transaction`; mismo alcance):
     1. Revalidar el DNI (2.1, paso 3).
     2. `crearCuentaParaFicha(tx, { email, dni, rol: "PROFESOR", ip })` (A, 2.6.1): crea el `Usuario` con el DNI como contraseña inicial —guardada solo como hash—, la marca `debeCambiarPassword` y el evento de seguridad `CUENTA_CREADA`. Si el email ya pertenece a otra cuenta (una alta simultánea lo pudo ocupar): `409 EMAIL_YA_ASOCIADO` y no se crea nada.
     3. Insertar el `Profesor` con `usuarioId` = la cuenta creada, `activoProfesor = true`, `version = 0`, el contacto y el usuario registrante (2.1, paso 4).
  4. Si la inserción falla por el índice único del DNI (`P2002`), el error se captura **fuera** de la transacción —ya deshecha— y se traduce al mismo `409 DNI_DUPLICADO`. **Si no se puede crear la cuenta tampoco se registra la ficha, y al revés** (criterio 2).
  5. Trazabilidad: opción (a), como hoy (`creadoPorUsuarioId`, `createdAtProfesor`). El alta no emite eventos (sección 4); la cuenta registra aparte su evento de seguridad `CUENTA_CREADA`.
- El rol lo fija D (`PROFESOR`); nunca viene del cliente (criterio 2).
- La ficha **no** crea cuentas retroactivas: modificar una ficha anterior, aunque se le cargue un email, no crea su cuenta (criterio 8; ver 3.13).
- La contraseña inicial es el DNI: el servicio nunca la guarda, la devuelve ni la registra en logs (3.16).

**Respuesta `201 Created`:** la de 2.1 (con `telefono` y `email`) más un campo extra opcional.
```json
{ "data": { "id": "cuid", "nombre": "Ana", "apellido": "Gómez", "dni": "28456789", "is_active": true,
            "telefono": null, "email": "ana.gomez@mail.com",
            "cuenta": { "creada": true, "debe_cambiar_password": true } }, "error": null }
```
Sin `email`, `cuenta` es `{ "creada": false }`. Los consumidores de Sprint 1 y 2 ignoran el campo extra.

**Pantalla (`/profesores/nuevo`, P-42).** El paso 1 del wizard (2.1) suma al formulario el campo **Email**, **obligatorio**, con la ayuda «Ingresá el email: con él se crea la cuenta de acceso». Antes de guardar pide la confirmación de HU-C-25. Al terminar, el toast pasa a «Profesor registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.» y el wizard sigue con los pasos 2 y 3 sin cambios. Los textos van al archivo central (HU-C-23). El aviso de email en uso no revela a quién pertenece.

**Errores esperados** (se suman a los de 2.1):
- `400 VALIDATION_ERROR` — `email` inválido o `telefono` fuera de 8 a 15 dígitos.
- `409 EMAIL_YA_ASOCIADO` — el email pertenece a otra cuenta; se muestra junto al campo.
- `409 DNI_DUPLICADO` — como en 2.1.
- `409 TRANSACCION_OCUPADA` — la transacción no pudo tomar sus bloqueos (PR 0 §2.16).

**Carreras (Regla N.° 7).** Dos altas con el mismo email: A resuelve con `INSERT … ON CONFLICT DO NOTHING RETURNING`; una gana y la otra recibe `409 EMAIL_YA_ASOCIADO`. Dos altas con el mismo DNI: gana la del índice único y la otra recibe `409 DNI_DUPLICADO`, sin cuenta huérfana (la transacción se deshace entera).

#### 2.9.2. El email de la ficha es el de la cuenta (HU-A-06, criterio 6)

Alcanza a 2.2 (`PATCH /api/profesores/[id]/contacto`) y a 2.6 (`PATCH /api/profesores/[id]`). **Solo cambia el comportamiento de las fichas con cuenta** (`usuarioId` no nulo); una ficha sin cuenta se comporta exactamente como hasta hoy.

1. Si el pedido trae un `email` distinto del actual de la ficha y la ficha tiene `usuarioId`, el servicio llama, **dentro de la misma transacción** que actualiza la ficha, a `cambiarEmailCuenta(tx, { usuarioId, email })` (A, 2.9). Esa función valida la unicidad (`409 EMAIL_YA_ASOCIADO`, sin revelar de quién) y **no revoca sesiones** (DEC-44 del mapa): la persona sigue con su sesión e ingresa con el email nuevo la próxima vez.
2. Si el `email` recibido es **igual** al actual, no se revalida ni se llama a A (evita chocar con la propia cuenta). Es el mismo criterio que 2.6 ya aplica («un email sin cambios no se revalida»); se extiende a 2.2 solo para fichas con cuenta.
3. Si falla A, la ficha **no** cambia (misma transacción). Si falla la ficha, la cuenta no cambia.
4. Una ficha con cuenta **no puede quedarse sin email**: en 2.6, `email: null` (quitar) responde `400 VALIDATION_ERROR` en el campo `email` (P-D13, 3.13). Una ficha sin cuenta puede quitarlo como hasta hoy (N-2 de 2.6).
5. Esta regla reemplaza al paso 7 de 2.6 («el email de contacto y el de la cuenta son independientes») **solo** para las fichas con cuenta (T5).
6. Editar el email de una ficha **inactiva** con cuenta cambia el de su cuenta inactiva (P-D10).
7. La pantalla de edición (2.6) avisa, antes de guardar, que cambiar el email cambia también el usuario con el que ingresa (DEC-15 del mapa) y pide la confirmación de HU-C-25.

**Respuesta.** Las de 2.2 y 2.6, sin campos nuevos. **Errores:** los de cada sección; `409 EMAIL_YA_ASOCIADO` ahora también puede venir de A para una ficha con cuenta.

---

### 2.10. Desactivar un profesor (HU-D-08, criterios 1 a 4, 6 y 8) — NUEVA en Revisión 3

**Qué resuelve.** El Gerente da de baja a un profesor que deja de trabajar en el centro: la ficha pasa a inactiva (baja lógica, Regla N.° 1), su cuenta se desactiva y sus sesiones se cierran. Todo lo ya registrado —clases pasadas, historiales, indicadores, materias y horario— queda como está. **Si tiene clases futuras confirmadas, la baja se rechaza** y el Gerente las resuelve desde un modal: cancelarlas o pasarlas a otro profesor, en lote.

**Archivos (Regla N.° 11):** `src/server/profesores/profesor.estado.service.ts` (`obtenerImpactoBajaProfesor`, `desactivarProfesor`, `reactivarProfesor`, `listarTurnosFuturosParaBaja`, `cancelarTurnosFuturosDeProfesor`, `previsualizarCambioDeProfesor`, `cambiarProfesorDeTurnosFuturos`), schemas en `profesor.schema.ts` (se agregan), Route Handlers nuevos bajo `app/api/profesores/[id]/{desactivar,reactivar,impacto-baja,turnos-futuros}/`, Server Actions en `actions.ts` (se agregan), tipos en `src/types/profesor.types.ts`. Ninguna ruta ni función existente se mueve. `profesor.estado.service.ts` **no** forma parte de la fachada y la fachada **no** lo importa: así D puede llamar a C sin que C y D se importen en círculo (T6, 3.15).

**Permiso de todas las rutas de 2.10 y 2.11:** `profesores:cambiar_estado`, **solo Gerente** (criterio 8; P-D2). Mesa de Entrada, Profesor y Alumno reciben `403 SIN_PERMISO`. Esas rutas no requieren `turnos:cancelar`: el alcance sobre cada clase lo valida el helper del PR 0 `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId)` (3.11).

#### 2.10.1. La confirmación y la baja (criterios 1 a 4)

**(a) Qué se informa antes de confirmar.** `GET /api/profesores/[id]/impacto-baja` · **Servicio:** `obtenerImpactoBajaProfesor(id)` · **Server Action equivalente:** — (solo Route Handler). Es **informativo**: el servidor recalcula todo al confirmar.

1. La ficha debe existir (`404 PROFESOR_NO_ENCONTRADO`) y estar activa (`409 PROFESOR_YA_INACTIVO`).
2. `clases_futuras`: `contarTurnosFuturosDeProfesor(id)` (C, 2.13.3): `confirmados` (`DISPONIBLE` o `COMPLETO` con inicio posterior al momento actual, convención 4) y `pendientes` (informativo).
3. `motivo_obligatorio`: verdadero si el profesor tiene clases pasadas (`profesorTieneClasesPasadas`, C) **o** registros académicos (`profesorTieneRegistros`, E); ante la duda se pide (P-D7; Regla N.° 1).

```json
{ "data": {
    "profesor": { "id": "cuid", "nombre_para_mostrar": "Gómez, Ana" },
    "clases_futuras": { "confirmados": 12, "pendientes": 2 },
    "tiene_cuenta": true,
    "motivo_obligatorio": true
  }, "error": null }
```
La interfaz arma con esto el texto del criterio 1: «¿Estás seguro de que querés desactivar a <profesor>? No podrá ser asignado a clases nuevas ni ingresar al sistema.» y el campo **Motivo** (hasta 300 caracteres; obligatorio si `motivo_obligatorio`). Es una operación reversible: **no** dice «Esta acción no se puede deshacer.» (HU-C-25, criterio 4). **Flujo de pantalla (mapa P-41).** «Desactivar profesor» llama primero a esta ruta. Si `clases_futuras.confirmados > 0`, **no se pide confirmación**: se muestra «No se puede desactivar: el profesor tiene N clases futuras» y se abre M-40 (2.10.2). Si no, se abre M-43 con el motivo. Si al confirmar el servidor encuentra clases nuevas (paso 4 de (b)), el `409` se muestra en el mismo modal de confirmación (HU-C-25, criterio 6) y de ahí se pasa a M-40.

**Errores:** `401 SESION_INVALIDA` · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `409 PROFESOR_YA_INACTIVO`.

**(b) La baja.** `POST /api/profesores/[id]/desactivar` · **Server Action equivalente:** `desactivarProfesor()` en `actions.ts` · **Servicio:** `desactivarProfesor(id, input, actor)` en `profesor.estado.service.ts`.

```typescript
// src/server/profesores/profesor.schema.ts (se agrega)
export const DesactivarProfesorSchema = z.object({
  motivo: z.string().trim().max(300).optional(),   // vacío = no enviado; hasta 300 caracteres
  version: z.number().int().nonnegative(),
}).strict();
```

**Comportamiento esperado, en una única `transaccion` (PR 0 §2.16):**
1. **Bloquear al profesor** con `bloquear(tx, { recursos: [{ tipo: "profesor", id }] })` (`FOR UPDATE`, nivel 1 del orden de `PR-0.md` §2.10; forma exacta del argumento: la de `PR-0.md` §2.16). Es el **mismo** bloqueo que toman, en su propia llamada a `bloquear`, las operaciones de C que dejan una clase `DISPONIBLE` o `COMPLETO` con ese profesor (3.9, P-D5): una baja y una clase nueva con ese profesor no pueden confirmarse las dos.
2. La ficha debe existir (`404 PROFESOR_NO_ENCONTRADO`), estar activa (`409 PROFESOR_YA_INACTIVO`) y tener la `version` recibida (`409 CONFLICTO_EDICION_CONCURRENTE`).
3. **Motivo:** si `motivo_obligatorio` (arriba) es verdadero y no vino `motivo`: `400 MOTIVO_REQUERIDO`. Si no, es opcional.
4. **Clases futuras (criterio 2):** `contarTurnosFuturosDeProfesor(id, tx)` (C). Con el profesor bloqueado, nadie puede sumarle una clase nueva entre este conteo y el `COMMIT`. Si `confirmados > 0`: `409 PROFESOR_CON_CLASES_FUTURAS` y la transacción se deshace (todavía no se escribió nada).
   ```json
   { "data": null, "error": { "code": "PROFESOR_CON_CLASES_FUTURAS",
       "message": "No se puede desactivar: el profesor tiene 12 clases futuras",
       "total": 12, "pendientes": 2 } }
   ```
   La interfaz abre entonces el modal «No se puede desactivar al profesor» (2.10.2). Las clases `PENDIENTE` **no** bloquean (P-D9).
5. Cambiar el estado con condición atómica (Regla N.° 7):
   ```typescript
   const r = await tx.profesor.updateMany({
     where: { idProfesor: id, activoProfesor: true, version: input.version },
     data: { activoProfesor: false, version: { increment: 1 }, modificadoPorUsuarioId: actor.usuarioId },
   });
   if (r.count === 0) throw new ErrorDeDominio("errores.general.conflictoEdicion");
   ```
6. **Cuenta (criterio 4):** si la ficha tiene `usuarioId`, `desactivarCuenta(tx, usuarioId)` (A, 2.9): la cuenta pasa a inactiva y se revocan **todas** sus sesiones (`sesionesValidasDesde = ahora`, RNF-SEG-04; el momento de inicio de sesión sale de `iat_sesion`, no de `iat`). En el próximo intento de ingreso recibe «La cuenta está inactiva. Comunicate con la administración» (HU-A-01). Una ficha sin cuenta se desactiva igual.
7. `registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "DESACTIVAR", motivo, actor })` (PR 0 §2.13). El servicio compartido lo encola en `despuesDelCommit`: se escribe **después** de confirmada la transacción, con reintento (Regla N.° 2, opción (b); criterio 3).

**Qué no hace la baja:** no toca materias asociadas ni horarios de atención (criterio 5, primera viñeta), clases pasadas, clases dictadas, historiales ni indicadores, ni las clases `PENDIENTE`.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "cuid", "activo": false, "version": 4, "pendientes_afectados": 2 }, "error": null }
```
La interfaz muestra «Profesor desactivado correctamente» (criterio 3). `pendientes_afectados` permite avisar cuántas clases `PENDIENTE` tienen ahora un profesor inactivo (al continuar su configuración se pide elegir uno activo, 3.14). El profesor sigue en el listado (2.5) con la etiqueta «Inactivo» (criterio 5).

**Errores esperados:**
- `400 VALIDATION_ERROR` · `400 MOTIVO_REQUERIDO` (textos en el archivo central, HU-C-23).
- `401 SESION_INVALIDA` · `403 SIN_PERMISO`.
- `404 PROFESOR_NO_ENCONTRADO`.
- `409 PROFESOR_YA_INACTIVO` · `409 PROFESOR_CON_CLASES_FUTURAS` · `409 CONFLICTO_EDICION_CONCURRENTE` · `409 TRANSACCION_OCUPADA`.

Si el servidor rechaza la baja, el motivo se muestra dentro del mismo modal (HU-C-25, criterio 6).

#### 2.10.2. El modal con las clases futuras (criterio 2)

**Ruta:** `GET /api/profesores/[id]/turnos-futuros?materia_id=<id>&pagina=n` · **Servicio:** `listarTurnosFuturosParaBaja(profesorId, query)` en `profesor.estado.service.ts` · **Server Action equivalente:** — (solo Route Handler) · **Permiso requerido:** `profesores:cambiar_estado`.

No reemplaza a `GET /api/profesores/[id]/materias/[materiaId]/turnos-futuros` de 2.7 (modal «Ver turnos» de HU-D-07, por materia, para `profesores:leer`), que **no cambia**.

```typescript
// src/server/profesores/profesor.schema.ts (se agrega)
export const ListarTurnosFuturosBajaQuerySchema = z.object({
  materia_id: z.cuid().optional(),              // ausente = todas las materias
  pagina: z.coerce.number().int().positive().default(1),
}).strict();                                     // por_pagina no es parámetro: es fijo, 10
```

**Comportamiento.**
1. El profesor debe existir (`404 PROFESOR_NO_ENCONTRADO`). No exige que esté activo: el modal también sirve para consultar. Si viene `materia_id` y no existe: `404 MATERIA_NO_ENCONTRADA` (`obtenerMateriasPorIds`, L).
2. Delega en `listarTurnosFuturosDeProfesor(profesorId, { materiaId, pagina, porPagina: 10 })` (C, 2.13.3): solo clases `DISPONIBLE` o `COMPLETO` con inicio posterior al momento actual, por fecha y hora ascendentes e id. Los nombres de las materias se resuelven en lote con `obtenerMateriasPorIds` (L). Qué clases tienen pagos vigentes sale de `turnosConPagosVigentes` (I, 2.13.3), en lote.
3. `materias` lista **todas** las materias de las clases futuras del profesor con su cantidad, **sin** aplicar `materia_id` (así el filtro no se achica al usarlo). La interfaz muestra el filtro «Materia» solo si hay más de una, con textos como «Matemática I (12)»; por defecto, todas. Cambiar el filtro desmarca las clases que quedan fuera (es de pantalla).
4. `seleccion` trae **todas** las clases que cumplen el filtro (no solo la página), para «Seleccionar todas de Matemática I (12)» y para informar cuántas hay seleccionadas y cuántos alumnos abarcan. Tiene un tope de 500: si hay más, `truncada: true` y la pantalla repite el pedido después de procesar.
5. `pendientes`: cantidad de clases `PENDIENTE` del profesor (solo informativo).

```json
{ "data": {
    "profesor": { "id": "cuid", "nombre_para_mostrar": "Gómez, Ana" },
    "items": [
      { "turno_id": "cuid", "fecha": "2026-10-14", "hora_inicio": "10:00", "hora_fin": "11:00",
        "materia": { "id": "cuid", "nombre": "Matemática I" },
        "profesor": { "id": "cuid", "nombre_para_mostrar": "Gómez, Ana" },
        "alumnos_inscriptos": "3/5", "inscriptos": 3, "estado": "DISPONIBLE", "con_pagos": true }
    ],
    "total": 12, "pagina": 1, "por_pagina": 10,
    "materias": [ { "id": "cuid", "nombre": "Matemática I", "cantidad": 12 }, { "id": "cuid", "nombre": "Física", "cantidad": 3 } ],
    "seleccion": { "items": [ { "turno_id": "cuid", "inscriptos": 3 } ], "total": 12, "total_inscriptos": 31, "con_pagos": 4, "truncada": false },
    "pendientes": 2
  }, "error": null }
```
Cada fila tiene «Ver clase»: enlaza por `turno_id` al detalle (`spec_modulo_C.md` 2.4) en una pestaña nueva (`target="_blank"` con `rel="noopener"`), para no perder la selección. `estado` se muestra con `ETIQUETA_ESTADO_TURNO` (Completa, Disponible). **Errores:** `400` (parámetro inválido o ajeno) · `401` · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `404 MATERIA_NO_ENCONTRADA`.

#### 2.10.3. Cancelar las clases seleccionadas (criterio 2)

**Ruta:** `POST /api/profesores/[id]/turnos-futuros/cancelacion` · **Server Action equivalente:** `cancelarTurnosFuturosDeProfesor()` en `actions.ts` · **Servicio:** `cancelarTurnosFuturosDeProfesor(profesorId, input, actor)` en `profesor.estado.service.ts`.

```typescript
export const TurnosLoteSchema = z.object({
  turno_ids: z.array(z.cuid()).min(1).max(100)
    .refine((ids) => new Set(ids).size === ids.length, "No repitas clases"),
}).strict();
```

**Confirmación (HU-C-25).** Antes de enviar, la interfaz confirma informando **cuántas clases y cuántos alumnos inscriptos** abarca (de `seleccion` y de los `items` marcados) y que **no se puede deshacer**. Aclara que se conservan las inscripciones y los pagos y, si alguna de las clases tiene pagos (`con_pagos`), recuerda que el reintegro se registra anulando el pago con el motivo «Reintegro» (HU-I-06; verificación diferida hasta HU-I-06). Esta spec no toca pagos ni cajas.

**Comportamiento esperado.**
1. El profesor debe existir (`404 PROFESOR_NO_ENCONTRADO`) y estar activo (`409 PROFESOR_INACTIVO`).
2. **Alcance, antes de procesar nada (P-D6):** para cada `turno_id`, `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId)`. Si **alguno** no es una clase de ese profesor: `403 SIN_PERMISO` y no se toca ninguna. Una clase que dejó de ser futura o ya está cancelada **sigue siendo del profesor** y no produce un 403 (paso 3).
3. **Cada clase en su propia `transaccion`**, en el orden recibido (3.10):
   `cancelarTurnoPorBajaDeProfesor(tx, { turnoId, profesorId, actor })` (C, 2.13.3). C bloquea, en **una sola** llamada a `bloquear`, al profesor y la clase (`recursos` y `clases`); relee la clase ya bloqueada y aplica **lo mismo que HU-C-05** (`spec_modulo_C.md` 2.10): debe estar `DISPONIBLE` o `COMPLETO`, con inicio posterior al momento actual, y pasa a `CANCELADO` con la condición atómica de esa sección. El trigger `turno_sincronizar_reservas` libera aula, profesor y alumnos. **Las inscripciones y los pagos no se tocan** y las reservas sin pagar dejan de vencer (C, 2.18.6). Después del commit se emite `turno:cancelado` (C, sección 4).
   Si la clase ya no se puede cancelar, esa clase queda en `no_procesadas` con el `code` que devuelve C —`TURNO_CANCELADO`, `TURNO_VENCIDO`, `TURNO_PENDIENTE`, `TURNO_MODIFICADO` o `TRANSACCION_OCUPADA`— y las demás **siguen**.
4. Al terminar se recuenta (`contarTurnosFuturosDeProfesor`, sin bloqueo) y se informa cuántas clases quedan.

**Respuesta `200 OK`** (aunque alguna no se haya podido procesar):
```json
{ "data": {
    "procesadas": 9,
    "no_procesadas": [ { "turno_id": "cuid", "code": "TURNO_VENCIDO", "message": "La clase ya empezó" } ],
    "restantes": { "confirmados": 4, "pendientes": 2 }
  }, "error": null }
```
La interfaz informa cuántas se cancelaron; las que no se pudieron **quedan en la lista, seleccionadas y con su motivo**. Cuando `restantes.confirmados = 0`, ofrece «Desactivar profesor» (2.10.1 b).

**Errores esperados (del pedido entero):** `400 VALIDATION_ERROR` (lista vacía, repetida o de más de 100) · `401` · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `409 PROFESOR_INACTIVO`.

#### 2.10.4. Previsualizar el cambio de profesor (criterio 2)

**Ruta:** `POST /api/profesores/[id]/turnos-futuros/cambio-profesor/previsualizacion` · **Server Action equivalente:** — (solo Route Handler) · **Servicio:** `previsualizarCambioDeProfesor(profesorId, input)` en `profesor.estado.service.ts`. **Solo lectura**: no bloquea ni escribe.

```typescript
export const CambiarProfesorLoteSchema = TurnosLoteSchema.extend({
  profesor_destino_id: z.cuid(),
}).strict();
```

**«Cambiar profesor de las seleccionadas» solo con clases de una misma materia.** Las validaciones del pedido entero (comunes a 2.10.4 y 2.10.5), en este orden:
1. Profesor de origen: existe y está activo (`404 PROFESOR_NO_ENCONTRADO`, `409 PROFESOR_INACTIVO`).
2. Alcance de cada clase: igual que 2.10.3, paso 2 (`403 SIN_PERMISO` sin tocar nada).
3. **Una sola materia:** `obtenerTurnosBasicos(turno_ids)` (C). Si las clases son de más de una materia: `400 MATERIAS_DISTINTAS`, con el texto «Las clases seleccionadas son de distintas materias. Filtrá por materia (por ejemplo, solo Matemática I) para cambiar el profesor.».
4. **Profesor destino** (P-D11): distinto del origen (`400 PROFESOR_DESTINO_IGUAL_ORIGEN`), existente (`404 PROFESOR_NO_ENCONTRADO`), **activo** (`409 PROFESOR_INACTIVO`, con `obtenerOpcionProfesorActivo`) y que **dicta la materia** (`409 PROFESOR_NO_DICTA_MATERIA`, con `profesorActivoDictaMateria`). La interfaz ofrece solo `listarProfesoresActivosPorMateria(materiaId)` menos el origen, así que estos errores solo aparecen ante una llamada directa o una carrera.

Con eso, para **cada clase** se informa, sin escribir, si el cambio sería posible (C, `evaluarCambioDeProfesor`):

| `resultado` | Texto en pantalla | Cuándo |
|---|---|---|
| `SE_PUEDE` | «Se puede cambiar» | Clase `DISPONIBLE` o `COMPLETO` futura, dentro del horario de atención del destino (`estaDentroDeHorarioAtencion`) y sin otra clase superpuesta del destino (fórmula de 3.4, excluyendo la propia clase) |
| `FUERA_DE_HORARIO` | «Fuera de su horario de atención» | La clase cae fuera de los horarios de atención del destino. Se evalúa **antes** que la ocupación |
| `OCUPADO` | «Tiene otra clase en ese horario» | El destino tiene otra clase `DISPONIBLE` o `COMPLETO` superpuesta |
| `NO_DISPONIBLE` | «Esta clase ya no se puede cambiar» | Cancelada, ya empezada, `PENDIENTE` o que dejó de ser del profesor |

```json
{ "data": {
    "resultados": [ { "turno_id": "cuid", "resultado": "SE_PUEDE" }, { "turno_id": "cuid", "resultado": "OCUPADO" } ],
    "se_pueden": 1, "no_se_pueden": 1
  }, "error": null }
```
La interfaz usa `se_pueden` para el botón «Confirmar cambio (N clases)». **Es una vista previa**: puede cambiar antes de confirmar, y 2.10.5 revalida cada clase.

#### 2.10.5. Confirmar el cambio de profesor (criterio 2)

**Ruta:** `POST /api/profesores/[id]/turnos-futuros/cambio-profesor` · **Server Action equivalente:** `cambiarProfesorDeTurnosFuturos()` en `actions.ts` · **Servicio:** `cambiarProfesorDeTurnosFuturos(profesorId, input, actor)` en `profesor.estado.service.ts`. Cuerpo: `CambiarProfesorLoteSchema` (2.10.4).

**Confirmación (HU-C-25):** informa cuántas clases se van a cambiar, a qué profesor y que las inscripciones y los pagos de esas clases **no cambian**.

**Comportamiento esperado.**
1. Las validaciones del pedido entero de 2.10.4 (1 a 4), con los mismos códigos.
2. **Cada clase en su propia `transaccion`**, en el orden recibido (3.10): `cambiarProfesorDeTurno(tx, { turnoId, profesorOrigenId, profesorDestinoId, actor })` (C, 2.13.3). C bloquea, en **una sola** llamada a `bloquear`, a **los dos profesores** (por id ascendente) y la clase; relee la clase ya bloqueada y **revalida todo** —sigue `DISPONIBLE` o `COMPLETO`, es futura y sigue siendo del origen—, que el destino siga activo (`obtenerOpcionProfesorActivo(…, tx)`), dicte la materia (`profesorActivoDictaMateria(…, tx)`), esté dentro de su horario de atención (`estaDentroDeHorarioAtencion(…, tx)`) y no tenga otra clase superpuesta. Si todo es válido, actualiza `profesorId` con condición atómica sobre el profesor anterior y el estado; el trigger mueve la reserva del profesor (R3-PR0-D4). **Inscripciones, pagos, aula, fecha, hora y estado no cambian.** Después del commit se emite `turno:profesor_cambiado` (C, sección 4).
3. Una clase que no se puede cambiar queda en `no_procesadas` con el `code` de C: `TURNO_CANCELADO`, `TURNO_VENCIDO`, `TURNO_PENDIENTE`, `TURNO_MODIFICADO`, `PROFESOR_INACTIVO`, `PROFESOR_NO_DICTA_MATERIA`, `PROFESOR_FUERA_DE_HORARIO`, `PROFESOR_OCUPADO` (los de Sprint 1 y 2 que C ya usa al asignar, incluida la violación de la exclusión GiST traducida) o `TRANSACCION_OCUPADA`. Las demás siguen.
4. Al terminar se recuenta, igual que 2.10.3.

**Respuesta `200 OK`:**
```json
{ "data": {
    "cambiadas": 8,
    "no_procesadas": [ { "turno_id": "cuid", "code": "PROFESOR_OCUPADO", "message": "El profesor ya tiene una clase en ese horario" } ],
    "restantes": { "confirmados": 3, "pendientes": 2 }
  }, "error": null }
```
Mismo tratamiento en pantalla que 2.10.3: las no procesadas quedan en la lista, seleccionadas y con su motivo.

**Errores esperados (del pedido entero):** `400 VALIDATION_ERROR` · `400 MATERIAS_DISTINTAS` · `400 PROFESOR_DESTINO_IGUAL_ORIGEN` · `401` · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `409 PROFESOR_INACTIVO` · `409 PROFESOR_NO_DICTA_MATERIA`.

#### 2.10.6. Cómo se cumplen los criterios de HU-D-08

| Criterio | Dónde |
|---|---|
| 1 Confirmación y motivo | 2.10.1 (a) y paso 3 de (b) |
| 2 Rechazo por clases futuras y modal | 2.10.1 (b) paso 4; 2.10.2 a 2.10.5; bloqueo del profesor en 3.9; lote en 3.10 |
| 3 Baja lógica e historial después del commit | 2.10.1 (b) pasos 5 y 7 |
| 4 Cuenta inactiva y sesiones revocadas en la misma transacción | 2.10.1 (b) paso 6 |
| 5 No se ofrece y se conserva | 3.14 y pruebas obligatorias |
| 6 DNI sigue ocupado | 3.14 |
| 7 Reactivar | 2.11 |
| 8 Solo el Gerente | 2.10 (permiso), 2.12 y 3.11 |

---

### 2.11. Reactivar un profesor (HU-D-08, criterio 7) — NUEVA en Revisión 3

**Ruta:** `POST /api/profesores/[id]/reactivar` · **Server Action equivalente:** `reactivarProfesor()` en `actions.ts` · **Servicio:** `reactivarProfesor(id, input, actor)` en `profesor.estado.service.ts` · **Permiso requerido:** `profesores:cambiar_estado` (solo Gerente; Mesa de Entrada, Profesor y Alumno reciben `403 SIN_PERMISO`).

```typescript
export const ReactivarProfesorSchema = z.object({ version: z.number().int().nonnegative() }).strict();
```

**Comportamiento esperado, en una única `transaccion`:**
1. Bloquear al profesor (`bloquear(tx, { recursos: [{ tipo: "profesor", id }] })`, `FOR UPDATE`, nivel 1). Debe existir (`404 PROFESOR_NO_ENCONTRADO`), estar inactivo (`409 PROFESOR_YA_ACTIVO`) y tener la `version` recibida (`409 CONFLICTO_EDICION_CONCURRENTE`).
2. `updateMany` con condición atómica (`activoProfesor = false` y `version`): `activoProfesor = true`, `version + 1`, `modificadoPorUsuarioId`.
3. Si tiene `usuarioId`: `reactivarCuenta(tx, usuarioId)` (A, 2.9). **No** se restauran las sesiones revocadas en la baja: debe iniciar sesión de nuevo. La marca `debeCambiarPassword` se conserva tal como estaba (HU-A-06, criterio 7): quien nunca cambió la contraseña inicial sigue obligado.
4. `registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "REACTIVAR", actor })`, después del commit. Se conservan todas las bajas y reactivaciones del historial.
5. **Vuelven a regir** las materias asociadas y el horario de atención (no se tocaron en la baja): no hay nada que restaurar. Una materia que siga inactiva no se ofrece (la filtran `listarProfesoresActivosPorMateria` y `profesorActivoDictaMateria`, sin cambios).
6. **No se restauran** las clases que hubo que cancelar para poder dar de baja al profesor (2.10.3): hay que crearlas de nuevo si corresponde. Tampoco se deshace el cambio de profesor de las que se pasaron a otro.
7. El profesor vuelve a ofrecerse en «Nueva clase», la generación masiva, «Solicitar clase» y el calendario porque `listarOpcionesProfesoresActivos` y `listarProfesoresActivosPorMateria` lo incluyen de nuevo.

**Respuesta `200 OK`:** `{ "data": { "id": "cuid", "activo": true, "version": 5 }, "error": null }`. La interfaz pide la confirmación (M-43) «¿Estás seguro de que querés reactivar a <profesor>?» (reversible, sin motivo) y, al terminar, muestra «Profesor reactivado correctamente» y el aviso «Las clases canceladas para dar de baja al profesor no se restauran. Creálas de nuevo si corresponde.» (criterio 7; textos al archivo central, HU-C-23).

**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO` · `404 PROFESOR_NO_ENCONTRADO` · `409 PROFESOR_YA_ACTIVO` · `409 CONFLICTO_EDICION_CONCURRENTE` · `409 TRANSACCION_OCUPADA`.

El DNI y el email del profesor inactivo **siguen contando para la unicidad** (3.14): reactivar no puede chocar con un alta nueva.

---

### 2.12. Ficha del profesor en el Sprint 3: cuenta de acceso, historial de estados y consulta del Gerente (HU-A-06 c5 y c7, HU-D-08 c5 y c8) — NUEVA en Revisión 3

**Ruta:** las de 2.5, `GET /api/profesores` y `GET /api/profesores/[id]` · **Servicio:** `listarProfesores()` y `obtenerDetalleProfesor()` (los de 2.5) · **Permiso requerido:** `profesores:leer`, que desde el Sprint 3 tienen **Mesa de Entrada y Gerente** (T3). El Profesor y el Alumno reciben `403 SIN_PERMISO`.

**Qué no cambia.** El listado (2.5) es el mismo, con la misma respuesta: ya incluía a los inactivos con la columna Estado, y ahora esa etiqueta alcanza también a los que da de baja HU-D-08 (criterio 5). El detalle conserva todos sus campos y su convención de nombres. La nota de 2.5 «El Gerente no abre la ficha» deja de valer (T3).

**Campos opcionales nuevos del detalle** (`GET /api/profesores/[id]`). Se agregan a un contrato existente, así que siguen **su** convención, que es camelCase (nota de sincronización de 2.5; P-D3):
```json
{ "data": {
    "…": "campos de hoy sin cambios",
    "cuenta": { "estado": "ACTIVA", "email": "ana.gomez@mail.com", "rol": "PROFESOR", "debeCambiarPassword": true },
    "historialEstados": [
      { "fecha": "2026-10-12T14:03:00-03:00", "accion": "DESACTIVAR", "usuario": { "id": "cuid", "nombreParaMostrar": "Ruiz, Marta" }, "motivo": "Dejó el centro" }
    ]
  }, "error": null }
```
- **`cuenta`** (HU-A-06, criterio 5): sale de `obtenerResumenCuenta(profesor.usuarioId)` (A, 2.9). `estado` es `ACTIVA`, `INACTIVA` (la ficha está dada de baja, criterio 7) o `SIN_CUENTA` (ficha anterior a HU-A-06 o creada sin email: DEC-14, sin acción para crearla). La interfaz escribe «Activa · debe cambiar la contraseña» (con la marca), «Activa», «Inactiva» o «Sin cuenta». **Nunca** trae el hash.
- **`historialEstados`**: `listarHistorialEstados("PROFESOR", id)` (servicio compartido, R3-PR0-D1), del más reciente al más antiguo; `usuario` se resuelve en lote con `obtenerNombresGerentes` (G, P-D8) y puede ser `null`. Lo ven los mismos roles que pueden abrir la ficha (DEC-37).

**Modo consulta del Gerente (HU-D-08, criterio 8).** El Gerente ve el listado, la ficha, el horario de atención, las materias y la lista de turnos futuros por materia de 2.7. **No** tiene `profesores:crear` ni `profesores:editar`: toda escritura de las secciones 2.1 a 2.4, 2.6 y 2.7 le responde `403 SIN_PERMISO`, igual que hoy. Lo único que escribe es la baja y la reactivación (`profesores:cambiar_estado`, 2.10 y 2.11). Mesa de Entrada conserva exactamente lo que tiene hoy y **no** puede desactivar ni reactivar (`403`). Los datos y las materias del profesor los sigue editando Mesa de Entrada (decisión del PO, 05/10/2026).

**Pantallas (mapa P-40, P-41 y P-42).**
- **P-40 (listado):** el Gerente entra en modo consulta; «Nuevo profesor» solo se muestra con `profesores:crear`.
- **P-41 (ficha):** etiqueta «Inactivo» en la cabecera; para el Gerente, «Desactivar profesor» si está activo y «Reactivar» si está inactivo (solo con `profesores:cambiar_estado`), sin «Editar» y con la leyenda de modo consulta; para Mesa de Entrada, «Editar» y ninguna de las dos acciones. Secciones «Cuenta de acceso» e «Historial de estados». Cambiar el email desde la edición avisa que también cambia el de ingreso y pide la confirmación de HU-C-25 (2.9.2).
- **P-42 (alta):** campo Email obligatorio (2.9.1).
- **M-40 / M-43:** el modal de clases futuras (2.10.2 a 2.10.5) y la confirmación de baja o reactivación.
- `rutas-por-rol.ts` y el `matcher` dejan `/profesores` y `/profesores/[id]` también para el Gerente; `/profesores/nuevo` y `/profesores/horarios/nuevo` siguen siendo solo de Mesa de Entrada (R3-PR0-D6). Los textos van al archivo central (HU-C-23).

---

### 2.13. Servicios públicos del módulo en el Sprint 3, lo que D consume y los pedidos a C, E e I (Regla N.° 3) — NUEVA en Revisión 3

Complementa 2.8, cuyas funciones **no cambian de firma ni de resultado**. La nueva función de D se declara en `src/server/profesores/profesor.publico.ts`, que sigue **sin importar nada de otros módulos de dominio** y solo lee `profesores` (y `profesor_materia`). La orquestación de la baja (2.10 y 2.11) está en `profesor.estado.service.ts`, que no forma parte de la fachada.

#### 2.13.1. Lo que D agrega a su fachada

| Función | Devuelve | Consumidores |
|---|---|---|
| `obtenerProfesoresBasicos(ids, db?)` | `{ id, nombre, apellido, nombreParaMostrar, activo }[]`, en lote, de profesores **activos o inactivos**; los ids inexistentes no aparecen y no se garantiza orden (el consumidor indexa por id). `nombreParaMostrar` es «Apellido, Nombre», el mismo formato de `listarOpcionesProfesoresActivos`. **Aditiva**: `obtenerNombresProfesores` y `listarOpcionesProfesoresActivos` no cambian | `spec_modulo_H.md` 2.8.4 (HU-H-03, criterio 4: etiqueta «Inactivo») |

**Lo que se fija con pruebas (P-D12, criterio 5 de HU-D-08).** `obtenerNombresProfesores` y `obtenerOpcionProfesorDeUsuario` **no filtran por activo**: un profesor inactivo sigue resolviéndose por nombre para las clases pasadas, los historiales y los indicadores. `listarOpcionesProfesoresActivos`, `listarProfesoresActivosPorMateria` y `obtenerOpcionProfesorActivo` devuelven **solo activos**: así deja de ofrecerse en «Nueva clase» (HU-C-18), la generación masiva (HU-C-17), «Solicitar clase» (HU-C-12) y el selector del calendario (HU-J-01).

#### 2.13.2. Lo que D consume de otros módulos

| Función | Dueño | Para qué la usa D | Estado |
|---|---|---|---|
| `crearCuentaParaFicha(tx, { email, dni, rol, ip? })` | A (`cuenta.service.ts`) | Alta con cuenta (2.9.1) | `spec_modulo_A.md` 2.9 |
| `cambiarEmailCuenta(tx, { usuarioId, email })` | A | Email de la ficha → cuenta (2.9.2) | `spec_modulo_A.md` 2.9 |
| `desactivarCuenta(tx, usuarioId)` y `reactivarCuenta(tx, usuarioId)` | A | Baja y reactivación (2.10.1 y 2.11) | `spec_modulo_A.md` 2.9 |
| `obtenerResumenCuenta(usuarioId \| null, db?)` | A | Sección «Cuenta de acceso» (2.12) | `spec_modulo_A.md` 2.9 |
| `verificarEmailNoAsociadoAOtraCuenta(...)` | A | Unicidad del email (2.1, 2.2, 2.6): **sin cambios** | Existente |
| `contarTurnosFuturosDeProfesor`, `listarTurnosFuturosDeProfesor`, `obtenerTurnosBasicos`, `profesorTieneClasesPasadas`, `evaluarCambioDeProfesor`, `cancelarTurnoPorBajaDeProfesor`, `cambiarProfesorDeTurno` | C | Conteo, modal, lote y motivo obligatorio (2.10) | **Nuevas**, 2.13.3 |
| `contarTurnosFuturosDeProfesorPorMateria` y `listarTurnosFuturosDeProfesorPorMateria` | C | Modal «Ver turnos» de HU-D-07 (2.7): **sin cambios** | Existentes (`spec_modulo_C.md` 2.15) |
| `profesorTieneRegistros(profesorId, db?)` | E | Motivo obligatorio (2.10.1) | **Nueva**, 2.13.3 |
| `turnosConPagosVigentes(turnoIds, db?)` | I | Aviso de reintegro (2.10.2 y 2.10.3) | **Nueva**, 2.13.3 |
| `obtenerMateriasPorIds(ids, db?)` | L | Nombres de materia del modal (2.10.2) | Existente (`spec_modulo_L.md` 2.5) |
| `registrarCambioEstado(tx, …)` y `listarHistorialEstados(entidad, id, db?)` | compartido | Historial de estados | `PR-0.md` §2.13; la lectura la publica el PR 0 (R7-PR0-1) |
| `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId, db?)` | PR 0 (§2.9) | Alcance del Gerente sobre cada clase (3.11) | R3-PR0-D2 |
| `obtenerNombresGerentes(usuarioIds, db?)` | G | Quién hizo cada cambio de estado | `spec_modulo_G.md` 2.7 |
| `transaccion`, `bloquear`, `ahora()` | PR 0 | Transacción, bloqueos y reloj | `PR-0.md` §2.16 y §2.13 |

#### 2.13.3. Pedidos a C, E e I (funciones nuevas, todas aditivas)

**Módulo C** (`turno.publico.ts`; todas reciben `db?` o `tx` y respetan la Regla N.° 3). **Ninguna ruta ni función existente de C cambia de firma o de resultado.** Las que modifican datos reutilizan el mismo núcleo de las operaciones de C que ya existen; no lo duplican.

| Función | Devuelve / hace |
|---|---|
| `contarTurnosFuturosDeProfesor(profesorId, db?)` | `{ confirmados, pendientes }`: clases futuras `DISPONIBLE` o `COMPLETO` (las que bloquean la baja) y `PENDIENTE` (informativo), de **todas** las materias. Mismo criterio estricto de «futuro» (`>`) que `contarTurnosFuturosDeProfesorPorMateria` |
| `listarTurnosFuturosDeProfesor(profesorId, { materiaId?, pagina, porPagina }, db?)` | `{ items: [{ turno_id, fecha, hora_inicio, hora_fin, materia_id, alumnos_inscriptos: "3/5", inscriptos, estado }], total, materias: [{ materia_id, cantidad }], seleccion: { items: [{ turno_id, inscriptos }], total, total_inscriptos, truncada } }`. Solo `DISPONIBLE` o `COMPLETO` futuras, orden fecha, hora e id. `materias` cuenta **sin** el filtro; `seleccion` lo aplica y trae hasta 500 clases (`truncada: true` si hay más). Cuenta como inscripto a quien tiene inscripción vigente (`spec_modulo_C.md` 2.16.3) |
| `obtenerTurnosBasicos(turnoIds, db?)` | `{ turno_id, materia_id, profesor_id, estado, fecha, hora_inicio, hora_fin }[]`. Solo lectura, sin bloqueo; los ids inexistentes no aparecen |
| `profesorTieneClasesPasadas(profesorId, db?)` | `boolean`: el profesor tiene alguna clase que no sea `PENDIENTE` con inicio anterior o igual a `ahora()`, cancelada o no (`LIMIT 1`). Ante la duda se pide el motivo (P-D7) |
| `evaluarCambioDeProfesor(profesorDestinoId, turnoIds, db?)` | `{ turno_id, resultado: "SE_PUEDE" \| "FUERA_DE_HORARIO" \| "OCUPADO" \| "NO_DISPONIBLE" }[]` (2.10.4). Solo lectura. Usa `estaDentroDeHorarioAtencion` (D) y la superposición con las demás clases `DISPONIBLE` o `COMPLETO` del destino, con la fórmula de 3.4, excluyendo la propia clase |
| `cancelarTurnoPorBajaDeProfesor(tx, { turnoId, profesorId, actor })` | `{ turno_id, inscriptos }`. Núcleo de HU-C-05 (`spec_modulo_C.md` 2.10) **sin** `turnos:cancelar`: el permiso lo comprobó la ruta de D. Toma **una sola** llamada a `bloquear` con el profesor (`recursos`) y la clase (`clases`); relee la clase ya bloqueada; `ErrorDeDominio` con `TURNO_NO_ENCONTRADO`, `TURNO_CANCELADO`, `TURNO_PENDIENTE`, `TURNO_VENCIDO` o `TURNO_MODIFICADO` (también si la clase ya no es de ese profesor). Las inscripciones y los pagos no se tocan. Encola `turno:cancelado` con `despuesDelCommit` |
| `cambiarProfesorDeTurno(tx, { turnoId, profesorOrigenId, profesorDestinoId, actor })` | `{ turno_id }`. **Operación nueva** (hoy C no tiene ninguna que cambie el profesor de una clase `DISPONIBLE` o `COMPLETO`, T6). Una sola llamada a `bloquear` con los dos profesores (por id ascendente) y la clase; revalida estado y vigencia, que el destino esté activo (`obtenerOpcionProfesorActivo(…, tx)`), dicte la materia (`profesorActivoDictaMateria(…, tx)`), esté en su horario de atención y no tenga otra clase superpuesta; actualiza `profesorId` con condición atómica; el trigger mueve la reserva. Errores: los de arriba más `PROFESOR_INACTIVO`, `PROFESOR_NO_DICTA_MATERIA`, `PROFESOR_FUERA_DE_HORARIO` y `PROFESOR_OCUPADO` (incluida la violación de la exclusión GiST traducida con los helpers de `turno.reserva-error.ts`). No toca inscripciones, pagos, aula, fecha, hora ni estado. Encola `turno:profesor_cambiado` |

**Archivo y fachada (a confirmar contra el código).** Como `cambiarProfesorDeTurno` y `evaluarCambioDeProfesor` necesitan funciones de D, C las implementa en un archivo de servicio nuevo (por ejemplo `turno.baja-profesor.service.ts`, que sí puede importar la fachada de D, como ya hace `turno.service.ts`) y `turno.publico.ts` las **reexporta** sin importar a D directamente. Si `publico.aislamiento.test.ts` no admite ese reexporte, C publica estas siete funciones en un segundo archivo de fachada propio. D solo importa fachadas de C; no hay ciclo porque `profesor.publico.ts` no importa nada de C ni de `profesor.estado.service.ts`.

**Bloqueo del profesor en las operaciones de C que ya existen (T7, P-D5).** La spec de C ya manda que toda escritura de inscripciones tome un único `bloquear` en el orden canónico (`spec_modulo_C.md` 3.17). Se pide sumar **al profesor** a la lista `recursos` de esa misma llamada —sin una segunda llamada— en: pasar una clase a `DISPONIBLE` o `COMPLETO` con ese profesor (2.2), la generación masiva (2.9 y 2.9.1) y la reprogramación (2.11). Después de bloquear, cada una **vuelve a leer** `obtenerOpcionProfesorActivo(profesorId, tx)` y, si ya no está activo, rechaza con el mismo `code` que esa operación usa hoy para un profesor inactivo (a confirmar contra el código). No cambian rutas, cuerpos ni códigos; solo el bloqueo y la relectura. La alta de una clase `PENDIENTE` (2.1) no reserva recursos (`spec_modulo_C.md` 3.2) y no necesita el bloqueo.

**Eventos de C (sección 4 de su spec).** Se suma `turno:profesor_cambiado` con payload `{ turno_id, profesor_anterior_id, profesor_nuevo_id, usuario_id }` (R3-PR0-D8). `turno:cancelado` conserva su payload y suma el campo opcional `origen` (`"BAJA_PROFESOR"` cuando viene de 2.10.3); los consumidores que no lo conocen lo ignoran.

**Módulo E** (`clase-dictada.publico.ts`, o la fachada que corresponda): `profesorTieneRegistros(profesorId, db?)` → `boolean`, solo lectura (`LIMIT 1`): el profesor figura como quien dictó alguna clase —también una anulada— o tiene alguna indicación, resultado de examen u observación atribuida a él. Los criterios exactos los fija E según su modelo (a confirmar contra `spec_modulo_E.md`); ante la duda, verdadero (P-D7).

**Módulo I** (`pago.publico.ts`): `turnosConPagosVigentes(turnoIds, db?)` → `string[]`: los ids de esas clases que tienen al menos un pago **no anulado**. Solo lectura, en lote (una consulta). Sirve para el aviso de reintegro de 2.10.3 (HU-I-06 se verifica de forma diferida).

#### 2.13.4. Seed de escenarios para HU-D-08 (R3-PR0-D5)

El PR 0 deja sembrados, **llamando a los servicios** y no con inserciones directas, los casos que HU-D-08 necesita para probarse sin armar datos a mano (convención 8 i):
1. Un profesor con clases futuras `DISPONIBLE` y `COMPLETO` de **dos materias** (más de 10 en una de ellas, para la paginación) y con inscriptos y un pago.
2. Un profesor sin ninguna clase (baja directa, motivo opcional) y otro con clases **pasadas** (motivo obligatorio).
3. Un profesor **inactivo con cuenta** (para reactivar y para probar el mensaje de cuenta inactiva).
4. Dos profesores destino de una de las materias: uno **compatible** (dicta la materia, dentro de horario y libre) y otro **conflictivo** (ocupado en una de las clases y fuera de horario en otra).
5. Al menos una clase `PENDIENTE` con el profesor de (1), para probar que solo se informa.
Las cuentas de los profesores de demostración las crea el seed con `crearCuentaParaFicha` (DEC-14). El caso «Sin cuenta» se arma en las pruebas creando la ficha sin `email`.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/profesores/profesor.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Sin vínculo a cuenta de acceso en este sprint

> **Revisión 3.** Se conserva para las fichas sin cuenta, que son las anteriores al Sprint 3 y las creadas sin email. Desde el Sprint 3 las fichas que registra Mesa de Entrada con email nacen con cuenta (2.9.1) y la baja la desactiva (2.10.1), pero D sigue sin escribir en `usuarios`: lo hace A, por sus servicios (3.15). Los servicios de D no asumen que la cuenta exista.

Ningún servicio de este módulo crea, vincula ni modifica un `Usuario`. `Profesor.usuario_id` permanece `null` durante todo el sprint — su asignación, cuando exista, es responsabilidad de una HU futura fuera de esta spec.

### 3.2. Unicidad de DNI acotada a `Profesor`

> **Revisión 3.** Ahora hay fichas inactivas de verdad (HU-D-08): siguen ocupando su DNI y el email de su cuenta (3.14).

Igual mecanismo que `spec_modulo_B.md` §3.4 (doble validación aplicativa + constraint `P2002`, contra activos e inactivos), pero sobre la tabla `Profesor` exclusivamente — no hay verificación cruzada contra `Alumno.dni`.

### 3.3. Asociación de materias: todo-o-nada ante revalidación

> **Revisión 3.** Sin cambios. Las asociaciones del profesor dado de baja se conservan.

Si cualquier materia del lote de HU-D-03 dejó de estar activa entre la apertura del formulario y la confirmación, se aborta la operación completa dentro de la misma `$transaction` — nunca se guardan parcialmente las asociaciones que sí seguían siendo válidas.

### 3.4. Superposición de horarios con intervalos semiabiertos
La fórmula `a1 < b2 AND b1 < a2` (sección 2.4) es el único criterio válido de superposición en todo el proyecto para intervalos de horario — cualquier otro módulo que necesite esta misma validación (ej. `spec_modulo_C.md` al validar disponibilidad de aula/profesor) debe reutilizar la misma fórmula, no una aproximación distinta que trate los contiguos como superpuestos.

### 3.5. `HorarioProfesor` es un patrón recurrente, no un evento puntual
No tiene componente de fecha. Una consulta de disponibilidad contra este modelo siempre filtra por `dia_semana`, nunca por fecha calendario.

---

### 3.6. Quitar una materia exige que no queden turnos futuros que la dependan (Revisión 2)

> **Revisión 3.** Sin cambios. No confundir con la baja del profesor (HU-D-08), que se bloquea por las clases futuras de **todas** sus materias (2.10.1) y se resuelve desde su propio modal (2.10.2 a 2.10.5).

El profesor no puede dejar de dictar una materia mientras tenga turnos futuros `DISPONIBLE` o `COMPLETO` de ella. La regla se resuelve en una sola transacción con un orden fijo (borrar el vínculo, después contar), y la consulta de turnos pertenece a Turnos (`contarTurnosFuturosDeProfesorPorMateria`): este módulo nunca lee la tabla `turnos` (Regla N.° 3). La lista del modal «Ver turnos» sale de `listarTurnosFuturosDeProfesorPorMateria` (`spec_modulo_C.md` §2.15) a través de la ruta propia de 2.7.

### 3.7. Modificar respeta las mismas reglas que el alta, sobre el estado resultante (Revisión 2)

> **Revisión 3.** Sin cambios, con una sola regla agregada para las fichas con cuenta: el email se sincroniza con la cuenta y no puede quitarse (3.13).

Unicidad de DNI excluyendo al propio profesor. Contacto: mismo formato y misma unicidad de email que el alta (`409 EMAIL_YA_ASOCIADO`); un medio se quita con `null`; la exigencia de «al menos un medio» se aplica sobre el estado resultante solo si el request toca `telefono` o `email` y el profesor ya tenía alguno (2.6 paso 3, aprobado por el PO: N-2). La concurrencia optimista (`version`) se aplica igual que en `spec_modulo_B.md` §3.3.


### 3.8. Qué cambia y qué no con la baja (Regla N.° 1) — NUEVA en Revisión 3
- **Cambia:** `activoProfesor`, `version` y `modificadoPorUsuarioId` de la ficha; el estado de su cuenta (inactiva) y sus sesiones (revocadas). Antes de la baja, y como paso previo obligatorio, las clases futuras confirmadas ya fueron canceladas o pasadas a otro profesor por el Gerente (2.10.3 a 2.10.5).
- **No cambia:** la ficha no se borra; las materias asociadas (`ProfesorMateria`) y los horarios de atención (`HorarioProfesor`) se conservan sin modificar; las clases pasadas, las clases dictadas, los historiales y los indicadores quedan intactos; las clases `PENDIENTE` tampoco se tocan.
- **Se conserva:** el DNI y el email de la cuenta siguen reservados (3.14). La marca «Debe cambiar la contraseña» no se toca (A, 3.8).
- **No se restaura** al reactivar: ni las sesiones revocadas ni las clases canceladas (2.11).
- Las clases que se cancelan **conservan** sus inscripciones y sus pagos (HU-C-05). Si el centro devuelve dinero, lo registra anulando el pago con el motivo «Reintegro» (HU-I-06); esta spec no toca pagos ni cajas.

### 3.9. El bloqueo del profesor — NUEVA en Revisión 3
- La baja, la reactivación y toda operación de C que deja una clase `DISPONIBLE` o `COMPLETO` con ese profesor toman el **mismo** bloqueo de la fila del profesor (nivel 1 del orden de `PR-0.md` §2.10: recurso —aula, materia, profesor, alumno— → clase → inscripción → operación de pago → caja). La baja lo toma con su propia llamada a `bloquear`; cada operación de C lo suma a **su** llamada única (2.13.3). D no anida un bloqueo dentro de otro.
- Quien crea, confirma o reprograma una clase debe leer `activoProfesor` **después** de bloquear: `obtenerOpcionProfesorActivo(profesorId, tx)` tras el `bloquear`. El valor leído antes solo sirve para responder rápido; la decisión es la posterior (R3-PR0-D3).
- Efecto buscado (criterio 2, última viñeta): una clase nueva y una baja simultáneas no pueden confirmarse las dos. O gana la baja y la operación de C responde que el profesor no está activo, o gana la clase y la baja la ve en su conteo y responde `409 PROFESOR_CON_CLASES_FUTURAS`.
- Las operaciones de D que ya tomaban la fila del profesor con un `updateMany` condicionado a `activoProfesor` (2.3, 2.4 y 2.7) se serializan con la baja sin cambios: después de ella responden `409 PROFESOR_INACTIVO`.
- Dos bajas simultáneas: la segunda ve la ficha inactiva (`409 PROFESOR_YA_INACTIVO`) o una `version` distinta (`409 CONFLICTO_EDICION_CONCURRENTE`). Las esperas de bloqueo vencen a los 5 s con `409 TRANSACCION_OCUPADA`.

### 3.10. El lote: cada clase en su propia transacción — NUEVA en Revisión 3
- Cancelar o cambiar de profesor un conjunto de clases (2.10.3 y 2.10.5) **no es todo o nada**: cada clase se procesa y se revalida por separado, en su propia `transaccion`, con la clase y los profesores involucrados bloqueados (Regla N.° 7). Un fallo no frena a las demás ni deshace las que ya se procesaron.
- **Antes de procesar nada** se verifica el alcance de **todas** las clases (3.11): si alguna no es del profesor, `403` sin tocar ninguna. Es lo único que aborta el lote entero, junto con las validaciones del pedido (2.10.4, 1 a 4).
- Máximo 100 clases por pedido (P-D4); «Seleccionar todas» con más se envía en tandas secuenciales desde la pantalla y los resultados se suman. Se procesa en el orden recibido, de a una: nunca en paralelo, para no competir por los mismos bloqueos.
- Una clase que ya no se puede procesar (cancelada, empezada, `PENDIENTE`, de otro profesor, destino ocupado) queda en `no_procesadas` con su `code`; la pantalla la deja en la lista, seleccionada y con su motivo.
- Los eventos de cada clase se escriben **después del commit de esa clase** (`despuesDelCommit`, Regla N.° 2, opción (b)).
- El procesamiento por lotes no modifica la ficha del profesor: la `version` que trae la pantalla para la baja sigue valiendo después del lote.

### 3.11. Alcance del Gerente sobre las clases — NUEVA en Revisión 3
- El Gerente **no** gana `turnos:cancelar` ni `turnos:reprogramar` (P-D2, T6). Su única autoridad sobre las clases es `profesores:cambiar_estado`, y solo por las rutas de 2.10.2 a 2.10.5, sobre clases **de ese profesor**.
- El chequeo está en el helper del PR 0 `gerentePuedeGestionarClaseDeBaja(turnoId, profesorId, db?)`: verdadero si la clase pertenece (`profesorId` actual) al profesor indicado. **No mira estado ni fecha**: que la clase sea futura y esté `DISPONIBLE` o `COMPLETO` lo exige la función de C que la procesa, de modo que una clase que dejó de serlo queda en `no_procesadas` en vez de abortar el lote (R3-PR0-D2; P-D6).
- Fuera de ese flujo el Gerente sigue recibiendo `403 SIN_PERMISO` en `POST /api/turnos/[id]/cancelacion` y en `PATCH /api/turnos/[id]/reprogramacion`. Mesa de Entrada, que tiene esos permisos, **no** puede usar las rutas de 2.10.
- Los helpers de C (`cancelarTurnoPorBajaDeProfesor`, `cambiarProfesorDeTurno`) no comprueban permisos: los comprueba la ruta de D, igual que el resto de los servicios públicos (`spec_modulo_C.md` 2.15).

### 3.12. La ficha y la cuenta del alta se crean juntas o no se crean — NUEVA en Revisión 3
Con `email`, `crearProfesor` crea el `Usuario` (vía `crearCuentaParaFicha` de A) y el `Profesor` en la **misma** `transaccion`: si falla una, no existe la otra (HU-A-06, criterio 2). El DNI —que es la contraseña inicial— se guarda solo como hash y nunca se escribe en eventos, logs ni respuestas (3.16). La captura de `P2002` del DNI se hace **fuera** de la transacción (una vez deshecha), nunca dentro. Sin `email`, el alta es la de Sprint 1 y 2, sin cuenta. D nunca escribe en `usuarios` (3.15).

### 3.13. El email de una ficha con cuenta es el de la cuenta — NUEVA en Revisión 3
- Cambiar el email de una ficha con `usuarioId` cambia también el de la cuenta, **en la misma transacción** y con la misma validación de unicidad (2.9.2, T5). No revoca sesiones.
- Una ficha con cuenta **no puede quedarse sin email** (P-D13): quitarlo (`email: null` en 2.6) responde `400 VALIDATION_ERROR` en el campo `email`. El resto de la regla de «al menos un medio de contacto» (2.6 paso 3) no cambia.
- Una ficha **sin cuenta** conserva el comportamiento de Sprint 1 y 2 (contacto independiente de cualquier cuenta). Modificar una ficha anterior, aunque se le cargue un email, **no** le crea la cuenta (HU-A-06, criterio 8): `usuarioId` solo lo asigna el alta de 2.9.1.
- Si la ficha está inactiva, su cuenta también, y editar el email actualiza ambas (P-D10).

### 3.14. El profesor inactivo en el resto del módulo — NUEVA en Revisión 3
- **Unicidad:** el DNI de una ficha inactiva sigue ocupado (3.2) y el email de su cuenta sigue en uso (`verificarEmailNoAsociadoAOtraCuenta` no filtra por estado). Un alta nueva con esos datos responde `409 DNI_DUPLICADO` o `409 EMAIL_YA_ASOCIADO` (criterio 6).
- **Dónde no se ofrece:** `listarOpcionesProfesoresActivos`, `listarProfesoresActivosPorMateria` y `obtenerOpcionProfesorActivo` no lo devuelven. Con eso deja de aparecer en «Nueva clase», la generación masiva, «Solicitar clase» y el selector del calendario (criterio 5; lo verifica quien construye esas pantallas).
- **Dónde sí se resuelve:** `obtenerNombresProfesores`, `obtenerOpcionProfesorDeUsuario` y `obtenerProfesoresBasicos` lo devuelven, para clases pasadas, historiales e indicadores (P-D12). El listado (2.5) lo muestra con «Inactivo».
- **Clases `PENDIENTE`:** al continuar su configuración, el paso de profesor rechaza al inactivo y pide elegir uno activo (cambio en el flujo de HU-C-18, que ya usa `obtenerOpcionProfesorActivo`; `spec_modulo_C.md` 2.2). No se tocan al dar de baja (P-D9).
- **Edición:** la ficha inactiva **se puede modificar** (2.6 no valida `activo`). 2.3, 2.4 y 2.7 siguen rechazándola con `409 PROFESOR_INACTIVO` (P-D10). Lo único que no cambia desde `PATCH /api/profesores/[id]` es el estado (T1).
- **Reactivación:** no hace falta revalidar unicidad, porque el DNI y el email nunca se liberaron.

### 3.15. Aislamiento de dominio (Regla N.° 3) — NUEVA en Revisión 3
`profesor.publico.ts` sigue sin importar módulos de dominio. `profesor.estado.service.ts` llama a C, E, I, L, A y G **solo por sus fachadas** (`*.publico.ts`; A por `cuenta.service.ts` y `usuario.service.ts`, sus archivos de cuentas). Ninguna consulta de D toca `turnos`, `turno_alumno`, `reservas_turno`, `pagos`, `usuarios`, `clases_dictadas` ni otra tabla ajena. D nunca escribe en `usuarios`. `publico.aislamiento.test.ts` sigue pasando sin cambios.

### 3.16. Ningún dato sensible en logs, eventos ni respuestas — NUEVA en Revisión 3
No se registran ni se devuelven: el DNI usado como contraseña inicial, ninguna contraseña, ningún hash, y el motivo de la baja en logs de aplicación (el motivo vive solo en el historial de estados). El detalle de 2.12 nunca trae `passwordHash`. Las respuestas de 2.9 a 2.12 llevan `Cache-Control: no-store` (lo agrega `withPermission`).

### 3.17. Pruebas obligatorias (módulo D, Revisión 3) — NUEVA en Revisión 3
1. **Los tests de Sprint 1 y 2 de 2.1 a 2.8 siguen pasando sin tocarse**, incluido `publico.aislamiento.test.ts`. Solo se ajustan los tres que fijaban lo que manda cambiar el backlog (T3: la matriz de permisos ya no deja `profesores:leer` solo para Mesa de Entrada; T4: el alta con `email` ya no deja `usuarioId` nulo; T5: el email de la ficha con cuenta ya no es independiente), y solo agregando casos. Con `email` ausente, todo lo de Sprint 2 queda igual.
2. **Alta (2.9.1):** sin `email`, idéntica a Sprint 1 y 2 (201, sin cuenta, mismos errores); con `email`, ficha y cuenta creadas juntas con rol `PROFESOR` y la marca, hash del DNI (nunca en claro); `EMAIL_YA_ASOCIADO` sin revelar de quién; **si la cuenta falla no hay ficha y si la ficha falla no hay cuenta**; dos altas simultáneas con el mismo DNI y con el mismo email (una gana, sin cuenta huérfana); el wizard sigue igual.
3. **Email (2.9.2):** 2.2 y 2.6 cambian el email de la cuenta cuando la ficha tiene `usuarioId` y no tocan nada cuando no lo tiene; un email sin cambios no llama a A; unicidad en ambos; quitar el email de una ficha con cuenta da `400`; una ficha inactiva con cuenta actualiza ambas; la sesión abierta no se revoca.
4. **Baja (2.10.1), con PostgreSQL real:** sin clases futuras desactiva; con clases `DISPONIBLE` o `COMPLETO` futuras responde `409 PROFESOR_CON_CLASES_FUTURAS` y **no cambia nada**; una clase en curso, una pasada, una `PENDIENTE` y una `CANCELADO` **no bloquean** (incluido el borde de inicio = ahora); las `PENDIENTE` se informan en `pendientes_afectados`; la cuenta queda inactiva y la sesión abierta responde `401` en la próxima solicitud; el ingreso muestra «La cuenta está inactiva…»; una ficha sin cuenta se desactiva igual; el historial se escribe **después** del commit y con reintento; `MOTIVO_REQUERIDO` con clases pasadas (C) y con registros (E), un caso por cada uno, y motivo opcional sin historia; `CONFLICTO_EDICION_CONCURRENTE`; `PROFESOR_YA_INACTIVO`; materias y horarios conservados sin cambios; el DNI sigue ocupado.
5. **Modal y lote (2.10.2 a 2.10.5):** el listado pagina de a 10, filtra por materia, cuenta las materias sin el filtro y `seleccion` respeta el filtro; cancelar deja `CANCELADO` con inscripciones y pagos intactos y libera aula, profesor y alumnos; cambiar de profesor mueve la reserva del profesor y no toca inscripciones, pagos, aula ni horario; el resultado de la previsualización para cada caso (`SE_PUEDE`, `FUERA_DE_HORARIO`, `OCUPADO`, `NO_DISPONIBLE`); `MATERIAS_DISTINTAS`; destino inactivo, que no dicta la materia o igual al origen; **una clase que falla no frena a las demás** (una pasó a `CANCELADO` por otro lado, una ocupada) y queda en `no_procesadas` con su `code`; una clase que dejó de ser futura no produce `403`; una clase ajena en el pedido da `403` y no se toca ninguna; más de 100 ids da `400`; cuando se procesan todas, `restantes.confirmados = 0` y la baja pasa.
6. **Concurrencia:** una clase nueva (generación masiva, confirmación de una `PENDIENTE`, reprogramación) contra una baja simultánea: nunca quedan las dos (resultado A: baja y el profesor no activo para C; resultado B: la baja ve la clase y responde `409`); dos bajas simultáneas; un cambio de profesor contra la baja del **destino**; el orden de bloqueo no genera interbloqueo contra 2.3, 2.4 y 2.7.
7. **Reactivación (2.11):** cuenta activa, sesiones **no** restauradas, marca conservada, clases canceladas **no** restauradas, materias y horario vuelven a regir (una materia inactiva no se ofrece), vuelve a ofrecerse en las listas de activos; historial con cada baja y reactivación en orden.
8. **Permisos:** `profesores:cambiar_estado` solo Gerente (Mesa de Entrada, Profesor y Alumno `403`, también en `impacto-baja` y en las rutas del modal); `profesores:leer` Mesa de Entrada y Gerente `200`, Profesor y Alumno `403`; el Gerente `403` en `crear`, `editar` y en `turnos:cancelar` y `turnos:reprogramar` fuera del flujo de baja; `ACCIONES_SOLO_MESA_ENTRADA` ya no contiene `profesores:leer`. La matriz se prueba **después** de correr el seed.
9. **Detalle (2.12):** `cuenta` en sus tres estados, `historialEstados` ordenado y con nombres, sin `passwordHash` en ninguna respuesta.
10. **Funciones públicas (2.13):** `obtenerProfesoresBasicos` devuelve activos e inactivos y omite los inexistentes; `obtenerNombresProfesores` y `obtenerOpcionProfesorDeUsuario` resuelven a un inactivo; las listas de activos no lo devuelven; `contarTurnosFuturosDeProfesor` y `listarTurnosFuturosDeProfesorPorMateria` coinciden en el criterio de «futuro».

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

> **Revisión 3.** Los eventos y la opción (a) de esta sección no cambian. La baja y la reactivación usan además la opción (b); están descritas en la nota al final de la sección.


El módulo D usa la **opción (a)** de la Regla N.° 2 (columnas de auditoría en la propia entidad), porque la trazabilidad que necesita es la del ciclo de vida normal de la ficha (quién y cuándo la creó o modificó), sin eventos discretos repetibles sobre la misma entidad. Se persiste en la misma operación que la mutación. No usa la opción (b) ni existe tabla de eventos.

La tabla siguiente es **referencia histórica** de la versión previa de la Regla N.° 2 (event bus): esos eventos **no se emiten**.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `profesor:creado` | Alta (2.1) | `profesor_id, dni, usuario_registrante_id` |
| `profesor:contacto_actualizado` | Contacto (2.2) | `profesor_id, campos_modificados, usuario_id` |
| `profesor:materias_asociadas` | Asociación (2.3) | `profesor_id, materia_ids, usuario_id` |
| `profesor:horario_registrado` | Horario (2.4) | `profesor_id, dia_semana, hora_inicio, hora_fin, usuario_id` |

**Nota de sincronización (HU-D-03, resuelta): el módulo D usa la opción (a) de la Regla N.° 2 (columnas de auditoría).**
- Esta tabla se redactó cuando `RULES.md` exigía un event bus. La Regla N.° 2 vigente ya no lo pide. Los eventos de arriba quedan como referencia histórica y **no se emiten**.
- La trazabilidad se persiste en la propia fila, en la misma operación:
  - `Profesor`: `creadoPorUsuarioId` y `createdAtProfesor` (HU-D-01); `modificadoPorUsuarioId` y `updatedAtProfesor` (HU-D-02, HU-D-03).
  - `ProfesorMateria`: `creadoPorUsuarioId` y `createdAtProfesorMateria` (HU-D-03, migración `profesor_materia_auditoria`). Cada asociación es el alta de una fila, así que esas columnas registran qué se asoció, cuándo y quién.
  - `HorarioProfesor`: `creadoPorUsuarioId` y `createdAtHorario` (HU-D-04, columnas ya existentes en el schema). Cada intervalo es el alta de una fila.
- No existe tabla `EventoProfesor`.

**Revisión 2 (Sprint 2) — trazabilidad (Regla N.° 2).** HU-D-06 y HU-D-07 usan la **opción (a)**: `modificadoPorUsuarioId`, `updatedAtProfesor` y `version` en la fila de `Profesor`, y `createdAtProfesorMateria` / `creadoPorUsuarioId` en cada alta de `ProfesorMateria`. Sigue sin existir `EventoProfesor`.

> **Revisión 3 (Sprint 3).** Los eventos y la opción (a) de esta sección **no cambian** para lo existente: `profesor:creado`, `profesor:contacto_actualizado`, `profesor:materias_asociadas` y `profesor:horario_registrado` siguen sin emitirse. La baja y la reactivación son cambios de estado y usan la opción (b), además de las columnas de la opción (a):
>
> | Evento | Disparado por | Payload mínimo |
> |---|---|---|
> | `profesor:desactivado` | Baja (2.10.1). Se escribe con `registrarCambioEstado` (`entidad: "PROFESOR"`, `accion: "DESACTIVAR"`) en el historial de estados del PR 0, **después del commit** y con reintento | `profesor_id, usuario_id, motivo, fecha` |
> | `profesor:reactivado` | Reactivación (2.11). `registrarCambioEstado` con `accion: "REACTIVAR"` | `profesor_id, usuario_id, fecha` |
>
> Qué cambia en lo existente: el alta con cuenta (2.9.1) sigue la opción (a) de siempre; cuando se crea la cuenta, A registra aparte su evento de seguridad `CUENTA_CREADA` (`spec_modulo_A.md` 4) y D no lo emite. La ficha conserva `modificadoPorUsuarioId`, `updatedAtProfesor` y `version`. El lote de 2.10.3 y 2.10.5 deja, por cada clase, el evento de C (`turno:cancelado` con `origen: "BAJA_PROFESOR"`, o `turno:profesor_cambiado`), que escribe C después del commit de esa clase; D no escribe eventos de clases. La lectura del historial (`listarHistorialEstados`) y las consultas de 2.10.1, 2.10.2, 2.10.4 y 2.12 son de solo lectura y **no emiten eventos**.
```
