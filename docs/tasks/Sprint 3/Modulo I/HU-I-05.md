# TASK: HU-I-05 — Consultar propio historial de pagos

**Módulo:** I (Pagos) · **Sprint:** 3 · **Responsable:** Cali · **SP estimado:** 1.
**Rama:** `feature/HU-I-05`, en copia/worktree propio.
**Estado:** Fase 1 aprobada el 14/10/2026; Fase 2 implementada. Criterio de impresión/PDF verificado mediante automatización y prueba manual informada por el usuario el 14/10/2026; los timeouts de `claves-textos.test.ts` y la suite general no aprobada íntegramente siguen documentados. Ver §6 y evidencia.
**Base relevada:** copia local del repositorio `agustincalisaya/noctium`, HEAD y referencia local `develop` en `4d1d275de2a479592b7064680896b998a3ad7088` (13/10/2026). No se consultó ni actualizó el remoto; Claude debe revalidar su base antes de implementar, preservando trabajo paralelo.
**Contrato de referencia:** `docs/specs/spec_modulo_I.md` §2.15 (contrato principal ya escrito), §2.13.1/2.13.2 (consulta y opciones compartidas), §2.17 (fachadas), §2.6.2 (valores vigentes), §2.9.3/2.9.4/2.9.5 (comprobante propio), §3.6/3.9/3.13/3.17 y §4. `docs/tasks/Sprint 3/HU-Sprint-3.md`, HU-I-05; tasks HU-I-02, HU-I-06, HU-I-11 y HU-I-12; `docs/RULES.md`, `docs/DESIGN.md`, `docs/adicionales/sdd-metodologia.md`.
**RBAC:** `pagos:leer_propios` y `comprobantes:leer_propios`, exclusivos de ALUMNO y ya sembrados. No agregar permisos ni ampliar `pagos:leer` al alumno.
**Schema:** ya completo; sin migración ni cambios a `schema.prisma` o al seed base.
**Prototipos:** `C:\Users\agust\Desktop\Imagenes HU\HU-I-05\`, archivos `"Mis pagos".png` y `"Comprobante visto por el alumno".png` (nombres indicados por el usuario). Se inspeccionaron las dos imágenes adjuntas; verificar los nombres exactos en Windows antes de abrirlas.

---

## 0. Relevamiento previo a implementación (Claude Code)

Primero leer §2.15 de la spec y verificar el scaffolding, antes de proponer componentes o contratos nuevos. Leer completos RULES, DESIGN, metodología, template real y las tasks relacionadas. Reportar **archivos nuevos**, **archivos existentes a modificar** con ruta exacta y cambio acotado, dependencias reutilizadas, pruebas y contradicciones genuinas. **Esperar el OK explícito del usuario antes de escribir código**, aunque no haya preguntas abiertas. La autorización dada para otras HUs no autoriza la implementación de esta.

### 0.1. Ya existe en la base relevada (no crear de nuevo)

1. **Contrato §2.15:** `GET /api/mis-pagos`, `GET /api/mis-pagos/opciones`, permiso propio, identidad por sesión, filtros, 10 filas, total completo y proyección reducida. No hace falta diseñar otro contrato de historial.
2. **HU-I-02:** `src/server/pagos/pago.publico.ts` exporta `listarPagosDeAlumno(alumnoId, filtros?, db?)`, que lee solo operaciones del pagador, conserva anulados y usa monto/fecha/forma vigentes. Ordena por fecha de pago, registro e id descendentes. `pago.service.ts` implementa `listarHistorialDePagos` y `obtenerOpcionesHistorialPagos`; ya compone clases en lote, filtra materia, suma con Decimal y pagina en memoria. No llamar al endpoint administrativo desde el alumno ni construir primero su DTO interno para recortarlo.
3. **Fachadas:** B publica `obtenerAlumnoDeUsuario` en `src/server/alumnos/alumno.publico.ts`; C publica `obtenerClasesBasicas` en `src/server/turnos/inscripcion.publico.ts` (ubicación real, aunque algunas referencias históricas dicen `turno.publico.ts`). No duplicar funciones ni consultar tablas de B/C desde I.
4. **HU-I-06 mergeada:** registros compensatorios y lecturas de valor vigente/anulación funcionan en el módulo. Su task contiene relevamientos históricos anteriores a la implementación: no tratarlos como estado actual. Para esta HU alcanza reutilizar las lecturas; no modificar corrección, anulación, caja ni reapertura de reserva.
5. **HU-I-11 completa en código:** existen `src/app/(dashboard)/mis-pagos/[id]/comprobante/page.tsx`, `src/app/api/mis-pagos/[id]/comprobante/route.ts` y su test; `src/server/pagos/comprobante.lectura.ts`; `src/components/pagos/comprobante-card.tsx`; estilos de impresión en `src/app/globals.css`. El `[id]` es **pago_id**, no comprobante.id. El servidor comprueba dueño y omite `registrado_por` y el motivo de anulación; devuelve `registrado_en_el_centro: true`. Verificar extremo a extremo, no asumir que los tests existentes cierran los diferidos.
6. **Protección de rutas:** `src/server/shared/rutas-por-rol.ts` ya tiene `"mis-pagos": ["ALUMNO"]`; `src/proxy.ts` ya incluye `/mis-pagos/:path*`. Mantenerlos, sin entradas duplicadas. Cada página nueva exige su permiso en servidor.
7. **Lo que falta:** no existen `src/app/(dashboard)/mis-pagos/page.tsx`, `src/app/api/mis-pagos/route.ts`, `src/app/api/mis-pagos/opciones/route.ts` ni esta task antes de su redacción. No se encontraron `listarMisPagos` ni schemas de query propia. El Sidebar del alumno tiene Mis clases y Solicitar clase; **no tiene Mis pagos**.
8. **Template:** la ruta solicitada `docs/tasks/templates/_template-HU.md` no existe en esta base; el archivo real leído es `docs/templates/_template-HU.md`. Sus ejemplos antiguos de `lib/services` y actions dentro de `app` no prevalecen sobre RULES N.° 11.
9. **Mapa de pantallas:** no se encontró `docs/adicionales/mapa-pantallas-sprint-3.md` en esta base. La spec lo cita: no inventar su contenido. Usar §2.15, las imágenes y las decisiones cerradas de HU-I-11; relevar si apareció en la nueva base.
10. **Stack real:** RULES y `package.json` fijan Next.js 16.3.8/App Router, React 19 y Zod 4. Conservar las versiones del repo. El contexto de cátedra Next.js 15 no implica una migración de este proyecto. Leer AGENTS y las guías locales requeridas antes de implementar.

### 0.2. Archivos nuevos propuestos (revalidar en Fase 1)

| Ruta exacta | Propósito |
|---|---|
| `src/app/api/mis-pagos/route.ts` | GET listado propio, query estricta y permiso |
| `src/app/api/mis-pagos/opciones/route.ts` | GET materias propias, sin alumno en query |
| `src/app/(dashboard)/mis-pagos/page.tsx` | Entrada Server Component con `exigirPermiso` |
| `src/app/(dashboard)/mis-pagos/mis-pagos.tsx` | Filtros, carga, vacíos y paginación del alumno |
| `src/app/(dashboard)/mis-pagos/tabla-mis-pagos.tsx` | Tabla reducida, anulados y enlaces a comprobante |
| `src/lib/mis-pagos-listado.ts` | Query/URL de presentación; reutilizar formatos existentes |
| `src/server/pagos/pago.mis-pagos.test.ts` | Consulta propia, proyección, totales y opciones |
| `src/server/pagos/pago.mis-pagos.pg.test.ts` | Integración con lecturas/compensatorios reales y aislamiento |
| `src/app/api/mis-pagos/route.test.ts` | Contrato del listado y autorización |
| `src/app/api/mis-pagos/opciones/route.test.ts` | Contrato de opciones y autorización |
| `src/app/(dashboard)/mis-pagos/mis-pagos.test.tsx` | Filtros, paginación, vacíos y enlaces |
| `src/components/layout/Sidebar.mis-pagos.test.tsx` | Acceso solo del alumno, activo también en comprobante |
| `docs/testing/Modulo I/hu-i-05/HU-I-05.postman_collection.json` | Contratos propios y negativos de acceso |
| `docs/testing/Modulo I/hu-i-05/HU-I-05.sql` | Lecturas de verificación no destructivas |
| `docs/testing/Modulo I/hu-i-05/HU-I-05-evidencia.md` | Resultados, capturas y cierre de diferidos |

Las capturas y un eventual test de navegación completo se enumeran con rutas exactas en el informe de Fase 1, según las herramientas existentes. No crear un framework de pruebas nuevo.

### 0.3. Archivos existentes a modificar (plan acotado)

| Ruta | Cambio previsto |
|---|---|
| `src/server/pagos/pago.schema.ts` y `src/server/pagos/pago.schema.test.ts` | Queries propias estrictas; conservar las anteriores |
| `src/server/pagos/pago.service.ts` | `listarMisPagos` y `obtenerOpcionesMisPagos`; reutilización interna mínima para materia/total/paginación sin cambiar HU-I-02 |
| `src/types/pago.types.ts` | DTO propio y opciones; sin reutilizar el DTO administrativo en el cliente |
| `src/components/layout/Sidebar.tsx` | Enlace Mis pagos dentro de Mi cuenta del ALUMNO |
| `src/lib/textos.ts` | Claves `ui.pagos.propios.*`; reutilizar textos comunes/comprobantes |
| `docs/DESIGN.md` | Nota/fila aditiva de listado propio, consulta sin toast, comprobante existente y paginación fija |
| `docs/tasks/Sprint 3/Modulo I/HU-I-05.md` | Registrar relevamiento autorizado, decisiones y resultados reales al finalizar |
| `docs/validacion/Sprint 3/HU-I-11.md` | Anotar cierre exclusivamente de los tres diferidos con referencia a evidencia; preservar hallazgos históricos ajenos |

**Condicionales:** ampliar `comprobante.lectura.test.ts`, `comprobante.lectura.pg.test.ts`, `src/app/api/mis-pagos/[id]/comprobante/route.test.ts` o `comprobante-card.test.tsx` solo para cubrir huecos reales. Si la nueva evidencia descubre un defecto de la vista propia que impide un criterio, reportar y delimitar la corrección en Fase 1. No reescribir HU-I-11. No es necesario agregar una nota a RULES si las reglas vigentes ya cubren la HU; cualquier sincronización normativa justificada será aditiva y relevada.

### 0.4. Decisiones contractuales existentes (no volver a preguntar)

1. **Identidad por sesión:** nunca aceptar el alumno elegido por cliente. §2.15 rechaza `alumno_id` y cualquier campo extra con **400**. El intento de usar el historial administrativo devuelve **403 SIN_PERMISO**; comprobante ajeno, **403 FUERA_DE_ALCANCE**. Así se operacionaliza el criterio 4 sin contradecir la query estricta ya aprobada. No introducir una excepción de 403 para ese campo ni imitar contratos de otras HUs.
2. **Proyección propia:** lista con campos explícitos de §2.15, sin campos internos ni llamadas a F para nombres del personal. No servir `PagoHistorialItem` y esconder sus columnas en React.
3. **Anulados y corregidos:** incluir anulados; total solo de no anulados con monto vigente. Fecha/forma vigentes de la operación, no valores originales. Mantener pagos de inscripciones canceladas/quitadas y clases pasadas/canceladas: el listado es financiero histórico.
4. **Materia y paginación:** aplicar el mismo criterio de HU-I-02; opciones de todas sus clases con pagos, **anulados incluidos**, no catálogo general ni resultados de la página actual. Orden alfabético normalizado y sin duplicados. Diez filas fijas; página fuera de rango a la última y, vacío, página 1/total_paginas 0, como HU-I-02 ya resolvió.
5. **Comprobante:** seguir la página existente, no el modal real del mock. HU-I-11 §0.4.1 ya resolvió página normal con tarjeta centrada y Cerrar/X mediante `router.back()`. Teléfono en vez de CUIT, nombre Apellido, Nombre y solo hora de inicio según sus decisiones §0.4.5/0.4.14; no reconstruir un rango ni introducir CUIT desde la foto. Imprimir usa `window.print()` y CSS existente, sin generador PDF ni email.
6. **Permisos:** dos permisos propios ya existen. No ofrecer registrar, corregir, anular, Ver detalle interno, caja ni modo Estado de pago; esos accesos siguen denegados al alumno en servidor.

### 0.5. Relevar antes de asumir

- Comparar su HEAD/base con `4d1d275`; verificar que I-02, I-06 e I-11 siguen integradas y si esta task/listado ya existen. No pisar cambios nuevos ni confiar en un inventario histórico.
- Determinar la reutilización mínima de helpers privados de I-02: puede compartir composición neutral en servidor, nunca el DTO interno ni ampliar fachadas de otros módulos por comodidad. Dar lista exacta de funciones/archivos afectados.
- Confirmar `fechaCalendarioValidaSchema`: **transforma string a Date UTC**. Comparar fechas con `getTime()` y convertir a fecha civil con el helper/patrón del historial; no comparar Date como string ni desplazar un día según la zona del navegador.
- La spec fija la ruta de opciones pero no un ejemplo de su sobre: propuesta de esta task `data: { materias: [{ id, nombre }] }`, sin formas de pago. Exponerla en el informe de Fase 1 para aprobación junto al inventario.
- Validación real: `respuestaDeValidacion` hoy devuelve **400 `VALIDACION`** con `detalles: flatten()`, no `VALIDATION_ERROR`. Reutilizarla; no cambiar el helper global para uniformar historias ajenas.
- Confirmar manejo de query vacía/URL inválida con precedentes del proyecto, conservación de filtros al volver y descarte de respuestas obsoletas. Copiar la mecánica funcional de I-02 sin acoplarse a su UI interna.
- Confirmar que el número de comprobante enlaza por **pago_id** en anulados, corregidos y operaciones multi-clase. `comprobante.id` identifica el documento y no es el parámetro de la ruta propia.
- Identificar datos y herramientas reales para pruebas con dos alumnos que comparten clase, varias materias, más de diez pagos y anulaciones totales/parciales. Nunca resetear una BD compartida ni asumir los ids/fechas de un informe anterior.
- Registrar las contradicciones nuevas que cambien alcance/contrato en Fase 1. Una vez aprobadas, no volver a preguntar decisiones cerradas.

### 0.6. Resoluciones de la Fase 1 (DECISIONES RESUELTAS, 14/10/2026 — no relevar de nuevo)

Relevamiento aprobado explícitamente por el usuario antes de escribir código.

1. **Base y rama:** el usuario creó `feature/HU-I-05` desde `origin/develop` actualizado (`e3ea18d`). El diff `4d1d275..e3ea18d` (HU-C-27, HU-I-10 observaciones PO, HU-B-07, botones destructivos, informes) no toca pagos/comprobantes/Sidebar del alumno/rutas/proxy/CSS de impresión; agrega `docs/adicionales/mapa-pantallas-sprint-3.md` (solo HU-C-27, sin fila de Mis pagos) e índices de turnos. No cambia supuestos de esta HU. `noctium-codex`/`feat/HU-N-01` no se tocan.
2. **Opciones:** `{ data: { materias: [{ id, nombre }] }, error: null }`, sin formas de pago, con el universo propio de §4.3.
3. **Reutilización:** se extraen `pagosConClase` y `totalNoAnulados` como funciones privadas neutrales de `pago.service.ts`, usadas también por `listarHistorialDePagos` sin cambiar su comportamiento ni contrato. Se reutilizan `paginarHistorial`, `POR_PAGINA_HISTORIAL`, `ordenarNombre` y `fechaQuery`. Sin cambios de fachadas ni uso del DTO administrativo.
4. **UI:** «Mis pagos» se agrega después de «Solicitar clase» en Mi cuenta (el Sidebar real no tiene «Mi historial», a diferencia del prototipo; fuera de alcance). Clase = materia + «Mar 13/10» (`diaAbreviadoYFecha`), sin hora. Montos con `monto()` de `turno-detalle` (centavos solo si existen, como el comprobante). «Anulado» con el aspecto de «Cancelado» (DESIGN §6.4, I-06) y monto tachado. Total «Total pagado del período». Una sola página oculta el paginador completo (DESIGN §8.1). URL inicial normalizada (fechas inválidas/invertidas descartadas, página inválida → 1, parámetros desconocidos ignorados). Cuenta ALUMNO sin ficha: error inline del 404, sin redirección. Se prueba que volver del comprobante conserva filtros y página.
5. **Dependencias/E2E:** `npm ci` si `package.json` y el lock están sincronizados, sin modificarlos; Playwright con el Chrome del sistema (`channel: "chrome"`), sin descargar navegadores. Archivos E2E en `scripts/testing/hu-i-05-*`, `scripts/testing/run-hu-i-05.mjs` y `playwright.hu-i-05.config.ts`, con base descartable.
6. **Comprobante `null`:** la UI muestra «—» como defensa, pero eso no cierra el criterio 7: se investiga el origen y todos los pagos válidos de la verificación deben abrir su comprobante correcto.
7. **Regresión PostgreSQL I-02:** su test exige `127.0.0.1:55434`; no se cuenta como aprobado si se saltea. Se intenta en un entorno aislado compatible; si no es posible, se documenta el bloqueo y la cobertura efectiva.
8. **Impresión:** evidencia automatizada con `emulateMedia('print')`, captura y `page.pdf()`, más verificación de que el botón invoca `window.print()`. Eso no certifica el diálogo nativo: en Fase 1 su prueba manual quedó pendiente; el usuario informó su ejecución el 14/10/2026, según §6.3 y la evidencia.

---

## 1. Nota de alcance

HU-I-05 es una **consulta propia** sobre las lecturas de HU-I-02 y el comprobante de HU-I-11. HU-I-06 ya provee los valores compensatorios/anulados; no hay que implementar otra regla. Se construyen los dos GET propios, la pantalla del alumno y su navegación, y se verifican tres integraciones diferidas de HU-I-11.

**Fuera de alcance (explícito):** registro, corrección y anulación; historial interno de cambios/motivos/actores; gestión de caja; reserva/vencimiento/cancelación y parámetros N; modo Estado de pago; filtros por forma o estado; pagos online/SDK Mercado Pago; emisión/reemplazo/numeración de comprobantes, PDF por servidor/email; migraciones, seed base, rediseño global y nueva arquitectura de modales. Mercado Pago en la foto es un nombre del catálogo, no una integración.

No cerrar aquí hallazgos ajenos de la validación de I-11 (por ejemplo, el atajo administrativo de cobro). Una falla descubierta de privacidad, dueño o impresión propia sí afecta esta entrega y debe informarse/corregirse con alcance mínimo.

---

## 2. Historia de Usuario

**Como** alumno, **necesito** ver los pagos que tengo registrados en el centro, **para** controlar lo que aboné sin tener que consultarlo en mesa de entrada.
**SP estimado:** 1.

### Criterios de aceptación

1. Mis pagos muestra Fecha de pago, Materia y fecha de la clase, Monto y Forma de pago del alumno autenticado como pagador. Los anulados llevan «Anulado», no suman y su comprobante omite el motivo de anulación (PO 04/10/2026, HU-I-11).
2. Fecha de pago descendente, diez filas por página, total del resultado y filtros combinables por rango de fechas y materia de sus clases pagadas (PO 05/10/2026).
3. No mostrar usuario registrador ni pagos de otros alumnos del mismo turno.
4. Resolver alumno por sesión en servidor; rechazar consultas ajenas con 403 según los casos de §0.4.1.
5. Sin pagos: «Todavía no tenés pagos registrados».
6. Solo consulta; sin registrar, corregir ni anular.
7. Cada pago permite ver e imprimir el comprobante; el diálogo del navegador permite guardar PDF.

El texto literal completo del backlog permanece en `HU-Sprint-3.md`, sección HU-I-05.

---

## 3. Alcance de esta task

- Backend y frontend de §2.15, reutilizando lecturas públicas y contrato de comprobante propio.
- Resolución de ficha por sesión, filtros de fecha/materia, orden estable, total Decimal y paginado fijo.
- DTO explícito mínimo; prueba negativa de campos sensibles y pagos ajenos.
- Menú del alumno, estados de carga/error/vacío, URL y enlace por pago al comprobante existente.
- Tres niveles de testing, prueba visual/impresión y matriz de cierre de siete criterios más tres diferidos.
- Evidencia real; todos los checks de implementación comienzan pendientes.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/pagos/pago.schema.ts`, ampliación aditiva:

```typescript
export const MisPagosQuerySchema = z.object({
  desde: fechaCalendarioValidaSchema.optional(),
  hasta: fechaCalendarioValidaSchema.optional(),
  materia_id: z.string().trim().min(1).optional(),
  pagina: z.coerce.number().int().positive().default(1),
}).strict().refine(
  (q) => !q.desde || !q.hasta || q.desde.getTime() <= q.hasta.getTime(),
  "Desde no puede ser posterior a Hasta",
);
export type MisPagosQuery = z.infer<typeof MisPagosQuerySchema>;
export const OpcionesMisPagosQuerySchema = z.object({}).strict();
```

Usar los imports existentes. Fechas inclusive sobre **fecha de pago vigente**, no fecha de clase ni momento de registro. Los vacíos del formulario se omiten en la URL; una fecha vacía enviada directamente no se convierte en fecha válida. Rechazar `alumno_id`, `forma_pago_id`, `estado_pago`, `por_pagina` y cualquier extra. No aceptar tamaño de página configurable.

### 4.2. Servicio de listado

**Archivo:** `src/server/pagos/pago.service.ts`.
**Firma propuesta:** `listarMisPagos(usuarioId: string, query: MisPagosQuery): Promise<MisPagosData>`; el usuario proviene del permiso/sesión del servidor, nunca de query/body.

1. Resolver `obtenerAlumnoDeUsuario(usuarioId)` por fachada B; sin ficha, `404 ALUMNO_NO_ENCONTRADO` conforme §2.15.
2. Leer `listarPagosDeAlumno(alumno.id, { desde, hasta })`, convirtiendo las fechas validadas como hace I-02. Conserva solo el pagador, incluidos anulados y pagos históricos sin inscripción vigente.
3. Obtener clases básicas en **lote** por fachada C; aplicar materia en servidor. Una materia ajena/inexistente válida produce resultado vacío, nunca amplía el universo ni accede a pagos ajenos. Una clase faltante es inconsistencia: no inventar datos ni silenciar el pago.
4. Conservar orden de la lectura pública: fecha de pago, momento de registro e id descendentes. Compartir helpers neutrales si hace falta sin cambiar contratos administrativos.
5. Sumar con Decimal los montos vigentes no anulados de **todos** los filtrados antes de paginar; devolver string con dos decimales. Todos anulados o vacío: `"0.00"`.
6. Paginar diez filas con el comportamiento ya aprobado de I-02. Anulados cuentan como filas del paginador.
7. Construir por allowlist el DTO de §2.15. Nunca devolver precio, monto_original, ajuste/motivo, actores, registrado_en/por, cajas, operación, historial de cambios ni puede_corregir. No llamar a `listarHistorialDePagos` y borrar sus campos para fabricar la respuesta propia.

**Tipos:** agregar `MisPagoItem`, `MisPagosData` y `OpcionesMisPagos` en `src/types/pago.types.ts`; puede reutilizar `PaginacionHistorialPagos` porque no expone datos internos. Forma exacta:

```typescript
type MisPagoItem = {
  pago_id: string;
  fecha_pago: string;
  clase: { fecha: string; hora_inicio: string; materia: { id: string; nombre: string } };
  monto: string;
  forma_pago: { id: string; nombre: string };
  anulado: boolean;
  comprobante: { id: string; numero: string } | null;
};
type MisPagosData = {
  total_pagado: string;
  items: MisPagoItem[];
  paginacion: { total: number; pagina_actual: number; total_paginas: number; por_pagina: 10 };
};
type OpcionesMisPagos = { materias: { id: string; nombre: string }[] };
```

`null` de comprobante conserva compatibilidad con la lectura compartida, pero un pago real emitido debería tenerlo: no dar por satisfecho el criterio 7 con un enlace faltante. Documentar/corregir la inconsistencia pertinente, sin inventar número/documento.

### 4.3. Servicio de opciones

**Firma propuesta:** `obtenerOpcionesMisPagos(usuarioId: string): Promise<OpcionesMisPagos>` en el mismo service.

Resolver ficha con la misma regla 404; leer sus pagos sin filtros; obtener clases en lote, deduplicar materias por id y ordenar con la normalización de I-02. Incluye materias con pagos anulados, clases históricas e inscripciones canceladas/quitadas; excluye materias que solo pagó otro alumno y materias solo reservadas. No cambia según página ni filtros actuales. Reutilizar composición neutral, sin devolver formas ni catálogo general.

### 4.4. Route Handlers y errores

| Ruta | Permiso | Entrada / salida |
|---|---|---|
| `GET /api/mis-pagos` | `pagos:leer_propios` | Query §4.1 → `{ data: MisPagosData, error: null }` |
| `GET /api/mis-pagos/opciones` | `pagos:leer_propios` | Query estricta vacía → `{ data: OpcionesMisPagos, error: null }` |
| `GET /api/mis-pagos/[id]/comprobante` (existente) | `comprobantes:leer_propios` | idPago → proyección del alumno de §2.9.3 |

Nuevos GET: `withPermission`, query Zod antes del servicio, usuario de `req.auth!.user.id`, helpers `respuestaDeValidacion`/`respuestaDeError`. Respuestas personales sin cache compartida (`Cache-Control: no-store`); no crear caches por URL que mezclen sesiones. No editar el helper global por esta HU.

| HTTP | Código / caso |
|---|---|
| 400 | `VALIDACION` + `detalles: flatten()` del helper actual; fechas/rango/página/extra inválidos |
| 401 | Sesión inexistente o inválida, según wrapper vigente de A |
| 403 | `SIN_PERMISO`: rol sin permiso propio o alumno intentando APIs administrativas |
| 404 | `ALUMNO_NO_ENCONTRADO`: cuenta válida de alumno sin ficha en los dos GET nuevos |
| 403 | `FUERA_DE_ALCANCE`: comprobante de un pago de otro alumno; endpoint existente también usa este error para cuenta sin ficha |
| 404 | `PAGO_NO_ENCONTRADO` / `COMPROBANTE_NO_ENCONTRADO`, según lectura existente del comprobante |

La diferencia de cuenta sin ficha entre listado (404 contractual) y comprobante (403 existente) es explícita; no uniformarla cambiando I-11. La página propia de comprobante redirige a `/sin-permiso` ante acceso ajeno: el **403 literal se verifica en la API**, no se exige cambiar el patrón de navegación del proyecto.

### 4.5. Server Actions, eventos y trazabilidad

No hay escritura, `revalidatePath`, nueva Server Action de mutación, eventos ni bloqueos de cobro. La página puede invocar services propios directamente con identidad de `exigirPermiso`; nunca omitir el control por acceder desde Server Component. Lecturas no alteran pagos, compensatorios, inscripciones, cajas, parámetros ni comprobantes. Auditoría ya existente se preserva; no inventar eventos de consulta como requisito de RULES N.° 2.

---

## 5. Frontend

### 5.1. Pantalla y menú

`/mis-pagos`, página normal del dashboard, con `exigirPermiso("pagos:leer_propios")`. Agregar únicamente el enlace **Mis pagos** en Mi cuenta del ALUMNO; mantener su orden restante y activarlo también en `/mis-pagos/[id]/comprobante`. No duplicar proxy/rutas ni habilitar otras pantallas por rol.

Usar la imagen Mis pagos como referencia: título, leyenda «Los pagos que tenés registrados en el centro. Los anulados no suman al total.», Desde/Hasta/Materia y total a la derecha; tabla Fecha de pago / Clase / Monto / Forma de pago / Comprobante; pie con rango de filas y Pagination existente. Reutilizar tokens, formatos y componentes del repo; no escribir colores directos ni nuevas variantes globales.

- Clase muestra materia y fecha (hora de inicio disponible si el patrón existente la requiere); no necesita enlazar al detalle administrativo de turno.
- El total representa todo el resultado filtrado, no solo diez filas. Formato monetario argentino mediante utilidades existentes.
- Anulados con etiqueta textual «Anulado», atenuación/monto tachado según precedente I-06; el enlace al comprobante sigue disponible. No mostrar motivo, usuario, precio ni historial de cambios.
- Materia es selector simple con Todas y opciones propias. No hay filtros de forma/estado ni vista de deuda/saldo.
- Cambiar cualquier filtro vuelve a página 1; limpiar filtros restablece consulta completa. Fechas usan calendario civil del centro sin corrimientos.
- Conservar filtros/página en URL al navegar y volver del comprobante; descartar respuestas antiguas ante cambios rápidos. Opciones separadas del resultado filtrado.
- Carga inicial visible; error inline con Reintentar (sin informar éxito con toast); nunca representar una falla como lista vacía. Distinguir error de opciones y de listado.
- Sin pagos y sin filtros: **«Todavía no tenés pagos registrados»**. Con filtros sin resultados: «No hay pagos para los filtros elegidos» (texto existente de I-02, reutilizable). Sin páginas no ofrecer navegación inválida; una página oculta el control conforme DESIGN §8.1.
- Móvil: filtros/total se acomodan sin desbordar toda la página y tabla con scroll horizontal local. Etiquetas asociadas a inputs, encabezados de tabla, foco visible y navegación por teclado.

### 5.2. Comprobante del alumno

El número de cada fila navega a `/mis-pagos/{pago_id}/comprobante`, conservando la página/listado anterior en el historial. **No usar `/comprobantes/{comprobante.id}`**, ruta administrativa; no crear otra vista/API de impresión.

Reutilizar `ComprobanteCard`: datos emitidos, centro/teléfono, alumno/DNI, fechas, forma, tabla/total, leyenda y marcas. Mostrar **«Registrado en el centro»**; nunca el usuario ni el motivo de anulación. El listado muestra valores vigentes; el documento muestra su snapshot y marcas, no recalcula sus montos desde la lista. En operación parcialmente anulada, un pago anulado abre el último comprobante que lo incluyó, que puede estar «Reemplazado por»; no forzar «ANULADO» si quedan pagos vigentes de la operación.

Imprimir activa el diálogo nativo y CSS de I-11, dejando solo comprobante, leyenda y marcas permitidas, sin menú, botones ni datos internos. Verificar guardar como PDF. El modal, CUIT y rango horario de la foto no reemplazan las decisiones cerradas de I-11.

### 5.3. Textos y documentación de diseño

Claves nuevas `ui.pagos.propios.*`: menú, título, descripción, etiquetas Desde/Hasta/Materia/Todas, columnas, total, sinPagos, carga/error/reintento y accesibilidad. Reutilizar `ui.comun.paginacion.*`, textos de comprobante, etiqueta Anulado y vacío filtrado donde ya existen. No reordenar ni reescribir el catálogo completo.

Nota/fila aditiva prevista en DESIGN: Mis pagos = página de consulta, filtros combinados y diez filas; comprobante = página existente, impresión nativa, sin feedback de mutación. No modificar de forma global la tabla de otros listados.

---

## 6. Testing (tres niveles)

La Fase 2 se ejecutó sobre `feature/HU-I-05` (base `e3ea18d`), con resultados y límites en `docs/testing/Modulo I/hu-i-05/HU-I-05-evidencia.md`. La descripción siguiente conserva el plan de pruebas aprobado.

### Nivel 1 — Unitarios, rutas y componentes

- Schemas: fechas calendario inválidas (31/02), límites inclusivos, rango invertido, página 0/negativa/fraccionaria/texto, campos extra y query de opciones no vacía.
- Listado con más de diez filas: total completo Decimal (incluidos centavos), orden/desempates, filtro fecha+materia, segunda página, fuera de rango y vacío. Anulados cuentan como filas pero nunca al total; todos anulados total 0.
- Corrección de monto/fecha/forma se refleja en lista, filtro y total mediante lectura vigente, sin reimplementar compensatorios.
- Dos alumnos con pagos en la misma clase: sesión de A produce exclusivamente pagos/opciones de A. Proyección con comparación exacta de claves: ni datos internos de I-02 ni nombres/ids del personal, motivo, caja o pagos de B, también en errores con detalles.
- Opciones de todas las materias propias con pagos, anulados incluidos, sin duplicados, alfabéticas e independientes de filtro/página; sin materias solo reservadas o pagadas por B.
- Rutas: identidad tomada de sesión validada, permisos antes de consulta, 400/401/403/404 contractuales y sobre estándar; no confiar en el Sidebar.
- Comprobante: pago propio vigente, corregido, anulado total y anulado parcial; idPago distinto de idComprobante. A obtiene su documento; B obtiene 403. Payload propio sin `registrado_por` ni `marcas.anulado.motivo`, y UI sin esos datos. Test de `window.print()` complementa, no reemplaza prueba real de impresión.
- UI: cambios a página 1, limpiar, vacíos distintos, carga/error/reintento, respuestas antiguas descartadas, enlace y regreso conservando filtros, ausencia de acciones de escritura. Sidebar solo del alumno.
- Regresión dirigida de historial/opciones I-02, lecturas públicas/aislamiento y comprobantes I-11. No modificar la API administrativa para hacer pasar tests propios.

### Nivel 2 — API / Postman

Colección sin secretos/cookies guardadas; variables de entorno de prueba para sesiones/ids. Casos con resultados y códigos realmente ejecutados:

| Caso | Esperado |
|---|---|
| Alumno A listado, opciones, combinación de filtros y página 2 | 200, contrato reducido, solo A, total completo |
| Sin pagos / todos anulados / filtros sin coincidencias | 200; datos vacíos o filas anuladas; total correcto |
| `alumno_id=B` en listado/opciones; forma, estado, por_pagina o extra | 400 `VALIDACION`; ninguna consulta ajena |
| Fecha/rango/página inválidos | 400 con flatten en detalles |
| Sin sesión / sesión inválida en propios | 401 según A |
| Mesa, gerente o profesor contra listado/opciones propios | 403 `SIN_PERMISO` |
| Cuenta ALUMNO válida sin ficha en listado/opciones | 404 `ALUMNO_NO_ENCONTRADO` |
| Alumno contra historial/opciones administrativos y detalle interno | 403 `SIN_PERMISO` |
| Comprobante propio por idPago | 200, «Registrado en el centro», sin campos sensibles |
| A pide idPago real de B (misma clase y otra clase) | 403 `FUERA_DE_ALCANCE` |
| Pago inexistente en comprobante propio | 404 `PAGO_NO_ENCONTRADO` |
| Comprobantes tras corrección/anulación total/parcial autorizada de I-06 | 200, vigente/último que lo incluyó, marcas correctas, sin motivo |
| Alumno intenta registrar/corregir/anular o abrir comprobante administrativo | 403; sin mutación |

Confirmar `no-store` en éxitos propios. Prueba de cuenta sin ficha usa BD aislada, sin alterar cuentas reales. Si una inconsistencia no es generable por servicios de dominio, preparar fixture mínimo documentado únicamente en entorno de test.

### Nivel 3 — PostgreSQL / TablePlus y evidencia visual

- Dataset en BD aislada, fixtures mediante servicios existentes de alta/inscripción/cobro/corrección/anulación y reloj inyectable. No resetear ni modificar la BD usada por otros desarrolladores. No tocar seed base para fabricar la demostración.
- SQL de lectura compara pagos/operaciones originales, correcciones y anulaciones contra items/total filtrado; incluye pagador A/B en misma clase, varias páginas y centavos. Verificar snapshot del comprobante, numeración/enlaces de reemplazo y pertenencia al pagador.
- Antes/después de consultar e imprimir: pagos, compensatorios, inscripciones, cajas, parámetros y `Comprobante.datos` sin cambios por esta HU. Los cambios de preparación pertenecen al fixture/I-06, no a la consulta.
- Probar anulación total y parcial desde flujo autorizado I-06 y consultar como alumno; no concluir «motivo oculto» solo con un pago nunca anulado.
- Capturas de listado y comprobante en escritorio y móvil, comparadas con ambas imágenes; incluir vacío, filtros, segunda página y fila anulada. Verificar teclado, Cerrar/regreso y URL directa propia/ajena.
- Abrir vista previa de impresión real; guardar PDF de prueba y comprobar que solo sale el comprobante, sin Sidebar, lista, botones, usuario registrador ni motivo. No darla por aprobada únicamente con mock de `window.print()`.
- Ejecutar TypeScript, lint, tests dirigidos, suite adecuada y build según scripts/entorno reales; verificador de claves si corresponde. Registrar comando, resultado y fallos preexistentes separados. No corregir problemas ajenos ni afirmar checks no ejecutados.

**Evidencia:** carpeta `docs/testing/Modulo I/hu-i-05/`, colección, SQL, resultados, capturas y matriz de los siete criterios. Todo caso imposible de ejecutar queda **Bloqueado** con motivo y prueba pendiente, nunca aprobado por lectura de código.

### 6.3. Matriz de criterios de HU-I-05 — 14/10/2026

| Criterio | Resultado | Evidencia |
|---|---|---|
| 1. Datos del pagador, anulados y comprobante sin motivo | **Verificado**: listado propio y marcas sin motivo; el usuario confirmó una fila anulada en su listado local el 14/10 | `api-check-resultados.json`, `sql-evidencia.json`, capturas/PDF automatizados de anulación en `docs/testing/Modulo I/hu-i-05/`; testimonio manual sin capturas archivadas |
| 2. Orden, 10 filas, total y filtros | **Verificado**: 21 filas, tres páginas, filtros combinados y total completo | `api-check-resultados.json`, `listado-filtrado-pagina-2.png`, `pago.mis-pagos.pg.test.ts` |
| 3. Sin registrador ni pagos ajenos de la misma clase | **Verificado** por proyección exacta y alumno B en clase compartida | `api-check-resultados.json`, `pg-resultados-55434.txt` |
| 4. Sesión y rechazo de consultas ajenas | **Verificado**: query extra 400, endpoints administrativos 403 `SIN_PERMISO`, comprobante ajeno 403 `FUERA_DE_ALCANCE` | `api-check-resultados.json`, `comprobante-ajeno-sin-permiso.png` |
| 5. Estado sin pagos | **Verificado** en UI y HTTP | `sin-pagos.png`, `e2e-salida.txt` |
| 6. Solo consulta | **Verificado**: sin acciones de escritura y huellas SQL idénticas antes/después | `sql-evidencia.json`, `api-check-resultados.json` |
| 7. Ver e imprimir comprobante | **Verificado**: enlace, `window.print()`, CSS de impresión y PDF automatizados; el usuario confirmó el 14/10 vista previa normal en Edge, guardado y apertura del PDF desde el diálogo, impresión de un comprobante anulado y revisión del diálogo en Chrome y Firefox | `comprobante-propio.pdf`, `comprobante-propio-impresion.png`, `e2e-salida.txt` (automatizados); confirmación manual en `HU-I-05-evidencia.md`. Sin archivos nuevos para PDF guardado, anulado o Chrome/Firefox; las capturas Edge no se atribuyen a esos pasos |

### 6.4. Cierre explícito de verificaciones diferidas de HU-I-11

Los diferidos también figuran en `docs/validacion/Sprint 3/HU-I-11.md`; el task histórico de I-11 no enumera los tres con el mismo detalle que la solicitud actual. Esta HU los incluye expresamente y exige evidencia nueva:

| Diferido de I-11 | Prueba que debe cerrar HU-I-05 | Evidencia requerida | Estado inicial |
|---|---|---|---|
| Criterio 2: vista del comprobante del alumno | Desde fila de Mis pagos al documento propio; 21 pagos con `registrado_en_el_centro: true`, sin `registrado_por` | 14/10/2026, base `e3ea18d`, PostgreSQL/HTTP/E2E aislados: **cerrado para la vista propia**. `api-check-resultados.json`, `comprobante-escritorio.png`, `comprobante-propio.pdf` | Verificado |
| Criterio 4: 403 por comprobante ajeno | A pide pagos de B de la misma clase y de otra; API 403 `FUERA_DE_ALCANCE`, página `/sin-permiso` sin datos | 14/10/2026, base `e3ea18d`, HTTP/E2E aislados: **control de acceso verificado**. `api-check-resultados.json`, `comprobante-ajeno-sin-permiso.png`. Impresión/PDF automatizados; confirmación manual del usuario sobre Edge, PDF guardado, anulado y Chrome/Firefox en `HU-I-05-evidencia.md`, sin nuevos archivos de evidencia. | Verificado para el acceso y la impresión propia |
| Criterio 5: motivo de anulación omitido | Anulación total/parcial por I-06; marcas correctas y motivo ausente en JSON, HTML, UI y PDF/impresión automatizados | 14/10/2026, base `e3ea18d`, PostgreSQL/HTTP/E2E aislados: **cerrado para la vista propia**. `sql-evidencia.json`, `api-check-resultados.json`, capturas y PDFs de anulación. | Verificado |

Al finalizar, registrar fecha, entorno, commit/base, caso, resultado y referencia de archivo de evidencia por cada fila. Actualizar de forma aditiva la validación de I-11 para estos tres puntos; no marcar todos sus criterios ni riesgos como resueltos. Si uno queda Bloqueado, explicarlo en DoD/informe final: no se cierra ficticiamente.

---

## 7. Checklist de Definition of Done

- [x] Fase 1 con inventario final, base y contradicciones aprobada explícitamente antes de código.
- [x] Trabajo exclusivo en rama/copia `feature/HU-I-05`; preservado trabajo paralelo.
- [x] Dos GET propios, schemas estrictos, service y DTO mínimo conforme §2.15.
- [x] Alumno resuelto desde sesión; 400 extras, 403 administrativos/ajenos y 404 ficha según contrato.
- [x] Solo pagos/opciones del pagador, también si comparte clase con otros.
- [x] Valores vigentes, anulados visibles sin sumar, total completo exacto, filtros combinados y diez filas verificados.
- [x] Menú y página Mis pagos; carga/error/vacíos, URL, regreso y teclado verificados.
- [x] Sin usuario registrador, precio, motivo, caja ni historial interno en respuestas propias.
- [x] Enlace por idPago al comprobante existente; sin duplicar página/modal/API ni emisión.
- [x] Abrir comprobante desde Mis pagos y ver la vista previa nativa de un documento normal en Edge (verificación manual aportada el 14/10; capturas no archivadas).
- [x] Guardar y abrir el PDF desde el diálogo nativo; imprimir el comprobante anulado y revisar el diálogo en Chrome y Firefox (prueba manual informada por el usuario el 14/10/2026; sin archivos nuevos de esos pasos).
- [x] Diferido I-11 C2 cerrado con evidencia de vista propia desde Mis pagos.
- [x] Diferido I-11 C4 cerrado con evidencia de 403 ajeno y permisos.
- [x] Diferido I-11 C5 cerrado con evidencia de motivo ausente en JSON/UI/impresión automatizada tras anulación.
- [x] Matriz de siete criterios y tres niveles de testing ejecutados/documentados; bloqueos explícitos.
- [x] Regresiones dirigidas I-02/I-11 y checks del proyecto registrados; siete de los ocho archivos reejecutados aprobaron (199 tests), sin fallos funcionales nuevos detectados.
- [ ] `claves-textos.test.ts` completo aprobado: conserva tres timeouts internos de 60 s; solo el primero se reprodujo sobre la base `e3ea18d` (ver evidencia).
- [x] Textos centrales/tokens existentes y documentación de diseño aditiva.
- [x] Ninguna escritura de negocio al consultar; sin DELETE, migraciones ni cambios de seed base.
- [x] Diff exclusivamente de HU-I-05 y cierres diferidos; sin reformateos/cambios ajenos. El `prompt.md` preexistente queda fuera del staged.
- [x] Sin commit, push, merge, pull, rebase ni amend; entrega revisable (git add permitido).

**Reglas de git para ambas fases:** permitido status/diff/log/show/lecturas y `git add` en la copia propia; crear rama/worktree propio desde base local verificada si hace falta. Prohibidos commit/push/merge/rebase/amend/pull y comandos destructivos de limpieza/restauración del trabajo ajeno. Si la base no es la necesaria, informar la condición; no integrar ramas ni actualizar otra copia por cuenta propia.
