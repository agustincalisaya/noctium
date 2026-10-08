```markdown
# Especificación Técnica — Módulo H (Indicadores / Dashboard)
## Noctium — Sprint 2 · Sprint 3 (Revisión 3)
## Revisión 2 — HU-H-01 y HU-H-02 revisadas: Ingresos cobrados y Tasa de ocupación (decisión de PO, 01/10/2026)

## Revisión 3 — Sprint 3: panel de indicadores con pestañas y período común (HU-H-06) y tres indicadores nuevos: clases por materia y por profesor (HU-H-03), Índice de presentismo (HU-H-07) y Cancelaciones (HU-H-10) (08/10/2026)

**Fuente de verdad:** backlog definitivo del Sprint 3 (40 HU · 107 SP). **Referencias de esta revisión:** `PR-0.md` (§1.1 tabla de compatibilidad, §2.6 parámetros, §2.9 permisos, §2.13 servicios y lecturas públicas) · `spec_modulo_C.md` (Revisión 6, §2.15 y las reglas de vigencia) · `spec_modulo_E.md` (Revisión 2, §2.13) · `spec_modulo_I.md` (Revisión 3, §2.3) · `spec_modulo_L.md` (§2.5 y §2.6) · `spec_modulo_D.md` (§2.8) · `spec_modulo_B.md` (§2.8) · `docs/adicionales/mapa-pantallas-sprint-3.md` (P-49, DEC-40 y DEC-41).

**HU contractualizadas en esta revisión:**
| HU | SP | Qué agrega | Sección |
|---|---|---|---|
| HU-H-06 Panel de indicadores con pestañas y filtro de período | 2 | Pestañas «Actividad», «Índice de Presentismo» y «Cancelaciones», período común y componente común de gráfico. Adapta HU-H-01 y HU-H-02 (revisadas el 01/10/2026) sin cambiar sus endpoints | 2.4 |
| HU-H-03 Ver cantidad de clases por materia y por profesor (absorbe HU-H-04) | 3 | Dos endpoints de lectura para la pestaña «Actividad» | 2.5 |
| HU-H-07 Ver inscriptos vs. presentes | 3 | Tres endpoints de lectura para la pestaña «Índice de Presentismo» | 2.6 |
| HU-H-10 Ver cancelaciones | 5 | Dos endpoints de lectura para la pestaña «Cancelaciones» | 2.7 |

Las lecturas que estos endpoints necesitan de C, E y D están definidas en 2.8 (DEC-41 del mapa: cada HU agrega sus lecturas en la fachada del módulo dueño del dato). Orden del backlog: HU-H-06 → HU-H-07 y HU-H-03 → HU-H-10.

**Regla de esta revisión (instrucción del SM): nada de lo desarrollado en los Sprints 1 y 2 se rompe.** Esta revisión es **aditiva**: no cambia la firma, la forma ni el `code` de ningún endpoint, schema, permiso o función pública existente de este módulo.

**Cómo se verificó.** El código de `src/server/indicadores/` no está en el repositorio revisado (el repositorio trae solo `materias`, `pagos` y `shared`): el contraste se hizo contra la Revisión 2 de esta spec, `pago.publico.ts` (`sumarPagosPorMes`, firma `(desde, hasta, db?) → { mes, total }[]`, que sí está en el repositorio), las specs C, E, I, L, D y B, el PR 0 v19, el mapa de pantallas y el backlog.

**Compatibilidad con los Sprints 1 y 2 (revisada antes de entregar):**
| Elemento de Sprint 2 | Estado en Revisión 3 |
|---|---|
| `GET /api/indicadores/ingresos-por-mes` (2.2): ruta, query, respuesta `[{ mes, total }]`, errores | **Sin cambios.** Cambia de dónde sale el dato, no lo que devuelve: `sumarPagosPorMes` conserva firma y forma (PR 0 §1.1, regla 2) y pasa a sumar el monto vigente y sin anulados. Con los pagos de Sprint 2 (sin correcciones ni anulaciones) el resultado es idéntico |
| `GET /api/indicadores/ocupacion-por-mes` (2.3): ruta, query, respuesta `[{ mes, ocupacion_promedio }]`, errores | **Sin cambios.** Sigue siendo el promedio simple por clase de `inscriptos / cupo`, con `fechaTurno ≤ hoy` (R2-c). «Inscriptos» pasa a ser «inscripciones vigentes» en C (con los datos de Sprint 2, donde no hay inscripciones canceladas, da lo mismo) |
| `RangoIndicadoresQuerySchema` (6 meses por defecto, tope de 24, `AAAA-MM`, mensajes, `400 VALIDATION_ERROR`) | **Sin cambios.** Lo reutilizan todos los endpoints nuevos |
| Permiso `indicadores:leer`, solo GERENTE, `withPermission` en cada ruta, `401 SESION_INVALIDA`, `403 SIN_PERMISO` | **Sin cambios.** No se crea ningún permiso. Todo endpoint nuevo usa el mismo |
| Pantalla en `/gerente`, `exigirPermiso("indicadores:leer")`, redirecciones a `/sin-permiso` y `/login` | **Sin cambios** (T1) |
| `mesActual()`, `mesSchema`, resolución del rango, completar meses con cero, redondeo de 3.8, helpers de `indicadores.service.ts` | **Sin cambios y sin moverse de archivo.** Los servicios nuevos los importan |
| 2.1 (reemplazada, historial) y reglas 3.1 a 3.8 | Se conservan; cada una lleva una nota de Revisión 3 |
| Tests de Sprint 2 de 2.2 y 2.3 | **Siguen pasando**; solo se tocan los mocks de las fachadas de C e I si cambió su origen. Las aserciones de respuesta y de `code` no cambian |
| Pantalla de Sprint 2: selector de rango propio, mensaje «Todavía no hay suficientes datos para este período» y tabla visualmente oculta | **Único cambio visible, mandado por el backlog** (HU-H-06, criterios 2, 4 y 5): el selector propio lo reemplaza el filtro de período del panel; el mensaje de «sin datos» pasa a ser por gráfico; la tabla oculta se reemplaza por «Ver como tabla». Se conservan los datos, los colores `--chart-1` y `--chart-2`, la línea de meta del 80 % (P4) y los formatos de moneda y porcentaje |

**Contradicciones detectadas entre el backlog, el PR 0, el mapa y lo existente, y cómo se resuelven (se aplica siempre «acomodarse a lo ya hecho»):**
| # | Contradicción | Resolución |
|---|---|---|
| T1 | El mapa (P-49) dice que la ruta es `/indicadores` («confirmar en rutas-por-rol.ts»); la Revisión 2 fijó `/gerente`, donde ya apuntan el Sidebar y `proxy.ts` | **Se mantiene `/gerente`** (R2-a). El mapa debe corregirse |
| T2 | El mapa (DEC-41) prevé una lectura de «cupo por mes» para la ocupación, lo que implicaría una razón ponderada (suma de inscriptos sobre suma de cupos). El contrato existente (2.3) es el promedio simple por clase | **Se mantiene el contrato de 2.3.** No se pide el cupo por mes. Pasar a la razón ponderada cambiaría números ya publicados: solo puede decidirlo el PO (P-H2) |
| T3 | La leyenda del criterio 2 de HU-H-06 dice «clases Disponibles y Completas del período» y no menciona `fechaTurno ≤ hoy` | **Se conserva `fechaTurno ≤ hoy`** (R2-c, decisión de relevamiento de Sprint 2); la leyenda lo aclara (P-H3) |
| T4 | El PR 0 (§2.13) y el mapa sacan los inscriptos de HU-H-07 de `contarInscripcionesPorMes` (C). Esa cuenta incluiría clases sin registrar o sin control de asistencia, y el índice compararía cosas distintas | **Los inscriptos de una clase dictada son los de su fotografía:** `presentes + ausentes` de `contarAsistenciasPorMes` (E). Es lo que dice el criterio 3 («los inscriptos de una clase dictada son las inscripciones vigentes») y evita cruzar tablas de dos módulos. `contarInscripcionesPorMes` queda para HU-H-10 (P-H4) |
| T5 | `contarAsistenciasPorMes` informa `sin_control` como filas de alumno; el criterio 3 de HU-H-07 pide **cuántas clases** quedaron afuera | Se agrega a E `contarClasesDictadasSinControl` (2.8.3), como prevé DEC-41 (P-H5) |
| T6 | `contarClasesPorMes(rango, { estados, por })` del PR 0 no distingue estado ni duración dentro del resultado; HU-H-03 (criterio 5) necesita las horas **sin** las canceladas | La lectura devuelve el resultado agrupado también por estado y con los minutos (2.8.1). Es aditivo: la función todavía no existe en el código |
| T7 | El último párrafo del criterio 1 de HU-H-10 («solo se cuentan las de clases no canceladas por el centro») no dice a qué series alcanza | Alcanza a las **tres series del alumno** (cancelaciones, reservas vencidas y bajas) y al gráfico por materia; las clases canceladas por el centro son la serie del centro (P-H7) |
| T8 | El criterio 3 de HU-H-10 pide orden «de mayor a menor» con dos series de unidades distintas que «no se suman entre sí» | Se ordena por la **primera serie** (clases canceladas por el centro) y de desempate por la segunda (P-H6) |
| T9 | HU-H-06 (criterio 7) pide «el total de cada gráfico» en el encabezado; la ocupación no tiene total aditivo | Se agrega `GET /api/indicadores/ocupacion-resumen` con el promedio del período (2.4.3). No se toca la respuesta de 2.3 (P-H8) |
| T10 | `obtenerNombresProfesores` (D) no informa si el profesor está activo, y HU-H-03 (criterio 4) necesita la etiqueta «Inactivo» | Se agrega a D `obtenerProfesoresBasicos` (2.8.4). Para materias alcanza con `obtenerMateriasPorIds` (L), que ya trae `activa` |
| T11 | DEC-40 del mapa: el selector ajusta el otro extremo y avisa «El período máximo es de 24 meses.»; la API de 2.2 y 2.3 responde `400 "El rango máximo es de 24 meses"` | **Conviven:** el ajuste es de la interfaz y evita llegar al límite; el `400` del servidor no cambia y protege la API |
| T12 | La nota de consumidores de la tabla de `spec_modulo_E.md` §2.13 dice que HU-H-07 saca los inscriptos de C | Se corrige esa nota en E (una frase): los inscriptos salen de `presentes + ausentes` (T4) |

**Changelog de Revisión 3:**
| Sección | Estado previo | Acción |
|---|---|---|
| Visión general, Convenciones generales, 2.2, 2.3, Frontend de 2.2/2.3, 3.1 a 3.8 y 5 | Vigentes | Nota de Revisión 3 en cada una; el texto original se conserva |
| 2.4 | — | **Nueva:** panel con pestañas y período común (HU-H-06), `ocupacion-resumen` y componente común de gráfico |
| 2.5 | — | **Nueva:** `clases-por-materia` y `clases-por-profesor` (HU-H-03) |
| 2.6 | — | **Nueva:** `presentismo-por-mes`, `presentismo-por-materia` y `alumnos-presentismo-bajo` (HU-H-07) |
| 2.7 | — | **Nueva:** `cancelaciones-por-mes` y `cancelaciones-por-materia` (HU-H-10) |
| 2.8 | — | **Nueva:** lecturas de otros módulos que usa esta revisión |
| 3.9 a 3.17 | — | **Nuevas** reglas de negocio (período, conteo de clases, clasificación de inscripciones, presentismo, tasas, orden, nombres y etiquetas, lecturas y pruebas) |
| 4 | Solo lectura | Se confirma; no cambia |

**Puntos resueltos por el Scrum Master el 08/10/2026** (el backlog no los definía o admitía más de una lectura; se resolvió por lo más compatible con lo ya hecho). «Informar» = a quién se le avisa, no hace falta que lo apruebe para seguir:
| # | Punto | Decisión | Informar |
|---|---|---|---|
| P-H1 | Ruta de la pantalla | `/gerente` (T1) | Equipo (corregir el mapa) |
| P-H2 | Ocupación: promedio simple o razón ponderada | Se mantiene el promedio simple de 2.3; no se agrega el cupo por mes | PO: si prefiere la razón ponderada, cambia la cifra ya publicada en Sprint 2 y debe decidirlo él |
| P-H3 | Clases futuras en la ocupación | Se siguen excluyendo (`fechaTurno ≤ hoy`) | PO (informativo) |
| P-H4 | Origen de los inscriptos de HU-H-07 | `presentes + ausentes` de la clase dictada (E) | Equipo (PR 0 §2.13) |
| P-H5 | «Cuántas quedaron afuera» | Cantidad de **clases** dictadas sin control de asistencia, no de alumnos | Equipo |
| P-H6 | Orden del gráfico de cancelaciones por materia | Por clases canceladas por el centro, desempate por inscripciones canceladas por alumnos, luego por nombre | PO (el backlog no lo define) |
| P-H7 | Alcance de «solo clases no canceladas por el centro» | Todas las series del alumno y el gráfico por materia (T7) | PO (informativo) |
| P-H8 | Total del encabezado de la ocupación | Promedio del período en `ocupacion-resumen` | Equipo |
| P-H9 | Índice sin inscriptos | `indice: null` (el gráfico no dibuja punto ni valor); una tasa con denominador 0 es `null` | Equipo |
| P-H10 | Tabla de presentismo bajo | Orden: porcentaje ascendente, ausencias descendente, alumno y materia; no muestra DNI; 10 por página | Equipo |
| P-H11 | Estado del panel | Pestaña y período viven en el cliente (se conservan al cambiar de pestaña, no entre visitas) | Equipo |
| P-H12 | Textos nuevos | Los de este documento son propuestos; los definitivos van al archivo central (HU-C-23), igual que en el mapa | Equipo |

**Pedidos al PR 0 (a incorporar en el v20, sin tocar lo existente):**
| # | Pedido | Dónde |
|---|---|---|
| R3-PR0-1 | Fachada de C: `contarClasesPorMes` con el resultado de 2.8.1 (por mes y estado, con minutos y `materia_id`/`profesor_id` según `por`) y `contarInscripcionesPorMes` con el resultado de 2.8.2 (clasificación efectiva con `esVigenteEn`, solo clases Disponibles o Completas). No se pide el cupo por mes | `PR-0.md` §2.13; `spec_modulo_C.md` §2.15 |
| R3-PR0-2 | Fachada de E: `contarClasesDictadasSinControl` y `listarAlumnosConPresentismoBajo` (2.8.3). Corregir en §2.13 la frase que saca los inscriptos de HU-H-07 de C | `PR-0.md` §2.13; `spec_modulo_E.md` §2.13 |
| R3-PR0-3 | Fachada de D: `obtenerProfesoresBasicos(ids, db?)` (2.8.4) | `spec_modulo_D.md` §2.8 |
| R3-PR0-4 | `parametrosVigentes()` entrega `umbral_presentismo` como número entero (75 por defecto; HU-N-01 lo limita a 1–100) | `PR-0.md` §2.6 |
| R3-PR0-5 | Tabla cerrada de permisos: **sin entradas nuevas**; `indicadores:leer` queda como está (solo GERENTE) | `PR-0.md` §2.9 |
| R3-PR0-6 | Puntos de extensión del seed para los datos de presentación de HU-H-06, HU-H-07 y HU-H-10 (Pendiente 11) | `PR-0.md` §2.16 |
| R3-PR0-7 | Componentes de shadcn/ui que la pantalla necesita y pueden faltar: `tabs` y `table` (se agregan con la CLI; no modifican nada existente) | Frontend |
| R3-PR0-8 | Mapa: ruta `/gerente` (T1), DEC-41 sin «cupo por mes» (T2) y lecturas de HU-H-07 como en 2.8 | `mapa-pantallas-sprint-3.md` P-49, DEC-41 |

**Efectos sobre otras specs:** **C** (sus lecturas nuevas de 2.8.1 y 2.8.2 entran en §2.15); **E** (nota de §2.13 corregida y dos lecturas nuevas); **D** (una lectura nueva en §2.8); **I** (nada: `sumarPagosPorMes` ya conserva firma y forma); **L** y **B** (nada: se usan `obtenerMateriasPorIds`, `listarMateriasActivas` y `obtenerAlumnosBasicos` tal como están); **A** (la matriz de permisos no cambia); **N** (HU-N-01 define `umbral_presentismo`, que H solo lee).

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth · shadcn/ui (`chart` sobre Recharts, `card`, `skeleton`; tokens `chart-*` de `docs/DESIGN.md`)
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_C.md` (Turno, §2.15 servicios públicos) · `spec_modulo_I.md` (Pagos, §2.3 servicios públicos) · `schema.prisma` · `docs/adicionales/nuevosindicadores.md` (task de esta revisión) · `docs/adicionales/mapa-pantallas-sprint-2.md` (§2, "Indicadores") · `docs/DESIGN.md` (§2 tokens `--chart-1`, `--chart-2`, `--muted-foreground`)

**HU contractualizadas en esta revisión:** HU-H-01 revisada (Ingresos cobrados por mes) y HU-H-02 revisada (Tasa de ocupación promedio por mes). **Reemplazan** a las HU-H-01 (turnos por mes) y HU-H-02 (alumnos nuevos por mes) de la Revisión 1, por decisión del PO del 01/10/2026. Task: `docs/adicionales/nuevosindicadores.md`.

**Changelog de Revisión 2:**
| Sección | Estado previo | Acción |
|---|---|---|
| 2.1 (`GET /api/indicadores`, turnos y alumnos por mes) | Vigente e implementada | **Reemplazada** por 2.2 y 2.3. Se conserva el texto como historial y no se renumera. El endpoint, `obtenerIndicadoresMensuales()` y el gráfico SVG propio se retiran del código |
| Convenciones generales — esquema del rango | `IndicadoresQuerySchema` | Se renombra `RangoIndicadoresQuerySchema` (nombre de la task). Conserva meses `AAAA-MM`, el rango por defecto de 6 meses y el tope de 24 (Q8) |
| 2.2 | — | **Nueva:** `GET /api/indicadores/ingresos-por-mes` (HU-H-01 revisada) |
| 2.3 | — | **Nueva:** `GET /api/indicadores/ocupacion-por-mes` (HU-H-02 revisada) |
| 3.1 | Consumía `contarTurnosPorMes()` (C) y `contarAlumnosNuevosPorMes()` (B) | Consume `sumarPagosPorMes()` (I §2.3) y `promediarOcupacionTurnosPorMes()` (C §2.15). Las dos funciones anteriores se retiran de B y C (sin consumidores) |
| 3.2 | El mes de un turno es el de su fecha; `CANCELADO` cuenta | Se conserva el criterio del mes. La regla sobre `CANCELADO` aplicaba solo a 2.1 y queda reemplazada por 3.6 |
| 3.6 a 3.8 | — | **Nuevas** (ocupación, ingresos, redondeo) |
| 5 | Q8 y librería | Se agregan las decisiones de esta revisión y los puntos abiertos que siguen para el PO |

**Decisiones de relevamiento (01/10/2026, DECISIÓN RESUELTA — no relevar de nuevo):**
- La pantalla sigue en `/gerente`, donde ya apuntan el Sidebar y `proxy.ts`. No se crea `app/(dashboard)/indicadores/`.
- El rango se elige **por mes** (`AAAA-MM`, dos selectores) con el tope de 24 meses de Q8. No se usa un Date Range Picker por día.
- La ocupación toma solo turnos con `fechaTurno ≤ hoy` (Buenos Aires) y mide inscriptos sobre cupo. Los meses futuros salen en 0%.
- Sin Server Actions: el módulo es de solo lectura y el frontend llama a los Route Handlers (misma decisión que la Revisión 1).
- Ubicación según la Regla N.° 11 (`src/server/indicadores/`), no `lib/services/` ni `lib/schemas/` como proponía la task.
- El permiso `indicadores:leer` ya existía (seed, solo GERENTE). Se reutiliza y no se crea ninguno nuevo.

---

### Historial — Revisión 1 (primera versión, módulo nuevo de Sprint 2)

**HU contractualizadas en la Revisión 1:** HU-H-01 (Ver cantidad de turnos por mes), HU-H-02 (Ver cantidad de alumnos por mes) — Sprint 2. Es la **primera revisión** del módulo: no existía `spec_modulo_H.md`.

**Changelog de la Revisión 1 (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-H-01 | Gap — no contractualizada | Añadida sección 2.1 |
| HU-H-02 | Gap — no contractualizada | Añadida sección 2.1 |

**Fuera de alcance de esta spec (explícito):**

> **Revisión 3 (Sprint 3).** De esta lista entran en el Sprint 3: los indicadores por materia y por profesor (HU-H-03, que absorbió a HU-H-04; 2.5) y, dentro de lo que antes se llamaba «rendimiento», el Índice de presentismo (HU-H-07, 2.6); además se suma la pestaña de Cancelaciones (HU-H-10, 2.7). Siguen fuera del alcance del producto las pestañas de Pagos y de Ocupación (HU-H-08 y HU-H-09; Ingresos cobrados y Tasa de ocupación las reemplazan), el resumen de situaciones para atender (HU-H-12) y los filtros globales por Materia, Profesor y Aula. Siguen fuera de esta spec la exportación, la impresión y el envío programado, y toda escritura: el módulo es de solo lectura.

- Indicadores por materia (HU-H-03) y por profesor (HU-H-04), de Sprint 3.
- Ocupación, pagos y rendimiento (mencionados en el mapa de historias inicial): no forman parte de Sprint 2. *(Revisión 2: ocupación e ingresos **sí** entran en Sprint 2 por decisión del PO del 01/10/2026; rendimiento sigue fuera.)*
- Exportar, imprimir o programar el envío de los indicadores.
- Cualquier escritura: el módulo es **exclusivamente de lectura**.

---

## 1. Visión General

> **Revisión 3 (Sprint 3).** La pantalla «Indicadores» deja de ser «una sola pantalla con dos indicadores» y pasa a ser un **panel con tres pestañas** («Actividad», «Índice de Presentismo» y «Cancelaciones») y un filtro de período común (2.4). Sigue en `/gerente`, sigue siendo de solo lectura, sin tablas propias y sin eventos, y mantiene el principio «el módulo compone, no calcula»: las cuentas las entregan las fachadas de C, E, I (y los nombres, las de L, D y B); H completa los meses sin datos, arma los desgloses, redondea una sola vez y da formato. Cada gráfico tiene su propio endpoint para que uno que falle o venga vacío no afecte a los demás. Los endpoints de Sprint 2 (2.2 y 2.3) no cambian.


El Módulo H es la pantalla **"Indicadores"** del Gerente: **una sola pantalla con dos indicadores** (turnos por mes y alumnos nuevos por mes), no dos pantallas (mapa de pantallas §2). Es de solo lectura, no tiene tablas propias y no emite eventos.

Principio de diseño: **el módulo compone, no calcula**. No consulta `turnos` ni `alumnos` (Regla N.° 3): pide los conteos a los servicios públicos de Turnos (`spec_modulo_C.md` §2.15) y de Alumnos (`spec_modulo_B.md` §2.8), completa los meses sin datos con cero y da formato a la respuesta. Por eso un único endpoint devuelve ambas series: comparten un selector de rango (HU-H-02 AC4) y un único cálculo de los meses del rango.

Implementación estándar: Route Handler delgado que delega en `src/server/indicadores/indicadores.service.ts` (Reglas N.° 4 y 11).

**Desde la Revisión 2** los dos indicadores son **Ingresos cobrados por mes** (§2.2) y **Tasa de ocupación promedio por mes** (§2.3). Siguen en una sola pantalla, con un selector de rango compartido. Cada indicador tiene su propio endpoint porque las unidades son distintas (pesos y porcentaje), así que no comparten eje ni respuesta. El principio "el módulo compone, no calcula" se mantiene: las sumas y promedios por mes los entregan los servicios públicos de Pagos (I) y Turnos (C). H completa los meses sin datos, convierte a porcentaje y redondea.

**Alcance de esta revisión:** módulo nuevo de Sprint 2; la sección 2.1 y las reglas 3.1 a 3.5 son nuevas y aditivas. No hay secciones preexistentes, por lo que no se renumera nada (criterio de `docs/adicionales/sdd-metodologia.md`); los indicadores de Sprint 3 (HU-H-03 y HU-H-04) se agregarán como secciones nuevas al final de la §2.

---

## 2. Interfaces y Contratos

### Convenciones generales

> **Revisión 3.** Valen para todos los endpoints nuevos: contrato `{ data, error }`, validación Zod previa, `withPermission("indicadores:leer")` (el permiso ya existía desde Sprint 2; no se crea ninguno) y zona horaria de Buenos Aires. Los archivos nuevos siguen la Regla N.° 11 y **no mueven nada de lo existente**: `clases.service.ts`, `presentismo.service.ts` y `cancelaciones.service.ts` en `src/server/indicadores/`; los schemas nuevos se agregan a `indicadores.schema.ts`; los tipos, a `src/types/indicadores.types.ts`; los Route Handlers, en `app/api/indicadores/<nombre>/route.ts`. Como en Sprint 2, sin `actions.ts`.

- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("indicadores:leer")` (Regla N.° 10). **Permiso nuevo, exclusivo de GERENTE** (matriz en `spec_modulo_A.md` §2.4). Mesa de Entrada, Profesor y Alumno reciben `403 SIN_PERMISO`.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/indicadores.types.ts`, services en `src/server/indicadores/indicadores.service.ts`, schemas Zod en `src/server/indicadores/indicadores.schema.ts` y Route Handler en `app/api/indicadores/route.ts`. Sin `actions.ts`: el módulo es de solo lectura y el frontend llama al Route Handler. Imports siempre con el alias `@/`.
- **Zona horaria:** todos los meses se calculan en `America/Argentina/Buenos_Aires`.

---

### 2.1. Turnos por mes y alumnos nuevos por mes (HU-H-01, HU-H-02) — REEMPLAZADA en Revisión 2

> **Reemplazada por 2.2 y 2.3 (Revisión 2, 01/10/2026).** Se conserva como historial. `GET /api/indicadores`, `obtenerIndicadoresMensuales()`, `contarTurnosPorMes()` (C) y `contarAlumnosNuevosPorMes()` (B) ya no existen en el código.

**Ruta:** `GET /api/indicadores`
**Server Action equivalente:** — (solo Route Handler; módulo de solo lectura)
**Servicio:** `obtenerIndicadoresMensuales()` en `src/server/indicadores/indicadores.service.ts`
**Permiso requerido:** `indicadores:leer`
**Pantalla:** "Indicadores" (nueva, mapa de pantallas §2). Página completa; dos gráficos con **un solo selector de rango** para ambos.

```typescript
// src/server/indicadores/indicadores.schema.ts
const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato de mes inválido (AAAA-MM)");

export const IndicadoresQuerySchema = z.object({
  desde: mesSchema.optional(), // por defecto: 5 meses antes del mes actual (rango de 6 meses)
  hasta: mesSchema.optional(), // por defecto: el mes actual
}).refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
  message: "El mes desde no puede ser posterior al mes hasta", path: ["desde"],
}).refine((q) => q.hasta || !q.desde || q.desde <= mesActual(), {
  // solo `desde`: `hasta` es el mes actual, y un `desde` posterior dejaría un rango invertido
  message: "El mes desde no puede ser posterior al mes actual", path: ["desde"],
});
// mesActual(): mes de hoy en America/Argentina/Buenos_Aires, formato AAAA-MM (helper de indicadores.service.ts)
export type IndicadoresQuery = z.infer<typeof IndicadoresQuerySchema>;
```

**Comportamiento esperado:**
1. **Rango por defecto (AC1 de ambas HU):** los últimos **6 meses incluyendo el actual**. Si solo viene `hasta`, `desde` es 5 meses antes; si solo viene `desde`, `hasta` es el mes actual (y si ese `desde` es posterior al mes actual, `400` "El mes desde no puede ser posterior al mes actual").
2. **Rango ajustable:** cualquier rango `[desde, hasta]` con `desde ≤ hasta` (HU-H-01 AC3). **Tope de 24 meses**: si lo excede, `400` con el mensaje "El rango máximo es de 24 meses". **Ratificado por el PO (29/09/2026) — Q8**. Se permiten meses futuros (hay turnos programados a futuro: hasta 30 días los que se configuran de a uno, `ANTICIPACION_MAXIMA_DIAS`, y hasta `generacion_maxima_meses` —6 meses— los que genera `spec_modulo_C.md` §2.9); las altas de alumnos de esos meses son 0.
3. Generar la lista de meses del rango, **todos** — un mes sin datos **se muestra con valor 0**, nunca se omite (HU-H-01 AC4, HU-H-02 AC3).
4. **Turnos por mes** — invocar `contarTurnosPorMes(desde, hasta, db?)` (Módulo C, `spec_modulo_C.md` §2.15). Contrato de la llamada, según C §2.15: `desde` y `hasta` son meses `AAAA-MM` y los **límites son inclusivos** (desde el primer día de `desde` hasta el último día de `hasta`); devuelve `{ mes: "AAAA-MM", cantidad }[]`, **solo los meses con datos**. Reglas de conteo, ya resueltas en ese servicio:
   - Se agrupan por el **mes de la fecha del turno** (`fechaTurno`), **no** por la fecha de creación (HU-H-01 AC1).
   - Cuentan los turnos `DISPONIBLE`, `COMPLETO` y `CANCELADO`. **Los `PENDIENTE` no se cuentan**: todavía no representan una clase real (AC2).
5. **Alumnos por mes** — invocar `contarAlumnosNuevosPorMes(desde, hasta, db?)` (Módulo B, `spec_modulo_B.md` §2.8), con el mismo formato (`AAAA-MM`, límites inclusivos) y el mismo resultado (`{ mes, cantidad }[]`, solo meses con datos). Reglas de conteo, ya resueltas en ese servicio:
   - Se agrupan por la **fecha de alta de la ficha** (`createdAtAlumno`, un timestamp) convertida a `America/Argentina/Buenos_Aires`, no a UTC: un alta a las 22:00 del 30 de septiembre en Salta pertenece a septiembre, aunque en UTC ya sea octubre.
   - Se cuentan **todas** las fichas dadas de alta en el mes, **activas o inactivas, con o sin cuenta de acceso vinculada** (HU-H-02 AC2). Es un conteo simple: no distingue por otro criterio (AC5).
6. Combinar ambas series sobre la misma lista de meses. Los dos servicios devuelven solo los meses con datos (sin ceros): completar con `0` es responsabilidad de este módulo.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "rango": { "desde": "2026-04", "hasta": "2026-09", "meses": 6 },
    "meses": [
      { "mes": "2026-04", "turnos": 0,  "alumnos_nuevos": 3 },
      { "mes": "2026-05", "turnos": 12, "alumnos_nuevos": 5 },
      { "mes": "2026-09", "turnos": 27, "alumnos_nuevos": 8 }
    ]
  },
  "error": null
}
```
`mes` es siempre `AAAA-MM` (estable, ordenable); el nombre legible ("septiembre 2026") lo arma la UI con `Intl.DateTimeFormat("es-AR")`.

**Errores esperados:** `400` (validación Zod con `flatten()`, o rango > 24 meses) · `403 SIN_PERMISO`.

**Frontend:**
- Un único selector de rango (dos selectores de mes, "Desde" y "Hasta", con el rango por defecto precargado) que actualiza **ambos** gráficos.
- Dos gráficos de barras, uno por indicador. Los colores salen de los tokens `--chart-1` y `--chart-2` (`docs/DESIGN.md` §2): **prohibido** usar colores hex o de la paleta por defecto de Tailwind.
- **Accesibilidad:** cada barra lleva su valor en texto (etiqueta de dato o tabla alternativa), no depende solo del color.
- Un mes con valor 0 se dibuja con altura 0 pero conserva su etiqueta en el eje.
- Sin datos en todo el rango: los gráficos se muestran igual con todos los meses en 0, más un texto de apoyo "No hay datos para el período seleccionado".
- **Librería de gráficos:** `docs/DESIGN.md` define los tokens `--chart-*` pero no fija la librería. Recomendación: el componente `chart` de shadcn/ui (basado en Recharts). Si el equipo prefiere otra, se documenta en la task.

---

### Convenciones comunes a 2.2 y 2.3 (Revisión 2)

> **Revisión 3.** Estas convenciones (esquema del rango, validación, permiso) valen también para los endpoints de 2.4.3, 2.5, 2.6 y 2.7. Lo que es propio de 2.2 y 2.3 es la forma de `data` (un arreglo de meses); los endpoints nuevos devuelven un objeto, con sus `meses` o `items`, descrito en cada sección, y en las listas de `meses` el primer y el último elemento también son el rango resuelto.


```typescript
// src/server/indicadores/indicadores.schema.ts
export const RangoIndicadoresQuerySchema = z.object({
  desde: mesSchema.optional(), // AAAA-MM. Por defecto: 5 meses antes de `hasta` (6 meses incluyendo el actual)
  hasta: mesSchema.optional(), // AAAA-MM. Por defecto: el mes actual en America/Argentina/Buenos_Aires
}).superRefine(/* desde ≤ hasta; un `desde` solo no puede ser posterior al mes actual; tope de 24 meses */);
export type RangoIndicadoresInput = z.infer<typeof RangoIndicadoresQuerySchema>;
```

- Se mantienen las mismas reglas de rango que en 2.1 (pasos 1 y 2): 6 meses por defecto incluyendo el actual, tope de 24 (Q8) y mensajes iguales.
- **Validación:** un query inválido devuelve `400` con `{ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos", detalles: <flatten()> } }`. El código `VALIDATION_ERROR` es el de la task, y en el proyecto conviven `VALIDACION` y `VALIDATION_ERROR`.
- **Permiso:** `withPermission("indicadores:leer")`. Sin sesión → `401 SESION_INVALIDA`; con sesión y sin permiso → `403 SIN_PERMISO`.
- **Respuesta:** `data` es un arreglo con **todos** los meses del rango, en orden cronológico, con clave `mes` en formato `AAAA-MM`. El primer y el último elemento son el rango resuelto: el frontend los usa para precargar los selectores en la primera carga.

### 2.2. Ingresos cobrados por mes (HU-H-01 revisada) — NUEVA en Revisión 2

> **Revisión 3.** **Sin cambios** de ruta, query, respuesta ni errores. Lo único que se mueve es el origen del dato: `sumarPagosPorMes` conserva firma y forma y pasa a sumar el **monto vigente** de cada pago y a excluir los **anulados** (HU-H-06 criterio 2, HU-I-06; `spec_modulo_I.md`). Con los pagos de Sprint 2, que no tienen correcciones ni anulaciones, el resultado es idéntico. Verificación diferida hasta HU-I-06. La pantalla lo muestra con el componente común (2.4.4) y su leyenda dice «Por fecha de pago».


**Ruta:** `GET /api/indicadores/ingresos-por-mes?desde=AAAA-MM&hasta=AAAA-MM`
**Servicio:** `obtenerIngresosPorMes(rango: RangoIndicadoresInput)` en `src/server/indicadores/indicadores.service.ts`
**Consume:** `sumarPagosPorMes(desde, hasta, db?)` de `spec_modulo_I.md` §2.3
**Permiso requerido:** `indicadores:leer`

**Comportamiento esperado:**
1. Resolver el rango (convenciones comunes).
2. Pedir a Pagos la suma de `montoPago` agrupada por el mes de `fechaPago` (un `@db.Date`, así que el mes es su fecha calendario), con límites inclusivos.
3. Se consideran **todos** los pagos del período, sin distinguir forma de pago, turno ni estado del turno (AC3; ver Punto abierto P1).
4. Completar con `0` los meses sin pagos (AC2) y devolver en orden cronológico.
5. `total` es un `number` en pesos con hasta dos decimales. Pagos lo entrega como texto decimal exacto (`"450000.00"`) y H lo convierte con `Number()`. El valor máximo de `Decimal(11,2)` sumado en un mes sigue siendo exacto en coma flotante para dos decimales en los volúmenes del centro.

**Respuesta `200 OK`:**
```json
{ "data": [{ "mes": "2026-05", "total": 450000 }, { "mes": "2026-06", "total": 0 }], "error": null }
```

**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

### 2.3. Tasa de ocupación promedio por mes (HU-H-02 revisada) — NUEVA en Revisión 2

> **Revisión 3.** **Sin cambios** de ruta, query, respuesta ni errores. Se conserva el promedio simple por clase y `fechaTurno ≤ hoy` (T2 y T3). «Inscriptos» pasa a ser «inscripciones vigentes» (reservadas no vencidas, pagadas y pago sin registrar): C lo resuelve con `esVigenteEn` y, con los datos de Sprint 2, donde no hay inscripciones canceladas, el número es el mismo. El total del encabezado del gráfico sale de 2.4.3 y no de esta respuesta.


**Ruta:** `GET /api/indicadores/ocupacion-por-mes?desde=AAAA-MM&hasta=AAAA-MM`
**Servicio:** `obtenerOcupacionPromedioPorMes(rango: RangoIndicadoresInput)` en `src/server/indicadores/indicadores.service.ts`
**Consume:** `promediarOcupacionTurnosPorMes(desde, hasta, fechaMaxima, db?)` de `spec_modulo_C.md` §2.15
**Permiso requerido:** `indicadores:leer`

**Comportamiento esperado:**
1. Resolver el rango (convenciones comunes) y la fecha de hoy en `America/Argentina/Buenos_Aires` (`fechaMaxima`, `AAAA-MM-DD`).
2. **Turnos elegibles:** estado `DISPONIBLE` o `COMPLETO`, `cupoMaximoTurno` no nulo y mayor que cero (tienen aula asignada), `fechaTurno` dentro del rango **y `fechaTurno ≤ fechaMaxima`** (solo turnos ya dictados o del día; decisión de relevamiento). `CANCELADO` y `PENDIENTE` quedan excluidos (AC2).
3. Por turno: `ocupación = inscriptos / cupoMaximoTurno`, donde `inscriptos` es la cantidad de filas de `turno_alumno` del turno. Es el mismo criterio que el texto `"n/m"` del listado y el detalle (C §2.4).
4. Agrupar por mes de `fechaTurno` y promediar (promedio simple por turno, no ponderado por cupo).
5. Convertir a porcentaje y **redondear a 1 decimal** (AC4; ver P3). Completar con `0` los meses sin turnos elegibles (AC3), incluidos los meses futuros.

**Respuesta `200 OK`:**
```json
{ "data": [{ "mes": "2026-05", "ocupacion_promedio": 64.2 }, { "mes": "2026-06", "ocupacion_promedio": 71.8 }], "error": null }
```

**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

**Frontend (2.2 y 2.3, pantalla `/gerente`):**

> **Revisión 3.** Por mandato de HU-H-06 (criterios 2, 4 y 5) la pantalla cambia en tres puntos, y en nada más: (1) los selectores «Desde» y «Hasta» propios de estas tarjetas los reemplaza el filtro de período común del panel (2.4.2); (2) «Todavía no hay suficientes datos para este período» pasa a ser «No hay datos para el período seleccionado» **por gráfico** (el otro sigue visible); (3) la tabla visualmente oculta se reemplaza por «Ver como tabla» (2.4.4). Se conservan las dos tarjetas, la grilla, el Bar Chart y el Line Chart, los colores `--chart-1` y `--chart-2`, la línea de meta del 80 %, los formatos y el control de permiso de la página. Los gráficos pasan al componente común (2.4.4).

- Arriba de ambos gráficos va un único control de rango: los dos selectores de mes "Desde" y "Hasta" que ya existían. Un cambio vuelve a pedir **los dos** endpoints.
- Dos `Card`, una por indicador, en grilla de 2 columnas en desktop y 1 en mobile. Mientras cargan, cada una muestra un `Skeleton` adentro.
- **Ingresos:** Bar Chart de serie simple, color `--chart-1`. **Ocupación:** Line Chart, color `--chart-2`, con una línea de referencia horizontal en la meta (P4) en `--muted-foreground`. Nunca se combinan en un mismo eje.
- Se usan `ChartContainer`, `ChartTooltip`/`ChartTooltipContent` y `ChartLegend`/`ChartLegendContent` de shadcn. El tooltip muestra el valor exacto: el monto en moneda local con `Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })` y el porcentaje con 1 decimal.
- **Sin datos en ambos indicadores** (todo el rango en 0): se reemplazan los gráficos por el mensaje "Todavía no hay suficientes datos para este período".
- La página verifica el permiso `indicadores:leer` (no el rol). Sin permiso redirige a `/sin-permiso` y sin sesión a `/login`, con `exigirPermiso("indicadores:leer")` de `with-permission.ts`. La task mencionaba `/no-autorizado`, pero esa ruta no existe.
- **Accesibilidad:** cada `Card` incluye una tabla visualmente oculta con los valores por mes, igual que el gráfico de la Revisión 1, para no depender solo del color ni del hover.

---

### 2.4. Panel de indicadores: pestañas y período común (HU-H-06) — NUEVA en Revisión 3

**Pantalla:** `/gerente` (T1), la misma de Sprint 2, con el mismo `exigirPermiso("indicadores:leer")`. **Permiso:** `indicadores:leer` en cada endpoint (solo GERENTE; HU-H-06, criterio 6). El servidor rechaza al resto con `403 SIN_PERMISO` y a quien no tiene sesión con `401 SESION_INVALIDA`, como en 2.2 y 2.3.

**Qué cambia en el servidor:** solo se suma lo que está en 2.4.3 a 2.7. Los endpoints de 2.2 y 2.3 no cambian de ruta, query, respuesta ni errores. El resto de HU-H-06 (pestañas, período común, componente de gráfico) es de interfaz.

#### 2.4.1. Estructura de la pantalla

1. Título «Indicadores» y, fijo arriba, el **filtro de período** (2.4.2). Reemplaza al selector de rango propio de HU-H-01 y HU-H-02 (criterio 2).
2. Tres pestañas, con estos nombres y en este orden (criterio 1): **«Actividad»** (pestaña inicial), **«Índice de Presentismo»** y **«Cancelaciones»**. Al cambiar de pestaña se conserva el período.
3. Contenido de cada pestaña:

| Pestaña | Gráficos (en grilla de 2 columnas en pantallas anchas, 1 en angostas) | Debajo de los gráficos | Sección |
|---|---|---|---|
| Actividad | «Ingresos cobrados» (barras), «Tasa de ocupación» (línea con meta), «Clases por materia» y «Clases por profesor» (barras horizontales) | — | 2.2, 2.3, 2.4.3, 2.5 |
| Índice de Presentismo | «Inscriptos vs. presentes» por mes (barras agrupadas con línea) y por materia (barras horizontales agrupadas) | Aviso de clases sin control y tabla «Alumnos con presentismo bajo» | 2.6 |
| Cancelaciones | «Cancelaciones por mes» (barras agrupadas) y «Cancelaciones por materia» (barras horizontales agrupadas) | Las dos tasas del período | 2.7 |

4. **Orden vertical (criterio 7):** primero los gráficos; las tasas, las tablas y los avisos van debajo. El total de cada gráfico va en su encabezado (2.4.4).
5. Cada pestaña pide sus datos **solo cuando se la abre** y cada gráfico hace su propio pedido: uno que falla o viene vacío no afecta a los demás (criterios 3 y 4). Los datos de una pestaña ya cargada se vuelven a pedir cuando cambia el período.
6. La página sigue verificando el permiso (no el rol), como en Sprint 2. Las pestañas no son rutas: no hay páginas nuevas ni permisos nuevos.

#### 2.4.2. Filtro de período común (criterio 2)

- Rango de **meses** «Desde» y «Hasta» (`AAAA-MM`), **6 meses por defecto incluyendo el actual**, máximo **24** (Q8). Es el mismo rango y el mismo `RangoIndicadoresQuerySchema` de Sprint 2; los endpoints nuevos reciben `?desde=AAAA-MM&hasta=AAAA-MM` y lo validan igual, con los mismos mensajes y `400 VALIDATION_ERROR`.
- **Selectores (DEC-40):** ofrecen desde 23 meses atrás hasta 3 meses adelante del mes actual. Si «Desde» queda posterior a «Hasta», o el rango supera 24 meses, la interfaz **ajusta el otro extremo** y avisa «El período máximo es de 24 meses.». El pedido que llega al servidor siempre es válido; el `400` del servidor (que dice «El rango máximo es de 24 meses») sigue existiendo para quien llame a la API directamente (T11).
- Un cambio de período vuelve a pedir los gráficos de la pestaña activa **sin recargar la página** (criterio 3). Un pedido en curso se cancela cuando llega uno nuevo, y una respuesta tardía de un período anterior se descarta.
- El estado (pestaña y período) vive en el cliente y no se guarda entre visitas (P-H11).

#### 2.4.3. `GET /api/indicadores/ocupacion-resumen` (encabezado de la Tasa de ocupación)

**Ruta:** `GET /api/indicadores/ocupacion-resumen?desde=AAAA-MM&hasta=AAAA-MM`
**Servicio:** `obtenerResumenOcupacion(rango: RangoIndicadoresInput)` en `src/server/indicadores/indicadores.service.ts` (archivo existente; la función es nueva)
**Consume:** `promediarOcupacionTurnosPorMes(desde, hasta, fechaMaxima, db?)` de C §2.15, **la misma llamada y los mismos parámetros que 2.3**
**Permiso requerido:** `indicadores:leer`

Comportamiento: se resuelve el rango y `fechaMaxima` (hoy, Buenos Aires) como en 2.3; se pide a C el promedio por mes y la cantidad de clases (`turnos`), y se calcula `ocupacion_promedio = Σ(promedio × turnos) / Σ(turnos)` (el promedio simple por clase de **todo** el período, no el promedio de los promedios mensuales), redondeado a 1 decimal como en 3.8. Sin clases elegibles: `{ ocupacion_promedio: 0, turnos: 0 }`.

```json
{ "data": { "ocupacion_promedio": 68.4, "turnos": 52 }, "error": null }
```
**Errores:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`. Existe porque el «total» del encabezado (criterio 7) no puede salir de sumar los porcentajes de los meses (T9). El Line Chart sigue alimentándose de 2.3.

#### 2.4.4. Componente común de gráfico (criterio 5)

Un único componente de la pantalla (`GraficoIndicador`, en la carpeta de componentes de la pantalla de indicadores que ya usa el Sprint 2) lo usan los gráficos de HU-H-01, HU-H-02, HU-H-03, HU-H-07 y HU-H-10. Está construido sobre `ChartContainer`, `ChartTooltip` y `ChartLegend` de shadcn/ui (Recharts), como en Sprint 2; las barras con línea, con `ComposedChart`.

- **Entradas:** título, **total** del encabezado (ya formateado por quien lo usa), **leyenda de la fecha** (2.4.5), series (`clave`, `etiqueta`, **unidad**, tipo `barra` o `linea`, token de color), datos, orientación (vertical u horizontal), formateador de valores, texto de vacío, estado (`cargando`, `error`, `vacio`, `ok`) y `onReintentar`.
- **Colores:** solo tokens `--chart-*` de `docs/DESIGN.md` (los de Sprint 2 son `--chart-1` y `--chart-2`; si hacen falta más series se usan los siguientes `--chart-N` definidos allí). Prohibido usar hex o la paleta por defecto de Tailwind. La línea de meta de la ocupación sigue en `--muted-foreground`.
- **Valor sobre cada barra o punto, escrito** (no depende del color ni del hover); al pasar el cursor o tocar, el detalle exacto en el tooltip. En barras agrupadas con línea, sobre cada par de barras se escribe la diferencia que el gráfico pida (HU-H-07: ausentes).
- **«Ver como tabla»:** botón del encabezado (`aria-pressed`) que muestra los **mismos datos** en una tabla accesible, con las mismas unidades. Reemplaza a la tabla visualmente oculta de Sprint 2 (la información sigue estando disponible para lectores de pantalla: la tabla se renderiza siempre y se muestra u oculta visualmente según el botón).
- **Estados:** `cargando` con `Skeleton` dentro de la tarjeta; `error` con un mensaje y el botón «Reintentar» (que vuelve a pedir **solo** ese gráfico); `vacio` con «No hay datos para el período seleccionado» (o el texto propio del gráfico, como «No hay clases en el período seleccionado» en HU-H-03). El resto de las tarjetas sigue visible (criterio 4). Los textos de error son propuestos (P-H12).
- **Unidades:** cada serie declara su unidad y la leyenda la muestra. Series de unidades distintas **no se suman** ni comparten total (HU-H-10).
- **Períodos de más de 12 meses (criterio 7):** los gráficos por mes (Ingresos cobrados, Tasa de ocupación, Inscriptos vs. presentes y Cancelaciones por mes) ocupan el **ancho completo**; el eje muestra el mes abreviado y el año solo en enero y en el primer mes del período («Ene ’26»); el valor sobre cada barra va en formato compacto y en una línea (`Intl.NumberFormat("es-AR", { notation: "compact" })`: «3,8 M», «988 mil»; los porcentajes, «53%»); los meses sin datos no muestran valor. Si aun así las barras no entran (pantallas angostas o varias series por mes), el gráfico se **desplaza horizontalmente dentro de su tarjeta sin achicar las barras**, arranca mostrando los meses más recientes y debajo se informa «Se muestran los meses más recientes. Desplazá el gráfico hacia la izquierda para ver los anteriores.». Los gráficos por materia y por profesor no cambian.
- **Se conservan de Sprint 2:** moneda con `Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })`, porcentaje con 1 decimal, Bar Chart para ingresos y Line Chart para ocupación con la línea de meta `META_OCUPACION_PORCENTAJE` (80 %, P4), y nunca se combinan ingresos y ocupación en un mismo eje.
- **Totales de los encabezados:** Ingresos cobrados, la suma de los meses (en pesos, redondeada a 2 decimales); Tasa de ocupación, `ocupacion_promedio` de 2.4.3; Clases por materia y por profesor, el `total` de la respuesta (2.5); Inscriptos vs. presentes y Cancelaciones por mes, el `resumen`/`totales` de la respuesta (2.6 y 2.7).

#### 2.4.5. Qué fecha usa cada gráfico (leyenda, criterio 2)

| Gráfico | Fecha que define el período | Leyenda propuesta |
|---|---|---|
| Ingresos cobrados | Fecha de pago | «Por fecha de pago. Monto vigente de cada pago, sin los anulados.» |
| Tasa de ocupación | Fecha de la clase | «Por fecha de la clase. Inscripciones vigentes (reservadas no vencidas, pagadas y pago sin registrar) sobre el cupo, en clases Disponibles y Completas hasta hoy.» |
| Clases por materia / por profesor | Fecha de la clase | «Por fecha de la clase. Disponibles, Completas y Canceladas; sin Pendientes.» (en profesores se agrega: «Las horas suman solo las clases Disponibles y Completas.») |
| Inscriptos vs. presentes (mes y materia) | Fecha de la clase dictada | «Por fecha de la clase dictada. Se cuentan inscripciones y presencias, no alumnos distintos. Solo clases con control de asistencia, sin las anuladas.» |
| Cancelaciones (mes y materia) | Fecha de la clase | «Por fecha de la clase. Cada serie cuenta una cosa distinta (clases o inscripciones) y no se suman entre sí.» |

#### 2.4.6. Qué lectura alimenta cada gráfico

| Gráfico | Endpoint de H | Lectura que usa (módulo) |
|---|---|---|
| Ingresos cobrados | 2.2 | `sumarPagosPorMes` (I) |
| Tasa de ocupación (gráfico y encabezado) | 2.3 y 2.4.3 | `promediarOcupacionTurnosPorMes` (C) |
| Clases por materia / por profesor | 2.5 | `contarClasesPorMes` (C), `listarMateriasActivas` y `obtenerMateriasPorIds` (L), `listarOpcionesProfesoresActivos` y `obtenerProfesoresBasicos` (D) |
| Inscriptos vs. presentes | 2.6 | `contarAsistenciasPorMes` y `contarClasesDictadasSinControl` (E), `obtenerMateriasPorIds` (L) |
| Alumnos con presentismo bajo | 2.6 | `listarAlumnosConPresentismoBajo` (E), `parametrosVigentes` (PR 0), `obtenerAlumnosBasicos` (B), `obtenerMateriasPorIds` (L) |
| Cancelaciones | 2.7 | `contarClasesPorMes` e `contarInscripcionesPorMes` (C), `obtenerMateriasPorIds` (L) |

**Verificación diferida (backlog):** el monto vigente de Ingresos cobrados se completa cuando esté HU-I-06; la pestaña «Índice de Presentismo» cuando esté HU-H-07; los gráficos de HU-H-03 cuando esté HU-H-03; la pestaña «Cancelaciones» cuando esté HU-H-10. Mientras tanto la pestaña no muestra el gráfico pendiente. Cada HU deja sus datos de presentación como fixtures repetibles en el punto de extensión del seed (Pendiente 11).

---

### 2.5. Clases por materia y por profesor (HU-H-03) — NUEVA en Revisión 3

Dos endpoints de lectura que alimentan los dos gráficos de barras horizontales de la pestaña «Actividad» (criterio 1). HU-H-03 absorbió a HU-H-04 (clases por profesor): mismo componente, misma pestaña y mismo criterio de conteo, cambiando solo el agrupamiento.

**Archivos (Regla N.° 11):** servicios en `src/server/indicadores/clases.service.ts` (`obtenerClasesPorMateria`, `obtenerClasesPorProfesor`); tipos en `src/types/indicadores.types.ts` (archivo existente); Route Handlers en `app/api/indicadores/clases-por-materia/route.ts` y `app/api/indicadores/clases-por-profesor/route.ts`. Sin `actions.ts`. **Permiso:** `withPermission("indicadores:leer")`. **Query:** `RangoIndicadoresQuerySchema` (2.4.2), sin parámetros nuevos.

**Qué es una clase para este indicador (criterio 2):** los turnos `DISPONIBLE`, `COMPLETO` y `CANCELADO`, por **fecha del turno** (`fechaTurno`, mes `AAAA-MM`, límites inclusivos); los `PENDIENTE` no se cuentan. Es el criterio de la HU-H-01 original de Sprint 2 (3.2 de esta spec) y es el mismo que usa HU-H-10 para el total de clases (3.10).

#### 2.5.1. `GET /api/indicadores/clases-por-materia`

**Comportamiento esperado:**
1. Resolver el rango.
2. Pedir a C `contarClasesPorMes(rango, { estados: ["DISPONIBLE", "COMPLETO", "CANCELADO"], por: "materia" }, db?)` (2.8.1) y sumar `cantidad` por `materia_id` sobre todos los meses y estados. H **no** consulta `turnos` (3.1).
3. Armar la lista de materias: **todas las activas**, aunque tengan 0 (`listarMateriasActivas()`, L §2.6), más las **inactivas que tuvieron clases en el período**, resueltas en lote con `obtenerMateriasPorIds(ids)` (L §2.5, que trae `activa`). Las inactivas llevan `activa: false` y la interfaz las rotula «Inactiva» (criterio 4; la baja de una materia es lógica, Regla N.° 1, así que sus clases siguen existiendo).
4. Ordenar de **mayor a menor** cantidad (criterio 3); desempate por nombre (sin distinguir mayúsculas ni acentos) y luego por id, para que el orden sea estable.
5. `total` es la suma de `clases` de todas las materias.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "total": 41,
    "items": [
      { "materia_id": "…", "nombre": "Física I", "codigo": "FIS1", "activa": true, "clases": 14 },
      { "materia_id": "…", "nombre": "Cálculo II", "codigo": "CAL2", "activa": false, "clases": 6 },
      { "materia_id": "…", "nombre": "Química", "codigo": "QUI1", "activa": true, "clases": 0 }
    ]
  },
  "error": null
}
```
**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

#### 2.5.2. `GET /api/indicadores/clases-por-profesor`

**Comportamiento esperado:**
1. Resolver el rango.
2. Pedir a C `contarClasesPorMes(rango, { estados: ["DISPONIBLE", "COMPLETO", "CANCELADO"], por: "profesor" }, db?)` (2.8.1). Cada fila trae el `estado` y los `minutos`: H suma **`cantidad` de los tres estados** (la cantidad de clases) y **`minutos` solo de `DISPONIBLE` y `COMPLETO`** (criterio 5: las canceladas cuentan en la cantidad, no en las horas). Las filas sin profesor (C no devuelve un `profesor_id` nulo en este agrupamiento) no figuran en este indicador.
3. Lista de profesores: **todos los activos**, aunque tengan 0 (`listarOpcionesProfesoresActivos()`, D §2.8), más los **inactivos que tuvieron clases en el período**, resueltos en lote con `obtenerProfesoresBasicos(ids)` (2.8.4). Las inactivos llevan `activo: false` y la interfaz los rotula «Inactivo».
4. `horas` = minutos / 60 con hasta 2 decimales (las duraciones válidas son de 1, 2 o 3 horas, así que en la práctica es un entero o con `.5`).
5. Orden: clases de mayor a menor; desempate por horas de mayor a menor, nombre y id.
6. `total.clases` y `total.horas` suman los profesores listados.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "total": { "clases": 38, "horas": 61.5 },
    "items": [
      { "profesor_id": "…", "nombre": "Pérez, Ana", "activo": true, "clases": 12, "horas": 22 },
      { "profesor_id": "…", "nombre": "Gómez, Luis", "activo": false, "clases": 4, "horas": 6 },
      { "profesor_id": "…", "nombre": "Ruiz, Marta", "activo": true, "clases": 0, "horas": 0 }
    ]
  },
  "error": null
}
```
`nombre` es siempre «Apellido, Nombre» (el mismo formato de D). **Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

**Frontend (pestaña «Actividad»):**
- Dos tarjetas con el componente común (2.4.4), barras horizontales, valor numérico escrito al final de cada barra. En «Clases por profesor» se escribe también la cantidad de horas («12 clases · 22 h»). El total va en el encabezado («38 clases · 61,5 h» en profesores).
- El alto del gráfico crece con la cantidad de filas (no hay desplazamiento interno): se ven todas las materias y todos los profesores activos.
- La etiqueta «Inactiva» o «Inactivo» acompaña al nombre.
- Sin clases en todo el período (`total` en 0): en lugar de los gráficos, «No hay clases en el período seleccionado» (criterio 6), en las dos tarjetas.
- «Ver como tabla» incluye materia o profesor, estado (activo o inactivo), clases y, en profesores, horas.

---

### 2.6. Índice de presentismo: inscriptos vs. presentes (HU-H-07) — NUEVA en Revisión 3

Tres endpoints de lectura que alimentan la pestaña «Índice de Presentismo». El indicador se llama **«Índice de presentismo»** en toda la pestaña: `presentes / inscriptos`, en porcentaje.

**Archivos (Regla N.° 11):** `src/server/indicadores/presentismo.service.ts` (`obtenerPresentismoPorMes`, `obtenerPresentismoPorMateria`, `listarAlumnosConPresentismoBajo`); tipos en `src/types/indicadores.types.ts`; Route Handlers en `app/api/indicadores/presentismo-por-mes/route.ts`, `…/presentismo-por-materia/route.ts` y `…/alumnos-presentismo-bajo/route.ts`. **Permiso:** `withPermission("indicadores:leer")`. **Query:** `RangoIndicadoresQuerySchema`; el tercer endpoint suma `pagina`.

**Qué se cuenta (criterio 3, 3.12):**
- Solo **clases registradas como dictadas con asistencia individual** (HU-E-09). Las registradas «sin control de asistencia» (todas las de Sprint 2 y las de `POST` sin cuerpo) **se excluyen** y se informa cuántas quedaron afuera. Las clases dictadas **anuladas** (HU-E-11) no se cuentan.
- Se cuentan **inscripciones y presencias, no alumnos distintos**: un alumno inscripto en 4 clases dictadas del mes suma 4 inscriptos.
- **Inscriptos de una clase dictada** = las inscripciones vigentes que quedaron registradas en ella (la fotografía de la clase dictada, `spec_modulo_E.md` 3.2), es decir `presentes + ausentes` con el estado de asistencia vigente (E 3.6). Una reserva sin pagar vence a más tardar al inicio de la clase (HU-C-22), así que las inscripciones vigentes ya no incluyen reservas vencidas. **Ausentes** = `inscriptos − presentes`.
- El mes es el de la **fecha de la clase dictada**.

#### 2.6.1. `GET /api/indicadores/presentismo-por-mes`

**Comportamiento esperado:**
1. Resolver el rango y la lista de meses.
2. Pedir a E `contarAsistenciasPorMes(rango, {}, db?)` (E §2.13): `{ mes, presentes, ausentes, sin_control }[]`, solo meses con datos. H usa `presentes` y `ausentes`; **ignora** `sin_control` (cuenta filas de alumno, no clases).
3. Pedir a E `contarClasesDictadasSinControl(rango, db?)` (2.8.3).
4. Por cada mes del rango: `inscriptos = presentes + ausentes`, `ausentes`, y `indice = presentes / inscriptos × 100` redondeado a 1 decimal (3.8, 3.13). Un mes sin inscriptos tiene los tres números en 0 e `indice: null`.
5. `resumen` suma los meses y calcula su índice sobre la suma (no el promedio de los índices).

**Respuesta `200 OK`:**
```json
{
  "data": {
    "meses": [
      { "mes": "2026-08", "inscriptos": 0, "presentes": 0, "ausentes": 0, "indice": null },
      { "mes": "2026-09", "inscriptos": 120, "presentes": 96, "ausentes": 24, "indice": 80.0 }
    ],
    "resumen": { "inscriptos": 120, "presentes": 96, "ausentes": 24, "indice": 80.0 },
    "clases_sin_control": 3
  },
  "error": null
}
```
**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

#### 2.6.2. `GET /api/indicadores/presentismo-por-materia`

1. Resolver el rango. Pedir a E `contarAsistenciasPorMes(rango, { porMateria: true }, db?)` y sumar por `materia_id` sobre todos los meses.
2. Nombres en lote con `obtenerMateriasPorIds` (L §2.5). Se listan las materias **con al menos un inscripto** en el período (sin inscriptos el índice no existe); las inactivas con datos figuran con `activa: false`.
3. Orden **de menor a mayor índice** (criterio 2: primero las materias con más inasistencia); desempate por más ausentes, nombre y id.
4. Incluye `resumen` y `clases_sin_control` igual que 2.6.1 (el aviso es de toda la pestaña).

```json
{
  "data": {
    "items": [
      { "materia_id": "…", "nombre": "Física I", "codigo": "FIS1", "activa": true, "inscriptos": 40, "presentes": 26, "ausentes": 14, "indice": 65.0 }
    ],
    "resumen": { "inscriptos": 120, "presentes": 96, "ausentes": 24, "indice": 80.0 },
    "clases_sin_control": 3
  },
  "error": null
}
```
**Errores esperados:** los mismos de 2.6.1.

#### 2.6.3. `GET /api/indicadores/alumnos-presentismo-bajo?desde=…&hasta=…&pagina=1` (criterio 4)

```typescript
// src/server/indicadores/indicadores.schema.ts (se agrega; no se modifica nada existente)
export const PresentismoBajoQuerySchema = RangoIndicadoresQuerySchema.and(
  z.object({ pagina: z.coerce.number().int().min(1).default(1) }),
);
export const POR_PAGINA_PRESENTISMO_BAJO = 10;
export const MINIMO_CLASES_PRESENTISMO_BAJO = 2;
```
1. Resolver el rango y leer el **umbral vigente** con `parametrosVigentes().umbral_presentismo` (75 por defecto; HU-N-01 lo hace configurable y rige **sobre todo el período consultado**, HU-N-01 criterio 3).
2. Pedir a E `listarAlumnosConPresentismoBajo(rango, { umbral, minimoClases: 2, limite: 10, desplazamiento: (pagina − 1) × 10 }, db?)` (2.8.3). E devuelve, por **alumno y materia**, las filas con al menos 2 clases dictadas con control en ese período y un índice **estrictamente menor** al umbral (comparación exacta con enteros: `presentes × 100 < umbral × clases`), ya ordenadas y paginadas, más el `total`.
3. Resolver en lote los nombres de los alumnos de la página (`obtenerAlumnosBasicos`, B §2.8) y de las materias (`obtenerMateriasPorIds`). `nombre_completo` es «Apellido, Nombre».
4. `porcentaje = presentes / clases × 100`, 1 decimal.
5. Orden (P-H10): porcentaje ascendente, ausencias descendente, `alumno_id`, `materia_id`. Una página fuera de rango devuelve `items: []` con el `total`.

```json
{
  "data": {
    "umbral": 75, "minimo_clases": 2, "pagina": 1, "por_pagina": 10, "total": 23,
    "items": [
      { "alumno_id": "…", "nombre_completo": "Díaz, Juan", "materia_id": "…", "materia": "Física I",
        "clases_dictadas": 5, "ausencias": 3, "porcentaje": 40.0 }
    ]
  },
  "error": null
}
```
**Errores esperados:** `400 VALIDATION_ERROR` (incluye `pagina` inválida) · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

**Frontend (pestaña «Índice de Presentismo»):**
- **Gráfico por mes** (ancho completo si el período supera 12 meses, 2.4.4): barras agrupadas «Inscriptos» y «Presentes», una al lado de la otra, y una **línea** con el «Índice de presentismo» en un eje secundario de 0 a 100 %. Sobre cada par de barras se escribe la diferencia: la cantidad de ausentes. Los meses con `indice: null` no dibujan punto ni valor. Total del encabezado: `resumen` («96 de 120 · 80 %»).
- **Gráfico por materia:** barras horizontales agrupadas (inscriptos y presentes), con el índice y los ausentes escritos junto al nombre; primero las de menor índice.
- **Aviso** debajo de los gráficos: «N clases dictadas sin control de asistencia no se incluyen en el índice.» (se muestra siempre, también con 0; texto propuesto, P-H12).
- **Tabla «Alumnos con presentismo bajo»:** columnas alumno, materia, clases dictadas, ausencias y %; encabezado con el umbral vigente («menos de 75 %»); paginada de a 10 (paginación del proyecto, `pagina` en la query); cada fila lleva el enlace al **historial académico** del alumno (pestaña «Historial académico» de su ficha, HU-E-05, en modo consulta para el Gerente, HU-E-02 criterio 8) con la materia de la fila preseleccionada. Vacía: «No hay alumnos con presentismo bajo en el período.».
- Sin clases dictadas con control en el período: los gráficos muestran «No hay datos para el período seleccionado» y el aviso sigue visible.
- **Verificación diferida (backlog):** la exclusión de clases anuladas, cuando esté HU-E-11; el enlace al historial, cuando esté HU-E-02; el umbral configurable, cuando esté HU-N-01 (hasta entonces rige el 75 de `ParametroSistema`).

---

### 2.7. Cancelaciones (HU-H-10) — NUEVA en Revisión 3

Dos endpoints de lectura que alimentan la pestaña «Cancelaciones»: lo que canceló el centro (clases) y lo que cancelaron o perdieron los alumnos (inscripciones). **No hay escrituras**: HU-H-10 solo muestra datos que ya registran HU-C-05, HU-C-14, HU-C-24 y HU-B-07.

**Archivos (Regla N.° 11):** `src/server/indicadores/cancelaciones.service.ts` (`obtenerCancelacionesPorMes`, `obtenerCancelacionesPorMateria`); tipos en `src/types/indicadores.types.ts`; Route Handlers en `app/api/indicadores/cancelaciones-por-mes/route.ts` y `…/cancelaciones-por-materia/route.ts`. **Permiso:** `withPermission("indicadores:leer")` (criterio 6). **Query:** `RangoIndicadoresQuerySchema`.

**Qué se cuenta (3.10, 3.11):**

| Serie | Qué cuenta | Unidad |
|---|---|---|
| Clases canceladas por el centro | Turnos `CANCELADO` (HU-C-05), por fecha del turno | clases |
| Inscripciones canceladas por alumnos | Inscripciones `CANCELADA_ALUMNO` (HU-C-14) | inscripciones |
| Reservas vencidas | Inscripciones cuya reserva venció sin pago (HU-C-24): las marcadas `RESERVA_VENCIDA` **y** las vencidas que el proceso todavía no marcó (`esVigenteEn`); **no** suman a las canceladas por el alumno | inscripciones |
| Bajas | Inscripciones quitadas por la baja del alumno (HU-B-07), `BAJA_ALUMNO`; no suman a las canceladas por el alumno y no figuran en el gráfico por materia | inscripciones |

- Las tres series de inscripciones cuentan **solo inscripciones de clases no canceladas por el centro** (HU-H-10 criterio 1; HU-C-24 criterio 6; T7), y el mes es el de la **fecha de la clase**, no el de la cancelación.
- Las inscripciones **quitadas por el centro** (`QUITADA_CENTRO`) no se cuentan en ninguna serie ni en las tasas.
- Las series cuentan cosas distintas y **no se suman entre sí**: ninguna respuesta trae un total combinado.

#### 2.7.1. `GET /api/indicadores/cancelaciones-por-mes`

**Comportamiento esperado:**
1. Resolver el rango y la lista de meses.
2. Pedir a C `contarClasesPorMes(rango, { estados: ["DISPONIBLE", "COMPLETO", "CANCELADO"] }, db?)` (2.8.1, sin `por`): por mes y estado. Las clases canceladas por el centro son las de estado `CANCELADO`; las clases totales del período son la suma de los tres estados, sin `PENDIENTE` (el criterio de conteo de HU-H-03, 3.10).
3. Pedir a C `contarInscripcionesPorMes(rango, { vigencias: ["VIGENTE", "CANCELADA_ALUMNO", "RESERVA_VENCIDA", "BAJA_ALUMNO"] }, db?)` (2.8.2): por mes y clasificación, solo de clases no canceladas por el centro.
4. Por cada mes del rango (ceros incluidos, 3.3): `clases_canceladas_centro`, `inscripciones_canceladas_alumno`, `reservas_vencidas` y `bajas`. Las inscripciones `VIGENTE` no se muestran en el gráfico: se usan solo para la tasa.
5. `totales` suma cada serie por separado sobre el período.
6. **Tasas del período (criterio 2):**
   - `clases.tasa = clases canceladas / clases totales × 100`, con los totales de arriba.
   - `inscripciones.tasa = inscripciones canceladas por el alumno / inscripciones totales × 100`, donde las totales son **vigentes + canceladas por el alumno + reservas vencidas** de clases no canceladas por el centro; las bajas y las quitadas por el centro no entran en ningún término.
   - Redondeo a 1 decimal (3.8). Denominador 0: `tasa: null`.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "meses": [
      { "mes": "2026-09", "clases_canceladas_centro": 2, "inscripciones_canceladas_alumno": 9, "reservas_vencidas": 4, "bajas": 1 }
    ],
    "totales": { "clases_canceladas_centro": 5, "inscripciones_canceladas_alumno": 20, "reservas_vencidas": 11, "bajas": 3 },
    "tasas": {
      "clases": { "canceladas": 5, "totales": 60, "tasa": 8.3 },
      "inscripciones": { "canceladas_alumno": 20, "totales": 400, "tasa": 5.0 }
    }
  },
  "error": null
}
```
**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

#### 2.7.2. `GET /api/indicadores/cancelaciones-por-materia`

1. Resolver el rango.
2. C `contarClasesPorMes(rango, { estados: ["CANCELADO"], por: "materia" }, db?)` y C `contarInscripcionesPorMes(rango, { vigencias: ["CANCELADA_ALUMNO"], porMateria: true }, db?)`; H suma cada una por `materia_id` sobre todos los meses. **Las bajas y las reservas vencidas no figuran** (criterio 4 y criterio 3).
3. Nombres en lote con `obtenerMateriasPorIds` (L). Se listan las materias con al menos una cancelación de cualquiera de las dos series; las inactivas con datos figuran con `activa: false`.
4. Orden de **mayor a menor** por clases canceladas por el centro (la primera serie); desempate por inscripciones canceladas por alumnos (mayor primero), nombre y id (P-H6).

```json
{
  "data": {
    "items": [
      { "materia_id": "…", "nombre": "Física I", "codigo": "FIS1", "activa": true,
        "clases_canceladas_centro": 3, "inscripciones_canceladas_alumno": 8 }
    ]
  },
  "error": null
}
```
**Errores esperados:** los mismos de 2.7.1.

**Frontend (pestaña «Cancelaciones»):**
- **Cancelaciones por mes** (ancho completo si el período supera 12 meses): barras agrupadas con cuatro series — «Clases canceladas por el centro», «Inscripciones canceladas por alumnos», «Reservas vencidas» y «Bajas» —, cada una con su **unidad en la leyenda** («clases» o «inscripciones»). El encabezado muestra los totales **por serie**, nunca una suma.
- **Cancelaciones por materia:** barras horizontales agrupadas con las dos series «Canceladas por el centro (clases)» y «Canceladas por el alumno (inscripciones)», con el valor escrito.
- **Tasas del período** debajo de los gráficos: «Clases canceladas: 8,3 % (5 de 60)» e «Inscripciones canceladas por el alumno: 5,0 % (20 de 400)». Con `tasa: null` se escribe «—».
- Sin datos en una serie o en todo el período: «No hay datos para el período seleccionado» en el gráfico correspondiente.
- HU-H-10 no tiene verificaciones diferidas: sus datos de prueba salen de los servicios de HU-C-14 y HU-B-07, que van antes, y se dejan como fixtures repetibles.

---

### 2.8. Lecturas de otros módulos que usa la Revisión 3 — NUEVA en Revisión 3

Conforme a la Regla N.° 3, H no consulta tablas de otros módulos (3.1). Esta sección define el contrato exacto de las lecturas que **faltan** en las fachadas (DEC-41: cada HU agrega las suyas en la fachada del módulo dueño del dato) y lista las que ya existen. Todas son **solo lectura**, no validan permisos (los valida la ruta de H), no bloquean, usan `$queryRaw` parametrizado cuando hace falta SQL y aceptan `db?: Prisma.TransactionClient` (sin él, `prisma`). Los rangos son `{ desde: "AAAA-MM", hasta: "AAAA-MM" }` con límites **inclusivos**, igual que `promediarOcupacionTurnosPorMes`. Ninguna fachada importa a otra: H compone en su propio servicio.

#### 2.8.1. Módulo C — `contarClasesPorMes(rango, { estados, por? }, db?)`

Archivo: `turno.publico.ts`.

- `estados`: lista no vacía con valores de `DISPONIBLE`, `COMPLETO` y `CANCELADO`. `PENDIENTE` **no se admite** (error de programación: lanza `Error`), porque ningún indicador lo cuenta (3.10).
- `por`: opcional, `"materia"` o `"profesor"`.
- Agrupa por el **mes de `fechaTurno`**, por `estado` y, si hay `por`, por `materia_id` o `profesor_id`.
- Devuelve `{ mes: "AAAA-MM", estado, materia_id?, profesor_id?, cantidad, minutos }[]`: `cantidad` es la cantidad de turnos y `minutos` la suma de sus duraciones (`horaFin − horaInicio`, la misma que C usa como `duracion_min`). **Solo los grupos con datos**, ordenados por mes, estado y clave. Con `por: "profesor"` no se devuelven los turnos sin profesor.
- No depende de las inscripciones: no usa `esVigenteEn`.
- **Consumidores:** `spec_modulo_H.md` 2.5 y 2.7. Respecto del PR 0 §2.13 (`contarClasesPorMes(rango, { estados, por })`) solo agrega `estado` y `minutos` al resultado (T6): la función todavía no existe.

#### 2.8.2. Módulo C — `contarInscripcionesPorMes(rango, { vigencias, porMateria? }, db?)`

Archivo: `inscripcion.publico.ts`.

- `vigencias`: lista no vacía con valores de `VIGENTE`, `CANCELADA_ALUMNO`, `RESERVA_VENCIDA` y `BAJA_ALUMNO`.
- Cada inscripción se **clasifica una sola vez**, en el instante `ahora()`, con la regla única de vigencia (`sqlVigenteEn`, la misma de `esVigenteEn`):
  - `VIGENTE`: vigente en ese instante (reservada no vencida, pagada o pago sin registrar).
  - `RESERVA_VENCIDA`: `vigencia = RESERVA_VENCIDA` **o** reserva sin pagar cuyo vencimiento ya pasó y que el proceso todavía no marcó. Cuenta como vencida aunque no esté marcada.
  - `CANCELADA_ALUMNO` y `BAJA_ALUMNO`: por su valor de `vigencia`.
  - `QUITADA_CENTRO` nunca se devuelve.
- Solo se consideran inscripciones de clases `DISPONIBLE` o `COMPLETO` (no canceladas por el centro, no pendientes), agrupadas por el **mes de `fechaTurno`** y, si `porMateria`, por `materia_id`.
- Devuelve `{ mes: "AAAA-MM", vigencia, materia_id?, cantidad }[]`, solo los grupos con datos, ordenados por mes, vigencia y materia.
- **Consumidor:** `spec_modulo_H.md` 2.7 (T4: los inscriptos de HU-H-07 no salen de acá). Es la función `contarInscripcionesPorMes(rango, { vigencias, porMateria? })` que ya nombra el PR 0 §2.13.

#### 2.8.3. Módulo E — dos lecturas nuevas en `historial.publico.ts`

Se suman a `asistenciaDeAlumno` y `contarAsistenciasPorMes` de `spec_modulo_E.md` §2.13, que **no cambian**. El archivo sigue sin importar nada de otros módulos. Ambas aplican el valor vigente (E 3.6) y el predicado de clase no anulada (E 3.7) con los fragmentos de `valor-vigente.ts`, sin reimplementarlos.

- **`contarClasesDictadasSinControl(rango, db?)`** → `number`: cantidad de clases dictadas **no anuladas** cuya marca vigente «con control de asistencia» es falsa y cuya `fechaClaseDictada` cae en el rango. Una clase registrada sin control y después controlada con HU-E-11 deja de contar acá. Consumidor: 2.6.
- **`listarAlumnosConPresentismoBajo(rango, { umbral, minimoClases, limite, desplazamiento }, db?)`** → `{ total: number, items: { alumno_id, materia_id, clases, presentes, ausentes }[] }`.
  - Parte de `ClaseDictadaAlumno` de clases dictadas no anuladas **y con control**, con `fechaClaseDictada` en el rango y con estado vigente `PRESENTE` o `AUSENTE` (las filas sin estado no cuentan).
  - Agrupa por alumno y materia; `clases = presentes + ausentes`.
  - Conserva los grupos con `clases ≥ minimoClases` y `presentes × 100 < umbral × clases` (comparación exacta con enteros; `umbral` entero de 1 a 100, fuera de ese rango lanza `Error`).
  - Orden: `presentes / clases` ascendente, `ausentes` descendente, `alumno_id`, `materia_id`; `total` es la cantidad de grupos **antes** de paginar; `limite` y `desplazamiento` paginan en la consulta.
  - Consumidor: 2.6.3.

#### 2.8.4. Módulo D — `obtenerProfesoresBasicos(ids, db?)`

Archivo: `profesor.publico.ts`. Devuelve `{ id, nombre, apellido, nombreParaMostrar, activo }[]` en lote, de profesores activos **o inactivos**; los ids inexistentes simplemente no aparecen. `nombreParaMostrar` es «Apellido, Nombre» (el mismo formato de `listarOpcionesProfesoresActivos`). **Es aditiva:** `obtenerNombresProfesores` y `listarOpcionesProfesoresActivos` no cambian (T10). Consumidor: 2.5.2.

#### 2.8.5. Lecturas que ya existen y no cambian

| Módulo | Función | La usa |
|---|---|---|
| I | `sumarPagosPorMes(desde, hasta, db?)` → `{ mes, total }[]` (`total` texto decimal exacto) | 2.2 |
| C | `promediarOcupacionTurnosPorMes(desde, hasta, fechaMaxima, db?)` → `{ mes, promedio, turnos }[]` | 2.3 y 2.4.3 |
| E | `contarAsistenciasPorMes(rango, { porMateria? }, db?)` → `{ mes, materia_id?, presentes, ausentes, sin_control }[]` | 2.6 |
| L | `listarMateriasActivas()` → `{ id, nombre, codigo }[]`; `obtenerMateriasPorIds(ids, db?)` → `{ id, nombre, codigo, activa }[]` | 2.5, 2.6, 2.7 |
| D | `listarOpcionesProfesoresActivos(db?)` → `{ id, nombre, apellido, nombreParaMostrar }[]` | 2.5.2 |
| B | `obtenerAlumnosBasicos(ids, db?)` → `{ id, nombre, apellido, dni, activo, forma_pago_preferida_id }[]` | 2.6.3 |
| PR 0 | `parametrosVigentes()` → incluye `umbral_presentismo` | 2.6.3 |

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/indicadores/indicadores.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. El módulo no consulta tablas de otros módulos

> **Revisión 3.** Sigue valiendo, sin excepciones. A las funciones de la Revisión 2 se suman las de 2.8: `contarClasesPorMes` e `contarInscripcionesPorMes` (C), `contarClasesDictadasSinControl` y `listarAlumnosConPresentismoBajo` (E), `obtenerProfesoresBasicos` (D), y las ya existentes `contarAsistenciasPorMes` (E), `listarMateriasActivas` y `obtenerMateriasPorIds` (L), `listarOpcionesProfesoresActivos` (D) y `obtenerAlumnosBasicos` (B), más `parametrosVigentes()` del PR 0.

Los datos vienen de servicios públicos de otros módulos. En la Revisión 1 eran `contarTurnosPorMes()` (`spec_modulo_C.md` §2.15) y `contarAlumnosNuevosPorMes()` (`spec_modulo_B.md` §2.8). **Desde la Revisión 2** son `sumarPagosPorMes()` (`spec_modulo_I.md` §2.3) y `promediarOcupacionTurnosPorMes()` (`spec_modulo_C.md` §2.15). Cualquier indicador futuro se agrega pidiendo una función pública nueva al módulo dueño del dato, nunca con un `SELECT` directo.

### 3.2. El mes de un turno es el de su fecha, no el de su creación

> **Revisión 3.** El criterio del mes se conserva y lo usan también HU-H-03 y HU-H-10. La regla sobre `CANCELADO` que 3.6 reemplazó para la ocupación **sí** vale para el conteo de clases de HU-H-03 y HU-H-10 (3.10), que es el criterio de la HU-H-01 original: cuentan `DISPONIBLE`, `COMPLETO` y `CANCELADO`, no `PENDIENTE`.

Un turno creado en septiembre para una clase en octubre cuenta en octubre. `CANCELADO` **sí** cuenta (el turno se registró): es una decisión de negocio explícita de HU-H-01 AC2 y contrasta con los calendarios, que lo excluyen. *(Revisión 2: el criterio del mes sigue vigente para la ocupación. La inclusión de `CANCELADO` aplicaba solo al conteo de 2.1 y queda reemplazada por 3.6.)*

### 3.3. Los meses sin datos se muestran con cero

> **Revisión 3.** Se conserva para todas las series por mes (2.6.1 y 2.7.1 devuelven todos los meses del rango). En los rankings por materia y por profesor de HU-H-03 las activas figuran con 0 (3.15). El índice de presentismo de un mes sin inscriptos es `null` y no 0 (3.13).

La lista de meses se genera en este módulo; los servicios de conteo no devuelven ceros. Omitir un mes sin datos rompería la lectura del gráfico.

### 3.4. Zona horaria consistente

> **Revisión 3.** Sin cambios. El mes de una clase dictada es el de su `fechaClaseDictada` (`@db.Date`); las inscripciones se clasifican con instantes (`ahora()`) pero se ubican por el mes de la fecha de su clase.

El mes de un `@db.Date` (turno) es su propia fecha calendario. El mes de un timestamp (alta de alumno) se calcula en `America/Argentina/Buenos_Aires`. Las consultas usan `$queryRaw` parametrizado (`Prisma.sql`), nunca SQL concatenado.

### 3.5. Solo lectura

> **Revisión 3.** Sin cambios: todos los endpoints nuevos son `GET`.

El módulo no crea, modifica ni transiciona ningún dato. Por eso no aplica la Regla N.° 2 (trazabilidad de mutaciones) y no emite eventos.

### 3.6. Qué turnos cuentan para la ocupación (Revisión 2)

> **Revisión 3.** Sin cambios (T3). Es otra definición que la de «clase» de 3.10 y no se mezclan.

Solo `DISPONIBLE` y `COMPLETO` con cupo asignado (`cupoMaximoTurno > 0`) y `fechaTurno ≤ hoy` en Buenos Aires. `CANCELADO` no representa una clase dictada; `PENDIENTE` todavía no tiene cupo. Un turno futuro todavía no se dictó y su inscripción puede cambiar, así que contarlo distorsionaría la lectura de "qué se ocupó".

### 3.7. Qué pagos cuentan como ingreso (Revisión 2)

> **Revisión 3.** Se conserva «todos los pagos del mes, sin distinguir forma de pago ni estado del turno». Se agrega lo que manda HU-H-06 criterio 2: se suma el **monto vigente** de cada pago y se excluyen los **anulados** (HU-I-06). Un pago de un turno cancelado después sigue contando mientras no esté anulado (P1).

Todos los `Pago` con `fechaPago` en el mes, sin filtrar por forma de pago ni por el estado actual del turno. Un pago es un hecho consumado (Regla N.° 8, I §3.6): el dinero se cobró aunque el turno se haya cancelado después. Es la propuesta por defecto de la task; la ratificación está pendiente con el PO (P1).

### 3.8. Redondeo (Revisión 2)

> **Revisión 3.** Se conserva y se extiende a los índices y tasas de la Revisión 3 (3.13).

Los servicios de C e I entregan valores sin redondear: el promedio como razón 0–1 y la suma como texto decimal exacto. El redondeo a 1 decimal del porcentaje se hace una sola vez, en H, con la mitad hacia arriba (igual que `ROUND` de PostgreSQL), para que el tooltip y la tabla accesible muestren el mismo número. **Nota de sincronización (01/10/2026, detectada en el contraste SQL de nivel 3):** con `AVG` sobre `float8` el resultado dependía del orden de suma, y un 38,75% salía 38,7 o 38,8 según el rango consultado. Por eso C promedia en `numeric` y H elimina el ruido binario (`toPrecision(12)`) antes de `Math.round`.

### 3.9. Período común y validación — NUEVA en Revisión 3
Todos los endpoints de la Revisión 3 validan el rango con el `RangoIndicadoresQuerySchema` de Sprint 2, sin variantes: `AAAA-MM`, 6 meses por defecto incluyendo el actual, `desde ≤ hasta`, tope de 24 (Q8) y los mismos mensajes. El ajuste del otro extremo y el aviso «El período máximo es de 24 meses.» (DEC-40) son de la interfaz y nunca reemplazan la validación del servidor (T11). Cada gráfico usa **una sola fecha** para ubicar un dato en un mes, y la leyenda la declara (2.4.5): fecha de pago (ingresos), fecha de la clase (ocupación, clases, cancelaciones) y fecha de la clase dictada (presentismo). Todos los meses se calculan en `America/Argentina/Buenos_Aires`; el mes de un `@db.Date` es su fecha calendario (3.4).

### 3.10. Qué es una clase y cuándo cuenta — NUEVA en Revisión 3
- Para HU-H-03 y para el total de clases de HU-H-10 una clase es un turno `DISPONIBLE`, `COMPLETO` o `CANCELADO`, por `fechaTurno`; los `PENDIENTE` no se cuentan (criterio de la HU-H-01 original de Sprint 2, 3.2). Es **una sola definición**, implementada una sola vez en `contarClasesPorMes` (C, 2.8.1): H-03 y H-10 no la reimplementan.
- Las **horas** de un profesor suman solo las clases `DISPONIBLE` y `COMPLETO`; las `CANCELADO` cuentan en la cantidad y no en las horas.
- La ocupación (2.3, 3.6) es otra definición, distinta a propósito: clases `DISPONIBLE` y `COMPLETO` con cupo, hasta hoy. No se mezclan.

### 3.11. Cómo se clasifica una inscripción para las cancelaciones — NUEVA en Revisión 3
- La clasificación la hace C con la regla única de vigencia (`esVigenteEn` / `sqlVigenteEn`) en el instante de la consulta, una sola vez por inscripción (2.8.2). Una reserva sin pagar cuyo vencimiento ya pasó **cuenta como «Reserva vencida» aunque el proceso no la haya marcado**, y una reserva vence cuando el momento es igual o posterior a `venceEl`.
- Solo cuentan inscripciones de clases no canceladas por el centro (`DISPONIBLE` o `COMPLETO`). Las `QUITADA_CENTRO` no cuentan en ninguna serie ni tasa; las `BAJA_ALUMNO` son una serie aparte y no entran en las tasas ni en el gráfico por materia.
- Una persona que cancela y se vuelve a inscribir en la misma clase tiene **dos inscripciones**: la cancelada cuenta como cancelada y la nueva como vigente.
- El mes de una inscripción es el de la fecha de su clase, no el de la fecha en que se canceló o venció.

### 3.12. Qué cuenta para el Índice de presentismo — NUEVA en Revisión 3
- Solo clases dictadas **con control de asistencia** y **no anuladas**, con el estado de asistencia **vigente** (E 3.6 y 3.7): una corrección de asistencia (HU-E-11) se refleja acá sin que H haga nada. Las registradas sin control se excluyen y se informan como cantidad de **clases** (T5).
- `inscriptos = presentes + ausentes` de la fotografía de cada clase dictada (T4); se cuentan inscripciones y presencias, no alumnos distintos.
- El umbral es `parametrosVigentes().umbral_presentismo` leído **al consultar** y se aplica a todo el período consultado (HU-N-01, criterio 3). «Presentismo bajo» es **estrictamente menor** al umbral y exige al menos 2 clases dictadas en esa materia en el período. La comparación se hace con enteros (`presentes × 100 < umbral × clases`), sin redondeos.
- Marcar ausente, corregir la asistencia o anular una clase dictada no mueve pagos ni inscripciones (E 3.12): estos indicadores solo leen.

### 3.13. Tasas, índices y redondeo — NUEVA en Revisión 3
- Índices y tasas se calculan en H sobre los enteros que entregan las fachadas y se redondean **una sola vez**, a 1 decimal, con la mitad hacia arriba, con el mismo procedimiento de 3.8 (`toPrecision(12)` y luego `Math.round`).
- Denominador 0: el valor es `null` (nunca 0 ni `NaN`) y la interfaz escribe «—» o no dibuja el punto.
- Los totales de series de unidades distintas **no se combinan**: las respuestas de 2.7 traen totales por serie y ninguna suma de clases con inscripciones (HU-H-10, criterios 1 y 3).
- El promedio del período de la ocupación (2.4.3) es el promedio simple por clase de todo el período, ponderado por la cantidad de clases de cada mes, y no el promedio de los porcentajes mensuales.

### 3.14. Orden de los desgloses — NUEVA en Revisión 3
| Desglose | Orden |
|---|---|
| Clases por materia | Clases ↓, nombre, id |
| Clases por profesor | Clases ↓, horas ↓, nombre, id |
| Presentismo por materia | Índice ↑, ausentes ↓, nombre, id |
| Alumnos con presentismo bajo | Porcentaje ↑, ausencias ↓, `alumno_id`, `materia_id` |
| Cancelaciones por materia | Clases canceladas por el centro ↓, inscripciones canceladas por alumnos ↓, nombre, id |
El nombre se compara sin distinguir mayúsculas ni acentos (collator `es-AR`). El orden lo define el servidor; la interfaz no reordena.

### 3.15. Nombres, etiquetas y consultas en lote — NUEVA en Revisión 3
Los nombres de materias, profesores y alumnos se resuelven **en lote**, con una llamada por módulo y por respuesta (`obtenerMateriasPorIds`, `obtenerProfesoresBasicos`, `obtenerAlumnosBasicos`), nunca una por fila. Las materias y los profesores **inactivos** figuran solo si tuvieron datos en el período y con `activa: false` o `activo: false`; las activas figuran siempre en los rankings de HU-H-03 (con 0). Una materia o un profesor con datos siempre existe (baja lógica, Regla N.° 1).

### 3.16. Lecturas, consistencia y errores — NUEVA en Revisión 3
- Los endpoints no escriben, no bloquean y no abren transacción propia: son lecturas agregadas. Dentro de una respuesta, cada fachada lee en su propia consulta; un cambio concurrente entre dos consultas puede reflejarse en una y en otra no, y es aceptable para un indicador (no se promete una instantánea).
- Cada endpoint es independiente: que falle uno (por ejemplo, un `500` de una fachada) no impide pedir los demás. Una respuesta de error nunca trae datos parciales: `{ data: null, error }` según la Regla N.° 5.
- Los errores de dominio y de validación usan los mismos códigos y el mismo sobre que 2.2 y 2.3 (`400 VALIDATION_ERROR`, `401 SESION_INVALIDA`, `403 SIN_PERMISO`). No se crea ningún código de error nuevo.
- No hay Regla N.° 2 que cumplir: nada se muta (sección 4).

### 3.17. Pruebas obligatorias (módulo H) — NUEVA en Revisión 3
1. **Los tests de Sprint 2 de 2.2 y 2.3 siguen pasando.** Solo cambian los mocks de las fachadas de I y C si cambió su origen; no cambia ninguna aserción de respuesta ni de `code`.
2. **Contrato común de cada endpoint nuevo:** Gerente `200`; Mesa de Entrada, Profesor y Alumno `403 SIN_PERMISO`; sin sesión `401 SESION_INVALIDA`; rango inválido, `desde > hasta` y más de 24 meses `400 VALIDATION_ERROR`; rango por defecto de 6 meses.
3. **Clases (HU-H-03):** cuentan `DISPONIBLE`, `COMPLETO` y `CANCELADO` y no `PENDIENTE`; el mes es el de `fechaTurno`; las horas excluyen las canceladas; las materias y profesores activos figuran con 0; los inactivos solo con datos y con la marca; orden y desempates de 3.14; `total` coherente. Equivalencia: la suma de clases por materia es igual a la de clases por profesor (si todas tienen profesor) y a las clases totales de 2.7.1.
4. **Ocupación resumen:** igual al cálculo directo sobre un fixture; en un fixture con meses de distinto tamaño difiere del promedio de promedios; sin clases devuelve `0` y `0`.
5. **Presentismo (HU-H-07):** `inscriptos = presentes + ausentes`; un alumno en 4 clases suma 4; las clases sin control se excluyen y se informan como clases; las anuladas no cuentan; una asistencia corregida se lee con el valor nuevo; mes sin datos con `indice: null`; el orden por materia; el umbral es estricto (justo 75,0 % no figura) y exige al menos 2 clases; cambiar `umbral_presentismo` cambia la tabla sin tocar código; paginación de a 10 con `total` correcto y página fuera de rango.
6. **Cancelaciones (HU-H-10):** una reserva vencida sin marcar cuenta como «Reserva vencida» (incluido el borde `venceEl = ahora`); una clase cancelada por el centro saca sus inscripciones de las tres series y de las tasas; `QUITADA_CENTRO` no aparece en ningún lado; las bajas no están en el gráfico por materia ni en las tasas; el mes es el de la clase; cancelar y volver a inscribirse suma una cancelada y una vigente; los denominadores de las dos tasas; ninguna respuesta suma unidades distintas.
7. **Lecturas de las fachadas con PostgreSQL real** (no solo mocks): `contarClasesPorMes`, `contarInscripcionesPorMes`, `contarClasesDictadasSinControl` y `listarAlumnosConPresentismoBajo`.
8. **Aislamiento (Regla N.° 3):** ningún archivo de `src/server/indicadores/` consulta tablas de otros módulos ni importa una fachada desde otra fachada; la composición está en los servicios de H.
9. **Interfaz:** el período se conserva al cambiar de pestaña; un gráfico con error o vacío no afecta a los demás y «Reintentar» pide solo ese; «Ver como tabla» muestra los mismos datos; el eje y los valores compactos con más de 12 meses; los colores salen de tokens `--chart-*`.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Este módulo no usa ni la opción (a) (columnas de auditoría) ni la opción (b) (tabla de eventos) de la Regla N.° 2: es exclusivamente de lectura, no tiene tablas propias, no muta ningún dato y por lo tanto no hay mutaciones que trazar ni eventos de dominio que emitir (misma conclusión que `spec_modulo_J.md` §4).

> **Revisión 3.** Se confirma: el módulo sigue siendo **exclusivamente de lectura**. Los endpoints nuevos de 2.4.3, 2.5, 2.6 y 2.7 son todos `GET`, no tienen tablas propias, no escriben en ninguna tabla ni en el historial de nadie y no emiten eventos. Las fachadas que consumen (2.8) son lecturas; no hay mutaciones que trazar.

---

## 5. Decisiones registradas

> **Revisión 3.** Ver al final de esta sección el estado de cada decisión y punto abierto de las Revisiones 1 y 2, y el encabezado de la Revisión 3 para los puntos nuevos (P-H1 a P-H12).


| # | Punto | Dónde impacta | Quién resuelve | Decisión contractualizada |
|---|---|---|---|---|
| Q8 | ¿Tope de meses del rango? | 2.1 paso 2 | PO | 24 meses — **ratificado 29/09/2026** |
| — | Librería de gráficos | Frontend | Equipo, en la task | Componente `chart` de shadcn/ui (instalado en la Revisión 2, con `recharts`) |
| R2-a | Ruta de la pantalla | Frontend | Implementador, confirmado en relevamiento (01/10/2026) | Se mantiene `/gerente` |
| R2-b | Granularidad del rango | Convenciones 2.2/2.3 | Ídem | Por mes, tope de 24 (Q8) |
| R2-c | Turnos futuros en la ocupación | 2.3, 3.6 | Ídem | Excluidos (`fechaTurno ≤ hoy`), se mide con inscriptos |
| R2-d | Server Actions | 2.2, 2.3 | Ídem | No se agregan |

**Puntos abiertos para el PO (Revisión 2, se implementó la propuesta por defecto de la task y quedan pendientes de ratificación):**
| # | Punto | Implementado provisoriamente |
|---|---|---|
| P1 | ¿Se excluyen los pagos de turnos cancelados después? | No se excluyen (3.7) |
| P3 | Redondeo de la ocupación | 1 decimal (3.8) |
| P4 | Meta de referencia del Line Chart | 80%, constante `META_OCUPACION_PORCENTAJE` en el frontend (no es configurable) |
| P5 | KPI cards de variación % | Fuera de alcance |

> **Revisión 3.** Estado de lo registrado en las Revisiones 1 y 2 después del backlog del Sprint 3: **Q8** (tope de 24 meses): se conserva y ahora lo aplica el filtro de período común del panel (2.4.2, HU-H-06 criterio 2). **Librería de gráficos:** se conserva (`chart` de shadcn/ui sobre Recharts) y pasa a estar detrás del componente común de 2.4.4. **R2-a** (ruta `/gerente`): se conserva (T1). **R2-b** (rango por mes, tope de 24): se conserva. **R2-c** (la ocupación solo cuenta clases con `fechaTurno ≤ hoy`): se conserva (T3, P-H3). **R2-d** (sin Server Actions): se conserva; los endpoints nuevos son Route Handlers de lectura.
>
> **Puntos abiertos de la Revisión 2 (P1, P3, P4 y P5):** siguen como estaban. **P1:** los pagos de turnos cancelados después siguen contando (3.7); lo que ahora **no** cuenta son los pagos anulados (HU-I-06), que es otra cosa. **P3:** la ocupación sigue redondeándose a 1 decimal (3.8 y 3.13). **P4:** la línea de meta del 80 % del Line Chart se mantiene (2.4.4). **P5:** las tarjetas de variación porcentual siguen fuera de alcance; el «total» de cada encabezado de HU-H-06 no es una variación.
>
> Los puntos nuevos de la Revisión 3 (P-H1 a P-H12) los resolvió el Scrum Master el 08/10/2026; están en el encabezado de la Revisión 3, con a quién se informa cada uno.
```
