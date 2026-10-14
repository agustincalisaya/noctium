# Validación QA — HU-I-11 · Emitir comprobante de pago

**Rama revisada:** `develop` @ `17f5daa` (commits de la HU: `20930a6`, `501218e`)
**Fuentes:** criterios de `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-I-11), `docs/specs/spec_modulo_I.md` §2.6, §2.8, §2.9 y §2.13, `docs/tasks/Sprint 3/Modulo I/HU-I-11.md`, `docs/tasks/Sprint 3/PR-0.md` (§2.3, §2.16 y tabla de alcance), `docs/RULES.md`, `docs/DESIGN.md`, `prisma/schema.prisma`, `prisma/seed.ts` y `prisma/seed/fixtures/`.
**Pruebas automáticas corridas:** `vitest run` sobre los archivos de la HU (lectura, 3 route handlers, `ComprobanteCard`, páginas, `rutas-por-rol`): **7 archivos, 76 tests, todos en verde**. No se corrieron las pruebas con PostgreSQL (`test:pg`).
**Datos verificados en la base local** (`noctium_dev`, consultas de solo lectura, 11/10/2026 22:34): ver sección 4.
**Nota:** el pedido de validación no traía pegados los criterios del Excel; se tomaron literales del backlog (`HU-Sprint-3.md`), que es la fuente que cita la task.

---

## 1. Criterios de aceptación

| # | Criterio | Dónde se implementa | Estado | Observación |
|---|---|---|---|---|
| C1 | Número único `0001-NNNNNNNN`, de una secuencia de la base, dentro de la transacción del pago; una operación = un comprobante; nunca se reutiliza; se reinicia con `migrate reset` | Secuencia: `prisma/migrations/20261008120100_sprint3_modelo/migration.sql:767` (`CREATE SEQUENCE comprobante_numero_seq AS integer START WITH 1 … NO CYCLE`). Toma del número: `siguienteNumero()` (`src/server/pagos/comprobante.service.ts:65-68`, `SELECT nextval(...)` con el `tx` recibido). Emisión: `emitirComprobante()` (`comprobante.service.ts:71`), llamada **una sola vez** al final de `registrarOperacion()` (`operacion.service.ts:196`), después del bucle que crea un `Pago` por clase. Las dos entradas (wizard `registrarOperacionDePago`, `pago.service.ts:187`, y atajo `registrarPago`, `pago.service.ts:40`) corren dentro de `transaccion()`. Formato: `formatearNumeroComprobante()` (`comprobante.schema.ts:36-38`, `padStart(8,"0")`). Unicidad: `numero Int @unique` (`schema.prisma:854`) | **Cumple** | Lo implementa el PR 0, no esta HU. No hay `MAX()+1` ni contador en memoria. Anular no consume ni libera números: la anulación total no emite nada y el reemplazo pide un `nextval` nuevo (`emitirReemplazo`, `comprobante.service.ts:88-101`). `migrate reset` borra el esquema y vuelve a crear la secuencia; **ojo**: el fixture `hu-h-06.ts:36` registra 24 pagos históricos con `registrarPago`, así que después del reset ya existen `0001-00000001` a `0001-00000024` y el primero que se registre a mano es el **`0001-00000025`** (confirmado en la base local). Faltan pruebas: ningún test con PostgreSQL de dos cobros simultáneos (R6); la secuencia es `AS integer` (R5) |
| C2 | Contenido (centro, número, fecha de pago, alumno + DNI, clases con materia/fecha/hora/monto, total, forma de pago, usuario); copia fija al emitir; alumno ve «Registrado en el centro» | Copia fija: `armarDatos()` (`comprobante.service.ts:28-62`) guarda todo en `Comprobante.datos` (JSON validado con `ComprobanteDatosSchema`, `comprobante.schema.ts:13-31`). Centro: `datosCentro(tx)` lee `centro_nombre/domicilio/telefono` de `ParametroSistema`, cargados por la migración (`migration.sql:844-846`) y por el seed (`seed.ts:809-811`). Lectura: `armarVista()` (`comprobante.lectura.ts:81-102`) arma la vista **solo** desde `datos`, salvo `numero`/`emitidoEl` (columnas del propio comprobante) y las marcas (derivadas). Vista del alumno: `leerComprobanteDeAlumno()` (`comprobante.lectura.ts:116-128`) quita `registrado_por` en el servidor y agrega `registrado_en_el_centro: true`. UI: `src/components/pagos/comprobante-card.tsx` | **Cumple** (la vista del alumno desde «Mis pagos» queda **Diferida** a HU-I-05) | Nada se lee de las tablas vivas (alumno, materia, forma de pago, personal) al mostrar. Hay un test con PostgreSQL que renombra la forma de pago (`comprobante.lectura.pg.test.ts:64`); no hay equivalente para nombre del alumno ni precio de la materia → prueba manual. `precio` se guarda pero no se muestra. El nombre sale «Apellido, Nombre» y la hora solo como inicio (decisión 0.4.14 de la task) |
| C3 | Leyenda «Comprobante interno. No válido como factura» | `src/lib/textos.ts:893` (`ui.comprobantes.leyenda`); se muestra en `comprobante-card.tsx:96` | **Cumple** | Texto literal. Se imprime (no tiene `print:hidden`) |
| C4 | Ver e imprimir desde la confirmación del pago, el detalle de la clase, el historial del alumno y «Mis pagos»; Imprimir = `window.print()` con solo el comprobante, sin librería de PDF; mesa y gerente ven todos, el alumno solo los suyos, el profesor nunca (403 en el servidor) | **Servidor:** `GET /api/comprobantes/[id]` y `GET /api/pagos/[id]/comprobante` con `withPermission("comprobantes:leer")`; `GET /api/mis-pagos/[id]/comprobante` con `withPermission("comprobantes:leer_propios")` + control del dueño en `leerComprobanteDeAlumno` (`comprobante.lectura.ts:119`, `403 FUERA_DE_ALCANCE`). Páginas: `exigirPermiso()` en `comprobantes/[id]/page.tsx:9` y `mis-pagos/[id]/comprobante/page.tsx:16`, más el guard de `proxy.ts` + `rutas-por-rol.ts:26-27`. Permisos sembrados: `seed.ts:930-932` (el profesor no tiene ninguno). Detalle de la clase: `turno.detalle.ts:46` no carga los pagos si el rol es `PROFESOR`. **Entradas:** banner del wizard (`registrar-pago-wizard.tsx`, «Ver comprobante») y lista «Pagos registrados» (`turno-pago-card.tsx`, «Comprobante N»). **Imprimir:** `comprobante-card.tsx:121` (`window.print()`) + `@media print` de `globals.css:167-188`, acotado a `body:has([data-comprobante])` | **Parcial** | El control de acceso está en el servidor, no solo en la UI. `package.json` no trae librería de PDF. **Diferido:** accesos desde el historial de pagos (HU-I-02) y «Mis pagos» (HU-I-05), que no existen; los endpoints del alumno ya están. **Falta:** el pago desde el **diálogo-atajo «Registrar pago» del detalle de la clase** (`registrar-pago-dialog.tsx`) termina en un toast sin link al comprobante (R1); se puede abrir igual desde «Pagos registrados» de esa clase. Profesor: la **API** responde `403 SIN_PERMISO`; la **página** lo redirige a `/sin-permiso` (patrón del proyecto, no un 403 literal). Que la hoja impresa salga limpia no es verificable por código |
| C5 | Anulación/corrección: «ANULADO» con motivo y fecha; reemplazo con «Reemplaza a» y «Reemplazado por»; el original no se modifica; unique en la base; el alumno ve las marcas sin el motivo | Lectura (esta HU): `marcaAnulado()` (`comprobante.lectura.ts:70-78`) y `armarVista()` derivan «ANULADO», `reemplazado_por` y `reemplaza_a` de `AnulacionPago` y de la relación `reemplazaA/reemplazadoPor`, sin escribir. `comprobanteDelPagoEnOperacion()` (`:31-36`) devuelve el vigente o, para un pago anulado, el último que lo incluyó. La vista del alumno saca el `motivo` (`:126`). Base: `reemplazaAId String? @unique` (`schema.prisma:858`). Emisión del reemplazo (PR 0): `emitirReemplazo` + `correccion.service.ts`. UI: `comprobante-card.tsx:98-116` | **Diferido** (HU-I-06 / HU-I-05) | El servicio de corrección/anulación existe, pero **HU-I-06 no tiene API ni pantalla**: no se puede anular ni corregir desde la UI (la base local tiene 0 filas en `anulaciones_pago`), así que no se prueba de punta a punta. La lectura está completa y tiene tests con PostgreSQL (`comprobante.lectura.pg.test.ts:71, 88`). Regla 8 respetada: ni la lectura ni la emisión hacen `UPDATE` sobre `comprobantes`. «Reemplazado por N» se muestra como texto, no como link al nuevo |
| C6 | Sin envío por email | — | **Cumple** | Ningún envío de email en el diff ni en `comprobante*`. (`correccion.alcance.test.ts` importa `enviarEmail` solo para testear el servicio de email de HU-A, no lo usa el comprobante) |
| T1 | HU-C-19: la UI dice «Clase», no «Turno» | `textos.ts:890-918` (`ui.comprobantes.*`, `ui.pagos.verComprobante`, `ui.pagos.comprobanteNumero`) | **Cumple** | Ningún texto visible nuevo dice «turno». Solo aparece en identificadores y rutas (`/turnos/[id]`) |
| T2 | Sin rastro de Mercado Pago | — | **Cumple** (con observación) | No hay integración ni SDK. «Mercado Pago» aparece solo como **nombre de una forma de pago** del catálogo del seed (anterior a esta HU) y como dato de prueba en `comprobante-card.test.tsx` |
| T3 | Regla 8 / emisión solo por PR 0 | `comprobante.lectura.ts` (solo lectura) | **Cumple** | La HU no tocó `comprobante.service.ts`, `comprobante.schema.ts`, `operacion.service.ts` ni `seed.ts` |

**Resumen:** cumplen C1, C2, C3 y C6 (más las reglas transversales). **C4 es parcial**: falta el link al comprobante desde el diálogo-atajo del detalle de la clase; HU-I-02/I-05 diferidas. **C5 queda diferido**: la lectura está hecha, pero no existe la UI ni la API de HU-I-06.

---

## 2. Diferencias entre la HU y la task

1. **Alcance de C1 y C5.** La task (§1) declara que emisión, numeración y reemplazos «ya los hace el PR 0» y no los prueba. La HU los pone como criterios de esta historia. No hay pruebas propias de C1 (formato, concurrencia, no reutilización) en el diff.
2. **Página en vez de modal** (0.4.1): el prototipo es un modal; se hizo la página `/comprobantes/[id]` con «Cerrar» = `router.back()` (ver R4).
3. **Puntos de entrada de C4** (0.4.8): la task conecta solo el banner del wizard y `TurnoPagoCard`. Omite el diálogo-atajo `RegistrarPagoDialog`, que la HU nombra explícitamente en C1 («HU-I-10 o su atajo desde el detalle de la clase») y que es otra confirmación de pago (R1).
4. **Ruta del alumno por id de pago:** `/mis-pagos/[id]/comprobante` y su API reciben el **id del pago**; mesa/gerente usan `/comprobantes/[idComprobante]`. No hay página para mesa/gerente por id de pago (solo la API `/api/pagos/[id]/comprobante`).
5. **Teléfono en vez de CUIT** (0.4.5): coincide con la HU; el que difiere es el mock.
6. **Formato visual** (0.4.6, 0.4.14): «Emitido» con coma (`06/10/2026, 12:42`), nombre «Apellido, Nombre», hora solo de inicio. La HU no fija formato: no es incumplimiento.
7. **Agregados que la HU no pide:** dato «Emitido», `ui.comprobantes.registradoPorSinDato` («—»), texto de ayuda de Imprimir, botón X de cierre.
8. **Sin validar el `:id` con Zod** (0.4.13): excepción a la Regla 6 documentada en la task, no en `RULES.md`.
9. **Fixture omitido:** `PR-0.md` (tabla «Lo que cae a cada HU») asigna a HU-I-11 los fixtures de «pagos, anulaciones y comprobantes». La task no agrega ninguno en `prisma/seed/fixtures/`. Hay comprobantes después del reset solo porque el fixture de **HU-H-06** registra pagos históricos (uno por operación, nunca multi-clase, nunca anulados ni reemplazados).
10. **Nivel 3 reducido:** la task verifica la copia fija solo renombrando la forma de pago; la HU (C2) cubre alumno, clases y montos.
11. **Profesor en el detalle de la clase:** la HU lo nombra; la task no. Se cumple por código previo (`turno.detalle.ts:46`).
12. **DoD:** queda sin tildar «PR con diff acotado exclusivamente a esta HU» (`HU-I-11.md:308`).

---

## 3. Riesgos y bugs detectados

| # | Severidad | Archivo:línea | Descripción |
|---|---|---|---|
| R1 | Media | `src/app/(dashboard)/turnos/[id]/registrar-pago-dialog.tsx:120-132` | El atajo «Registrar pago» del detalle de la clase llama a `POST /api/pagos`, que ya devuelve `comprobante: {id, numero}`, pero solo muestra `toast.success(...)`, sin «Ver comprobante». Incumple C4 («desde la confirmación del pago») para ese camino |
| R2 | Baja | `src/app/api/mis-pagos/[id]/comprobante/route.ts:20-21` y `src/app/(dashboard)/mis-pagos/[id]/comprobante/page.tsx:22-26` | `comprobanteDelPago()` corre **antes** del control del dueño: un alumno distingue un pago inexistente (`404` / página no encontrada) de uno ajeno (`403` / `/sin-permiso`). Oráculo de existencia de ids (cuid, poco explotable) |
| R3 | Baja | `src/server/pagos/comprobante.lectura.ts:51` | Un pago sin comprobante lanza un `Error` genérico → 500 sin el sobre `{data, error}` de la Regla 5. Intencional («no debería pasar»), pero rompe el contrato de respuesta |
| R4 | Baja | `src/components/pagos/comprobante-card.tsx:38, 125` | «Cerrar» y la X hacen `router.back()`. Si el comprobante se abre en pestaña nueva o pegando la URL, no hay a dónde volver (o se sale de la app) |
| R5 | Baja | `migration.sql:767` + `comprobante.schema.ts:37` | Secuencia `AS integer` y `padStart(8)` no trunca: desde 100.000.000 el número tendría 9 dígitos. Teórico |
| R6 | Baja (cobertura) | `src/server/pagos/*.pg.test.ts` | Ninguna prueba con PostgreSQL de **dos cobros simultáneos**, del formato ni del reinicio. C1 se sostiene por construcción |
| R7 | Baja (datos) | `prisma/seed/fixtures/hu-h-06.ts:36`, `hu-e-02.ts:23` | Los fixtures no dejan ninguna **operación multi-clase** ni comprobantes anulados/reemplazados; las fechas de `hu-e-02` son **absolutas** (2026-10-12…21), así que la clase pendiente de Sofía deja de servir pasado el 21/10. El comentario «DEMO… turno con inscriptos y SIN ningún pago» de `seed-turno-14` en `seed.ts` quedó viejo (el seed base no inscribe) |
| R8 | Info | `src/app/globals.css:184-187` | `[data-comprobante] { position: absolute; inset: 0 0 auto 0; }` no está acotado por `body:has(...)` (inocuo hoy). Con `visibility: hidden` el resto de la página sigue ocupando lugar: puede salir una hoja en blanco extra si el fondo es largo. Probar en Chrome y Firefox |
| R9 | Info | `src/server/pagos/comprobante.lectura.ts:121` | `delete vista.registrado_por` depende de que `armarVista` cree siempre un objeto nuevo; si se cachea en el futuro, se filtraría el dato |

---

## 4. Datos para la prueba manual

> Base limpia: `npx prisma migrate reset` (corre seed + fixtures). Contraseña de **todas** las cuentas: **`Password123!`** (`seed.ts:35, 142`). Los ids `seed-turno-NN` son fijos; las fechas son relativas al día en que se corre el seed (las de abajo son las de la base local actual). Los ids `cmv…` (cuid) cambian en cada reset.

### 4.1 Cuentas

| Rol | Usuario | Notas |
|---|---|---|
| Mesa de entrada | `mesa.entrada@noctium.local` (Marta Ruiz) | Tiene **caja abierta** sembrada (`seed.ts:756`), puede cobrar. También `mesa.entrada2@noctium.local` |
| Gerente | `gerente@noctium.local` (Silvia Paredes) | `comprobantes:leer`; no registra pagos |
| Profesor | `profesor1@noctium.local` (Laura Giménez, DNI 27100001) | Es la profesora de las clases históricas pagadas del fixture HU-H-06 (Matemática, 11:00) |
| Alumno A (**tiene clases para pagar**) | `alumno01@noctium.local` → **Fernández, Sofía**, DNI **40100001** | Dueña de los 24 comprobantes del fixture HU-H-06. Tras el reset tiene una clase pendiente: **Matemática · Giménez · 21/10/2026 08:00** (fixture HU-E-02, escenario «Reinscripción», id cuid) |
| Alumno B (ajeno) | `alumno02@noctium.local` → **Martínez, Lucas**, DNI **40100002** | Sin pagos. Sirve para el `403 FUERA_DE_ALCANCE` |

### 4.2 Clase(s) para un pago de varias clases

El seed base no deja clases futuras con varios inscriptos sin pagar; hay que preparar la operación:

1. Como **mesa de entrada**, abrir `/turnos/seed-turno-21` (**Matemática · Vega · 20/10 14:00**, DISPONIBLE, sin inscriptos) e inscribir a **Fernández, Sofía**. Repetir en `/turnos/seed-turno-22` (**Inglés Técnico · Acuña · 20/10 16:00**). Para tener un segundo alumno inscripto sin pagar en la misma clase, inscribir también a **Martínez, Lucas** en `seed-turno-21`.
2. Ir a `/pagos/registrar`, buscar a Sofía: deben figurar como pendientes `seed-turno-21`, `seed-turno-22` y la del 21/10 08:00. Marcar dos o tres, elegir forma de pago y confirmar (dentro de las 24 h de reserva).
3. Esperado: banner «Pago registrado correctamente (N clases)» con **«Ver comprobante»**, **un solo** comprobante con todas las clases y el total, numerado `0001-00000025` después de un reset limpio.

> **Estado actual de la base local (11/10 22:34):** ya existe `0001-00000025` (pago manual de la clase del 21/10) y Sofía ya tiene **reservas sin pagar en `seed-turno-21` y `seed-turno-22`** (vencen el 12/10 22:31 hora del centro): se puede ir directo al paso 2 y el comprobante esperado es `0001-00000026`.

### 4.3 Rutas de pantalla

| Pantalla | Ruta |
|---|---|
| Registrar pago (wizard HU-I-10) | `/pagos/registrar` (precargado: `/pagos/registrar?alumno=<idAlumno>&clase=<idTurno>`) |
| Confirmación del pago | La misma `/pagos/registrar`: banner con «Ver comprobante» (no hay ruta aparte) |
| Detalle de la clase | `/turnos/<idTurno>`, p. ej. `/turnos/seed-turno-21`: tarjeta «Pagos registrados» con link «Comprobante 0001-…» por pago. El atajo «Registrar pago» de esa tarjeta **no** ofrece el comprobante (R1) |
| Comprobante (mesa / gerente) | `/comprobantes/<idComprobante>` (**cuid del comprobante**, no el número). Ej. en la base actual: `/comprobantes/cmv4kowi800iwux8slf7x2399` (= `0001-00000001`) |
| Comprobante (alumno) | `/mis-pagos/<idPago>/comprobante` (**id del pago**). Sin pantalla «Mis pagos» que enlace hasta HU-I-05: armar la URL a mano. Ej. actual: `/mis-pagos/cmv4kowgc00iuux8soeq9z1vo/comprobante` |

Para obtener ids: el link del banner (idComprobante), la respuesta de red del POST del wizard (`pagos[].id`) o SQL: `SELECT c."idComprobante", c.numero, p."idPago" FROM comprobantes c JOIN pagos p ON p."operacionId" = c."operacionId" ORDER BY c.numero;`

### 4.4 API para probar el control de acceso directo

Con la sesión iniciada en el navegador, abrir la URL directamente (`/api` no pasa por el proxy: responde el handler).

| Llamada | Rol | Esperado |
|---|---|---|
| `GET /api/comprobantes/<idComprobante>` | mesa de entrada / gerente | `200`, vista completa (`registrado_por`, `marcas`) |
| `GET /api/comprobantes/<idComprobante>` | **profesor1** | **`403 SIN_PERMISO`** |
| `GET /api/comprobantes/<idComprobante>` | alumno01 | `403 SIN_PERMISO` (el alumno usa mis-pagos) |
| `GET /api/pagos/<idPago>/comprobante` | profesor1 | `403 SIN_PERMISO` |
| `GET /api/mis-pagos/<idPago>/comprobante` | alumno01 (dueña) | `200`, sin `registrado_por`, con `registrado_en_el_centro: true` |
| `GET /api/mis-pagos/<idPago>/comprobante` | **alumno02** | **`403 FUERA_DE_ALCANCE`** |
| `GET /api/mis-pagos/<idPago>/comprobante` | mesa de entrada | `403 SIN_PERMISO` |
| `GET /api/comprobantes/no-existe` | mesa de entrada | `404 COMPROBANTE_NO_ENCONTRADO` |
| Pantalla `/comprobantes/<id>` | profesor1 | Redirige a `/sin-permiso` |
| Detalle de una clase histórica pagada de Giménez (Matemática 11:00, p. ej. 14/09/2026; id del turno con `SELECT p."turnoId" FROM pagos p JOIN comprobantes c ON c."operacionId"=p."operacionId" WHERE c.numero=1;`) | profesor1 | **No** muestra «Pagos registrados» ni links a comprobantes |

### 4.5 Dónde cambiar datos para probar la copia fija (C2)

Después de emitir, cambiar estos datos y volver a abrir el comprobante: **no debe cambiar nada**.

| Dato | Dónde | Quién |
|---|---|---|
| Nombre del alumno | `/alumnos` → ficha → «Editar» (`/alumnos/<idAlumno>/editar`) | Mesa de entrada (`alumnos:editar`) |
| Precio de la materia (tarifa por hora) | `/materias/<idMateria>` → «Cambiar tarifa» (`cambiar-tarifa-dialog.tsx`) | **Gerente** (`materias:cambiar_tarifa`) |
| Nombre de la forma de pago | `/formas-pago` | Gerente |

Otras pruebas manuales: **Imprimir** en Chrome y Firefox (la vista previa debe mostrar solo la tarjeta, sin sidebar/navbar/botones, con la leyenda, y permitir «Guardar como PDF»); repetir `migrate reset` y verificar que tras el reset la numeración vuelve a arrancar (fixture → 1…24, primer cobro manual → 25).

---

## 5. Cierre de verificaciones diferidas por HU-I-05 (adición, 14/10/2026)

**Rama/base:** `feature/HU-I-05` sobre `e3ea18d`. **Entorno:** bases PostgreSQL descartables (`noctium_pruebas_i05_*`), `next start` de producción, Chrome del sistema (Playwright). Evidencia completa en `docs/testing/Modulo I/hu-i-05/HU-I-05-evidencia.md`. Esta adición cierra **solo** los tres puntos diferidos a HU-I-05; no modifica el estado de los demás criterios ni de los riesgos R1–R9 de este informe.

| Diferido | Caso ejecutado | Resultado | Evidencia |
|---|---|---|---|
| C2 — vista del comprobante del alumno desde «Mis pagos» | Navegación real desde una fila de `/mis-pagos` a `/mis-pagos/{pago_id}/comprobante`; los 21 pagos del alumno de prueba abren por API el mismo comprobante que muestra el listado, con `registrado_en_el_centro: true` y sin `registrado_por`. El usuario confirmó manualmente listado y comprobante normal el 14/10/2026 | **Cerrado para la vista propia** | `api-check-resultados.json`, E2E escenarios 2–3, `comprobante-escritorio.png`, `comprobante-propio.pdf`; testimonio manual (capturas no archivadas) |
| C4 — 403 por comprobante ajeno (y acceso desde «Mis pagos») | El alumno A pide el comprobante de pagos de B (misma clase y otra clase): `403 FUERA_DE_ALCANCE` sin datos de B; la página redirige a `/sin-permiso`. «Imprimir» invoca `window.print()` y la vista de impresión/PDF automatizada (Chrome) contiene solo el comprobante. El usuario informó el 14/10/2026 la vista previa nativa normal en Edge, el PDF guardado y abierto desde el diálogo, la impresión del comprobante anulado y la revisión del diálogo en Chrome y Firefox, todos con resultado correcto | **Acceso e impresión desde «Mis pagos» verificados; C4 histórico sigue parcial por R1 y otros puntos de entrada ajenos a HU-I-05.** | `api-check-resultados.json`, E2E escenario 5, `comprobante-ajeno-sin-permiso.png`, `comprobante-propio.pdf` (automatizado); confirmación manual en `HU-I-05-evidencia.md`, sin archivos nuevos para PDF guardado, anulado o Chrome/Firefox. Las capturas Edge informadas no prueban esos pasos |
| C5 — marcas sin motivo en la vista del alumno | Anulación parcial y total por `POST /api/pagos/[id]/anulacion` (mesa de entrada, I-06). El anulado parcial abre el original «Reemplazado por», el vigente el reemplazo «Reemplaza al…», la total «ANULADO · Anulado el …». El motivo no aparece en el JSON, el HTML, la pantalla ni la impresión/PDF; el SQL confirma que el motivo existe en `anulaciones_pago` | **Cerrado** | `api-check-resultados.json`, `sql-evidencia.json`, E2E escenario 4, capturas y PDFs de anulación |

Observación relacionada con R2 (sin cambios de código): un `pago_id` inexistente sigue respondiendo `404 PAGO_NO_ENCONTRADO` y uno ajeno `403`, tal como fija el contrato de HU-I-05 §4.4.
