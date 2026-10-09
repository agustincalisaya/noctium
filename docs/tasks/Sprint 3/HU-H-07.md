# TASK: HU-H-07 — Ver inscriptos vs. presentes

**Módulo:** H (Indicadores)<br>
**Sprint:** 3 · **Responsable:** Iván · **Prioridad:** 12 · **SP:** 3<br>
**Contrato:** `docs/specs/spec_modulo_H.md` §2.6, §2.8.3, §3.12–3.17; `docs/specs/spec_modulo_E.md` §2.13, §3.6–3.7; `docs/tasks/Sprint 3/HU-Sprint-3.md` HU-H-07; `docs/tasks/Sprint 3/PR-0.md` §2.13, §2.16; `docs/RULES.md`; `docs/DESIGN.md`; `docs/adicionales/sdd-metodologia.md`.<br>
**Referencia visual:** `Noctium_Prototipo.pdf`, figura 55, página 49.<br>
**Permiso:** `indicadores:leer`, existente y exclusivo de Gerente. No se cambian permisos.<br>
**Estado:** relevamiento confirmado explícitamente por Iván el 08/10/2026 (“Si confirmo”). Implementación en curso; resultados individuales en `docs/testing/HU-H-07-evidencia.md`, integración y Playwright pendientes.

---

## 0. Relevamiento previo a implementación

Base relevada: `develop`, commit `27d543c`. El PR 0 ya incorpora las lecturas públicas `contarAsistenciasPorMes`, `contarClasesDictadasSinControl` y `listarAlumnosConPresentismoBajo` en `src/server/historial/historial.publico.ts`, junto con sus pruebas PostgreSQL reales en `src/server/historial/asistencia.pg.test.ts`. No se vuelven a implementar ni se copian al módulo H.

HU-H-06 aporta el panel, el período compartido y `src/components/indicadores/grafico-indicador.tsx`. HU-E-09 aporta la carga de asistencia mediante `registrarClaseDictada`. Ambas deben estar disponibles antes de verificar esta HU y sus fixtures.

### Archivos nuevos previstos

- `docs/tasks/Sprint 3/HU-H-07.md` — esta task, a actualizar con resultados reales.
- `src/server/indicadores/presentismo.service.ts` — composición de fachadas, sin consultar tablas ajenas.
- `src/server/indicadores/presentismo.service.test.ts` — agregación, umbral, redondeo y orden.
- `src/server/indicadores/presentismo.pg.test.ts` — bordes exactos del umbral y paginación real de once grupos; agregado durante implementación dentro del alcance aprobado de pruebas PostgreSQL.
- `src/app/api/indicadores/presentismo-por-mes/route.ts`
- `src/app/api/indicadores/presentismo-por-mes/route.test.ts`
- `src/app/api/indicadores/presentismo-por-materia/route.ts`
- `src/app/api/indicadores/presentismo-por-materia/route.test.ts`
- `src/app/api/indicadores/alumnos-presentismo-bajo/route.ts`
- `src/app/api/indicadores/alumnos-presentismo-bajo/route.test.ts`
- `src/components/indicadores/presentismo-indicadores.tsx` — pestaña de presentismo y sus estados independientes.
- `src/components/indicadores/presentismo-panel.tsx` — adaptador del punto de extensión del panel de HU-H-06, reemplaza su placeholder al integrar H07.
- `src/components/indicadores/presentismo-indicadores.test.tsx`
- `src/app/(dashboard)/alumnos/[id]/page.test.tsx` — propagar materia preseleccionada conservando los permisos existentes.
- `prisma/seed/fixtures/hu-h-07.ts` — escenarios idempotentes mediante servicios.
- `docs/testing/HU-H-07.postman_collection.json`
- `docs/testing/HU-H-07.sql` — contraste PostgreSQL de solo lectura.
- `docs/testing/HU-H-07-evidencia.md` — resultados, comandos, limitaciones y verificación visual.
- `docs/testing/hu-h-07/presentismo-desktop.png`
- `docs/testing/hu-h-07/presentismo-mobile.png`
- `docs/testing/hu-h-07/presentismo-24-meses.png`
- `docs/testing/hu-h-07/presentismo-sin-datos.png`

### Archivos existentes a modificar

- `src/types/indicadores.types.ts` — contratos de presentismo por mes, materia y tabla paginada.
- `src/server/indicadores/indicadores.schema.ts` — esquema de rango más página y constantes 10 filas / 2 clases.
- `src/server/indicadores/indicadores.schema.test.ts` — validación de página sin alterar pruebas existentes del rango.
- `src/app/(dashboard)/alumnos/[id]/page.tsx` — leer `materia_id` y pasar la preselección al historial.
- `src/app/(dashboard)/alumnos/[id]/historial-academico.tsx` — admitir la materia inicial; no cambiar acceso, roles ni permisos.
- `src/app/(dashboard)/alumnos/[id]/historial-academico.test.tsx` — ampliar el archivo creado por E-09 para probar consulta inicial filtrada por materia y uso normal sin preselección.
- `src/lib/textos.ts` — claves nuevas de presentismo, avisos, errores y vacíos conforme al archivo central de HU-C-23.
- `prisma/seed/fixtures/index.ts` — importación y registro del fixture propio en el orden correcto.
- `docs/RULES.md` — anotación de textos nuevos según el contrato vigente de textos centralizados; no modificar reglas de negocio.

No se modifican `schema.prisma`, migraciones, `prisma/seed.ts`, fachadas existentes de E ni el RBAC. La conexión al panel usa `presentismo-panel.tsx`, punto de extensión acordado con HU-H-06, evitando editar su client o copiar la implementación del panel. El componente común de gráficos se consume desde HU-H-06; su API debe admitir barras agrupadas, línea secundaria, etiquetas y alternativa de tabla conforme a la spec.

### Decisiones resueltas para la implementación propuesta

- **Origen de los inscriptos:** `presentes + ausentes` de la clase dictada en E. No usar `contarInscripcionesPorMes` de C ni contar alumnos distintos.
- **Umbral:** el contrato real de `parametrosVigentes()` devuelve `umbralPresentismo`. Se usa esa propiedad; `umbral_presentismo` de la spec describe el parámetro de negocio. Respuesta de la API: `umbral`, como en §2.6.3.
- **Ubicación de servicios:** funciones nuevas en `presentismo.service.ts`, como prescribe §2.6; se conserva intacto el servicio de ingresos/ocupación. La frase general de §3 que ubica toda lógica en `indicadores.service.ts` se interpreta conforme a los archivos explícitos de §2.6.
- **Composición visual:** dos tarjetas lado a lado en escritorio según figura 55; apiladas en móvil. Con más de 12 meses el gráfico mensual ocupa el ancho completo, conforme a §2.4.4.
- **Enlace:** `/alumnos/[id]?tab=historial&materia_id=...`, con materia preseleccionada. El soporte de query es mínimo y no otorga acceso adicional al Gerente; el acceso efectivo y su verificación siguen diferidos a HU-E-02.
- **Aviso:** siempre visible, incluso con cero clases sin control; solo cuenta clases, no filas de alumnos.
- **Fixtures:** deben registrar asistencia mediante el servicio de HU-E-09 y ejecutarse después de sus datos base. No se insertan asistencias directamente para preparar la demostración.

El relevamiento y estas decisiones se incluyen para confirmación antes de escribir código, según `docs/adicionales/sdd-metodologia.md`.

## 1. Alcance y dependencias

Como Gerente necesito comparar inscripciones y presencias por mes y por materia, para detectar inasistencia y alumnos que necesitan seguimiento. Se implementan los cinco criterios de aceptación, incluida la tabla de presentismo bajo; el recorte de esa tabla solo corresponde a una decisión explícita del PO.

Dependencias funcionales: HU-E-09 y HU-H-06. Las fachadas de E, B y L y `parametrosVigentes()` ya están en PR 0. HU-C-23 gobierna los textos nuevos. Sin filtros globales por materia, profesor o aula; sin exportación, escrituras ni indicadores de Cancelaciones.

Verificaciones diferidas: anulación mediante HU-E-11; acceso del Gerente al historial académico mediante HU-E-02; configuración del umbral mediante HU-N-01. Las lecturas ya excluyen registros anulados y usan correcciones vigentes; se prueba esa lógica con PostgreSQL sin declarar terminadas las pantallas de otras HU.

## 2. Contrato backend

Tres endpoints `GET`, todos con `withPermission("indicadores:leer")`, Zod previo al servicio y respuesta `{ data, error }`:

1. `/api/indicadores/presentismo-por-mes?desde=AAAA-MM&hasta=AAAA-MM`: lista completa de meses inclusivos, resumen ponderado y cantidad de clases sin control. Cada mes contiene `mes`, `inscriptos`, `presentes`, `ausentes`, `indice`.
2. `/api/indicadores/presentismo-por-materia?desde=AAAA-MM&hasta=AAAA-MM`: materias con al menos un inscripto; nombres/códigos/estado en lote desde L; resumen y clases sin control. Orden por índice ascendente, ausencias descendentes, nombre e id.
3. `/api/indicadores/alumnos-presentismo-bajo?desde=AAAA-MM&hasta=AAAA-MM&pagina=1`: umbral vigente, mínimo dos clases, página de diez filas y total correcto incluso para páginas fuera de rango. Nombres desde B y L, en lote; alumno como «Apellido, Nombre».

Rango por defecto: seis meses incluido el actual del centro, máximo 24. Mes calendario de `fechaClaseDictada`. Solo clases no anuladas con asistencia individual; las de control ausente se excluyen del indicador y se informan aparte. Un alumno en cuatro clases cuenta cuatro inscriptos.

`indice = presentes / inscriptos × 100`, redondeado a un decimal. Sin inscriptos: cantidades cero e índice `null`. El resumen calcula su índice sobre la suma, nunca promediando porcentajes. El filtro de presentismo bajo compara enteros antes de redondear: `presentes × 100 < umbral × clases`; exactamente 75 % queda afuera cuando el umbral es 75. Orden de la tabla: porcentaje ascendente, ausentes descendentes, alumno y materia.

Errores contractuales: `400 VALIDATION_ERROR`, `401 SESION_INVALIDA`, `403 SIN_PERMISO`. No se crean códigos nuevos ni transacciones propias de escritura.

## 3. Frontend y prototipo

- Pestaña «Índice de Presentismo» del panel `/gerente`, período compartido de HU-H-06.
- Tarjeta mensual: barras Inscriptos / Presentes y línea Índice de presentismo sobre eje secundario 0–100 %; ausentes sobre cada par; `null` no dibuja punto ni valor. Resumen: presentes de inscriptos e índice del período.
- Tarjeta por materia: barras horizontales agrupadas, índice y ausentes junto al nombre, primero las materias con mayor inasistencia; marca de materia inactiva si corresponde.
- Componente común de HU-H-06 con tokens `--chart-*`, valores legibles, tooltip y «Ver como tabla» con exactamente los mismos datos.
- Aviso de clases dictadas sin control siempre visible.
- Tabla «Alumnos con presentismo bajo»: alumno, materia, clases dictadas, ausencias, porcentaje y enlace al historial; umbral vigente en encabezado; diez filas por página y reset de página al cambiar el período.
- Vacíos por gráfico: «No hay datos para el período seleccionado». Tabla vacía: «No hay alumnos con presentismo bajo en el período.».
- Carga, errores y reintento independientes por consulta; un fallo no oculta los demás indicadores. Sin textos técnicos ni identificadores de HU en la interfaz.

## 4. Testing y evidencia pendiente

### Nivel 1 — Unitarias, contratos y UI

Agregar casos de agregación y resumen ponderado; meses vacíos con índice `null`; inscripciones repetidas; orden y desempates; materias inactivas; umbral exacto, mínimo dos clases, paginación y total fuera de rango. Verificar que cambiar el parámetro vigente cambia la tabla sin modificar código.

Cada ruta verifica Gerente 200, otros roles 403, sin sesión 401, rango inválido/invertido/mayor a 24 meses 400, seis meses por defecto y página inválida 400 donde corresponde. Conservar las pruebas de Sprint 2 y HU-H-06.

La UI verifica persistencia del período, igualdad gráfico/tabla, carga/error/reintento por consulta y enlace con materia. Las pruebas de ficha e historial verifican preselección inicial sin habilitar permisos nuevos y el comportamiento anterior cuando falta la query.

### Nivel 2 — Postman / HTTP

Colección individual de los tres endpoints, con variables sin secretos incrustados. Guardar respuestas reales de roles, bordes de rango y página, y documentar cualquier caso diferido. No declarar ejecutada una colección por haberla generado.

### Nivel 3 — PostgreSQL

Ejecutar la suite real existente `src/server/historial/asistencia.pg.test.ts` y ampliar cobertura únicamente si falta un borde contractual; cualquier ampliación de esa suite se reportará antes de editar por no estar en la lista inicial. Contrastar cantidades, correcciones vigentes, clases sin control/anuladas, umbral y total con `docs/testing/HU-H-07.sql`, de solo lectura. No usar exclusivamente mocks para afirmar cumplimiento de fachadas.

### Fixtures y revisión visual con Playwright

Fixture idempotente con varios meses/materias, índices distintos, alumno justo en 75 %, alumnos por debajo, grupos de una sola clase excluidos, al menos once grupos de seguimiento y registros sin control. Usar servicios y claves estables; repetir seed para comprobar ausencia de duplicados.

Revisión Playwright sobre datos reales de la aplicación: escritorio, móvil, período vacío y 24 meses; cambio de pestaña manteniendo rango, «Ver como tabla», paginación y enlace con materia. Guardar capturas en `docs/testing/hu-h-07/` y resultados en la evidencia. Registrar honestamente el acceso al historial como diferido cuando HU-E-02 no esté integrada.

Ejecutar pruebas pertinentes, PostgreSQL real, lint, TypeScript/build y `git diff --check`; registrar comandos y resultados, nunca anticiparlos.

## 5. Entrega en PR individual

HU-E-09 y HU-H-06 se publican en PR propios directamente contra `develop`, sin mezclarlas. El PR de HU-H-07 también apunta directamente a `develop` y contiene únicamente su commit. Si las dos dependencias todavía no están mergeadas, se publica como draft dependiente y su descripción identifica ambos PR: la integración y las pruebas se realizan en una rama local que reúne las dependencias y H07. Esa rama local no se publica como PR ni se usa como base remota. Cuando las dependencias se integren, se actualiza la rama H07 desde `develop`, se repiten los controles pertinentes y se verifica que el diff siga conteniendo exclusivamente esta historia. Estrategia acordada en `docs/adicionales/plan-sprint-3-ivan.md`.

El PR documenta fixtures, evidencia realmente ejecutada y verificaciones diferidas; no declara terminado HU-E-02, HU-E-11 ni HU-N-01.

## 6. Definition of Done

- [x] Relevamiento y lista exacta de archivos confirmados explícitamente antes de implementar.
- [x] Dependencias HU-E-09 y HU-H-06 disponibles para implementación y demostración.
- [x] Tres endpoints, esquemas, permisos y composición de fachadas conforme a la spec.
- [x] Gráficos, aviso, tabla y preselección de materia implementados sin cambios de RBAC.
- [x] Textos centralizados y documentados conforme a las reglas del proyecto.
- [x] Fixture propio idempotente mediante servicios y registrado en el índice.
- [x] Unitarias/UI, HTTP y PostgreSQL real ejecutados y documentados.
- [x] Lint, TypeScript/build y comprobación de diff aprobados.
- [x] Playwright y capturas contrastadas con figura 55, incluido móvil y 24 meses.
- [x] Evidencia distingue lo verificado de E02, E11 y N01 diferidos.
- [x] PR propio de HU-H-07 con diff exclusivo y base/dependencias explícitas.

## Cierre de verificación

Evidencia efectiva en `docs/testing/HU-H-07-evidencia.md`; validación completa realizada en integración local con las tres ramas. Dependencias y accesos diferidos conservados.

PR individual: https://github.com/agustincalisaya/noctium/pull/219. Base `develop`. Borrador, dependiente de #217 y #218.
