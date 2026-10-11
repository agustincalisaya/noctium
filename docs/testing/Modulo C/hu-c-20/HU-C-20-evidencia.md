# HU-C-20 — Evidencia de implementación local

Estado: implementación local verificada en unitarios/componente y PostgreSQL;
HTTP autenticado, SQL manual y navegador verificados el 09/10/2026 (ver
«Verificación manual del 09/10/2026»), incluido el recorrido con teclado
físico; run de GitHub pendiente. Fuente de resultados única; task en
`docs/tasks/Sprint 3/HU-C-20.md`. No acredita merge ni funcionalidad diferida.

## Base y preservación

Rama `feature/HU-C-20-confirmar-inscripcion-resumen`; HEAD
`24ca8da96d0a1f295d94652926f5a916e173521f`.
Estado inicial: solo `.gitignore` modificado. Hash inicial SHA-256:
`52BEC6CCAD8DE2820C256B82D5D5809787AB17FDE208A6831F8085BC86827EF2`.
Hash final idéntico al inicial. Estado final: siete archivos existentes
modificados y diez nuevos de C-20, más `.gitignore` ajeno intacto. Los 17
archivos exactos están en task §0; no hay cambios fuera de asignación.
No staging, commit, push ni merge.

## Matriz CA → evidencia → resultado → diferidas

| CA literal en task §2 | Evidencia directa / indirecta | Resultado local | Diferida / responsable |
|---|---|---|---|
| 1 — Inscribirme abre resumen sin alta y muestra datos | Directa: componente real jsdom `Inscribirme pide GET sin POST`; servicio `datos completos`; PG `GET ... ninguna mutación` con snapshot persistido. Indirecta: route con wrapper simulado | Aprobada en niveles 1, 2 y 3 y en navegador (A1, A9, C1, C2) | — |
| 2 — precio y leyenda literal | Directa: precios 60/120/180 en unit/PG; leyenda en componente real; PG `tarifa nueva` comprueba precio de confirmación y estabilidad posterior | Aprobada con la decisión de alcance de la HU; no garantiza importe mostrado ante cambio previo | Decisión aceptada por Tomás el 09/10/2026: el precio mostrado en el GET puede diferir del guardado por el POST si la tarifa cambia entre ambos; el importe queda fijo desde el alta. |
| 3 — plazo, cancelación y límite | Directa parcial: null del interino, campos de límite y offset calculados por servidor; componente verifica ausencia de leyendas diferidas | Parcial: contrato interino aprobado, CA3 completo NO cumplido | Plazo/vencimiento C-22 (Tomás); reglas C-14 (Tomás); valor configurable N-01 (responsable del sprint), condiciones/pasos en task §1 |
| 4 — Confirmar reserva/Volver conserva elección | Directa: componente real conserva tres radios y pide nuevo resumen al reabrir; confirma id del DTO, doble clic, bloqueo y navegación | Aprobada en jsdom y en navegador (C1, C2, C4 emulado, teclado físico) | — |
| 5 — cupo/superposición revalidados y sin alta ante rechazo | Directa: PG GET→cambio→servicio real C-12, snapshot antes/después del rechazo; carrera por último lugar. Componente muestra motivos en diálogo conservando selección. Indirecta: route simulado | Aprobada en servicio/PG/componente, HTTP autenticado (A7) y navegador (C3) | — |

## Verificaciones ejecutadas

| Comando | Exit code | Resultado |
|---|---|---|
| `npm test -- src/server/turnos/turno.resumen-inscripcion.service.test.ts 'src/app/api/turnos/[id]/inscripcion/resumen/route.test.ts'` (primera pasada) | 1 | 24 aprobadas, 1 fallo del spy de permiso llamado al importar; Vitest lo limpiaba al comenzar el caso. Se movió el spy al wrapper de ejecución de la prueba; sin cambio de producción |
| `npm test -- src/server/turnos/turno.resumen-inscripcion.service.test.ts 'src/app/api/turnos/[id]/inscripcion/resumen/route.test.ts' 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx'` | 0 | 35 pruebas, 3 archivos aprobados |
| `npx tsc --noEmit` | 0 | Aprobado tras agregar servicio, route, UI y pruebas |
| `npm run test:pg -- src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts` | 0 | 10 pruebas aprobadas en `noctium_pruebas_c5695584`, 38 migraciones aplicadas, runner completado |
| `npm test -- src/server/turnos/turno.autoservicio.test.ts src/server/shared/precio-clase.test.ts src/server/publico.aislamiento.test.ts src/lib/textos.test.ts src/lib/claves-textos.test.ts` | 0 | 109 pruebas aprobadas, 5 archivos |
| `npx tsx scripts/verificar-claves-textos.ts` | 1 | Fallo del arranque de tsx: `os.userInfo()` → `uv_os_get_passwd ENOMEM`, reproducido dos veces; no alcanza a ejecutar el verificador |
| `node --experimental-strip-types scripts/verificar-claves-textos.ts` | 0 | Mismo script con soporte TS nativo de Node 24.19.0: «Claves de textos verificadas». Aviso MODULE_TYPELESS_PACKAGE_JSON, sin cambiar manifiesto |
| `npx tsc --noEmit` (con todas las pruebas C-20) | 0 | Aprobado |
| `npm run lint` | 1 | 6 errores no-require-imports y 1 warning en dos scripts locales ignorados; 1 warning en Sidebar. Detalle/evidencia abajo |
| `npx eslint` con las diez fuentes TS/TSX exactas de C-20 (lista abajo) | 0 | Ningún error ni warning en entregable |
| `npm test` | 0 | 146 archivos aprobados, 27 omitidos; 1.948 pruebas aprobadas, 187 omitidas (PG no habilitado en esta pasada) |
| `npm run test:pg` | 1 | Pasada aleatoria: 23 archivos/153 pruebas aprobados, 4 archivos/34 pruebas omitidos por sus guardas. Pasada especial de generación: 1 archivo/16 pruebas aprobados. Pasada fija bloqueada porque ya existe `noctium_test`; runner no la toca |
| `npm run build` | 0 | Next 16.3.8, compilación, TypeScript y 36 páginas generadas; nuevo GET `/api/turnos/[id]/inscripcion/resumen` listado como dinámico |
| `git diff --check -- . ':!.gitignore'` y `git diff --no-index --check -- /dev/null <nuevo>` para los diez nuevos | 0 en rastreados; 1 por diferencia de no-index | Sin errores de whitespace. Git avisa conversión LF→CRLF al tocar los archivos, sin cambiar configuración. Diff completo exportado fuera del repo, incluyendo nuevos y excluyendo `.gitignore` |
| HTTP real con `npm run start -- --port 3100` y fetch sin cookie al GET de resumen | 0 en request; servidor detenido con Ctrl+C | HTTP 401 `SESION_INVALIDA`, envelope y no-store. Log Auth.js `UntrustedHost`: NO acredita autenticación real válida; no se cambió confianza/autenticación para eludirlo |

Comando de lint exclusivo (exit 0):

```powershell
npx eslint 'src/types/turno.types.ts' 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.tsx' 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx' 'src/lib/textos.ts' 'src/server/aulas/aula.publico.ts' 'src/server/turnos/turno.resumen-inscripcion.service.ts' 'src/server/turnos/turno.resumen-inscripcion.service.test.ts' 'src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts' 'src/app/api/turnos/[id]/inscripcion/resumen/route.ts' 'src/app/api/turnos/[id]/inscripcion/resumen/route.test.ts'
```

**Fallo de lint general y evidencia de preservación:** los errores están en
`docs/fases-sdd/HU-C-09/gentle-sdd-deepseek.js` (19–21, warning 325) y
`docs/fases-sdd/gentle-sdd-deepseek.js` (13–15). Ambos aparecieron en el
inventario inicial, están ignorados por Git, no existen en HEAD y su
LastWriteTime es 29/09/2026. No se modificaron. No se ejecutó un lint base
antes de implementar, por lo que no se atribuye un run fallido a HEAD.
El warning `CALENDARIO` de `src/components/layout/Sidebar.tsx:46` está
en un archivo cuyo contenido se comparó contra `git show HEAD:...` y es idéntico.
No se alteran archivos ni reglas de lint fuera de alcance.

**No ejecutadas (estado previo al 09/10/2026; actualizado en «Verificación
manual del 09/10/2026»):** casos de Postman con login/RBAC reales, SQL manual,
navegador y GitHub. No hay herramienta de navegador disponible ni
Playwright instalado en el proyecto; no se agregó dependencia.
El HTTP de producción local reportó `UntrustedHost`; el pendiente requiere
el entorno local habitual de desarrollo con login, no una modificación
de seguridad por esta HU. La validación del SQL manual sigue pendiente;
los snapshots del test PG sí se ejecutaron y compararon datos reales.

Las omisiones no cuentan como aprobación. No se completa la DoD de los
tres niveles ni de PR/merge; sí las verificaciones locales indicadas.

### Guardas PostgreSQL

Se inspeccionaron `scripts/test-pg.mjs`, `src/server/testing/pg.ts` y fábricas.
Runner exige host local, crea base `noctium_pruebas_<8 hex>` aleatoria,
migraciones sin seed, `DATABASE_URL` y `HU_PR0_TEST_DATABASE_URL` iguales,
archivos sin paralelismo y TZ=UTC; elimina solo la base creada en `finally`.
Pruebas C-20 reutilizan esa infraestructura y nunca resetean la base habitual.
Las guardas de bases fijas de Sprint 2 se preservan: si `noctium_test` ya
existe, el runner no la toca y reporta la pasada bloqueada.

La pasada fija dejó bloqueados:
`src/server/turnos/turno.cancelacion.pg.test.ts`,
`src/server/turnos/turno.prioridad.pg.test.ts` y
`src/server/turnos/turno.reprogramacion.pg.test.ts`.
No se eludieron sus guardas. Tras las corridas, un SELECT de solo lectura
de `pg_database` comprobó que las bases `noctium_pruebas_c5695584`,
`noctium_pruebas_e33470bf` y `noctium_pruebas_hu_c17_fase3_5e7a7780`
ya no existen y `noctium_test` sigue presente.

### Alcance de lo probado

La prueba de route simula `withPermission`: acredita envelope/traducciones
e identidad que pasa el route, **no** autorización real de NextAuth/RBAC.
La prueba UI usa componente y diálogo reales con fetch simulado: **no** es
un recorrido de navegador. PostgreSQL prueba los servicios y persistencia
reales, no login ni HTTP. La colección y el SQL creados no acreditan ejecución.

**Precio GET→POST:** GET 24.000 para 120 minutos con tarifa 12.000/h;
fixture cambia a 15.000/h; POST real guarda 30.000. Otro cambio a 18.000/h
no modifica los 30.000 almacenados. No se probó ni implementó garantía de
24.000 frente al cambio previo. No se cambian tarifas de datos habituales.

## Pendientes de Tomás: API, navegador y GitHub

1. Preparar entorno local de prueba aislado y descartable con migraciones
   PR 0; usar las fábricas existentes para cuentas/fichas y clases nuevas,
   sin usar una base habitual para altas. No copiar secretos en evidencia.
2. Arrancar Next con ese DATABASE_URL. Importar la colección C-20, completar
   ids de los casos y `base_url`; iniciar sesión con login vigente y Cookie
   Jar local. Ejecutar cada caso con la cuenta indicada (ALUMNO vinculada,
   sin ficha, inactiva, PROFESOR) y caso sin cookies. Registrar status,
   código y Cache-Control. Guardar resultados sanitizados, sin cookies/token.
3. Antes/después del GET ejecutar SQL C-20 con id del fixture y comparar:
   clase, inscripciones, proyecciones, historial y eventos iguales. Tras
   introducir cupo/superposición capturar snapshot, confirmar y verificar
   rechazo sin nueva alta. Confirmación exitosa: precio guardado, usuario,
   historial/eventos y estado interino sin plazo. Cerrar base según runner.
4. Con navegador real ir a `/alumno/turnos/solicitar`: seleccionar los tres
   campos, Inscribirme y comprobar Network (GET sin POST), datos completos,
   leyenda y ausencia de diferidas. Volver conserva selección; reabrir,
   confirmar doble clic y verificar solo un POST/navegación/banner. Simular
   cupo y superposición mientras está abierto; comprobar motivo inline y
   selección conservada. Probar GET fallido, conexión fallida, recarga
   (selección vuelve al estado inicial sin inscripción), foco/teclado,
   Escape durante POST y viewport móvil/escritorio. Guardar capturas sin datos reales.
5. Tras revisión y autorización separada de publicación, GitHub debe ejecutar
   los checks del PR. Registrar URL, SHA y resultado del run; la presencia
   de workflows o el build local no prueban ese run. No hay PR/merge en esta entrega.

## Ajustes del 09/10/2026

**PostgreSQL informado por Tomás:** `npm run test:pg` ejecutado por Tomás
el 09/10/2026: C-20 10/10, pasada general 153 aprobadas y 34 omitidas,
generación 16/16. Cancelación, reprogramación y prioridad sin ejecutar
por la base `noctium_test` preexistente. Esta ejecución completa la
repetición pendiente de C-20; las omisiones y los casos bloqueados no
cuentan como aprobados. No acredita Postman con login, SQL manual,
navegador ni GitHub, que siguen pendientes.

Se ajustó el título de confirmación al patrón de C-25 usando materia,
día y hora del resumen; se reformularon referencias de proceso en la
documentación; se sincronizó la decisión de precio aceptada y se
registraron en task §5 los límites de integración y pendientes.
No cambia el POST de C-12, los errores legacy ni los contratos.

Reproducción C1: `npm test -- 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx'`
antes de corregir el título, exit 1: nueve pruebas aprobadas y una fallida.
La nueva aserción esperaba materia/día/hora con el patrón C-25 y recibió
«¿Querés confirmar tu reserva en esta clase?».

### Verificaciones del 09/10/2026

| Comando | Exit code | Resultado |
|---|---|---|
| `npm test -- src/server/turnos/turno.resumen-inscripcion.service.test.ts 'src/app/api/turnos/[id]/inscripcion/resumen/route.test.ts' 'src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx' src/lib/textos.test.ts src/lib/claves-textos.test.ts` | 0 | 74 pruebas aprobadas en cinco archivos; título con materia, día y hora comprobado en el diálogo real de jsdom |
| `npx tsx scripts/verificar-claves-textos.ts` | 1 | El arranque vuelve a fallar con `uv_os_get_passwd ENOMEM`; no ejecuta el verificador |
| `node --experimental-strip-types scripts/verificar-claves-textos.ts` | 0 | Claves de textos verificadas; aviso MODULE_TYPELESS_PACKAGE_JSON, sin cambios de manifiesto |
| `npx tsc --noEmit` | 0 | Aprobado |
| `npx eslint` sobre las diez fuentes C-20 listadas arriba | 0 | Sin errores ni warnings |
| `npm test` | 0 | 1.948 pruebas aprobadas y 187 omitidas; 146 archivos aprobados y 27 omitidos |
| `npm run build` | 0 | Compilación, TypeScript y 36 páginas generadas; GET de resumen listado como dinámico |
| `git diff --check -- . ':!.gitignore'` y revisión de los diez nuevos con `git diff --no-index --check` | 0 en rastreados; 1 por diferencia de no-index | Sin errores de whitespace. Estado: los 17 archivos C-20 y `.gitignore` con SHA-256 inicial intacto; staging vacío. Los ajustes modificaron siete archivos respecto de su estado previo |

Las verificaciones locales no sustituyen los pendientes de
Postman con login real, SQL manual, navegador y GitHub. La ejecución PG
informada por Tomás queda registrada arriba con sus omisiones y bloqueo.

### Coincidencias textuales conservadas en los 17 archivos

Se conservan las siguientes referencias por su contenido técnico o por
el vocabulario de diseño.

| Archivo y línea | Motivo para conservarla |
|---|---|
| `src/server/turnos/turno.resumen-inscripcion.service.pg.test.ts:19` | Snapshot de datos persistidos y proyecciones del dominio |
| `docs/tasks/Sprint 3/HU-C-20.md:138` | Título de la sección de trazabilidad exigida por el template |
| `docs/tasks/Sprint 3/HU-C-20.md:140` | Reutilización del registro de eventos por el POST vigente |
| `docs/DESIGN.md:43`, `:83`, `:88`, `:308` | Vocabulario de acciones, botones y listados en el diseño |
| `docs/specs/spec_modulo_K.md:277` | Columnas de trazabilidad de datos exigidas por RULES §2 |
| `docs/specs/spec_modulo_C.md:1990`, `:2029` | Columnas y eventos del dominio; ausencia de nuevas columnas |

### Ajustes realizados

| Ajuste | Archivos y líneas | Cambio y resultado | Bloqueos / pendientes |
|---|---|---|---|
| Título | `src/lib/textos.ts:112`; `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.tsx:252`; `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.test.tsx:50` | Título parametrizado con el DTO, `fechaLarga` reutilizada; botones conservados. Reproducción previa fallida y 74 pruebas focalizadas aprobadas tras la corrección | Arranque de tsx con ENOMEM; verificador aprobado con Node |
| Documentación | `docs/tasks/Sprint 3/HU-C-20.md:12`; `docs/testing/HU-C-20-evidencia.md:134`; `docs/specs/spec_modulo_C.md:1453` | Títulos y redacción neutrales. Las líneas históricas de otras historias en spec C y DESIGN se conservan exactamente como HEAD | Ninguno para este ajuste |
| Precio | `docs/specs/spec_modulo_C.md:1467`; `docs/tasks/Sprint 3/HU-C-20.md:51`; `docs/testing/HU-C-20-evidencia.md:23` | Una misma frase de decisión aceptada en los tres documentos; igualdad comprobada. POST sin cambios | Ninguno para este ajuste |
| Integración | `docs/tasks/Sprint 3/HU-C-20.md:158`; `docs/testing/HU-C-20-evidencia.md:136` | Límites con C-19, motivos legacy y guard documentados. PG de Tomás registrado: C-20 10/10, general 153 aprobadas/34 omitidas y generación 16/16 | Base `noctium_test` preexistente bloquea cancelación, reprogramación y prioridad; Postman autenticado, SQL manual, navegador y GitHub pendientes |

## Verificación manual del 09/10/2026

Entorno: servidor local, base de pruebas aislada con seed y fixtures.

Detalle: base descartable `noctium_pruebas_<8 hex>` en el PostgreSQL local,
con migraciones y seed del proyecto; `next dev` en `localhost:3000` con
`DATABASE_URL` explícito. Cuentas del seed y fixtures creados solo en esa
base, replicando `src/server/testing/fabricas.ts`: cuenta ALUMNO sin ficha,
cuenta ALUMNO con ficha inactiva, clase con materia sin tarifa, clase llena
(cupo 1 ocupado), clase de cupo 1 para el rechazo, clases de 60 y 120 minutos
y su asociación profesor-materia. Sin ids, cookies ni contraseñas en esta
evidencia. Ningún archivo del repositorio se modificó durante la ejecución.

### Llamadas HTTP con sesión real

Login real de NextAuth (credenciales) con un cliente HTTP local; cookies solo
en memoria. Todas las respuestas llevan `Cache-Control: no-store, must-revalidate`.

| Caso | Resultado | Esperado | ¿Coincide? |
|---|---|---|---|
| A1. ALUMNO con ficha activa, cupo y tarifa | 200; `data` con `turno_id`, `materia{id,nombre}`, `profesor{id,nombre_para_mostrar}`, `fecha`, `hora_inicio`, `hora_fin`, `duracion_min`, `aula{id,nombre}`, `cupo`, `lugares_disponibles`, `precio` (entero, 24000 para 120 min), `plazo_pago_horas: null`, `vence_pago_el: null`, `limite_cancelacion_en_linea` con offset `-03:00`, `limite_cancelacion_pasado: false`; `error: null` | 200 con resumen; plazo/vencimiento en `null` | Sí |
| A2. ALUMNO sin ficha | 403 `SIN_PERMISO` «Tu cuenta no tiene una ficha de alumno vinculada» | Anotar | — (registrado) |
| A3. ALUMNO con ficha inactiva | 409 `ALUMNO_INACTIVO` «Tu ficha de alumno no está activa» | Anotar | — (registrado) |
| A4. PROFESOR autenticado | 403 `SIN_PERMISO` | 403 | Sí |
| A5. Sin cookies | 401 `SESION_INVALIDA` | 401 | Sí |
| A6. Materia sin tarifa | 422 `MATERIA_SIN_TARIFA` «Esta clase todavía no tiene precio. Comunicate con el centro.» | 422 `MATERIA_SIN_TARIFA` | Sí |
| A7. Clase llena | 409 `CUPO_INSUFICIENTE` «El turno alcanzó su cupo máximo» (motivo legacy, task §5 nota 1) | Anotar | — (registrado) |
| A8. Id inexistente | 404 `TURNO_NO_ENCONTRADO` «No se encontró el turno» | Anotar (spec: 404) | Sí |
| A9. GET no muta | Conteos globales de inscripciones, eventos, historial, proyecciones y pagos iguales antes y después de los ocho GET | Sin cambios | Sí |

### SQL de solo lectura

Consultas equivalentes a `docs/testing/HU-C-20.sql` en transacción `READ ONLY`,
con guarda de nombre de base.

- (b) Snapshot de clase, inscripciones, eventos, proyecciones e historial de la
  clase de 120 min: hash idéntico antes y después de un GET adicional desde el
  diálogo. El GET no creó filas.
- (a) Inscripción creada por el POST del navegador: `VIGENTE`,
  `PAGO_SIN_REGISTRAR`, precio 24000, `venceEl` null, con autor. Luego la tarifa
  de la materia del fixture se subió de 12000 a 15000 con un UPDATE directo en la
  base descartable (no existe API de edición de tarifas). El precio guardado
  siguió en 24000, mientras el importe según la tarifa actual daba 30000.
  El cambio de tarifa es un UPDATE de fixture, no un flujo de la aplicación.

### Navegador

Chrome, cuenta ALUMNO del seed. Conteo de
llamadas con un envoltorio de `fetch` en la página y con el log de `next dev`.

| Caso | Resultado | ¿Coincide con lo esperado? |
|---|---|---|
| C1. Volver y reabrir | Un GET de resumen por apertura (tres aperturas, tres GET 200), ningún POST; tras Volver se conservan materia, profesor y horario; al reabrir, mismo título y datos. Foco verificado con teclado físico | Sí |
| C2. Doble clic en «Confirmar reserva» | Un solo `POST /api/turnos/:id/inscripcion` 200 en el log del servidor; una inscripción creada; navegación a `/alumno?inscripcion=exitosa` con banner «Te inscribiste correctamente» | Sí |
| C3. Rechazo del servidor | Con el diálogo abierto se llenó la clase de cupo 1; Confirmar → POST 409; «El turno alcanzó su cupo máximo» dentro del diálogo; selección conservada; snapshot sin cambios (mismo hash) | Sí |
| C4. Viewport 375×667 | La ventana no cambió de tamaño (Chrome maximizado); se emuló con un iframe del mismo origen de 375×667 (viewport efectivo 371×663). Título completo en 5 líneas sin recorte; sin scroll horizontal (`scrollWidth` 356); «Volver» y «Confirmar reserva» dentro del viewport (y 576–612) | Sí, con emulación por iframe |
| C5. Escape durante el POST | POST retenido 8 s en el cliente. Escape no cerró el diálogo; «Volver» y «Procesando…» quedaron deshabilitados. Al responder: POST 200, inscripción creada y navegación con banner. La nota 3 de la task (guard `signal.aborted`) se refiere a las cargas de opciones y no describe este caso | Comportamiento coherente (sin cierre ni doble envío); no hay criterio escrito para comparar |
| C6. GET fallido | Rechazo simulado de `fetch` en el GET de resumen: el diálogo no se abre; banner en la página «No pudimos cargar el resumen. Volvé a intentarlo.»; «Inscribirme» sigue habilitado. Reintento con red restablecida: GET 200 y el diálogo se abre; Escape lo cierra sin POST | Sí |
| C7. Consola | Navegador (solo la última carga de página): INFO de React DevTools y `[HMR] connected`; sin errores ni advertencias de hidratación o claves. Servidor: solo entradas ajenas a C-20 (cookie previa del navegador al abrir `/login` e instrumentación de `fetch` de la prueba) | Sí |

### No ejecutado / Pendiente

- Viewport móvil con emulación de dispositivo real o con la ventana redimensionada: la ventana no cambió de tamaño; se usó un iframe de 375×667.
- Viewport móvil con mensaje de error dentro del diálogo: no medido.
- Consola del navegador en C1–C5: el registro de la extensión empieza en la primera lectura (C6); en C1–C5 solo se revisó el log del servidor.
- Cambio de tarifa por flujo de la aplicación (B(a)): no existe API; se usó un UPDATE de fixture en la base descartable.
- Run de GitHub: fuera del alcance de esta verificación.

### Recorrido con teclado físico

Verificado por Tomás el 09/10/2026 con teclado físico en
`/alumno/turnos/solicitar`: resultado correcto. Reemplaza las observaciones
de foco tomadas con la herramienta automatizada, cuya entrega de teclas fue
inestable.

### Diferencias con lo esperado

- Ninguna.

Estado de git al cerrar: `git status --short` con 17 entradas, igual que al
inicio; staging vacío.
