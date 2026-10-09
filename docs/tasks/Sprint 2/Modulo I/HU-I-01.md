# TASK: HU-I-01 — Registrar pago

**Módulo:** I (Pagos) · **Sprint:** 2 · **SP:** 3
**Contrato:** `docs/specs/spec_modulo_I.md` §§2.3–2.5, 3.3–3.6, 4; `docs/specs/spec_modulo_C.md` §§2.4, 2.15; `docs/RULES.md`.
**RBAC:** `pagos:crear` (Mesa de Entrada), `pagos:leer` (Mesa de Entrada y Gerente), `formas_pago:leer`. Ya sembrados; no se modifican.
**Schema:** `Pago` y relaciones ya migrados en `20260928150100_sprint2_modelo`. Sin migración nueva ni modificación del seed.

## 0. Relevamiento previo a implementación

Pedido del usuario del 01/10/2026: preparar `/plan`, iniciar `/goal`, implementar HU-I-01 según SDD y verificar con Playwright contra las pantallas del PDF. Este pedido autoriza la implementación secuencial del plan; se registra el relevamiento antes de tocar código.

### Archivos nuevos

- `src/server/pagos/pago.schema.ts`: payload estricto y query de opciones.
- `src/server/pagos/pago.service.ts`: registro transaccional y opciones del modal.
- `src/server/pagos/pago.consulta.ts`: lectura de pagos y nombres de alumnos en lote.
- `src/server/pagos/pago.publico.ts`: fachada pública sin dependencias directas de Turnos.
- `src/app/api/pagos/route.ts`: POST protegido y traducción de errores.
- `src/app/api/pagos/opciones/route.ts`: GET protegido.
- `src/app/api/formas-pago/opciones/route.ts`: catálogo de activas protegido.
- `src/app/(dashboard)/turnos/[id]/registrar-pago-dialog.tsx`: modal y combobox accesible.
- `src/server/pagos/pago.schema.test.ts`, `src/server/pagos/pago.service.test.ts`: validaciones y reglas.
- `src/server/pagos/pago.service.pg.test.ts`: persistencia Decimal, pagos concurrentes, conservación histórica y carrera con cancelación en PostgreSQL aislado.
- `src/app/api/pagos/route.test.ts`: contrato HTTP.
- `docs/testing/HU-I-01.postman_collection.json`: colección del contrato.
- `docs/testing/HU-I-01.sql`: consultas de persistencia y auditoría, sin mutaciones.
- `docs/testing/HU-I-01-evidencia.md`: resultados reproducibles y evidencia visual.

### Archivos existentes a modificar

- `src/types/pago.types.ts`: DTO de pago/opciones.
- `src/app/(dashboard)/turnos/turno.types.ts`: pagos opcionales y prioridad en detalle.
- `src/server/turnos/turno.service.ts`: prioridad y consumo del servicio público de Pagos al consultar un detalle autorizado.
- `src/app/api/turnos/[id]/route.ts`: comprobar `pagos:leer` antes de incluir pagos.
- `src/app/(dashboard)/turnos/[id]/page.tsx`: permisos granulares para el modal.
- `src/app/(dashboard)/turnos/[id]/turno-detalle.tsx`: composición del PDF, tarjeta Pago y refresco tras registrar; conservar gestión de inscripciones/configuración.
- `docs/specs/spec_modulo_I.md`: nota aditiva de sincronización (schema/seed ya existentes, fachada de consultas).
- `src/server/publico.aislamiento.test.ts`: incluir la nueva fachada entre los contratos verificados.
- `src/app/(dashboard)/turnos/turnos-listado.test.tsx`: actualizar las expectativas de presentación del detalle (nombre/apellido, unidad de cupo y etiqueta Creado), conservando las pruebas de navegación y configuración.

### Decisiones resueltas

- Referencia visual: PDF `Noctium pantallas Sprint 2-1.pdf`, páginas 5 y 7. Sidebar, navbar y footer del proyecto se conservan, conforme al pedido de conservar el sidebar y el alcance de la HU.
- Las acciones Cancelar, Reprogramar, Prioridad y Registrar clase dictada corresponden a otras HUs: no se agregan mutaciones ni controles de éxito ficticios para esas historias. Se conserva lo ya funcional y se prepara la composición compartida.
- `fechaCalendarioValidaSchema` devuelve un `Date` a medianoche UTC; la comparación con hoy argentino reside en el servicio, después de las demás precondiciones.
- El monto viaja como string decimal; la coma se normaliza en la UI y la suma visual usa centavos enteros.
- Sincronización detectada en prueba real: las formas del catálogo inicial usan los cuatro ids `formapago-*` de la migración, preservados por el seed. Se admiten CUID y esos cuatro ids exactos en el schema; no se cambia la identidad de entidades existentes. Documentado aditivamente en spec I.
- El listado de pagos se delega a `pago.consulta.ts`: la fachada pública reexporta una función del propio módulo, sin importar el público de Turnos ni introducir ciclos. La consulta usa `obtenerAlumnosBasicos()` de B en lote.
- Pruebas en PostgreSQL aislado; no resetear ni resembrar una base habitual o compartida.

### Integración sobre develop antes de publicar (01/10/2026)

El usuario autorizó subir a GitHub y ejecutar los tests necesarios. `origin/develop` avanzó a `c5e8294` durante el trabajo y ya integra HU-C-09, C-05, C-06, C-10 y E-01. La rama nueva `feature/hu-i-01-registrar-pago` incorpora solo HU-I-01 sobre esa base; se conserva intacta la rama anterior de indicadores.

Relevamiento adicional: se conservan las implementaciones vigentes de `turno.service.ts`, `turno.detalle.ts`, la ruta GET del detalle, `pago.publico.ts`, los tipos de Turnos movidos a `src/types/turno.types.ts` y los controles de las otras HU. No se restaura el archivo de tipos de la ruta ni se duplica la consulta pública de pagos en `pago.consulta.ts`. Las nuevas capas de registro/opciones se integran con esos contratos ya implementados.

Cambios frontend finales: `page.tsx` verifica `pagos:crear`; `turno-detalle.tsx` conecta el modal y recarga; `turno-pago-card.tsx` recibe la acción y suma el total del PDF en centavos enteros exactos; `turno-datos-card.tsx` mantiene dos columnas en móvil y tres en desktop, con el autor abarcando dos en móvil. `turno-alumnos-card.tsx` conserva buscador, Quitar e historial en filas continuas; Datos/Alumnos/Pago recuperan la tipografía y espaciado compactos del PDF. `turno-detalle.test.tsx` verifica total exacto, elegibilidad, proporción 2:1 y conservación de lectura al cancelar. Se mantienen los demás componentes del detalle y el sidebar vigente de develop.

Se repiten suite general, pruebas reales de PostgreSQL, lint, tipos, build y Playwright sobre esta integración; la evidencia final identifica esa base y versión de Next.js. `Total registrado` se conserva por el pedido explícito de fidelidad al PDF y se documenta aditivamente en spec I; no introduce saldo ni monto esperado.

## 1. Nota de alcance

Implementación integral de HU-I-01, reutilizando los servicios públicos ya implementados de C, B e I-03. La task no bloquea por las restantes acciones del detalle. No se crea `actions.ts`: el frontend utiliza Route Handlers, según spec I §1.

**Fuera de alcance:** historial por alumno, estado de cuenta, correcciones/anulaciones, precios por materia, pasarelas, comprobantes, catálogo de gestión I-03 y mutaciones C-05/C-06/C-10/E-01.

## 2. Historia de Usuario

**Como** Personal de mesa de entrada,
**necesito** registrar el pago de un turno, indicando qué alumno paga, cuánto, con qué forma de pago y cuándo,
**para** dejar constancia de que el turno fue abonado y por quién.

1. Abrir desde el detalle; buscar entre inscriptos y preseleccionar únicamente si hay uno.
2. Monto positivo, máximo dos decimales, sin validar precios.
3. Múltiples pagos independientes, incluidos parciales y distintos alumnos.
4. Toast `Pago registrado correctamente` y pago persistente visible con alumno, fecha, monto y forma.
5. Sin historial de pagos ni estado de cuenta en este sprint.

## 3. Plan de implementación

1. Documentar relevamiento y sincronización del contrato.
2. Implementar schema, servicios, fachada y rutas.
3. Integrar permisos y pagos en el detalle; construir modal conforme al PDF.
4. Ejecutar unitarios, contrato HTTP y consultas SQL sobre una base aislada.
5. Verificar en Playwright: registro real, recarga, parciales, preferencias, búsqueda por nombre/DNI, errores, permisos y responsive. Inspeccionar capturas contra PDF.
6. Documentar evidencia y completar Definition of Done.

## 4. Contrato Backend

- `POST /api/pagos`, `pagos:crear`: `RegistrarPagoSchema.safeParse()` antes de llamar al servicio. DTO y códigos según I §2.4; éxito 201, Zod 400 con `flatten()`, fecha futura 400 sin `flatten()`, precondiciones 404/409.
- Una transacción: bloquear turno `FOR SHARE` vía C; validar DISPONIBLE/COMPLETO, inscripción (incluido alumno inactivo), forma activa, fecha <= hoy argentino; insertar sin modificar pagos existentes. Turno vencido permitido.
- `GET /api/pagos/opciones?turno_id=`, `pagos:crear`: I §2.5, preferida inactiva -> null, preselección omitida salvo único inscripto.
- `GET /api/formas-pago/opciones`, `formas_pago:leer`: array de activas.
- `listarPagosDeTurno(turnoId, db?)`: I §2.3, más recientes primero, fechas ISO y montos como strings; nombres vía B en lote.
- Trazabilidad Regla 2(a): `createdAtPago` y `creadoPorUsuarioId` insertados con el pago; sin tabla de eventos ni eventos secundarios.
- `GET /api/turnos/[id]` incluye `pagos` únicamente con `pagos:leer`; el Profesor no recibe datos monetarios.

## 5. Frontend

Pantalla: Detalle de turno `/turnos/[id]`, mapa Sprint 2 §§1, 2 y 4; `Dialog` con toast según `docs/DESIGN.md` §6. Referencia PDF páginas 5/7: título materia/estado, datos e inscriptos a izquierda, tarjeta Pago a derecha; modal centrado de 390 px, título/contexto, alumno con resultados en flujo, monto, forma, fecha y botones Cancelar/Registrar pago. Tokens existentes, sin colores nuevos.

Buscador local acotado a inscriptos, nombre sin acentos/mayúsculas y DNI parcial numérico. Combobox con teclado, foco y selección explícita; editar texto invalida selección anterior. Proponer preferida activa al elegir alumno, permitiendo cambiarla. Hoy calculado en zona argentina. Cerrar con X/Escape/fuera/Cancelar; proteger envío mientras se procesa. Errores inline conservan datos y permiten reintentar; carga, sin inscriptos y sin formas activas explícitos. Tras éxito cerrar, toast y recargar detalle desde servidor. Vista móvil sin desbordes y modal con scroll.

## 6. Testing

### Nivel 1 — Unitarios

Schema: vacíos, cero/negativos, máximo decimal, campos extra, fechas reales. Servicios: estados admitidos/rechazados, turno inexistente, alumno no inscripto/inactivo, forma inexistente/inactiva, fecha futura y borde horario argentino; opciones y nombres históricos; parciales independientes, autor y bloqueo transaccional. HTTP: payload/status/sobre y permisos declarados.

### Nivel 2 — Postman / API real

Colección en `docs/testing/HU-I-01.postman_collection.json`, cookies de sesión y variables para fixtures. Ejecutar el contrato real también desde Playwright con sesión del navegador: 201, 400, 401, 403, 404 y 409; comprobar detalle del Gerente/Profesor. Registrar qué herramienta efectivamente se ejecutó, sin afirmar ejecución en Postman si solo se utilizó API de Playwright.

### Nivel 3 — BD

Consultar `docs/testing/HU-I-01.sql` sobre la base aislada: exactitud Decimal, alumno/turno/forma, fecha y auditoría; rechazo sin nuevas filas y pagos preservados al quitar inscripción. Nunca UPDATE/DELETE de un pago de negocio.

### Playwright y visual

Capturas desktop/móvil de detalle y modal; registro desde UI y persistencia al recargar; búsqueda, preferencia editable, único inscripto, estados vacíos y errores. Integración con forma de pago creada desde UI de I-03 y datos reales, además del seed.

## 7. Definition of Done

- [x] Relevamiento registrado antes de implementar y autorización secuencial del usuario documentada.
- [x] Contratos y servicios implementados con aislamiento, RBAC y trazabilidad.
- [x] Modal y lista ajustados al PDF; sidebar conservado.
- [x] Pruebas unitarias y de API pasadas.
- [x] Persistencia y auditoría verificadas en PostgreSQL aislado.
- [x] Playwright funcional y visual pasado en desktop/móvil.
- [x] Lint, tipos y build correctos.
- [x] Evidencia completa y diff limitado a HU-I-01.
