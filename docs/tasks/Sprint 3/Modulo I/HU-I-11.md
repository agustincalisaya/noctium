# TASK: HU-I-11 — Emitir comprobante de pago

**Módulo:** I (Pagos)
**Sprint:** 3
**Contrato de referencia:** `docs/specs/spec_modulo_I.md` §2.9 (Comprobante de pago — 2.9.1 Emisión/numeración/reemplazos, 2.9.2 Contenido, 2.9.3 Rutas de lectura, 2.9.4 Marcas y comprobante vigente, 2.9.5 Errores) · también §2.6.1 (entidad `Comprobante`), §2.6.3 (permisos `comprobantes:leer`/`comprobantes:leer_propios`), §2.8 (banner de éxito del atajo) y §3.13 (el comprobante es un hecho emitido) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-I-11, backlog completo) · `docs/tasks/Sprint 3/Modulo I/HU-I-10.md` (banner de éxito y `TurnoPagoCard`, que esta task extiende) · `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 8, 10, 11 — detalle de cada una en la sección 0)
**RBAC:** `comprobantes:leer` (MESA_ENTRADA, GERENTE) y `comprobantes:leer_propios` (ALUMNO) — **ya existen**, sembrados en `prisma/seed.ts` (líneas ~930-932). Sin permisos nuevos.
**Schema:** ya completo, sin migración. `Comprobante`, su secuencia `comprobante_numero_seq`, y la emisión/reemplazo (`emitirComprobante`, `emitirReemplazo`) ya están migrados e implementados por el PR 0 — ver sección 0.1.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre lo que falta relevar (sección 0.4) y la lista final de archivos (0.2/0.3). Esta sección ya viene con una auditoría hecha contra el código real de `develop`, no contra la spec en abstracto.

**Reglas no negociables de `docs/RULES.md` que esta task debe cumplir** (leer el archivo completo antes de implementar):
- **Regla N.° 1** (prohibido el `DELETE` físico) — no aplica, esta task no da de baja nada.
- **Regla N.° 2** (trazabilidad de mutaciones sensibles — nombre real en `RULES.md`; la task la citó mal como "auditoría inmutable encadenada", corregido acá) — no aplica: esta task no escribe ninguna mutación nueva, solo lee. No hay evento de dominio que emitir (ver 4.5).
- **Regla N.° 3** (aislamiento de dominio entre módulos) — casi todo lo que esta task lee de Pagos pasa por los archivos del propio módulo I (`comprobante.*`, `pago.publico.ts`, `pago.vigente.ts`). La única excepción es `GET /api/mis-pagos/[id]/comprobante`, que resuelve el alumno de la sesión con `obtenerAlumnoDeUsuario()` de `alumno.publico.ts` (Módulo B) — pasa por la fachada pública, mismo patrón que ya usa `mi-historial`, así que no viola la regla; no se agrega ninguna función nueva a esa fachada.
- **Regla N.° 4** (la capa de servicios es la única dueña de la lógica de negocio) — los Route Handlers de 4.3 son delgados: arman la respuesta `{ data, error }` a partir de lo que devuelve la capa de lectura (4.2), sin decidir nada por su cuenta.
- **Regla N.° 5** (contrato de respuesta estándar) — los tres endpoints nuevos lo siguen, con el mismo sobre `respuestaDeError`/`respuestaDeValidacion` de HU-I-10.
- **Regla N.° 6** (validación Zod previa a la capa de servicios) — los tres endpoints son `GET` sobre un `:id` de ruta; no llevan body ni query a validar con un schema de objeto, pero si el `:id` necesita forma validada (`cuid`), se resuelve igual antes de tocar la capa de lectura (ver 4.1).
- **Regla N.° 8** (inmutabilidad de un registro de hecho consumado) — un comprobante emitido **nunca se modifica**; esta task es puramente de lectura, así que no hay riesgo de violarla, pero es la razón de que las marcas (`ANULADO`, `Reemplazado por`) se **deriven** al leer en vez de guardarse en el propio comprobante (spec §2.9.4) — no se te ocurra "cachear" la marca escribiendo sobre `Comprobante`.
- **Regla N.° 10** (RBAC granular por acción) — `comprobantes:leer` / `comprobantes:leer_propios`, ya existentes.
- **Regla N.° 11** (tipos de dominio compartidos viven en `src/types/`) — por eso `ComprobanteLeido` (lo necesita el componente cliente `ComprobanteCard`) se define en `src/types/pago.types.ts`, no en `comprobante.lectura.ts` (que solo lo importa). Ver 0.4.10.

### 0.1. Ya existe en `develop` (verificado, no hay que crearlo de nuevo)

- `emitirComprobante()` / `emitirReemplazo()` en `src/server/pagos/comprobante.service.ts` — **ya implementan completo** el comportamiento de 2.9.1: numeración correlativa vía `nextval('comprobante_numero_seq')` dentro de la transacción del pago, copia fija de los datos (`ComprobanteDatosSchema` en `comprobante.schema.ts`), reemplazo con `reemplazaAId` único. `operacion.service.ts` ya llama a `emitirComprobante` al final de `registrarOperacion`. **Esta task no toca ninguno de los dos archivos.**
- Los permisos `comprobantes:leer` (MESA_ENTRADA, GERENTE) y `comprobantes:leer_propios` (ALUMNO) **ya están sembrados** en `prisma/seed.ts`. No hace falta agregar nada ahí.
- Los `code` de error de 2.9.5 **ya están dados de alta** en `src/server/shared/errores-dominio.ts`: `errores.pago.noEncontrado` → `PAGO_NO_ENCONTRADO` (404), `errores.pago.fueraDeAlcance` → `FUERA_DE_ALCANCE` (403), `errores.comprobante.noEncontrado` → `COMPROBANTE_NO_ENCONTRADO` (404). **No hace falta agregar ningún código nuevo.**
- `comprobanteDelPago()` — función **privada** (no exportada) en `src/server/pagos/pago.publico.ts` (línea ~66) — **ya implementa exactamente** la resolución de "el comprobante vigente de la operación del pago, o si el pago está anulado, el último comprobante que lo incluyó" que pide la spec §2.9.3 (busca en `datos.clases` por `pago_id`). **Ojo con la firma real:** es **síncrona**, `(operacion: OperacionLeida, pagoId: string, anulado: boolean)` — recibe la operación ya cargada, no un `db`/`pagoId` como asumía un borrador anterior de esta task. Ver la resolución final en 0.4.2 (se mueve y se renombra, y se agrega un wrapper async nuevo con esa otra firma).
- `comprobanteVigenteDe()` — **ya exportada** en `comprobante.service.ts` (`(tx, operacionId) => Promise<{id, numero} | null>`, donde `numero` es el entero sin formatear). Importable sin tocar el archivo; no resuelve el caso "pago anulado" (para eso sigue haciendo falta `comprobanteDelPago`).
- `PagoDeClase` (mismo archivo) **ya trae** `comprobante_vigente: { id, numero } | null` por pago, calculado con esa misma función. `listarPagosDeTurno()` (la que alimenta `TurnoPagoCard`) **descarta ese campo a propósito** en su `.map()` final (línea ~218) para mantener `PagoDeTurno` con la forma de Sprint 2. Es el único punto que hay que tocar para que `TurnoPagoCard` reciba el dato — no hay que calcular nada nuevo, solo dejar de descartarlo.
- `INCLUDE_LECTURA` (mismo archivo, const privada) ya incluye, por operación, `comprobantes: { numero, datos, reemplazadoPor }`, pero **no alcanza** para armar la vista completa: le faltan `emitidoEl`, el número del comprobante al que este reemplaza (`reemplazaA`) y el número del que lo reemplazó (hoy `reemplazadoPor` solo trae el id). `leerComprobante` (4.2) hace su propia consulta por id de comprobante en vez de adaptar este include — ver 0.4.2.
- `operacionVigente()` en `src/server/pagos/pago.vigente.ts` **ya calcula**, por pago, `anulado: boolean` y `anulacion: { fecha, motivo } | null` — reusable para derivar la marca "ANULADO" del comprobante vigente de una operación (todos sus pagos anulados → "ANULADO", con fecha/motivo de la última anulación, spec §2.9.4).
- El precedente de endpoint propio del alumno ya existe: `src/app/api/mi-historial/route.ts` usa `withPermission("historial:leer_propio", async (req) => { ... req.auth!.user ... })` para resolver quién es el alumno de la sesión y rechazar si alguien pide el dato de otro (`SIN_PERMISO`/`403` si viene un `alumno_id` ajeno en query). `GET /api/mis-pagos/[id]/comprobante` sigue el mismo patrón con `req.auth!.user`, pero el rechazo por "no es tuyo" acá es `403 FUERA_DE_ALCANCE` (no `SIN_PERMISO`, spec §2.9.5), porque el alumno sí tiene el permiso — está fuera de alcance de su propio recurso.
- El patrón de Route Handler, `withPermission` y el sobre `respuestaDeError`/`respuestaDeValidacion` de `src/app/api/pagos/respuesta-error.ts` (HU-I-10) son directamente copiables para los tres endpoints nuevos.

### 0.2. Archivos nuevos a crear (ruta exacta)

- `src/server/pagos/comprobante.lectura.ts` — capa de lectura para mostrar un comprobante (ver 4.2): `leerComprobante(db, comprobanteId)`, `leerComprobanteDeAlumno(db, comprobanteId, alumnoId)`, y `comprobanteDelPago` movida acá desde `pago.publico.ts` (ver 0.4.2).
- `src/app/api/comprobantes/[id]/route.ts` — `GET`, `comprobantes:leer` (mesa de entrada/gerente).
- `src/app/api/pagos/[id]/comprobante/route.ts` — `GET`, `comprobantes:leer`, resuelve por `comprobanteDelPago`.
- `src/app/api/mis-pagos/[id]/comprobante/route.ts` — `GET`, `comprobantes:leer_propios`, vista del alumno.
- `src/app/(dashboard)/comprobantes/[id]/page.tsx` — vista para mesa de entrada/gerente.
- `src/app/(dashboard)/mis-pagos/[id]/comprobante/page.tsx` — vista del alumno.
- `src/components/pagos/comprobante-card.tsx` (propuesta, ver 0.4.3) — el componente visual del comprobante (header del centro, datos de fecha/alumno/forma/registrado por, tabla de clases, total, leyenda, marcas, botones Imprimir/Cerrar), compartido por las dos páginas de arriba.
- Los `*.test.ts(x)` correspondientes a cada archivo de arriba.

### 0.3. Archivos existentes a modificar (ruta exacta + qué cambia)

- `src/server/pagos/pago.publico.ts` — retira la función privada `comprobanteDelPago` (movida, renombrada `comprobanteDelPagoEnOperacion`, ver 0.4.2) y vuelve a importar `INCLUDE_LECTURA`/`OperacionLeida`/`comprobanteDelPagoEnOperacion` desde `comprobante.lectura.ts` para que `pagosDeOperaciones()` siga funcionando igual; `listarPagosDeTurno()` deja de descartar `comprobante_vigente` en su `.map()` final; su tipo **local** `PagoDeTurno` (línea ~31 — es el que realmente usa `listarPagosDeTurno`, no el de `src/types/pago.types.ts`) suma `comprobante: { id: string; numero: string } | null`.
- `src/types/pago.types.ts` — su propio `PagoDeTurno` (línea ~29, sin consumidores reales hoy) suma el mismo campo por consistencia; además define acá `ComprobanteLeido` (ver 0.4.10).
- `src/types/turno.types.ts` — `PagoRegistradoTurno` suma el mismo campo.
- `src/proxy.ts` — suma `"/comprobantes/:path*"` y `"/mis-pagos/:path*"` al `matcher`, si no, las entradas nuevas de `rutas-por-rol.ts` no tienen ningún efecto (ver 0.4.4).
- `src/app/globals.css` — reglas `@media print` nuevas, acotadas a la página del comprobante (ver 0.4.12).
- `src/app/(dashboard)/turnos/[id]/turno-pago-card.tsx` — cada fila de "Pagos registrados" suma el link "Comprobante {numero}" cuando `pago.comprobante` no es `null` (mock: imagen 2 de esta HU).
- `src/app/(dashboard)/pagos/registrar/registrar-pago-wizard.tsx` — el banner de éxito (HU-I-10, función `registrado()`) suma el link "Ver comprobante" apuntando a `/comprobantes/{comprobante.id}`. El dato ya viaja en la respuesta del `POST /api/pagos/operaciones` desde HU-I-10 (`comprobante: { id, numero }`), pero hoy el wizard solo guarda el contador `registradas` en el estado del banner, no el `comprobante`: hay que sumarlo al estado que ya arma `registrado()` (ver `HU-I-10.md` sección 1: "se omitió... la respuesta del POST ya trae `comprobante: { id, numero }` para cuando exista").
- `src/server/shared/rutas-por-rol.ts` — agrega `comprobantes: ["MESA_ENTRADA", "GERENTE"]` y `"mis-pagos": ["ALUMNO"]` a `RUTAS_POR_ROL` (decisión ya tomada, ver 0.4.4).
- `src/lib/textos.ts` — agrega las claves nuevas de interfaz (ver 0.4.3).

**No se toca en esta task** (explícito, ver sección 1): `comprobante.service.ts`, `comprobante.schema.ts`, `operacion.service.ts`, `prisma/seed.ts`, `errores-dominio.ts`, `pago.schema.ts`.

**Páginas nuevas (ambas, ver 0.2):** además del guard de ruta vía `rutas-por-rol.ts`/`proxy.ts`, llaman a `exigirPermiso()` igual que toda pantalla nueva del proyecto (`RULES.md`, citado en HU-A-06) — el guard de ruta es una capa extra, no el único control.

**Tests existentes que se van a romper y hay que actualizar, no ignorar:** `pago.publico.test.ts` (usa `toEqual` exacto sobre el shape de `PagoDeTurno`, va a necesitar `comprobante: null`/el valor esperado en cada caso), `rutas-por-rol.test.ts`, `registrar-pago-wizard.test.tsx`.

### 0.4. Relevar antes de asumir

1. **Página vs. modal real para `/comprobantes/[id]` y `/mis-pagos/[id]/comprobante`.** El prototipo (imagen 1 de esta HU) lo muestra como un modal sobre la pantalla anterior (la ficha del alumno se ve atenuada detrás). El proyecto no usa rutas interceptoras de Next.js (`@modal`, carpetas `(.)segmento`) en ningún otro lugar del código — se revisó el árbol de `src/app` completo y no hay precedente.
   **Resuelto:** página Next.js normal (Server Component) dentro de `(dashboard)`, con una tarjeta centrada con el mismo look que el mock (header del centro, tabla, leyenda, botones). El botón "Cerrar" y la "X" hacen `router.back()`. "Imprimir" usa `window.print()` con una hoja `@media print` que oculta sidebar/navbar y deja visible solo la tarjeta — sin montar un modal real ni rutas interceptoras sobre la ruta anterior (más simple, sin precedente nuevo que mantener).
2. **Dónde vive la lectura compartida.** `comprobanteDelPago()` ya existe pero es privada de `pago.publico.ts`, que es la fachada de **pagos**, no de **comprobantes**. Alternativas: (a) exportarla tal cual y dejarla donde está; (b) moverla a `comprobante.lectura.ts` (propuesto en 0.2) junto con el resto de la lectura de comprobantes, y que `pago.publico.ts` la importe de vuelta para no duplicarla.
   **Resuelto: (b), con un ajuste tras el relevamiento de Claude Code sobre la firma real** (ver 0.1): la función privada actual es síncrona y recibe la operación ya cargada — no se puede exponer tal cual con la firma `async (db, pagoId)` que pedía el borrador de 4.2, serían dos funciones distintas con el mismo nombre. Se mueven a `comprobante.lectura.ts`, **sin reescribir su lógica**:
   - La función pura, renombrada `comprobanteDelPagoEnOperacion(operacion: OperacionLeida, pagoId, anulado)`, más `INCLUDE_LECTURA` y el tipo `OperacionLeida`, exportados.
   - Una `comprobanteDelPago(db, pagoId)` **nueva**, async, que carga la operación del pago (con `INCLUDE_LECTURA`) y delega en la pura. Si el pago no existe, lanza `errores.pago.noEncontrado`; si existe pero su operación no tiene ningún comprobante (no debería pasar nunca, ver 4.3), lanza un `Error` de inconsistencia en vez de devolver `null` sin más — así el Route Handler puede distinguir los dos casos.
   `pago.publico.ts` pasa a importar `INCLUDE_LECTURA`/`OperacionLeida`/`comprobanteDelPagoEnOperacion` de vuelta desde `comprobante.lectura.ts` (los sigue necesitando `pagosDeOperaciones()`), en vez de declararlos. Atención al mover: el código ya tiene tests (`pago.publico.test.ts`/`.pg.test.ts`) — el move no debe romper esos tests, solo el import.
3. **Claves nuevas en `src/lib/textos.ts`** (patrón `ui.<módulo>.<grupo>.<nombre>` de HU-C-23). **Resuelto**, claves finales:
   - `ui.comprobantes.titulo` → `"Comprobante N.° {numero}"`
   - `ui.comprobantes.leyenda` → `"Comprobante interno. No válido como factura"` (criterio 3, literal)
   - `ui.comprobantes.ayudaImprimir` → `"«Imprimir» abre el diálogo de impresión del navegador, desde donde también se puede guardar como PDF."` (texto literal de la imagen 1)
   - `ui.comprobantes.registradoEnElCentro` → `"Registrado en el centro"`
   - `ui.comprobantes.anulado` → `"ANULADO"`
   - `ui.comprobantes.reemplazadoPor` → `"Reemplazado por {numero}"`
   - `ui.comprobantes.imprimir` → `"Imprimir"`, `ui.comprobantes.cerrar` → `"Cerrar"`
   - `ui.pagos.verComprobante` → `"Ver comprobante"` (banner de éxito de HU-I-10, texto genérico porque ahí no hay un número a la vista todavía en el momento de mostrar el link)
   - `ui.pagos.comprobanteNumero` → `"Comprobante {numero}"` (cada fila de `TurnoPagoCard`, donde sí interpola el número) — clave separada de `ui.pagos.verComprobante` en vez de una sola con parámetro opcional, porque son dos textos distintos en dos lugares distintos, no una sola etiqueta reusada.
4. **Entradas nuevas en `rutas-por-rol.ts`.** Ya resuelto (decisión tomada): `comprobantes: ["MESA_ENTRADA", "GERENTE"]` y `"mis-pagos": ["ALUMNO"]`, como entradas **separadas** de `pagos` (que sigue en `["MESA_ENTRADA"]`, sin tocar — GERENTE no necesita entrar a `/pagos/registrar`, solo a `/comprobantes`). Así el guard de ruta queda alineado con el permiso de servicio `comprobantes:leer` y no bloquea a GERENTE. Documentado acá como parte del diseño, no como algo a relevar más adelante.
5. **Encabezado del comprobante: CUIT del mock vs. teléfono del contrato real.** El prototipo (imagen 1) muestra "Av. Colón 1250, Córdoba · CUIT 30-71654321-9". `spec_modulo_I.md` §2.9.2 ya resolvió esto (DEC-34): "el prototipo muestra el CUIT en lugar del teléfono: manda el backlog" — es decir, se usa el **teléfono real** de `ParametroSistema` (`centro_telefono`, ya consumido por `comprobante.service.ts` vía `datosCentro()`), no CUIT. No es una decisión nueva de esta task; se señala para que no se copie el CUIT del mock literalmente — el campo `centro.telefono` ya viene en `Comprobante.datos`.
6. **Formato de "Emitido" en el header** (mock: "Emitido: 06/10/2026 12:42", sin coma). Sale de `emitido_el` (ISO con offset, spec §2.9.3) formateado en hora del centro.
   **Resuelto:** ya existe `fechaHoraDeInstante()` en `src/lib/turno-detalle.ts` (línea ~39), que devuelve `"06/10/2026, 12:42"` **con coma**. Se reusa tal cual, con la coma — prioriza la consistencia con el resto de la app (un solo formato de fecha+hora en todo el proyecto) por sobre calcar un detalle de puntuación del mock, mismo criterio que ya se aplicó con el CUIT/teléfono (0.4.5). No se escribe ningún helper nuevo.
7. **¿Hace falta fila nueva en `DESIGN.md` §6.4?** Esa tabla es "qué feedback de éxito dispara cada acción" (toast/banner). Esta historia no dispara ninguna acción que mute datos: es una vista de lectura más el botón Imprimir.
   **Resuelto:** no se agrega fila a 6.4 (no aplica — no hay "éxito" que informar) ni se toca `DESIGN.md` en esta task.
8. **Alcance real del criterio 4** ("se puede ver e imprimir desde la confirmación del pago, el detalle de la clase, el historial de pagos del alumno y Mis pagos"). HU-I-02 e HU-I-05 todavía no existen (siguen en el carril de Cali, después de esta). La propia historia lo declara "verificación diferida: el criterio 4 se completa cuando estén HU-I-02 y HU-I-05".
   **Resuelto:** esta task wirea los **dos** puntos de entrada que sí existen hoy — el banner de éxito de HU-I-10 (`registrar-pago-wizard.tsx`) y la lista "Pagos registrados" del detalle de la clase (`turno-pago-card.tsx`) — y construye los **tres** endpoints de lectura completos de §2.9.3, incluido `GET /api/mis-pagos/[id]/comprobante` del alumno, porque son el contrato propio de esta historia; sin pantalla que lo consuma todavía, se verifica por Postman/curl (Nivel 2). HU-I-02 y HU-I-05 van a reusar estos mismos endpoints sin tener que tocar el backend de nuevo. No se wirea ningún link desde pantallas que todavía no existen.
9. **Los botones "Corregir"/"Anular" que aparecen junto a cada pago en el mock (imagen 2).** Son de HU-I-06 (todavía no implementada en el carril de Cali — va después de ésta). **Fuera de alcance explícito de esta task:** no se tocan ni se agregan ahora; el mock los muestra porque es un prototipo de un estado posterior del proyecto, no porque esta historia deba construirlos.
10. **Dónde vive `ComprobanteLeido`.** La Regla N.° 11 manda los tipos de dominio compartidos a `src/types/`, y `ComprobanteCard` (componente de cliente) lo necesita para tipar sus props.
    **Resuelto:** se define en `src/types/pago.types.ts`, junto al resto de los tipos de pagos (no en `comprobante.lectura.ts`, que lo importa de vuelta desde ahí para tipar sus propias funciones).
11. **Quién registró el pago, sin nombre.** `datos.registrado_por.nombre_completo` puede ser `null` según `comprobante.schema.ts` (caso borde, p. ej. una cuenta borrada) — no es el caso normal, pero `ComprobanteCard` tiene que poder mostrarlo igual sin romper.
    **Resuelto:** nueva clave `ui.comprobantes.registradoPorSinDato` → `"—"`, usada solo en la vista de mesa de entrada/gerente cuando `registrado_por` es `null`. No reemplaza a `registrado_en_el_centro` (eso sigue siendo exclusivo de la vista del alumno, un caso distinto) y no se hardcodea el guion en el componente.
12. **Impresión.** El layout del dashboard usa `h-screen overflow-hidden` y hoy no hay ninguna regla `@media print` en el proyecto.
    **Resuelto:** reglas nuevas en `src/app/globals.css`, acotadas con el selector `body:has([data-comprobante])` (el elemento raíz de `ComprobanteCard` lleva el atributo `data-comprobante`) para que no cambien la impresión de ninguna otra pantalla: ocultan sidebar/navbar/breadcrumb y neutralizan el `overflow-hidden` del layout del dashboard al imprimir, dejando visible solo la tarjeta.
13. **Validación del `:id` de ruta (4.1).** El único antecedente de validar un `:id` con `z.cuid()` es `turnos/[id]/alumnos/[alumnoId]`; la ruta más parecida a las de esta historia, `turnos/[id]`, no valida el formato y responde `404` directamente si no encuentra el registro.
    **Resuelto:** mismo criterio que `turnos/[id]`: no se valida el formato del `:id` con Zod. Si no es un `cuid` válido, la consulta simplemente no encuentra nada y el flujo normal de `COMPROBANTE_NO_ENCONTRADO`/`PAGO_NO_ENCONTRADO` cubre el caso, sin rechazar de entrada ids estables de datos de seed.
14. **Mock contra contrato de datos.** En la tabla de clases del mock (imagen 1) la columna "Hora" muestra un rango (`16:00–17:00`); `Comprobante.datos` solo guarda `hora_inicio` (spec §2.9.2), así que la vista real tiene una sola hora. El nombre del alumno en el mock aparece como `"Sofía Acosta"` (Nombre Apellido); el contrato real (§2.9.2, ejemplo literal) lo guarda como `"Apellido, Nombre"` (p. ej. `"Pérez, Ana"`).
    **Resuelto:** gana el contrato real en los dos casos, mismo criterio ya aplicado con CUIT/teléfono (0.4.5): `ComprobanteCard` muestra solo `hora_inicio` (sin calcular ni mostrar un rango) y el nombre tal como viene en `datos.alumno.nombre_completo` (formato `"Apellido, Nombre"`), sin reformatear. El mock es licencia artística del prototipo, no parte del contrato ya cerrado de `Comprobante.datos`.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. *(OK recibido; las resoluciones quedaron anotadas en cada punto, 1 a 14.)*

---

## 1. Nota de alcance

Esta historia **no emite ni modifica comprobantes**: eso ya lo hace `registrarOperacion` (vía `emitirComprobante`/`emitirReemplazo`, PR 0) desde que existe HU-I-10. HU-I-11 agrega exclusivamente la **vista** del comprobante, el botón **"Imprimir"** (diálogo nativo del navegador, sin librería de PDF) y el **control de acceso por rol** sobre esa vista.

Esta task depende de:
- **HU-I-10** (ya mergeada, genera la operación y el comprobante) y del modelo `Comprobante`/`OperacionPago`/`Pago` del PR 0 (ya mergeado, ver 0.1).
- **HU-I-01** (reglas base del pago).

Esta task es, a su vez, dependencia de:
- **HU-C-24** — según `docs/adicionales/analisis-dependencias-sprint-3.md`, HU-C-22 + HU-I-10 + HU-C-24 + HU-I-11 son una **unidad de entrega** que se desarrolla en paralelo contra los contratos del PR 0 y se integra en conjunto, en ese orden.
- **HU-I-02** (historial de pagos del alumno) e **HU-I-05** ("Mis pagos") — van a reusar los tres endpoints de lectura de esta task sin tocar el backend.
- **HU-I-06** (corregir/anular un pago) — ya tiene su servicio de dominio resuelto por el PR 0 (`correccion.service.ts`); cuando se implemente, cada corrección/anulación va a llamar a `emitirReemplazo` (sin tocar esta task) y la vista de esta historia va a mostrar las marcas correctamente porque las deriva en el momento de leer, no las cachea.

**Fuera de alcance de esta task (explícito):**
- **La emisión y el reemplazo de comprobantes** (`emitirComprobante`, `emitirReemplazo`, el contrato Zod de `Comprobante.datos`) — ya los resuelve el PR 0 por dentro; esta task no los toca.
- **El envío por email** (criterio 6, fuera de alcance declarado por el propio backlog).
- **Wirear el link desde el historial de pagos del alumno (HU-I-02) y desde "Mis pagos" (HU-I-05).** Esas pantallas no existen todavía (criterio 1, "verificación diferida"); esta task construye los endpoints de lectura que ambas van a consumir, pero no crea esas pantallas ni sus links.
- **Los botones "Corregir" y "Anular" de un pago** (HU-I-06, ver 0.4.9): no se tocan.
- **Cualquier código de error nuevo** en `errores-dominio.ts` (ya están todos, sección 0.1).
- **Cualquier permiso nuevo** en el seed (ya están todos, sección 0.1).

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada, gerente o alumno
**Necesito** obtener un comprobante de cada pago registrado, para verlo, imprimirlo o descargarlo
**Para** que el alumno tenga constancia de lo que pagó y el centro un respaldo de cada cobro

**SP estimado:** 2

---

## 3. Alcance de esta task

Implementación **frontend + backend**, conforme a `spec_modulo_I.md` §2.9 completa. Incluye:

- Capa de lectura: `leerComprobante()`, `leerComprobanteDeAlumno()` y `comprobanteDelPago` (movida) en `src/server/pagos/comprobante.lectura.ts` (ver 4.2 y 0.4.2).
- Route Handlers: `GET /api/comprobantes/[id]`, `GET /api/pagos/[id]/comprobante`, `GET /api/mis-pagos/[id]/comprobante`.
- Entradas nuevas en `rutas-por-rol.ts` (ver 0.4.4).
- UI: páginas `/comprobantes/[id]` y `/mis-pagos/[id]/comprobante`, componente compartido `ComprobanteCard` con el botón "Imprimir" (`window.print()` + `@media print`).
- Extensión de `TurnoPagoCard` (link "Comprobante {numero}" por fila) y del banner de éxito de HU-I-10 (link "Ver comprobante").
- Textos nuevos en `src/lib/textos.ts` (ver 0.4.3).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo listado en la sección 1.

---

## 4. Contrato Backend

### 4.1. Validación del `:id` de ruta

No hay schema Zod de *input* nuevo: los tres endpoints son `GET` sin body ni query, el único parámetro es el `:id` del path. **Resuelto (ver 0.4.13):** mismo patrón que `src/app/api/turnos/[id]/route.ts` — no se valida el formato del `:id` con Zod (el único antecedente de `z.cuid()` es `turnos/[id]/alumnos/[alumnoId]`, caso distinto). Un `:id` con forma inválida o inexistente simplemente no encuentra nada en la consulta y responde `404` con el código correspondiente (`COMPROBANTE_NO_ENCONTRADO` o `PAGO_NO_ENCONTRADO` según el endpoint).

### 4.2. Capa de lectura

**Archivo:** `src/server/pagos/comprobante.lectura.ts`

```typescript
/**
 * Lectura de comprobantes para mostrarlos (spec_modulo_I.md §2.9.3/2.9.4).
 * Nunca emite ni modifica nada (Regla N.° 8) — las marcas se DERIVAN acá,
 * nunca se guardan en Comprobante.
 */

export type ComprobanteLeido = {
  id: string; numero: string; // formatearNumeroComprobante, ya existe
  emitido_el: string; // ISO con offset del centro
  centro: { nombre: string; domicilio: string; telefono: string };
  alumno: { nombre_completo: string; dni: string };
  fecha_pago: string; forma_pago: { nombre: string };
  // Vista completa: nombre real, o `null` si no hay dato (ver 0.4.11). Vista del alumno: ausente (ver leerComprobanteDeAlumno).
  registrado_por?: string | null;
  registrado_en_el_centro?: true;
  clases: { materia: string; fecha: string; hora_inicio: string; monto: string }[];
  total: string;
  marcas: {
    anulado: { fecha: string; motivo?: string } | null; // motivo ausente en la vista del alumno
    reemplazado_por: { id: string; numero: string } | null;
    reemplaza_a: { numero: string } | null;
  };
};

/** Vista completa (mesa de entrada / gerente): §2.9.3, primer bloque de la respuesta. */
export async function leerComprobante(db: Db, comprobanteId: string): Promise<ComprobanteLeido | null> { /* ... */ }

/**
 * Vista del alumno: igual que arriba pero sin `registrado_por` (se reemplaza
 * por `registrado_en_el_centro: true`) y sin el motivo de la anulación
 * (criterio 5, spec §2.9.3 "la vista del Alumno se arma con una proyección
 * que no incluye... el motivo"). Lanza ErrorDeDominio("errores.pago.fueraDeAlcance")
 * si el comprobante no pertenece al alumno.
 */
export async function leerComprobanteDeAlumno(db: Db, comprobanteId: string, alumnoId: string): Promise<ComprobanteLeido | null> { /* ... */ }

/**
 * Comprobante vigente de la operación de un pago, o si el pago está anulado,
 * el último comprobante que lo incluyó (spec §2.9.3). Función PURA, movida
 * desde pago.publico.ts sin reescribirla (ver 0.4.2) — solo cambia el nombre.
 */
export function comprobanteDelPagoEnOperacion(operacion: OperacionLeida, pagoId: string, anulado: boolean): { id: string; numero: string } | null { /* ... */ }

/**
 * Wrapper async NUEVO (no existía antes, ver 0.4.2): carga la operación del
 * pago con INCLUDE_LECTURA y delega en comprobanteDelPagoEnOperacion. No
 * devuelve `null` para un pago inconsistente: lanza en los dos casos, para
 * que el Route Handler (4.3) no tenga que adivinar por qué no hay comprobante.
 * - Si no existe el pago: lanza un ErrorDeDominio("errores.pago.noEncontrado").
 * - Si existe pero su operación no tiene ningún comprobante (no debería pasar
 *   nunca, ver 4.3): lanza un Error de inconsistencia, no un comprobante vacío.
 */
export async function comprobanteDelPago(db: Db, pagoId: string): Promise<{ id: string; numero: string }> { /* ... */ }
```

Las marcas se arman con `operacionVigente()` (`pago.vigente.ts`, ya existe) para "ANULADO" (todos los pagos de la operación anulados → fecha/motivo de la última anulación) y con `reemplazadoPor`/`reemplazaAId` (ya vienen en el `include` de `INCLUDE_LECTURA`, a reusar o adaptar) para "Reemplazado por"/"reemplaza a". No se reimplementa ninguna lógica que ya exista en `pago.vigente.ts` o en `pago.publico.ts`.

### 4.3. Route Handlers

**Archivos:** `src/app/api/comprobantes/[id]/route.ts`, `src/app/api/pagos/[id]/comprobante/route.ts`, `src/app/api/mis-pagos/[id]/comprobante/route.ts`

- `GET /api/comprobantes/[id]` — `withPermission("comprobantes:leer", ...)`. `leerComprobante(id)`; `null` → `404 COMPROBANTE_NO_ENCONTRADO`.
- `GET /api/pagos/[id]/comprobante` — `withPermission("comprobantes:leer", ...)`. `comprobanteDelPago(pagoId)` ya no devuelve `null` (ver 0.4.2): lanza `errores.pago.noEncontrado` → `404 PAGO_NO_ENCONTRADO` si el pago no existe, o un `Error` de inconsistencia si el pago existe pero su operación no tiene ningún comprobante (no debería poder pasar nunca porque `registrarOperacion` siempre emite uno al final; si pasa, se informa como error de servidor, no se inventa un comprobante vacío). Encontrado el `{ id, numero }`, llama a `leerComprobante(id)`.
- `GET /api/mis-pagos/[id]/comprobante` — `withPermission("comprobantes:leer_propios", ...)`, usa `req.auth!.user` y `obtenerAlumnoDeUsuario()` (`alumno.publico.ts`, fachada de Módulo B — ver Regla N.° 3 en la sección 0) para resolver el alumno de la sesión, mismo patrón que `mi-historial/route.ts` (ver 0.1). `comprobanteDelPago(pagoId)` (mismo manejo de errores que el endpoint anterior) + `leerComprobanteDeAlumno(id, alumnoId)`; `403 FUERA_DE_ALCANCE` si el pago no es de ese alumno o si la cuenta no tiene ficha de alumno.

Respuesta siempre `{ data, error }` (Regla N.° 5), con el sobre `respuestaDeError` de `src/app/api/pagos/respuesta-error.ts` (HU-I-10) reusado tal cual, importado desde los nuevos route handlers.

### 4.4. Textos nuevos

Ver 0.4.3 (claves principales) y 0.4.11 (`ui.comprobantes.registradoPorSinDato`, caso borde de `registrado_por` nulo) — todas ya resueltas.

### 4.5. Eventos de dominio

No aplica. Esta task no escribe ninguna mutación nueva: es pura lectura más impresión del lado del cliente. No hay evento que emitir (Regla N.° 2 rige mutaciones, no lecturas).

---

## 5. Frontend

**Componente compartido:** `src/components/pagos/comprobante-card.tsx` (elemento raíz con el atributo `data-comprobante`, ver 0.4.12) — replica el diseño de la imagen 1 de esta HU: header con nombre/domicilio/**teléfono** del centro (no CUIT, ver 0.4.5), N.° de comprobante, fecha de pago vs. emitido, alumno (nombre completo en formato "Apellido, Nombre" — no "Nombre Apellido" como el mock, ver 0.4.14 — + DNI), forma de pago, "Registrado por" ("—" si el dato es `null`, ver 0.4.11; o "Registrado en el centro" en la vista del alumno), tabla Materia/Fecha/Hora/Monto (Hora = solo `hora_inicio`, sin rango — el mock muestra un rango que el contrato no guarda, ver 0.4.14), total, leyenda "Comprobante interno. No válido como factura", y debajo las marcas cuando correspondan ("ANULADO" con fecha — y motivo solo en la vista de mesa de entrada/gerente —, o "Reemplazado por 0001-XXXXXXXX"). Botones **Imprimir** (`window.print()`) y **Cerrar** (`router.back()`), con el texto de ayuda de la imagen 1 debajo.

**Rutas:**
- `/comprobantes/[id]` (`src/app/(dashboard)/comprobantes/[id]/page.tsx`) — Server Component, llama a `leerComprobante` directo (no hace falta pasar por el Route Handler propio desde el Server Component) o reusa la misma función de lectura; gateado por `comprobantes:leer` vía `rutas-por-rol.ts` (0.4.4) y por el propio `withPermission` si en algún punto pasa por API.
- `/mis-pagos/[id]/comprobante` (`src/app/(dashboard)/mis-pagos/[id]/comprobante/page.tsx`) — ídem con `leerComprobanteDeAlumno`, gateado por `comprobantes:leer_propios`.
- Impresión: hoja `@media print` que oculta sidebar/navbar/breadcrumb y deja visible solo `ComprobanteCard` — se agrega donde corresponda (global o en la propia página), sin afectar la impresión de ninguna otra pantalla.

**Wireo de los dos puntos de entrada que sí existen hoy (ver 0.4.8):**
- `registrar-pago-wizard.tsx` (HU-I-10): el banner de éxito suma el link "Ver comprobante" → `/comprobantes/{comprobante.id}` (mock: imagen 2, banner verde con el link a la derecha, antes de la "X").
- `turno-pago-card.tsx`: cada fila de "Pagos registrados" suma, debajo del nombre/fecha, el link "Comprobante {numero}" → `/comprobantes/{pago.comprobante.id}`, visible solo cuando `pago.comprobante` no es `null` (mock: imagen 2, lista "Pagos registrados" a la derecha).

Todos los colores y componentes siguen `docs/DESIGN.md`: tokens de shadcn/ui + Tailwind, nunca hex. No corresponde fila nueva en §6.4 (0.4.7, resuelto).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios

- `comprobante.lectura.test.ts`:
  - `leerComprobante`: comprobante vigente sin marcas (`marcas` todo `null`); comprobante reemplazado (`reemplazado_por` con id/numero del que lo reemplazó); comprobante que es un reemplazo de otro (`reemplaza_a` con el numero del anterior); comprobante cuya operación tiene todos los pagos anulados (`anulado` con fecha y motivo de la última anulación); `comprobanteId` inexistente → `null`.
  - `leerComprobanteDeAlumno`: igual, pero sin `registrado_por` (sí `registrado_en_el_centro: true`), `marcas.anulado.motivo` ausente, y lanza `errores.pago.fueraDeAlcance` si el comprobante no es del alumno pedido.
  - `comprobanteDelPagoEnOperacion`/`comprobanteDelPago`: pago con comprobante vigente → lo devuelve; pago anulado de una operación con otros pagos vigentes → devuelve el comprobante **original** que lo incluyó, no uno de reemplazo (`armarDatos` excluye los pagos anulados al armar un reemplazo, así que un reemplazo emitido después de la anulación nunca lo incluye — spec §2.9.3 dice "el último comprobante que lo incluyó"; corregido tras el relevamiento de Claude Code, punto 3); ese original se muestra marcado "Reemplazado por" al leerlo completo con `leerComprobante`; pago anulado único de su operación → mismo criterio, devuelve el comprobante que lo incluyó, marcado "ANULADO"; `pagoId` inexistente → `comprobanteDelPago` lanza `errores.pago.noEncontrado` (ya no devuelve `null`, ver 0.4.2).
- Componentes: `ComprobanteCard` renderiza las marcas correctas según el `ComprobanteLeido` recibido (con/sin `reemplazado_por`, con/sin `anulado`); el botón Imprimir llama a `window.print()` (mock); la vista del alumno no muestra el campo "Registrado por" ni el motivo de una anulación.

### Nivel 2 — Postman

- `GET /api/comprobantes/<id>` (mesa de entrada) → `200` con el shape completo de 2.9.3.
- `GET /api/comprobantes/<id>` (gerente) → `200` (tiene el permiso).
- `GET /api/comprobantes/<id>` (profesor) → `403 SIN_PERMISO`.
- `GET /api/comprobantes/<id-inexistente>` → `404 COMPROBANTE_NO_ENCONTRADO`.
- `GET /api/pagos/<id>/comprobante` con un pago vigente → `200`, comprobante correcto.
- `GET /api/pagos/<id>/comprobante` con un pago anulado (requiere HU-I-06 para generar el estado, o fixture directo en la base de test) → `200`, devuelve el último comprobante que lo incluyó, marcado "ANULADO" o "Reemplazado por" según corresponda.
- `GET /api/mis-pagos/<id>/comprobante` (alumno dueño del pago) → `200`, sin `registrado_por`.
- `GET /api/mis-pagos/<id>/comprobante` (alumno que no es el dueño) → `403 FUERA_DE_ALCANCE`.
- `GET /api/mis-pagos/<id>/comprobante` (mesa de entrada, sin `comprobantes:leer_propios`) → `403 SIN_PERMISO`.

### Nivel 3 — BD / TablePlus

No aplica en el sentido clásico (esta task no escribe en la base). Verificar en cambio que la vista **coincide exactamente** con lo ya guardado en `Comprobante.datos` para un pago de prueba (sin recalcular nada: cambiar manualmente el nombre de la forma de pago después de emitido y confirmar que el comprobante sigue mostrando el nombre viejo, spec §2.9.2).

**Evidencia esperada:** Postman para el contrato de los tres endpoints; capturas de UI de las dos páginas (mesa de entrada/gerente y alumno) y de los dos puntos de entrada wireados (banner y `TurnoPagoCard`), comparadas contra las imágenes de esta HU.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar, incluyendo las 14 decisiones de 0.4 (1 a 9 del borrador original, 10 a 14 agregadas tras el relevamiento de Claude Code).
- [ ] `leerComprobante`, `leerComprobanteDeAlumno`, `comprobanteDelPagoEnOperacion` (movida sin reescribir) y `comprobanteDelPago` (wrapper async nuevo) implementados en `comprobante.lectura.ts`; ninguno reimplementa lógica que ya resuelven `pago.vigente.ts` o `pago.publico.ts`.
- [ ] Los tres Route Handlers responden `{ data, error }` con los status codes de 2.9.5, reusando `respuestaDeError`.
- [ ] Entradas `comprobantes: ["MESA_ENTRADA", "GERENTE"]` y `"mis-pagos": ["ALUMNO"]` agregadas a `rutas-por-rol.ts`.
- [ ] `TurnoPagoCard` y el banner de éxito de HU-I-10 wireados con el link al comprobante, sin tocar nada más de esos archivos.
- [ ] `PagoDeTurno`/`PagoRegistradoTurno` extendidos con `comprobante`, sin romper los consumidores existentes de `listarPagosDeTurno` — correr sus tests, no solo los nuevos.
- [ ] Textos nuevos agregados a `textos.ts`, ninguno hardcodeado en componentes.
- [ ] Botón "Imprimir" funcional: solo el comprobante se ve al imprimir, sin librería de PDF.
- [ ] Ningún cambio en `comprobante.service.ts`, `comprobante.schema.ts`, `operacion.service.ts`, `errores-dominio.ts` ni `prisma/seed.ts`.
- [ ] Ningún link agregado hacia el historial del alumno (HU-I-02) ni "Mis pagos" (HU-I-05): esas pantallas no existen todavía.
- [ ] Ningún botón "Corregir"/"Anular" agregado (HU-I-06, fuera de alcance).
- [ ] Tests de los 3 niveles en verde, con evidencia.
- [ ] PR con diff acotado exclusivamente a esta HU.
