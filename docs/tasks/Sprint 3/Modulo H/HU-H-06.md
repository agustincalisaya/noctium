# TASK: HU-H-06 — Panel de indicadores con pestañas y filtro de período

**Módulo:** H (Indicadores / Dashboard)
**Sprint:** 3 · **Responsable:** Iván · **SP:** 2
**Contrato de referencia:** `docs/specs/spec_modulo_H.md` §2.4, §3.9 y §3.17 · `docs/tasks/Sprint 3/HU-Sprint-3.md` HU-H-06 · `docs/tasks/Sprint 3/PR-0.md` §1.1, §2.13 y §2.16 · `docs/RULES.md` reglas 3–6, 10 y 11 · `docs/DESIGN.md`.
**Prototipo:** `Noctium_Prototipo.pdf`, páginas 46–48, figuras 52–54; inspección visual realizada durante el relevamiento.
**RBAC:** `indicadores:leer`, existente, exclusivo de GERENTE.
**Schema:** completo en PR 0, sin migraciones.
**Estado:** relevamiento confirmado por Iván el 08/10/2026 («Si confirmo»); implementada y verificada en pruebas dirigidas; evidencia final de app/Playwright pendiente, issue #164.

## 0. Relevamiento previo a implementación

Se conserva la ubicación `/gerente` y el permiso verificado por su página. El código existente tiene dos gráficos Recharts, rango compartido, carga conjunta con `Promise.all`, error y vacío globales y tablas visualmente ocultas. Esta HU adapta esa pantalla; las respuestas existentes de ingresos y ocupación no cambian.

La fachada `promediarOcupacionTurnosPorMes` de C ya devuelve `{ mes, promedio, turnos }[]`, consulta inscripciones vigentes y filtra clases Disponibles/Completas hasta hoy, con cupo positivo. Alcanza para el endpoint nuevo; H no consulta tablas C directamente.

### Archivos nuevos a crear

- `docs/tasks/Sprint 3/HU-H-06.md`: esta task.
- `src/components/indicadores/presentismo-panel.tsx`: extensión vacía que H07 completa en su PR independiente sin copiar el cliente H06.
- `src/components/indicadores/grafico-indicador.tsx`: componente común contractual.
- `src/components/indicadores/grafico-indicador.test.tsx`: tabla, etiquetas, estados y series.
- `src/components/indicadores/filtro-periodo.tsx`: selector y ajuste del rango.
- `src/components/indicadores/filtro-periodo.test.tsx`: límites, ajuste y aviso.
- `src/components/indicadores/use-indicador.ts`: carga independiente, cancelación y reintento.
- `src/app/api/indicadores/ocupacion-resumen/route.ts`: GET autorizado y validado.
- `src/app/api/indicadores/ocupacion-resumen/route.test.ts`: respuesta, query y permisos.
- `prisma/seed/fixtures/hu-h-06.ts`: datos repetibles de presentación.
- `docs/testing/HU-H-06.postman_collection.json`: contrato HTTP reproducible.
- `docs/testing/HU-H-06.sql`: comprobación de datos y promedio con PostgreSQL.
- `docs/testing/HU-H-06-evidencia.md`: comandos, resultados reales y capturas.
- `docs/testing/hu-h-06/actividad-desktop.png`: evidencia Playwright de 6 meses.
- `docs/testing/hu-h-06/periodo-13-meses.png`: gráficos mensuales a ancho completo.
- `docs/testing/hu-h-06/periodo-24-meses-mobile.png`: scroll y últimos meses.
- `docs/testing/hu-h-06/tabla.png`: mismos datos en modo tabla.
- `docs/testing/hu-h-06/error-independiente.png`: una tarjeta fallida con otra visible.

### Archivos existentes a modificar

- `src/app/(dashboard)/gerente/indicadores-client.tsx`: pestañas, período común y cargas independientes; punto de contenido para H07.
- `src/app/(dashboard)/gerente/indicadores-client.test.tsx`: adaptar expectativas anteriores y verificar comportamiento contractual.
- `src/components/indicadores/graficos-indicadores.tsx`: wrappers de ingresos y ocupación sobre el componente común.
- `src/server/indicadores/indicadores.service.ts`: agregar `obtenerResumenOcupacion`, conservando funciones existentes.
- `src/server/indicadores/indicadores.service.test.ts`: promedio por clase del período y regresión existente.
- `src/types/indicadores.types.ts`: agregar tipo del resumen de ocupación sin alterar tipos previos.
- `src/lib/textos.ts`: textos visibles nuevos/modificados del panel, sin la palabra «turno».
- `prisma/seed/fixtures/index.ts`: importar y registrar únicamente el fixture propio.
- `docs/RULES.md`: aclaración aditiva mínima sobre consumo de lecturas públicas y fixtures de presentación idempotentes mediante servicios de dominio; conservar las reglas existentes.

- `src/server/turnos/turno.validaciones.ts`: sincronizar los defaults de reloj con `ahora()` del PR 0 para construir históricos mediante servicios.
- `src/server/turnos/turno.validaciones.test.ts`: regresión de reloj por contexto sin mutar Date global.

### Decisiones contractuales

- Los validadores C usaban el reloj de pared aunque PR 0 exige reloj por contexto. La corrección mínima autorizada conserva parámetros explícitos y comportamiento productivo; comparte exactamente el mismo cambio con E09 para permitir fixtures independientes.
- La prosa histórica de H dice que no existía su código; el relevamiento usa la implementación actual de develop.
- La ocupación sigue como línea con meta 80 % según la spec, aunque el prototipo dibuje barras.
- El encabezado de ocupación usa el promedio simple por clase de todo el período, ponderando los promedios mensuales por cantidad de clases; nunca promedia meses ni suma porcentajes.
- Ocupación de 0 % con clases reales es dato válido: el vacío depende de `turnos === 0` del resumen.
- Los gráficos aún pendientes de H03/H07/H10 no se muestran hasta su implementación. Las tres pestañas existen y conservan el período.
- Los helpers existentes de rango y redondeo conservan su archivo y contrato. Si se necesita reutilización se exportan de su archivo actual.
- Iván confirmó el relevamiento el 08/10/2026. La evidencia de ejecución se completa únicamente con resultados reales.

## 1. Nota de alcance

HU-H-06 entrega la infraestructura visual común y adapta H01/H02. H07 se valida en una rama local de integración con E09 y H06; se publica únicamente su commit propio en un PR separado hacia develop, en borrador hasta integrar ambas dependencias. H06 no necesita E09 ni modifica sus archivos.

**Fuera de alcance:** implementar H03/H07/H10, corregir/anular pagos (I06), filtros globales por materia/profesor/aula, nuevas rutas de pantalla, permisos, migraciones, exportaciones o escrituras desde el panel.

## 2. Historia de Usuario

**Como** gerente, **necesito** un panel de indicadores con pestañas y un filtro de período que se aplique a todos los gráficos, **para** analizar la actividad del centro desde distintos ángulos sin cambiar de pantalla.

**Criterios de aceptación:** los siete criterios de HU-H-06 en el backlog, concretados en H §2.4: tres pestañas, período común, actualización sin recarga, carga/error/vacío independientes, componente común accesible, acceso exclusivo y disposición adaptable con totales y scroll.

## 3. Alcance de esta task

Frontend y un endpoint de lectura nuevo. Reutilizar `RangoIndicadoresQuerySchema`, los servicios públicos existentes y shadcn/Recharts. Sin Server Actions, eventos ni cambios de dominio: el panel es de solo lectura.

## 4. Contrato Backend

### 4.1. Schema Zod

Reutilizar `src/server/indicadores/indicadores.schema.ts`, sin cambios: `desde`/`hasta` opcionales en `AAAA-MM`, seis meses incluyendo el actual por defecto y máximo 24. Conservar mensajes y `400 VALIDATION_ERROR`.

### 4.2. Servicio

`obtenerResumenOcupacion(query: RangoIndicadoresInput): Promise<{ ocupacion_promedio: number; turnos: number }>` en el service existente. Resolver rango y fecha de hoy en Buenos Aires como ocupación mensual; consumir `promediarOcupacionTurnosPorMes(desde, hasta, fechaMaxima)`.

Calcular `Σ(promedio × turnos) / Σ(turnos)`, convertir a porcentaje con el redondeo existente a un decimal. Sin clases: `{ ocupacion_promedio: 0, turnos: 0 }`. No consultar tablas ajenas ni abrir transacciones de escritura.

### 4.3. Route Handler

`GET /api/indicadores/ocupacion-resumen?desde=AAAA-MM&hasta=AAAA-MM`, `withPermission("indicadores:leer")`, validación previa al servicio. Éxito 200: `{ data: { ocupacion_promedio: 68.4, turnos: 52 }, error: null }`. Errores: 400 VALIDATION_ERROR, 401 SESION_INVALIDA y 403 SIN_PERMISO. Mantener las rutas y respuestas anteriores.

### 4.4. Server Action

No aplica: lecturas mediante Route Handlers.

### 4.5. Trazabilidad / Auditoría

No aplica a consultas. Los fixtures usan servicios de dominio que conservan su trazabilidad normal; no hay mutaciones del panel.

## 5. Frontend

- `/gerente`: Actividad inicial, Índice de Presentismo y Cancelaciones; período fijo arriba y conservado al cambiar pestaña.
- Selectores desde 23 meses atrás hasta 3 adelante. Si se invierten extremos o se superan 24 meses, ajustar el extremo opuesto y avisar «El período máximo es de 24 meses.».
- Cada tarjeta carga y reintenta de forma independiente. Al cambiar período abortar pedidos anteriores y descartar respuestas tardías. Cargar solo datos de pestañas abiertas y refrescar por cambio de período.
- Mantener ingresos en barras y ocupación en línea con meta 80 %. Totales en encabezado: suma monetaria de ingresos; resumen API para ocupación. Leyendas contractuales de H §2.4.5.
- `GraficoIndicador` recibe título, total formateado, leyenda de fecha, datos, series `{ clave, etiqueta, unidad, tipo: "barra" | "linea", color }`, orientación, formateador, texto vacío, estado y callback `onReintentar`. Admitir metadatos pequeños opcionales de eje/etiqueta, diferencia sobre grupos y línea de referencia para H07/ocupación; no construir un motor genérico ni acoplar el componente al fetch.
- Usar `ComposedChart` para barras y línea, tokens `--chart-*`, etiquetas de valor visibles y tooltip exacto. `Ver como tabla` con `aria-pressed`; tabla siempre renderizada, oculta visualmente cuando corresponde.
- Más de 12 meses: tarjetas mensuales a ancho completo, año solo en enero/primer mes, valores compactos, sin etiqueta en meses sin datos. Con ancho insuficiente, scroll dentro de tarjeta, iniciar en meses recientes y mostrar el aviso de H §2.4.4. Grilla de dos columnas desktop y una móvil.
- Todos los textos visibles nuevos/modificados se centralizan. Evitar textos de implementación y códigos de HU en el producto.

### Fixtures de presentación

Fixture propio en el punto de extensión de PR 0. Usar claves/IDs estables y comprobar existencia antes de crear: ejecutar dos veces no añade ni cambia datos. Crear clases, inscripciones y pagos mediante servicios de dominio, nunca mediante inserts directos en esas tablas. No modificar `prisma/seed.ts` ni fixtures ajenos.

Distribuir datos históricos en 24 meses, con meses vacíos, importes altos para formato compacto y cantidades de clases mensuales diferentes para probar el promedio del período. Documentar fechas, IDs y servicios utilizados, respetando el reloj del entorno y las cajas requeridas por pagos. No fabricar evidencia ni omitir validaciones del servicio para sembrar datos.

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios e interfaz

- Resumen: mes con una clase al 100 % y otro con nueve al 0 % da 10 %, no 50 %; redondeo y ausencia de clases.
- Regresión de respuestas/rangos de ingresos y ocupación existentes.
- Pestañas y rango conservado, 27 opciones, ajuste de extremos/máximo, respuesta tardía descartada y abortado.
- Un gráfico vacío o fallido no oculta otro; reintento solo de su tarjeta.
- Tabla y gráfico con valores/unidades iguales; etiquetas y series barra/línea; vacío distinto de ocupación real cero.

### Nivel 2 — Postman / API

Colección reproducible contra PostgreSQL real: GET resumen exitoso, consultas de ingresos/ocupación sin cambiar su contrato, rango inválido, sesión ausente y sesión de otro rol. Guardar status y cuerpo reales, sin depender solo de mocks de permisos. Sesiones suministradas por variables, sin guardar credenciales o cookies en evidencia.

### Nivel 3 — BD / TablePlus y Playwright

SQL read-only para comprobar clases elegibles, cantidades por mes y ocupación ponderada del período con los mismos filtros de vigencia, estado, cupo y fecha máxima; cotejar con API. Verificar idempotencia del fixture antes/después del segundo seed. No alterar persistencia para producir evidencia.

Playwright/Chromium contra la app real: 6, 13 y 24 meses, desktop/móvil, pestañas, tabla, hover/touch, labels, scroll inicial a últimos meses, vacío y error independiente. Inspeccionar capturas y consola; documentar cualquier fallo. Validar TypeScript, ESLint, suite de tests y pruebas PG pertinentes; preservar regresión Sprints 1/2.

**Evidencia esperada:** colección Postman, SQL, reporte de comandos/resultados y capturas en las rutas inventariadas. Completar con resultados reales después de ejecutar.

## 7. Checklist de Definition of Done

- [x] Relevamiento confirmado explícitamente antes de implementar.
- [x] Servicio y Route Handler nuevos implementados; contratos H01/H02 conservados.
- [x] RBAC 401/403 y validaciones 400 verificados contra la app real.
- [x] Tres pestañas y período común; carga/error/vacío/reintento independientes (tests dirigidos).
- [x] Componente común compatible con barras agrupadas y línea para H07 (test y TypeScript).
- [x] Valores visibles, tablas accesibles, totales y leyendas correctos.
- [x] Playwright desktop/móvil, 6/13/24 meses y capturas inspeccionadas.
- [x] Textos centralizados y diseño con tokens; sin borrado físico ni migraciones.
- [x] Fixtures por servicios e idempotencia demostrada en PostgreSQL aislado.
- [x] Tests de tres niveles y regresión con evidencia real.
- [x] PR propio acotado a HU-H-06, sin contenido de E09/H07.

## Cierre de verificación

Evidencia efectiva en `docs/testing/HU-H-06-evidencia.md`; validación completa realizada en integración local con las tres ramas. Dependencias y accesos diferidos conservados.

PR individual: https://github.com/agustincalisaya/noctium/pull/218. Base `develop`. Sin merge automático.
