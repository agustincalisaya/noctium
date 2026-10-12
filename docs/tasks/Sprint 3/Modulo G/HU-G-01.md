# TASK: HU-G-01 — Registrar y modificar datos del gerente

**Módulo:** G (Gerentes) · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 3
**Contrato de referencia:** `docs/specs/spec_modulo_G.md` §1, §2.1 (alta), §2.2 (modificación), §2.4 (detalle: solo la parte que esta HU necesita, ver 0.1.1), §3.1 a §3.3, §3.6, §3.7, §3.9 y §4 · `docs/specs/spec_modulo_F.md` (mismo diseño: la spec G dice «igual que F») · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-G-01, criterios 1 a 6; HU-A-06, criterios 1, 2, 5 y 6 para este rol) · `docs/tasks/Sprint 3/Modulo F/HU-F-01.md`, `HU-F-03.md` y `HU-F-05.md` (sección 9: qué dejaron hecho) · `docs/tasks/Sprint 3/PR-0.md` §2.7, §2.13, §2.14 y §2.16
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figura 95 («Nuevo gerente»), **solo la página 86**. Muestra únicamente el alta; la edición reabre el mismo formulario precargado. Las figuras 96 (listado), 97 y 98 (baja) son de HU-G-03 y HU-G-05: no se usan. Las capturas son orientativas: ante cualquier diferencia prevalece el backlog.
**RBAC:** solo **GERENTE**. Usa `gerentes:crear`, `gerentes:editar` y `gerentes:leer`, ya sembrados para GERENTE en `prisma/seed.ts` (`gerentes:cambiar_estado` es de HU-G-05). Cualquier otro rol recibe `403 SIN_PERMISO` en el servidor aunque la interfaz oculte la opción (spec G §3.7).
**Schema:** ya completo, **sin migración y sin tocar `schema.prisma`**. `FichaGerente` (`fichas_gerente`) ya tiene `version`, los campos normalizados, `creadoPorUsuarioId`, `modificadoPorUsuarioId` y el índice del listado.
**Rama:** `feat/hu-g-01-registrar-modificar-gerente`, creada desde `develop` actualizado (F-01, F-03 y F-05 ya están mergeadas).
**Estado de la HU:** decisiones tomadas (sección 0); se implementa en dos etapas (sección 8).

---

## 0. Decisiones y verificaciones previas

### 0.1. Decisiones (no relevar de nuevo)

1. **Partición con HU-G-03 y HU-G-05 (DEC-38).** G-01 entrega el listado mínimo y la ficha mínima. `listarGerentes(db?)` va sin parámetros: todas las fichas, activas e inactivas, con el orden `apellidoNormalizado`, `nombreNormalizado`, `dni`, y devuelve `{ items, total }`; G-03 le suma `q`, la paginación y `esVos` por ítem, de forma aditiva. `obtenerDetalleGerente(id, sesionUsuarioId, db?)` devuelve los datos, `version`, las fechas, la `cuenta` (`ResumenCuenta`) y `esVos`; G-05 le suma `historialEstados`, `motivoObligatorioAlDesactivar` y `esUltimoGerenteActivo` sin cambiar la firma. Si la ficha no existe lanza `ErrorDeDominio("errores.gerente.noEncontrado")`: la ruta responde `404` y la página usa `notFound()`. La ficha **no** ofrece «Desactivar» ni «Reactivar» y no muestra historial de estados.
2. **Servicio propio, mismo patrón que F, sin extraer nada compartido.** `src/server/gerentes/gerente.service.ts` copia el diseño de `personal.service.ts` sobre `FichaGerente`. No se refactoriza F, alumnos ni profesores: la duplicación (ya registrada como deuda en A-06 §9.4 y F-01) crece y se anota. Se reutilizan tal cual `construirIdentidadPersonaSchema`, `crearCuentaParaFicha` (con rol `GERENTE`), `cambiarEmailCuenta`, `verificarEmailNoAsociadoAOtraCuenta` y `obtenerResumenCuenta`.
3. **Schemas.** `construirAltaGerenteSchema` y `construirModificarGerenteSchema` en `gerente.schema.ts`, ambos `.strict()` y con las reglas de F-01 (decisiones 2 a 4 de su task): en la modificación el género acepta `null`, el email no se puede vaciar, `telefono: null` lo quita y `version` es obligatoria. El email vacío responde el mensaje del backlog con clave propia, `ui.gerentes.contacto.emailRequerido`: «Ingresá el email: con él se crea la cuenta de acceso». Los mensajes de la identidad siguen saliendo de `ui.comun.identidad.*`.
4. **Forma de las respuestas.** `crearGerente(input, usuarioRegistranteId, ip?)`, con la IP opcional para el evento `CUENTA_CREADA` (como F). El `201` y el detalle devuelven la `cuenta` como `ResumenCuenta` tal cual (snake_case, la que consume `CuentaAccesoCard`); los ejemplos de la spec G están en camelCase: diferencia que se anota. El `400` es `VALIDATION_ERROR` con los errores por campo en `detalles`.
5. **Claves de error y de texto.** `errores.gerente.dniDuplicado` (`DNI_DUPLICADO` 409, «Ya existe un gerente registrado con ese DNI»), `errores.gerente.noEncontrado` (`GERENTE_NO_ENCONTRADO` 404, «El gerente no existe»), `errores.gerente.conflictoEdicion` (`CONFLICTO_EDICION_CONCURRENTE` 409, «La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.»), y las de capa `datosInvalidos`, `interno` y `comunicacion` con los mismos textos de F cambiando «integrante» por «gerente». `EMAIL_YA_ASOCIADO` reutiliza `errores.cuenta.emailYaAsociado`. `errores.general.conflictoEdicion`, que cita la spec G, no existe. **No** se crean las claves de HU-G-05 (`yaInactivo`, `yaActivo`, `ultimoGerenteActivo`, `noPuedeDesactivarseASiMismo`, `motivoRequerido`).
6. **Alta transaccional.** En una única `transaccion`: unicidad del DNI contra todas las fichas de gerente, activas e inactivas, sin cruzar con otras tablas → `crearCuentaParaFicha({ email, dni, rol: "GERENTE", ip })` → insertar la ficha activa con `usuarioId`, nombres normalizados con `normalizarTexto`, `creadoPorUsuarioId` y `version = 0`. Sin `bloquear`: alcanzan los índices únicos. El `catch` de `P2002` va fuera de la transacción y filtra por `dniFichaGerente`. El servicio le entrega el DNI a A y nunca ve, devuelve ni registra la contraseña inicial (regla 3.8).
7. **Modificación.** Primero el `updateMany` por `version` y después `cambiarEmailCuenta` (ficha y después cuenta, el mismo orden que usará G-05). Sin cambios reales: `200` con `campos_modificados: []` sin escribir. La unicidad del DNI y del email excluye la propia ficha y su cuenta; el email sin cambios no se revalida. Cambiar el DNI no toca la contraseña. Una ficha inactiva se puede modificar y no se reactiva (P-G4). `modificadoPorUsuarioId` solo se escribe al modificar, no en el alta.
8. **Un gerente que se modifica a sí mismo (DEC-44).** Está permitido. `cambiarEmailCuenta` no revoca sesiones y la sesión se identifica por `id` y `rol` (el JWT no lleva el email: se verificó en `src/auth.ts`), así que su sesión sigue válida. `obtenerDetalleGerente` devuelve `esVos` (`ficha.usuarioId === sesionUsuarioId`) y la página de edición se lo pasa al formulario: si cambia el email, la confirmación avisa «Cambiar tu email también cambia el usuario con el que ingresás. Tu sesión actual sigue abierta y la próxima vez ingresás con el email nuevo.» (texto **propuesto**, pendiente del PO). Si la ficha no es la propia, el aviso es el de F («Cambiar el email también cambia el usuario con el que esta persona ingresa. Va a ingresar con el email nuevo la próxima vez.»).
9. **Disponibilidad al salir del campo.** `verificarDisponibilidadGerente({ dni?, email?, excluirId? })` como Server Action de capa delgada, con la lógica en `gerente.service.ts`: el DNI contra todas las fichas menos `excluirId` y el email con `verificarEmailNoAsociadoAOtraCuenta` excluyendo la cuenta de la propia ficha. Devuelve solo `{ dni_disponible, email_disponible }`, sin decir de quién es el email; un `excluirId` inexistente es `404 GERENTE_NO_ENCONTRADO`. Permiso `gerentes:crear` en el alta y `gerentes:editar` en la edición. Sin Route Handler.
10. **Rutas HTTP.** `POST /api/gerentes` (`gerentes:crear`, `201`), `GET /api/gerentes` (`gerentes:leer`, listado mínimo, sin query), `GET /api/gerentes/[id]` (`gerentes:leer`, le pasa `req.auth!.user.id` al servicio) y `PATCH /api/gerentes/[id]` (`gerentes:editar`). Capa delgada con `withPermission` (que agrega `Cache-Control: no-store`). Más las Server Actions `crearGerente`, `modificarGerente` y `verificarDisponibilidadGerente`, con `verificarPermiso` antes de Zod.
11. **Permisos, rutas y menú.**
    - **`rutas-por-rol.ts`:** regla `gerentes: ["GERENTE"]` con su caso de test. Ya existe `gerente: ["GERENTE"]` (el panel de indicadores) y la comparación es por segmento completo: sin la regla nueva, `/gerentes` no tendría restricción de rol en el proxy.
    - **`src/proxy.ts`:** `/gerentes/:path*` en el `matcher`. Sin eso, el proxy no aplica la regla de rol ni la redirección por la marca de primer ingreso.
    - **Menú:** sección desplegable «Gerentes» con el ítem «Listado», solo para el GERENTE, a continuación de «Personal de mesa de entrada» (el patrón vigente de F-03; el prototipo la muestra como ítem plano). `SidebarNav` marca el ítem activo por segmento: `/gerente` (Indicadores) no debe quedar activo en `/gerentes/…`, con un test que lo fije.
12. **Pantallas** (carpeta `src/app/(dashboard)/gerentes/`; Regla N.° 11: solo `page.tsx`, `layout.tsx` y componentes propios de la ruta).
    - **Archivos:** `page.tsx` (listado mínimo), `listado-gerentes.tsx`, `nuevo/page.tsx`, `[id]/page.tsx` (ficha), `[id]/editar/page.tsx`, `gerente-form.tsx` (formulario único, alta y edición) y `error.tsx`. `gerente-form.tsx` es una copia adaptada de `integrante-form.tsx` con los textos `ui.gerentes.*` y su propio schema; **no** se modifica el formulario de F ni ningún componente compartido.
    - **Comportamiento del formulario:** el de F-01 (decisión 13): `onSubmit` manual sin `useActionState`, `setDirty` con `useDirtyState` y `ConfirmarDescarteDialog` en «Cancelar»; verificación de DNI y email al salir del campo; «Guardar» deshabilitado sin cambios; ante un conflicto de versión, «Recargar» con `router.refresh()` y `key={version}`; confirma **siempre** el alta y la edición (DEC-15); «Cancelar» y el botón de guardar van arriba a la derecha, como el prototipo.
    - **Textos del alta:** título «Nuevo gerente» y la bajada de F («Al registrar la ficha se crea su cuenta de acceso: usuario = email y contraseña inicial = DNI, que cambia en el primer ingreso.»). Confirmación: «¿Estás seguro de que querés registrar a {nombre} {apellido} como gerente?», con el detalle de que se crea su cuenta con ese email y su DNI como contraseña inicial; botón «Registrar gerente». Éxito, en la ficha (A-06 c5): «Gerente registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.».
    - **Textos de la edición:** «¿Estás seguro de que querés guardar los cambios de {nombre} {apellido}?», botón «Guardar cambios», éxito «Gerente actualizado correctamente».
    - **Listado mínimo:** botón «Nuevo gerente» arriba a la derecha y una tabla con Apellido, Nombre, DNI, Teléfono («—» si falta), Email y Estado, cada fila enlazada a la ficha. No hay estado vacío (spec G §2.3): siempre figura al menos el gerente autenticado. Sin búsqueda, paginación ni «(vos)»: son de G-03.
    - **Ficha:** nombre y etiqueta «Inactivo» si corresponde, «Editar» (solo con `gerentes:editar`), Identidad, Contacto, Registro (fecha de alta y última modificación, «Sin cambios» si nunca se modificó) y «Cuenta de acceso» con `CuentaAccesoCard`. Tras el alta se navega a la ficha con `?creado=1` y tras editar con `?actualizada=1`, con el banner inline.
    - **Textos:** claves nuevas `ui.gerentes.*` (menú, listado, estado, formulario, alta, edición y ficha) y `errores.gerente.*`, todas en `src/lib/textos.ts` y verificadas con `scripts/verificar-claves-textos.ts`. Los marcados «propuesto» se señalan como tales.
13. **`docs/DESIGN.md` §6.4.** Antes de implementar las pantallas, agregar las filas del listado mínimo (P-47, `/gerentes`), del alta (P-48, `/gerentes/nuevo`, página completa + `ConfirmarAccionDialog` «Registrar gerente» → ficha con banner), de la edición (P-48, `/gerentes/[id]/editar`, `ConfirmarAccionDialog` «Guardar cambios» con el aviso de email) y de la ficha en consulta (P-48, `/gerentes/[id]`), y la entrada del historial de cambios con el marcador `[FECHA]`, que reemplaza Adriel.
14. **Fixture** `prisma/seed/fixtures/hu-g-01.ts` y una línea en `fixtures/index.ts`, sin editar `seed.ts`. DNI `8806400x`, idempotente (se busca por DNI antes de crear):
    - Un gerente **activo**, DNI `88064001` y email `g01.activo@noctium.local`, creado con `crearGerente`: nace con la marca de cambio obligatorio y sirve para el primer ingreso y los duplicados.
    - Un gerente **inactivo**, DNI `88064002` y email `g01.inactivo@noctium.local`: se crea con `crearGerente` y después, en una `transaccion`, `updateMany` de la ficha (`version + 1`, `modificadoPorUsuarioId`) y `desactivarCuenta`, sin escribir historial de estados (lo escribe G-05).
    - Apellido sin dígitos («Prueba Gerente»): F-01 aprendió que un apellido con números no pasa la validación y la ficha no se puede editar.
    - Los dos gerentes del seed base (DNI `24100001`, `gerente@noctium.local`, y `24100002`, `gerente2@noctium.local`) los crea `seed.ts` con `upsert` directo: son la excepción de la regla 3.1 y **no se modifican en ninguna prueba** (ni su email ni su contraseña): el equipo entra con esas cuentas.
15. **Dos etapas** (sección 8).

### 0.2. A verificar antes de implementar (si algo contradice lo de arriba, detenerse y reportar)

- **Cuenta con rol `GERENTE`:** que `crearCuentaParaFicha` acepta `rol: "GERENTE"` sin restricción adicional y que `CuentaAccesoCard` y `ROL_LEGIBLE` muestran «Gerente».
- **Permisos:** que `gerentes:crear`, `gerentes:editar` y `gerentes:leer` están solo para GERENTE en `prisma/seed.ts` y en la migración de permisos, y qué test de la matriz los cubre.
- **Colisión de claves:** que no existe ninguna clave `ui.gerentes.*` ni `errores.gerente.*` en `textos.ts` ni en `errores-dominio.ts`, y que los tests que recorren todas las claves (`errores-dominio.test.ts`) se adaptan sin debilitarse.
- **Aislamiento de fachadas (Regla N.° 3):** que `src/server/gerentes/` no necesita registrarse en `publico.aislamiento.test.ts` o, si lo necesita, se registra sin debilitarlo. **No se crea `gerente.publico.ts`**: `obtenerNombresPersonal` ya resuelve el nombre de los gerentes y nadie importa `obtenerNombresGerentes`; la diferencia se anota.
- **Menú y proxy:** que los tests existentes (`Sidebar.personal.test.tsx`, `rutas-por-rol.test.ts`) se pueden extender para el ítem y la regla nuevos, y que `SidebarNav` compara por segmento.
- **Nivel 2 de DEC-44 sin tocar a los gerentes del seed:** proponer cómo verificar, con curl, que la sesión del gerente sigue válida después de cambiar su propio email. Propuesta: usar al gerente `88064001` de la fixture, cambiar su contraseña por el flujo de A-06 (`/primer-ingreso`) y después modificar su propio email con `PATCH`; la misma sesión debe responder `200`, el ingreso con el email viejo debe fallar y con el nuevo debe funcionar. Si no es razonable, reportar antes de inventar otra forma.
- **Tests que fijan el menú o la lista de rutas** y los de Sprint 1 y 2, A-06, A-05, F-01, F-03 y F-05 que se vean afectados: ninguno se borra ni se debilita.
- **Que `texto()` interpole** `{nombre}` y `{apellido}`.

---

## 1. Nota de alcance

HU-G-01 abre el bloque de gerentes. Es gemela de HU-F-01 sobre otra ficha: la ficha y la cuenta son una unidad (HU-A-06), el email de la ficha es el de la cuenta y la contraseña inicial es el DNI. También es la **segunda HU que aplica A-06 a un rol interno**: con ella se verifican los criterios 1, 2, 5 y 6 de A-06 para el rol Gerente.

**Lo que ya existe y esta task usa** (verificado en `develop`):

| Qué | Dónde |
|---|---|
| `FichaGerente` con `version`, campos normalizados, auditoría e índice del listado | `prisma/schema.prisma` |
| `gerentes:crear`, `gerentes:editar`, `gerentes:leer` y `gerentes:cambiar_estado` para GERENTE | `prisma/seed.ts` |
| Dos gerentes con ficha y cuenta (DNI 24100001 y 24100002) | `prisma/seed.ts` |
| `crearCuentaParaFicha`, `verificarEmailNoAsociadoAOtraCuenta`, `cambiarEmailCuenta`, `obtenerResumenCuenta` | `src/server/usuarios/cuenta.service.ts` |
| `construirIdentidadPersonaSchema` (con mensajes `ui.comun.identidad.*`), `contacto.schema.ts` | `src/server/shared/` |
| `obtenerNombresPersonal` (ya lee `FichaGerente`; no se toca) | `src/server/personal/personal.publico.ts` |
| `transaccion`, `ErrorDeDominio`, `ahora()` | `src/server/shared/` |
| `ConfirmarAccionDialog`, `ConfirmarDescarteDialog`, `CuentaAccesoCard`, `DirtyStateContext`, `Breadcrumb` | `src/components/shared/`, `src/components/sesion/` |
| El patrón completo de ficha con cuenta: servicio, schemas, acciones, rutas, formulario único y fixture | `src/server/personal/`, `src/app/(dashboard)/personal/`, `prisma/seed/fixtures/hu-f-01.ts` |

**Lo que no existe y hace esta task:** el módulo `src/server/gerentes/` (servicio, schemas, acciones), los tipos, los Route Handlers de `/api/gerentes`, las pantallas de listado mínimo, alta, ficha y edición, la regla de ruta, el `matcher` y el ítem del menú, los textos, la fixture y la nota aditiva en la spec G.

**Decisiones de fondo** (resueltas, además de la sección 0.1):
- El rol de la cuenta lo fija el tipo de ficha (`GERENTE`); no se puede elegir otro. La contraseña inicial la maneja solo el módulo A.
- El DNI es único entre **todas** las fichas de gerente, activas e inactivas, y no se compara con alumnos, profesores ni mesa de entrada (regla 3.2). Doble validación: aplicativa y `@unique` con captura de `P2002`.
- Concurrencia optimista (Regla N.° 7) y trazabilidad por la opción (a) de la Regla N.° 2: `creadoPorUsuarioId` y `createdAt…` en el alta; `modificadoPorUsuarioId`, `updatedAt…` y `version` en la modificación.
- El cambio de email no revoca sesiones, ni siquiera el de la propia ficha (DEC-44).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Desactivar y reactivar gerentes, las reglas «no autodesactivarse» y «al menos un gerente activo», el historial de estados y `filtrarCuentasActivas` (HU-G-05).
- Búsqueda, paginación y la marca «(vos)» del listado (HU-G-03).
- `gerente.publico.ts` y `obtenerNombresGerentes` (ver 0.2).
- Cambiar el rol de una cuenta, que un gerente cambie su propia contraseña (HU-A-06, criterio 4), borrado físico y transferir permisos.
- Refactorizar F, alumnos, profesores o sus servicios de cuenta; modificar componentes compartidos (los textos fijos de `ConfirmarDescarteDialog` siguen siendo deuda).
- Migraciones, `schema.prisma` y `seed.ts`.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** registrar y mantener actualizados los datos de identidad y contacto de otro gerente
**Para** disponer de su ficha dentro del sistema, poder contactarlo y contar con el email que identifica su cuenta

**SP estimado:** 3 (1 + 1 + 1: absorbe HU-G-02, contacto, y HU-G-04, modificar)

---

## 3. Alcance de esta task

- Servicio de gerentes: `crearGerente`, `modificarGerente`, `obtenerDetalleGerente`, `listarGerentes` (mínimo) y `verificarDisponibilidadGerente`.
- Schemas Zod de alta y de modificación, y los tipos de `src/types/gerente.types.ts`.
- Route Handlers `POST` y `GET /api/gerentes`, `GET` y `PATCH /api/gerentes/[id]`, y las Server Actions equivalentes. Capa delgada.
- UI: «Gerentes» en el menú (solo Gerente), listado mínimo con «Nuevo gerente», formulario de alta y de edición (uno solo, en modo) y ficha mínima con «Cuenta de acceso».
- Regla de ruta `gerentes`, `matcher` del proxy, textos, fixture, reglas en `RULES.md`, nota aditiva en `spec_modulo_G.md` y evidencia.

---

## 4. Contrato Backend

El contrato está en `docs/specs/spec_modulo_G.md`; esta sección solo fija qué se implementa.

- **Schemas** (`src/server/gerentes/gerente.schema.ts`): spec G §2.1 y §2.2, con las decisiones 0.1.3 y 0.1.4.
- **Servicio** (`src/server/gerentes/gerente.service.ts`): `crearGerente` (§2.1 pasos 1 a 5), `modificarGerente` (§2.2 pasos 1 a 5), `obtenerDetalleGerente` (§2.4, parte mínima), `listarGerentes` (mínimo, 0.1.1) y `verificarDisponibilidadGerente` (0.1.9). Nunca devuelve textos: lanza `ErrorDeDominio(clave)`.
- **Route Handlers:** códigos de spec G §2.1, §2.2 y §2.4: `400 VALIDATION_ERROR`, `403 SIN_PERMISO`, `404 GERENTE_NO_ENCONTRADO`, `409 DNI_DUPLICADO`, `409 EMAIL_YA_ASOCIADO`, `409 CONFLICTO_EDICION_CONCURRENTE`.
- **Server Actions** (`src/server/gerentes/actions.ts`): se llaman directo, sin `useActionState`, porque el diálogo de confirmación espera el resultado (misma regla de F-01).
- **Trazabilidad:** opción (a) de spec G §4; el módulo A emite los eventos de seguridad de la cuenta.

---

## 5. Frontend

**Prototipo (figura 95, página 86): alta.** Migas «Gerentes / Nuevo gerente», título «Nuevo gerente» y la bajada «Al registrar la ficha se crea su cuenta de acceso: usuario = email y contraseña inicial = DNI, que cambia en el primer ingreso.». Arriba a la derecha, «Cancelar» y «Registrar». Dos tarjetas lado a lado: **Identidad** (Nombre y Apellido obligatorios, DNI y Fecha de nacimiento obligatorios, Género opcional con «Sin especificar») y **Contacto** (la nota «El email es obligatorio: con él se crea la cuenta de acceso.», Email obligatorio y Teléfono opcional). Es el mismo formulario que el de mesa de entrada (criterio 1).

**Edición:** el mismo formulario precargado, con «Guardar» deshabilitado sin cambios y confirmación antes de guardar (spec G §2.2); el prototipo no la dibuja.
**A implementar:** lo de 0.1.12, con el feedback de `docs/DESIGN.md` §6.4 (0.1.13). Seguir la guía de diseño: tokens de shadcn/ui y Tailwind del proyecto, nunca colores hexadecimales ni la paleta por defecto.
**Fuera de alcance de frontend:** el listado completo de la figura 96 (búsqueda, paginación y «(vos)»), «Desactivar», «Reactivar» y el historial de la figura 97.

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
- **Schemas:** nombre y apellido (largo, caracteres, espacios colapsados), DNI numérico con la longitud configurada, fecha de nacimiento (futura e inexistente), teléfono de 8 a 15 dígitos, email en minúsculas y hasta 254 caracteres, email faltante con el mensaje del backlog, `.strict()` (rechaza `activo`, `usuarioId` y rol) y la modificación (`version` obligatoria, `telefono` nulo y vacío, género `null`).
- **Servicio con mocks:** orden de los pasos, `DNI_DUPLICADO` con el texto de gerente, `EMAIL_YA_ASOCIADO`, `P2002` de DNI, sin cambios (`campos_modificados: []`, sin escribir), conflicto de edición, cambio de email llama a `cambiarEmailCuenta` y no revoca sesiones, `esVos` verdadero solo con la ficha propia, la contraseña inicial no aparece en ninguna respuesta.
- **Con PostgreSQL real** (nuevo `gerente.service.pg.test.ts`): alta atómica (si falla `crearCuentaParaFicha` no queda ficha; si falla la ficha no queda cuenta), dos altas simultáneas con el mismo DNI y con el mismo email (una gana), modificación simultánea con la misma `version` (una gana), unicidad que excluye la propia ficha, ficha inactiva modificable, y **el cambio del email propio no toca `sesionesValidasDesde` ni invalida la sesión de esa cuenta (DEC-44)**.
- **Rutas y acciones:** `403` para MESA_ENTRADA, PROFESOR y ALUMNO, `401` sin sesión, permiso antes de Zod, y los códigos de la sección 4.
- **Menú y rutas:** la regla `gerentes` (GERENTE sí; los otros tres roles no), el ítem del menú solo para GERENTE y `/gerente` no activo en `/gerentes/…`.
- **Pantallas:** formulario en modo alta y edición, errores junto al campo, «Guardar» deshabilitado sin cambios, «Cancelar» con confirmación, confirmaciones previas (incluido el aviso del email propio), listado con datos y ficha con «Cuenta de acceso» y sin «Desactivar» ni «Reactivar».

### Nivel 2 — Postman (o curl, documentado como en F-01)
Alta correcta (`201`, sin contraseña en la respuesta), DNI y email duplicados, validaciones (`400`), sin permiso (`403` con Mesa de entrada, Profesor y Alumno) y sin sesión (`401`), modificación con `version` vieja (`409`), modificación sin cambios, cambio de email y verificación de la cuenta, y la verificación de DEC-44 de 0.2.

### Nivel 3 — BD / TablePlus
- La ficha creada con `activoFichaGerente = true`, `version = 0`, `creadoPorUsuarioId` del Gerente, `modificadoPorUsuarioId` nulo y nombres normalizados.
- La cuenta creada con el email de la ficha, rol `GERENTE`, `debeCambiarPasswordUsuario = true` y la contraseña solo como hash.
- Tras modificar: `version` incrementada, `modificadoPorUsuarioId` y el email de la ficha igual al de la cuenta.
- Recorrido en el navegador como Gerente: listado → «Nuevo gerente» → ficha con el banner y «Cuenta de acceso» → «Editar» (cambiar el email de otro gerente y el propio con el aviso distinto) → «Cancelar» con confirmación; como Mesa de entrada, la ficha y las rutas rechazan.
- **Verificaciones diferidas que cierra esta HU:** A-06 criterios 1, 2, 5 y 6 para el rol Gerente (el gerente nuevo entra con su email y su DNI, el servidor lo manda a `/primer-ingreso`, y el cambio de email en la ficha cambia el de la cuenta). El criterio 7 de A-06 para gerentes queda para HU-G-05.

---

## 7. Checklist de Definition of Done

- [ ] Servicio, Route Handlers, Server Actions y pantallas implementados, sin lógica de negocio en la capa delgada (Regla N.° 4); respuesta `{ data, error }` (Regla N.° 5) y validación Zod previa (Regla N.° 6).
- [ ] El alta crea ficha y cuenta en una única transacción; la contraseña inicial no se ve ni se registra en ninguna parte (regla 3.8).
- [ ] Modificar el email cambia también el de la cuenta, sin revocar sesiones (incluido el de la propia ficha, DEC-44), y la unicidad excluye la propia ficha.
- [ ] Concurrencia optimista con `version` (Regla N.° 7); ningún `DELETE` físico (Regla N.° 1).
- [ ] Solo el Gerente: `403` en el servidor para cualquier otro rol (Regla N.° 10); regla `gerentes` en `rutas-por-rol.ts`, `/gerentes/:path*` en el `matcher` del proxy y menú solo para GERENTE.
- [ ] Todos los textos visibles en `textos.ts`, verificados con `scripts/verificar-claves-textos.ts`; los propuestos marcados como tales.
- [ ] Ningún componente compartido modificado; ningún test de Sprint 1, Sprint 2, A-06, A-05, F-01, F-03 y F-05 borrado ni debilitado.
- [ ] Fixture `hu-g-01.ts` con su línea en el índice, sin editar `seed.ts`; el seed corre dos veces sin duplicar; los gerentes del seed base no se modifican.
- [ ] Filas de esta HU en `docs/DESIGN.md` §6.4 (y en su historial de cambios, con la fecha que indique Adriel).
- [ ] Reglas en `RULES.md` (solo la sección nueva «Aplicación HU-G-01»; no se modifica ninguna regla existente) y nota aditiva en `spec_modulo_G.md` (diferencias de 0.1: `obtenerNombresPersonal` en lugar de `obtenerNombresGerentes`, `errores.general.conflictoEdicion`, forma de la cuenta, `VALIDATION_ERROR`, género `null`, `ip`, mensaje del email vacío).
- [ ] `lint`, `tsc`, `npm test`, `npm run test:pg` y `next build` sin fallos nuevos respecto de `develop` (los conocidos están en el handoff del carril).
- [ ] Tests de los 3 niveles documentados en `docs/testing/Modulo G/hu-g-01/HU-G-01-evidencia.md`.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Etapas de implementación

Antes de escribir código, Claude Code verifica los puntos de la sección 0.2; **solo si alguno contradice lo decidido, se detiene y reporta** y, si no, sigue. Al terminar cada etapa **se detiene** y reporta archivos, resultados de los comandos, desvíos y dudas; la siguiente empieza cuando Adriel dice «continuamos».

**Etapa 1 — Backend** (todo menos las pantallas). Orden: 1) `gerente.schema.ts`, `gerente.types.ts` y las claves de error y de texto de esa capa; 2) `gerente.service.ts` (`crearGerente`, `modificarGerente`, `obtenerDetalleGerente`, `listarGerentes` mínimo y `verificarDisponibilidadGerente`), con sus tests (unitarios y PostgreSQL, alta atómica, concurrencia y DEC-44 incluidos); 3) Server Actions y Route Handlers de `/api/gerentes`, con sus tests; 4) la regla `gerentes` en `rutas-por-rol.ts` con su test y `/gerentes/:path*` en el `matcher` de `src/proxy.ts`; 5) `lint`, `tsc`, `npm test`, `npm run test:pg` (el nuevo y los de personal y cuentas), `npx tsx scripts/verificar-claves-textos.ts`.

**Etapa 2 — Pantallas y cierre.** Siguiendo el prototipo (figura 95, página 86). Orden: 1) las filas de `docs/DESIGN.md` §6.4; 2) los textos de la pantalla y el ítem del menú con su test; 3) `gerente-form.tsx`, `nuevo`, el listado mínimo, la ficha, `editar` y `error.tsx`, con sus tests; 4) fixture `hu-g-01.ts`, su línea en el índice y `npx prisma db seed` (dos veces); 5) `RULES.md`, nota aditiva en `spec_modulo_G.md` y `docs/testing/Modulo G/hu-g-01/HU-G-01-evidencia.md` (con el Nivel 2 y el Nivel 3); 6) `lint`, `tsc`, `npm test`, `npm run test:pg`, `npx tsx scripts/verificar-claves-textos.ts`, el seed dos veces y `next build`.

---

## 9. Resultado de la implementación

**Estado:** implementada en las dos etapas y verificada. El recorrido en el navegador lo hizo el responsable y no tuvo observaciones. Quedan abiertos solo los textos marcados «propuesto», que valida el PO.

### 9.1. Criterios de aceptación

| Criterio | Resultado |
|---|---|
| HU-G-01 c1: «Nuevo gerente» abre Identidad y Contacto, con los campos, validaciones y normalizaciones de F-01; email obligatorio; errores junto al campo y sin cambios parciales | Cumplido. Tests de schemas, formulario, páginas y rutas; curl; recorrido en el navegador |
| HU-G-01 c2: DNI único entre todas las fichas de gerente (activas e inactivas) y email no usado por otra cuenta sin revelar de quién; ambas verificaciones se repiten en el servidor | Cumplido. Servicio con mocks y PostgreSQL real (incluidas altas simultáneas); verificación al salir del campo; curl |
| HU-G-01 c3: ficha Activa con fecha de alta y usuario, y «Gerente registrado correctamente» completado con la cuenta creada (A-06 c5) | Cumplido. Banner `?creado=1` en la ficha con «Cuenta de acceso»; SQL del Nivel 3 |
| HU-G-01 c4: «Editar» reabre el formulario precargado, la unicidad excluye la propia ficha, «Guardar» deshabilitado sin cambios y «Gerente actualizado correctamente»; el email de la ficha cambia también el de la cuenta (A-06 c6) | Cumplido. Tests, curl y recorrido en el navegador |
| HU-G-01 c5: la cuenta se crea en la misma transacción, con el email y el DNI como contraseña inicial, y se debe cambiar en el primer ingreso (A-06) | Cumplido. Alta atómica probada en las dos direcciones contra PostgreSQL; la contraseña no aparece en ninguna respuesta, evento ni log |
| HU-G-01 c6: «Cancelar» con confirmación si hay datos o cambios; solo el Gerente registra y modifica, el servidor responde 403 a los otros roles | Cumplido. 401 y 403 en rutas y acciones, matriz `gerentes:*` verificada contra la migración, redirección del proxy a `/sin-permiso`, menú solo para el Gerente |
| A-06 c1, c2, c5 y c6 para el rol Gerente | Verificados con esta HU. El gerente nuevo ingresa con su email y su DNI, el servidor lo manda a `/primer-ingreso` y el cambio de email en la ficha cambia el de la cuenta |
| A-06 c7 para gerentes (baja y reactivación de la cuenta) | Diferido a HU-G-05, como indica el backlog |
| DEC-44: el gerente modifica su propio email | Cumplido. Su sesión sigue válida (`sesionesValidasDesde` intacto), `esVos: true` y aviso propio en la confirmación (texto propuesto) |

### 9.2. Qué dejó hecho

- **Backend:** `src/server/gerentes/` (schemas, servicio con `crearGerente`, `modificarGerente`, `obtenerDetalleGerente`, `listarGerentes` mínimo y `verificarDisponibilidadGerente`, y Server Actions), `src/types/gerente.types.ts`, y los Route Handlers `POST` y `GET /api/gerentes` y `GET` y `PATCH /api/gerentes/[id]`. Tres códigos nuevos en `errores-dominio.ts`.
- **Rutas y menú:** regla `gerentes: ["GERENTE"]` en `rutas-por-rol.ts`, `/gerentes/:path*` en el `matcher` de `src/proxy.ts` y la sección «Gerentes» con el ítem «Listado» en el menú del Gerente, con su test (incluido que «Indicadores» no queda activo en `/gerentes/…`).
- **Pantallas** (`src/app/(dashboard)/gerentes/`): listado mínimo, alta, ficha con «Cuenta de acceso», edición, `gerente-form.tsx` y `error.tsx`. Sin «Desactivar», «Reactivar», historial, búsqueda ni paginación.
- **Textos:** 47 claves `ui.gerentes.*` y las `errores.gerente.*` en `textos.ts`.
- **Fixture** `hu-g-01.ts` (88064001 activo y 88064002 inactivo) con su línea en `fixtures/index.ts`. `seed.ts` y los gerentes del seed base no se tocaron.
- **Documentos:** filas P-47 y P-48 en `DESIGN.md` §6.4 y su historial, sección «Aplicación HU-G-01» en `RULES.md`, «Nota de implementación HU-G-01» en `spec_modulo_G.md` y la evidencia en `docs/testing/Modulo G/hu-g-01/HU-G-01-evidencia.md`.
- Sin migración y sin cambios en `schema.prisma`.

### 9.3. Desvíos respecto de lo decidido

1. **Test que la task no pedía:** el de la matriz `gerentes:*` solo para GERENTE contra la migración (ningún test existente la cubría). Está en `gerente.service.pg.test.ts`.
2. **DEC-44 en el test pg:** para que el gerente nuevo pueda hacer el `PATCH`, el test le quita la marca de cambio de contraseña escribiendo directo en la base. El flujo real de A-06 (login con el DNI, `/primer-ingreso`, cambio del email propio, misma sesión en 200, ingreso con el email viejo rechazado y con el nuevo aceptado) se recorrió con curl.
3. **Sin test del `matcher` del proxy:** ningún test fija esa lista y se decidió no agregar uno. Lo cubre la evidencia del Nivel 2: Mesa de entrada, Profesor y Alumno reciben 307 a `/sin-permiso` en `/gerentes/…`, y sin sesión la redirección a `/login` lleva el `callbackUrl` que solo agrega el proxy.
4. **Prototipo:** Claude Code no pudo renderizar el PDF y siguió la descripción de la task y el formulario de F. La figura 95 se revisó aparte y el título, la bajada, «Cancelar» y «Registrar», la nota del email y el teléfono opcional coinciden. El botón de la confirmación dice «Registrar gerente» (decisión 12).
5. **Menú:** sección desplegable «Gerentes» con «Listado» (patrón de F-03) y no el ítem plano del prototipo.
6. **Refresco del diálogo de confirmación:** la página se refresca solo tras los rechazos que se muestran dentro del diálogo. Los errores de campo y el conflicto de versión se muestran en el formulario y no refrescan: el conflicto ofrece «Recargar» y refrescar borraría lo escrito.
7. **Cambio de contraseña por curl:** se invocó la Server Action `cambiarPasswordPropia` con el encabezado `Next-Action`, porque el formulario no tiene una acción enviable sin JavaScript.
8. **Diferencias entre la spec y el código** (anotadas en la nota aditiva de `spec_modulo_G.md`): `ip` opcional en `crearGerente`, cuenta en snake_case (`ResumenCuenta`), `VALIDATION_ERROR` 400, género `null` en la modificación, clave propia para el email vacío, `obtenerNombresPersonal` en lugar de `obtenerNombresGerentes`, `errores.general.conflictoEdicion` inexistente (se usa `errores.gerente.conflictoEdicion`) y la firma real de `verificarEmailNoAsociadoAOtraCuenta`.
9. **Finales de línea:** el repo usa `core.autocrlf=true`; los archivos nuevos quedaron en LF y los modificados conservan el CRLF de la copia local.
10. **Base de desarrollo:** el gerente 88064001 quedó con el email y la contraseña de la verificación de DEC-44. `npx prisma migrate reset --force` y el seed lo devuelven al estado de la fixture.

### 9.4. Verificación final

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores (queda el aviso previo de `CALENDARIO` en `Sidebar.tsx`) |
| `npx tsc --noEmit` | Sin errores |
| `npm test` | 3624 pasan, 0 fallan (460 omitidos por guarda) |
| `npm run test:pg` completo | Pasada principal: 406 pasan, 0 fallan. Fallan 3 archivos por motivos ajenos a esta HU (ver 9.5) |
| `npx tsx scripts/verificar-claves-textos.ts` | Aprobado |
| Seed dos veces | Sin errores; la segunda no duplica ni cambia la fixture |
| `next build` | Compila y genera las seis rutas de gerentes |
| Nivel 2 (curl) | 25 pedidos, todos con el resultado esperado |
| Nivel 3 (SQL) | 7 consultas; los gerentes 24100001 y 24100002 no se modificaron |
| Recorrido en el navegador | Realizado por el responsable, sin observaciones |

### 9.5. Deuda y pendientes

- **Textos propuestos, a validar con el PO:** el aviso del email propio (`ui.gerentes.edicion.avisoEmailPropio`), `errores.gerente.datosInvalidos` y `ui.gerentes.error.cargar`.
- **Tres fallos de `npm run test:pg` que no son de esta HU:** `cancelaciones.service.pg.test.ts` (HU-H-10, el fallo conocido) y `seed-asistencia.pg.test.ts` y `materia.tarifa.pg.test.ts`. Estos dos corren el seed completo como subproceso con un límite fijo de 120 s en cada test. Medido en esta máquina, el seed sobre una base vacía tarda alrededor de 122,8 s y la fixture de G-01 suma cerca de 1 s (sin ella también supera el límite). Hay que subir ese límite en los dos tests, en otra HU.
- **Duplicación de servicios:** `gerente.service.ts` copia el diseño de `personal.service.ts`; se suma a la deuda ya registrada en A-06 y F-01.
- **Deuda anterior que no se tocó:** los textos fijos de `ConfirmarDescarteDialog`, y que un campo ajeno rechazado por `.strict()` responde 400 con `detalles` vacío (igual que F-01).
- **`seed.ts`:** recalcula el hash de las cuentas del seed base en cada corrida (misma contraseña, otra sal). Anterior a esta HU.
- **Sin test del `matcher` del proxy:** cubierto solo por la evidencia del Nivel 2.
- **Lo que sigue en el bloque de gerentes:** HU-G-03 suma búsqueda, paginación y «(vos)» al listado (`listarGerentes` sin parámetros y `obtenerDetalleGerente` con `esVos` ya están listos para extenderse sin cambiar firmas). HU-G-05 suma desactivar y reactivar, el historial de estados, las reglas «no autodesactivarse» y «al menos un gerente activo», y verifica el criterio 7 de A-06 para gerentes.
