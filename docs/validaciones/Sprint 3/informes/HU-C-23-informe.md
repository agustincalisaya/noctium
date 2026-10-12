# Informe de validación PO — HU-C-23 · Centralizar los textos de la interfaz

**Fecha:** 12/10/2026 · **Rama revisada:** `feature/prueba` (HEAD `17f5daa`, igual a `develop`) · **Base de Sprint 3:** `bbce145` (08/10/2026)
**Fuente de verdad:** el texto de la HU que pasó el PO (coincide palabra por palabra con `docs/tasks/Sprint 3/HU-Sprint-3.md` §HU-C-23).
**Task revisada:** `docs/tasks/Sprint 3/Modulo C/HU-C-23.md` (PR #215, commit `8d9928c`).

> Validación de solo lectura: no se modificó código, tests, schema ni seed. El working tree ya tenía `prisma/seed.ts` modificado sin commitear (pasa de 40 a 52 fichas de alumnos e inscribe reservas al final); **ese cambio no es de esta HU** y conviene aclararlo antes de la prueba manual (ver §6).

### Evidencia ejecutada en esta validación

| Comando | Resultado |
| --- | --- |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador CA3) | exit 0 — "Claves de textos verificadas." |
| `npx vitest run` de los 4 archivos focales de la HU (`textos`, `claves-textos`, `pagination`, `errores-dominio`) | 4 archivos / **56 tests en verde** |
| `npx vitest run` (suite completa, sin base PG) | **250 archivos OK / 51 skipped; 3170 tests OK / 349 skipped; 0 fallos** |
| Escáner AST propio (TypeScript) sobre las líneas agregadas o modificadas desde `bbce145` en `src/` (292 archivos) | ver hallazgos de §1 (CA1) y §4 |
| `gh run list` (runs del workflow en GitHub) | **No se pudo verificar**: `gh` no está instalado en el equipo |

---

## 1. Tabla de trazabilidad

| CA | Viñeta | Dónde está implementado | Estado | Justificación |
| --- | --- | --- | --- | --- |
| 1 | Existe un **único archivo de textos** | `src/lib/textos.ts` (`TEXTOS` con 1341 claves, `ClaveTexto`, `texto(clave, valores?)`); contrato en `docs/DESIGN.md` §9 | CUBIERTO | No hay otros catálogos: las constantes `ETIQUETAS`/`TEXTOS` locales (p. ej. `historial-clases.tsx:11`, `cuenta-acceso-card.tsx:7`, `cancelar-turno-dialog.tsx:13`) guardan claves o llamadas a `texto()`, no copy. |
| 1 | Las pantallas/componentes **nuevos o modificados en Sprint 3** leen **todos** sus textos visibles del archivo y no escriben textos fijos | Infraestructura: `texto()` y `Pagination` (`src/components/shared/pagination.tsx`, 100 % catálogo `ui.comun.paginacion.*`). Consumidores: la mayoría de las pantallas del sprint (personal, indicadores, comprobante, sesión, recuperación, clases, mis clases, etc.) | **PARCIAL** | Siguen apareciendo textos fijos en componentes **creados o modificados en Sprint 3** (detalle abajo, tabla 1.a). Lo que entregó la HU (catálogo + Pagination) cumple, pero el criterio, como está escrito, no se cumple en el sistema a HEAD. |
| 1 | Incluye **menú** | `src/components/layout/Sidebar.tsx` (todas las etiquetas con `texto()`) | CUBIERTO | Las entradas nuevas (Registrar pago, Mis clases, Personal) salen del catálogo. `Navbar.tsx:39-40` conserva "Sin notificaciones configuradas todavía" (literal de Sprint 1; el archivo se tocó en Sprint 3 → ver 1.a). |
| 1 | Incluye **emails** | `src/server/sesion/recuperacion.service.ts:194-201` (asunto, saludo, cuerpo, botón, aviso, ignorar → `ui.sesion.emailRecuperacion.*`) | CUBIERTO | Es el único email nuevo del sprint. `email.service.ts:40` tiene un mensaje fijo, pero es un error técnico de configuración, no un texto visible para el usuario. |
| 1 | Incluye **impresiones** | `src/components/pagos/comprobante-card.tsx` (27 llamadas a `texto()`, incluida la ayuda de imprimir) | CUBIERTO | Sin textos fijos visibles en el comprobante. |
| 1 | Incluye **mensajes de error** del servidor que se muestran | `ErrorDeDominio(clave)` + `src/server/shared/errores-dominio.ts` (PR-0 §2.13) | **PARCIAL** | Hay servicios y schemas Zod **nuevos de Sprint 3** con mensajes fijos que llegan a la pantalla (tabla 1.a, filas "Servidor"). |
| 2 | Pantallas del sprint usan **"Clase"** | Catálogo: ningún valor contiene "turno" (`src/lib/terminologia-clases.test.ts:6-8`, en verde). Barrido de JSX y mensajes de servidor: no hay "turno" visible | CUBIERTO | "turno" solo aparece en nombres técnicos (rutas, modelos, claves `ui.turnos.*`, comentarios), como permite la convención 2. |
| 2 | Estados en **femenino (Completa, Cancelada)** | `src/types/turno.types.ts:56` (`ETIQUETA_ESTADO_TURNO` → `ui.turnos.estado.*`); `bloque-evento-calendario.tsx:12-13`; `alumno/page.tsx:229` | CUBIERTO | Las pruebas `textos.test.ts:19-23` y `terminologia-clases.test.ts:9-13` lo verifican. |
| 2 | (Interpretación de la task) | Task §1 y §5: "`ui.turnos.*` es vocabulario preparado, **sin consumidores de producción**; Pagination no muestra Clase" | **DESVÍO (resuelto)** | La task acreditó el CA2 solo con el catálogo y una prueba, sin pantalla. Hoy sí hay consumidores reales (Mis clases, calendario, sidebar, badge de estado), gracias a HU posteriores y a C-19. El criterio se cumple a HEAD, pero no lo cumplió la entrega de C-23 sola. |
| 3 | Si falta un texto, **se muestra la clave** | `src/lib/textos.ts` → `texto()`: `if (!hasOwnProperty) { console.warn(clave); return clave; }` | CUBIERTO | Probado en `textos.test.ts:11-18` (incluye `toString` para no confundirse con el prototipo). |
| 3 | …**y se registra una advertencia** sin romperse | Ídem (`console.warn(clave)`) | CUBIERTO | La advertencia queda en la consola del navegador o del servidor, según dónde se renderice. No se loguean valores ni datos personales (DESIGN §9). |
| 3 | **Prueba automática** que compara las claves usadas con las del archivo y **falla si falta alguna** | `scripts/verificar-claves-textos.ts` (análisis con símbolos de TypeScript: `texto()`, `TEXTOS[...]`, `ErrorDeDominio`, `esErrorDeDominio`, alias, ternarias, mapas, wrappers) + `src/lib/claves-textos.test.ts` (positivos, negativos y "eliminar una clave usada rompe la comprobación", línea 68) | CUBIERTO | CLI exit 0 y 56 tests focales en verde. Limitaciones aceptadas en la task (N2–N4: mutaciones por desestructuración, `for…of`, contenedores): no aparecen en `src`. |
| 3 | **Corre en cada PR** | `.github/workflows/textos.yaml` (`on: pull_request` sin filtro de ramas; corre CLI + 4 tests focales) | CUBIERTO en configuración / **sin evidencia de ejecución** | El YAML es correcto. No pude ver los runs (`gh` no está instalado). La task dejaba pendiente "run real del workflow"; el PO tiene que confirmarlo en GitHub → Actions → "Textos C-23" (ver §6). Ojo: `ci.yaml` **no** corre tests (solo lint y build), así que la única protección automática de CA3 es este workflow. |
| 4 | Cambiar un texto en el archivo lo cambia **en todas las pantallas que lo usan**, sin tocar código | Toda la UI lee con `texto(clave)` en cada render; `pagination.test.tsx` cambia el valor central, vuelve a renderizar y restaura | CUBIERTO (con observación) | Se cumple **por clave**. Pero el "para" de la HU ("que un cambio de término se aplique en todo el sistema a la vez") se debilita: el mismo término está repetido en varias claves (`"Reintentar"` ×9, `"Cancelar"` ×8, `"Materia"` ×8, `"Volver"` ×4 + 1 fijo en C-25…). Cambiar "Volver" en el archivo **no** cambia el diálogo común de confirmación, porque ese texto está fijo en el código. |

### 1.a Textos fijos en código creado o modificado en Sprint 3 (incumplen CA1 y la DoD de su HU)

Línea agregada o modificada desde `bbce145`, atribuida con `git blame`:

| HU responsable | Archivo:línea | Texto fijo |
| --- | --- | --- |
| **HU-C-25** (componente nuevo, usado en unas 24 operaciones) | `src/components/shared/confirmar-accion-dialog.tsx:9-12` | "Volver", "Procesando…", "Esta acción no se puede deshacer.", "No se pudo completar la acción. Intentá nuevamente." |
| HU-L-06 | `src/app/(dashboard)/materias/[id]/page.tsx:84, 87, 95, 102` | "Materia actualizada correctamente", "Modificar", "Activa"/"Inactiva", "Sin profesores asociados" |
| HU-L-06 | `src/app/(dashboard)/materias/page.tsx:40` (y en el mismo componente: 35, 49, 77, 92, 98, 111-115, 140) | "Materias", "Nueva materia", "Cargando materias", encabezados de tabla, "Activa"/"Inactiva" |
| HU-E-04 | `src/app/(dashboard)/alumnos/[id]/historial-academico.tsx:83, 91, 141` (y 47-53, 70, 96, 121-132) | "Filtrar historial por materia", "Materia: Todas", "Clase dictada", "Examen", "Cargando historial…", "Reintentar", mensajes de vacío y error |
| HU-A-06 | `src/app/(dashboard)/alumnos/page.tsx:32` (y 40-45, 53, 55, 66, 90) | "Alumno registrado correctamente", "Los datos de contacto no se guardaron…", "Alumnos", "Nuevo alumno"… |
| HU-I-07 | `src/app/(dashboard)/formas-pago/formas-pago-interactivas.tsx:248, 251` (y 25-26, 144-187) | aria-label "Editar {forma}", "Desactivar/Reactivar {forma}", formulario "Nueva forma de pago" |
| HU-I-07 | `src/app/(dashboard)/alumnos/[id]/ficha-alta-pago.tsx:37, 44, 51-52` | "Fecha de alta y forma de pago", "Editar forma de pago", "Forma de pago preferida", "Sin preferencia" |
| HU-I-10 | `src/app/(dashboard)/pagos/registrar/registrar-pago-wizard.tsx:24` | "No se pudo completar la acción. Intentá nuevamente." |
| HU-I-10 | `src/app/(dashboard)/turnos/buscador-alumnos.tsx:57` (y 54, 58) | "Buscando…", "No se encontraron alumnos activos para agregar", "resultado"/"resultados", placeholder, "Resultados de alumnos", "· DNI" |
| HU-H-06 | `src/components/indicadores/graficos-indicadores.tsx:7` | Meses "Ene"…"Dic" |
| HU-C-19 / C-24 (líneas tocadas en Sprint 3) | `turnos/[id]/asignar-prioridad-dialog.tsx:68`, `turnos/turno-configuracion.tsx:365`, `turnos/[id]/registrar-pago-dialog.tsx:208`, `turnos/nuevo/turno-wizard.tsx:380`, `turnos/paso-alumnos-turno.tsx:28`, `turnos/seccion-aula-turno.tsx:39` | "Guardando…", "Registrando…", "alumno"/"alumnos" |
| Servidor — HU-E-04 | `src/server/historial/indicacion.service.ts:23, 30`; `indicacion.schema.ts:4-5` | "No tenés permiso para registrar indicaciones", "Solo podés registrar indicaciones en materias…", "Seleccioná una materia", "La indicación es obligatoria", "Máximo 1000 caracteres" |
| Servidor — HU-E-02 | `src/server/historial/clases-alumno.service.ts:25, 27` | "No tenés permisos para consultar las clases de este alumno", "No se encontró el alumno" |
| Servidor — HU-E-11 / E-07 / E-10 | `clase-dictada.schema.ts:11, 14`; `observacion-clase.schema.ts:3`; `resultado-examen.schema.ts:5, 19, 28`; `resultado-examen.service.ts:171` | "El motivo es obligatorio", "Máximo 300/1000 caracteres", "La nota debe ser un número…", "No tenés permisos para corregir…" |
| Servidor — HU-I-07 / I-10 / A-06 | `pagos/forma-pago.schema.ts:15-16`; `pagos/pago.schema.ts:8-9, 18-19, 37, 57-60`; `usuarios/cuenta.schema.ts:5-6, 10` | mensajes de validación Zod ("El monto debe ser mayor a cero", "Elegí al menos una clase", "Ingresá un email válido"…) |

**Componentes modificados en Sprint 3 que conservan textos anteriores sin migrar** (por la definición del CA1, "componente modificado" cuenta como pantalla nueva; además son pendientes de HU-C-19). Cantidad de textos fijos visibles en cada uno: `alumnos/[id]/editar/editar-alumno-form.tsx` (31), `alumnos/nueva/alumno-form.tsx` (24), `profesores/[id]/editar-profesor-form.tsx` (22), `materias/page.tsx` (12), contacto de alumno y de profesor (10 cada uno), `profesores/nuevo/nuevo-profesor-form.tsx` (8), `alumnos/[id]/forma-pago/forma-pago-form.tsx` (8), `login-form.tsx` (6), `login/page.tsx` (5), `turnos/[id]/turno-pago-card.tsx` (5), `reprogramar-turno-dialog.tsx:180` ("Reprogramando…"/"Reprogramar"), `types/turno.types.ts:58` (prioridad "Normal/Alta/Urgente").

> El backlog (justificación de secuencia de C-23) aclara que C-23 "se verifica con las pantallas que existen al mergearla" y que el cumplimiento posterior pasa a la DoD de cada HU (convención 9). Por eso estos hallazgos **se imputan a las HU responsables**, no al código de C-23. Igual se informan aquí porque el CA1, leído literalmente, describe el estado del sistema.

**DESVÍO de la task en CA1:** la task acotó el CA1 a "el paginador, único componente nuevo al momento de la entrega" (§0 y §5). Es coherente con la justificación del backlog, pero la HU no incluye ninguna salvaguarda automática contra textos fijos (ni regla de lint ni test): el comprobador solo valida que **las claves usadas existan**, no que **no haya literales**. Por eso los incumplimientos de 1.a pasaron todos los PR en verde. La HU no pide esa salvaguarda, así que no es un bloqueante; queda como riesgo.

---

## 2. Textos literales de los criterios

| Texto entre comillas en la HU | Clave en `src/lib/textos.ts` | ¿Coincide? |
| --- | --- | --- |
| "Desactivar profesor" | `ui.profesores.estado.desactivar` = "Desactivar profesor" (línea 499; usada en `estado-profesor-dialog.tsx:39`) | Sí |
| "Clase" | `ui.turnos.clase.nombre` = "Clase" (línea 920) | Sí |
| "Completa" | `ui.turnos.estado.completa` = "Completa" (línea 923) | Sí |
| "Cancelada" | `ui.turnos.estado.cancelada` = "Cancelada" (línea 924) | Sí |

**No hay textos que no coincidan.** Observación menor: "Completa" también está duplicado en `ui.profesores.estado.completa` (línea 563).

---

## 3. Reglas de servidor

**No aplica a esta HU.** HU-C-23 no crea ni modifica endpoints, Server Actions, permisos, transacciones ni registros (task §3; confirmado en el diff de `8d9928c`: solo `textos.ts`, `pagination.tsx`, `DESIGN.md`, el script, 3 tests y el workflow). Por eso no hay un 403 para comprobar ni hay snippet `fetch()` relevante. Las Reglas N.° 7 y N.° 8 no entran en juego.

El único "contrato" con efecto en el servidor es que `texto()` es síncrona, no importa nada exclusivo del servidor y la usan tanto el cliente como el servidor (verificado en `textos.ts`: sin imports).

---

## 4. Definición de Terminado (convención 9)

| Ítem DoD | Estado para HU-C-23 | Detalle |
| --- | --- | --- |
| Pasan todos sus criterios propios | Parcial | CA1 PARCIAL a nivel sistema (§1.a, imputable a otras HU); CA2, CA3 y CA4 cubiertos. |
| Mergeada sin romper la prueba de claves | OK | PR #215 mergeado; la CLI y la suite están en verde a HEAD. |
| Textos visibles en el archivo central | OK en lo entregado por C-23 | `pagination.tsx` no tiene textos fijos (el único hallazgo, `ellipsis-${i}`, es una `key` de React). |
| Ningún texto visible dice "turno" | OK | Test `terminologia-clases.test.ts` y barrido de JSX y servidor sin resultados. |
| Confirmación con el componente de HU-C-25 en toda operación que guarda | No aplica | C-23 no tiene operaciones que guarden. |
| Tests en verde | OK | Focales 56/56; suite completa 3170 OK, 0 fallos. Los 349 tests "skipped" son los de PostgreSQL (no se corrió `test:pg`, porque C-23 no toca persistencia). |
| Run real del workflow en el PR | **Sin verificar** | Pendiente en la task (§7, casilla sin marcar). Hay que confirmarlo en GitHub. |

**Incumplimientos de DoD de otras HU detectados al validar C-23** (para el cierre del sprint): HU-C-25, HU-L-06, HU-E-04, HU-E-02, HU-E-11/E-07/E-10 (servidor), HU-A-06, HU-I-07, HU-I-10 y HU-H-06. El detalle está en §1.a.

---

## 5. Extras y violaciones a RULES.md / DESIGN.md

**Extras (no pedidos por la HU):**
- Analizador de símbolos de TypeScript bastante sofisticado (alias, mapas, wrappers, detección de escrituras F1/N1, escapes F2/N5). Va más allá de "comparar claves", pero es razonable: evita falsos negativos.
- Namespaces `ui.<modulo>.*` y `ui.comun.*` con dueño por módulo (DESIGN §9).
- Interpolación `{nombre}` con huecos nulos que quedan intactos.
- Permisos mínimos del workflow (`contents: read`).

**Violaciones / observaciones:**
- **DESIGN §9 (dueño de namespace):** `ui.formasPago.cancelar` se usa en 6 pantallas de clases (`turno-configuracion.tsx`, `asignar-prioridad-dialog.tsx`, `registrar-pago-dialog.tsx`, `reprogramar-turno-dialog.tsx`, `participantes-turno.tsx`…), y `ui.turnos.reserva.registrarPago` se usa en el `Sidebar`. Cambiar el botón de Formas de pago cambiaría los de Clases, lo contrario del aislamiento por módulo. Lo introdujo HU-C-19, no C-23.
- **Claves de baja calidad** (de C-19): `ui.clases.profesores.noopenerNoreferrer` = "noopener noreferrer" (un atributo técnico metido en el catálogo de copy), claves con oraciones partidas (`atencionHay` + `clasesPendientesDe…`) y nombres como `…NumeroDos`. No rompen CA1-4, pero dificultan el mantenimiento.
- **Términos duplicados** en el catálogo (ver CA4): debilitan el objetivo "un cambio de término se aplica en todo el sistema a la vez".
- **CI:** `textos.yaml` usa Node 24.19.0 y `ci.yaml` usa Node 20. No es un problema funcional, pero no son homogéneos.
- RULES.md (Reglas 1-11): sin violaciones atribuibles a C-23. No toca servicios, datos ni permisos.

---

## 6. Datos para la prueba manual

Contraseña de todos los usuarios: **`Password123!`**. Para regenerar la base: `npx prisma migrate reset` (corre el seed).

> ⚠️ `prisma/seed.ts` tiene cambios locales sin commitear (52 alumnos y reservas al final). No son de esta HU. Si querés probar contra el seed de `develop`, primero guardalos (`git stash`) y después recuperalos (`git stash pop`). Para C-23 no cambia nada.

| Caso | Usuario | Dónde | Qué mirar |
| --- | --- | --- | --- |
| CA1 — paginador (componente de C-23) | `gerente@noctium.local` | Alumnos (más de 40 fichas → 3 páginas) | "Página 1 de N · X en total", "Anterior"/"Siguiente". Con F12 → Accesibilidad: "Paginación", "Página anterior", "Página siguiente". |
| CA1 — menú, emails, impresión | `mesa.entrada@noctium.local` | Sidebar; Registrar pago → comprobante → Imprimir | Las etiquetas y el comprobante salen del catálogo (para comprobarlo, ver CA4). |
| CA1 — email | (público) | `/recuperar-contrasena` con `alumno01@noctium.local` | El email simulado aparece en la consola de `next dev` con el asunto "Restablecé tu contraseña de Noctium". |
| CA1 — incumplimientos a observar | `mesa.entrada@noctium.local` / `gerente@noctium.local` | Materias → detalle de "Matemática"; cualquier acción con confirmación (botón "Volver"); ficha de alumno → Historial académico | Son textos fijos (§1.a). Se ven bien, pero **no cambian** en la prueba de CA4. |
| CA2 — "Clase" y femenino | `alumno01@noctium.local` (o `alumno02`) | Mis clases; Calendario | `seed-turno-09` (Matemática, cancelada, con alumnos 01-02) se ve "Cancelada". `seed-turno-01`/`04` llegan a "Completa" cuando se llena el cupo. No debe aparecer la palabra "turno". |
| CA2 — gestión | `mesa.entrada@noctium.local` | Clases (listado y detalle) | Estados Pendiente / Disponible / Completa / Cancelada, en femenino. |
| CA3 — clave ausente | cualquiera | ver receta abajo | La pantalla muestra la clave y hay un `console.warn` con la clave. |
| CA4 — propagación | `gerente@noctium.local` | ver receta abajo | El texto cambia en todas las pantallas que usan la clave. |

**Receta CA4 (sin tocar código de pantallas; solo el archivo de textos, y después se revierte):**
1. Con `npm run dev` levantado, editá en `src/lib/textos.ts` la línea `"ui.comun.paginacion.anterior": "Anterior",` → `"Anterior PO"`, y `"ui.turnos.estado.cancelada": "Cancelada",` → `"Cancelada PO"`.
2. Recargá Alumnos, Personal y Historial (paginador), Mis clases y Calendario (estado). Tiene que cambiar en todas sin editar ningún otro archivo.
3. Revertí con `git checkout -- src/lib/textos.ts`.

**Receta CA3 (pantalla con clave ausente + prueba automática que falla):**
1. En `src/lib/textos.ts` comentá la línea `"ui.comun.paginacion.siguiente": "Siguiente",`.
2. Recargá Alumnos como gerente: el botón muestra **`ui.comun.paginacion.siguiente`**, la página no se rompe y en la consola (F12, o la terminal de `next dev` si se renderiza en el servidor) aparece el warning con la clave. (`next dev` no frena por errores de tipos).
3. Corré `npx tsx scripts/verificar-claves-textos.ts`: tiene que salir con exit 1 e indicar `src/components/shared/pagination.tsx:<línea>: Clave de texto ausente: ui.comun.paginacion.siguiente`.
4. Revertí con `git checkout -- src/lib/textos.ts`.

**CA3 — "corre en cada PR":** en GitHub → pestaña *Actions* → workflow **"Textos C-23"**, confirmá que hay runs en verde para los PR recientes (p. ej. #245, #248). Si querés verlo fallar, abrí un PR de prueba con la receta CA3 aplicada y cerralo sin mergear.

---

## 7. Veredicto preliminar

### **Lista para prueba manual** (con observaciones)

El entregable de HU-C-23 (archivo central, fallback con advertencia, comprobador de claves, workflow por PR, propagación) funciona y está probado: CLI exit 0, 56/56 focales y suite completa en verde. Los criterios 2, 3 y 4 están cubiertos. El criterio 1 queda **PARCIAL a nivel sistema**, pero según el backlog los textos fijos detectados corresponden a la DoD de otras HU, no al código de C-23.

**Bloqueantes de HU-C-23:** ninguno de código. Un solo pendiente de evidencia:
1. Confirmar en GitHub Actions que el workflow "Textos C-23" corrió (y en verde) en los PR. No pude verificarlo localmente.

**Bloqueantes para el cierre del sprint (DoD de otras HU, para "Volver al dev" de cada una):**
1. **HU-C-25:** `confirmar-accion-dialog.tsx:9-12` tiene "Volver", "Procesando…", la leyenda de irreversible y el error genérico fijos. Es el de mayor impacto, porque aparece en todas las confirmaciones.
2. **HU-L-06:** detalle y listado de Materias con textos fijos.
3. **HU-E-04 / E-02 / E-07 / E-10 / E-11:** Historial académico y mensajes de servicios y schemas nuevos con textos fijos.
4. **HU-A-06:** banner de alta en el listado de Alumnos.
5. **HU-I-07 / I-10:** aria-labels de Formas de pago, ficha de forma de pago, buscador de alumnos, wizard de pago y schemas de pago.
6. **HU-H-06:** abreviaturas de meses de los indicadores.
7. **HU-C-19:** restos de textos fijos ("Guardando…", "Registrando…", "alumno(s)", formularios de alumno y profesor, login) y reuso de `ui.formasPago.*` en pantallas de clases.
