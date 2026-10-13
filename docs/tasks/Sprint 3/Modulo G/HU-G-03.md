# TASK: HU-G-03 — Listar gerentes

**Módulo:** G (Gerentes) · **Sprint:** 3 · **Carril:** 4 · **Responsable:** Adriel · **SP:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_G.md` §1 («Quién construye qué», DEC-38), §2.3 (listado y búsqueda) y §3.7 · `docs/specs/spec_modulo_F.md` §2.3 (mismo diseño) · `docs/specs/spec_modulo_B.md` §2.7 y §3.9 (criterio de búsqueda de HU-B-05) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-G-03, criterios 1 a 5) · `docs/tasks/Sprint 3/Modulo G/HU-G-01.md` (sección 9: qué dejó hecho) · `docs/tasks/Sprint 3/Modulo F/HU-F-03.md` (sección 9: **el patrón a copiar**)
**Prototipo de referencia (para el frontend):** `Noctium - Sprint 3 - Prototipo por HU - v18 corregido.pdf`, figura 96 («Gerentes», Gerente), **solo la página 87**. Muestra el listado con el buscador y tres filas, una de ellas con «(vos)»; no muestra paginación, filas inactivas ni los estados vacíos. Las figuras 97 y 98 (páginas 88 y 89) son de HU-G-05: no se usan. Las capturas son orientativas: ante cualquier diferencia prevalece el backlog.
**RBAC:** solo **GERENTE** (`gerentes:leer`, ya sembrado). Cualquier otro rol recibe `403 SIN_PERMISO` en el servidor aunque la interfaz oculte la opción (spec G §3.7).
**Schema:** ya completo, **sin migración y sin tocar `schema.prisma`**. El índice del listado (`fichas_gerente_orden_listado_idx`) ya existe.
**Rama:** `feat/hu-g-03-listar-gerentes`, creada desde `develop` actualizado (G-01 ya está mergeada, PR #257).
**Estado de la HU:** implementada y cerrada; el resultado está en la sección 9.

---

## 0. Decisiones y verificaciones previas

### 0.1. Decisiones (no relevar de nuevo)

1. **Es completar lo que dejó G-01 (DEC-38).** G-01 dejó `GET /api/gerentes` y `/gerentes` sin `q`, sin paginación y sin «(vos)», con `listarGerentes(db?)` que devuelve `{ items, total }` (todas las fichas). G-03 suma búsqueda, paginación y `esVos` por ítem sobre eso, copiando lo que hizo F-03 con el personal. No crea rutas ni pantallas nuevas: `/gerentes` y `GET /api/gerentes` ya existen.
2. **Firma del servicio.** `listarGerentes(query, sesionUsuarioId, db = prisma)`, con `query = { pagina, q? }`: es la firma de la spec G §2.3 (`listarGerentes(query, sesionUsuarioId)`) con `db` al final, como el resto del servicio. **No es aditiva respecto de la de G-01**, que recibía `db` como primer argumento: los llamadores de G-01 (página, ruta y los tests unitarios, de ruta, de pantalla y con PostgreSQL) se adaptan. Ningún test de G-01 se borra ni se debilita; los que fijaban «sin parámetros» o «sin búsqueda ni paginación ni «(vos)»» pasan a fijar el comportamiento nuevo con la misma exigencia. Orden por `apellidoNormalizado`, `nombreNormalizado` y `dni`, ascendente. `skip`/`take` con `POR_PAGINA_GERENTES = 10` fijo. `total` es el del resultado **filtrado**. Una página mayor que la última devuelve la última y, sin resultados, `pagina: 1` y `total_paginas: 0` (igual que `listarPersonal` y `listarAlumnos`).
3. **Query.** `ListarGerentesQuerySchema` y `POR_PAGINA_GERENTES` en `gerente.schema.ts`, tal cual la spec G §2.3: `pagina` entero positivo (por defecto 1), `q` con `trim` y máximo 100 caracteres, `.strict()`. **`por_pagina` no es parámetro**: enviarlo es `400 VALIDATION_ERROR`. El 400 usa el mismo formato que el resto de `/api/gerentes` (`VALIDATION_ERROR` con `detalles` y el mensaje `errores.gerente.datosInvalidos`, que ya existe).
4. **Búsqueda.** Un filtro propio `construirFiltroBusquedaGerentes(q)` en `src/server/gerentes/gerente.busqueda.ts`, copia de `personal.busqueda.ts` sobre `apellidoNormalizadoFichaGerente`, `nombreNormalizadoFichaGerente` y, solo si el token es numérico, `dniFichaGerente`. Tokens en AND, campos en OR, coincidencia parcial. `q` de menos de 2 caracteres tras `trim` se ignora y devuelve el listado completo. Opera sobre activos e inactivos. Reutiliza `tokenizarBusqueda` de `src/lib/busqueda-texto.ts`; no importa nada de alumnos ni de personal.
5. **Diferencia spec/código (anotar en la nota aditiva de la spec).** La spec G §1 («Utilidades compartidas») remite a `spec_modulo_F.md` §1, que ubica `tokenizarBusqueda` en `src/server/shared/busqueda-persona.ts`. En el repo vive en `src/lib/busqueda-texto.ts` (lo usan alumnos, turnos y personal): **se reutiliza esa y no se crea `busqueda-persona.ts`** (la misma diferencia que anotó F-03).
6. **«(vos)» (criterio 3).** `esVos` lo calcula el **servidor** por ítem: `ficha.usuarioId !== null && ficha.usuarioId === sesionUsuarioId`. El `select` del listado suma `usuarioId` para calcularlo, pero **el ítem no lo devuelve**: solo `esVos`. Una ficha sin cuenta nunca es «(vos)». `GerenteListadoItem` suma `esVos: boolean` (en camelCase, como en el ejemplo de la spec G §2.3 y como `DetalleGerente`). La interfaz agrega «(vos)» junto al apellido, en la celda de Apellido (así lo muestra el prototipo).
7. **Respuesta de la ruta y sesión.** `{ items, pagina, por_pagina, total, total_paginas }` (spec G §2.3); los tipos de `src/types/gerente.types.ts` se actualizan. La ruta le pasa al servicio `req.auth!.user.id`; la página `/gerentes` toma el id de lo que devuelve `exigirPermiso("gerentes:leer")` (`{ id, rol }`).
8. **Pantalla.** `page.tsx` (servidor) lee `pagina` y `q` de la URL y entrega el primer render; `listado-gerentes.tsx` **pasa de componente de servidor a componente de cliente** y copia la mecánica de `src/app/(dashboard)/personal/listado-personal.tsx`: `CampoBusqueda` con debounce, búsqueda contra `GET /api/gerentes?pagina=1&q=…` descartando respuestas viejas, `replaceState` de la URL y `Pagination` compartido con links a `/gerentes?q=…&pagina=N`. Al cambiar el texto se vuelve a la página 1. Se crea `src/lib/gerentes-listado.ts` (`parametrosListadoGerentes`, copia de `personal-listado.ts`); **no se acopla con el de alumnos ni con el de personal**. El componente conserva el nombre `ListadoGerentes`.
9. **Textos.** Todos en `textos.ts`, bajo `ui.gerentes.listado.*` (a diferencia del listado de alumnos, que los tiene fijos): `subtitulo` («Buscá por nombre, apellido o DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).», el de la figura 96 y el del criterio 2 del backlog; el de personal dice «y» porque así lo dibuja su figura 92), `buscarPlaceholder` («Ej.: ferreyra, 31222…»), `buscarEtiqueta` («Buscar gerente»), `buscando` («Buscando gerentes»), `cargando` («Cargando gerentes»), `sinResultados` (ver 0.1.10), `error` («No se pudo cargar el listado de gerentes»), `reintentar` («Reintentar») y `vos` («(vos)»). Las claves de G-01 (`titulo`, `nuevo`, cabeceras, `ui.gerentes.estado.*`, `ui.gerentes.valorAusente`) no se tocan, ni tampoco `ui.gerentes.error.cargar` (es del `error.tsx` del segmento).
10. **Estados vacíos.** **No hay estado vacío sin búsqueda** (spec G §2.3): siempre figura al menos el gerente autenticado, así que **no se crea una clave `vacio`**. Con `q` y sin resultados: `ui.gerentes.listado.sinResultados` = «No se encontraron gerentes para «{q}»», **propuesto, pendiente de validar por el PO (P-F6)**, conservando el acceso a «Nuevo gerente». Si el servidor devolviera cero filas sin `q` (dato inconsistente que no debería darse), la pantalla muestra la tabla solo con los encabezados y no se rompe. «Nuevo gerente» está siempre arriba a la derecha.
11. **Filas.** Toda la fila enlaza a `/gerentes/[id]` (criterio 4), con el mismo recurso de `listado-personal.tsx` (enlace con `after:absolute after:inset-0` y `tr` relativa). Las filas de gerentes inactivos se ven atenuadas (`opacity-60`) y el estado sigue siendo texto en el `Badge` (no solo color). El «(vos)» va en un `span` junto al enlace del apellido, con color atenuado y peso normal. Desde la ficha se llega a modificar (G-01) y, más adelante, a desactivar o reactivar (G-05).
12. **Error de carga.** Si la búsqueda falla, el listado muestra el aviso con «Reintentar» (claves de 0.1.9), igual que personal.
13. **Fixture.** `prisma/seed/fixtures/hu-g-03.ts` (+ una línea en `fixtures/index.ts`, sin editar `seed.ts`), idempotente por DNI: 12 fichas de gerente de prueba, DNI `88065001` a `88065012` (rango `8806500x`), con una mezcla de activas e inactivas (al menos 3 inactivas), apellidos con tilde y con ñ, dos que coincidan en parte (por ejemplo «Ferreyra» y «Ferrero», que además usa el placeholder del prototipo) y apellidos sin dígitos. Con los 2 gerentes del seed base y los 2 de G-01 suman 16: dos páginas (10 + 6). Son fichas **sin cuenta vinculada** (`usuarioId` nulo; el schema lo admite y el email de la ficha no es único; email `g03.<dni>@noctium.local`): esta HU solo lista, y crear cuentas con `crearGerente` suma un hash por ficha al seed, que ya es lento. Es la excepción de la regla 3.1 para fichas de prueba, igual que en F-03: la ficha muestra «Sin cuenta». **Nota para HU-G-05, que no se resuelve acá:** estas fichas activas sin cuenta entran en el bloqueo de «todas las fichas de gerente activas» pero no cuentan para «al menos un gerente activo», que cuenta fichas activas **con cuenta activa** (spec G §2.5, paso 4).
14. **«(vos)» en la práctica, sin tocar el seed base.** Los dos gerentes del seed base (DNI `24100001`, `gerente@noctium.local`, y `24100002`, `gerente2@noctium.local`) **no se modifican en ninguna prueba** (ni su email ni su contraseña): «(vos)» se prueba entrando con cada una de esas cuentas y mirando que la marca cambie de fila. La contraseña de las cuentas del seed es `Password123!`.
15. **Sin cambios en menú, reglas de ruta ni proxy.** G-01 ya dejó la sección «Gerentes» con «Listado», la regla `gerentes: ["GERENTE"]` en `rutas-por-rol.ts` y `/gerentes/:path*` en el `matcher` de `src/proxy.ts`. Esta HU no los toca (se confirma en 0.2).
16. **Documentos.** `docs/DESIGN.md` §6.4: filas nuevas del buscador, el paginador, los estados de «sin resultados» y la marca «(vos)», más la entrada del historial con el marcador `[FECHA]` (lo reemplaza Claude Code al cerrar, con la fecha que dé Adriel). Además, la fila del listado mínimo que dejó G-01 dice «sin búsqueda ni paginación (las suma HU-G-03)»: se corrige **solo esa cláusula**, que deja de ser cierta (precedente: F-03 ajustó la fila de F-01). `docs/RULES.md`: solo una sección nueva «Aplicación HU-G-03 — Listado de gerentes» al final; no se modifica ninguna regla existente ni la sección de G-01. `docs/specs/spec_modulo_G.md`: «Nota de implementación HU-G-03», **aditiva**, a continuación de la de G-01. Evidencia en `docs/testing/Modulo G/hu-g-03/HU-G-03-evidencia.md`.
17. **Una sola etapa de implementación y un cierre** (sección 8): el patrón ya está resuelto en F-03.

### 0.2. A verificar antes de implementar (si algo contradice lo de arriba, detenerse y reportar)

- **Rama:** que `git branch --show-current` da `feat/hu-g-03-listar-gerentes` y que existen `src/server/gerentes/gerente.service.ts` y `docs/tasks/Sprint 3/Modulo G/HU-G-01.md` (G-01 mergeada). Si la rama es otra, detenerse: Claude Code no crea ni cambia de rama; lo hace Adriel.
- **Llamadores y usos** de `listarGerentes`, de `ListadoGerentes` (el componente y el tipo) y de `GerenteListadoItem`: por lo menos `src/app/(dashboard)/gerentes/page.tsx`, `listado-gerentes.tsx`, `paginas.test.tsx`, `src/app/api/gerentes/route.ts`, `route.test.ts`, `src/server/gerentes/gerente.service.test.ts`, `gerente.service.pg.test.ts` y `src/types/gerente.types.ts`. Confirmar con una búsqueda en todo `src/`, `prisma/` y `scripts/`, y reportar cualquier otro.
- **Pruebas que cuenten o enumeren todas las fichas de gerente** (`fichaGerente.count()` o `findMany` sin filtro) y que las 12 fichas nuevas del seed puedan romper. Ya se sabe de una: el test «listado mínimo» de `gerente.service.pg.test.ts` compara `total` con `count()` de toda la tabla; se adapta usando un `q` con sufijo único, como hizo F-03 en `personal.service.pg.test.ts`.
- **`FichaGerente` sin `usuarioId`:** el schema lo admite (`usuarioId String? @unique`, email sin restricción única). Confirmar que ninguna migración agrega un CHECK, un trigger ni otra restricción que impida las fichas sin cuenta de la fixture. Si la hubiera, reportar: la alternativa es crear cuentas con `crearCuentaParaFicha`.
- **Cómo se comporta `listarPersonal`** con `pagina` mayor que `total_paginas` y con `total = 0`, y replicarlo (0.1.2).
- **API real de `Pagination` y de `CampoBusqueda`** (props y si traen textos fijos). **No se modifican**; si traen textos fijos, se anota como deuda. Que `texto()` interpole `{q}`.
- **Regla N.° 11 y aislamiento (Regla N.° 3):** que `gerente.busqueda.ts` dentro de `src/server/gerentes/` y `src/lib/gerentes-listado.ts` siguen el precedente de F-03 (`personal.busqueda.ts`, `personal-listado.ts`) y que `publico.aislamiento.test.ts` no necesita registrarlos; que la pantalla no importa nada de alumnos ni de personal.
- **Menú, `rutas-por-rol.ts` y `src/proxy.ts`** ya cubren `/gerentes` y `/api/gerentes` (G-01): confirmar que no hace falta ningún cambio.
- **Tests que recorren todas las claves de `textos.ts`** (`claves-textos.test.ts`, `scripts/verificar-claves-textos.ts`): se adaptan a las claves nuevas sin debilitarse.
- **Tests de Sprint 1 y 2, A-06, A-05, F-01, F-03, F-05 y G-01** que se vean afectados: ninguno se borra ni se debilita.

---

## 1. Nota de alcance

HU-G-03 es la segunda del bloque de gerentes y la puerta de entrada a la ficha para modificar (G-01) y, más adelante, desactivar y reactivar (G-05). Es gemela de HU-F-03 sobre `FichaGerente`, con una diferencia propia: la marca «(vos)» en la fila del gerente autenticado.

**Lo que ya existe y esta task usa** (verificado en `develop`):

| Qué | Dónde |
|---|---|
| `listarGerentes` (versión mínima), `GET /api/gerentes`, `/gerentes` con tabla y «Nuevo gerente» | G-01 |
| `obtenerDetalleGerente` con `esVos` | G-01 |
| Patrón completo: `listarPersonal`, `ListarPersonalQuerySchema`, `construirFiltroBusquedaPersonal`, `listado-personal.tsx`, `personal-listado.ts` | F-03 |
| `tokenizarBusqueda` y `terminoBusqueda` | `src/lib/busqueda-texto.ts` |
| `CampoBusqueda`, `Pagination`, `fetchAutenticado` | `src/components/shared/`, `src/lib/fetch-autenticado.ts` |
| Claves `ui.gerentes.listado.*` (título, «Nuevo gerente» y cabeceras), `ui.gerentes.estado.*`, `ui.gerentes.valorAusente`, `errores.gerente.datosInvalidos` | `src/lib/textos.ts` (G-01) |
| `gerentes:leer` solo para GERENTE, regla `gerentes` de ruta, `matcher` del proxy y menú «Gerentes» → «Listado» | G-01 |
| `exigirPermiso` (devuelve `{ id, rol }`) y `withPermission` | `src/server/shared/with-permission.ts` |
| Columnas normalizadas, índice del listado y `usuarioId` opcional | `prisma/schema.prisma` |

**Lo que no existe y hace esta task:** `ListarGerentesQuerySchema` y `POR_PAGINA_GERENTES`, `gerente.busqueda.ts`, `listarGerentes` con búsqueda, paginación y `esVos`, la query en `GET /api/gerentes`, `gerentes-listado.ts`, el listado de cliente con buscador, paginador, estados y «(vos)», los textos nuevos, la fixture y los documentos de 0.1.16.

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Desactivar, reactivar, historial de estados, `esUltimoGerenteActivo` y `gerentes:cambiar_estado` (HU-G-05). El acceso a desactivar o reactivar desde la ficha (criterio 4) queda como **verificación diferida a HU-G-05**; hoy se verifica que cada fila lleve a la ficha.
- El alta, la modificación, la ficha `/gerentes/[id]`, el formulario y `gerente-form.tsx` (HU-G-01): sin cambios.
- Que «Volver al listado» desde la ficha conserve la búsqueda y la página (alumnos lo hace; F y G no lo piden).
- Modificar `CampoBusqueda`, `Pagination` o cualquier componente compartido, ni el listado de alumnos ni el de personal.
- Menú, `rutas-por-rol.ts` y `src/proxy.ts`.
- `gerente.publico.ts`, una Server Action de listado (la spec G §2.3 es solo Route Handler), migraciones, `schema.prisma` y `seed.ts`.

---

## 2. Historia de Usuario

**Como** gerente
**Necesito** ver el listado de gerentes
**Para** acceder a sus fichas y saber quiénes están activos

**SP estimado:** 1

---

## 3. Alcance de esta task

- `listarGerentes(query, sesionUsuarioId, db?)` con búsqueda, paginación y `esVos`; `ListarGerentesQuerySchema`, `POR_PAGINA_GERENTES` y `construirFiltroBusquedaGerentes`.
- `GET /api/gerentes` con `pagina` y `q`, y la respuesta de la sección 0.1.7.
- `/gerentes` con buscador, paginador, «(vos)», estado de «sin resultados», error de carga y fila enlazada.
- Fixture de fichas de prueba, filas de `DESIGN.md` §6.4, reglas en `RULES.md`, nota aditiva en `spec_modulo_G.md` y evidencia.

---

## 4. Contrato Backend

El contrato completo está en `docs/specs/spec_modulo_G.md` §2.3 (y `spec_modulo_F.md` §2.3, que es el mismo); esta sección solo fija qué se implementa.

- **Schema:** `ListarGerentesQuerySchema`, `ListarGerentesQuery` y `POR_PAGINA_GERENTES` en `src/server/gerentes/gerente.schema.ts`.
- **Filtro:** `construirFiltroBusquedaGerentes(q)` en `src/server/gerentes/gerente.busqueda.ts`.
- **Servicio:** `listarGerentes(query, sesionUsuarioId, db?)` en `gerente.service.ts`; solo lectura, no escribe nada. En este orden: filtro → `count` del resultado filtrado → `total_paginas` y `pagina` efectiva → `findMany` con el orden de 0.1.2, `skip`/`take` y `usuarioId` en el `select` → mapeo a ítems con `esVos` (sin devolver `usuarioId`).
- **Ruta:** `GET /api/gerentes` con `withPermission("gerentes:leer", async (req) => …)`: valida la query con `ListarGerentesQuerySchema` (`Object.fromEntries(req.nextUrl.searchParams)`), `400 VALIDATION_ERROR` si `pagina` o `q` son inválidos o llega cualquier otro parámetro, `403 SIN_PERMISO` y `401` sin sesión. Capa delgada (Reglas N.° 4, 5 y 6). El `POST` de G-01 no cambia.
- **Tipos:** `ListadoGerentes = { items, pagina, por_pagina, total, total_paginas }` y `GerenteListadoItem` con `esVos` en `src/types/gerente.types.ts` (se actualizan también los comentarios que dicen «mínimo»).
- **Trazabilidad:** ninguna (solo lectura).

**Respuesta `200 OK`** (spec G §2.3):
```json
{
  "data": {
    "items": [
      { "id": "cuid", "apellido": "Ibarra", "nombre": "Marcos", "dni": "27111222",
        "telefono": null, "email": "marcos.ibarra@mail.com", "activo": true, "esVos": false }
    ],
    "pagina": 1, "por_pagina": 10, "total": 1, "total_paginas": 1
  },
  "error": null
}
```

---

## 5. Frontend

**Prototipo (figura 96, página 87), descripción visual detallada.** Es una captura de pantalla completa del sistema con la sesión de una gerente («Carolina Paz · Gerente»).

- **Menú lateral** (columna izquierda, fondo azul marino oscuro, logo «Noctium» con una luna arriba). Sección «GESTIÓN» con los ítems, de arriba abajo: Clases, Calendario, Alumnos, Profesores, Materias, Aulas, Formas de pago, Cierres de caja, Personal de mesa de entrada, **Gerentes** (el activo: una píldora de fondo verde azulado con el texto en blanco), Indicadores y Configuración del centro. Abajo, la tarjeta del usuario (círculo «CP», «Carolina Paz», «Gerente»), el selector «PROBAR COMO» con «Gerente» y los enlaces «Ver pantallas de acceso» y «Restablecer datos de ejemplo»: son herramientas del prototipo y **no se implementan**.
- **Área de contenido** (fondo gris cálido claro, mucho aire):
  - **Cabecera en una fila.** A la izquierda, el título «Gerentes» (grande, en negrita) y debajo, en gris atenuado y letra chica, el subtítulo «Buscá por nombre, apellido o DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).». A la derecha, el botón «+ Nuevo gerente»: fondo azul marino, texto blanco, ícono de más a la izquierda, esquinas redondeadas.
  - **Buscador.** Debajo, un campo de ancho completo, blanco, con borde fino y esquinas redondeadas, con una lupa a la izquierda y el placeholder «Ej.: ferreyra, 31222…» en gris. Sin botón «Buscar».
  - **Tabla.** Debajo, una tarjeta blanca con borde fino y esquinas redondeadas. La fila de encabezados va en mayúsculas, letra chica y gris: **APELLIDO, NOMBRE, DNI, TELÉFONO, EMAIL, ESTADO**. Cada fila está separada de la siguiente por una línea fina. El apellido va en un tono más oscuro; el DNI y el teléfono se ven en tipografía de ancho fijo; el teléfono ausente se muestra como un guion («–»); el email va en texto normal; el estado es una etiqueta verde claro con el texto «Activo».
  - **Las tres filas del ejemplo**, en orden alfabético por apellido: *Arce · Silvina · 29880114 · – · silvina.arce@noctium.edu.ar · Activo*; *Molina · Andrés · 26444555 · +54 11 5550-0002 · gerente2@noctium.local · Activo*; ***Paz (vos)** · Carolina · 27111222 · +54 11 5550-0001 · gerente@noctium.local · Activo*.
  - **«(vos)»:** aparece en la fila de la gerente que usa el sistema, en la **misma celda del apellido, justo después del apellido y en la misma línea**, en gris más claro y peso normal (el apellido, en cambio, va en el tono oscuro). Solo esa fila lo tiene. Es lo que pide «Qué mirar» (criterio 3).
  - **Lo que la captura no muestra:** paginador (hay solo tres filas), filas inactivas, búsqueda con texto, estado de «sin resultados» ni error de carga.

**Diferencias entre el prototipo y el repo, y qué prevalece** (el backlog manda; en lo visual se sigue el patrón vigente de F-03):
- **Menú:** el prototipo dibuja «Gerentes» como ítem plano; el repo tiene la sección desplegable «Gerentes» con «Listado» (decisión de G-01, patrón de F-03). No se toca.
- **Tipografía de ancho fijo en DNI y teléfono:** el prototipo la usa, pero el listado de personal (misma figura 92, ya aprobado) no la implementó. Se copia lo de personal: sin tipografía de ancho fijo.
- **Datos del ejemplo** (Arce, Molina, Paz): son ilustrativos. Los del seed son Paredes y Quiroga; no se cambia ningún dato del seed.
- **Etiqueta de estado:** «Activo» y «Inactivo» con las variantes de `Badge` que ya usa el listado (`success` y `muted`).

**A implementar** (lo de 0.1.8 a 0.1.12, siguiendo la guía de diseño: tokens de shadcn/ui y Tailwind del proyecto, nunca colores hexadecimales ni la paleta por defecto):
- `page.tsx` (servidor): valida el permiso (`gerentes:leer`), toma el id de la sesión, lee `pagina` y `q`, llama a `listarGerentes` y entrega el primer render. Título, subtítulo y «Nuevo gerente» arriba a la derecha; la tabla va en un `Suspense` acotado a ella (no un `loading.tsx` de segmento, que rompería el 404 de `notFound()` de la ficha; mismo criterio que `/personal` y `/alumnos`).
- `listado-gerentes.tsx` (cliente): buscador, tabla, «(vos)», paginador, «sin resultados» con «Nuevo gerente» y aviso de error con «Reintentar».
- `gerentes-listado.ts` y los textos de 0.1.9.
- Antes de implementar las pantallas, agregar a `docs/DESIGN.md` §6.4 las filas de 0.1.16.

**Fuera de alcance de frontend:** el menú, la ficha, el formulario y todo lo de HU-G-05 («Desactivar», «Reactivar», historial).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (y `npm run test:pg` para lo que necesita PostgreSQL)
- **Schema de la query:** `pagina` por defecto 1; no entera, 0 y negativa rechazadas; `q` recortado y con máximo 100; `.strict()` rechaza `por_pagina` y cualquier otro campo.
- **Filtro:** dos palabras en AND, una palabra en apellido o nombre (OR), la palabra numérica suma el DNI y la no numérica no, tildes y mayúsculas, menos de 2 caracteres sin filtro.
- **Servicio con mocks:** orden, `skip`/`take`, `total` filtrado, `total_paginas`, página fuera de rango y `total = 0` (como personal), `esVos` verdadero solo con la ficha cuyo `usuarioId` es el de la sesión, ficha sin cuenta nunca `esVos`, y el ítem **no** trae `usuarioId`.
- **Con PostgreSQL real** (`gerente.service.pg.test.ts`, sin tocar los gerentes del seed y aislando los casos con un sufijo único como en personal): búsqueda parcial por apellido, nombre y DNI; «alvarez» encuentra «Álvarez» y «nunez» encuentra «Núñez»; AND entre palabras; incluye activos e inactivos; paginación de a 10 con el `total` del resultado filtrado, sin repetidos ni faltantes y en orden; sin resultados (`total 0`, `total_paginas 0`, `pagina 1`); `esVos` verdadero solo en la ficha de la cuenta que consulta. El test «listado mínimo» de G-01 se adapta (ver 0.2).
- **Ruta:** `200` con la forma de la spec y el servicio recibiendo `{ pagina, q }` y el id de la sesión; `400` (`pagina=0`, `pagina=abc`, `q` de más de 100, `por_pagina=5`); `403` para MESA_ENTRADA, PROFESOR y ALUMNO; `401` sin sesión; `500` sin detalle técnico. Los tests de G-01 de `GET` se adaptan sin debilitarse.
- **Pantalla** (nuevo `listado-gerentes.test.tsx`, modelo `listado-personal.test.tsx`, y `paginas.test.tsx` adaptado): tabla con las seis columnas, «—» sin teléfono, «(vos)» solo en la fila con `esVos`, fila inactiva atenuada, toda la fila enlaza a la ficha, busca una sola vez 300 ms después de la última tecla en la página 1 y actualiza la URL, menos de 2 caracteres pide el listado completo, gana la última búsqueda (descarta respuestas viejas), «sin resultados» con el texto de `{q}` y «Nuevo gerente», el paginador conserva `q` y la página 1 no va en la URL, error con «Reintentar», adopta los datos nuevos del servidor sin remontarse, y cero filas sin `q` no rompe. La página llama a `exigirPermiso("gerentes:leer")` y pasa el id de la sesión a `listarGerentes`.

### Nivel 2 — Postman (o curl, documentado como en F-03)
Listado sin parámetros; con `q` (apellido, nombre y DNI); `pagina=2`; `pagina` fuera de rango; `pagina=0` (`400`); `por_pagina=5` (`400`); sin permiso (`403` con Mesa de entrada, Profesor y Alumno) y sin sesión (`401`). Con las cuentas del seed base, **sin modificarlas**: entrando como `24100001` el ítem con `esVos: true` es el suyo y entrando como `24100002` es el otro; en ningún caso la respuesta trae `usuarioId`.

### Nivel 3 — BD / TablePlus
- El conteo de fichas de gerente contra `total` del listado sin filtro, y contra el filtrado con una búsqueda.
- La paginación: 10 filas en la primera página y el resto en la segunda, sin repetidos ni faltantes.
- Que el listado no escribe nada (ninguna fila ni evento nuevos).
- Recorrido en el navegador como Gerente: buscar (apellido, nombre, DNI y con tildes), paginar, ver «(vos)» en la fila propia y que cambie de fila al entrar con la otra cuenta del seed, abrir una ficha desde una fila y volver; como Mesa de entrada, `/gerentes` y `/api/gerentes` rechazan.
- **Criterio 4, parte de desactivar o reactivar desde la ficha: verificación diferida hasta HU-G-05.**

---

## 7. Checklist de Definition of Done

- [x] Servicio, Route Handler y pantalla implementados, sin lógica de negocio en la capa delgada (Regla N.° 4); respuesta `{ data, error }` (Regla N.° 5) y validación Zod previa (Regla N.° 6).
- [x] Orden, búsqueda (criterio de HU-B-05) y paginación de a 10 según la spec, sobre activos e inactivos, con `total` del resultado filtrado.
- [x] `esVos` lo calcula el servidor, el ítem no devuelve `usuarioId` y la pantalla muestra «(vos)» junto al apellido solo en esa fila.
- [x] Estado de «sin resultados» (texto propuesto marcado como tal), error de carga y fila enlazada a la ficha.
- [x] Solo el Gerente: `403` en el servidor para cualquier otro rol (Regla N.° 10).
- [x] Todos los textos visibles en `textos.ts`, verificados con `scripts/verificar-claves-textos.ts`.
- [x] Ningún componente compartido modificado; ningún test de Sprint 1, Sprint 2, A-06, A-05, F-01, F-03, F-05 y G-01 borrado ni debilitado.
- [x] Fixture `hu-g-03.ts` con su línea en el índice, sin editar `seed.ts`; el seed corre dos veces sin duplicar; los gerentes del seed base no se modifican.
- [x] Filas de esta HU en `docs/DESIGN.md` §6.4 (la cláusula corregida de la fila de G-01 y la entrada del historial de cambios, sin fecha: ver 9.3).
- [x] Reglas en `RULES.md` (solo la sección nueva «Aplicación HU-G-03»; no se modifica ninguna regla existente) y nota aditiva en `spec_modulo_G.md` (diferencia de `tokenizarBusqueda`, firma de `listarGerentes`, `por_pagina`, `esVos`, texto de «sin resultados» y fichas de prueba sin cuenta).
- [x] `lint`, `tsc`, `npm test`, `npm run test:pg` y `next build` sin fallos nuevos respecto de `develop` (los conocidos están en el handoff del carril).
- [x] Tests de los 3 niveles documentados en `docs/testing/Modulo G/hu-g-03/HU-G-03-evidencia.md`.
- [ ] PR con diff acotado exclusivamente a esta HU.

---

## 8. Etapas de implementación

Antes de escribir código, Claude Code verifica los puntos de la sección 0.2; **solo si alguno contradice lo decidido, se detiene y reporta** y, si no, sigue. No hace commit, push ni cambios de rama, no borra nada, no usa `prisma migrate dev` y no toca el PDF del prototipo ni `.vitest/`. Para las pantallas intenta rasterizar la página 87 del PDF a PNG en una carpeta temporal **fuera del repo** (por ejemplo con `pip install pymupdf`) y, si no puede, sigue la descripción de la sección 5.

**Etapa única — implementación.** Orden: 1) las filas de `docs/DESIGN.md` §6.4 y la corrección de la cláusula de G-01; 2) tipos, `ListarGerentesQuerySchema` y `POR_PAGINA_GERENTES`, `gerente.busqueda.ts` y `listarGerentes` con sus tests (unitarios y PostgreSQL), adaptando los de G-01; 3) la ruta `GET /api/gerentes` y su test; 4) los textos, `gerentes-listado.ts`, `listado-gerentes.tsx` (cliente), `page.tsx` y los tests de pantalla; 5) fixture `hu-g-03.ts`, su línea en el índice y `npx prisma db seed` (dos veces); 6) la sección de `RULES.md`, la nota aditiva de `spec_modulo_G.md` y la evidencia (Nivel 2 y Nivel 3; el recorrido en el navegador queda «pendiente del responsable»); 7) `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:pg`, `npx tsx scripts/verificar-claves-textos.ts`, `npx prisma db seed` (dos veces) y `next build`, **de a uno** (`test:pg` y `next build` no se corren a la vez). Al terminar **se detiene** y reporta archivos, resultados de los comandos, desvíos y dudas.

**Cierre.** Cuando Adriel hizo el recorrido en el navegador y dice «continuamos»: Claude Code reemplaza `[FECHA]` en `docs/DESIGN.md` por la fecha que Adriel indique (formato `dd/mm/aaaa`) y actualiza la evidencia con el resultado del recorrido (de «pendiente del responsable» a lo que Adriel informe). Luego se detiene.

---

## 9. Resultado de la implementación

**Estado:** implementada en una sola etapa más el cierre, y verificada. El recorrido en el navegador lo hizo el responsable y no tuvo observaciones; además se comparó una captura de `/gerentes` con la figura 96. Queda abierto solo el texto marcado «propuesto», que valida el PO. Evidencia completa en `docs/testing/Modulo G/hu-g-03/HU-G-03-evidencia.md`.

### 9.1. Criterios de aceptación

| Criterio | Resultado |
|---|---|
| HU-G-03 c1: Apellido, Nombre, DNI, Teléfono, Email y Estado, ordenado por Apellido y Nombre ascendente, paginado de a 10 | Cumplido. Tests unitarios y con PostgreSQL (orden, `skip`/`take`, `total` filtrado, página fuera de rango); curl (pedidos 1, 6 y 7); conteos y páginas contra SQL; recorrido en el navegador |
| HU-G-03 c2: búsqueda por Nombre, Apellido o DNI con el criterio de HU-B-05 | Cumplido. «alvarez» encuentra «Álvarez», «NUNEZ» encuentra «Núñez», «ferr» encuentra Ferreyra y Ferrero, AND entre palabras, DNI parcial y completo, menos de 2 caracteres devuelve todo |
| HU-G-03 c3: el gerente autenticado aparece como «(vos)» en su fila | Cumplido. Lo decide el servidor (`esVos`), el ítem no devuelve `usuarioId` y una ficha sin cuenta nunca es «(vos)». Con las cuentas del seed, la marca cambia de fila entre 24100001 y 24100002 (curl y recorrido) |
| HU-G-03 c4: cada fila enlaza a la ficha | Cumplido. Tests de pantalla y recorrido en el navegador |
| HU-G-03 c4: acceso a desactivar o reactivar desde la ficha | **Diferido a HU-G-05**, como indica el backlog |
| HU-G-03 c5: solo el Gerente, 403 para otros roles | Cumplido. `403 SIN_PERMISO` con Mesa de entrada, Profesor y Alumno y `401` sin sesión en la ruta; el proxy redirige las páginas a `/sin-permiso` |
| Sin resultados con búsqueda | Cumplido. Texto propio con `{q}` y acceso a «Nuevo gerente» (texto propuesto, ver 9.5) |

### 9.2. Qué dejó hecho

- **Backend:** `ListarGerentesQuerySchema` y `POR_PAGINA_GERENTES` en `gerente.schema.ts`; `construirFiltroBusquedaGerentes` en `gerente.busqueda.ts`; `listarGerentes(query, sesionUsuarioId, db?)` con búsqueda, paginación y `esVos`; `GET /api/gerentes` con `pagina` y `q` (`por_pagina` es 400); tipos actualizados. Sin migración y sin cambios en `schema.prisma` ni en `seed.ts`.
- **Pantalla:** `listado-gerentes.tsx` pasó a componente de cliente (buscador, tabla, «(vos)» junto al apellido, paginador, «sin resultados» y error con «Reintentar»), `page.tsx` entrega el primer render con el id de la sesión y `src/lib/gerentes-listado.ts` arma la query del paginador. Diez claves nuevas `ui.gerentes.listado.*`.
- **Tests:** nuevos `gerente.busqueda.test.ts` y `listado-gerentes.test.tsx`; adaptados los de G-01 que llamaban a `listarGerentes()` (servicio, pg, schema, ruta y pantalla) sin debilitarse.
- **Fixture** `hu-g-03.ts` con su línea en `fixtures/index.ts`: 12 fichas sin cuenta (DNI 88065001 a 88065012, 3 inactivas, apellidos con tilde y con ñ, «Ferreyra» y «Ferrero»).
- **Documentos:** cuatro filas y la cláusula corregida en `DESIGN.md` §6.4 y su historial, sección «Aplicación HU-G-03» en `RULES.md`, «Nota de implementación HU-G-03» en `spec_modulo_G.md` y la evidencia.

### 9.3. Desvíos respecto de lo decidido

1. **Subtítulo del buscador.** La decisión 0.1.9 decía «nombre, apellido y DNI» y lo atribuía al prototipo; la figura 96 y el criterio 2 del backlog dicen «o DNI». Fue un error de la task, no de la implementación: se corrigió después de la primera pasada (`textos.ts`, el test de la página, la fila de `DESIGN.md` y la evidencia) y la task quedó corregida. El listado de personal conserva su «y», que es el de su figura 92.
2. **Entrada del historial de `DESIGN.md` sin fecha.** Por decisión del responsable, el marcador `[FECHA]` se reemplazó por «HU-G-03:» y la entrada no lleva fecha, a diferencia de las anteriores. Ningún test ni script depende de ese formato.
3. **«Nuevo gerente» dos veces en «sin resultados»** (arriba y debajo del mensaje), igual que en personal.
4. **Test adicional:** una ficha sin cuenta no es «(vos)» aunque la sesión llegue sin id.
5. **Diferencias con el prototipo aceptadas** (patrón de personal): los encabezados de la tabla van con mayúscula inicial y no en mayúsculas chicas, el DNI y el teléfono van sin tipografía de ancho fijo, y el menú es la sección desplegable «Gerentes» con «Listado» (decisión de G-01) y no un ítem plano.
6. **Prototipo:** esta vez Claude Code pudo rasterizar la página 87 con `pymupdf`, en una carpeta fuera del repo. Aparte, el chat comparó una captura de la pantalla del responsable con la figura 96: coincide en cabecera, buscador, columnas, orden, filas inactivas atenuadas, paginador y menú.
7. **Base de desarrollo con 18 fichas, no 16:** además de las previstas están la 88064021 (de la evidencia de G-01) y la 33257894 «Torres». Las páginas quedan de 10 y 8.
8. **Evidencia del pedido 15:** se ejecutó con el subtítulo viejo y se repitió después de corregirlo (dos inicios de sesión nuevos, ninguna otra escritura).
9. **Finales de línea:** los archivos nuevos quedaron en LF y los modificados conservan el CRLF de la copia local.

### 9.4. Verificación final

| Comando | Resultado |
|---|---|
| `npm run lint` | 0 errores (queda el aviso previo de `CALENDARIO` en `Sidebar.tsx`) |
| `npx tsc --noEmit` | Sin errores |
| `npm test` | 3672 pasan, 0 fallan (467 omitidos por guarda) |
| `npm run test:pg` completo | Pasada principal: 413 pasan, 0 fallan (40 omitidas); las pasadas aisladas también pasan, incluidos los tres archivos que antes fallaban por correr el seed completo |
| `npx tsx scripts/verificar-claves-textos.ts` | Aprobado |
| Seed dos veces | Sin errores; la segunda no duplica ni cambia nada (18 fichas, 30 usuarios, 34 eventos) |
| `next build` | Compila y genera `/gerentes` y `/api/gerentes` |
| Nivel 2 (curl) | 16 pedidos, todos con el resultado esperado; el 15 repetido con el subtítulo corregido |
| Nivel 3 (SQL de solo lectura) | 6 consultas; los conteos coinciden con `total`, las páginas 1 y 2 coinciden con SQL y el listado no escribe nada |
| Tras la corrección del subtítulo | `tsc` y `verificar-claves-textos` sin errores y 207 tests pasan en gerentes y en `textos.test.ts` |
| Recorrido en el navegador | Realizado por el responsable, sin observaciones |

### 9.5. Deuda y pendientes

- **Texto propuesto, a validar con el PO:** `ui.gerentes.listado.sinResultados` (P-F6, el mismo que en personal).
- **Mensajes de Zod en inglés** para `pagina` y `q`: solo se ven en la API (misma deuda que F-03).
- **Duplicación:** `gerente.busqueda.ts`, `gerentes-listado.ts` y `listado-gerentes.tsx` copian a los de personal; se suma a la deuda ya registrada.
- **«Volver al listado»** desde la ficha no conserva búsqueda ni página (F y G no lo piden).
- **Para HU-G-05:** (a) el acceso a desactivar o reactivar desde la ficha (criterio 4 de esta HU) se verifica con ella; (b) las 12 fichas de la fixture son activas e inactivas sin cuenta: entran en el bloqueo de «todas las fichas de gerente activas», pero no cuentan para «al menos un gerente activo», que cuenta fichas activas con cuenta activa (spec G §2.5, paso 4); (c) la base de comparación de `test:pg` es ahora de 0 fallos, desde que `scripts/test-pg.mjs` aísla los tres archivos que corren el seed.
- **Base de desarrollo:** el gerente 24100001 figura con `version` 2 y modificador desde antes de esta HU. Esta HU no lo tocó (su email y su contraseña siguen iguales). `npx prisma migrate reset --force` y el seed lo devuelven al estado del seed.
