# TASK: HU-F-05 — Desactivar y reactivar personal de mesa de entrada

**Módulo:** F (Personal de mesa de entrada) · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 3
**Contrato de referencia:** `docs/specs/spec_modulo_F.md` §2.4 (campos que suma esta HU al detalle), §2.5 (desactivar), §2.6 (reactivar), §2.7 («Registró operaciones», DEC-39), §3.1, §3.4, §3.5, §3.6, §3.7 y §4 · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-F-05, criterios 1 a 6; HU-A-06, criterio 7) · `docs/tasks/Sprint 3/Modulo F/HU-F-01.md` y `HU-F-03.md` (sección 9: qué dejaron hecho) · `src/server/profesores/profesor.estado.service.ts` (HU-D-08, referencia a copiar) · `docs/tasks/Sprint 3/PR-0.md` §2.13 y §2.16
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figuras 93 («Ficha del integrante») y 94 («Confirmación de la baja»), **solo las páginas 84 y 85**. No muestra el aviso de caja abierta ni el flujo de reactivar. Las capturas son orientativas: ante cualquier diferencia prevalece el backlog, y la ficha ya implementada por F-01 no se reorganiza.
**RBAC:** solo **GERENTE**. Usa `personal:cambiar_estado` (desactivar y reactivar) y `personal:leer` (la ficha y `GET /api/personal/[id]`), ya sembrados en `prisma/seed.ts` y en la migración de permisos. Cualquier otro rol recibe `403 SIN_PERMISO` en el servidor (spec F §3.7).
**Schema:** ya completo, **sin migración y sin tocar `schema.prisma`**. `FichaMesaEntrada` ya tiene `activoFichaMesaEntrada`, `version` y `modificadoPorUsuarioId`; `EntidadHistorialEstado` ya incluye `FICHA_MESA_ENTRADA`.
**Rama:** `feat/hu-f-05-desactivar-reactivar-personal`, creada desde `develop` actualizado (F-01 y F-03 ya están mergeadas).
**Estado de la HU:** decisiones tomadas (sección 0); se implementa en dos etapas (sección 8).

---

## 0. Decisiones y verificaciones previas

### 0.1. Decisiones (no relevar de nuevo)

1. **Es la baja y reactivación de D-08 aplicada a una ficha con cuenta, más la regla de la caja.** Se copia el patrón de `profesor.estado.service.ts` (bloqueo de la ficha, relectura de estado y versión, `updateMany` condicionado, cuenta en la misma transacción, historial encolado) y se le suman dos reglas propias de F: caja abierta (spec F §3.4) y motivo obligatorio según «registró operaciones» (DEC-39). No hay clases futuras ni impacto que resolver.
2. **Servicio en `personal.service.ts`** (como dice la spec F §2.5 y §2.6; no se crea un `personal.estado.service.ts`): `desactivarIntegrante(id, input, actor)` y `reactivarIntegrante(id, input, actor)`, con `actor: ActorDominio` (`actorUsuario(usuarioId)`). `modificadoPorUsuarioId` se escribe solo si el actor es un usuario.
3. **Orden de la baja, dentro de una única `transaccion`** (spec F §2.5; el orden de verificaciones es el de la spec):
   1. `bloquear(tx, { recursos: { fichasMesaEntrada: [id] } })` antes de leer nada (spec F §3.4, parte 1).
   2. Releer la ficha: inexistente → `errores.personal.noEncontrado`; ya inactiva → `errores.personal.yaInactivo`; versión distinta de `input.version` → `errores.personal.conflictoEdicion`.
   3. Si la ficha tiene `usuarioId`: `cajaAbiertaDe(tx, usuarioId)` (fachada `src/server/pagos/caja.publico.ts`); si hay caja abierta → `errores.personal.cajaAbierta`.
   4. Motivo: `motivo = input.motivo?.trim() || null`. Si no hay motivo, la ficha tiene `usuarioId` y `usuarioRegistroOperaciones(tx, usuarioId)` es `true` → `errores.personal.motivoRequerido`. Si hay motivo se guarda aunque no sea obligatorio.
   5. `updateMany` con `where: { id, activo: true, version }` y `data: { activo: false, version + 1, modificadoPorUsuarioId }`; `count === 0` → `conflictoEdicion` (Regla N.° 7).
   6. Si tiene `usuarioId`: `desactivarCuenta(tx, usuarioId)`. **No se llama además a `revocarSesiones`**: `desactivarCuenta` ya la llama (la spec F §2.5 paso 6 nombra las dos funciones; el código real las junta, igual que en D-08).
   7. `registrarCambioEstado(tx, { entidad: "FICHA_MESA_ENTRADA", id, accion: "DESACTIVAR", motivo, actor })`: se escribe después del commit (Regla N.° 2, opción b).
   8. Devuelve `{ id, activo: false, version: version + 1 }`.
4. **Reactivar:** mismo bloqueo; `noEncontrado`, `errores.personal.yaActivo`, `conflictoEdicion`; `updateMany` con `activo: false` y `version`; `reactivarCuenta(tx, usuarioId)` si tiene cuenta (no restaura sesiones y conserva la marca de cambio de contraseña); `registrarCambioEstado` con `accion: "REACTIVAR"` y sin motivo. Devuelve `{ id, activo: true, version: version + 1 }`. No pide motivo.
5. **Ficha sin cuenta (`usuarioId` nulo, DEC-14).** Se puede desactivar y reactivar igual: no hay cuenta que tocar, no hay caja posible (se omite `cajaAbiertaDe`) y «registró operaciones» es `false` (nunca fue actor de nada), así que el motivo es opcional. Las 12 fichas sin cuenta del fixture de F-03 sirven para probarlo.
6. **Errores nuevos** (catálogo `src/server/shared/errores-dominio.ts` y textos en `src/lib/textos.ts`; el servicio nunca devuelve textos):

   | Clave | `code` | HTTP | Texto |
   |---|---|---|---|
   | `errores.personal.yaInactivo` | `INTEGRANTE_YA_INACTIVO` | 409 | «El integrante ya está inactivo.» |
   | `errores.personal.yaActivo` | `INTEGRANTE_YA_ACTIVO` | 409 | «El integrante ya está activo.» |
   | `errores.personal.cajaAbierta` | `CAJA_ABIERTA` | 409 | «El integrante tiene la caja abierta. Tiene que cerrarla (o hacé un cierre por ausencia) antes de desactivarlo.» (literal del backlog) |
   | `errores.personal.motivoRequerido` | `MOTIVO_REQUERIDO` | 400 | «Ingresá el motivo de la baja: el integrante registró operaciones.» **Propuesto, pendiente de validar por el PO (P-F6)** |
   | `errores.personal.motivoDemasiadoLargo` | — (mensaje del schema) | 400 | «El motivo admite hasta 300 caracteres.» (propuesto) |

   `conflictoEdicion` y `noEncontrado` ya existen (`errores.personal.*`); no se usa `errores.general.conflictoEdicion`, que no existe (nota de F-01, punto 2).
7. **Schemas** en `personal.schema.ts`, `.strict()` y con la misma forma que los de D-08: `DesactivarIntegranteSchema = { motivo?: string (trim, hasta 300; vacío = no enviado), version: entero no negativo }` y `ReactivarIntegranteSchema = { version }`. Un campo ajeno es 400 `VALIDATION_ERROR`. Los mensajes salen de `textos.ts` (a diferencia de `pagina` y `q` en F-03, que quedaron con los de Zod).
8. **«Registró operaciones» (DEC-39): se crea el agregador** `src/server/shared/actividad-usuario.ts` con `usuarioRegistroOperaciones(tx, usuarioId): Promise<boolean>`, que recorre en orden las lecturas de cada módulo dueño y corta en la primera verdadera (spec F §2.7). Esta HU lo crea con las líneas de **I, C, L y el historial de estados**; **N** la suma HU-N-01 (la tabla `historial_parametros` existe, pero la lectura y su línea son de esa HU) y G-05 lo reutiliza sin tocarlo. Cada línea es una lectura de existencia sobre las tablas del propio módulo, publicada en su fachada (Regla N.° 3); las fachadas no importan el agregador:

   | Módulo | Función | Qué cuenta |
   |---|---|---|
   | I | `usuarioRegistroOperaciones(tx, usuarioId)` en `src/server/pagos/pago.publico.ts` | **Ya existe**: pagos, correcciones, anulaciones, cajas (propias o cerradas por él), movimientos, anulaciones de movimiento y ajustes |
   | C | `usuarioRegistroOperaciones(usuarioId, db?)` en `src/server/turnos/turno.publico.ts` (nueva) | `turnos` (`creadoPorUsuarioId`, `modificadoPorUsuarioId`), `turno_alumno` (`creadoPorUsuarioId`, `finalizadaPorUsuarioId`), `historial_inscripciones` (`usuarioId`), `eventos_turno` (`usuarioId`) |
   | L | `usuarioRegistroOperaciones(usuarioId, db?)` en `src/server/materias/materia.publico.ts` (nueva) | `historial_tarifas` (`usuarioId`) |
   | Estados | `usuarioRegistroCambiosDeEstado(usuarioId, db?)` en `src/server/shared/historial-estados.ts` (nueva) | `historial_estados` (`usuarioId`) |

   Como los nombres coinciden, el agregador importa con alias. Se queda con la definición de DEC-39 (pagos, cajas, inscripciones, clases creadas, cambios de estado, de tarifa y de parámetros): **no** se amplía a altas de alumnos, profesores, materias o aulas. Si el PO lo pide, es una línea más en el agregador. Con ficha sin cuenta no se llama.
9. **El detalle suma los tres campos de la spec F §2.4** sin cambiar la firma `obtenerDetalleIntegrante(id, db?)` (nota 12 de F-01): `historialEstados`, `cajaAbierta` y `motivoObligatorioAlDesactivar`.
   - `historialEstados`: `listarHistorialEstados("FICHA_MESA_ENTRADA", id, db)`, del más reciente al más antiguo, con el nombre de quien actuó. **El nombre sale de `obtenerNombresPersonal`** (`personal.publico.ts`, cubre mesa de entrada y gerentes por `usuarioId`) y no de `obtenerNombresGerentes`, que la spec nombra pero todavía no existe (llega con G-01). Cada entrada va en camelCase como el resto del detalle: `{ id, accion, motivo, fecha, usuarioId, usuarioNombre }`; `usuarioNombre` es `null` si no se resuelve o si actuó el proceso automático.
   - `cajaAbierta` y `motivoObligatorioAlDesactivar` son indicadores de solo lectura para que la pantalla decida antes de confirmar; el servidor repite la validación. Se calculan solo si la ficha está activa y tiene cuenta; si no, `false`.
10. **Rutas y Server Actions, las dos** (spec F §2.5 y §2.6; capa delgada, Reglas N.° 4, 5 y 6): `POST /api/personal/[id]/desactivar` y `POST /api/personal/[id]/reactivar` con `withPermission("personal:cambiar_estado")`, cuerpo JSON validado con Zod, `200 { data: { id, activo, version }, error: null }`, `400 VALIDATION_ERROR` con `detalles`, `403`, `404`, `409` y `401` sin sesión; y las Server Actions `desactivarIntegrante(id, datos)` y `reactivarIntegrante(id, datos)` en `src/server/personal/actions.ts`, que verifican el permiso **antes** de validar con Zod y hacen `revalidatePath("/personal")` y de la ficha. La pantalla usa las Server Actions (como el alta y la edición de F-01); las rutas existen para el nivel HTTP del testing.
11. **Pantalla (figuras 93 y 94).** La ficha `/personal/[id]` suma, junto a «Editar»: «Desactivar» (botón de contorno con estilo destructivo) si la ficha está activa, o «Reactivar» si está inactiva, solo con `personal:cambiar_estado`; y la sección «Historial de estados». No se reorganiza lo que hizo F-01 (la etiqueta «Inactivo» junto al nombre, «Registro», «Cuenta de acceso»): «Cuenta de acceso» e «Historial de estados» van en una grilla de dos columnas debajo de «Registro».
    - **Diálogo de baja** (componente de cliente nuevo, `estado-integrante-dialog.tsx`, sobre `ConfirmarAccionDialog` de C-25 con `destructiva` y **sin** `irreversible`: la baja se revierte con «Reactivar»). Título: «¿Estás seguro de que querés desactivar a {nombre} {apellido}? No podrá ingresar al sistema.» Detalle: «Las operaciones que registró se conservan con su nombre. Su cuenta pasa a inactiva y se cierran todas sus sesiones.» (sin cuenta: «Las operaciones que registró se conservan con su nombre. No tiene una cuenta de acceso vinculada.»). Campo «Motivo de la baja» en `contenido` (hasta 300 caracteres, contador «n / 300»), con la ayuda «Obligatorio: tiene clases, pagos u operaciones registradas.» u «Opcional»; la confirmación queda deshabilitada si el motivo es obligatorio y está vacío. Los rechazos del servidor se muestran dentro del mismo modal.
    - **Caja abierta:** si el detalle trae `cajaAbierta: true`, «Desactivar» **no** abre la confirmación sino un aviso informativo («No se puede desactivar al integrante» + el texto de `errores.personal.cajaAbierta` + «Cerrar»). Si la caja se abrió después de cargar la página, el rechazo `CAJA_ABIERTA` aparece dentro del modal de confirmación. El prototipo ofrece ir a «Cierres de caja»: esa pantalla es de HU-I-12 (Cali); si al implementar no existe en `develop`, no se inventa la ruta ni el enlace (ver 0.2).
    - **Diálogo de reactivación:** `ConfirmarAccionDialog` sin motivo. Título: «¿Estás seguro de que querés reactivar a {nombre} {apellido}?»; detalle: «Su cuenta vuelve a quedar activa. Las sesiones cerradas en la baja no se restauran: tiene que iniciar sesión de nuevo.»
    - **Feedback:** como D-08 y formas de pago, toast de éxito («Integrante desactivado correctamente» / «Integrante reactivado correctamente») y `router.refresh()`; no se usa banner por parámetro de URL.
    - **Conflicto de versión:** el modal muestra el mensaje de `CONFLICTO_EDICION_CONCURRENTE`; al cerrar, se refresca la ficha para tomar la versión actual.
12. **Textos nuevos en `textos.ts`** bajo `ui.personal.ficha.*` (botones), `ui.personal.baja.*`, `ui.personal.reactivacion.*` e `ui.personal.historial.*` (título «Historial de estados», vacío «Sin bajas ni reactivaciones.», «Desactivación», «Reactivación», y «Usuario» cuando no hay nombre), más los errores de 0.1.6. Los de la figura 94 son literales del prototipo; el resto son propuestos y se marcan como tales en la nota de la spec.
13. **Fixture** `prisma/seed/fixtures/hu-f-05.ts` (+ una línea en `fixtures/index.ts`, sin editar `seed.ts`), idempotente por DNI y usando los servicios de dominio (`crearIntegrante`, `desactivarIntegrante`, y los de caja). DNI `8806300x`:
    - `88063001`: activo, con cuenta (nace con la marca de cambio obligatorio), **sin operaciones** → la baja con motivo opcional.
    - `88063002`: activo, con cuenta, que **abrió y cerró una caja** → motivo obligatorio y sin caja abierta.
    - `88063003`: dado de baja con `desactivarIntegrante` (con motivo, actor el gerente del seed) → «Reactivar» y un historial real.

    No se tocan las dos cuentas de mesa de entrada del seed base (25100001 y 25100002): cada una tiene su caja abierta, y son el caso «caja abierta». La ficha inactiva de F-01 (`88061002`) queda como está, sin historial.
14. **Etapas: dos.** La primera es todo el backend (agregador con tres lecturas en módulos ajenos, servicio, rutas, concurrencia con la apertura de caja); la segunda, la pantalla, el fixture y el cierre. Se pausa entre una y otra.

### 0.2. A verificar antes de implementar (si algo contradice lo de arriba, detenerse y reportar)

- **Aislamiento de fachadas (Regla N.° 3):** hay un test que fija qué puede importar cada módulo (D-08 lo tocó). Que `actividad-usuario.ts` (que importa de I, C y L), `personal.service.ts` (que importa `caja.publico.ts` y el agregador) y las tres lecturas nuevas lo respeten; si el test exige registrar los imports nuevos, se hace sin debilitarlo. Que no se cree un ciclo: `personal.publico.ts` no importa nada de otros módulos de dominio.
- **Tablas y columnas del agregador:** confirmar contra `schema.prisma` los nombres de tabla y de columna de 0.1.8 (la lectura puede ser `findFirst` con `select` mínimo o `EXISTS`; lo que evite depender del nombre físico de la columna). Que la lectura de I recibe el mismo tipo de cliente que el resto.
- **`bloquear` con un id inexistente:** que no lance y que la relectura devuelva `INTEGRANTE_NO_ENCONTRADO` (D-08 depende de eso).
- **Tests que fijan la forma del detalle** (`personal.service.test.ts`, `route.test.ts` de `/api/personal/[id]`, `paginas.test.tsx`, el test con PostgreSQL): adaptarlos a los tres campos nuevos sin debilitarlos.
- **Aviso informativo:** relevar `src/components/ui/dialog.tsx` y `ConfirmarAccionDialog` (props `destructiva`, `confirmarDeshabilitado`, `contenido`; `onConfirmar` que lanza un `Error` con el mensaje ya resuelto). **No se modifican componentes compartidos**; si el aviso no se puede armar con `Dialog` tal cual, reportar la alternativa.
- **«Cierres de caja» del Gerente:** si la pantalla de HU-I-12 ya existe en `develop`, agregar el enlace del aviso; si no, no.
- **Rutas y proxy:** `/personal/:path*` ya está en el `matcher` de `src/proxy.ts` y `personal: ["GERENTE"]` en `rutas-por-rol.ts`: se espera **no tocar ninguno de los dos**. Confirmarlo, incluida la matriz de permisos (`personal:cambiar_estado` solo para GERENTE).
- **Fixture de caja cerrada:** que `abrirCaja`, `declararEfectivo`, `calcularResumen` y `cerrarCaja` (con `porAusencia`) se puedan encadenar desde un fixture con el cliente del seed. Si no es razonable, reportar antes de inventar otra forma de dejar un integrante con operaciones.
- **Que `texto()` interpole** `{nombre}` y `{apellido}` (sí, `texto("…", { … })`).

---

## 1. Nota de alcance

HU-F-05 cierra el bloque de mesa de entrada: después de F-01 (alta y edición con cuenta) y F-03 (listado), el Gerente puede dar de baja y reactivar a un integrante. La ficha ya es accesible desde cada fila del listado, que muestra activos e inactivos: el listado no cambia.

**Lo que ya existe y esta task usa** (verificado en `develop`):

| Qué | Dónde |
|---|---|
| `obtenerDetalleIntegrante`, `DetalleIntegrante`, ficha `/personal/[id]` con «Cuenta de acceso», `GET /api/personal/[id]` | F-01 |
| `bloquear` con el recurso `fichasMesaEntrada` | `src/server/shared/bloquear.ts` |
| `desactivarCuenta` (ya revoca las sesiones), `reactivarCuenta`, `obtenerResumenCuenta` | `src/server/usuarios/cuenta.service.ts` |
| `registrarCambioEstado`, `listarHistorialEstados`, `actorUsuario` | `src/server/shared/historial-estados.ts`, `historial.ts` |
| `cajaAbiertaDe`, `abrirCaja` (que ya llama a `bloquearIntegranteActivo`, la mitad de spec F §3.4), `cerrarCaja` | `src/server/pagos/caja.service.ts` y `caja.publico.ts` |
| `usuarioRegistroOperaciones` de I | `src/server/pagos/pago.publico.ts` |
| `obtenerNombresPersonal`, `bloquearIntegranteActivo` | `src/server/personal/personal.publico.ts` |
| `ConfirmarAccionDialog`, `toast` (sonner), patrón del diálogo de baja | `src/components/shared/`, `estado-profesor-dialog.tsx` (D-08) |
| Permisos `personal:cambiar_estado` y `personal:leer` | `prisma/seed.ts`, migración de permisos |

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Desactivar o reactivar gerentes, y las reglas de «no autodesactivarse» y «al menos un gerente activo» (HU-G-05). El agregador queda listo para que G-05 lo reutilice.
- La pantalla «Cierres de caja» y el «Cierre por ausencia» (HU-I-12, de Cali). Esta HU solo **lee** si hay caja abierta; no cambia `abrirCaja`, `cerrarCaja` ni `bloquearIntegranteActivo`.
- La línea de N en el agregador (HU-N-01) y ampliar «registró operaciones» a altas de alumnos, profesores, materias o aulas.
- Crear una cuenta para una ficha sin cuenta (DEC-14).
- Cambios en el listado, en el alta o en la edición, y que «Volver al listado» conserve la búsqueda (deuda conocida).
- Modificar componentes compartidos (`ConfirmarAccionDialog`, `ConfirmarDescarteDialog`, `CuentaAccesoCard`, `Pagination`, etc.). Los textos fijos de `ConfirmarDescarteDialog` siguen siendo deuda.
- Borrado físico, migraciones, `schema.prisma` y `seed.ts`.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** desactivar a un integrante de mesa de entrada que deja de trabajar en el centro y reactivarlo si vuelve
**Para** que no pueda acceder al sistema, conservando el registro de las operaciones que realizó, y poder volver a habilitarlo sin registrarlo de nuevo

**SP estimado:** 3

---

## 3. Alcance de esta task

- Agregador `usuarioRegistroOperaciones` y las tres lecturas nuevas en C, L y el historial de estados.
- `desactivarIntegrante` y `reactivarIntegrante`, con sus schemas, errores y textos.
- El detalle de la ficha con `historialEstados`, `cajaAbierta` y `motivoObligatorioAlDesactivar`.
- Dos Route Handlers y dos Server Actions.
- La ficha con «Desactivar», «Reactivar», el aviso de caja abierta y el historial de estados.
- Fixture, reglas en `RULES.md`, nota aditiva en `spec_modulo_F.md` y evidencia.

---

## 4. Contrato Backend

El contrato completo está en `docs/specs/spec_modulo_F.md` §2.4 a §2.7; esta sección fija qué se implementa y dónde (las decisiones están en 0.1).

- **Schemas:** `DesactivarIntegranteSchema` y `ReactivarIntegranteSchema` en `src/server/personal/personal.schema.ts`.
- **Agregador y lecturas:** `src/server/shared/actividad-usuario.ts` (nuevo); `turno.publico.ts`, `materia.publico.ts` y `historial-estados.ts` suman una lectura cada uno.
- **Servicio:** `desactivarIntegrante`, `reactivarIntegrante` y el detalle ampliado en `src/server/personal/personal.service.ts`. Una transacción cada uno; el orden es el de 0.1.3 y 0.1.4.
- **Errores:** claves nuevas en `errores-dominio.ts` y `textos.ts` (0.1.6).
- **Tipos:** `DetalleIntegrante` suma los tres campos y se define el tipo de cada entrada del historial; resultados de las acciones en `src/types/personal.types.ts`.
- **Rutas:** `src/app/api/personal/[id]/desactivar/route.ts` y `reactivar/route.ts` (`POST`, `personal:cambiar_estado`). `GET /api/personal/[id]` devuelve los campos nuevos sin cambiar nada más.
- **Server Actions:** `desactivarIntegrante(id, datos)` y `reactivarIntegrante(id, datos)` en `src/server/personal/actions.ts` (permiso → Zod → servicio → `{ data, error }`).
- **Trazabilidad (Regla N.° 2):** opción (b), `registrarCambioEstado` con entidad `FICHA_MESA_ENTRADA` y acción `DESACTIVAR` (con motivo) o `REACTIVAR`, **después del commit**; la fila de la ficha suma `version` y `modificadoPorUsuarioId` en la misma operación.
- **Regla 3.4 (spec F):** la baja toma `FOR UPDATE` sobre la ficha antes de leer la caja y `abrirCaja` toma `FOR SHARE` sobre la misma ficha antes de insertar: las dos transacciones se serializan sobre la fila. Esta HU no cambia `abrirCaja`; la prueba con PostgreSQL de las dos órdenes es de esta HU.

---

## 5. Frontend

**Prototipo (figuras 93 y 94, páginas 84 y 85):**
- Ficha: título con el nombre, botones «Editar» y «Desactivar» (contorno rojo) arriba a la derecha, «Cuenta de acceso» e «Historial de estados» («Sin bajas ni reactivaciones.» cuando no hay) en la columna derecha.
- Confirmación: modal con la pregunta, el aviso de que se conservan las operaciones y se cierran las sesiones, el campo «Motivo de la baja» con contador «0 / 300» y los botones «Volver» y «Desactivar» (rojo).

**A implementar** (decisiones en 0.1.11 y 0.1.12): `page.tsx` de la ficha (servidor: `exigirPermiso("personal:leer")`, `tienePermiso("personal:cambiar_estado")`, pasa `version`, `cajaAbierta` y `motivoObligatorioAlDesactivar` al diálogo), `estado-integrante-dialog.tsx` (cliente: baja, aviso de caja abierta y reactivación) e `historial-estados-integrante.tsx`, con el mismo formato de entrada que el historial de D-08 (acción, fecha y hora en la zona del centro, usuario y motivo). Antes de implementar, actualizar `docs/DESIGN.md` §6.4: reemplazar el texto de la fila de la ficha («desactivar y reactivar los agrega HU-F-05»), agregar las filas de desactivar, reactivar y aviso de caja abierta, y la entrada en el historial de cambios **sin fecha (la indica Adriel)**. Seguir la guía de diseño: tokens de shadcn/ui y Tailwind del proyecto, nunca colores hexadecimales ni la paleta por defecto.

**Fuera de alcance de frontend:** cambiar la distribución de la ficha de F-01, el listado y el formulario de edición.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
- Schemas: `version` obligatoria y entera; `motivo` recortado, vacío = no enviado, 301 caracteres rechazado con el mensaje de `textos.ts`; `.strict()` rechaza `activo`, `usuarioId` y cualquier otro campo.
- Servicio con mocks: baja feliz (orden de llamadas: bloqueo → relectura → caja → motivo → `updateMany` → cuenta → historial), `noEncontrado`, `yaInactivo`, versión vieja, caja abierta, motivo requerido con operaciones y motivo opcional sin ellas, ficha sin cuenta (no llama a caja ni a cuenta), historial encolado para después del commit y descartado si la transacción revierte; reactivar (`yaActivo`, versión, cuenta reactivada, sin motivo).
- Agregador: cada línea (I, C, L, estados) devuelve `true` por separado y las cuatro `false` dan `false`; corta en la primera verdadera.
- Detalle ampliado: historial del más reciente al más antiguo con el nombre; `cajaAbierta` y `motivoObligatorioAlDesactivar` solo con ficha activa y con cuenta.
- Acciones: permiso antes de Zod (sin permiso no se valida), resultado `{ data, error }`, `revalidatePath`.
- Rutas: `200` con la forma de 0.1.10, `400` (cuerpo ausente, `version` faltante, campo ajeno, motivo de 301), `401`, `403` para MESA_ENTRADA, PROFESOR y ALUMNO, `404`, `409` (`INTEGRANTE_YA_INACTIVO`, `INTEGRANTE_YA_ACTIVO`, `CAJA_ABIERTA`, `CONFLICTO_EDICION_CONCURRENTE`), y `400 MOTIVO_REQUERIDO`.
- Pantalla: «Desactivar» solo con ficha activa y permiso, «Reactivar» solo con ficha inactiva y permiso, ninguno sin `personal:cambiar_estado`; con `cajaAbierta` se abre el aviso y no la confirmación; motivo obligatorio (confirmar deshabilitado) y opcional; contador y tope de 300; error del servidor dentro del modal; éxito con toast y refresco; reactivación; historial con y sin entradas.
- Con PostgreSQL real (nuevos `personal.estado.pg.test.ts` y `actividad-usuario.pg.test.ts`):
  - Baja con cuenta: ficha y cuenta inactivas en la misma transacción, `version + 1`, `modificadoPorUsuarioId`, `sesionesValidasDesde` fijado, marca de cambio de contraseña intacta; fila de historial `DESACTIVAR` con el motivo y el gerente, escrita después del commit.
  - Rollback: si falla la cuenta, la ficha sigue activa y no queda historial.
  - Reactivar: ficha y cuenta activas, **el umbral de sesiones y la marca conservados** (como en D-08), historial `REACTIVAR`; después de varias bajas y reactivaciones se conservan todas las filas.
  - Caja: con caja abierta la baja falla y no cambia nada; con la caja cerrada (incluido el cierre por ausencia) la baja procede.
  - **Concurrencia (spec F §3.4), las dos órdenes deterministas** (con la técnica de pausa por `bloquear` de `profesor.estado.pg.test.ts`): si `abrirCaja` gana, la baja ve la caja y responde `CAJA_ABIERTA`; si la baja gana, `abrirCaja` encuentra la ficha inactiva y responde `INTEGRANTE_INACTIVO`. Dos bajas simultáneas con la misma versión: una gana y la otra recibe conflicto o `yaInactivo`.
  - El DNI y el email de la ficha inactiva siguen reservados (alta duplicada: `DNI_DUPLICADO`; el email sigue en uso).
  - Ficha sin cuenta: baja y reactivación con historial, sin tocar ninguna cuenta.
  - Nada se borra: las operaciones del integrante (por ejemplo, su caja cerrada) siguen mostrando su nombre con `obtenerNombresPersonal`.

### Nivel 2 — Postman (o curl, documentado como en F-01 y F-03)
Con sesión de Gerente: detalle con los campos nuevos; `POST …/desactivar` sin motivo (integrante sin operaciones, `200`), con motivo, sin motivo con operaciones (`400 MOTIVO_REQUERIDO`), con caja abierta (`409 CAJA_ABIERTA`), con versión vieja (`409`), a un ya inactivo (`409`), con campo ajeno o `version` faltante (`400`) y a un id inexistente (`404`); `POST …/reactivar` (`200`, a un ya activo `409`, versión vieja `409`); sin permiso (`403` con Mesa de entrada, Profesor y Alumno) y sin sesión (`401`). Después de la baja: la sesión previa del integrante responde `401 SESION_INVALIDA`, el login responde la cuenta inactiva; después de reactivar, tiene que volver a iniciar sesión y, si todavía no había cambiado la contraseña, el servidor lo sigue mandando a `/primer-ingreso` (`403 DEBE_CAMBIAR_PASSWORD`).

### Nivel 3 — BD / TablePlus
- `fichas_mesa_entrada`: `activoFichaMesaEntrada`, `version` y `modificadoPorUsuarioId` antes y después de la baja y de la reactivación.
- `usuarios`: `activoUsuario`, `sesionesValidasDesdeUsuario` y `debeCambiarPasswordUsuario` (la marca se conserva) para esa ficha.
- `historial_estados`: una fila por baja y por reactivación (`entidad = FICHA_MESA_ENTRADA`, acción, motivo, usuario y fecha); ninguna fila del historial ni de las operaciones del integrante desaparece.
- Una baja rechazada (caja abierta, motivo faltante, versión vieja) no deja filas nuevas ni cambia la ficha ni la cuenta.
- Recorrido en el navegador como Gerente: listado → ficha → «Desactivar» (motivo opcional con `88063001`, obligatorio con `88063002`), aviso con la cuenta de seed que tiene caja abierta, «Reactivar» con `88063003`, historial en la ficha; como Mesa de entrada, la ficha y las rutas rechazan.
- **Verificaciones diferidas que cierra esta HU:** A-06 criterio 7 (desactivar y reactivar la ficha desactiva y reactiva la cuenta; la marca de cambio se conserva) para mesa de entrada; el límite del criterio 7 de F-01 (la edición sigue sin permitir desactivar) y el criterio 3 de F-03 (acceso a desactivar y reactivar desde la ficha alcanzada por una fila del listado). Se deja anotado el criterio 10 de I-12 (no se desactiva a quien tiene la caja abierta), que es de Cali: la parte de la pantalla «Cierres de caja» y el «Cierre por ausencia» desde la interfaz queda como Bloqueada si esa pantalla no existe todavía.

---

## 7. Checklist de Definition of Done

- [ ] Servicio, Route Handlers, Server Actions y pantalla implementados, sin lógica de negocio en la capa delgada (Regla N.° 4); respuesta `{ data, error }` (Regla N.° 5) y validación Zod previa (Regla N.° 6).
- [ ] Baja y reactivación atómicas de la ficha y su cuenta, con `version` (Regla N.° 7), caja abierta rechazada, motivo obligatorio según DEC-39 y sin ningún `DELETE` físico (Regla N.° 1).
- [ ] La serialización con `abrirCaja` (spec F §3.4) probada con PostgreSQL en las dos órdenes.
- [ ] Historial de estados escrito después del commit, con todas las bajas y reactivaciones conservadas (Regla N.° 2).
- [ ] Agregador `actividad-usuario.ts` con las líneas de I, C, L y estados; fachadas respetadas (Regla N.° 3).
- [ ] Solo el Gerente: `403` en el servidor para cualquier otro rol (Regla N.° 10).
- [ ] Todos los textos visibles en `textos.ts`, verificados con `scripts/verificar-claves-textos.ts`; los propuestos marcados como tales.
- [ ] Ningún componente compartido modificado; ningún test de Sprint 1, 2, A-06, A-05, F-01 y F-03 borrado ni debilitado.
- [ ] Fixture `hu-f-05.ts` con su línea en el índice, sin editar `seed.ts`; el seed corre dos veces sin duplicar.
- [ ] Filas de esta HU en `docs/DESIGN.md` §6.4 (y en su historial de cambios, con la fecha que indique Adriel).
- [ ] Reglas en `RULES.md` (solo la sección «Aplicación HU-F-05»; no se modifica ninguna regla existente) y nota aditiva en `spec_modulo_F.md` (diferencias de 0.1: `obtenerNombresPersonal`, `desactivarCuenta` que ya revoca, errores, agregador).
- [ ] `lint`, `tsc`, `npm test`, `npm run test:pg` y `next build` sin fallos nuevos respecto de `develop` (los conocidos están en la sección 5 del handoff del carril).
- [ ] Tests de los 3 niveles documentados en `docs/testing/HU-F-05-evidencia.md`.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Etapas de implementación

Antes de escribir código, Claude Code verifica los puntos de la sección 0.2; **solo si alguno contradice lo decidido, se detiene y reporta** y, si no, sigue. Al terminar cada etapa **se detiene** y reporta archivos, resultados de los comandos, desvíos y dudas; la siguiente empieza cuando Adriel dice «continuamos».

**Etapa 1 — Backend** (todo menos la pantalla). Orden: 1) lecturas de C, L y estados, y el agregador, con sus tests (unitarios y PostgreSQL); 2) errores, textos de error y schemas; 3) `desactivarIntegrante`, `reactivarIntegrante` y el detalle ampliado, con sus tests (unitarios y PostgreSQL, incluida la concurrencia con `abrirCaja`); 4) tipos, Server Actions y Route Handlers con sus tests; 5) `lint`, `tsc`, `npm test`, `npm run test:pg` (el nuevo y los de personal, caja y pagos), `npx tsx scripts/verificar-claves-textos.ts`.

**Etapa 2 — Pantalla y cierre.** Orden: 1) filas de `docs/DESIGN.md` §6.4; 2) textos de la pantalla; 3) diálogo, historial y ficha, con sus tests; 4) fixture, su línea en el índice y `npx prisma db seed` (dos veces); 5) `RULES.md`, nota aditiva en `spec_modulo_F.md` y evidencia; 6) `lint`, `tsc`, `npm test`, `npm run test:pg`, `npx tsx scripts/verificar-claves-textos.ts`, el seed dos veces y `next build`.

---

## 9. Resultado de la implementación

HU-F-05 implementada en dos etapas (backend; pantalla y cierre). Detalle de pruebas, pedidos HTTP y consultas SQL en [`docs/testing/HU-F-05-evidencia.md`](../../../testing/HU-F-05-evidencia.md).

### Criterios de aceptación

| Criterio | Estado |
|---|---|
| 1. «Desactivar» pide confirmación con el texto del backlog y el motivo (hasta 300), obligatorio si el integrante registró operaciones | Verificado (tests de los tres niveles y recorrido en el navegador) |
| 2. Baja atómica de ficha y cuenta, sesiones revocadas, historial después del commit | Verificado |
| 2. No se desactiva con la caja abierta (servicio, rutas, concurrencia con `abrirCaja` en los dos órdenes, aviso informativo en la pantalla) | Verificado. La pantalla «Cierres de caja» y el «Cierre por ausencia» desde la interfaz: **Bloqueado** hasta HU-I-12 (el cierre por ausencia por servicio sí está probado) |
| 3. Las operaciones registradas conservan su nombre | Verificado |
| 4. «Integrante desactivado correctamente», «Inactivo» en el listado y DNI reservado | Verificado |
| 5. Reactivar con confirmación, historial conservado, cuenta activa y nuevo ingreso (la marca de cambio de contraseña se conserva; las sesiones no se restauran) | Verificado |
| 6. Solo el Gerente (`403` a cualquier otro rol) | Verificado |
| HU-A-06, criterio 7, para Mesa de entrada | Verificado |

**Verificaciones diferidas que cierra esta HU:** HU-F-01 (la edición sigue sin desactivar), HU-F-03 criterio 3 (acceso a «Desactivar» y «Reactivar» desde la ficha del listado) y, del lado de F, HU-I-12 criterio 10 (no se desactiva a quien tiene la caja abierta).

### Desvíos respecto de lo decidido en la sección 0.1

1. **Fecha del historial:** usa `fechaHoraDeInstante` (el formato de «Registro» en la misma ficha) y no el formato del historial del profesor (D-08), para no mostrar dos formatos de fecha en una misma pantalla.
2. **Ayuda del motivo:** va debajo del campo, con el contador «n / 300» a la derecha (como D-08); el prototipo la muestra como placeholder. El texto quedó sin punto final, como en el prototipo.
3. **Claves de texto no previstas en 0.1.12:** `ui.personal.baja.contador` y `ui.personal.reactivacion.detalleSinCuenta` (propuesta; evita decir que «la cuenta vuelve a quedar activa» en una ficha sin cuenta).
4. **Refresco del modal:** se refresca después de cualquier rechazo del servidor que no sea de validación (caja abierta, motivo requerido, ya activo o ya inactivo), no solo con el conflicto de versión.
5. **Aviso de caja abierta:** usa «Cerrar» (no «Entendido») y se abre directamente desde «Desactivar»; quedó listado en la excepción de `DESIGN.md` §6.3.
6. **Tests de HU-F-01:** los dos de `paginas.test.tsx` que fijaban «no ofrece desactivar ni reactivar» ahora lo exigen sin el permiso `personal:cambiar_estado`; se sumaron 7 casos. Ningún test se borró ni se debilitó.
7. **Diferencias spec–código** (anotadas como nota aditiva en `spec_modulo_F.md`): `obtenerNombresPersonal` en lugar de `obtenerNombresGerentes`; `desactivarCuenta` ya revoca las sesiones; `abrirCaja` toma `FOR UPDATE` (no `FOR SHARE`); el agregador `actividad-usuario.ts` lo crea esta HU.
8. **Fixture:** los integrantes 88063001 y 88063002 quedaron con `version` 2 y dos filas de historial cada uno en la base de desarrollo, por las pruebas HTTP; se restauran con `npx prisma migrate reset --force` y el seed.

### Verificación final

`lint` sin errores (solo el aviso previo de `CALENDARIO`); `tsc` sin errores; `npm test` con 3113 pruebas que pasan y 0 que fallan; `npm run test:pg` con 298 pasan en la pasada principal (el único fallo, un caso de `cancelaciones.service.pg.test.ts`, es el conocido por orden de ejecución y corrido solo pasa 6 de 6); `verificar-claves-textos` aprobado; seed dos veces sin cambios; `next build` compila con las dos rutas nuevas. Recorrido interactivo en el navegador realizado por el responsable.

### Deuda

- **HU-I-12:** pantalla «Cierres de caja» y «Cierre por ausencia» desde la interfaz.
- **HU-N-01:** la línea del agregador correspondiente a N no se incluyó; la agrega esa HU.
- **PO (P-F6):** validar el texto propuesto de `MOTIVO_REQUERIDO` («Ingresá el motivo de la baja: el integrante registró operaciones.»).
- El mensaje del `400` por `version` faltante es el de Zod por defecto, igual que en la modificación de HU-F-01.
- El fallo de orden de `cancelaciones.service.pg.test.ts` (HU-H-10) sigue abierto; no lo causa esta HU.
