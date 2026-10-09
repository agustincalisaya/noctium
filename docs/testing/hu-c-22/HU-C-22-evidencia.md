# HU-C-22 — Evidencia de implementación local

09/10/2026. Reserva propia, resumen y Mis clases implementados en el alcance
autorizado. Las dos decisiones inicialmente pendientes quedaron autorizadas y
aplicadas el 09/10/2026: excepción interina de `inscripcion.cancelacion` y
adaptación puntual del test de autoservicio. **Cierre funcional pendiente** de
las integraciones y comprobaciones no ejecutadas indicadas más abajo.
La regresión PG y lint global no están aprobados. No acredita la unidad
C-22/I-10/C-24 ni merge. Task: `docs/tasks/Sprint 3/Modulo C/HU-C-22.md`.

## Matriz de los seis criterios

Los CA literales completos y sus diferidas figuran en task §2, contrastados
con Excel G21–G26/I21. Esta tabla delimita la evidencia, sin sustituirlos.

| CA | Evidencia ejecutada | Resultado en esta fase | Diferida / pendiente |
|---|---|---|---|
| 1. Confirmar reserva ocupa cupo y horario | Directa: servicio real/PG `una sola alta concurrente`, fila VIGENTE/RESERVADA, recurso ALUMNO, clase Completa y rechazos sin alta; disputa por último lugar en PG del resumen. Componente real jsdom confirma id del POST y bloquea doble envío. Route con wrapper simulado | Reserva acreditada en servicio/BD y componentes; caso de compatibilidad autoservicio adaptado, PG 10/10 | Login, POST y navegador ejecutados (ver «Recorrido HTTP, SQL y navegador»); vista móvil pendiente |
| 2. Plazo, leyendas y reprogramación | Directa: PG 24 h por defecto, mínimo período/inicio, GET→POST con momentos distintos, parámetro posterior no altera alta, reprogramarTurno real atrás/adelante preserva base y no revive vencidas; leyendas literales y banner actual en UI | Implementado y aprobado en los niveles ejecutados | N-01 configura el plazo por UI; C-24/I-06 integran reapertura/proceso. La frase «se cancela sola» no está acreditada como proceso en C-22 |
| 3. Pago vinculado e inscripción quitada | Directa: quitarAlumnoTurno real conserva fila/finalización/actor, libera cupo y admite alta nueva. Indirecta para pago: PR 0/fábricas preparan pagos y finalizaciones; prueba que pagos de fila anterior no pagan la nueva | Soporte existente y presentación verificados | I-10 ausente: no se acredita su registro real, cobro ni recorrido de pago |
| 4. Mis clases, reserva vencida y re-reserva | Directa: listado/confirmación PG, frontera exacta, precio y ausencia de Pendientes; prioridad de vigente en unitario, inscripción finalizada en PG. Orden entre varias históricas: revisión de código, sin prueba específica. Servidor rechaza re-reserva sin alta; exclusiones por PR 0; SSR de página evita invitación vencida/pagada/cancelada y valida id + sesión | Situaciones y rechazo del alumno verificados; DTO interino autorizado de cuatro campos | C-24 centro/proceso, C-14 cancelación, B-07 baja; estados preparados no acreditan esos flujos. Campo cancelacion/regla final diferidos a HU-C-14; aceptación documental no acredita ejecución |
| 5. Cancelar reserva impaga antes de vencer | Ningún flujo de cancelación propia implementado ni ejecutado | Diferido según alcance aprobado | C-14 (Tomás), sin inventar acción ni elegibilidad |
| 6. Precio congelado | Directa: GET 24.000, tarifa del fixture cambia, POST guarda 30.000, cambio posterior conserva precio; PG y UI muestran precio guardado en vigente | Aprobado en servicio/BD y componentes | HTTP/SQL: GET 26.000, tarifa cambiada antes del POST, POST guarda 30.000 y lo conserva tras restaurar la tarifa; no se promete precio del GET ante cambio previo |

## Resultados de verificaciones

| Comando / comprobación | Exit code | Resultado real |
|---|---:|---|
| Unitarios focales de servicios C-22 (autoservicio, propios, resumen, route) | 0 | 4 archivos, 54 pruebas aprobadas |
| `npx vitest run 'src/app/(dashboard)/alumno/page.test.tsx' 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx'` | 0 | 2 archivos, 25 pruebas aprobadas |
| PG focal, primera pasada (comando debajo) | 1 | 26 aprobadas, 1 fallida: la prueba nueva suponía vence_el null en clase cancelada; no lo exige el contrato. Se corrigió la expectativa para conservar fecha guardada; la situación sigue informativa sin invitación |
| PG focal, después de esa corrección | 0 | 3 archivos, 27 pruebas aprobadas, 39 migraciones existentes aplicadas |
| `npm test` | 0 | 178 archivos / 2.224 pruebas aprobadas; 36 archivos / 228 pruebas omitidas; las PG omitidas no cuentan como aprobadas |
| `npx tsc --noEmit` | 0 | Tipos aprobados |
| `npx eslint` con las 15 fuentes TS/TSX exactas indicadas debajo | 0 | Sin errores ni warnings del entregable |
| `npm run lint` | 1 | 6 errores no-require-imports en dos JS locales no versionados; 2 warnings. No se cambia configuración ni archivos fuera de alcance |
| `npx tsx scripts/verificar-claves-textos.ts` | 1 | tsx falla antes del comprobador: os.userInfo → uv_os_get_passwd ENOMEM, Node 24.19.0 |
| `node scripts/verificar-claves-textos.ts` | 0 | Mismo comprobador ejecutado con soporte TS nativo: «Claves de textos verificadas». Aviso MODULE_TYPELESS_PACKAGE_JSON; manifiesto intacto |
| `npm run test:pg` | 1 | Pasada principal: 29 archivos / 189 pruebas aprobados, 3 archivos fallidos (2 pruebas fallidas y 1 suite), 4 archivos / 37 pruebas omitidos. Pasada especial C-17: 1 archivo / 16 pruebas aprobadas. Pasada fija bloqueada por base preexistente |
| `npm run build` | 0 | Compilación Next 16.3.8 y TypeScript aprobados |
| `git diff --check` y comprobación no-index de los 7 nuevos | 0 en rastreados; sin salida de error en nuevos | Sin errores de whitespace; aviso LF→CRLF en un test, sin cambiar configuración |
| JSON y compilación sintáctica de scripts Postman con Node | 0 | 11 casos válidos sintácticamente; no ejecución HTTP autenticada |
| HTTP local real sin cookie: GET resumen, POST inscripción, GET propios | 0 (script de comprobación) | Los tres devolvieron 401 SESION_INVALIDA, envelope y no-store; Auth.js reportó UntrustedHost. No acredita sesión válida |
| Chrome headless, perfil temporal, `/login` | 0 (comando PowerShell), resultado funcional fallido | DOM de 0 bytes, log FATAL «GPU process isn't usable» y GPU exit -1073741790; ningún recorrido acreditado |

PG focal exacto:

```powershell
npm run test:pg -- src/server/turnos/turno.reserva-alumno.pg.test.ts src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts src/server/turnos/turno.propios.pg.test.ts
```

Lint focal exacto:

```powershell
npx eslint 'src/server/turnos/turno.service.ts' 'src/server/turnos/turno.resumen-inscripcion.service.ts' 'src/types/turno.types.ts' 'src/lib/textos.ts' 'src/app/(dashboard)/alumno/page.tsx' 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.tsx' 'src/server/turnos/turno.autoservicio.test.ts' 'src/server/turnos/turno.propios.test.ts' 'src/server/turnos/turno.propios.pg.test.ts' 'src/server/turnos/turno.resumen-inscripcion.service.test.ts' 'src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts' 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx' 'src/server/turnos/turno.reserva-alumno.pg.test.ts' 'src/app/(dashboard)/alumno/page.test.tsx' 'src/app/api/turnos/[id]/inscripcion/route.test.ts'
```

### Fallos globales y límites

- `turno.inscripciones.pg.test.ts:133–134`: respuesta exacta de tres campos y
  expectativa antigua PAGO_SIN_REGISTRAR/venceEl null para autoservicio. Se
  propone conservar los tres campos y rechazos, sumar inscripción y comprobar
  RESERVADA/plazo. En esa pasada estaba fuera del listado y no se había editado.
  **Actualización 09/10/2026:** ampliación puntual autorizada y aplicada; nueva
  pasada del archivo: 10/10 aprobadas (exit 0). Fallo anterior histórico, no
  aprobado retrospectivamente; suite completa no repetida ni declarada verde.
- `resultado-examen.service.pg.test.ts:106`: SIN_PERMISO en lectura de historial
  (`historial.service.ts:72`). Ambos archivos sin cambios C-22; no se atribuye
  el origen sin una comparación ejecutada de base. Fuera del alcance.
- `indicadores/clases.service.pg.test.ts`: arranque del seed por tsx falla con
  ENOMEM en os.userInfo; suite fallida y tres pruebas omitidas. No se editan
  seed, dependencia ni seguridad para eludirlo.
- Lint: los 6 errores están en dos archivos JS locales no versionados
  (`git ls-files` no los lista), ausentes del checkout de CI. Warnings
  parseError en uno de esos archivos y CALENDARIO en Sidebar. Sin
  modificaciones; no se afirma una pasada de lint base previa.

### PostgreSQL y separación de niveles

Se inspeccionaron runner, guardas y fábricas existentes. Host exclusivamente
local; creación de base aleatoria nueva; DATABASE_URL y HU_PR0_TEST_DATABASE_URL
iguales; migraciones sin seed; archivos sin paralelismo; TZ=UTC; eliminación
de la base creada en finally. SELECT final de pg_database (exit 0): las bases
noctium_pruebas_dc6593e2, noctium_pruebas_5cf75097, noctium_pruebas_a9ff7504
y noctium_pruebas_hu_c17_fase3_bd7b506c ya no existen; noctium_test permanece.
Ningún reset de datos habituales ni cambio en
prisma/. La base fija preexistente `noctium_test` no se tocó: quedaron omitidas
cancelación/prioridad/reprogramación del Sprint 2 con esa guarda. Reprogramación
de C-22 sí se ejecutó con su servicio real en la nueva base aleatoria.

Pruebas de route simulan withPermission; SSR/jsdom simulan servicios/fetch.
Acreditan contratos y componentes, no NextAuth/RBAC ni navegador. Pruebas PG
llaman servicios reales y comparan persistencia. Preparar pagos/finalizaciones
por PR 0 o UPDATE de fixture acredita estados, no UI/API de las HU diferidas.

`HU-C-22.postman_collection.json` tiene 11 casos sin secretos y
`HU-C-22.sql` contiene únicamente lectura y guarda de base. Su ejecución con
sesión válida figura en «Recorrido HTTP, SQL y navegador».

## Actualización puntual autorizada — 09/10/2026

Tomás autorizó y se aplicó la nota aditiva junto a spec C §2.17.4:

> Hasta integrar HU-C-14, HU-C-22 entrega id, situacion, vence_el y precio en el objeto inscripcion de Mis clases. El campo cancelacion se incorpora con HU-C-14, sin acciones ni elegibilidad anticipadas en HU-C-22.

Se mantiene el contrato final y los CA literales. La excepción es solo del
listado/presentación; límites del GET resumen y POST reserva intactos.
Se actualizan task, historial de spec y descripción/aserción exacta del DTO
interino de Postman. La aceptación documental no prueba ni implementa campo,
elegibilidad o acción de cancelación; responsable HU-C-14 (Tomás).

Única ampliación: `src/server/turnos/turno.inscripciones.pg.test.ts`, caso de
autoservicio. Se conserva `toEqual` de la respuesta con sus tres campos
originales y se añade el objeto exacto `inscripcion`. Reloj fijo 05/10/2026
12:00 UTC; clase del fixture siete días después, 60 min a 12.000/h; alta
VIGENTE/RESERVADA con precio 12.000 y vencimiento exacto 06/10/2026 12:00 UTC
(09:00 -03:00). Se verifican fila única, id devuelto, autor/identidad,
reservadaEl/inicioPlazo/venceBaseEl/venceEl; no hay tolerancias. Duplicado,
superposición y turno Pendiente conservan las mismas aserciones. Casos de
cupo, rechazo e inscripción central del archivo permanecen intactos.

| Nueva comprobación | Exit code | Resultado |
|---|---:|---|
| `npm run test:pg -- src/server/turnos/turno.inscripciones.pg.test.ts` | 0 | 1 archivo, 10 pruebas aprobadas, ninguna omitida; base nueva noctium_pruebas_87ed1aca, 39 migraciones existentes |
| `npx tsc --noEmit` | 0 | Tipos aprobados tras adaptación |
| `npx eslint src/server/turnos/turno.inscripciones.pg.test.ts` | 0 | Test sin errores ni warnings |
| JSON y compilación sintáctica de scripts Postman con Node | 0 | 11 casos preparados válidos; no ejecución HTTP autenticada |
| SELECT de pg_database posterior al runner | 0 | noctium_pruebas_87ed1aca ausente; noctium_test sigue presente, sin tocarla |
| `git diff --check` y comprobación no-index de los 7 nuevos | 0 en rastreados; sin errores de whitespace en nuevos | Entregable completo de 23 rutas |

No se repitieron suite global, PG completa, build, lint global ni comprobador
de textos: el ajuste no modifica producción ni catálogo y se verificaron
los archivos afectados. Sus resultados anteriores se conservan, incluidas
las pasadas fallidas. No se afirma que historial/indicadores estén corregidos.
HTTP autenticado, SQL manual y navegador siguen pendientes con los pasos
siguientes. PG no sustituye SQL manual ni recorrido real.

## Verificación focal posterior — 09/10/2026

Ajuste en `page.tsx`: el fallo de consulta del banner registra la excepción
original en el servidor; la interfaz conserva el mismo error visible. Su test
comprueba el registro de la causa.

| Comprobación | Exit code | Resultado |
|---|---:|---|
| `npx tsc --noEmit` | 0 | Tipos aprobados |
| Unitarios y componentes no PG de C-22 (6 archivos, antes del ajuste) | 0 | 79 pruebas aprobadas |
| `npx vitest run` de `page.test.tsx` y `solicitar-turno.test.tsx` tras el ajuste | 0 | 25 pruebas aprobadas |
| `npx eslint` con las 15 fuentes del lint focal | 0 | Sin errores ni warnings |
| `node scripts/verificar-claves-textos.ts` | 0 | «Claves de textos verificadas» |
| PG focal: reserva-alumno, resumen, propios e inscripciones | 0 | 4 archivos, 37 pruebas aprobadas, ninguna omitida; base descartable nueva |
| `git diff --check` | 0 | Sin errores de whitespace |

El mensaje de `RESERVA_PREVIA_SIN_PAGO` que devuelve el servidor sale del
catálogo central y coincide con el literal del CA 4; la prueba PG de reserva
verifica código y status, y el texto se verifica en
`inscripcion.service.pg.test.ts`. Suite global, PG completa y build no se
repitieron.

## Recorrido HTTP, SQL y navegador — 09/10/2026

Entorno: base descartable nueva `noctium_pruebas_c0f0880e` (servidor local,
39 migraciones y seed de desarrollo), `next dev` en el puerto 3100 apuntando
a esa base y login real de Auth.js con cuentas del seed (`alumno06`,
`alumno05`, `profesor1`, `mesa.entrada`). La base se eliminó al terminar.
Las preparaciones de datos (UPDATE de tarifa, cupo, estado de la clase o
fechas de una reserva) se indican como tales: acreditan estados, no flujos de
otras HU.

**HTTP (colección versionada).** Cada caso se ejecutó con el request y los
`pm.test` de la colección, con cookie de sesión real, mediante un runner Node
(no Postman/Newman). 11/11 casos aprobados:

| Caso | Status | Resultado |
|---|---:|---|
| 01 GET resumen | 200 | 5/5; `plazo_pago_horas` 24, `vence_pago_el` -03:00, precio 26.000 |
| 02 POST reserva | 200 | 6/6; tarifa cambiada a 15.000/h entre GET y POST (preparación): `precio` 30.000, `estado_pago` RESERVADA |
| 03 GET Mis clases | 200 | 5/5; DTO interino de cuatro campos, situación RESERVADA y precio 30.000 |
| Sin sesión ×3 | 401 | 4/4 cada uno; `SESION_INVALIDA`, envelope y no-store |
| Rol PROFESOR | 403 | 4/4; `SIN_PERMISO` |
| Reserva previa sin pago | 409 | 4/4; reserva propia llevada a vencida sin marcar (preparación). Mensaje real idéntico al literal del CA 4 |
| Último cupo después del GET | 409 | 4/4; cupo llevado a 1 (preparación) y ocupado por otro alumno vía POST real; sin alta |
| Superposición después del GET | 409 | 4/4; mismo horario que la reserva del caso 02; sin alta |
| Sin tarifa al POST | 422 | 4/4; tarifa anulada entre GET y POST (preparación) y restaurada; sin alta |

**SQL (`HU-C-22.sql`, ids reemplazados).** Antes y después del GET: snapshots
idénticos (el GET no escribe). Después del POST: una fila VIGENTE/RESERVADA,
`creadoPorUsuarioId` de la sesión, precio 30.000, `reservadaEl` =
`inicioPlazo`, período original 1 día, `venceEl` = `venceBaseEl`, proyecciones
ALUMNO/AULA/PROFESOR, evento `turno:alumno_agregado` con origen AUTOSERVICIO e
historial VIGENTE/RESERVADA. Tras restaurar la tarifa (precio según tarifa
actual 26.000) la fila conserva 30.000. Los cuatro rechazos no crearon filas.
Quitar y reprogramar quedan acreditados por las pruebas PG con servicios
reales; no se repitieron manualmente.

**Navegador (Chrome, login ALUMNO).**

| Caso | Resultado |
|---|---|
| Mis clases | Reservada · pagar antes del… con precio guardado; Reserva vencida sin precio; totales cuentan tarjetas |
| Resumen | Leyenda literal del CA 2 con día, fecha y hora; precio 18.000 |
| Volver | Cierra el diálogo y conserva materia, profesor y horario |
| Doble clic en Confirmar reserva | Un solo POST (200); una fila en BD |
| Banner tras el POST | Leyenda literal del CA 2 con el id definitivo; se mantiene al recargar y al pasar a Anteriores |
| Clase cancelada (preparación) | Banner y tarjeta: Pago sin registrar, sin invitación a pagar |
| Reserva vencida (preparación) | Banner y tarjeta: Reserva vencida, sin precio |
| Pagada (cobro real por `POST /api/pagos` de mesa de entrada) | Banner y tarjeta: Pagada, precio 30.000 |
| Id ajeno e id inexistente | Sin banner ni datos de la otra inscripción |
| Rechazo del POST (re-reserva) | Mensaje literal del CA 4 dentro del diálogo; selección conservada; sin navegación |
| Teclado | Tab y Shift+Tab alcanzan Volver y Confirmar reserva dentro del diálogo |
| Consola | Sin errores |

Observaciones del recorrido:
- `ConfirmarAccionDialog` (`src/components/shared/confirmar-accion-dialog.tsx`)
  es fijo y centrado, sin altura máxima ni scroll. Con la leyenda del plazo el
  resumen mide unos 545 px; en un viewport de 529 px de alto el borde superior
  queda cortado y, al sumar el mensaje de error, los botones quedan fuera de
  la pantalla. Componente compartido fuera de los archivos de C-22; sin cambios.
- El banner usa el estilo de éxito también para situaciones no Reservadas
  (cancelada, vencida).
- El menú lateral sigue mostrando «Mis turnos» y «Solicitar turno», mientras
  la página usa «Mis clases» y «Solicitar clase».
- No se ejecutaron: vista móvil (la ventana no admitió el cambio de tamaño),
  clase iniciada en el navegador (cubierta por pruebas unitarias y PG) y fallo
  de red del GET/POST/consulta del banner (cubierto por pruebas de componentes).

## Pendientes con pasos reproducibles

1. Navegador en viewport móvil (por ejemplo 390×844 y 844×390): Mis clases,
   resumen y banner; confirmar si el diálogo deja accesibles sus botones.
2. GitHub: verificar un run accesible del SHA que Tomás comitee; no publicar para
   obtenerlo. I-10 ausente: C-24 comienza después del commit de C-22,
   comprobando la dependencia real, sin implementarla para resolver la ausencia.
