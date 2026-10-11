# TASK: HU-F-01 — Registrar y modificar datos de mesa de entrada

**Módulo:** F (Personal de mesa de entrada) · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 3
**Contrato de referencia:** `docs/specs/spec_modulo_F.md` §1 (visión general, modelo y utilidades compartidas), §2.1 (alta), §2.2 (modificación), §2.4 (detalle de la ficha, solo la parte que esta HU necesita: ver sección 1), §3.1 a §3.3, §3.6 a §3.9 y §4 · `docs/specs/spec_modulo_A.md` §2.4 y §2.5 (cuentas) · `docs/specs/spec_modulo_D.md` §2.1, §2.2 y §2.6 (patrón de ficha con identidad y contacto) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-F-01, criterios 1 a 7, y HU-A-06, criterios 1, 2, 5 y 6 para este rol) · `docs/tasks/Sprint 3/PR-0.md` §2.7, §2.9, §2.13, §2.14 y §2.16 · `docs/tasks/Sprint 3/Modulo A/HU-A-06.md` (sección 9: qué dejó hecho)
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figura 91 («Nuevo integrante»), **solo la página 82**. Muestra únicamente el alta; la edición reabre el mismo formulario precargado. Las capturas son orientativas: ante cualquier diferencia prevalece el backlog.
**RBAC:** solo **GERENTE**. Acciones `personal:crear`, `personal:editar` y `personal:leer` (ya sembradas para GERENTE en `prisma/seed.ts`). Cualquier otro rol recibe `403 SIN_PERMISO` en el servidor aunque la interfaz oculte la opción (spec F §3.7).
**Schema:** ya completo, **sin migración y sin tocar `schema.prisma`**. El PR 0 creó `FichaMesaEntrada` (`fichas_mesa_entrada`) con `version`, los campos normalizados, `creadoPorUsuarioId`, `modificadoPorUsuarioId` y el índice del listado. Si el relevamiento encuentra algo que falte, se coordina con el responsable del PR 0: esta HU no agrega migraciones.
**Estado de la HU:** relevamiento resuelto (sección 0.1); lista para implementar por etapas.

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:

- **Archivos nuevos a crear** (ruta exacta, uno por uno). Punto de partida propuesto, a corregir contra el repo:
  - `src/server/personal/personal.service.ts` (`crearIntegrante`, `modificarIntegrante`, `obtenerDetalleIntegrante`, `listarPersonal` en su versión mínima), `personal.schema.ts`, `actions.ts` y sus tests (`.test.ts` y `.pg.test.ts`). `personal.publico.ts` **ya existe** (PR 0).
  - `src/types/personal.types.ts`.
  - `src/server/shared/identidad-persona.schema.ts` (`construirIdentidadPersonaSchema`) y su test. **No existe todavía**: la crea esta HU y la reutilizan F-03 y G-01.
  - Los Route Handlers `src/app/api/personal/route.ts` (`POST` y `GET`) y `src/app/api/personal/[id]/route.ts` (`GET` y `PATCH`), con sus tests.
  - Las pantallas en `src/app/(dashboard)/personal/`: listado mínimo, `nuevo`, `[id]` (ficha) y `[id]/editar`, con un formulario de identidad y contacto propio de la ruta (Regla N.° 11: en `src/app/**` solo `page.tsx`, `layout.tsx` y componentes propios de la ruta).
  - `prisma/seed/fixtures/hu-f-01.ts` y una línea en `prisma/seed/fixtures/index.ts` (sin editar `seed.ts`).
  - `docs/testing/HU-F-01-evidencia.md`.
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno). Se esperan al menos: `src/server/shared/rutas-por-rol.ts` (+ su test) y el `matcher` de `src/proxy.ts` si hace falta, `src/components/layout/Sidebar.tsx` (ítem «Personal de mesa de entrada», solo Gerente), `src/server/shared/errores-dominio.ts` y `src/lib/textos.ts` (claves nuevas), `docs/DESIGN.md` (§6.4), `docs/RULES.md` y `docs/specs/spec_modulo_F.md` (nota aditiva).
- Todo punto marcado **«relevar antes de asumir»**, con la pregunta concreta (nunca resuelto por inferencia propia del agente). Lo que ya se verificó en el repo al escribir esta task está señalado como «Verificado»: confirmarlo, no volver a investigarlo.
  1. **Alcance de la ficha y del listado (DEC-38).** La spec dice que F-01 crea `/personal` con «Nuevo integrante» y una tabla mínima, y que F-03 le suma búsqueda y paginación; y que la ficha (`/personal/[id]`) la consumen F-01 (criterio 5: «Editar» desde la ficha), A-06 (sección «Cuenta de acceso») y F-05. Propuesta por defecto: F-01 entrega el listado mínimo (todas las fichas, sin `q` ni paginación, ordenadas como pide §2.3) y una ficha **mínima**: datos de la ficha, `version`, fechas, sección «Cuenta de acceso» con `obtenerResumenCuenta` y el botón «Editar». El historial de estados, `cajaAbierta`, `motivoObligatorioAlDesactivar` y los botones de desactivar y reactivar quedan para F-05. Confirmar la partición y cómo se mantiene `obtenerDetalleIntegrante` extensible sin cambiar firmas.
  2. **Utilidad compartida `identidad-persona.schema.ts`.** Verificado: no existe `src/server/shared/identidad-persona.schema.ts` ni `busqueda-persona.ts`. La spec pide crear el primero en esta HU, con la misma definición de `spec_modulo_D.md` §2.1 sin el contacto. Reportar cómo está definida hoy la identidad en `src/server/profesores/profesor.schema.ts` y en `contacto.schema.ts` (nombres reales de `emailContactoSchema`, `telefonoContactoSchema` y `campoOpcional`, si existen), y confirmar que **no se refactoriza D ni B**: el schema nuevo es nuevo. `busqueda-persona.ts` es de F-03: no se crea acá.
  3. **Diferencias entre la spec F y el código ya existente.** Verificado en `src/server/personal/personal.publico.ts`: `obtenerNombresPersonal` devuelve un arreglo `{ usuario_id, nombre_completo }[]` (la spec §2.7 dice `Record<usuarioId, "Apellido, Nombre">`) y `bloquearIntegranteActivo` lanza `errores.caja.integranteInactivo` y devuelve `{ fichaId }` (la spec dice `errores.personal.integranteInactivo` y `Promise<void>`). Esta HU **no toca** ese archivo. Confirmar que las diferencias solo se anotan en la nota aditiva. Reportar cualquier otra.
  4. **Servicio de cuentas.** Verificado en `src/server/usuarios/cuenta.service.ts`: existen `verificarEmailNoAsociadoAOtraCuenta`, `crearCuentaParaFicha`, `cambiarEmailCuenta` y `obtenerResumenCuenta`. Reportar las firmas reales (la spec marca la de `verificarEmailNoAsociadoAOtraCuenta` «a confirmar contra el código») y cómo las usan hoy `crearProfesor` y `modificarProfesor` en `profesor.service.ts`: el orden de los pasos, el manejo de `P2002`, el tipo `CuentaCreadaEnAlta` y `obtenerCuentaDeProfesor`. La deuda de A-06 (sección 9.4) ya registra que esos fragmentos están duplicados entre alumnos y profesores; F-01 sería la tercera copia y G-01 la cuarta. Proponer, **sin modificar alumnos ni profesores**, si F sigue el mismo patrón en su propio servicio (propuesta por defecto) o si conviene extraer algo mínimo y compartido solo para F y G.
  5. **Claves de error y textos.** Verificado: no existe ninguna clave `errores.personal.*`; existen `errores.cuenta.emailYaAsociado` (`EMAIL_YA_ASOCIADO`, 409) y `errores.profesor.conflictoEdicion` (`CONFLICTO_EDICION_CONCURRENTE`, 409), pero la spec F cita `errores.general.conflictoEdicion`. Reportar qué claves existen para DNI duplicado y conflicto de edición en alumnos y profesores, y proponer las nuevas (`DNI_DUPLICADO` 409, `INTEGRANTE_NO_ENCONTRADO` 404, el conflicto de edición) con sus textos exactos del backlog. Todo texto visible sale de `src/lib/textos.ts` (`docs/DESIGN.md` §9).
  6. **Parámetros del DNI.** Verificado: la longitud sale de `ParametroSistema` con `getParametroNumerico("dni_longitud_min" / "dni_longitud_max")`, como en `profesor.schema.ts`. Confirmar cómo se obtienen en el servidor y en la pantalla, y que el schema se construye con ellos en las tres capas (formulario, acción y ruta).
  7. **Permisos, rutas y menú.** Verificado: `personal:crear`, `personal:editar`, `personal:leer` y `personal:cambiar_estado` están sembrados para GERENTE; `rutas-por-rol.ts` no tiene ninguna regla para `personal` y `Sidebar.tsx` no tiene el ítem «Personal de mesa de entrada». Proponer: la regla `personal: ["GERENTE"]`, el ítem del menú, un caso en `rutas-por-rol.test.ts` y si el `matcher` de `src/proxy.ts` necesita cambios. Confirmar el patrón `withPermission("personal:<accion>")` en las rutas y `exigirPermiso` en las pantallas (PR-0 §2.7).
  8. **Unicidad «al salir del campo» (criterio 3).** La spec dice que es una consulta de UI hacia el mismo servicio de unicidad, pero no nombra el endpoint ni la acción. Reportar cómo resuelven hoy esa verificación el alta de profesor y de alumno (si hay una acción, una ruta o solo la validación del servidor al confirmar) y proponer lo mínimo: sin revelar a quién pertenece un email (criterio 3) y excluyendo la propia ficha al editar.
  9. **Alta transaccional.** Confirmar el orden de `crearIntegrante` (unicidad de DNI → `verificarEmailNoAsociadoAOtraCuenta` → `crearCuentaParaFicha` con rol `MESA_ENTRADA` → insertar la ficha con `activo = true`, `creadoPorUsuarioId`, `version = 0` y nombres normalizados con `normalizarTexto()`), el `catch` de `P2002` fuera de la transacción y que el servicio nunca ve ni guarda la contraseña inicial (regla 3.8). Reportar si hace falta algún bloqueo (`bloquear`) o alcanza con las restricciones únicas, y qué recurso es la ficha del personal en `bloquear.ts` (verificado: `bloquearIntegranteActivo` ya usa `recursos: { fichasMesaEntrada: [...] }`).
  10. **Modificación y concurrencia.** Confirmar `modificarIntegrante` con `updateMany … where version`, el `200` con `campos_modificados: []` cuando nada cambia (sin escribir), que la unicidad del DNI y del email **excluyen la propia ficha** y que el email sin cambios no se revalida, que cambiar el email llama a `cambiarEmailCuenta` en la misma transacción y **no revoca sesiones**, y que cambiar el DNI no toca la contraseña. Confirmar el supuesto P-F6: se puede modificar una ficha inactiva.
  11. **Pantallas y patrones de interfaz.** Verificado: existen `ConfirmarAccionDialog`, `ConfirmarDescarteDialog`, `CuentaAccesoCard` (`src/components/shared/`) y `DirtyStateContext` (`src/components/sesion/`). Reportar cómo los usan hoy los formularios de profesor y alumno (`nuevo-profesor-form.tsx`, `editar-profesor-form.tsx`), qué se reutiliza tal cual y qué hay que componer de nuevo, y cómo se garantiza que «Guardar» esté deshabilitado sin cambios y que «Cancelar» pida confirmación con datos ingresados o cambios (criterio 7). El formulario es **uno solo** para alta y edición (modo).
  12. **Prototipo y mapa de pantallas.** La spec F cita `docs/adicionales/mapa-pantallas-sprint-3.md` (fichas P-45 y P-46, decisiones DEC-14, 15, 37, 38, 39 y 44). Verificado: **ese archivo no está en el repo** y **no hace falta leerlo**: lo que esta HU necesita de las fichas P-45 y P-46 y de DEC-14 y DEC-15 está resumido en la sección 5. Las pantallas se construyen con la spec F, esa sección y el prototipo (figura 91, página 82). No leer el mapa ni el PDF. Reportar cualquier diferencia entre la sección 5 y la spec o el código; no se resuelve por inferencia.
  13. **Feedback de cada pantalla (`docs/DESIGN.md` §6.4).** Una HU que no está en la tabla define su feedback con el criterio de §6.1 a §6.3 y lo agrega **antes** de implementar. Proponer las filas de P-45 (listado mínimo), P-46 en modo alta, consulta y edición, con las confirmaciones (HU-C-25, DEC-15) de la spec §2.1 y §2.2 y los mensajes «Integrante registrado correctamente» (completado con la cuenta creada, A-06 criterio 5) e «Integrante actualizado correctamente».
  14. **Tests existentes afectados.** Listar los tests de Sprint 1 y 2 y de A-06 que se ven afectados por la regla de ruta nueva o el ítem del menú. Ningún test de Sprint 1, 2, A-06 y A-05 se borra ni se debilita.
  15. **Escenarios y fixture.** `prisma/seed/fixtures/hu-f-01.ts` con fichas de prueba para los escenarios de la sección 6: al menos un integrante activo con DNI y email conocidos (duplicados), uno inactivo (el DNI sigue reservado) y los dos de mesa de entrada del seed base. Verificar que la fixture no crea fichas sin pasar por `crearCuentaParaFicha` (regla 3.1, salvo para estas fichas de prueba si el relevamiento lo justifica). Proponer cómo se arma el inactivo sin depender de F-05.

**Estado: relevamiento resuelto.** Las decisiones están en la sección 0.1 y no se relevan de nuevo. Se implementa por etapas con pausa entre una y otra (sección 8).

### 0.1. Decisiones del relevamiento (resueltas, no relevar de nuevo)

El relevamiento confirmó lo que la task da por existente (modelo `FichaMesaEntrada` completo, permisos `personal:*` para GERENTE, `crearCuentaParaFicha`, `cambiarEmailCuenta`, `obtenerResumenCuenta`, `CuentaAccesoCard`, los dos diálogos, `DirtyStateContext`) y que **no hace falta migración**: `schema.prisma` no se toca. Decisiones:

1. **Partición con F-03 y F-05.** F-01 entrega el listado mínimo y la ficha mínima. `obtenerDetalleIntegrante(id, db?)` devuelve un `DetalleIntegrante`; F-05 le suma `historialEstados`, `cajaAbierta` y `motivoObligatorioAlDesactivar` como propiedades nuevas, sin cambiar la firma. Si la ficha no existe, lanza `ErrorDeDominio("errores.personal.noEncontrado")`: la ruta responde `404` y la página usa `notFound()`. `listarPersonal()` va sin parámetros, con el orden `apellidoNormalizado`, `nombreNormalizado`, `dni`; F-03 le suma un parámetro opcional `query`.
2. **Identidad.** `construirIdentidadPersonaSchema(min, max)` es nuevo y **no refactoriza D ni B**. Nombre y apellido: `normalizarTextoNombre`, 2 a 50 caracteres, `/^[\p{L}\s'-]+$/u`. DNI: `/^\d+$/` con la longitud configurada. Fecha: `fechaCalendarioValidaSchema` de `src/server/shared/fecha.ts` (la que usa profesor), no futura. Género: `z.enum(GENERO_VALORES)` (el arreglo de constantes del repo), no `z.nativeEnum(Genero)`, por el bundling del cliente. **No se aplica la regla de mayoría de edad de profesor** (no está en el backlog ni en la spec F). `busqueda-persona.ts` no se crea.
3. **Mensajes del schema.** Salen de `textos.ts` (`docs/DESIGN.md` §9), con el prefijo `ui.comun.identidad.*`, aunque D los tenga escritos en el código. El email vacío usa su propio mensaje, el del backlog: «Ingresá el email: con él se crea la cuenta de acceso» (`emailContactoSchema` con cadena vacía responde «Ingresá un email válido»).
4. **Género en la modificación.** Acepta `null` («Sin especificar»), como en profesor, para poder volver atrás. Diferencia con la spec §2.2 (`.partial()`), que se anota.
5. **Forma de la cuenta.** El `201` y el detalle devuelven `ResumenCuenta` tal cual (`estado`, `email`, `rol`, `debe_cambiar_password`, en snake_case), que es lo que consume `CuentaAccesoCard`. Diferencia con los ejemplos de la spec (camelCase), que se anota.
6. **Código del 400.** `VALIDATION_ERROR` con los errores por campo en `detalles`, como la spec F y A-05 (alumnos y profesores usan `VALIDACION`).
7. **`ip` del evento.** `crearIntegrante(input, usuarioRegistranteId, ip?)`, con la IP opcional para el evento `CUENTA_CREADA`, como profesor.
8. **Orden en la modificación.** Primero el `updateMany` por `version` y después `cambiarEmailCuenta` (la ficha y después la cuenta), como la spec §2.2 y como hará F-05 con `desactivarCuenta`. No el orden de profesor. Como `cambiarEmailCuenta` ya verifica la unicidad excluyendo la propia cuenta, no se llama antes a `verificarEmailNoAsociadoAOtraCuenta` cuando la ficha tiene cuenta.
9. **Disponibilidad al salir del campo.** `verificarDisponibilidadIntegrante({ dni?, email?, excluirId? })` como Server Action de capa delgada, con la lógica en `personal.service.ts`: el DNI contra todas las fichas menos `excluirId`, el email con `verificarEmailNoAsociadoAOtraCuenta` excluyendo el `usuarioId` de la propia ficha. Devuelve solo `{ dni_disponible, email_disponible }`, sin decir de quién es el email. Permiso `personal:crear` en el alta y `personal:editar` en la edición. Sin Route Handler.
10. **Alta transaccional.** Orden: unicidad del DNI → `crearCuentaParaFicha` (que hace `INSERT … ON CONFLICT DO NOTHING RETURNING`) → insertar la ficha. Sin `bloquear`: alcanzan los índices únicos. El `catch` de `P2002` va fuera de la transacción y filtra por `dniFichaMesaEntrada`; `emailUsuario` queda solo como defensa. Los nombres se guardan con `normalizarTextoNombre` y las columnas normalizadas con `normalizarTexto`. El servicio le entrega el DNI a A y nunca ve la contraseña.
11. **Claves de error.** `errores.personal.dniDuplicado` (`DNI_DUPLICADO` 409, «Ya existe un integrante de mesa de entrada con ese DNI»), `errores.personal.noEncontrado` (`INTEGRANTE_NO_ENCONTRADO` 404, con el mismo patrón de redacción que `errores.profesor.noEncontrado`) y `errores.personal.conflictoEdicion` (`CONFLICTO_EDICION_CONCURRENTE` 409, «La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.», el texto de la spec y de profesores). `EMAIL_YA_ASOCIADO` reutiliza `errores.cuenta.emailYaAsociado`. El texto del mapa («Otra persona está modificando estos datos. Intentá de nuevo.») ya existe como `errores.transaccion.ocupada` y corresponde a otro error: no se usa para el conflicto de edición.
12. **Permisos, rutas y menú.** Regla `personal: ["GERENTE"]` con su caso de test (GERENTE ve `/personal` y `/personal/x/editar`; los otros tres roles no), **`/personal/:path*` en el `matcher` de `src/proxy.ts`** (sin eso el proxy no aplica la regla de rol ni la redirección por la marca de primer ingreso) e ítem «Personal de mesa de entrada» en el menú del GERENTE. Rutas con `withPermission`, acciones con `verificarPermiso`, páginas con `exigirPermiso`; «Editar» se muestra según `tienePermiso("personal:editar")`.
13. **Pantallas.**
   - Un formulario único con dos modos, `integrante-form.tsx`, en `src/app/(dashboard)/personal/` (lo usan `nuevo` y `[id]/editar`); `onSubmit` manual sin `useActionState`, `setDirty` con `useDirtyState` y `ConfirmarDescarteDialog` en «Cancelar».
   - La edición calcula los cambios campo por campo con valores normalizados, `disabled={!hayCambios || pendiente}`, y ante un conflicto ofrece «Recargar» con `router.refresh()` y `key={version}`.
   - **Confirma siempre** el alta y la edición (DEC-15), a diferencia de profesor, que solo confirma al cambiar el email. La edición avisa además si cambia el email de ingreso.
   - Alta: título de confirmación de DEC-15 («¿Estás seguro de que querés registrar a <Nombre> <Apellido> como mesa de entrada?») y, como en A-06, una línea de detalle: se crea su cuenta con ese email y su DNI como contraseña inicial. Botones de confirmación: «Registrar integrante» y «Guardar cambios».
   - Los botones **«Cancelar» y de guardar van arriba a la derecha**, como el prototipo (los formularios existentes los tienen abajo).
   - Se usan tal cual: los dos diálogos, `useDirtyState`, `CuentaAccesoCard`, `Breadcrumb` y `ROL_LEGIBLE`. La edición va en `/personal/[id]/editar` (como alumnos), no con `?modo=edicion`. `error.tsx` en el segmento, como profesores.
   - El texto de ayuda de la sección Contacto es el del prototipo («El email es obligatorio: con él se crea la cuenta de acceso.»); el del error de email vacío es el del backlog. Son dos textos distintos.
14. **Después del alta** se navega a la **ficha** con un banner («Integrante registrado correctamente. Se creó su cuenta: …»), porque ahí se ve la «Cuenta de acceso» recién creada (A-06, criterio 5). El precedente de alumno es el listado, pero aquí gana el criterio de A-06. Tras editar, se vuelve a la ficha con el banner «Integrante actualizado correctamente».
15. **DESIGN §6.4** (filas a agregar antes de implementar las pantallas): P-45 listado, sin acciones propias, con el banner de vuelta si corresponde; P-46 alta, página completa + `ConfirmarAccionDialog` («Registrar integrante») → ficha con banner; P-46 edición, página completa + `ConfirmarAccionDialog` («Guardar cambios», con el aviso de email si cambia) → ficha con banner; P-46 consulta, sin acciones con feedback en esta HU.
16. **Tests afectados.** Solo `rutas-por-rol.test.ts` (un caso nuevo). No hay tests de `Sidebar` ni del `matcher`; `publico.aislamiento.test.ts` mira los imports de `personal.publico.ts`, que no se toca.
17. **Fixture.** `hu-f-01.ts`, idempotente (busca por DNI antes de crear). Un integrante activo (DNI `8806100x`, email `f01.*@noctium.local`) creado con `crearIntegrante`: nace con la marca de cambio obligatorio, así que sirve también para el primer ingreso. Un integrante inactivo: se crea con `crearIntegrante` y después, en una `transaccion`, `desactivarCuenta` y `updateMany` de la ficha con `version + 1`, sin escribir historial de estados (eso es de F-05). Las dos fichas del seed base (DNI 25100001 y 25100002) las crea `seed.ts` con `upsert` directo y sus cuentas no tienen la marca: es la excepción de la regla 3.1. **No** se suma una ficha «Sin cuenta».

**Diferencias entre la spec F y el código (van en la nota aditiva de `spec_modulo_F.md`, sin reescribir lo existente):**

- `personal.publico.ts`: `obtenerNombresPersonal` devuelve un arreglo `{ usuario_id, nombre_completo }[]` (la spec dice `Record`) y también lee `FichaGerente`; `bloquearIntegranteActivo` lanza `errores.caja.integranteInactivo` y devuelve `{ fichaId }` (la spec dice `errores.personal.integranteInactivo` y `Promise<void>`).
- `errores.general.conflictoEdicion` no existe; se crea `errores.personal.conflictoEdicion` (decisión 11).
- `verificarEmailNoAsociadoAOtraCuenta` tiene la firma `(email, { excluirUsuarioId? }, db)`, no `(tx, email)`, y vive en `cuenta.service.ts`.
- `crearCuentaParaFicha` acepta `ip`, que la firma de `crearIntegrante` de la spec no recibe (decisión 7).
- La forma de la cuenta en el `201` y el detalle es `ResumenCuenta` en snake_case, no camelCase (decisión 5).
- El código del 400 es `VALIDATION_ERROR` (decisión 6).
- Un `P2002` sobre `emailUsuario` no puede ocurrir en el alta (decisión 10).
- El email vacío usa un mensaje propio del backlog (decisión 3).
- `z.enum(GENERO_VALORES)` en lugar de `z.nativeEnum(Genero)`, y en la modificación el género acepta `null` (decisiones 2 y 4).
- No se aplica la mayoría de edad de profesor (decisión 2).
- `fechaCalendarioValidaSchema` está definido en dos archivos (`shared/fecha.ts` y `shared/fecha.schema.ts`); F usa el de `fecha.ts`. La duplicación queda como deuda.
- La edición confirma siempre y los botones van arriba a la derecha, como el prototipo (decisión 13).

---

## 1. Nota de alcance

HU-F-01 es la base del bloque de mesa de entrada: sin ella no hay forma de dar de alta al personal desde el sistema. Es también la **primera HU que aplica A-06 a mesa de entrada**: el alta crea la ficha y la cuenta en la misma transacción, y con ella se verifican los criterios 1, 2, 5 y 6 de A-06 para este rol.

**Lo que ya existe y esta task usa** (verificado en el repo):

| Qué | Dónde |
|---|---|
| `FichaMesaEntrada` con `version`, campos normalizados, auditoría e índice del listado | `prisma/schema.prisma` |
| `personal:crear`, `personal:editar`, `personal:leer` y `personal:cambiar_estado` para GERENTE | `prisma/seed.ts` |
| `crearCuentaParaFicha`, `verificarEmailNoAsociadoAOtraCuenta`, `cambiarEmailCuenta`, `obtenerResumenCuenta` | `src/server/usuarios/cuenta.service.ts` |
| `obtenerNombresPersonal` y `bloquearIntegranteActivo` (no se tocan) | `src/server/personal/personal.publico.ts` |
| `transaccion`, `ErrorDeDominio`, `bloquear`, `ahora()` | `src/server/shared/` |
| `ConfirmarAccionDialog`, `ConfirmarDescarteDialog`, `CuentaAccesoCard`, `DirtyStateContext` | `src/components/shared/`, `src/components/sesion/` |
| Parámetros `dni_longitud_min` y `dni_longitud_max` | `ParametroSistema` |
| El patrón completo de ficha con cuenta (alta, edición, contacto) | `src/server/profesores/`, `src/app/(dashboard)/profesores/` |

**Lo que no existe y hace esta task:** el módulo `src/server/personal/` (servicio, schemas, acciones), `construirIdentidadPersonaSchema`, los Route Handlers de `/api/personal`, las pantallas de listado mínimo, alta, ficha y edición, la regla de ruta y el ítem del menú, los textos, la fixture y la nota aditiva en la spec F.

**Decisiones resueltas (no relevar de nuevo):**
- La ficha y la cuenta son una unidad: el alta crea las dos en la misma transacción y, si algo falla, no queda ninguna. El rol de la cuenta lo fija el tipo de ficha (`MESA_ENTRADA`); no se puede elegir otro.
- La contraseña inicial es el DNI y la maneja solo el módulo A: este módulo no la recibe, no la devuelve y no la escribe en logs (regla 3.8).
- El email de la ficha es el email de la cuenta: cambiar uno cambia el otro, con la misma validación de unicidad y en la misma transacción. El cambio de email **no revoca sesiones**.
- El DNI es único entre **todas** las fichas de mesa de entrada, activas e inactivas, y no se compara contra alumnos, profesores ni gerentes (regla 3.2). Doble validación: aplicativa dentro de la transacción y constraint `@unique` con captura de `P2002`.
- Concurrencia optimista (Regla N.° 7): modificar exige `version` y se valida con `updateMany`; `count === 0` es `409 CONFLICTO_EDICION_CONCURRENTE`.
- Trazabilidad (Regla N.° 2), opción (a): `creadoPorUsuarioId` y `createdAt…` en el alta; `modificadoPorUsuarioId`, `updatedAt…` y `version` en la modificación. Cargar el contacto en el alta no es una modificación: `modificadoPorUsuarioId` queda en `NULL`.
- Se puede modificar una ficha inactiva (P-F6); corregir un dato no la reactiva.
- Las utilidades compartidas nuevas son puras y sin estado, y las reutilizan F-03 y G-01 sin acoplamiento de dominio.

**Fuera de alcance de esta task (explícito):**
- Desactivar y reactivar (HU-F-05, incluida la regla de la caja abierta y el historial de estados); el criterio 7 de A-06 queda para esa HU.
- Búsqueda y paginación del listado (HU-F-03).
- `usuarioRegistroOperaciones`, `actividad-usuario.ts` y cualquier lectura de caja.
- Modificar `personal.publico.ts` ni corregir sus diferencias con la spec (solo se anotan).
- Refactorizar alumnos, profesores o sus servicios de cuenta (la duplicación es deuda conocida de A-06).
- Que el integrante se modifique a sí mismo desde «Mi cuenta» (HU-A-06, criterio 4).
- Gestión de roles, borrado físico y cualquier cambio de esquema.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** registrar y mantener actualizados los datos de identidad y contacto de un integrante del personal de mesa de entrada
**Para** disponer de su ficha dentro del sistema, poder contactarlo y contar con el email que identifica su cuenta

**SP estimado:** 3 (1 + 1 + 1: absorbe HU-F-02, contacto, y HU-F-04, modificar)

---

## 3. Alcance de esta task

Implementación frontend y backend conforme a `spec_modulo_F.md` §2.1 y §2.2. Incluye:
- Servicio del personal: `crearIntegrante`, `modificarIntegrante`, `obtenerDetalleIntegrante` (parte mínima) y `listarPersonal` (versión mínima, sin búsqueda ni paginación).
- Schemas Zod de alta y de modificación, y la utilidad compartida `construirIdentidadPersonaSchema`.
- Route Handlers `POST /api/personal`, `GET /api/personal`, `GET /api/personal/[id]` y `PATCH /api/personal/[id]`, y las Server Actions equivalentes de alta y modificación. Capa delgada.
- UI: «Personal de mesa de entrada» en el menú (solo Gerente), listado mínimo con «Nuevo integrante», formulario de alta y de edición (uno solo, en modo) y ficha mínima con la sección «Cuenta de acceso».
- Regla de ruta para `personal` y su test.
- Fixture de fichas de prueba y reglas en `RULES.md`.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): lo listado en la sección 1.

---

## 4. Contrato Backend

El contrato completo está en `docs/specs/spec_modulo_F.md`; esta sección solo fija qué se implementa y no repite la spec.

### 4.1. Schemas Zod
- `construirIdentidadPersonaSchema(dniLongitudMin, dniLongitudMax)` en `src/server/shared/identidad-persona.schema.ts` (spec F §1, «Utilidades compartidas nuevas»).
- `construirAltaIntegranteSchema` y `construirModificarIntegranteSchema` en `src/server/personal/personal.schema.ts` (spec F §2.1 y §2.2), con `.strict()`. En la modificación, campo ausente = no se toca, el email no se puede vaciar, `telefono: null` quita el teléfono y la cadena vacía se rechaza, y `version` es obligatorio.

### 4.2. Servicio del personal (`src/server/personal/personal.service.ts`)
- `crearIntegrante(input, usuarioRegistranteId)`: spec F §2.1, pasos 1 a 6, en una única `transaccion`.
- `modificarIntegrante(id, input, usuarioId)`: spec F §2.2, pasos 1 a 7, en una única `transaccion`.
- `obtenerDetalleIntegrante(id)`: la ficha, `version`, fechas de alta y de última modificación («Sin cambios» si nunca se modificó) y la sección «Cuenta de acceso» con `obtenerResumenCuenta`. Los campos `historialEstados`, `cajaAbierta` y `motivoObligatorioAlDesactivar` de spec F §2.4 los suma F-05 de forma aditiva (sección 0, punto 1).
- `listarPersonal`: versión mínima de spec F §2.3 (todas las fichas, activas e inactivas, con el orden de §2.3 y sin `q` ni paginación).
- El servicio nunca devuelve textos: lanza `ErrorDeDominio(clave)`.

### 4.3. Route Handlers
`POST /api/personal` (`personal:crear`, `201`), `GET /api/personal` (`personal:leer`), `GET /api/personal/[id]` (`personal:leer`) y `PATCH /api/personal/[id]` (`personal:editar`). Respuestas `{ data, error }` y códigos de spec F §2.1 a §2.4: `400 VALIDATION_ERROR`, `403 SIN_PERMISO`, `404 INTEGRANTE_NO_ENCONTRADO`, `409 DNI_DUPLICADO`, `409 EMAIL_YA_ASOCIADO`, `409 CONFLICTO_EDICION_CONCURRENTE`. Las respuestas con datos personales llevan `Cache-Control: no-store`.

### 4.4. Server Actions
`crearIntegrante()` y `modificarIntegrante()` en `src/server/personal/actions.ts`: capa delgada con Zod, `withPermission` y el servicio. Misma regla de A-06 y A-05 para la firma: si una pantalla necesita esperar el resultado (por el diálogo de confirmación), se llama a la acción directamente en lugar de `useActionState`.

### 4.5. Trazabilidad
Según spec F §4: opción (a) para el alta y la modificación. El módulo A genera los eventos de seguridad de la creación de la cuenta; este módulo no emite ninguno.

---

## 5. Frontend

Pantallas P-45 (listado mínimo) y P-46 (alta, consulta y edición) en `src/app/(dashboard)/personal/`, con los textos de `src/lib/textos.ts` y el feedback de `docs/DESIGN.md` §6.4 (sección 0, punto 13).

**Prototipo (figura 91, página 82): alta.** Una página con migas «Personal de mesa de entrada / Nuevo integrante», título «Nuevo integrante» y la bajada «Al registrar la ficha se crea su cuenta de acceso: usuario = email y contraseña inicial = DNI, que cambia en el primer ingreso.». Arriba a la derecha, «Cancelar» (secundario) y «Registrar» (primario). Dos tarjetas lado a lado:
- **Identidad:** Nombre y Apellido (obligatorios), DNI (obligatorio) y Fecha de nacimiento (obligatoria, selector de fecha), Género (opcional, lista con «Sin especificar»).
- **Contacto:** una nota «El email es obligatorio: con él se crea la cuenta de acceso.», Email (obligatorio) y Teléfono (opcional).

**Edición:** el mismo formulario precargado, con «Guardar» deshabilitado si no hay cambios y confirmación antes de guardar (spec F §2.2); el prototipo no la dibuja.
**Ficha (modo consulta):** los datos de la ficha, fechas de alta y de última modificación, y la sección «Cuenta de acceso» con email, rol y estado («Activa · debe cambiar la contraseña» o «Activa»), con `CuentaAccesoCard`. Botón «Editar» (solo con `personal:editar`).
**Listado mínimo:** botón «Nuevo integrante» y una tabla con Apellido, Nombre, DNI, Teléfono («—» si falta), Email y Estado, cada fila enlaza a la ficha; si no hay integrantes, «Todavía no hay personal de mesa de entrada registrado» con el acceso a «Nuevo integrante».

**Del mapa de pantallas (P-45, P-46, DEC-14 y DEC-15), lo que esta HU usa:**
- **Alta:** título «Nuevo integrante». «Registrar» pide confirmación (DEC-15): «¿Estás seguro de que querés registrar a <Nombre> <Apellido> como mesa de entrada?», avisando que se crea la cuenta con ese email y el DNI como contraseña inicial. Éxito: «Integrante registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.».
- **Edición:** el título es el nombre del integrante. «Guardar» pide confirmación (DEC-15; el prototipo guarda sin confirmar y se corrige): «¿Estás seguro de que querés guardar los cambios de <Nombre> <Apellido>?», con aviso si cambia el email de ingreso. Éxito: «Integrante actualizado correctamente».
- **Cancelar:** sin confirmación si no hay datos ni cambios; con datos o cambios pide confirmación de descarte (texto a definir en `textos.ts`). Vuelve al listado (alta) o a la ficha (edición).
- **Ficha (modo consulta):** encabezado con el nombre y la etiqueta «Inactivo» si corresponde; Identidad y Contacto en solo lectura con las fechas de alta y de última modificación; «Cuenta de acceso» con los estados de A-06 c5 y de DEC-14 («Activa · debe cambiar la contraseña», «Activa», «Inactiva» si la ficha está dada de baja y «Sin cuenta» si no tiene cuenta vinculada, sin acción para crearla). Las acciones «Desactivar» y «Reactivar» y el historial de estados las agrega F-05.
- **Errores:** «Ingresá el email: con él se crea la cuenta de acceso» (email vacío); «Ya existe un integrante de mesa de entrada con ese DNI» (al salir del campo y al confirmar); el email en uso, sin revelar a quién pertenece (texto a definir en `textos.ts`); y el conflicto de edición. **Diferencia a anotar:** el mapa (convención 8 i) dice «Otra persona está modificando estos datos. Intentá de nuevo.» y la spec F §2.2 dice «La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.»; el relevamiento debe reportar cuál es el texto vigente de alumnos y profesores y proponer uno (punto 5).
- **Figuras:** el mapa asigna a P-46 las figuras 91, 93 y 94 del PDF; esta HU usa **solo la 91** (alta). Las otras dos son la ficha con las acciones de F-05.

**Diferencias con el prototipo:** no se implementa la barra lateral de ejemplo, el selector «Probar como» ni los accesos del prototipo; el menú real es `Sidebar.tsx`. Cualquier otra diferencia que aparezca se reporta en el relevamiento (punto 12), no se resuelve por inferencia.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
- Schemas: nombre y apellido (largo, caracteres, espacios colapsados), DNI numérico con la longitud configurada, fecha de nacimiento (futura e inexistente), teléfono de 8 a 15 dígitos, email en minúsculas y hasta 254 caracteres, email faltante con el mensaje del backlog, `.strict()` (rechaza `activo`, `usuarioId` y rol), y la modificación (`version` obligatorio, `telefono` nulo y vacío).
- Servicio con mocks: orden de los pasos, `DNI_DUPLICADO`, `EMAIL_YA_ASOCIADO`, `P2002` de DNI y de email, sin cambios (`campos_modificados: []`, sin escribir), conflicto de edición, cambio de email llama a `cambiarEmailCuenta` y no revoca sesiones, la contraseña inicial no aparece en ninguna respuesta.
- Con PostgreSQL real: alta atómica (si falla `crearCuentaParaFicha`, no queda ficha; si falla la ficha, no queda cuenta), dos altas simultáneas con el mismo DNI y con el mismo email (una gana), modificación simultánea con la misma `version` (una gana), unicidad que excluye la propia ficha, ficha inactiva modificable.
- Rutas y acciones: `403` para MESA_ENTRADA, PROFESOR y ALUMNO, `401` sin sesión, y los códigos de la sección 4.3.
- Pantallas: formulario en modo alta y edición, errores junto al campo, «Guardar» deshabilitado sin cambios, «Cancelar» con confirmación, confirmaciones previas, listado vacío y con datos, ficha con «Cuenta de acceso».

### Nivel 2 — Postman
Colección de la HU: alta correcta (`201`, sin contraseña en la respuesta), DNI y email duplicados, validaciones (`400`), sin permiso (`403`), modificación con `version` vieja (`409`), modificación sin cambios, cambio de email y verificación de la cuenta. Si se usa curl, se documenta igual que en A-06 y A-05.

### Nivel 3 — BD / TablePlus
- La ficha creada con `activoFichaMesaEntrada = true`, `version = 0`, `creadoPorUsuarioId` del Gerente, `modificadoPorUsuarioId` nulo y nombres normalizados.
- La cuenta creada con el email de la ficha, rol `MESA_ENTRADA`, `debeCambiarPassword = true` y la contraseña solo como hash.
- Tras modificar: `version` incrementada, `modificadoPorUsuarioId`, y el email de la ficha igual al de la cuenta.
- Recorrido: el Gerente registra a un integrante, que entra con su email y su DNI, se le pide la contraseña nueva en el primer ingreso (criterios 1, 2, 5 y 6 de A-06 para este rol) y después ve solo lo que corresponde a mesa de entrada.
- Criterio 7 de F-01 «no permite desactivar»: la ficha y las rutas no ofrecen ninguna baja.

---

## 7. Checklist de Definition of Done

- [x] Relevamiento previo (sección 0) hecho y decisiones registradas (sección 0.1).
- [x] Servicio, Route Handlers y Server Actions implementados, sin lógica de negocio en la capa delgada (Regla N.° 4).
- [x] Alta y modificación con las validaciones del backlog y los códigos de la spec; respuestas `{ data, error }` (Regla N.° 5) y validación Zod previa (Regla N.° 6).
- [x] El alta crea ficha y cuenta en una única transacción; la contraseña inicial no se ve ni se registra en ninguna parte (regla 3.8).
- [x] Modificar el email cambia también el de la cuenta, sin revocar sesiones, y la unicidad excluye la propia ficha.
- [x] Concurrencia optimista con `version` (Regla N.° 7).
- [x] Solo el Gerente: `403` en el servidor para cualquier otro rol (Regla N.° 10); ruta y menú con la regla nueva.
- [x] Todos los textos visibles en `textos.ts`, verificados con `scripts/verificar-claves-textos.ts`.
- [x] Ningún `DELETE` físico y ningún test de Sprint 1, 2, A-06 y A-05 borrado ni debilitado.
- [x] `construirIdentidadPersonaSchema` en `src/server/shared/` con su test, reutilizable por F-03 y G-01.
- [x] Fixtures en `prisma/seed/fixtures/hu-f-01.ts` con su línea en el índice, sin editar `seed.ts`.
- [x] Filas de esta HU en `docs/DESIGN.md` §6.4 (y en su historial de cambios).
- [x] Reglas del módulo en `RULES.md` y nota aditiva en `spec_modulo_F.md` (lo que el código real tuvo que acomodar, incluidas las diferencias de `personal.publico.ts`).
- [x] `lint`, `tsc`, `npm test` y `npm run test:pg` en verde antes de pedir revisión (en `test:pg` fallan solo dos archivos ajenos a esta HU: HU-E-10 y HU-H-03).
- [x] Tests de los 3 niveles documentados con evidencia.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Etapas de implementación

Se implementa en dos etapas. Al terminar cada una, Claude Code **se detiene** y reporta archivos, resultados de los comandos, desvíos y dudas; no sigue hasta recibir «continuamos».

1. **Backend.** `construirIdentidadPersonaSchema` (con los mensajes de `ui.comun.identidad.*`), `personal.schema.ts`, `personal.service.ts` (`crearIntegrante`, `modificarIntegrante`, `obtenerDetalleIntegrante`, `listarPersonal` mínimo y la verificación de disponibilidad), `personal.types.ts` y las claves de error y de texto de esa capa; los Route Handlers de `/api/personal`, las Server Actions (`crearIntegrante`, `modificarIntegrante` y `verificarDisponibilidadIntegrante`), la regla de ruta `personal` con su test y `/personal/:path*` en el `matcher` de `src/proxy.ts`. Tests unitarios y con PostgreSQL (alta atómica y concurrencia incluidas), de rutas y de acciones.
2. **Pantallas y cierre.** Siguiendo el prototipo (figura 91, página 82). Las filas de DESIGN §6.4 (antes de implementar), el ítem del menú, el listado mínimo, `integrante-form.tsx`, `nuevo`, la ficha, `editar` y `error.tsx`, los textos y sus tests; fixture `hu-f-01.ts` + índice, `RULES.md`, nota aditiva en `spec_modulo_F.md`, `docs/testing/HU-F-01-evidencia.md`, y `lint`, `tsc`, `npm test`, `npm run test:pg`, `npx tsx scripts/verificar-claves-textos.ts` y `next build` en verde.

---

## 9. Resultado de la implementación

Evidencia completa en `docs/testing/HU-F-01-evidencia.md`. HU-F-01 queda implementada en las dos etapas. El único límite del criterio 7 que no se puede cerrar acá es el de desactivar y reactivar, que pertenece a HU-F-05.

### 9.1. Criterios de aceptación

| Criterio | Resultado | Cómo se verificó |
|---|---|---|
| 1 a 6 (alta, validaciones, duplicados, cuenta, modificación y concurrencia) | Verificado | Tests unitarios y con PostgreSQL (13 de `personal.service.pg.test.ts`) y 21 pedidos HTTP autenticados: `201` sin contraseña ni hash, `409` por DNI o email duplicado, `400` por validación, `409` con versión vieja, `campos_modificados: []` sin cambios, y el cambio de email deja la cuenta con el email nuevo sin revocar sesiones |
| 7. Cancelar y acceso solo del Gerente | Verificado | `403` con Mesa de entrada y `401` sin sesión en el servidor; «Cancelar» con confirmación de descarte (tests de pantalla) |
| 7. Límite: desactivar y reactivar | Bloqueado hasta HU-F-05 | La ficha no ofrece esas acciones; se verifica al implementar F-05 |
| A-06, 1, 2, 5 y 6 para Mesa de entrada | Verificado | El integrante nuevo entra con su email y su DNI, el proxy lo manda a `/primer-ingreso` y el servidor responde `403 DEBE_CAMBIAR_PASSWORD`. Con el email viejo ya no entra |

### 9.2. Desvíos respecto de lo decidido

- **`INTEGRANTE_NO_ENCONTRADO` en la disponibilidad:** `verificarDisponibilidadIntegrante` con un `excluirId` que no existe responde ese error (con test de mocks y de PostgreSQL), en lugar de comportarse como si no excluyera a nadie.
- **Apellido de la fixture:** la primera versión usaba «Prueba F01». El servicio la aceptó porque no pasa por el schema, pero la validación no admite dígitos y esas fichas no se podían editar. Quedó «Prueba Mesa» y se corrigieron las dos filas de la base de desarrollo con un `UPDATE` de los apellidos, sin tocar `version`. Anotado en la evidencia.
- **`ConfirmarDescarteDialog`:** conserva sus textos dentro del componente compartido, no en `textos.ts`. Cambiarlo afecta a otras pantallas y queda como deuda.
- **Claves de texto nuevas:** `ui.comun.genero.*`, `ui.personal.valorAusente` («—») y la etiqueta del menú «Personal de mesa de entrada»; además de las ya previstas, `errores.personal.datosInvalidos` (propuesto), `.interno` y `.comunicacion`.
- **Tests no previstos:** las cuatro pantallas se prueban en un solo archivo (`paginas.test.tsx`) y se sumó `Sidebar.personal.test.tsx`, porque no había tests del menú.
- **Banner:** parámetro en la URL (`?creado=1`, `?actualizada=1`) con `<p role="status">`, igual que las otras fichas; tras el alta se navega a la ficha.

### 9.3. Verificación final

- `lint` sin errores (el aviso de `CALENDARIO` en `Sidebar.tsx` ya existía), `tsc` sin errores, `verificar-claves-textos` aprobado y `next build` compila (4 pantallas y 2 rutas de `/personal`).
- `npm test`: 2882 pasan, 0 fallan (230 archivos).
- `npm run test:pg`: 271 pasan y fallan 2 archivos que no son de esta HU (HU-E-10 `resultado-examen.service.pg.test.ts` y HU-H-03 `clases.service.pg.test.ts`). Los 13 de personal pasan.
- Seed: `npx prisma db seed` se corrió dos veces; la segunda no cambia filas.
- `schema.prisma` y `seed.ts` sin cambios; sin migraciones.
- Recorrido en el navegador (confirmaciones, verificación al salir de los campos, «Cancelar», «Recargar» ante conflicto) y cambio de contraseña en `/primer-ingreso`: PENDIENTE de confirmar por Adriel.

### 9.4. Deuda y lo que deja para otras HU

- Textos de `ConfirmarDescarteDialog` fuera de `textos.ts` (componente compartido).
- `fechaCalendarioValidaSchema` duplicado en dos archivos, y mensajes que siguen viniendo de `fecha.ts` y `contacto.schema.ts`.
- Los dos archivos `test:pg` que fallan (HU-E-10, HU-H-03) no son de esta HU.
- **HU-F-03:** reemplaza el listado mínimo por búsqueda y paginación; `listarPersonal` ya devuelve `{ items, total }`.
- **HU-F-05:** agrega desactivar y reactivar sobre `obtenerDetalleIntegrante`, pensado para extenderse.
- **HU-G-01:** reutiliza `construirIdentidadPersonaSchema`.
- Quedan en la base de desarrollo las dos fichas de la fixture (con sus cuentas) y la ficha 88061021 «Carla Prueba Http» (`f01.http.nuevo@noctium.local`, todavía con la marca de cambio obligatorio).
