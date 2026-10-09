# TASK: HU-E-09 — Registrar asistencia individual por clase

**Módulo:** E (Atención académica / Historial) · **Sprint:** 3 · **SP estimado:** 2  
**Responsable:** Iván (asistencia e indicadores).  
**Contrato de referencia:** `docs/tasks/Sprint 3/HU-Sprint-3.md`, HU-E-09 · `docs/specs/spec_modulo_E.md` §§2.6, 2.12.1, 2.13, 3.1–3.7, 3.11–3.14 y 4 · `docs/tasks/Sprint 3/PR-0.md` §§2.13, 2.16, 5.5 · `docs/RULES.md` · `docs/DESIGN.md`.  
**Pantallas:** `/turnos/[id]` e historial académico existente del alumno; `Noctium_Prototipo.pdf`, figuras 49–51 (páginas impresas 44–45).  
**RBAC:** `clases:registrar` para MESA_ENTRADA y PROFESOR sobre sus clases; `historial:leer` para consultar, con alcance del servidor. GERENTE no escribe. No se crean permisos ni rutas nuevas.  
**Schema:** completo en PR 0: `ClaseDictada.conControlAsistencia`, `ClaseDictadaAlumno.estadoAsistencia`, correcciones y anulación; sin migración ni cambios en `schema.prisma`.  
**Estado:** relevamiento confirmado explícitamente por el usuario el 08/10/2026 ("Si confirmo"); implementación en `feat/hu-e-09-asistencia`, issue #207. Verificación final integrada pendiente.

---

## 0. Relevamiento previo a implementación

Relevamiento de este inventario confirmado explícitamente por el usuario el 08/10/2026. Todas las decisiones de negocio siguientes están resueltas por las specs; no requieren una nueva decisión del PO.

### Archivos nuevos

| Ruta exacta | Propósito |
|---|---|
| `docs/tasks/Sprint 3/HU-E-09.md` | Esta task, decisiones y checklist. |
| `src/server/historial/clase-dictada.schema.ts` | Cuerpo HTTP opcional y estados PRESENTE/AUSENTE. |
| `src/server/historial/clase-dictada.schema.test.ts` | Validación de estructura, límites y campos desconocidos. |
| `src/app/api/turnos/[id]/clase-dictada/route.test.ts` | Compatibilidad sin cuerpo, validación y contrato HTTP. |
| `src/server/historial/clase-dictada.service.pg.test.ts` | Persistencia, atomicidad, idempotencia y concurrencia con PostgreSQL real. |
| `src/app/(dashboard)/alumnos/[id]/historial-academico.test.tsx` | Asistencia por clase, registros antiguos y porcentajes. |
| `prisma/seed/fixtures/hu-e-09.ts` | Datos demostrables estables, sembrados mediante servicios. |
| `docs/testing/HU-E-09.postman_collection.json` | Casos reproducibles del contrato HTTP. |
| `docs/testing/HU-E-09.sql` | Consultas de comprobación de persistencia y auditoría. |
| `docs/testing/HU-E-09-evidencia.md` | Resultados realmente ejecutados y limitaciones. |
| `docs/testing/hu-e-09/01-presente-por-defecto.png` | Captura Playwright del estado inicial. |
| `docs/testing/hu-e-09/02-ausente-seleccionado.png` | Captura Playwright de selección individual. |
| `docs/testing/hu-e-09/03-confirmacion.png` | Captura Playwright de confirmación con cantidades. |
| `docs/testing/hu-e-09/04-clase-registrada.png` | Captura Playwright de estados y totales guardados. |
| `docs/testing/hu-e-09/05-historial-academico.png` | Captura Playwright de historial y porcentaje. |
| `docs/testing/hu-e-09/06-detalle-movil.png` | Captura Playwright de adaptación móvil. |

### Archivos existentes a modificar

| Ruta exacta | Cambio |
|---|---|
| `src/server/historial/clase-dictada.service.ts` | Core transaccional contractual, entrada de aplicación HTTP, traducción alumno/inscripción dentro del bloqueo, validación de conjunto, escritura y lectura vigente de asistencia. |
| `src/server/historial/clase-dictada.service.test.ts` | Conservar reglas y códigos Sprint 2; adaptar mocks a la firma transaccional y agregar asistencia. |
| `src/app/api/turnos/[id]/clase-dictada/route.ts` | Lectura de cuerpo vacío/JSON, Zod, llamada delgada al servicio y errores nuevos con detalles. |
| `src/server/historial/historial.service.ts` | Sumar asistencia vigente por clase y porcentajes por materia; excluir clases anuladas. |
| `src/server/historial/historial.service.test.ts` | Preservar contratos anteriores y comprobar campos aditivos, exclusiones y porcentajes. |
| `src/types/historial.types.ts` | Tipos serializables de asistencia, registro de clase y porcentajes. |
| `src/app/(dashboard)/alumnos/[id]/historial-academico.tsx` | Mostrar Asistió/Ausente/sin control y resumen por materia. |
| `src/app/(dashboard)/turnos/[id]/turno-detalle.tsx` | Integrar carga de asistencia y registro en la lista de inscriptos. |
| `src/app/(dashboard)/turnos/[id]/turno-detalle.test.tsx` | Interacción individual/masiva, confirmación, carga, errores y lectura posterior. |
| `src/app/(dashboard)/turnos/[id]/turno-alumnos-card.tsx` | Selectores por alumno, marcas guardadas, totales y registro debajo de la lista. |
| `src/app/(dashboard)/turnos/[id]/turno-clase-card.tsx` | Adaptar registro/confirmación para colocarlo en la lista sin tarjeta separada y enviar asistencia. |
| `src/lib/textos.ts` | Centralizar los textos nuevos, reutilizando el catálogo existente. |
| `prisma/seed/fixtures/index.ts` | Registrar exclusivamente la fixture de esta HU. |
| `src/server/turnos/turno.validaciones.ts` | Completar lectura del reloj de dominio para crear fixtures históricas por servicios; comportamiento de producción idéntico. |
| `src/server/turnos/turno.validaciones.test.ts` | Regresión de reloj contextual en configuración y vigencia. |
| `docs/RULES.md` | Documentar bloqueo canónico y trazabilidad de vencimientos después del commit, según PR 0. |

### Contratos disponibles y brecha comprobada

- C expone `bloquearTurnoParaOperacion`, `inscripcionesVigentes` y `marcarVencidas`; compartidos expone `transaccion`, `bloquear` y reloj inyectable. E ya dispone de `valor-vigente.ts` y `asistenciaDeAlumno`.
- El código real aún tiene `registrarClaseDictada(turnoId, usuario, ahora)` y abre `prisma.$transaction`. PR 0 §5.5 reconoce que E-09 debe completar la adaptación a `transaccion`, bloqueo y vencimiento perezoso. Se implementará el core **`registrarClaseDictada(tx, { turnoId, actor, asistencias?: { inscripcionId, estado }[] })`** y una entrada de aplicación para HTTP en el mismo service. Esa entrada abre `transaccion`, bloquea la clase y traduce `alumno_id` a `inscripcionId` con la lectura vigente del servidor; el Route Handler no consulta inscripciones ni contiene lógica de negocio. El core es reutilizable por fixtures y H-07.
- La exigencia de registro al **fin** de la clase prevalece sobre «ya empezó» del backlog: spec E §2.6.2, Q7c y P-E1 conservan expresamente esa regla. En curso puede prepararse la selección, pero confirmar permanece deshabilitado hasta finalizar.
- Las ampliaciones del GET propias de E-07/E-11 no habilitan acciones futuras desde esta HU; esta entrega incorpora asistencia, control y totales necesarios para E-09.

**Decisión técnica comprobada:** PR 0 dejó cinco lecturas del reloj real en `turno.validaciones.ts`; las fixtures históricas necesitan que respeten `conReloj`. Se reemplazan por el reloj compartido y se prueba su vigencia/configuración. El INSERT del registro usa fecha string con `::date` para evitar conversiones por zona del servidor.

## 1. Nota de alcance

Extensión aditiva de HU-E-01 y HU-E-05, primera historia del carril asistencia/indicadores. El esquema y las lecturas públicas de PR 0 se reutilizan. No se rompe el POST sin cuerpo ni las rutas, campos y códigos anteriores.

**Fuera de alcance:** corregir/anular asistencia (E-11), observaciones (E-07), indicaciones (E-04), nueva pantalla Mi historial (E-08), historial de inscripciones (E-02), pagos/reintegros y cambios de permisos del Profesor asociados a E-02. Verificación diferida de exclusiones de C-14/B-07 cuando esas historias se integren; se prueba ahora con los estados ya soportados por PR 0.

## 2. Historia de Usuario

**Como** profesor sobre sus propias clases o personal de mesa de entrada,  
**necesito** indicar qué alumnos inscriptos asistieron y cuáles faltaron al registrar una clase dictada,  
**para** reflejar asistencia real en el historial académico.

**SP estimado:** 2. Criterios: opciones en la propia lista, todos Presente inicialmente, selección masiva; estados y totales después de registrar; persistencia en una transacción; Asistió/Ausente y porcentaje por materia; clases antiguas sin control excluidas del porcentaje; ningún cambio de pagos; corrección diferida a E-11.

## 3. Alcance de esta task

Backend y frontend: validación del cuerpo, servicio transaccional, GET/POST existentes, historial académico, controles en lista de alumnos, fixture de demostración y evidencia. No se necesita Server Action: el flujo existente consume Route Handlers.

## 4. Contrato Backend

### 4.1. Schema Zod

`RegistrarClaseDictadaSchema`: objeto estricto con `asistencias`, array de hasta 500 objetos estrictos `{ alumno_id: string.trim().min(1), estado: "PRESENTE" | "AUSENTE" }`. `[]` es válido para clase sin inscriptos. El handler lee texto: ausente/vacío conserva `undefined`; texto no vacío exige JSON válido y `safeParse`. Errores de validación responden 400, con detalles Zod cuando corresponda. Repeticiones y pertenencia se validan en el servicio.

### 4.2. Servicio

En `transaccion`, con un momento único del reloj:

1. Bloquear clase con `bloquear(tx, { clases: [turnoId] })` y leer mediante la fachada C.
2. Exigir existencia, Profesor propietario, estado DISPONIBLE/COMPLETO y fin de clase alcanzado.
3. Si ya existe clase no anulada, devolverla sin validar ni usar la selección; no corregirla.
4. Ejecutar `marcarVencidas` con ese mismo momento y leer `inscripcionesVigentes`.
5. Si vino asistencia, exigir igualdad de conjuntos: todos los vigentes exactamente una vez. Error `ASISTENCIA_INCOMPLETA` con `{ faltan, sobran, repetidos }` en términos de `alumno_id` para HTTP.
6. Insertar con SQL parametrizado `ON CONFLICT ("turnoId") WHERE "anuladaEl" IS NULL DO NOTHING`; copiar fecha/materia/profesor y alumnos. Guardar `conControlAsistencia = true` si vino cuerpo y estados pedidos; sin cuerpo, false y estados null. No capturar P2002 dentro de la transacción.
7. Devolver datos originales más `con_control_asistencia`, `presentes`, `ausentes`; cantidades null si no hay control. Si existe, leer valores vigentes.

GET conserva campos/orden y suma `alumnos[].asistencia`, `con_control_asistencia` y `totales` (null sin control). Reutilizar `valor-vigente.ts`; no duplicar algoritmos de última corrección.

Historial suma `asistencia` por clase y `asistencia_por_materia` obtenido de `asistenciaDeAlumno`: resumen completo, independiente de página/filtro. Porcentaje entero redondeado o null sin clases con control; excluir anuladas y no contar estados null. Mantener contratos de Sprint 2 y aislamiento de dominios.

### 4.3. Route Handlers

- POST: `withPermission("clases:registrar")`, 201 nuevo/200 existente; sobre `{ data, error }`.
- GET: `withPermission("historial:leer")`; Profesor solo consulta su clase.
- Conservar `SIN_PERMISO` 403; inexistencias 404; `TURNO_NO_ADMITE_CLASE` y `CLASE_NO_FINALIZADA` 409. Agregar `ASISTENCIA_INCOMPLETA` 400 y `TRANSACCION_OCUPADA` 409, preservando detalles estructurados.

### 4.4. Trazabilidad

Opción (a): fecha y usuario en la propia clase, dentro de la escritura. No eventos de asistencia. Los eventos de vencimiento que encole C se escriben después del commit mediante `transaccion`; rollback descarta esa cola. Ausente nunca modifica inscripción, precio ni pagos.

## 5. Frontend

Lista de inscriptos existente, con opciones a la derecha por alumno vigente, texto visible y estado verde/rojo mediante tokens de `docs/DESIGN.md`; no colores literales. Acción Marcar todos ausentes/presentes y Registrar clase dictada debajo de la lista. Confirmación incluye presentes/ausentes. Selección local hasta confirmar; deshabilitar durante envío y permitir reintentar sin perder selección. Releer GET al guardar para mostrar estados reales, totales y fecha. Clases antiguas muestran sin control.

Historial muestra Asistió/Ausente y porcentaje por materia, con aviso para clases sin control. Mantener accesibilidad por teclado, nombres por alumno, estados anunciados y diseño móvil. No ampliar el acceso del Gerente a la ficha: esa consulta se verifica al integrar E-02. No crear recuadro separado de asistencia ni pantalla nueva.

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios, componentes y PostgreSQL real

- Schema estricto, límite y estados; HTTP vacío, JSON malformado y body inválido; 201/200 y códigos anteriores.
- Core con estados completos, lista vacía, faltantes/sobrantes/repetidos, clase ajena, estados no permitidos y fin exacto de clase.
- Vencimientos y bajas/quitadas excluidas; orden de bloqueo/vencimiento; snapshot y auditoría; ausencia sin cambios financieros.
- PostgreSQL: rollback sin filas parciales; dos registros concurrentes con único ganador; clase anulada puede registrarse nuevamente sin editar el original. No implementar endpoint de anulación para esta prueba.
- GET y resumen usan corrección vigente ya soportada por esquema; antigua null, anulada excluida; porcentaje idéntico a lectura pública.
- UI: defaults, acción masiva/individual, confirmación, envío, error y estados finales; no debilitar pruebas Sprint 2.
- Ejecutar `npm test`, `npm run test:pg`, TypeScript, lint y build; registrar solo resultados ejecutados.

### Nivel 2 — Postman / API

Crear colección por HU con sesiones y datos documentados: alta válida, repetición, GET, body vacío, validación, conjunto incorrecto, alcance/roles y clase futura. Ejecutar los contratos desde Playwright autenticado si Postman no está disponible y registrar esa diferencia, sin afirmar una ejecución de Postman no realizada.

### Nivel 3 — SQL y Playwright

SQL comprueba clase única no anulada, snapshot completo, control/estados y auditoría; verificar que pagos no cambian. Fixture idempotente por ids estables, usando core y servicios de inscripción en secuencia temporal válida, sin editar `seed.ts`. Ejecutar seed dos veces y comprobar estabilidad.

Playwright verifica Profesor y Mesa, historial con los accesos actuales, viewport desktop/móvil, teclado y errores de consola. La consulta del Gerente a la ficha queda diferida a E-02. Guardar seis capturas del inventario y resultados en `HU-E-09-evidencia.md`; la evidencia debe incluir datos de prueba, comandos, resultados y verificaciones diferidas.

## 7. Checklist de Definition of Done

- [x] Relevamiento de sección 0 confirmado explícitamente antes de implementar.
- [x] Core contractual y entrada HTTP implementados, lógica exclusivamente en servicios.
- [x] POST sin cuerpo compatible y campos nuevos aditivos en GET/POST/historial.
- [x] Bloqueo, atomicidad, valor vigente y trazabilidad posterior al commit verificados.
- [ ] Lista integrada conforme figuras 49–51 y porcentajes visibles.
- [x] Ningún DELETE físico ni edición de registros consumados.
- [x] Fixture repetible mediante servicios y seed probado dos veces.
- [ ] Tests, PostgreSQL real, lint, TypeScript y build documentados.
- [ ] Colección API, SQL y evidencia Playwright disponibles; diferencias de herramientas explicitadas.
- [x] Verificaciones diferidas de E-08/E-11/C-14/B-07 documentadas.
- [ ] Commit y PR exclusivos de HU-E-09, sin incluir H-06/H-07.
