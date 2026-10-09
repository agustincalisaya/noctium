# TASK: HU-C-20 — Confirmar inscripción con un resumen de la clase

**Módulo:** C (Gestionar turnos)
**Sprint:** 3 · **SP estimado:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_C.md` Revisión 6 §2.17.1, §2.17.5; §2.14.2 (POST vigente); §2.16 (PR 0); K §2.3; L §2.10 y regla 3.12.
**RBAC:** `turnos:solicitar_propio`, existente; identidad de sesión y ficha B §2.8. Sin cambios de permisos.
**Schema:** completo por PR 0, sin migración.

## 0. Relevamiento previo a implementación

Relevamiento previo de HU-C-20 confirmado por Tomás antes de implementar.
Ajustes del 09/10/2026: título de confirmación, decisión de precio y notas de integración.

Base comprobada: rama `feature/HU-C-20-confirmar-inscripcion-resumen`, HEAD
`24ca8da96d0a1f295d94652926f5a916e173521f`; única modificación inicial:
`.gitignore`, preservada y excluida del entregable. SHA-256 de inicio:
`52BEC6CCAD8DE2820C256B82D5D5809787AB17FDE208A6831F8085BC86827EF2`.
No se realizó staging, commit, push ni merge.

Archivos nuevos autorizados:

- `docs/tasks/Sprint 3/HU-C-20.md`
- `src/server/turnos/turno.resumen-inscripcion.service.ts`
- `src/app/api/turnos/[id]/inscripcion/resumen/route.ts`
- `src/server/turnos/turno.resumen-inscripcion.service.test.ts`
- `src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts`
- `src/app/api/turnos/[id]/inscripcion/resumen/route.test.ts`
- `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx`
- `docs/testing/HU-C-20.postman_collection.json`
- `docs/testing/HU-C-20.sql`
- `docs/testing/HU-C-20-evidencia.md`

Archivos existentes autorizados:

- `src/types/turno.types.ts`: DTO del resumen.
- `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.tsx`: GET, diálogo y POST.
- `src/lib/textos.ts`: textos del módulo C.
- `src/server/aulas/aula.publico.ts`: lectura mínima del nombre, activa o inactiva.
- `docs/specs/spec_modulo_K.md`: contrato público aditivo de K.
- `docs/specs/spec_modulo_C.md`: nota de sincronización de implementación.
- `docs/DESIGN.md`: excepción específica de feedback del éxito.

Ningún archivo nuevo existía al inicio. Fuentes consultadas: Excel completo,
G16–G20 e I16, hoja de decisiones; Nota para Tomás; backlog Sprint 3;
RULES; metodología SDD; template HU y spec; specs C/L/K y fachadas B/D;
PR 0, decisiones y firmas reales de §5.2–5.5; DESIGN y mapa Sprint 2 §2
(Solicitar turno, página completa; no se encontró mapa Sprint 3 separado).
Se consultaron las guías locales de Next de Route Handlers, `route` y
Server/Client Components antes del código.

**Decisión de alcance de la HU:** Decisión aceptada por Tomás el 09/10/2026: el precio mostrado en el GET puede diferir del guardado por el POST si la tarifa cambia entre ambos; el importe queda fijo desde el alta.
Se conserva el POST vigente de C-12. Esta decisión precisa cómo se lee en
C §2.17.1 la frase «el precio que quedará congelado», sin garantizar el
importe mostrado antes del alta. Las modificaciones a las specs C y K
quedan aprobadas por Tomás el 09/10/2026.

## 1. Nota de alcance

Resumen de solo lectura previo al POST C-12. Hasta C-22 la inscripción
confirmada conserva `PAGO_SIN_REGISTRAR`, sin plazo; `plazo_pago_horas` y
`vence_pago_el` son `null`. No se muestran leyendas de plazo/cancelación.
Los dos campos de límite de cancelación del contrato se calculan en el
servidor con parámetros vigentes y offset del centro.

**Precio GET→POST:** el GET calcula tarifa × duración; no existe inscripción
de la que leer un precio guardado. El POST calcula y guarda la tarifa vigente
al confirmar. Puede diferir del GET. Solo después del alta el importe es
fijo. No se implementan bloqueo de tarifa, recotización ni rechazo por cambio.
Las pruebas acreditan esa diferencia y la estabilidad posterior del almacenado.

**Fuera de alcance:** RESERVADA y plazo (C-22), pagos, procesos/vencimiento
(C-24), cancelación (C-14), configuración (N-01), migración general C-19,
correcciones de C-25, dependencias, esquema, migraciones y permisos.

| Diferida y responsable | Condición de integración | Verificación que debe realizar su HU |
|---|---|---|
| Plazo/vencimiento de CA3 — Tomás, C-22 | Integrar estado RESERVADA, vencimiento y ampliar resumen/confirmación conforme C §2.17.2–3 | GET muestra plazo y vencimiento estimado; POST informa definitivo; comprobar límites y texto con reloj del centro; C-22 acredita su parte de CA3 |
| Reglas/leyendas de cancelación de CA3 — Tomás, C-14 | Integrar cancelación propia y la excepción de reserva sin pago, después de C-22 | Casos antes/después del límite y reserva sin pago; cambio vigente al cancelar; rechazo sin mutación |
| Valor configurable de CA3 — responsable de N-01, carril 1 (asignación personal no encontrada; coordinar con SM) | Integrar gestión N-01 sin cambiar los contratos de parámetros PR 0 | Cambiar anticipación en entorno aislado; nuevo GET refleja valor; cancelar toma valor vigente; verificar conservación del vencimiento ya guardado |

## 2. Historia de Usuario

**Como** Alumno
**Necesito** Ver un resumen de la clase a la que me voy a inscribir antes de confirmar
**Para** Verificar que elegí la materia, el día y el horario correctos y no inscribirme por error

### Criterios de aceptación literales — Excel, G16–G20

1. Al tocar “Inscribirme” en “Solicitar clase” (HU-C-12) no se inscribe directamente: se muestra un resumen con materia, profesor, día y fecha completa (por ejemplo, “Martes 13 de octubre de 2026”), horario de inicio y fin, duración, aula y lugares disponibles.
2. El resumen muestra el precio de la clase (tarifa por hora de la materia × duración, HU-L-06) y recuerda que se paga en el centro antes de que empiece (el plazo exacto de pago lo agrega HU-C-22): “El precio queda fijo desde que reservás, aunque después cambie la tarifa. Se paga en el centro.”
3. Debajo del plazo de pago (HU-C-22), el resumen muestra: “Si todavía no pagaste, podés cancelar la reserva hasta el <día, fecha y hora de vencimiento>; después de cancelarla, solo vas a poder volver a inscribirte en esta clase en el centro. Si ya pagaste, podés cancelar en línea hasta el <día, fecha y hora límite>.” El límite se calcula con la anticipación mínima vigente al inscribirse (24 horas por defecto, configurable con HU-N-01); si el centro cambia ese plazo, rige el valor vigente al cancelar (HU-C-14). Si ese límite ya pasó al momento de reservar, la última oración se reemplaza por: “Si ya pagaste, ya no vas a poder cancelar en línea; comunicate con el centro.”
4. Tiene dos acciones: “Confirmar reserva” y “Volver”, que regresa a la selección sin perder lo elegido.
5. Al confirmar se revalidan el cupo y la superposición con otras clases del alumno (mismas reglas de HU-C-12). Si algo cambió mientras miraba el resumen, se informa el motivo y no se inscribe.

**Dependencias literales — Excel I16:** Cambio obligatorio C, pedido por los profesores en la revisión del Incremento 2. Extiende HU-C-12 (Solicitar clase, Sprint 2), que hoy inscribe directamente al tocar “Inscribirme”. Va inmediatamente después de las habilitadoras HU-C-23 y HU-C-25 (reducción de alcance, 04/10/2026) porque es la puerta del modelo de inscripción/reserva: HU-C-22 extiende este resumen. Esta historia entrega el resumen con sus dos acciones; el estado “Reservada”, el plazo de pago y su leyenda los agrega HU-C-22. Se quitó el límite de cancelación guardado en la inscripción (la anticipación se evalúa con el valor vigente al cancelar, HU-N-01). El precio vuelve el 05/10/2026 con HU-L-06: las tarifas iniciales están en el seed desde el PR 0, así que no hace falta diferirlo. Verificación diferida: el plazo y el vencimiento del criterio 3 cuando esté HU-C-22, la regla del criterio 3 cuando esté HU-C-14 y el valor configurable del criterio 3 cuando esté HU-N-01.

## 3. Alcance de esta task

Backend + frontend del resumen: servicio de C, GET, DTO, catálogo, fachada
mínima K y pruebas. Se reutiliza C-12 → `crearInscripcion`; no se agregan
Server Actions, escrituras, bloqueos ni eventos al GET.

## 4. Contrato Backend

### 4.1. Schema Zod

No hay payload ni query funcional. `id` es parámetro de ruta y un id inexistente
responde 404 según spec; no se introduce schema ni contrato de error adicional.
La identidad nunca se lee de body o query.

### 4.2. Servicio

`src/server/turnos/turno.resumen-inscripcion.service.ts`:
`obtenerResumenInscripcion(turnoId, usuarioId, db?): Promise<ResumenInscripcion>`.
Resuelve ficha B; existencia, ocupación vigente C, estado confirmado,
inicio futuro, cupo, alumno activo/no asignado y tarifa L. No valida
superposición ni re-reserva. Usa `ahora()` una vez, `inicioDeTurno`,
`isoCentro`, `parametrosVigentes` y `precioClase`. Materia y profesor por L/D;
aula por K. No inicia transacción, toma locks ni escribe.

Errores: `SIN_PERMISO`, `TURNO_NO_ENCONTRADO`, `TURNO_NO_DISPONIBLE`,
`TURNO_VENCIDO`, `CUPO_INSUFICIENTE`, `ALUMNO_INACTIVO`,
`ALUMNO_YA_ASIGNADO`, `MATERIA_SIN_TARIFA`.
Fechas calendario YYYY-MM-DD, horas HH:mm, instantes con offset -03:00;
precios y duraciones permitidas enteros (60/120/180 minutos).

### 4.3. Route Handler

`src/app/api/turnos/[id]/inscripcion/resumen/route.ts`: GET,
`withPermission("turnos:solicitar_propio")`, `{ data, error }`, no-store,
status existentes y `statusDeErrorNuevo` para 422. 401 y 403 del wrapper.
El POST de confirmación conserva su ruta y contrato C-12.

### 4.4. Server Action

No aplica: contrato exclusivamente por Route Handlers.

### 4.5. Trazabilidad / Auditoría

GET no muta y no emite eventos. POST reutiliza auditoría de inscripción,
historial y eventos existentes después del commit del PR 0. No hay mecanismo nuevo.

## 5. Frontend

Mapa Sprint 2 §2: Solicitar turno, página completa propia; se extiende con
`ConfirmarAccionDialog`. Inscribirme carga GET sin POST, bloquea selección
y descarta respuestas abortadas/obsoletas. Los datos visibles vienen del DTO;
`fechaLarga` preserva fecha calendario y `formatearMonto` formatea pesos.
El título aplica el patrón C-25 con materia, día completo en minúscula y
hora de inicio del DTO; reutiliza `fechaLarga` sin agregar otro formateador.
Volver conserva materia/profesor/horario. Confirmar usa `resumen.turno_id`;
petición compartida en curso impide doble POST. Error permanece en diálogo;
éxito navega con banner C-12, excepción documentada en DESIGN §6.4, sin toast.
Texto nuevo/modificado del consumidor en catálogo `ui.turnos.*`.
Textos internos de C-25 se reutilizan conforme a su contrato; no se corrigen aquí.
Sin colores nuevos ni pantalla/ruta de UI nueva.

### Notas de integración y verificaciones pendientes

1. **Motivos legacy con «turno».** El diálogo y el banner conservan los
   mensajes de `errores.*` según DESIGN §9. «El turno alcanzó su cupo
   máximo» lo devuelven tanto el GET del resumen como el POST de la
   inscripción; en el POST, como 409 dentro del diálogo. Otros motivos
   del GET: «El horario del turno ya pasó» y «Ya estás inscripto en este
   turno». Otros motivos del POST: «Ya tenés otro turno en ese horario» y
   «El turno ya no está disponible». Su migración queda para C-19 por
   decisión de Tomás del
   09/10/2026; C-19 debe verificarlos en su criterio de «Clase». C-20 no
   migra esas claves ni cambia códigos o contratos.
2. **Solapamiento con C-19 en Solicitar.** Los renombres de textos dentro
   del componente modificado se hicieron en C-20 para cumplir C-23,
   criterios 1 y 2. Quedan fuera y pendientes para C-19 el h1 «Mis turnos»
   de `src/app/(dashboard)/alumno/page.tsx` (destino de la miga «Mis clases»)
   y los textos «Mis turnos» y «Solicitar turno» de
   `src/components/layout/Sidebar.tsx`.
3. **Guard `signal.aborted` en opciones.** Se agregó a las cargas de
   opciones como arreglo fuera del alcance de C-20; es inocuo y está
   probado por el caso que descarta opciones obsoletas al cambiar materia.
   No se introducen nuevos cambios a esas cargas en los ajustes del 09/10/2026.
4. **Verificaciones de Tomás.** La repetición de PostgreSQL fue informada
   como ejecutada el 09/10/2026; resultados y bloqueo por `noctium_test`
   preexistente en la evidencia. El 09/10/2026 se ejecutaron HTTP con
   login real, SQL manual, navegador, Escape durante el POST, GET fallido
   y viewport móvil emulado (ver evidencia); el recorrido con teclado
   físico lo verificó Tomás el mismo día. Sigue pendiente un run de GitHub.

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios y componente

Servicio: precondiciones, tarifa ausente, precio 60/120/180, vigencia real
del helper PR 0, calendario y límites. Route: contrato y traducciones con
wrapper simulado. Componente real y diálogo real en jsdom: GET sin POST,
Volver, id del DTO, bloqueo/doble envío, respuestas tardías, errores,
conservación de selección y navegación. No acredita navegador ni RBAC reales.

### Nivel 2 — API / Postman

Colección `docs/testing/HU-C-20.postman_collection.json`: GET exitoso,
401, 403, errores del dominio y POST vigente. Identidad y permisos reales
requieren login del entorno aislado; no guardar cookies/tokens en colección.
La existencia de la colección no acredita ejecución.

### Nivel 3 — PostgreSQL / SQL

`turno.resumen-inscripcion.service.pg.test.ts` usa guardas/fábricas y runner
descartable existente. Snapshot comprueba GET sin cambios en clase,
inscripciones, proyecciones, eventos e historial. GET→POST con cambios de
cupo, superposición y tarifa; confirmación interina, precio guardado estable
y carrera por último lugar. SQL acotado en `docs/testing/HU-C-20.sql`, sin resets.

**Resultados y matriz CA:** fuente única en `docs/testing/HU-C-20-evidencia.md`.
Allí se registran comandos, exit codes, aprobadas, fallidas/no ejecutadas,
límites y pasos de navegador/GitHub; no se duplican aquí.

## 7. Checklist de Definition of Done

- [x] Relevamiento confirmado antes de implementar, base contrastada.
- [x] Servicio y Route Handler implementados; Server Action no aplica por contrato.
- [x] Endpoint con `{ data, error }` y status semánticos.
- [x] GET sin mutación/eventos; POST reutiliza emisión posterior al commit.
- [x] Frontend implementado, recorrido jsdom y navegador; ver evidencia.
- [x] Ningún DELETE de dominio agregado.
- [x] Postman con login real (cliente HTTP con login de NextAuth; ver evidencia).
- [x] SQL manual de solo lectura (ver evidencia).
- [x] Viewport móvil 375×667 (emulado; ver evidencia).
- [x] Escape durante el POST.
- [x] GET fallido.
- [x] Recorrido de navegador con foco/teclado: verificado por Tomás con teclado físico el 09/10/2026 (ver evidencia).
- [ ] Pendiente: run de GitHub y PR con diff exclusivo de esta HU; publicación/merge no autorizados.
- [ ] Pendiente: CA3 integrado, diferido a C-22, C-14 y N-01, no cumplido por C-20.

**Contraste con template:** secciones 0–7 y 4.1–4.5 presentes, historia y CA
literales, testing en tres niveles y DoD. No falta sección; los ítems abiertos
son verificaciones/integración/publicación, no se consideran aprobados.
