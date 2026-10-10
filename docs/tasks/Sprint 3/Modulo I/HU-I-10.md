# TASK: HU-I-10 — Registrar pago buscando al alumno

**Módulo:** I (Pagos)
**Sprint:** 3
**Contrato de referencia:** `docs/specs/spec_modulo_I.md` §2.7 (líneas 495-682: 2.7.1 Buscar alumno, 2.7.2 Clases pendientes, 2.7.3 Registrar la operación, 2.7.4 Comportamiento, 2.7.5 Respuesta, 2.7.6 Errores, 2.7.7 Pruebas) · también §2.6 (modelo, valores vigentes y permisos) y §2.8 (atajo del detalle de la clase, no se toca en esta task) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-I-10, backlog completo desde la línea 100) · `docs/tasks/Sprint 3/Modulo C/HU-C-25.md` (`ConfirmarAccionDialog`, se reutiliza tal cual) · `docs/RULES.md` (Reglas N.° 1, 3, 4, 5, 6, 7, 8, 10, 11 — ver el detalle de cada una en la sección 0)
**RBAC:** `pagos:crear` (ya existe, MESA_ENTRADA) — sin permisos nuevos. El Gerente no tiene este permiso (HU-I-10 criterio 9); el servidor ya rechaza con `403 SIN_PERMISO` vía `withPermission`.
**Schema:** ya completo, sin migración. `OperacionPago`, `Pago` extendido, `Comprobante` y `Caja` ya están migrados y el servicio de dominio (`registrarOperacion`) ya está implementado por el PR 0 — ver sección 0.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre lo siguiente. Esta sección ya viene con una auditoría hecha contra el código real de `develop` (no contra la spec en abstracto), para que el relevamiento parta de hechos verificados, no de suposiciones.

**Reglas no negociables de `docs/RULES.md` que esta task debe cumplir** (leer el archivo completo antes de implementar, no solo estos números sueltos):
- **Regla N.° 1** (prohibido el `DELETE` físico) — no aplica ninguna baja en esta HU, pero ningún código nuevo debe introducir una.
- **Regla N.° 3** (aislamiento de dominio entre módulos) — por eso la extensión de `inscripcion.lecturas.ts` en 0.3/0.4.2 se hace en la fachada pública de Módulo C, nunca con un acceso directo de `pago.service.ts` a sus tablas.
- **Regla N.° 4** (la capa de servicios es la única dueña de la lógica de negocio) — por eso los Route Handlers de 4.3 son delgados, y `registrarOperacion` ya concentra toda la regla de negocio (sección 0.1): esta task no reimplementa nada de eso en el Route Handler ni en el componente de frontend.
- **Regla N.° 5** (contrato de respuesta estándar `{ data, error }`) — los tres endpoints nuevos lo siguen.
- **Regla N.° 6** (validación Zod previa a la capa de servicios) — los tres schemas de 4.1 corren en el Route Handler antes de llamar al servicio, nunca dentro de él.
- **Regla N.° 7** (concurrencia: condición y mutación en una única sentencia atómica) — ya resuelta por el bloqueo canónico de `registrarOperacion` (alumno → clases → inscripciones → caja); esta task no reimplementa ni duplica ese bloqueo.
- **Regla N.° 8** (inmutabilidad de un registro de hecho consumado) — un `Pago` no se edita ni se borra; ver DoD.
- **Regla N.° 10** (RBAC granular por acción) — `pagos:crear`, ya existente.
- **Regla N.° 11** (estructura de carpetas por módulo) — ya respetada en las rutas de 0.2/0.3 (`src/server/pagos/*`, `src/app/api/pagos/**`).

### 0.1. Ya existe en `develop` (verificado, no hay que crearlo de nuevo)

- `registrarOperacion()` en `src/server/pagos/operacion.service.ts` — **ya implementa el comportamiento completo de la sección 2.7.4** (bloqueo canónico, revalidación por ítem en el orden exacto de la spec, modo `"completo"` vs `"compatSprint2"`, emisión de comprobante). Esta task **no** reimplementa esta lógica: solo le arma el pedido desde el body ya validado.
- Todos los `code` de error de 2.7.6 ya están dados de alta en `src/server/shared/errores-dominio.ts` (`TURNO_YA_EMPEZO`, `RESERVA_VENCIDA`, `INSCRIPCION_YA_PAGADA`, `MOTIVO_AJUSTE_REQUERIDO`, `CAJA_NO_ABIERTA`, `TRANSACCION_OCUPADA`, `MATERIA_SIN_TARIFA`, `ALUMNO_NO_DISPONIBLE`, `ALUMNO_INACTIVO`, `ALUMNO_NO_ENCONTRADO`, etc.) con sus textos en `src/lib/textos.ts`. **No hace falta agregar ningún código de error nuevo.**
- `ConfirmarAccionDialog` (`src/components/shared/confirmar-accion-dialog.tsx`) y `fetchOLanzar` (`src/lib/fetch-autenticado.ts`) de HU-C-25 ya están implementados y con tests. El `formatearMonto` de `src/lib/moneda.ts` también. *Resuelto así:* el wizard reutiliza `ConfirmarAccionDialog` tal cual, pero **no** usa `fetchOLanzar` (solo propaga `message` y pierde `code`/`detalles`): su `onConfirmar` llama a `fetchAutenticado` directo para leer `detalles.precio_vigente`. `fetchOLanzar` no se modificó.
- `cajaAbiertaDe`, `verificarFormaPagoActiva`, `existeFormaPago`, `obtenerClasesBasicas`, `exigeInscripcionConPago`, `crearInscripcion`, `marcarVencidas`/`marcarVencidasDelAlumno` — todo lo que `registrarOperacion` necesita por dentro ya existe.
- El patrón de Route Handler sobre `ErrorDeDominio` ya tiene precedente claro y copiable: `src/app/api/turnos/[id]/cancelacion/route.ts` (usa `statusDeErrorNuevo(error) ?? <fallback case-by-case>`). *Resuelto así:* ese patrón no expone `detalles` y `statusDeErrorNuevo` devuelve `null` para los códigos de Sprint 1/2; los tres endpoints usan un helper propio, `src/app/api/pagos/respuesta-error.ts` (`ErrorDeDominio` → `error.status` + `detalles: error.datos`; `ServiceError` común → fallback por código).

### 0.2. Archivos nuevos a crear (ruta exacta)

- `src/app/api/pagos/buscar-alumnos/route.ts` — `GET`, Paso 1 (2.7.1).
- `src/app/api/pagos/pendientes/route.ts` — `GET`, Paso 2 (2.7.2).
- `src/app/api/pagos/operaciones/route.ts` — `POST`, Paso 3 (2.7.3-2.7.6).
- `src/app/(dashboard)/pagos/registrar/page.tsx` — pantalla «Registrar pago» (Server Component, lee `searchParams` para `?alumno=&clase=`).
- `src/app/(dashboard)/pagos/registrar/registrar-pago-wizard.tsx` — Client Component que orquesta los 3 pasos y el estado del wizard (propuesta de nombre; ver 0.4, segundo punto a relevar).
- `src/app/(dashboard)/pagos/registrar/paso-buscar-alumno.tsx`, `paso-clases-alumno.tsx`, `paso-confirmacion.tsx` — un componente por paso (propuesta; Claude Code puede proponer una división distinta siempre que quede un componente por paso y el wizard quede testeable paso a paso).
- Los `*.test.ts(x)` correspondientes a cada archivo de arriba (servicio, schema, cada route, el wizard).

*Resuelto así (archivos nuevos efectivos):* los de arriba con esos mismos nombres, más `src/app/api/pagos/respuesta-error.ts` (sobre de error compartido, ver 0.1), y en `src/app/(dashboard)/pagos/registrar/`: `progreso-registrar-pago.tsx` (stepper de 3 pasos; el de turnos tiene fijos 5 pasos y no se generalizó para no tocar C), `estado-pago-badge.tsx` (0.4.4) y `seleccion-clases.ts` (cuentas puras del Paso 2). Tests: `buscar-alumnos/`, `pendientes/` y `operaciones/route.test.ts`, `registrar-pago-wizard.test.tsx`, `seleccion-clases.test.ts` y `src/server/pagos/pago.operacion.pg.test.ts` (servicios de punta a punta con PostgreSQL real). Evidencia de los niveles 1 y 2: `docs/testing/HU-I-10-evidencia.md`.

### 0.3. Archivos existentes a modificar (ruta exacta + qué cambia)

- `src/server/pagos/pago.schema.ts` — agrega `BuscarAlumnosCobroQuerySchema`, `PendientesQuerySchema` y `RegistrarOperacionSchema`; extrae `montoSchema`, `formaPagoIdSchema` y `motivoSchema` como constantes compartidas (la spec 2.7.3 lo pide explícitamente, sin cambiar el comportamiento de `RegistrarPagoSchema` de HU-I-01, que las sigue usando inline o importándolas).
- `src/server/pagos/pago.service.ts` — agrega `buscarAlumnosParaCobro()`, `listarClasesPendientesDePago()` y `registrarOperacionDePago()`. No toca `registrarPago()` ni `obtenerOpcionesPago()` (HU-I-01, sin cambios, P-I1).
- `src/server/turnos/inscripcion.lecturas.ts` — extiende `listarInscripcionesDeAlumno` (o agrega una función hermana en el mismo archivo) con el filtro de estado de pago que exige 2.7.2 (vigente, clase `DISPONIBLE`/`COMPLETO`, clase sin empezar, sin pago no anulado). DEC-23 asigna este cambio a HU-I-10 explícitamente, aunque el archivo es la fachada pública de Módulo C — **relevar antes de asumir la forma exacta, ver 0.4**.
- `src/server/shared/rutas-por-rol.ts` — agrega la entrada `pagos: ["MESA_ENTRADA"]` a `RUTAS_POR_ROL` (hoy no existe ninguna entrada para `/pagos`, así que cualquier rol autenticado pasa sin restricción de ruta; el 403 real ya lo da `withPermission` en cada endpoint, pero R3-PR0-5 pide la entrada en este mapa también).
- `src/lib/textos.ts` — agrega las claves nuevas de confirmación y de interfaz (ver 4.4 y 5).
- `docs/DESIGN.md` §6.4 — agrega la fila de HU-I-10 a la tabla (ver 0.4, tercer punto a relevar; la propia sección 6.4 del documento exige esto "antes de escribir el task").

*Resuelto así (modificaciones adicionales, confirmadas en el relevamiento):* `src/server/turnos/inscripcion.publico.ts` (exporta la función hermana de 0.4.2); `src/types/pago.types.ts` (tipos de 2.7.2 y 2.7.5); `src/components/layout/Sidebar.tsx` (ítem «Registrar pago» → `/pagos/registrar` para MESA_ENTRADA; sin él la pantalla solo se alcanzaba por URL); `src/app/(dashboard)/turnos/buscador-alumnos.tsx` (props opcionales `endpoint` y `textoSinResultados`, con los valores de Turnos por defecto: cambio aditivo en un archivo de C); `docs/DESIGN.md` también suma una aclaración en §6.3 y la §6.6 (0.4.3 y 0.4.4); `src/server/turnos/inscripcion.lecturas.pg.test.ts` (prueba de la función hermana); `src/lib/claves-textos.test.ts` (límite de tiempo de 30 s a 60 s: las claves nuevas lo dejaban al borde).

**No se toca en esta task** (explícito, ver sección 1): `src/app/(dashboard)/turnos/[id]/turno-detalle.tsx` y `registrar-pago-dialog.tsx` (el atajo de HU-I-01/criterio 9) — queda igual hasta que se integre con HU-C-24.

### 0.4. Relevar antes de asumir

1. **Dependencia externa bloqueante — Módulo B.** `spec_modulo_B.md` (P-B8) publica `buscarAlumnosActivos(query, { porPalabras?: boolean })`, y `spec_modulo_I.md` (nota del 08/10/2026 en 2.7.1) da por hecho que `buscarAlumnosParaCobro` ya puede llamarla con `{ porPalabras: true }`. **Verificado contra el código: `alumno.service.ts` todavía expone `buscarAlumnosActivos(query: string)` sin ese segundo parámetro.** No está implementado, solo especificado. Esta task no puede completar el Paso 1 con el criterio de búsqueda correcto (HU-B-05: varias palabras en cualquier orden) hasta que Módulo B lo entregue. Antes de empezar: confirmar con quien tenga B en su carril este sprint si ya está en curso, y si hay que esperarlo o si esta task implementa el `{ porPalabras: true }` ella misma sobre `alumno.service.ts` (fuera del carril de Cali, a confirmar con el equipo antes de tocar código de otro módulo).
   **Resuelto — no bloquea.** Desde el commit `a246b94` (HU-B-05), `buscarAlumnosActivos(query)` ya usa `construirFiltroBusquedaAlumno` por dentro (varias palabras en cualquier orden; `alumno.busqueda.test.ts` lo cubre con «perez ana» / «ana perez»). B tomó la opción (a) de su §2.7 y el segundo parámetro no existe: `buscarAlumnosParaCobro(q)` la llama tal cual. P-B8 de `spec_modulo_B.md` y la nota del 08/10 de `spec_modulo_I.md` §2.7.1 quedaron desactualizadas (se avisa a quien tenga B; no se corrigen en esta task).
2. **Forma exacta de la extensión a `listarInscripcionesDeAlumno`.** DEC-23 decide *que* HU-I-10 agrega el filtro de estado de pago a la fachada de C, pero no fija *cómo*: ¿un parámetro opcional nuevo en la firma existente (`filtros: { desde?, hasta?, pendientesDePago?: boolean }`), o una función hermana (`listarClasesPendientesDePagoDeAlumno`) que no toca la firma que ya consumen E y H? La segunda opción es más segura (no arriesga tests existentes de HU-E-02/HU-C-13 que ya llaman a la función sin ese filtro), pero agranda la superficie pública de C. Relevar con el equipo antes de tocar este archivo.
   **Resuelto — función hermana** `listarInscripcionesPendientesDePagoDeAlumno(alumnoId, db?)` en `inscripcion.lecturas.ts`, exportada por `inscripcion.publico.ts`; la firma de `listarInscripcionesDeAlumno` no cambió. Motivos: su único consumidor en `develop` era su propio pg test, y 2.7.2 necesita una forma de retorno distinta (`vence_el`, `profesor: { id, nombre_completo }`). El filtro «sin pago no anulado» es `estadoPago ≠ PAGADA` (2.7.2), así que se resuelve dentro de C sin leer `Pago` (Regla N.° 3).
3. **Fila nueva en `docs/DESIGN.md` §6.4 — propuesta a confirmar.** La tabla no tiene fila para HU-I-10. Según el patrón ya usado (Paso_3 del prototipo muestra un banner "Pago registrado correctamente (1 clase)" en la parte superior de una pantalla de página completa, no un toast; y Revalidación_al_confirmar.png confirma que el paso 3 usa el `AlertDialog` de C-25 antes de guardar) la fila propuesta es: `Registrar pago (operación) (HU-I-10) | AlertDialog de C-25 (paso 3) | Banner inline (6.2, página completa)`. Esta task agrega esa fila a DESIGN.md como parte de la implementación (así lo exige la propia sección 6.4: "si una HU nueva no está en esta tabla, se define... y se agrega acá antes de escribir el task"); confirmar que esta lectura del patrón es correcta antes de implementar.
   **Resuelto:** fila agregada como `Registrar pago buscando al alumno (HU-I-10) | Página completa + AlertDialog de C-25 (paso 3) | Banner inline (6.2)`, más una aclaración en §6.3 (que decía categóricamente «se informa con toast»): en un flujo de página completa el `AlertDialog` de C-25 se resuelve con el banner de 6.2.
4. **Etiquetas de `estado_pago`.** DESIGN.md §6.5 define el aspecto de las etiquetas de **estado de la clase** (Disponible/Completo/Pendiente/Cancelado), pero no existe una convención para las etiquetas de **estado de pago de la inscripción** (`RESERVADA` con vencimiento, `PAGO_SIN_REGISTRAR`, `SE_INSCRIBE_AL_PAGAR`) que se ven en el Paso 2 del prototipo ("Reservada · pagar antes del...", "Pago sin registrar"). Esta task propone, con los tokens ya existentes y sin inventar colores nuevos: `RESERVADA` → `Badge` con fondo `--warning` (vence pronto) igual que "Pendiente" de 6.5; `PAGO_SIN_REGISTRAR` → `Badge` con variante `outline`/`--muted-foreground` (neutro, no es un estado que alerte); `SE_INSCRIBE_AL_PAGAR` → `Badge` con fondo `--sidebar-primary`/acento, para distinguirla como "no es una reserva existente". Confirmar antes de implementar (no está decidido en ningún documento, se relevaría igual sin esta propuesta).
   **Resuelto con las variantes que ya tiene `Badge`:** `RESERVADA` → `warning`, `PAGO_SIN_REGISTRAR` → `outline`, `SE_INSCRIBE_AL_PAGAR` → `accent` (`--brand-accent` con texto `--foreground`), **no** `--sidebar-primary` (los tokens `--sidebar-*` quedan para el sidebar). Documentado como DESIGN.md §6.6. El origen del precio se muestra como «Fijado al inscribirse» (`INSCRIPCION`) o «Tarifa vigente» (`TARIFA_VIGENTE`), sin un tercer estado.
5. **Nombre de archivos del wizard de frontend (0.2).** Es una propuesta de organización en 4 componentes; Claude Code puede proponer dividir distinto (por ejemplo, un solo Client Component con los 3 pasos adentro) siempre que cada paso sea testeable por separado (6, Nivel 1) y el patrón de combobox de 8.2 quede aislado y reutilizable.
   **Resuelto:** los 4 componentes propuestos, más el stepper y `seleccion-clases.ts` (ver 0.2). El combobox reutiliza `BuscadorAlumnos` de Turnos (HU-C-04) con `endpoint="/api/pagos/buscar-alumnos"` y el texto «No se encontraron alumnos para «…»» de DESIGN.md §8.2; el placeholder queda el de Turnos («mínimo 2 caracteres»).

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. *(OK recibido; las resoluciones quedaron anotadas en cada punto.)*

---

## 1. Nota de alcance

El registro de pago **ya no se hace solo desde el detalle de la clase** (HU-I-01, Sprint 2): esta HU agrega el punto de entrada por alumno, con una pantalla de página completa de 3 pasos. El endpoint de Sprint 2 (`POST /api/pagos`) **no se toca ni se retira**: sigue existiendo con su comportamiento de siempre (modo `compatSprint2`, permanente, P-I1). Esta task agrega endpoints **nuevos** (`/api/pagos/buscar-alumnos`, `/api/pagos/pendientes`, `/api/pagos/operaciones`) y una pantalla **nueva** (`/pagos/registrar`); no modifica el modal `RegistrarPagoDialog` existente del detalle de la clase.

Esta task depende de:
- **HU-I-01** (reglas base del pago, ya mergeada) y del modelo `OperacionPago`/`Pago`/`Comprobante`/`Caja` del PR 0 (ya mergeado en `develop`, ver 0.1).
- **HU-B-05** (criterio de búsqueda por palabras) — ~~bloqueante para el Paso 1~~ **resuelto**: ya está en `develop` dentro de `buscarAlumnosActivos(query)`, ver 0.4.1.
- ~~**Módulo B** para `buscarAlumnosActivos({ porPalabras: true })`~~ — no hace falta: ese parámetro no existe y no se necesita (0.4.1).

Esta task es dependencia, a su vez, de HU-C-24, HU-I-11, HU-I-02, HU-I-06 e HU-I-05, que se integran junto con HU-C-22 (circuito de pago completo, camino crítico del sprint). No se espera a que esas HU estén para mergear esta — al revés: estas task las desbloquea.

**Fuera de alcance de esta task (explícito):**
- **El atajo del detalle de la clase (criterio 9).** La pantalla `/pagos/registrar` **sí** debe aceptar y honrar `?alumno=<id>&clase=<id>` en la URL (2.7, "acepta alumno y clase preelegidos") porque es parte del contrato de esta misma pantalla — pero **cablear el botón real** dentro de la lista de inscriptos del detalle de la clase (`HU-C-24, criterio 4`) no es de esta task. El propio backlog lo marca como verificación diferida hasta que exista HU-C-24, y ambas HU se entregan como una sola unidad de integración junto con HU-C-22. `registrar-pago-dialog.tsx` (el modal viejo de HU-I-01) sigue como está.
- **El reparto de una operación entre varias formas de pago** (criterio 5, explícitamente fuera de la historia: si el alumno paga una parte en efectivo y otra por transferencia, son dos operaciones).
- **El comprobante en sí** (ver el documento, HU-I-11): esta task solo **recibe** `{ id, numero }` de `registrarOperacion` y ofrece el link "Ver comprobante"; no construye la vista del comprobante. **Resuelto:** como todavía no existe la vista de HU-I-11, el link «Ver comprobante» se **omitió** del banner (no se dejó deshabilitado); la respuesta del POST ya trae `comprobante: { id, numero }` para cuando exista.
- **El historial de pagos del alumno** (enlaces "Ver pagos del alumno" del Paso 3, mock `Paso_3_-_Pago_registrado.png`): es HU-I-02. Esta task puede dejar el link deshabilitado o directamente omitirlo hasta que exista esa ruta — ~~relevar con el equipo cuál de las dos~~ (la screenshot lo muestra activo, pero HU-I-02 todavía no tiene pantalla). **Resuelto: se omitió** (no se deshabilitó con tooltip) hasta que exista HU-I-02.
- **La corrección del precio cuando "la tarifa cambió entre que se abrió el flujo y se confirmó"** (`400 MOTIVO_AJUSTE_REQUERIDO` con `detalles.precio_vigente`, DEC-28): el servidor ya lo resuelve (sección 0.1); esta task solo necesita que el frontend, al recibir ese error, recargue el precio del ítem y muestre "La tarifa de `<Materia>` cambió. Revisá el importe." (texto literal del criterio, HU-C-23).
- **Agregar `{ porPalabras: true }` a `alumno.service.ts`** si el equipo decide que es responsabilidad de quien tenga Módulo B este sprint (ver 0.4.1) — si el equipo decide lo contrario, se saca este punto de "fuera de alcance" y se suma a la sección 3. **Resuelto: no aplica** — la búsqueda por palabras ya está en `buscarAlumnosActivos(query)` y `alumno.service.ts` no se tocó (0.4.1).

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** registrar un pago empezando por el alumno — buscarlo, ver sus clases y elegir cuáles paga
**Para** cobrar varias clases de un alumno en una sola operación, que es como se paga en el mostrador

**SP estimado:** 3 (bajó de 5 a 3 el 04/10, volvió a subir a 5 el 05/10 al reincorporar el importe precargado y el cambio de importe con motivo, y la reestimación del equipo del 06/10 la dejó de nuevo en 3 — ver backlog completo en `HU-Sprint-3.md`, línea 100).

---

## 3. Alcance de esta task

Implementación **frontend + backend**, conforme a `spec_modulo_I.md` §2.7 completa. Incluye:

- Capa de servicios: `buscarAlumnosParaCobro()`, `listarClasesPendientesDePago()`, `registrarOperacionDePago()` en `src/server/pagos/pago.service.ts`.
- Schemas Zod: `BuscarAlumnosCobroQuerySchema`, `PendientesQuerySchema`, `RegistrarOperacionSchema` (+ las constantes compartidas `montoSchema`/`formaPagoIdSchema`/`motivoSchema`) en `src/server/pagos/pago.schema.ts`.
- Route Handlers: `GET /api/pagos/buscar-alumnos`, `GET /api/pagos/pendientes`, `POST /api/pagos/operaciones`.
- La extensión de Módulo C (`inscripcion.lecturas.ts`) que pide DEC-23 (ver 0.4.2).
- Entrada nueva en `rutas-por-rol.ts` para `/pagos`.
- UI: pantalla `/pagos/registrar` con el wizard de 3 pasos (Alumno → Clases → Confirmación), reutilizando `ConfirmarAccionDialog` (C-25) para el paso 3 y el patrón de combobox de `DESIGN.md` §8.2 para el buscador del paso 1.
- Textos nuevos en `src/lib/textos.ts` (ver 4.4) y la fila nueva en `DESIGN.md` §6.4.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo listado en la sección 1, más:
- Cualquier cambio a `POST /api/pagos` (HU-I-01) o a `registrar-pago-dialog.tsx`.
- Cualquier código de error nuevo en `errores-dominio.ts` (ya están todos, sección 0.1).
- La emisión del comprobante en sí (`emitirComprobante`, HU-I-11) — ya la hace `registrarOperacion` por dentro; esta task no la toca.

---

## 4. Contrato Backend

### 4.1. Schemas Zod

**Archivo:** `src/server/pagos/pago.schema.ts`

```typescript
// Constantes compartidas (spec_modulo_I.md §2.7.3): se extraen de RegistrarPagoSchema
// sin cambiar su comportamiento. RegistrarPagoSchema (HU-I-01) pasa a importarlas.
export const montoSchema = z.string().trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "El monto debe ser un número positivo con hasta 2 decimales")
  .refine((v) => Number(v) > 0, "El monto debe ser mayor a cero");

export const formaPagoIdSchema = z.union([
  z.string().cuid(),
  z.enum(["formapago-efectivo", "formapago-transferencia", "formapago-debito", "formapago-mercado-pago"]),
]);

export const motivoSchema = z.string().trim()
  .min(1, "Ingresá el motivo")
  .max(300, "El motivo no puede superar los 300 caracteres");

// Paso 1 (2.7.1)
export const BuscarAlumnosCobroQuerySchema = z.object({
  q: z.string().trim().min(2, "Escribí al menos 2 caracteres"),
}).strict();

// Paso 2 (2.7.2)
export const PendientesQuerySchema = z.object({
  alumno_id: z.string().cuid(),
  turno_id: z.string().trim().min(1).optional(),
}).strict();

// Paso 3 (2.7.3)
export const RegistrarOperacionSchema = z.object({
  alumno_id: z.string().cuid({ error: "Elegí el alumno que paga" }),
  items: z.array(
    z.object({
      inscripcion_id: z.string().cuid().optional(),
      turno_id: z.string().trim().min(1).optional(),
      monto: montoSchema,
      motivo_ajuste: motivoSchema.optional(),
    }).strict().refine((i) => (i.inscripcion_id === undefined) !== (i.turno_id === undefined),
      "Cada clase lleva inscripcion_id o turno_id, no los dos"),
  ).min(1, "Elegí al menos una clase").max(50)
    .refine((items) => new Set(items.map((i) => i.inscripcion_id ?? `T:${i.turno_id}`)).size === items.length,
      "No repitas una clase en la misma operación"),
  forma_pago_id: formaPagoIdSchema,
  fecha_pago: fechaCalendarioValidaSchema.optional(),
}).strict();
export type RegistrarOperacionInput = z.infer<typeof RegistrarOperacionSchema>;
```

Ver el `.strict()` y los mensajes exactos en `spec_modulo_I.md` líneas 578-603; no reinventar redacción de mensajes de validación.

### 4.2. Servicios

**Archivo:** `src/server/pagos/pago.service.ts`

```typescript
/** Paso 1 (2.7.1): delega en B. buscarAlumnosActivos ya aplica el criterio
 *  por palabras de HU-B-05 por dentro (construirFiltroBusquedaAlumno), sin
 *  segundo parámetro (ver 0.4.1). */
export async function buscarAlumnosParaCobro(q: string) {
  return buscarAlumnosActivos(q);
}

/** Paso 2 (2.7.2): usa la extensión de C (0.4.2) + exigeInscripcionConPago para
 *  el caso "Se inscribe al confirmar el pago" cuando viene turno_id y el alumno
 *  no tiene inscripción vigente en esa clase. Arma formas_pago y
 *  forma_pago_preferida_id igual que obtenerOpcionesPago. */
export async function listarClasesPendientesDePago(alumnoId: string, turnoId?: string) { /* ... */ }

/** Paso 3 (2.7.3-2.7.4): arma el DatosOperacion y delega TODO en
 *  registrarOperacion(tx, { ...; modo: "completo" }). No reimplementa
 *  ninguna validación de negocio: esas ya están en operacion.service.ts
 *  (Regla N.° 4 — la capa de servicios de operacion.service.ts ya es la
 *  única dueña de esa lógica; pago.service.ts no la duplica). Solo verifica
 *  antes que el alumno exista (404 ALUMNO_NO_ENCONTRADO de 2.7.6, que
 *  registrarOperacion no distingue). */
export async function registrarOperacionDePago(input: RegistrarOperacionInput, usuarioId: string) {
  return transaccion(async (tx) => {
    const [alumno] = await obtenerAlumnosBasicos([input.alumno_id], tx);
    if (!alumno) throw new ErrorDeDominio("errores.alumno.noEncontrado");
    const items = input.items.map((i) => (
      i.inscripcion_id
        ? { inscripcionId: i.inscripcion_id, monto: i.monto, motivoAjuste: i.motivo_ajuste }
        : { crearInscripcion: { turnoId: i.turno_id! }, monto: i.monto, motivoAjuste: i.motivo_ajuste }
    ));
    const { operacion, pagos, comprobante } = await registrarOperacion(tx, {
      alumnoId: input.alumno_id, items, formaPagoId: input.forma_pago_id,
      fechaPago: input.fecha_pago, usuarioId, modo: "completo",
    });
    // armar la respuesta 2.7.5: operacion_id, alumno, forma_pago, fecha_pago,
    // total (suma de pagos.monto), pagos[] con materia/fecha/hora_inicio
    // (obtenerClasesBasicas), comprobante.
  });
}
```

Mismo patrón que `registrarPago()` (HU-I-01, ya en el archivo): abrir `transaccion()`, delegar en `registrarOperacion`, armar la respuesta con una lectura liviana después. **No** duplicar el bloqueo ni la revalidación por ítem (Regla N.° 7, concurrencia atómica): eso ya lo hace `registrarOperacion`.

### 4.3. Route Handlers

**Archivos:** `src/app/api/pagos/buscar-alumnos/route.ts`, `.../pendientes/route.ts`, `.../operaciones/route.ts`
**Permiso:** `withPermission("pagos:crear", ...)` en los tres (Regla N.° 10).

Patrón de error a copiar literalmente de `src/app/api/turnos/[id]/cancelacion/route.ts` (ya en `develop`): capturar `ServiceError`, usar `statusDeErrorNuevo(error)` para los códigos nuevos del PR 0 y el `status` fijo correspondiente para los códigos de Sprint 2 que `statusDeErrorNuevo` devuelve `null` (por ejemplo `TURNO_NO_ENCONTRADO` → 404, `ALUMNO_NO_INSCRIPTO` → 409 — ver la tabla completa en 2.7.6). Para `POST /api/pagos/operaciones`, el error expone también `detalles` (de `error.datos`) cuando lo trae, tal como lo arma `ErrorDeDominio` (campo `datos`, expuesto como `detalles`). Validación Zod (Regla N.° 6) siempre antes de llamar al servicio, nunca dentro de él; respuesta siempre `{ data, error }` (Regla N.° 5).

*Resuelto así:* no se copió el patrón de `cancelacion/route.ts`. Los tres endpoints usan `respuestaDeError()` de `src/app/api/pagos/respuesta-error.ts`: un `ErrorDeDominio` responde con el HTTP de su catálogo (`error.status`, que ya es el de 2.7.6 también para los códigos de Sprint 2) y expone `error.datos` como `detalles` en **los tres** endpoints; un `ServiceError` común usa un fallback por código. La validación Zod responde `400 VALIDACION` con `detalles: error.flatten()`.

### 4.4. Textos nuevos en `src/lib/textos.ts`

Contrato de HU-C-23 (`DESIGN.md` §9): claves `ui.pagos.<grupo>.<nombre>`, no texto suelto en componentes. Como mínimo:

- `confirmaciones.pagos.registrarOperacion`: `"¿Estás seguro de que querés registrar el pago de {total} a nombre de {alumno}?"` (criterio 6, literal — y es el texto que faltaba del catálogo que HU-C-25 dejó pendiente para "esta historia: pagos, caja", sección 3 de HU-C-25).
- ~~`ui.pagos.buscador.placeholder`~~: no se agregó. El buscador reutiliza `BuscadorAlumnos` de Turnos con su placeholder actual («Nombre, apellido o DNI (mínimo 2 caracteres)»), por decisión del relevamiento.
- `ui.pagos.buscador.ayuda`: `"Escribí al menos 2 caracteres del nombre, apellido o DNI."`.
- `ui.pagos.sinClasesPendientes`: `"Este alumno no tiene clases pendientes de pago"` (criterio 3).
- `ui.pagos.tarifaCambio`: `"La tarifa de {materia} cambió. Revisá el importe."` (DEC-28).
- `ui.pagos.registrado`: `"Pago registrado correctamente ({n, plural, one{1 clase} other{# clases}})"` o el mecanismo de plural que ya use `texto()` en otras claves — confirmar contra `textos.ts` real si ya hay un helper de pluralización, si no, armar el singular/plural a mano (DEC-22 ya fija que es "(1 clase)" en singular). *Resuelto así:* `texto()` no tiene plurales; son dos claves, `ui.pagos.registrado.una` («Pago registrado correctamente (1 clase)») y `ui.pagos.registrado.varias` («… ({n} clases)»).

El resto de las claves de interfaz de la pantalla quedaron bajo `ui.pagos.*` en `textos.ts` (título, pasos, resumen, columnas, estados de pago, origen del precio, «Modificar importe», forma y fecha de pago, botones).

Los literales de error de 2.7.6 (`TURNO_YA_EMPEZO`, etc.) **ya están** en `textos.ts` (sección 0.1): no se repiten acá.

---

## 5. Frontend

**Ruta:** `/pagos/registrar` (Server Component `page.tsx`, lee `searchParams.alumno` y `searchParams.clase`). Según `DESIGN.md` §6.2, es un flujo de **página completa** (no modal): mismo patrón que el wizard de turno (`/turnos/nuevo`), con stepper propio (ver mocks: "Paso 1 Alumno", "Paso 2 Clases", "Paso 3 Confirmación" con barra de progreso).

- **Paso 1 — Buscar alumno** (`paso-buscar-alumno.tsx`): input de búsqueda con el combobox de `DESIGN.md` §8.2, activado desde 2 caracteres (lista grande, mismo umbral que HU-B-05 y "Agregar alumno" de HU-C-04 — no el umbral de 1 carácter que usa el modal viejo de HU-I-01, porque ahí la lista ya está acotada a los inscriptos del turno). Mensaje sin coincidencias: "No se encontraron alumnos para «texto buscado»" (mismo texto que ya usa el combobox existente). *Resuelto así:* reutiliza `BuscadorAlumnos` (HU-C-04) con `endpoint="/api/pagos/buscar-alumnos"`, espera de 250 ms y el texto de §8.2; debajo, la ayuda `ui.pagos.buscador.ayuda`. Al elegir un alumno pasa al Paso 2. Con `?alumno=<id>` (y opcionalmente `&clase=<id>`) la pantalla arranca directo en el Paso 2.
- **Paso 2 — Clases del alumno** (`paso-clases-alumno.tsx`): tabla con checkbox por fila (~~`Checkbox` de shadcn/ui~~ *resuelto: checkbox nativo con `accent-primary`, mismo precedente que `paso-alumnos-turno.tsx`*), columnas Fecha, Materia y profesor, Estado de pago (`Badge` con las variantes de DESIGN.md §6.6: `warning` / `outline` / `accent`, nunca hex), Importe a cobrar (precio de la clase con su origen, «Fijado al inscribirse» o «Tarifa vigente»; «Modificar importe» abre el campo de importe y el de motivo, con «Usar el precio de la clase» para volver atrás). Las clases marcadas por `?clase=` vienen ya elegidas. El pie de la tabla muestra «N clases elegidas» y el total, que se recalcula al marcar, desmarcar o cambiar un importe. Resumen lateral (alumno con DNI, cantidad de clases, total) en los tres pasos, igual al mock (`Paso_2_-_Clases_del_alumno.png`). Sin clases: aviso con `ui.pagos.sinClasesPendientes` y el link "Buscar otro alumno" (que también está arriba de la tabla). Botones: **«Volver»** (vuelve al Paso 1) y **«Continuar a confirmación»**, que solo avanza al Paso 3 si hay al menos una clase elegida («Elegí al menos una clase.») y cada importe modificado es válido y, si difiere del precio, tiene motivo (errores inline en la fila).
- **Paso 3 — Forma de pago y confirmación** (`paso-confirmacion.tsx`): selector de forma de pago (activas, con la preferida del alumno preseleccionada si está activa; si no, «Elegí una forma de pago») y fecha de pago (`Input type="date"`, por defecto hoy en la zona del centro y con tope en hoy — **no** el valor fijo que muestra el mock del atajo, que es dato de placeholder del prototipo, ver nota al final de esta sección), y debajo la tabla de clases elegidas con su importe (y el motivo cuando difiere del precio). *Resuelto así:* el botón de este paso es **«Confirmar pago»** (el «Continuar a confirmación» quedó en el Paso 2, como en el prototipo). Valida que haya forma de pago y que la fecha no esté vacía ni sea futura, y recién entonces abre `ConfirmarAccionDialog` (C-25) con:
  - `titulo`: `texto("confirmaciones.pagos.registrarOperacion", { total: formatearMonto(total), alumno: nombreAlumno })`.
  - `detalle`: la tabla de clases con sus importes (y el motivo cuando difiere del precio) y la línea «<forma> · fecha de pago dd/mm/aaaa».
  - `textoConfirmar`: `"Registrar pago"`.
  - `irreversible`: `false` (corregido tras el relevamiento: la operación se puede corregir o anular después con HU-I-06, no es irreversible como cancelar un turno; coincide con `Revalidación_al_confirmar.png`, sin leyenda y con el botón primario).
  - `onConfirmar`: ~~`fetchOLanzar(...)`~~ *resuelto:* `POST /api/pagos/operaciones` con `fetchAutenticado` (ver 0.1), body `{ alumno_id, items, forma_pago_id, fecha_pago }`; si el servidor rechaza, lanza un `Error` con el texto a mostrar y el diálogo lo muestra inline sin cerrarse. El botón «Volver» del diálogo lo cierra y conserva lo cargado; el «Volver» del paso vuelve al Paso 2 con la selección intacta.
  - Si el servidor rechaza con `400 MOTIVO_AJUSTE_REQUERIDO`: actualiza el precio de la clase de `detalles.turno_id` con `detalles.precio_vigente`, muestra `ui.pagos.tarifaCambio` con `detalles.materia` y el diálogo queda abierto con el total ya recalculado en el título (comportamiento ya nativo de `ConfirmarAccionDialog`, sección 4.2 de HU-C-25).
- **Éxito:** banner inline en la parte superior de la página (patrón 6.2, **no** toast — ver 0.4.3), con `ui.pagos.registrado.una`/`.varias` según `pagos.length` y un botón para cerrar el aviso; *resuelto:* sin links «Ver comprobante» ni «Ver pagos del alumno» (omitidos hasta que existan HU-I-11 y HU-I-02, ver sección 1). El wizard vuelve al Paso 1 vacío (igual que el mock `Paso_3_-_Pago_registrado.png`), con la fecha otra vez en hoy; si se había entrado con `?alumno=`, la URL se limpia a `/pagos/registrar`.
- Todos los colores y componentes siguen `docs/DESIGN.md`: tokens de shadcn/ui + Tailwind, **nunca hex ni la paleta default de Tailwind**. El `AlertDialog` de confirmación es exactamente el de C-25, sin reimplementar nada de su estilo.

**Decisiones confirmadas con el PO (09/10/2026):**
- `Revalidación_al_confirmar.png` es de una iteración anterior del prototipo (muestra el diálogo abierto desde el Paso 2): la implementación queda como está descrita arriba (forma y fecha en el Paso 3, «Confirmar pago» abre el diálogo).
- El texto «No se registró el pago.» que esa foto agrega al final del mensaje de error queda sin efecto: no es un requisito y no se implementa (los mensajes de error son los del catálogo de `textos.ts`).

**Nota sobre el mock del atajo (`Atajo_desde_el_detalle_de_la_clase.png`):** ese mock muestra un modal de un solo paso (sin stepper, con botón "Continuar" en vez de "Continuar a confirmación") y una fecha de pago precargada en `10/06/2026`, que no es "hoy" (09/10/2026). Como el cableado del atajo está fuera de alcance de esta task (sección 1), esta contradicción entre el texto de la HU (criterio 9: "abre este mismo flujo") y la foto (un modal distinto, de un solo paso) **no bloquea esta task**, pero queda señalada para quien implemente HU-C-24: a confirmar con el PO si el atajo abre el wizard completo con el paso 2 marcado (como dice el texto) o un modal reducido (como muestra la foto) — y, si es lo segundo, seguramente haya que retocar `spec_modulo_I.md` §2.7 para documentarlo.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios

- `pago.schema.test.ts`: los tres schemas nuevos — casos válidos y cada mensaje de error (campo extra, monto ≤ 0, `inscripcion_id`+`turno_id` juntos o ninguno, clase repetida, más de 50, `q` de 1 carácter).
- `pago.service.test.ts`:
  - `buscarAlumnosParaCobro`: delega correctamente en `buscarAlumnosActivos` (mock).
  - `listarClasesPendientesDePago`: arma `estado_pago` correcto para los 3 casos (`RESERVADA` con `vence_el`, `PAGO_SIN_REGISTRAR` sin vencimiento, `SE_INSCRIBE_AL_PAGAR` con `turno_id` y `exigeInscripcionConPago` en `true`); una clase ya empezada o con pago no anulado **no** aparece; sin clases pendientes devuelve `[]`. *Resuelto así:* el filtro «ya empezada / pagada / reserva vencida» vive en la función hermana de C y se prueba contra PostgreSQL real en `inscripcion.lecturas.pg.test.ts`; `pago.service.test.ts` cubre el armado de las filas y los rechazos con `turno_id`.
  - `registrarOperacionDePago`: arma el `DatosOperacion` correcto a partir del input (mapea `inscripcion_id`/`turno_id` a `ItemOperacion`), llama a `registrarOperacion` con `modo: "completo"` (mock/spy), arma la respuesta 2.7.5 con el total correcto (suma de montos, no de precios).
- `operacion.service.test.ts` **no se toca**: ya cubre el comportamiento de `registrarOperacion` en modo `"completo"` (si no lo cubre todavía para este modo específico, es un gap de la task que implementó ese archivo, no de esta — reportarlo, no arreglarlo acá en silencio).
- Componentes del wizard: Paso 1 dispara la búsqueda solo desde 2 caracteres; Paso 2 recalcula el total al marcar/desmarcar y al cambiar un importe (criterio 4, última viñeta); Paso 3 arma el `titulo` del diálogo de confirmación con `formatearMonto` y el nombre del alumno; al recibir `MOTIVO_AJUSTE_REQUERIDO` el diálogo no se cierra y se ve el mensaje inline (mismo test que ya tiene `confirmar-accion-dialog.test.tsx` para el caso de error, aplicado a este caso de uso).

### Nivel 2 — Postman

- `GET /api/pagos/buscar-alumnos?q=an` → `200` con alumnos activos que matchean.
- `GET /api/pagos/buscar-alumnos?q=a` → `400` (menos de 2 caracteres).
- `GET /api/pagos/pendientes?alumno_id=<cuid>` → `200` con la lista de clases; alumno inexistente → `404 ALUMNO_NO_ENCONTRADO`.
- `GET /api/pagos/pendientes?alumno_id=<cuid>&turno_id=<seed-turno-NN>` con el alumno no inscripto pero `exigeInscripcionConPago` en `true` → `200` con la fila `SE_INSCRIBE_AL_PAGAR` marcada.
- `POST /api/pagos/operaciones` con una clase → `201`, `pagos.length === 1`.
- Lo mismo con tres clases, una de ellas ya empezada → `409 TURNO_YA_EMPEZO`, **ninguna** de las tres queda registrada (todo o nada).
- Monto distinto del precio sin `motivo_ajuste` → `400 MOTIVO_AJUSTE_REQUERIDO` con `detalles.precio_vigente`.
- Sin caja abierta → `409 CAJA_NO_ABIERTA`.
- Gerente autenticado → `403 SIN_PERMISO` en los tres endpoints.
- Más de 50 ítems → `400` (Zod).

### Nivel 3 — BD / TablePlus

- Tras un `POST /api/pagos/operaciones` exitoso con 2 clases: una fila en `operaciones_pago`, dos filas en `pagos` (ambas con el mismo `operacionId`), la inscripción de cada una pasa a `PAGADA`, y un `Comprobante` con `operacionId` igual al de la operación.
- Con un ítem "Se inscribe al confirmar el pago": verificar que la inscripción se creó ya `PAGADA` con el precio de la tarifa vigente (no el de una inscripción previa, porque no la había).
- Con monto distinto del precio: el `Pago` guarda `motivoAjuste` y `ajustadoPor`.

**Evidencia esperada:** Postman + SQL para el contrato de API y la capa de datos; capturas de UI de los 3 pasos y del caso de error inline en el paso 3 (comparar contra `Revalidación_al_confirmar.png`).

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) confirmado antes de implementar, incluyendo el estado real de la dependencia de Módulo B (0.4.1) y las reglas de `docs/RULES.md` citadas al inicio de la sección 0.
- [x] Los tres schemas Zod implementados con los mensajes exactos de la spec.
- [x] `buscarAlumnosParaCobro`, `listarClasesPendientesDePago` y `registrarOperacionDePago` implementados; ninguno reimplementa lógica de negocio que ya resuelve `registrarOperacion` (Regla N.° 4).
- [x] Los tres Route Handlers responden `{ data, error }` con los status codes de 2.7.6, usando el helper `respuesta-error.ts` (`error.status` para `ErrorDeDominio`, fallback por código para `ServiceError` común — ver 4.3) (Reglas N.° 5 y 6).
- [x] Extensión de `inscripcion.lecturas.ts` (DEC-23) implementada y sin romper los consumidores existentes (E, H, HU-C-13) — correr sus tests, no solo los nuevos. Se mantiene el aislamiento de dominio (Regla N.° 3): `pago.service.ts` sigue leyendo turnos solo por esta fachada pública.
- [x] Entrada `pagos: ["MESA_ENTRADA"]` agregada a `rutas-por-rol.ts`.
- [x] Textos nuevos agregados a `textos.ts` (4.4), ninguno hardcodeado en componentes.
- [x] Fila de HU-I-10 agregada a `DESIGN.md` §6.4 (0.4.3).
- [x] Frontend: wizard de 3 pasos funcional, reutiliza `ConfirmarAccionDialog` sin reimplementar su estilo ni su manejo de error inline.
- [x] Ningún cambio en `POST /api/pagos`, `registrar-pago-dialog.tsx` ni `turno-detalle.tsx`.
- [x] Ningún `DELETE`/`UPDATE` directo sobre `Pago` (Regla N.° 8): todo pasa por `registrarOperacion`.
- [ ] Tests de los 3 niveles en verde, con evidencia.
- [x] Ambigüedades de la sección 0.4 y de la nota del mock del atajo (sección 5) comunicadas al PO/equipo, no resueltas por inferencia propia.
- [ ] PR con diff acotado exclusivamente a esta HU (más la extensión puntual de C que pide DEC-23).