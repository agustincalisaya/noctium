# HU-E-02 — Historial de clases del alumno

09/10/2026. Base develop `56e7537`: E11 #224 y E08 #225 integrados. Refactor documental #223 integrado; task en `docs/tasks/Sprint 3/Modulo E/HU-E-02.md`. Rama independiente, sin merge automático.

## Implementación y criterios

GET `/api/alumnos/[id]/clases` con `alumnos:leer` y defensa explícita Mesa/Gerente. Fachadas B/C para identidad e inscripciones; E consulta exclusivamente sus clases/asistencias vigentes. Nueve resultados con prioridad contractual, reservas vencidas aún sin marcar, cancelación anterior/posterior al fin de inscripción, frontera de inicio, múltiples inscripciones por turno y legacy. Filtros AND de resultado/fechas calendario inclusivas; resumen del conjunto filtrado antes de paginar; orden descendente y páginas de diez. Porcentaje solo sobre clases con control: legacy aparece como asistió y queda fuera del denominador. DTO sin precio, importe ni estado de pago.

Ruta canónica `/alumnos/[id]/clases`: ficha resumida, breadcrumb, pestañas, filtros, diez tarjetas en cinco columnas × dos filas en escritorio y tabla de seis columnas. Móvil adapta la grilla y permite scroll local de tabla. Filtro reinicia página; carga, rango inválido, vacío literal, sin coincidencias, limpiar y error/reintento conservando filtros. Solicitudes tardías descartadas. Gerente en modo consulta sin escrituras. Figuras 66–67 tomadas como referencia; datos provienen de fixtures reales, no se inventan cifras ni acciones. Sidebar sin cambios.

Migración nueva revoca exclusivamente `PROFESOR alumnos:leer`; seed conserva la revocación. Acceso del profesor desde clase propia, limitado a materia/alumno autorizado; sin ficha general, DNI/contacto ni pestañas. Permisos se leen de BD por solicitud.

## Pruebas realmente ejecutadas

Validaciones locales secuenciales. Por instrucción posterior del usuario, se limitó el trabajo a bloques pequeños, un worker y un proceso de validación a la vez; **no se repitieron suites globales**.

- Bloque servicio/schema/rutas E02: **22 aprobadas**, tres archivos, `vitest run … --maxWorkers=1`.
- Bloque API y componente Clases: **19 aprobadas**, dos archivos.
- Bloque ficha y acceso acotado Profesor: **7 aprobadas**, dos archivos.
- Validación dirigida de errores/claves de textos: **13 aprobadas**. La corrida global iniciada antes de la instrucción del usuario terminó con 2118 aprobadas, 199 omitidas y un fallo por claves con guiones bajos. Se corrigieron a camelCase; se verificó solamente el archivo afectado y el comprobador de textos. No se declara la suite global final aprobada.
- Regresión schema de historial: **8 aprobadas**; servicio de historial E08/E09: **15 aprobadas**, en bloques separados.
- PostgreSQL E02/permisos: **2 pruebas extensas aprobadas** en base descartable creada y eliminada por `scripts/test-pg.mjs`. Casos de nueve estados, cancelación/fin, correcciones sucesivas, anulación, legacy, filtros, paginación, roles y migración preservando Mesa/Gerente/historial Profesor.
- PostgreSQL de regresión E08: **1 prueba extensa aprobada**, ejecutada después en otra base descartable, comprobando dueño, aislamiento, correcciones/anulaciones y paginación.
- Lint solo archivos TS/TSX afectados contra develop: **0 errores, 0 advertencias**.
- `tsx scripts/verificar-claves-textos.ts`: aprobado. Límite de heap de 512 MB resultó insuficiente para este comprobador; se ejecutó solo, con 1024 MB, y pasó.
- `next typegen` y `tsc --noEmit`: aprobados, secuenciales.
- `next build --webpack`: aprobado; ejecutado sin otros tests o navegadores.
- Seed propio repetido: SQL y conteos iguales, 92 turnos, 242 inscripciones, 20 clases, 0 auditorías de estados y 24 pagos. Base exclusiva `noctium_e02_review_20261009_v2`. Fixtures generan hechos por servicios públicos y configuran profesores/aulas disponibles; no insertan estados de negocio directamente.
- SQL de contraste read-only ejecutado: [resultado-sql.txt](hu-e-02/resultado-sql.txt).

No se ejecutó suite PostgreSQL completa para E02 por la instrucción del usuario. El fallo previo de E10 al consultar historial Profesor sin materia está documentado en E11/E08 y reproducido sobre develop sin cambios; esta entrega conserva el requisito de materia y no debilita pruebas/permisos.

## Navegador y HTTP reales

Playwright sobre build de producción, puerto local 3013; Chromium headless, un contexto por vez, escritorio 1440×1000 y móvil 390×844. Mesa/Gerente con datos reales. Verificados nueve resultados, páginas disjuntas, filtros AND inclusivos, legacy y porcentaje; 400 query inválida, 404 alumno inexistente, 403 Profesor/Alumno y 401 anónimo. API sin montos.

UI: página 2 seguida de filtro vuelve a 1, fechas y rango inválido, limpiar, sin coincidencias, vacío real de alumno inactivo sin clases, error 503 simulado y reintento real conservando AUSENTE. Sin errores de página ni desbordamiento global móvil; tabla tiene scroll local y foco de teclado. Capturas de escritorio/móvil revisadas juntas en una pasada, sin necesidad de ajustes posteriores. El encabezado/sidebar compartidos conservan su implementación existente.

Sesión vigente de Profesor: en esta base aislada se restauró temporalmente el grant de configuración antiguo; misma sesión obtuvo 200 en listado general y 403 en API Clases por defensa de rol. Se revocó el grant y la misma sesión pasó a 403 en listado general, conservando 200 en historial propio con materia. Sin materia/alumno fuera del alcance recibió 403; ficha general redirigió a sin-permiso; ruta de clase propia mostró historial acotado sin DNI. Configuración temporal eliminada también en `finally`; no se modificó negocio para probar permisos.

[Resultados HTTP](hu-e-02/resultados-http.json), capturas:

- [Mesa escritorio](hu-e-02/clases-mesa-desktop.png), [Gerente escritorio](hu-e-02/clases-gerente-desktop.png), [móvil](hu-e-02/clases-mobile.png).
- [Filtros](hu-e-02/clases-filtradas.png), [sin coincidencias](hu-e-02/clases-sin-coincidencias.png), [vacío](hu-e-02/clases-vacio.png), [error](hu-e-02/clases-error.png).
- [Profesor desde clase](hu-e-02/historial-profesor-acotado.png).

Colección Postman preparada; **no ejecutada en Postman**. Cookies, tokens y credenciales no se guardan en evidencia. Para reproducir: migraciones y seed en base aislada, build/start con sesión local, abrir ruta canónica del alumno01 con Mesa/Gerente; usar Profesor1 desde su clase del 21/09/2026 para acceso acotado.

## Brechas y límites aprobados

No se crean acciones Desactivar/Pagos ficticias: pertenecen a otras HU y no estaban integradas. Sidebar conserva enlace Alumnos del Profesor por instrucción expresa de no editarlo; servidor deniega ese acceso. No se declaran C14/C24/B07 completadas por utilizar sus estados vía servicios públicos. H03/H10 fuera del encargo. CI y enlace de PR se agregan al publicar.
