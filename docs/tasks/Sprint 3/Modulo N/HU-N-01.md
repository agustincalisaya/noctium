# TASK: HU-N-01 — Configurar parámetros del centro

**Módulo:** N (Configuración del centro) · **Sprint:** 3 · **SP estimado:** 2.
**Contrato:** `docs/specs/spec_modulo_N.md` §§1–4; `docs/RULES.md` (reglas 2–7, 10–11); `docs/DESIGN.md` §6 y §9; `docs/adicionales/sdd-metodologia.md`; `docs/templates/_template-HU.md` (ubicación real en `develop`).
**Dependencias:** HU-C-22, C-24, C-20, C-14 y H-07, ya incorporadas en `develop`; HU-C-25 (confirmación común) y HU-C-23 (textos centralizados).
**RBAC:** `configuracion:leer` y `configuracion:editar`, exclusivos de GERENTE, ya sembrados.
**Datos:** `ParametroSistema` y `HistorialParametro` ya migrados; no hay migración ni cambio de `schema.prisma`.
**Base de implementación:** `origin/develop` en `e3ea18d`, rama local `feature/HU-N-01` en worktree aislado. Fase 2 autorizada expresamente, incluido P-N4.

---

## 0. Relevamiento previo a implementación

### 0.1. Confirmado en el código y documentos

- `prisma/schema.prisma` contiene `ParametroSistema(clave, valor)` e `HistorialParametro(idHistorialParametro, clave, valorAnterior, valorNuevo, usuarioId, fecha)`. La migración `20261008120100_sprint3_modelo` inserta 24, 24 y 75; `prisma/seed.ts` usa `upsert({ update: {} })` para conservar los cambios. Los permisos están en el seed y en la migración de permisos del Sprint 3.
- `src/server/shared/parametros-vigentes.ts` consulta la BD en cada invocación, sin caché. Sus propiedades son `plazoPagoHoras`, `cancelacionAnticipacionHoras` y `umbralPresentismo`. La ruta que cita la spec (`src/server/shared/parametros.ts`) no es la del helper vigente. Si faltan claves o sus valores son inválidos, **este helper retorna el defecto**; el GET de la spec, en cambio, exige error 500 ante clave faltante. La lectura estricta de la pantalla verificará las tres filas originales antes de usar los valores; no se cambia el helper de los consumidores en esta HU. La discrepancia se documenta sin ocultarla.
- HU-C-22/C-24 crean las reservas desde `src/server/turnos/inscripcion.service.ts` leyendo `plazoPagoHoras` al inscribir; `venceBaseEl` persiste y la reprogramación aplica `min(venceBaseEl, nuevoInicio)` sin releer el plazo. La reapertura tras anular el último pago vuelve a leer el valor vigente. C-20 lee ambos plazos al armar el resumen previo; C-14 lee la anticipación dentro de la transacción de cancelación. H-07 lee el umbral al consultar la tabla de presentismo bajo. Sus decisiones son compatibles con el criterio 3, sin modificar sus módulos.
- `src/server/shared/actividad-usuario.ts` invita expresamente a agregar la línea de N. `Sidebar.tsx` y `rutas-por-rol.ts` aún no contienen la entrada. No existen `src/server/configuracion/`, las tres rutas API ni `/configuracion`.
- La foto «Configuracion del centro.png» muestra un encabezado y Guardar arriba a la derecha; tres campos en la tarjeta izquierda y «Historial de cambios» en la derecha; leyendas de vigencia y estado vacío. En móvil las tarjetas se apilan. El prototipo no sustituye el contrato: la confirmación previa exigida por §2.2 no aparece en esa captura.
- `docs/adicionales/mapa-pantallas-sprint-3.md` se incorporó a `develop` después del primer relevamiento, pero solo contiene HU-C-27 y **no** P-50. Se toma `/configuracion` y la foto como referencia, sin crear un mapa ajeno a esta HU. `docs/templates/_template-HU.md` es la ruta real del template; la ruta `docs/tasks/templates/_template-HU.md` del pedido/metodología está desactualizada.
- Divergencia detectada en Fase 1 y autorizada: `src/proxy.ts` no tiene `/configuracion/:path*` en su `matcher`; se añadirá esa entrada mínima para que aplique `rutas-por-rol.ts`.

### 0.2. Puntos de la spec y decisiones para este OK

| Punto | Estado | Aplicación en esta task |
|---|---|---|
| P-N1 | Resuelto por `prisma/seed.ts` y la migración de permisos | Reutilizar las dos acciones; no tocar RBAC. |
| P-N2 | Resuelto por modelos y helper real | No invalidar caché; historial según campos Prisma reales. |
| P-N3 | Resuelto por decisión expresa del PO en el backlog aportado y por C-14 | Anticipación vigente al cancelar; sin límite guardado en inscripción. |
| P-N4 | Confirmado expresamente por el usuario para Fase 2 | Los tres parámetros admiten únicamente enteros; no aceptar decimales. |

**Divergencias adicionales:** `obtenerNombresGerentes` citado en N §2.3 no existe: `spec_modulo_G.md` aclara que se usa `obtenerNombresPersonal` de `src/server/personal/personal.publico.ts`, que resuelve también gerentes. El catálogo de error `errores.configuracion.conflicto` y los textos de esta pantalla todavía no existen; se agregan entradas mínimas en `errores-dominio.ts` y `textos.ts`. El catálogo nuevo será la fuente para schema/DTO de N y una prueba de coincidencia con migración, seed y helper: estos últimos ya definen defectos propios y no se reescriben para simular una única fuente global.

**Trazabilidad y consistencia:** N §4 y RULES N.° 2 ordenan historial *después* del commit, con reintentos e idempotencia. Hay una ventana aceptada en la que el cambio puede estar visible antes del historial, y si todos los reintentos fallan se registra error; no se promete atomicidad entre ambas tablas. El historial tendrá una fila por campo cambiado y no habrá fila para un guardado sin cambios.

### 0.3. Archivos nuevos previstos

- `docs/tasks/Sprint 3/Modulo N/HU-N-01.md` — esta task.
- `src/types/configuracion.types.ts` — DTOs compartidos de configuración e historial.
- `src/server/configuracion/parametros-configurables.ts` — catálogo de claves, campos, rangos, unidades y defectos.
- `src/server/configuracion/configuracion.schema.ts` y `.test.ts` — valores y esperados estrictos; query de página.
- `src/server/configuracion/configuracion.service.ts`, `.test.ts`, `.pg.test.ts` y `configuracion.seed.pg.test.ts` — lectura estricta, guardado optimista, historial paginado, seed repetido y pruebas reales.
- `src/server/configuracion/configuracion.publico.ts` — consulta mínima de actividad del usuario, comprobada en el test PostgreSQL del servicio, sin exportar escrituras.
- `src/server/configuracion/actions.ts` y `.test.ts` — wrapper de acción de guardado.
- `src/app/api/configuracion/route.ts`, `.test.ts`, `historial/route.ts` y `historial/route.test.ts` — GET/PUT/GET protegidos.
- `src/app/(dashboard)/configuracion/page.tsx`, `configuracion-form.tsx` y `configuracion-form.test.tsx` — página protegida y componente de edición/historial.
- `docs/testing/Modulo N/hu-n-01/HU-N-01.postman_collection.json`, `HU-N-01-http.mjs`, `HU-N-01.sql` y `HU-N-01-evidencia.md` — contrato, recorrido HTTP en base descartable, comprobación SQL y resultados efectivos.

### 0.4. Archivos existentes a modificar (cambio puntual)

- `src/components/layout/Sidebar.tsx`: un enlace para GERENTE a `/configuracion` (más el import del icono, si se necesita).
- `src/server/shared/rutas-por-rol.ts`: `configuracion: ["GERENTE"]`.
- `src/proxy.ts`: agregar únicamente `/configuracion/:path*` al `matcher`.
- `src/server/shared/actividad-usuario.ts`: import y una línea que invoca la fachada pública de N.
- `src/server/shared/errores-dominio.ts`: una entrada `errores.configuracion.conflicto` → `CONFLICTO_EDICION_CONCURRENTE`, 409.
- `src/lib/textos.ts`: claves exclusivas `ui.configuracion.*`, `confirmaciones.configuracion.*` y `errores.configuracion.*` para campos, ayudas, validaciones, historial, confirmación, éxito y conflicto.
- `docs/DESIGN.md`: una fila de HU-N-01 en §6.4 que documente confirmación y banner de página completa, sin alterar otras convenciones.

No modificar dependencias C/H, `schema.prisma`, migraciones, seed, `package.json`, ni archivos compartidos adicionales sin una divergencia real detectada y documentada durante implementación. En particular, los tres archivos compartidos del menú, rol y actividad reciben solo las entradas indicadas; antes del OK no se toca ninguno.

---

## 1. Nota de alcance

Esta HU habilita al Gerente a ver y cambiar únicamente los tres parámetros ya consumidos por el producto final. Los valores rigen desde el guardado, con las semánticas de N §2.4; el historial se consulta en la misma pantalla. No se reimplementan ni modifican los lectores de C/H.

**Fuera de alcance:** umbral de poca inscripción de H-09/H-12, datos fijos del centro y otras claves, nuevo límite por inscripción, recálculo masivo o retroactivo, permisos nuevos, infraestructura de caché, nuevas pantallas para auditoría, refactors de Sidebar y cambios de backend de las HUs consumidoras. Sin verificaciones funcionales diferidas: se ejecutan los recorridos integrados con las HUs ya mergeadas.

## 2. Historia de Usuario

**Como** Gerente, **necesito** ver y modificar desde una pantalla los plazos y el umbral con que funciona el centro, **para** ajustarlos sin pedir un cambio en el sistema.

**SP estimado:** 2. Cinco criterios: (1) tres valores editables, defectos 24 h / 24 h / 75 %; (2) rangos enteros 1–72 h y 1–100 %, error junto al campo; (3) efecto desde guardar, reserva existente conserva vencimiento salvo reprogramación, cancelación usa el valor al cancelar y presentismo el vigente al consultar; (4) historial anterior/nuevo/usuario/fecha visible en pantalla; (5) defectos de migración/seed, mensaje literal «Configuración guardada» y acceso exclusivo al Gerente con 403 a otros roles.

## 3. Alcance de esta task

Backend, acción, tres endpoints, página `/configuracion`, entrada de navegación, actividad pública y evidencia de tres niveles según N §§2.1–2.4. La pantalla presenta rangos, unidades, defecto y ayuda temporal; permite cambios parciales sin sobrescribir campos intactos y pide confirmación C-25 con el resumen anterior → nuevo. El backend es dueño de validación, concurrencia, lectura estricta e historial; no hay reglas de negocio en UI, actions ni routes.

**Fuera de alcance de esta task:** lo indicado en §1; no implementar el catálogo de configuración genérico para otras claves.

## 4. Contrato Backend

### 4.1. Schemas Zod

`GuardarConfiguracionSchema = z.object({ valores, esperados }).strict()`, donde ambos objetos requieren `plazoPagoHoras`, `cancelacionAnticipacionHoras`, `umbralPresentismo` como `z.number().int()` dentro de los rangos derivados de `CATALOGO`; usar `.strict()` también en **cada objeto anidado** para rechazar cualquier clave ajena. `esperados` es obligatorio, incluso si no hay cambios. Los valores se convierten desde inputs de texto solo en UI, nunca mediante `z.coerce.number()` sobre el payload de API (evitar que `""` pase como 0). Errores 400 `VALIDATION_ERROR` con `flattenError`/detalles suficientes para ubicar `valores.<campo>`; el componente los asocia a cada campo.

`ListarHistorialQuerySchema = z.object({ pagina: z.coerce.number().int().positive().default(1) }).strict()`; se arma un objeto explícito con los parámetros recibidos para que `?foo=` también se rechace. Diez filas por página. Confirmar rango inválido de `esperados` como payload inválido, no como conflicto.

### 4.2. Servicios

`obtenerConfiguracion()` verifica la existencia y validez de las tres filas en `ParametroSistema`; retorna la lista contractual de N §2.1 con `clave`, `campo`, `valor`, `unidad`, `min`, `max`, `porDefecto`. Falta, valor no entero o fuera de rango: error interno registrado y respuesta 500, sin representar un defecto como dato persistido. Esta lectura estricta convive con la tolerancia actual del helper compartido sin alterarlo.

`guardarConfiguracion(input, actor)` calcula solo los campos con `valores !== esperados`. Cero cambios → `{ cambios: [] }` sin escritura. Los demás se procesan por clave alfabética dentro de una única `transaccion`; cada `updateMany({ where: { clave, valor: String(esperado) }, data: { valor: String(nuevo) } })` comprueba `count === 1`. Si alguno da 0, `ErrorDeDominio("errores.configuracion.conflicto")` y rollback integral. Los intactos no se escriben aun si cambiaron concurrentemente. Encola, por cada cambio, una fila de historial con id preasignado, strings anterior/nuevo, actor y fecha, para después del commit, con hasta tres reintentos, creación idempotente y log si falla. Reutiliza `transaccion`/`despuesDelCommit`; el escritor común `registrarHistorial` no acepta `HistorialParametro`, así que la política de reintentos para esa tabla se implementa dentro del módulo N, sin ampliar el escritor de otros dominios. Responde `{ cambios: ClaveConfigurable[] }` en orden de clave. Nada toca reservas, inscripciones ni indicadores ya computados.

`listarHistorialConfiguracion({ pagina })` filtra por las **tres** claves configurables, cuenta el total y ordena `fecha DESC, idHistorialParametro DESC`, offset de 10. Devuelve `items` con valores numéricos y `usuario: { id, nombre }`, fechas ISO, `pagina`, `por_pagina: 10`, `total`, `total_paginas`. Resuelve nombres en lote con `obtenerNombresPersonal(ids)`; usa id si falta la ficha. Una página fuera de rango devuelve `items: []` y el total real. La fachada `usuarioRegistroOperaciones(usuarioId, db?)` consulta si existe alguna fila de historial de ese actor; el agregador compartido la llama en su recorrido, sin ciclo de imports.

### 4.3. Route Handlers

| Ruta | Método | Permiso | Éxito |
|---|---|---|---|
| `/api/configuracion` | GET | `configuracion:leer` | 200, `{ data: { parametros }, error: null }` |
| `/api/configuracion` | PUT | `configuracion:editar` | 200, `{ data: { cambios }, error: null }` |
| `/api/configuracion/historial?pagina=1` | GET | `configuracion:leer` | 200, `{ data: { items, pagina, por_pagina, total, total_paginas }, error: null }` |

En los tres, `withPermission`, 401 sin sesión / 403 con otro rol; Zod antes del servicio; 400 `VALIDATION_ERROR`, 409 `CONFLICTO_EDICION_CONCURRENTE`, 500 sin detalles internos, siempre `{ data, error }`. La respuesta protegida no debe quedar cacheada. El PUT y la action aplican exactamente el mismo schema y servicio.

### 4.4. Server Action

`src/server/configuracion/actions.ts` exporta `guardarConfiguracion` como wrapper delgado para consumo del formulario: permiso `configuracion:editar` con `verificarPermiso`/patrón vigente, `safeParse`, invocación del servicio, traducción de respuesta y `revalidatePath("/configuracion")` tras éxito con cambios. Respuesta plana serializable con el mismo envelope; no lee ni escribe datos por su cuenta. Mantener nombres de exportación inequívocos respecto del servicio. La página puede consumir esta action para guardar; las rutas permanecen probables por API.

### 4.5. Trazabilidad (Regla N.° 2)

Patrón (b), `HistorialParametro`, una fila por parámetro modificado con valor anterior, nuevo, usuario y fecha. Id estable generado antes del commit y escritura posterior al commit con reintentos; si se agotan se registra el error, sin falsear la respuesta del cambio confirmado. Sin `DELETE`, sin historial de no-op y sin columnas nuevas de auditoría. Se verifica que un rollback por conflicto no encole historial.

## 5. Frontend

`/configuracion` llama a `exigirPermiso("configuracion:leer")`. En escritorio, tarjeta de parámetros a la izquierda e historial a la derecha; en móvil, apiladas. Cada campo lleva etiqueta, input numérico, unidad, rango y defecto visibles; bajo él, leyenda: reserva conserva plazo informado salvo reprogramación; cancelación usa valor al cancelar; índice usa umbral vigente sobre todo el período. El historial muestra parámetro, anterior → nuevo, usuario y fecha, diez por página, y el vacío literal del prototipo.

Guardar arriba a la derecha, deshabilitado sin cambios o durante envío. Validación local y servidor con error junto al campo; decimales, vacíos y fuera de rango se rechazan. Confirmación C-25 (`ConfirmarAccionDialog`) con cada anterior → nuevo y botón «Guardar configuración»; volver conserva lo ingresado. Error 409 dentro de la confirmación, con «Recargar» para traer la nueva versión sin pisar silenciosamente lo escrito. Guardado exitoso: banner inline de página completa «Configuración guardada», valores esperados actualizados e historial refrescado; sin toast duplicado. Error al cargar valores o historial: aviso contextual y reintento. Todos los textos centralizados y colores mediante tokens de `DESIGN.md`. Entrada de menú solo GERENTE y guard de ruta además del permiso del servidor.

**Fuera de alcance de frontend:** edición de datos fijos u otros parámetros, alterar la navegación de otros roles y herramientas de demostración visibles solo en la foto.

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios, integración de componentes y PostgreSQL descartable

- Schema: bordes 1/72/100, 24/24/75, 0/73/101, fracciones, strings, faltantes y claves ajenas incluso anidadas; query default y páginas inválidas.
- Servicio: GET de tres filas y error de datos ausentes/invalidos; no-op; cambio parcial; orden por clave; `updateMany` con comparación; conflicto en segundo campo revierte primero y no deja historial; dos editores y campos disjuntos; paginación, orden/desempate, nombres y fallback; fachada de actividad antes/después del cambio; reintento idempotente y fallo registrado del historial. Casos sensibles de transacción/concurrencia contra PostgreSQL real, no solo mocks.
- Route/action: 401, 403 para Mesa/Profesor/Alumno, 400, 409, 200 y envelope; no exponer secretos/detalles internos. Componente: confirmación con diff, cancelar sin guardar, validación por campo, doble envío, conflicto, actualización de historial y estados vacíos/carga/error. Probar regresiones focales de los consumidores C-14/C-20/C-22/C-24/H-07 con los valores nuevos, incluido plazo ya persistido y borde de presentismo.

### Nivel 2 — Postman / HTTP con sesión real

Colección de los tres endpoints: GERENTE GET/PUT/historial, no-op, bordes 1/72/100, decimal/rango/clave extra/faltante → 400, sesión ausente → 401, cada rol ajeno → 403, dos lecturas y guardado concurrente → 409 sin parcial, historial paginado 10/11 con usuario y fecha. Sin cookies ni credenciales embebidas. Registrar ejecución real y códigos en `HU-N-01-evidencia.md`; generar la colección no cuenta como ejecución.

### Nivel 3 — BD / SQL

En BD de prueba descartable: tres filas tras migración, seed repetido sin sobreescribir cambio, actualización solo de claves tocadas, anterior/nuevo/usuario/fecha en `historial_parametros`, no-op sin fila, rollback íntegro tras conflicto y ningún recálculo de `venceBaseEl`/`venceEl` de reservas existentes. Reprogramar respeta base anterior; reserva nueva y reapertura usan plazo actualizado; cancelación usa anticipación vigente; consulta de presentismo aplica el umbral vigente sobre el período. SQL de comprobación de solo lectura, evidencia con fecha/comandos/resultados y estado de cada criterio.

**Verificación visual:** pantalla Gerente en escritorio/móvil contrastada con la foto, historial vacío y con cambios, 403 para otros roles, confirmación y banner. Ejecutar tests pertinentes, TypeScript, lint, build y `git diff --check`; reportar resultados reales y fallos previos sin marcarlos aprobados.

## 7. Checklist de Definition of Done

- [x] Relevamiento y decisiones de §0 confirmados explícitamente antes de tocar código.
- [x] Catálogo, schema, service, fachada, action y tres routes implementados con permisos granulares y envelope estándar.
- [x] Tres rangos enteros y errores junto al campo; solo cambios reales con compare-and-swap, rollback completo al conflicto.
- [x] Historial por campo, actor y fecha, paginado en la misma pantalla; escritura tras commit e idempotencia/reintentos comprobados.
- [x] Página y menú solo para Gerente, confirmación C-25 y «Configuración guardada» literal, textos centralizados y tokens de diseño.
- [x] C/H consumen los valores en sus momentos contractuales; reservas ya existentes conservan vencimiento base.
- [ ] Migración y seed existentes respetan defectos y cambios; sin modificaciones de schema, seed ni módulos consumidores.
- [ ] Unitarias/UI, Postman con HTTP real y PostgreSQL real ejecutados y documentados; capturas comparadas con el prototipo.
- [x] TypeScript, lint, build y `git diff --check` ejecutados y resultados anotados, incluidos los bloqueos del entorno.
- [x] Diff exclusivo de HU-N-01 en `feature/HU-N-01`; sin commit, push, merge ni rebase por parte del agente.
