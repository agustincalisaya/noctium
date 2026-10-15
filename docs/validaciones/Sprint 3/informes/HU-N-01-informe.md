# Informe de validación — HU-N-01 · Configurar parámetros del centro

**Sprint:** 3 · **Módulo:** N · **Fecha:** 14/10/2026 · **Rama validada:** `develop` (`d020827`, árbol limpio)
**Fuente de verdad:** el texto de la HU entregado por el PO (no la task).
**Documentos leídos:** `prisma/schema.prisma`, `docs/RULES.md`, `docs/DESIGN.md`, `prisma/seed.ts` (+ `prisma/seed/fixtures/hu-h-07.ts`), `docs/specs/spec_modulo_N.md`, `docs/tasks/Sprint 3/Modulo N/HU-N-01.md`, `docs/testing/Modulo N/hu-n-01/*` (evidencia del dev).
**Alcance de esta validación:** lectura de código y ejecución de los tests existentes. No se modificó código, tests, schema ni seed.

---

## 1. Tabla de trazabilidad

| # | Criterio / viñeta | Dónde está implementado | Estado | Justificación |
|---|---|---|---|---|
| 1 | Pantalla «Configuración del centro» | `src/app/(dashboard)/configuracion/page.tsx` (`exigirPermiso("configuracion:leer")`) → `configuracion-form.tsx` (`ConfiguracionForm`); título `ui.configuracion.titulo`; menú Gerente en `src/components/layout/Sidebar.tsx:182` | CUBIERTO | Pantalla única en `/configuracion`, título literal, entrada de menú solo en el bloque `GERENTE`. |
| 1.a | Plazo para pagar una reserva, en horas, defecto 24 | Catálogo `src/server/configuracion/parametros-configurables.ts:2`; lectura `obtenerConfiguracion()` (`configuracion.service.ts:24`) vía `GET /api/configuracion`; campo `plazoPagoHoras` en el form | CUBIERTO | Muestra valor, unidad «horas», rango y «por defecto 24». |
| 1.b | Anticipación mínima para cancelar en línea, en horas, defecto 24 | Catálogo línea 3; campo `cancelacionAnticipacionHoras` | CUBIERTO | Etiqueta: «Anticipación mínima para que el alumno cancele en línea» (omite «su inscripción»; no es un texto entre comillas de la HU, no es incumplimiento). |
| 1.c | Umbral de presentismo bajo, en %, defecto 75 | Catálogo línea 4; campo `umbralPresentismo` | CUBIERTO | Unidad «%», rango y defecto visibles. |
| 2 | Rango 1–72 h (plazo y anticipación) y 1–100 % (asistencia) | Servidor: `configuracion.schema.ts` (`enteroEnRango` desde `CATALOGO`, `.strict()` en ambos niveles); cliente: `validar()` en `configuracion-form.tsx:41` | CUBIERTO | Mismo catálogo para servidor y pantalla. |
| 2 | Error junto al campo | `configuracion-form.tsx:203` (`<p id="<campo>-error" role="alert">`), validación en vivo + mapeo de `detalles.issues` del 400 a cada campo (`:138-146`) | CUBIERTO (con observación) | En cliente usa `ui.configuracion.fueraDeRango` / `enteroRequerido`. Si el error viniera del servidor, el texto mostrado es el mensaje por defecto de Zod (inglés, no centralizado) — ver §4. |
| 2 | (agregado de la task) Solo enteros; decimales rechazados | Schema `z.number().int()`; cliente `/^\d+$/` | **DESVÍO (menor)** | La HU solo pide rango; la task/spec (P-N4) agrega «solo enteros». La task dice que fue confirmado por el usuario/PO. Si el PO no lo confirmó, es una restricción no pedida (p. ej. 1,5 h queda rechazado). |
| 3.a | Los cambios rigen desde que se guardan | `parametrosVigentes()` (`src/server/shared/parametros-vigentes.ts:23`) lee la BD en cada llamada, sin caché | CUBIERTO | Ningún consumidor cachea el valor. |
| 3.b | No se aplican hacia atrás: la reserva conserva el vencimiento informado | `crearInscripcion` (`src/server/turnos/inscripcion.service.ts:351-354`) calcula y **persiste** `venceBaseEl`/`venceEl` con el plazo vigente al reservar; `guardarConfiguracion` no toca `turno_alumno` | CUBIERTO | El servicio de N no recorre reservas. |
| 3.c | …salvo que la clase se reprograme (HU-C-22 c2) | `recalcularVencimientos` (`inscripcion.service.ts:219-233`): `venceEl = LEAST(venceBaseEl, nuevoInicio)` | CUBIERTO | Usa la base guardada; no relee el plazo. |
| 3.d | (C-24 c5) reapertura por anulación del último pago | `recalcularEstadoPago` (`inscripcion.service.ts:581-583`) relee el plazo vigente | CUBIERTO | Es una reserva «nueva» (reinicia `inicioPlazo`), coherente con la spec N §2.4. |
| 3.e | Anticipación para cancelar con el valor vigente al cancelar; sin límite propio por inscripción | `turno.cancelacion-propia.service.ts:34-37` (`parametrosVigentes(tx)` dentro de la transacción, tras bloquear) + `evaluarCancelacion`; `TurnoAlumno` no tiene columna de límite | CUBIERTO | Verificado en schema: solo `inicioPlazo`, `venceBaseEl`, `venceEl`. |
| 3.f | Resumen de HU-C-20 informa el límite calculado con el valor vigente al inscribirse | `turno.resumen-inscripcion.service.ts:46-64` | CUBIERTO | Calcula `limiteCancelacionEnLinea(inicio, anticipación vigente)` al armar el resumen; no se guarda. |
| 3.g | Índice de presentismo usa el umbral vigente al consultar, sobre todo el período | `listarAlumnosConPresentismoBajo` (`src/server/indicadores/presentismo.service.ts:44-46`) | CUBIERTO | Lee el umbral una vez por consulta y lo aplica al rango completo. |
| 4 | Cada cambio queda registrado con valor anterior, nuevo, usuario y fecha | `HistorialParametro` (schema:1188); `guardarConfiguracion` encola una fila por parámetro cambiado en `ctx.despuesDelCommit` → `registrarCambioConfiguracion` (id preasignado, 3 reintentos, idempotente por P2002) | CUBIERTO (con riesgo aceptado) | Regla N.° 2 opción (b): se escribe después del commit. Si fallan los 4 intentos, el valor queda cambiado sin fila de historial (solo log). Riesgo documentado en spec N §4. |
| 4 | Se ve en la misma pantalla | `GET /api/configuracion/historial` → `listarHistorialConfiguracion` (más nuevo primero, 10 por página, nombre por `obtenerNombresPersonal`); tarjeta «Historial de cambios» en el form | CUBIERTO | Muestra parámetro, «anterior → nuevo», usuario (nombre o id de respaldo) y fecha/hora. Se refresca al guardar. |
| 5.a | Valores por defecto: los carga la migración | `prisma/migrations/20261008120100_sprint3_modelo/migration.sql:841-843` (24, 24, 75) | CUBIERTO | |
| 5.b | …y los mantiene el seed (sin pisar cambios) | `prisma/seed.ts:834-837` + `upsert({ update: {} })` en `:1938-1944` | CUBIERTO | Repetir el seed no revierte valores cambiados. El test automático de seed repetido existe pero está deshabilitado por defecto (ver §4/§7). |
| 5.c | Mientras no se modifiquen rigen los defectos | Consecuencia de 5.a/5.b; estado vacío «Todavía no hubo cambios: rigen los valores por defecto.» | CUBIERTO | |
| 5.d | Al guardar se informa «Configuración guardada» | `configuracion-form.tsx:187` (banner `role="status"`, `bg-success`) con `ui.configuracion.guardada` | CUBIERTO | Banner inline, sin toast (DESIGN §6.4 actualizado por la HU). |
| 5.e | Solo accesible para el Gerente | Página: `exigirPermiso("configuracion:leer")`; proxy `src/proxy.ts:73` + `rutas-por-rol.ts:47` (`configuracion: ["GERENTE"]`); menú solo Gerente | CUBIERTO | Otros roles → redirección a `/sin-permiso`. |
| 5.f | El servidor rechaza con 403 a otros roles | `withPermission("configuracion:leer")` (GET, historial), `withPermission("configuracion:editar")` (PUT), `verificarPermiso("configuracion:editar")` (Server Action); permisos solo para GERENTE en `seed.ts:982-983` y migración `20261008120200_sprint3_permisos:69` | CUBIERTO (sin test automático) | Los tests de las rutas **mockean** `withPermission` y no verifican el 403 ni el nombre del permiso. El dev lo comprobó por HTTP manual. Verificar en prueba manual (§3). |

---

## 2. Textos literales (archivo central `src/lib/textos.ts`)

| Texto de la HU | Clave | Valor en el código | ¿Coincide? |
|---|---|---|---|
| «Configuración del centro» | `ui.configuracion.titulo` (también etiqueta del menú) | `Configuración del centro` | Sí |
| «Configuración guardada» | `ui.configuracion.guardada` | `Configuración guardada` | Sí |

**No hay textos entre comillas que no coincidan.**

Otros textos de la pantalla (no exigidos literalmente por la HU, sí por la spec/prototipo) también coinciden: confirmación «¿Estás seguro de que querés guardar la configuración del centro?», conflicto «La configuración fue modificada por otra persona. Recargá para ver los valores actuales.» y vacío «Todavía no hubo cambios: rigen los valores por defecto.».

---

## 3. Reglas de servidor

### 3.1 Verificación

| Regla | Resultado |
|---|---|
| Validación Zod previa (Regla 6) | PUT y Server Action hacen `GuardarConfiguracionSchema.safeParse` antes del servicio; historial valida la query con `ListarHistorialQuerySchema` (`.strict()`). 400 `VALIDATION_ERROR` con `flattenError` + `issues`. ✔ |
| Permisos (Regla 10) | `withPermission` / `verificarPermiso` / `exigirPermiso` en todos los puntos de entrada; acciones exclusivas de GERENTE. ✔ |
| Transacción y concurrencia (Regla 7) | `guardarConfiguracion` usa `transaccion()`; por cada clave cambiada, en orden alfabético, `updateMany({ where: { clave, valor: esperado } })` y `count !== 1` → `ErrorDeDominio("errores.configuracion.conflicto")` (409 `CONFLICTO_EDICION_CONCURRENTE`), rollback todo-o-nada. No hay `findUnique` + `update`. ✔ |
| Registros nuevos en lugar de modificar (Regla 8) | `HistorialParametro` solo recibe `create`; nunca `update`/`delete`. ✔ (el `UPDATE` sobre `parametros_sistema` es el valor vigente, no un hecho consumado.) |
| Sin borrado físico (Regla 1) | No hay `delete`. ✔ |
| Aislamiento (Regla 3) | Consumidores C/H leen por `parametrosVigentes()`; nombres por `obtenerNombresPersonal` (fachada F); actividad por `configuracion.publico.ts`. ✔ |
| Capa delgada (Regla 4) / respuesta estándar (Regla 5) | Routes y action solo validan, verifican permiso, llaman al servicio y traducen `{ data, error }`. ✔ |

### 3.2 Endpoints y snippets para comprobar el 403

| Método | Ruta | Permiso | Respuesta esperada para Mesa / Profesor / Alumno |
|---|---|---|---|
| GET | `/api/configuracion` | `configuracion:leer` | 403 `SIN_PERMISO` |
| PUT | `/api/configuracion` | `configuracion:editar` | 403 `SIN_PERMISO` |
| GET | `/api/configuracion/historial?pagina=1` | `configuracion:leer` | 403 `SIN_PERMISO` |
| — | Server Action `guardarConfiguracion` (`src/server/configuracion/actions.ts`) | `configuracion:editar` | `{ data: null, error: { code: "SIN_PERMISO" } }` (no se invoca fácilmente desde consola; cubierta por el PUT) |
| GET | Página `/configuracion` | `configuracion:leer` | Redirección a `/sin-permiso` |

Iniciá sesión con Mesa de entrada, Profesor o Alumno, abrí la consola del navegador (F12) en cualquier página de la app y pegá:

```js
// Comprueba los tres endpoints de HU-N-01 con la sesión actual.
(async () => {
  const valores = { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 };
  const pruebas = [
    ["GET  /api/configuracion", fetch("/api/configuracion")],
    ["PUT  /api/configuracion", fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valores: { ...valores, plazoPagoHoras: 48 }, esperados: valores }),
    })],
    ["GET  /api/configuracion/historial", fetch("/api/configuracion/historial?pagina=1")],
  ];
  for (const [nombre, promesa] of pruebas) {
    const r = await promesa;
    console.log(nombre, "→", r.status, await r.json().catch(() => null));
  }
})();
```

Resultado esperado con otro rol: los tres en **403** con `error.code = "SIN_PERMISO"`. Con el Gerente, el mismo snippet da 200/200/200 (y el PUT da 200 con cambio real solo si los valores actuales son 24/24/75; si no, 409 — no es un error del snippet).

Snippet extra para el Gerente (validación de rango del servidor, sin pasar por la pantalla):

```js
fetch("/api/configuracion", { method: "PUT", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ valores: { plazoPagoHoras: 73, cancelacionAnticipacionHoras: 0, umbralPresentismo: 101 },
                         esperados: { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 } }) })
  .then(async r => console.log(r.status, await r.json()));   // esperado: 400 VALIDATION_ERROR
```

---

## 4. Definición de Terminado — incumplimientos

| Ítem DoD | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Incumplimientos menores** | (a) En el diálogo de confirmación la unidad se imprime cruda desde el catálogo: `… {valor} → {nuevo} h` / `%` (`configuracion-form.tsx:232`); en la pantalla el campo de % muestra `parametro.unidad` sin pasar por `texto()` (`:201`). (b) Los errores de rango que llegan **del servidor** muestran el mensaje por defecto de Zod en inglés (p. ej. «Too big: expected number to be <=72») junto al campo: el schema no define mensajes de `textos.ts` (`configuracion.schema.ts`). En el uso normal no se ve porque la pantalla valida antes, pero es texto visible no centralizado. (c) Separador « · » y formato de fecha armados en el componente (aceptable: no es copy). `scripts/verificar-claves-textos.ts` → «Claves de textos verificadas.» |
| Ningún texto visible con «turno» | Cumple | Ninguna clave `ui.configuracion.*`, `confirmaciones.configuracion.*` ni `errores.configuracion.*` contiene «turno». |
| Confirmación con el componente común de HU-C-25 en toda operación que guarda | Cumple | Única operación que guarda: «Guardar» → `ConfirmarAccionDialog` con cada valor anterior → nuevo; el 409 se muestra dentro del modal con «Recargar». |
| Tests en verde | **No cumple** | `actividad-usuario.test.ts` queda en rojo por el cambio de esta HU (ver §4.1). |
| (Checklist propio de la task) | 2 ítems sin tildar | «Migración y seed… sin modificaciones» y «Unitarias/UI, Postman con HTTP real y PostgreSQL real… capturas comparadas con el prototipo». La evidencia del dev reconoce: seed completo repetido **no verificado**, **sin revisión visual/capturas**, `npm run build` y `tsc` no terminados en verde por problemas de entorno. |

### 4.1 Tests ejecutados en esta validación

| Comando | Resultado |
|---|---|
| `npx vitest run src/server/configuracion src/app/api/configuracion "src/app/(dashboard)/configuracion"` | 6 archivos OK, 31/31 pruebas en verde (los 2 archivos `*.pg.test.ts` se saltan sin base PG). |
| `npm run test:pg -- src/server/configuracion` con `HU_N_SEED_COMPLETO=1` (base descartable) | `configuracion.service.pg.test.ts` **8/8** ✔ · `configuracion.seed.pg.test.ts` **1/1** ✔ (seed completo corrido dos veces: conserva los valores cambiados). Esto verifica el punto que el dev había dejado sin comprobar. **Ojo:** sin `HU_N_SEED_COMPLETO=1` el test del seed se salta en silencio. |
| `npx tsx scripts/verificar-claves-textos.ts` | «Claves de textos verificadas.» ✔ |
| `npx vitest run` (suite completa, 2 corridas) | **2 archivos fallan / 3 pruebas** (1.ª corrida: 4 pruebas). |
| → `src/server/shared/actividad-usuario.test.ts` | **FALLA por HU-N-01** (2 pruebas): `TypeError: Cannot read properties of undefined (reading 'findFirst')` en `configuracion.publico.ts:9`. HU-N-01 agregó la línea de N al agregador `actividad-usuario.ts`, pero no actualizó su test: este mockea las fachadas de I, C, L y estados, no la nueva de N, y el `TX` falso no tiene `historialParametro`. Es un test existente que la HU dejó en rojo. |
| → `src/lib/claves-textos.test.ts` | Falla en la suite completa y **pasa solo** (36/36 en 89 s): es un timeout por carga, no lo causa HU-N-01. |

Las pruebas de 403 no son automáticas: los tests de las rutas mockean `withPermission`. Hay que comprobarlo a mano (§3.2).

---

## 5. Extras y violaciones a RULES.md / DESIGN.md

### 5.1 Implementado sin que la HU lo pida (no bloquea)
- Concurrencia optimista con 409 «La configuración fue modificada por otra persona…» y botón «Recargar» (spec N §2.2).
- Restricción a enteros (P-N4) — ver DESVÍO en §1.
- Leyendas de vigencia bajo cada campo y «por defecto N» visible.
- Paginación del historial (10 por página).
- Fachada `usuarioRegistroOperaciones` (`configuracion.publico.ts`) sumada al agregador `actividad-usuario.ts` (para HU-F-05/G-05: quien cambió parámetros «registró operaciones» y su baja exige motivo).
- Server Action `guardarConfiguracion` además del `PUT` (ambos con el mismo schema y servicio).
- `GET /api/configuracion` responde **500** si falta una clave o tiene un valor inválido, mientras que `parametrosVigentes()` (usado por C/H) cae silenciosamente al valor por defecto. Inconsistencia documentada en la task; solo se manifiesta con datos corruptos.
- Cambio en `src/proxy.ts` (`/configuracion/:path*` al `matcher`), necesario para el guard por rol.

### 5.2 Violaciones / desvíos de RULES.md o DESIGN.md
| Referencia | Hallazgo | Severidad |
|---|---|---|
| DESIGN.md §8.1 (un único componente de paginación, «Mostrando 1–10 de N») | El historial usa una paginación propia («Página X de Y» + Anterior/Siguiente) en vez de `src/components/shared/pagination.tsx`, que ya soporta `onPageChange` y `mostrarRango`. | Menor |
| DESIGN.md §9 / HU-C-23 | Ver §4 (unidad «h»/«%» y mensajes de Zod del servidor no centralizados). | Menor |
| RULES.md Regla 2 | Cumple con opción (b); la ventana «valor cambiado sin fila de historial si fallan los reintentos» es la consecuencia aceptada en spec N §4. | Informativo |
| Colores | Solo tokens (`bg-success`, `text-destructive`, `text-muted-foreground`, etc.). Sin hex ni paleta default. | Cumple |

---

## 6. Datos para la prueba manual

**Contraseña de todas las cuentas del seed:** `Password123!` (`prisma/seed.ts:156`).

| Rol | Usuario | Uso |
|---|---|---|
| Gerente | `gerente@noctium.local` (Silvia Paredes) | Criterios 1, 2, 4, 5, H-07 |
| Gerente 2 | `gerente2@noctium.local` (Roberto Quiroga) | Historial con otro usuario; conflicto 409 (dos pestañas/navegadores) |
| Mesa de entrada | `mesa.entrada@noctium.local` (Marta Ruiz) | 403; crear reservas; reprogramar clases; ver `/reservas` |
| Profesor | `profesor1@noctium.local` | 403 |
| Alumno | `alumno01@noctium.local` (Sofía Fernández) … `alumno06@noctium.local` (Joaquín Pérez) | 403; inscribirse con resumen (C-20) y cancelar (C-14) |

### Casos por criterio

| Criterio | Cómo probarlo |
|---|---|
| 1 y 5 (defectos) | Con una base recién migrada/sembrada, Gerente → menú «Configuración del centro»: 24 h / 24 h / 75 % e historial vacío «Todavía no hubo cambios…». |
| 2 | Escribir 0, 73, 101, 1,5 y vacío: error junto al campo y «Guardar» inactivo. Bordes válidos 1, 72 y 100. Snippet de 400 de §3.2. |
| 3 — plazo de reserva | (1) Con plazo 24, Mesa inscribe con reserva a un alumno en una clase futura (o el alumno reserva desde «Solicitar clase»); anotar el vencimiento en `/reservas`. (2) Gerente cambia el plazo a 48. (3) La reserva anterior conserva su vencimiento; una reserva nueva vence a +48 h (o al inicio de la clase si es antes). (4) Mesa reprograma la clase de la reserva vieja a una fecha **anterior** a su vencimiento → el vencimiento pasa al nuevo inicio; a una fecha **posterior** → queda el vencimiento original (no +48 h). |
| 3 — anticipación | Alumno con una inscripción en una clase que empieza entre 24 h y 48 h desde ahora: con anticipación 24 puede cancelar en línea; Gerente la sube a 48 → el mismo alumno ya no puede (fuera de plazo). En «Solicitar clase», el resumen previo muestra el límite = inicio − anticipación vigente. |
| 3 — presentismo | Gerente → Indicadores → Índice de presentismo, período **mayo 2026**: el fixture HU-H-07 deja en Matemática 11 alumnos con 50 % y 1 con 75 %. Con umbral 75 figuran 11; con 76 figuran 12; con 40 ninguno. Cambiar el umbral y volver a consultar el mismo período: se aplica a todo el período. |
| 4 | Tras cada guardado, el historial muestra parámetro, anterior → nuevo, usuario y fecha; con `gerente2` aparece el otro nombre. Guardar sin cambios no es posible (botón inactivo). Con 11+ cambios aparece la segunda página. |
| 5 — 403 | Snippets de §3.2 con Mesa, Profesor y Alumno; ingresar a `/configuracion` con esos roles → `/sin-permiso`; el menú no muestra la entrada. |
| Conflicto (extra) | Gerente en dos pestañas; guardar en la primera; en la segunda cambiar el mismo campo y guardar → mensaje de conflicto dentro del diálogo con «Recargar». |

### Cómo preparar lo que falta (sin tocar código)

- **Reservas por vencer:** las que crea el paso 13 del seed vencen a las 24 h de correr el seed; si ya pasaron, crealas desde la pantalla de la clase (Mesa → clase futura Disponible → agregar alumno con reserva) o como alumno desde «Solicitar clase».
- **Clase que empieza entre 24 h y 48 h:** Mesa → «Configurar clase» con fecha de pasado mañana (o mañana, según la hora), confirmarla, e inscribir a `alumno01` (pagada o con reserva).
- **Volver a los defectos:** solo desde la pantalla (cada vuelta queda en el historial). El seed **no** restablece valores cambiados (es correcto). Para empezar con historial vacío hay que recrear la base (`npx prisma migrate reset`, que borra todos los datos de la base local de desarrollo).
- **Consultas de comprobación (solo lectura):** el dev dejó `docs/testing/Modulo N/hu-n-01/HU-N-01.sql` (parámetros, historial y `venceBaseEl`/`venceEl` de reservas, dentro de `BEGIN TRANSACTION READ ONLY … ROLLBACK`). Para correrlo contra la base local:

  ```bash
  docker exec -i noctium_db psql -U noctium -d noctium_dev < "docs/testing/Modulo N/hu-n-01/HU-N-01.sql"
  ```

  Correrlo antes y después de cambiar el plazo: los `venceBaseEl` de las reservas existentes no deben cambiar. También se puede ver en Prisma Studio (`npx prisma studio`) → `HistorialParametro` y `TurnoAlumno`.

---

## 7. Veredicto preliminar

### **Volver al dev**

Los cinco criterios están implementados y cubiertos (los dos textos literales coinciden, las reglas 7 y 8 se cumplen y los consumidores C/H respetan el «no hacia atrás»). El único motivo para devolverla es que incumple la Definición de Terminado en «tests en verde». Es una corrección chica y no debería hacer falta revalidar todo.

**Bloqueantes**
1. **`src/server/shared/actividad-usuario.test.ts` en rojo (2 pruebas)** por la línea que HU-N-01 agregó al agregador. Hay que sumar el mock de `@/server/configuracion/configuracion.publico` y la línea de N a las aserciones (orden I → C → L → N → estados).

**No bloqueantes (corregir en la misma vuelta si se puede)**
2. Tests de rutas sin verificación de 403 ni del nombre del permiso (`configuracion:leer`/`configuracion:editar`). Hoy el 403 solo está probado a mano.
3. Mensajes de Zod en inglés si el 400 viene del servidor, y la unidad «h»/«%» sin pasar por `textos.ts` (§4).
4. Paginación propia del historial en vez del componente común (DESIGN §8.1).
5. DESVÍO «solo enteros» (P-N4): el PO tiene que confirmar que lo acepta.
6. Faltan las capturas o la revisión visual contra el prototipo (lo reconoce la evidencia del dev): se cubre en la prueba manual.

Con el punto 1 corregido, la HU queda **lista para prueba manual** con los datos de §6.
