# TASK: HU-C-23 — Centralizar los textos de la interfaz

**Módulo:** Transversal (interfaz). **Sprint:** 3. **SP:** 2.
**Estado:** Implementada, auditada y verificada localmente (incluido recorrido
de navegador). Pendiente: commit, PR a `develop` y run real del workflow.

## 0. Relevamiento aprobado y fuentes

Tomás aprobó explícitamente el relevamiento y los nueve archivos en el prompt
de implementación, con sus ajustes. Se reutiliza la revisión del Architect
del relevamiento; no se repite la auditoría ni se amplía el alcance.
Base y comprobación inicial: rama `feature/HU-C-23-Centralizar-textos-interfaz`,
HEAD `27d543ce46df1a3f9decefaa70d27fed1e7f4c7c`.
El cambio previo ajeno se preserva y queda excluido del entregable de la HU.

**Corrección posterior a auditoría (09/10/2026):** Tomás confirmó con “Si”
el relevamiento corto para corregir F1, F2, F5, F6 y F7. Se reasignó propiedad
exclusiva al mismo worker de sólo estos cinco archivos:
`scripts/verificar-claves-textos.ts`, `src/lib/claves-textos.test.ts`,
`.github/workflows/textos.yaml`, `docs/DESIGN.md` y esta task.
Los otros cuatro archivos de implementación quedan sin nuevas ediciones.
Rama y HEAD permanecen iguales; el estado inicial de esta ronda contiene los
nueve archivos de la HU y el cambio ajeno preservado. No se detectaron nuevas
diferencias respecto del entregable anterior.

**Corrección final de auditoría (09/10/2026):** por indisponibilidad del
worker, Tomás autorizó a Claude Code a corregir N1 y N5 de la auditoría y
actualizar esta task. Archivos editados: `scripts/verificar-claves-textos.ts`,
`src/lib/claves-textos.test.ts` y esta task. Rama y HEAD sin cambios.

Fuentes: Excel de Sprint 3, CA en G5–G8 (contrastados por el principal),
`docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-C-23 y convenciones 2/9),
`docs/RULES.md`, `docs/adicionales/sdd-metodologia.md`,
`docs/specs/spec_modulo_C.md` (exclusión transversal y preservación legacy),
`docs/tasks/Sprint 3/PR-0.md` §§1.1, 2.13 y regresión,
`docs/templates/_template-HU.md`, `docs/DESIGN.md` §8 y guía local Next
`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`.
No se encontró mapa de pantallas Sprint 3; se conservan los consumidores
existentes, sin inventar rutas.

**Archivos autorizados y propiedad exclusiva del único worker:**

| Acción | Archivo |
| --- | --- |
| Modificar | `src/lib/textos.ts` |
| Modificar | `src/components/shared/pagination.tsx` |
| Modificar | `docs/DESIGN.md` |
| Crear | `scripts/verificar-claves-textos.ts` |
| Crear | `src/lib/claves-textos.test.ts` |
| Crear | `src/lib/textos.test.ts` |
| Crear | `src/components/shared/pagination.test.tsx` |
| Crear | `.github/workflows/textos.yaml` |
| Crear | `docs/tasks/Sprint 3/HU-C-23.md` |

Los seis nuevos no existían al iniciar. El inventario aprobado y comprobado
desde `bbce145` hasta HEAD no encontró componentes/pantallas nuevos o
modificados por PR 0: agrega catálogo de errores y consumidores de dominio;
los handlers preservan literales previos (§1.1). El literal de alumno no
inscripto en `turno.service.ts` ya existía idéntico y se trasladó. La
infraestructura de email no introduce contenido de emails. No se requiere
ampliar archivos para CA1 en esta base.

## 1. Alcance y decisiones resueltas

Centralizar todo el copy propio del paginador (incluidos nombres accesibles
y elipsis), habilitar namespaces UI por módulo y el bloque común y comprobar
claves utilizadas con TypeScript. Preservar `TEXTOS`, `ClaveTexto`, `texto()`
y `ErrorDeDominio`, los valores legacy, interpolación y API síncrona.
Sin imports exclusivos de servidor en el catálogo.

Fuera de alcance: migración general C-19, internacionalización, dependencias,
rutas, modelos, permisos, contratos funcionales y migraciones. No se hace
staging, commit, push, merge ni se publica un PR.

La comprobación identifica símbolos reales y alias; no confunde el `TEXTOS`
homónimo local de una pantalla legacy con el catálogo. Resuelve ternarias,
mapas de objetos finitos (todos sus valores), wrappers cerrados con todas sus
llamadas comprobables y forwarding del catálogo finito de dominio. Casts
inválidos conservan la expresión real; escapes y referencias indeterminadas
dan diagnóstico con archivo y línea. No hay excepciones genéricas.

La corrección F1 invalida conservadoramente el conjunto basado en un
inicializador cuando hay escrituras sobre su variable/parámetro, el mapa o
un alias directo, o el índice usado para consultarlo. Considera asignaciones
(incluidas compuestas), `++`/`--` y `Object.assign` nativo identificado por
TypeScript. No intenta probar orden o flujo de control: una escritura en la
fuente invalida esa raíz. F2 permite consultas por propiedad sólo sobre
`TEXTOS`; los métodos y cadenas sobre `texto`, `ErrorDeDominio`,
`esErrorDeDominio` o sus alias son escapes indeterminados. Las llamadas
normales, los imports, los usos de tipo, `instanceof` y los mapas sin
escrituras conservan su soporte.

La corrección N1 suma como escrituras del primer argumento
`Object.defineProperty`, `Object.defineProperties`, `Reflect.set` y
`Reflect.defineProperty` (además de `Object.assign`), sólo cuando el
receptor es el global de la librería estándar. N5 resuelve la propiedad
abreviada (`{ t }`, `{ ED }`) al símbolo de su valor, de modo que el escape
del símbolo central se diagnostica.

**Limitaciones conocidas (aceptadas, sin uso en el código actual):** el
comprobador no detecta como escritura (N2) la mutación de un mapa a través de
un parámetro de otra función o de un contenedor (`caja.m.a = …`), (N3) la
asignación por desestructuración (`[clave] = …`, `({ clave } = …)`) ni (N4)
la variable de un `for…of`/`for…in` existente. Los tres requieren un cast o
una mutación explícita y no aparecen en `src`; el fallback de CA3 sigue
mostrando la clave y advirtiendo en ejecución. Se corrigen si aparece un
consumidor con ese patrón.

**CA2 y alcance conservado por decisión de Tomás:** `ui.turnos.*` contiene
vocabulario preparado, sin consumidores de producción en esta base. Sus
valores y la prueba de femenino acreditan el catálogo, no una pantalla.
Pagination es el nuevo consumidor exigible y no muestra el concepto Clase
ni sus estados. No se adelantan C-19, C-20 ni C-22 para acreditar CA2.

## 2. Historia y CA literales

**Como** usuario del sistema (cualquier rol) **necesito** que la interfaz use
los mismos términos en todas las pantallas, **para** no encontrar el mismo
concepto con nombres distintos y que un cambio de término se aplique en todo
el sistema a la vez.

1. Las pantallas nuevas de este sprint leen todos sus textos visibles (menú, títulos, botones, mensajes, estados, avisos, textos de emails y de impresiones) de un único archivo de textos y no escriben textos fijos en el código. Se considera “pantalla nueva” todo componente o texto creado o modificado en este sprint, aunque esté dentro de una pantalla existente (por ejemplo, la acción “Desactivar profesor” de HU-D-08 o un modal nuevo). Lo que no se toca en este sprint se migra en HU-C-19.
2. Las pantallas de este sprint se escriben desde el inicio con el término “Clase” y sus estados en femenino (Completa, Cancelada); las pantallas anteriores se migran en HU-C-19.
3. Si falta un texto en el archivo, la pantalla muestra la clave y se registra una advertencia, en lugar de romperse. Una prueba automática compara las claves que usa el código con las del archivo central y falla si falta alguna; corre en cada PR.
4. Cambiar un texto en el archivo lo cambia en todas las pantallas que lo usan, sin tocar su código.

## 3. Contrato y frontend

Contrato transversal en `docs/DESIGN.md` §9; spec C excluye expresamente
C-23. No hay nuevas API, Server Actions, eventos, RBAC o schema. Materias y
Formas de pago conservan su uso de Pagination. Los datos calculados se
interpolan; navegación por enlaces y callbacks, límites y ocultamiento no
cambian. La implementación no tiene formularios ni envío al servidor.

## 4. Evidencia de verificación

Pruebas nuevas: fallback con advertencia sin datos, interpolación, femenino,
claves reales; negativos de alias, ternaria, mapa, catálogo, wrapper, dominio,
cast inválido, símbolo homónimo ajeno, indeterminación, wrapper exportado y
escape por callback. Eliminar la línea real de una clave utilizada sobre una
copia virtual completa del catálogo falla la misma función de la suite/CLI
(sin modificar el archivo real). Pagination verifica SSR, enlaces, accesibilidad, callbacks en
jsdom, rangos/límites y propagación central con restauración en `finally`.
SSR/jsdom no se registra como recorrido de navegador.

### Resultados históricos de la implementación original

Estos conteos corresponden a la entrega anterior a la auditoría; la evidencia
de la corrección se agrega por separado más abajo.

| Comando / comprobación | Resultado observado |
| --- | --- |
| `npm ci` | Inicial exit 1 por entorno; reintento autorizado exit 0, 738 paquetes. Vitest instalado 3.2.7 → lock/instalado 5.0.3, sin cambios de manifiestos |
| `npx prisma generate` | Exit 0, cliente generado necesario para verificaciones |
| `npm test -- src/lib/textos.test.ts src/lib/claves-textos.test.ts src/components/shared/pagination.test.tsx src/server/shared/errores-dominio.test.ts` | Pasada final original exit 0, 4 archivos / 23 tests, después de corrección type-only y negativos individuales |
| `npx tsc --noEmit` | Última ejecución worker exit 0 |
| `npm run lint` | Implementación inicial, principal: exit 1, seis errores `require` en scripts documentales y dos warnings; fuera de asignación. No se determinó autor ni fecha de origen |
| `npm test` | Final después de eliminación real en fuente virtual: exit 0, 128 archivos aprobados / 24 skipped, 1763 tests aprobados / 166 skipped (1929 total) |
| Lint focal de los seis TypeScript de la HU | Principal: exit 0 |
| `git diff --check` de la HU | Principal y worker: exit 0 |
| `npm run build` | Principal: exit 0, 32 páginas |
| CLI `npx tsx scripts/verificar-claves-textos.ts` | Implementación original, worker y principal: exit 1 antes de ejecutar comprobador, `uv_os_get_passwd` ENOMEM del entorno. Claude declaró posteriormente exit 0 en su entorno; esa declaración no reemplaza evidencia propia. En esta corrección, principal y worker repitieron la CLI exacta: exit 1, mismo ENOMEM en `tsx` antes de cargar el checker; sin cambiar dependencias, configuración ni permisos |
| `npm run test:pg` | Inicial exit 1 por cliente ausente; tras generate, guarda de `noctium_test` preexistente: exit 1, sin tocarla. Pasada descartable: 20 archivos aprobados/4 skipped, 132 tests aprobados/34 skipped. Otra base nueva fase 3: 1 archivo/16 tests aprobados. Pendientes tres archivos que requieren base fija; bases temporales eliminadas |
| Navegador Materias / Formas de pago | Pendiente: Edge headless no abrió CDP y falló GPU/Access denied. HTTP 200 login sólo demuestra servidor accesible; no recorrido. Datos locales insuficientes para varias páginas; no se agregaron datos |
| GitHub PR workflow | Archivo configurado, sin run real: pendiente; no se publicó PR |

Los seis errores de lint se reprodujeron por el principal con
`npx eslint docs/fases-sdd/gentle-sdd-deepseek.js docs/fases-sdd/HU-C-09/gentle-sdd-deepseek.js`:
exit 1, seis errores `require` y un warning `parseError`. Ambos JS no están
versionados y están ignorados por exclusión local de `docs/fases-sdd/`.
La exclusión fue localizada por el principal en `.git/info/exclude`, línea 9
(`docs/fases-sdd/`). El otro warning del lint global corresponde a `CALENDARIO` en Sidebar.
Esto demuestra ubicación y estado actual, sin probar que fueran anteriores
a C-23; su origen no está determinado. No se tocaron esos archivos.

**Hipótesis H1 descartada:** el principal comprobó que tsconfig excluye
`node_modules`, `**/*.test.ts` y `**/*.test.tsx`: 333 raíces `src`, 332 archivos
no declarativos analizados y cero tests. `src/lib/textos.test.ts` queda fuera
de esas raíces y la comprobación real devuelve `[]`. Al introducirlo
explícitamente como fuente virtual se diagnostican `ui.inexistente` (línea
14) y `toString` (línea 15). No se cambió tsconfig ni se excluyeron consumidores.

### Correcciones de auditoría y evidencia de esta ronda

| ID | Archivos | Cambio | Prueba / evidencia | Resultado | Pendiente |
| --- | --- | --- | --- | --- | --- |
| F1 | `scripts/verificar-claves-textos.ts`, `src/lib/claves-textos.test.ts` | Registrar escrituras de bindings, objetos/alias e índices; invalidar conjuntos no demostrables | Doce negativos `it.each`, incluidos ++/-- en índices separados e inline, diagnóstico por archivo/línea; fixtures TS válidos. Positivo de copia primitiva reasignada que conserva original y otro mapa | Evidencia local en esta ronda, detallada abajo | Revisión read-only final |
| F2 | `scripts/verificar-claves-textos.ts`, `src/lib/claves-textos.test.ts` | Acceso a propiedad permitido sólo catálogo; métodos y cadenas de funciones/clase/guard diagnostican escape | Trece negativos `it.each` de call/apply/bind, cadenas y alias; positivo de llamadas, tipos, instanceof, catálogo y mapa/alias intocados | Focal final exit 0 | Revisión read-only final |
| F5 | `.github/workflows/textos.yaml` | `permissions: contents: read`, preservando evento, Node y comandos | Inspección del YAML | Implementado | Run real del PR por Tomás |
| F6 | `docs/DESIGN.md` | §9 antes del historial, contenido/numeración conservados y entrada aditiva | Inspección del diff | Corregido | Revisión documental final |
| F7 | `docs/tasks/Sprint 3/HU-C-23.md` | Evidencia por entorno y ronda, origen lint no determinado, Testing y DoD; límites CA2/CA4 | CLI propia exit 1 ENOMEM, declaración Claude exit 0 distinguida; JS no versionados/ignorados; evidencias de §4 y niveles de §6 | Documentado | CLI entorno, lint fuera de asignación, navegador y GitHub por Tomás |

En esta ronda no hubo dos correcciones fallidas de una misma causa. Focal
inicial de correcciones: exit 0, 25 tests; después de añadir comprobación
sintáctica y semántica de fixtures, focal repetida: exit 0, cuatro archivos,
25 tests. En revisión de ese código se observó que seguir el inicializador
al registrar una escritura escalar podía marcar el original como escrito.
Se separó escritura de binding de mutación del objeto referenciado, y se
agregaron los positivos del original y mapa intocados en el mismo fixture.
Fue un ajuste de revisión, sin test rojo ejecutado que se le atribuya.
Los casos se separaron en `it.each` y se prepara cada fixture una sola vez
con `beforeAll`. Focal intermedia exit 0, cuatro archivos / 48 tests; suite
intermedia del principal exit 0, 128 archivos aprobados / 24 skipped,
1788 tests aprobados / 166 skipped (1954 total). En revisión posterior se
extendió el seguimiento del índice únicamente a sus operadores `++`/`--`
inline y se agregaron dos negativos individuales tipados. No se atribuye
un test rojo a esta observación de revisión; la evidencia de la versión
anterior se conserva como intermedia.
La focal final después de los índices inline pasó con exit 0, cuatro archivos
y 50 tests. La CLI exacta se repitió también después de ese cambio: exit 1,
`uv_os_get_passwd` ENOMEM en tsx, antes de cargar el checker.
`npx tsc --noEmit` final: exit 0.
`npx eslint scripts/verificar-claves-textos.ts src/lib/claves-textos.test.ts`
final: exit 0. Suite completa final del principal después de los índices
inline: `npm test` exit 0, 128 archivos aprobados / 24 skipped (152 total),
1790 tests aprobados / 166 skipped (1956 total). Respecto de la referencia
original de 1763 aprobados se suman 27 pruebas (12 negativos F1, 13 negativos
F2 y dos positivos); los 166 skips permanecen. No hubo fallos de aserción en
esa suite final; los skips no se cuentan como aprobados. El principal repitió
la focal final con 50 aprobados, TypeScript y ESLint de los dos TS con exit 0;
su CLI final mantuvo exit 1 antes del checker por el mismo ENOMEM.

### Auditoría final y corrección N1/N5 (Claude Code, 09/10/2026)

Antes de editar, la reverificación de F1/F2 confirmó que los ocho casos de
escritura y los cuatro escapes reportados quedaban diagnosticados, y encontró
N1–N5 con fixtures que compilan. Para N1/N5 se agregaron primero seis
negativos (`defineProperty`, `defineProperties`, `reflectSet`,
`reflectDefineProperty`, `{ t }`, `{ ED }`): fallaron los seis y pasaron los
30 restantes. Tras la corrección, 36/36. Se corrigió además un error de tipos
preexistente en `comprobarTiposFixture` (concat de diagnósticos), invisible
para `tsc` del proyecto porque excluye los tests; se comprobó con un
tsconfig temporal externo que incluye los tres tests de la HU: exit 0.

| Comando / comprobación (entorno Claude Code) | Resultado |
| --- | --- |
| Focales (4 archivos) | Exit 0, 56 tests |
| `npx tsx scripts/verificar-claves-textos.ts` | Exit 0, “Claves de textos verificadas.” |
| `npx tsc --noEmit` / tsc sobre los tests de la HU | Exit 0 / exit 0 |
| ESLint de los seis TypeScript de la HU / `git diff --check` | Exit 0 / exit 0 |
| `npm test` (sin variables de base) | Exit 0: 128 archivos aprobados / 24 skipped; 1796 tests aprobados / 166 skipped (1962) |
| `npm run build` | Exit 0 |
| `npm run lint` global | Exit 1: los mismos seis errores y dos warnings. Los dos JS no están versionados (excluidos en `.git/info/exclude`), por lo que el CI no los analiza; el warning de `Sidebar.tsx` está en HEAD desde `4f16f9d` (01/10/2026), anterior a C-23 |
| PostgreSQL | No aplica: C-23 no toca persistencia. Los tres archivos PG pendientes son de regresión histórica, ajenos a esta HU |

**Recorrido real en navegador (Chrome, `next dev` sobre `noctium_dev`,
usuarios del seed, sin modificar datos más allá de iniciar/cerrar sesión):**

- Materias (gerente): 7 registros, tamaño 20 → el control no se muestra
  (DESIGN §8.1, una sola página); `?pagina=2` responde 200 sin errores.
- Formas de pago (gerente): 4 registros → el control no se muestra.
- Alumnos (gerente, 46 registros, 3 páginas, modo enlaces): “Página 1 de 3 ·
  46 en total”, “Anterior” con `aria-disabled="true"`; “Siguiente” navega a
  `?pagina=2` (“Página 2 de 3”) y a `?pagina=3` (6 filas, “Siguiente”
  deshabilitado). Recarga directa de `?pagina=3` conserva el estado.
  `aria-label` “Paginación”, “Página anterior” y “Página siguiente” salen del
  catálogo central.
- Consola del navegador y log del servidor: sin advertencias de clave
  ausente ni errores de cliente.
- No recorrido: el modo cliente (números, rango, elipsis) de Historial
  académico (el alumno del seed no tiene historial) y del modal de turnos
  futuros (sólo se abre editando materias del profesor). Queda cubierto por
  jsdom/SSR.

Evidencia: GIF `HU-C-23-paginacion-alumnos.gif` y capturas de las páginas 1
y 3 en el equipo de Tomás (no versionadas).

Los intentos históricos de corrección del analizador: (1) hipótesis de tipos del AST,
`modifiers` sobre firma no admite todo subtipo; se cambió a API
`canHaveModifiers/getModifiers`, tsc posterior exit 0. (2) primera focal
mostró raíces vacías por separadores Windows y alias de catálogo perdido al
seguir su inicializador; se normalizó `resolve` y se preservó identidad de
exports centrales, repetición focal exit 0. Son causas distintas; no hubo
dos correcciones fallidas persistentes de la misma causa.

Al agregar detección de escapes, focal y suite completa detectaron un falso
positivo sobre la anotación de retorno `ErrorDeDominio` de
`inscripcion.service.ts:268` (anotación de tipo, sin ejecución). Hipótesis:
un `TypeReferenceNode` no debe tratarse como escape runtime. Se permitió ese
nodo y se agregó un positivo de retorno tipado y negativos individuales por
línea para wrapper exportado, callback y referencia desconocida. La siguiente
focal pasó 23/23. La primera suite completa tuvo exit 1 (1762 aprobados,
166 skipped y un fallo); la final tuvo exit 0 (1763 aprobados, 166 skipped).
No se debilitó la validación de claves runtime.

## 5. Matriz CA y cierre

| CA | Evidencia | Estado | Pendiente |
| --- | --- | --- | --- |
| 1 | Inventario Sprint 3, catálogo único y paginador sin copy fijo; recorrido real en Alumnos/Materias/Formas de pago | Verificado (código, pruebas y navegador) | — |
| 2 | Vocabulario preparado `ui.turnos.*` y prueba de femenino, sin consumidores producción; Pagination no muestra Clase/estados | Catálogo verificado; sin pantalla que acreditar para estos términos en el alcance actual | Exigir el contrato a futuras HU (DoD, convención 9); no adelantar su implementación |
| 3 | Fallback/warn, comprobador único, negativos F1/F2/N1/N5; CLI exit 0 (entorno Claude); workflow `pull_request` sin filtros | Implementación, suite y CLI locales verificadas | Run real del workflow en el PR |
| 4 | Test renderiza Pagination dos veces con distintas rutas y restaura el catálogo; consumidores reales leen el catálogo en cada render | Verificado SSR y en navegador (textos del catálogo en Alumnos) | — |

Worker registrado `noctium_worker`, configuración observada por principal:
`gpt-6.1-sol/medium`; principal declarado `gpt-6.1-sol/high`. Modelo/esfuerzo
runtime y permisos efectivos no observables con metadatos disponibles:
**no verificados**, no se infiere aislamiento técnico desde configuración.
El worker no delegó: editó sólo los nueve archivos originales y, en esta
corrección aprobada, sólo los cinco reasignados. No se lanzaron agentes
de revisión durante escritura.

Estado Git final: misma rama y HEAD iniciales; tres archivos modificados y
seis nuevos de la HU, sin staging. El cambio previo ajeno sigue visible y
excluido del diff de la HU; el working tree no está limpio. El principal
comprobó que su contenido y los manifiestos permanecen idénticos al inicio.

Pendientes para transición read-only y auditoría de Claude: revisar diff y
contenido completo de los seis nuevos, resolver evidencia de navegador y run real del PR, evaluar fallos
de lint con origen no determinado y skips PG sin tocar la base habitual. No declarar la HU
terminada ni mergeada mientras falta evidencia. No hay cambios de negocio
ni archivos fuera de asignación realizados por el worker.

## 6. Testing en tres niveles

### Nivel 1 — Unit, SSR y jsdom

Pruebas focales reales de catálogo, claves, errores de dominio y Pagination:
La ronda conserva conteos por versión en §4. Las doce reproducciones de escrituras y los
trece escapes se comprueban individualmente con la misma función usada por
suite/CLI; los fixtures F1/F2 pasan además comprobación sintáctica/semántica
TypeScript. SSR y jsdom acreditan renderizado, callbacks y nombres accesibles
del componente; el test de propagación renderiza ese componente con dos rutas,
sin ejecutar las pantallas completas. No equivalen a un navegador real.

### Nivel 2 — Postman / contrato API

No aplicable a esta corrección: no crea ni modifica contratos API, endpoints
ni mutaciones funcionales. No se ejecutó Postman y no se atribuye evidencia
de API a los mocks, la suite o SSR.

### Nivel 3 — BD / TablePlus

No aplicable a la corrección: no modifica persistencia, schema, transacciones
ni auditoría de datos. No se ejecutaron consultas de TablePlus ni nuevos
tests PostgreSQL en esta ronda. La regresión histórica PG figura con sus
resultados reales en §4: bases descartables aprobadas y tres archivos
pendientes por guarda de la base fija preexistente. No se repitió ni se tocó
la base habitual para esta corrección.

## 7. Checklist de Definition of Done

- [x] Aprobación explícita del relevamiento original y de los cinco archivos de corrección.
- [x] Implementación dentro de asignación, sin cambios de modelos, permisos funcionales, rutas o dependencias; permisos mínimos del workflow aprobados en F5.
- [x] Focales y TypeScript aprobados; lint focal de la corrección aprobado.
- [x] Claves utilizadas comprobadas con negativos por caso y fixtures tipados válidos.
- [x] Valores temporales de propagación restaurados; sin cambios reales al catálogo en la corrección.
- [x] Suite completa final (corrección N1/N5): exit 0, 1796 aprobados / 166 skipped, con skips explícitos sin acreditarlos como aprobados.
- [x] Lint global: los errores están en JS locales no versionados (`.git/info/exclude`) que el CI no analiza; lint de los archivos de la HU exit 0.
- [x] CLI local: exit 0 en el entorno de Claude Code; en el entorno de Codex falla antes del checker por ENOMEM de `tsx` (entorno, no código).
- [x] Recorrido real de Pagination: Alumnos (navegación y límites), Materias y Formas de pago (control oculto con una página).
- [x] Auditoría final: aprobada con observaciones (N2–N4 como limitación conocida; F3 a decidir por el dueño del módulo C).
- [ ] Commit sin `.gitignore` ni archivos personales, PR a `develop` y run real del workflow `Textos C-23` en verde sobre ese commit.
- [ ] Merge.

La HU queda lista para PR; no se declara terminada hasta el run real y el merge.
