# TASK: HU-C-13 — Consultar turnos propios

| Campo | Valor |
| --- | --- |
| Módulo | C (Turno) |
| Sprint | 2 |
| Responsable | Iván |
| SP estimado | 2 |
| Estado | PR #118 actualizada sobre HU-C-12; integración, PostgreSQL y Playwright aprobados en escritorio y móvil |
| Contrato | docs/specs/spec_modulo_C.md §2.14.1; docs/specs/spec_modulo_A.md §2.4; docs/specs/spec_modulo_B.md §2.8; docs/specs/spec_modulo_E.md §2.4 |
| Backlog | docs/tasks/Sprint 2/HU-Sprint-2.md §20 |
| Pantalla | docs/adicionales/mapa-pantallas-sprint-2.md §2; pantallas de referencia Sprint 2, págs. 25–26 |
| Reglas | docs/RULES.md; docs/DESIGN.md §6.5; docs/adicionales/sdd-metodologia.md |

---

## 0. Relevamiento previo a implementación

Relevado el 29/09/2026 sobre la rama local feature/hu-c-13-consultar-turnos-propios, creada desde feature/hu-c-12-solicitar-turno-propio en 37ec6dc. El árbol estaba limpio antes de crear esta task. El PR #116 de HU-C-12 continúa abierto como draft y es la base de esta rama. Iván aprobó el inventario inicial y confirmó que Anteriores debe llevar la etiqueta “Clase dictada” tal como aparece en las pantallas 25–26.

La pantalla /alumno existe como destino mínimo de HU-C-12 y verifica turnos:leer_propios. El sidebar ya ofrece “Mis turnos” y “Solicitar turno”. No existe todavía la ruta GET /api/turnos/propios ni una task HU-C-13. El contrato de lectura está definido en C §2.14.1; esta task agrega el booleano clase_dictada mediante la Revisión 5.1, conforme a la decisión del PO. No se prevén cambios al schema de Prisma, permisos, migraciones ni seed.

### Archivos nuevos previstos

| Archivo | Propósito |
| --- | --- |
| src/app/api/turnos/propios/route.ts | GET autenticado y validado para consultar los turnos propios. |
| src/app/api/turnos/propios/route.test.ts | Contrato HTTP, validación, permisos y errores esperados. |
| src/server/historial/historial.publico.ts | Implementar obtenerClaseDictadaDeTurno() según el contrato existente de E §2.4; se consume desde Turnos para el indicador. |
| src/server/historial/historial.publico.test.ts | Pruebas unitarias del servicio público de solo lectura de Historial. |
| src/server/turnos/turno.propios.test.ts | Pruebas unitarias del filtrado, orden, totales y paginación. |
| src/server/turnos/turno.propios.pg.test.ts | Verificación de consulta y relaciones reales con PostgreSQL aislado. |

### Archivos existentes previstos para modificar

| Archivo | Cambio previsto |
| --- | --- |
| src/server/turnos/turno.schema.ts | Agregar MisTurnosQuerySchema conforme a C §2.14.1. |
| src/server/turnos/turno.service.ts | Agregar el servicio de listado propio, resolviendo la ficha con obtenerAlumnoDeUsuario(), limitando la consulta a las relaciones TurnoAlumno de esa ficha y agregando clase_dictada mediante el servicio público de E. |
| src/app/(dashboard)/alumno/page.tsx | Completar la pantalla server-rendered existente: tabs por query string, tarjetas, estados vacíos, totales y paginación; conservar el banner de inscripción exitosa y el acceso a HU-C-12. |
| docs/specs/spec_modulo_C.md | Revisión 5.1: agregar turno_id como clave técnica y clase_dictada al contrato por decisión de PO. |
| docs/adicionales/mapa-pantallas-sprint-2.md | Registrar que Anteriores muestra “Clase dictada” cuando existe el registro. |
| docs/tasks/Sprint 2/HU-C-13.md | Reflejar la decisión, alcance, inventario y evidencia de esta implementación. |

### Puntos del relevamiento

1. **Identidad y permisos:** el Route Handler exige turnos:leer_propios con withPermission(). El servicio recibe el usuario de la sesión y deriva el alumno mediante obtenerAlumnoDeUsuario(); nunca acepta alumno_id del cliente. Una cuenta sin ficha vinculada responde 403 SIN_PERMISO.
2. **Estados cancelados — decisión resuelta:** la captura original del issue #99 dice “excepto Cancelado”, pero el backlog actualizado, C §2.14.1 y el mapa de pantallas, revisados el 28/09, definen que se incluyan. Las pantallas asignadas muestran cancelados en ambas pestañas. Se implementará según el contrato actualizado: próximos cancelados destacados y anteriores cancelados atenuados.
3. **Indicador “Clase dictada” — decisión resuelta por Iván (29/09/2026):** se incluye en Anteriores cuando exista ClaseDictada para el turno, como en la pantalla 26. C §2.14.1 agrega clase_dictada: boolean y Turnos consulta obtenerClaseDictadaDeTurno() de E §2.4. El helper aún no está implementado en la base de código; se implementa en esta task con pruebas, sin incluir el endpoint ni el flujo de HU-E-01.
4. **Tamaño de página — decisión resuelta por contrato:** MisTurnosQuerySchema define por_pagina como entero positivo con máximo 10 y default 10, por lo que la API acepta valores de 1 a 10. La interfaz siempre enviará 10 y mostrará 10 elementos por página, como exige el criterio visual y de aceptación.
5. **Error de validación:** C §2.14.1 especifica 400 VALIDATION_ERROR. El Route Handler de C-12 usa VALIDACION. Para esta ruta se seguirá el código especificado, sin cambiar el endpoint de C-12.
6. **Integración C-05:** el documento de asignación indica que la verificación con una cancelación real depende de HU-C-05; el seed contiene una cancelación con alumnos inscriptos para desarrollar y probar esta consulta. La comprobación end-to-end con cancelación real quedará registrada como pendiente si C-05 todavía no está integrada.

**Relevamiento aprobado por Iván antes de implementar.** La lista anterior propone una sola página de servidor: sus enlaces modifican vista/página y llaman al mismo servicio; el Route Handler expone el contrato público para consumo y pruebas sin hacer una llamada HTTP interna desde el servidor. La incorporación del helper de E está dentro del alcance aprobado para mostrar la etiqueta visual solicitada y reutiliza el contrato ya publicado en E §2.4.

---

## 1. Nota de alcance

Esta task completa la vista “Mis turnos” del alumno y su API de consulta. La consulta siempre queda limitada al alumno autenticado, incluye turnos en cualquier estado y los separa por la fecha y hora de inicio respecto del momento actual.

**Fuera de alcance:** cancelar o modificar una inscripción (HU-C-14, Sprint 3); editar turnos; consultar turnos de otros alumnos; mostrar el total de alumnos inscriptos; implementar la ruta o el flujo de registro de clase de HU-E-01; cambiar HU-C-12 o HU-C-05; cambios de schema.prisma, migraciones y seed.ts.

## 2. Historia de Usuario

**Como** Alumno, **necesito** ver el listado de mis propios turnos, **para** saber cuándo y con quién tengo clase.

**Criterios de aceptación:** seguir los seis criterios de HU-C-13 en docs/tasks/Sprint 2/HU-Sprint-2.md §20 y el contrato de docs/specs/spec_modulo_C.md §2.14.1.

## 3. Alcance de esta task

- GET /api/turnos/propios con vista proximos|anteriores, pagina y por_pagina según C §2.14.1.
- Respuesta con los turnos de la ficha derivada de la sesión, campos turno_id, fecha, hora_inicio, hora_fin, materia, profesor, aula, estado y clase_dictada; no incluir alumnos inscriptos ni IDs de otros alumnos.
- Próximos: fecha y hora de inicio mayores o iguales al momento de consulta, cualquier estado, orden ascendente por fecha/hora. Anteriores: fecha y hora de inicio anteriores al momento de consulta, cualquier estado, orden descendente.
- Calcular ambos totales para las pestañas, aunque la consulta paginada sea de una sola vista; paginar del lado del servidor.
- En /alumno, mostrar las pestañas Próximos y Anteriores con sus totales, tarjetas según la pantalla asignada, CTA “Solicitar turno”, mensajes vacíos contractuales y paginación de 10. Al cambiar de pestaña, volver a página 1; ocultar controles si hay 10 elementos o menos.
- Mantener el aviso de inscripción exitosa que HU-C-12 muestra al volver a /alumno?inscripcion=exitosa.

## 4. Contrato Backend

Referencia normativa: docs/specs/spec_modulo_C.md §2.14.1. La identidad se resuelve siempre con obtenerAlumnoDeUsuario(session.sub), definido en docs/specs/spec_modulo_B.md §2.8. El permiso es turnos:leer_propios, exclusivo de ALUMNO según docs/specs/spec_modulo_A.md §2.4.

El Route Handler valida los parámetros con MisTurnosQuerySchema, llama al servicio de Turnos y responde en el sobre { data, error }. La respuesta exitosa contiene items, paginacion y totales { proximos, anteriores }. Cada item incluye turno_id como clave técnica y clase_dictada: boolean; Turnos deriva el indicador del servicio público obtenerClaseDictadaDeTurno() de Historial, según C §2.14.1 y E §2.4. La consulta incluye CANCELADO y no devuelve alumnos inscriptos. Una lista vacía es 200 con items vacío.

Errores contractuales: 400 VALIDATION_ERROR para vista/página/parámetros inválidos; 403 SIN_PERMISO si falta el permiso o la cuenta no tiene ficha de alumno vinculada. No se agrega permiso ni endpoint de escritura.

## 5. Frontend

**Pantalla:** “Mis turnos”, página completa del alumno; ver la fila HU-C-13 en docs/adicionales/mapa-pantallas-sprint-2.md §2 y las pantallas asignadas 25–26 de Noctium pantallas Sprint 2. La vista incluye tabs Próximos/Anteriores con contador total, botón “Solicitar turno”, grilla de tarjetas con fecha, horario, materia, profesor, aula y estado, y paginación numerada de 10 elementos.

Usar los tokens de estado de docs/DESIGN.md §6.5. Un Cancelado próximo se muestra con fondo --destructive-soft, borde --destructive, texto --destructive-soft-foreground y etiqueta “Cancelado”; uno anterior conserva la etiqueta y se atenúa con --muted-foreground. En Anteriores, cuando clase_dictada sea true, mostrar la etiqueta secundaria “Clase dictada” como en la pantalla de referencia 26. La vista de Próximos vacía muestra “Todavía no tenés turnos” y un acceso directo a HU-C-12; Anteriores vacía muestra “No tenés turnos anteriores”. No inventar rutas ni cambios al sidebar.

## 6. Testing y evidencia

1. **Unit:** el helper de Historial distingue turno inexistente/sin clase/con clase; las pruebas del servicio comprueban identidad, aislamiento, clases dictadas, filtros temporales, orden, totales y páginas vacías o válidas.
2. **Postman/API:** verificar el sobre de respuesta, ambas vistas, defaults, paginación, parámetros inválidos, sesión ausente, rol sin permiso y usuario sin ficha. Confirmar que la ruta no acepta ni usa alumno_id. Registrar código HTTP y cuerpo de cada caso.
3. **BD:** con PostgreSQL aislado, confirmar aislamiento entre alumnos, inclusión de estados CANCELADO/COMPLETO/PENDIENTE, indicador de clase dictada, límite temporal inclusivo, relaciones y totales. La lectura no debe persistir cambios.

La pantalla debe revisarse en navegador de escritorio y móvil contra las páginas 25–26: cambio de pestaña, contador total, página 2, estados Cancelado, etiqueta “Clase dictada”, estados vacíos, CTA y banner de C-12. Cualquier criterio que dependa de HU-C-05 y no pueda verificarse se marca Bloqueado con el motivo.

### Evidencia local (29/09/2026)

- **Unitarias y API:** `npm test` terminó con 435 pruebas aprobadas y 19 omitidas por la guarda predeterminada de PostgreSQL. Las 15 pruebas nuevas de Historial, servicio y Route Handler pasaron: defaults, filtros, validación estricta, permiso, sesión, ficha ausente, identidad y respuesta.
- **PostgreSQL:** inicié PostgreSQL 16 desechable en `127.0.0.1:55433`, apliqué las 33 migraciones y ejecuté `turno.propios.pg.test.ts`: 1 prueba aprobada. El test creó usuario, alumnos, turnos y clase dictada dentro de una transacción forzada a rollback; probó inclusión de los tres estados históricos, exclusión de otro alumno, límite 09:00 Argentina y etiqueta de clase. El contenedor se apagó al terminar y no se usó la base local de desarrollo.
- **CI local:** `npm run lint`, `npx prisma generate` y `npm run build` terminaron sin errores. El build registra `/alumno` y `GET /api/turnos/propios` como rutas dinámicas. `npm test` también pasó localmente; `.github/workflows/ci.yaml` no ejecuta Vitest.
- **Revalidación para la PR (29/09/2026):** tras aumentar el tamaño de las tarjetas, repetí `npm test` (435 aprobadas; 19 omitidas por la guarda predeterminada), `npm run lint`, `npx tsc --noEmit`, `npx prisma generate` y `npm run build`; todo pasó. La prueba PostgreSQL de HU-C-13 se ejecutó aparte contra la BD local aislada, con la URL marcada explícitamente y fixtures dentro de una transacción que revierte: 1 aprobada.
- **Revisión visual:** no pude abrir el navegador integrado porque el entorno bloqueó su inicialización. No marco como verificados el escritorio ni el móvil; Iván puede revisar la página local antes de publicar la PR.
- **Ajuste visual posterior (29/09/2026):** tras comparar la captura local compartida por Iván con las pantallas asignadas, las tarjetas aumentan de `min-h-28` a `min-h-32`, con algo más de padding y separación. Se conserva la grilla responsive de dos columnas, la paginación de 10 y los estados contractuales. Iván debe confirmar visualmente este último tamaño en su navegador.
- **Sesión local:** los primeros accesos a `/login` registraron `JWTSessionError: Invalid JWT` por una cookie de sesión anterior al formato JWT vigente. Auth.js limpió la cookie; el inicio de sesión posterior y las rutas `/home`, `/alumno` y `/alumno/turnos/solicitar` respondieron correctamente. No se cambió el mecanismo de autenticación.
- **Dependencia HU-C-05:** `origin/develop` está en `beda994` y no contiene el servicio/ruta de cancelación; tampoco existe una rama remota HU-C-05. La consulta y el estado CANCELADO se verificaron con fixtures PostgreSQL, pero queda bloqueada la comprobación usando una cancelación generada por HU-C-05.
- **Historial E:** no había una implementación del helper público en el código. Esta task implementa y prueba `obtenerClaseDictadaDeTurno()` según E §2.4; al integrar HU-E-01, revisar que conserve la misma firma y reutilizar este helper.

### Actualización y comprobación de integración (01/10/2026)

- Se integró la rama actualizada de HU-C-12, que incorpora `origin/develop` en `66966ab`. Se resolvieron los conflictos de imports de Turnos y el helper de Historial, conservando el archivo oficial completo de HU-E-01, incluida `profesorAtendioAlumno()`.
- La comparación del helper de Historial confirma la misma firma y resultado público. C-13 consume la implementación oficial para `clase_dictada`; ya no mantiene una variante del helper en esta PR.
- `npm test`: **1.302 aprobadas** y 59 PostgreSQL omitidas por su guarda. Ejecutadas explícitamente contra una base nueva aislada `noctium_test`: **59 PostgreSQL aprobadas** (12 suites), incluida la prueba con rollback de C-13 y las de cancelación/reprogramación.
- `npm run lint`, `npx prisma generate`, `npm run build` (Next.js 16.3.8/Turbopack) y `npx tsc --noEmit` después del build: aprobados.
- **Playwright con sesiones y datos reales:** solo aparecen las relaciones del alumno autenticado, con 12 próximos y 3 anteriores en los fixtures iniciales. La primera página muestra 10 tarjetas y la segunda 2; después de una inscripción real, 10 y 3. Cambiar de pestaña vuelve a página 1. Los estados vacíos de ambas pestañas y los parámetros inválidos se comprobaron.
- **HU-C-05 resuelta:** se canceló un turno por su endpoint real con sesión de Mesa; la relación del alumno se conserva y la tarjeta de Próximos muestra `Cancelado`. El fixture cancelado anterior conserva la presentación atenuada.
- **HU-C-06:** el endpoint real reprogramó un turno de 10:00 a 11:00, y la API/lista propia mostraron 11:00–12:00 al recargar.
- **HU-E-01:** Mesa registró una clase ya terminada mediante su endpoint real (`201`); Anteriores mostró la etiqueta `Clase dictada` usando el helper oficial de Historial.
- **HU-C-12 y HU-C-17:** Playwright completó la inscripción en un turno generado por el servicio real de la rama C-17, combinado únicamente en un checkout temporal. C-13 conservó el aviso “Te inscribiste correctamente / El pago se abona en el centro” y agregó el turno propio completo. La PR no incluye archivos de C-17.
- **Presentación y navegación:** capturas revisadas de escritorio 1440 × 1000 y móvil 390 × 844; sin desborde horizontal, menú móvil y paginación funcionales, sin excepciones JavaScript. Se conservaron los tamaños de las tarjetas ya aprobados.
- Fixtures de Playwright retirados y base temporal de suites eliminada; sin reset ni reseed de la base del usuario. Evidencia y capturas conservadas en el reporte local.
- **Orden de integración:** revisar primero #116 y después #118. #118 sigue apilada sobre la rama de C-12 para mostrar únicamente su alcance. Una vez integrada #116, cambiar la base de #118 a `develop` antes de borrar la rama de C-12, para ejecutar sus workflows de CI y conservar la PR abierta.

## 7. Checklist de Definition of Done

- [x] Task SDD revisada y relevamiento/archivos aprobados por Iván antes de implementar.
- [x] Etiqueta “Clase dictada” y contrato clase_dictada implementados usando el servicio público de E §2.4.
- [x] GET protegido por turnos:leer_propios; identidad derivada de la sesión.
- [x] Servicio cumple separación temporal, orden, estados, totales y paginación según §2.14.1.
- [x] Pantalla implementada según mapa/spec; accesos de HU-C-12 y banner preservados. Ajuste de tamaño aprobado y revalidado con Playwright en escritorio y móvil.
- [x] Evidencia automatizada de Unit, API y BD documentada.
- [x] Checks locales de CI completados y registrados.
- [x] Verificación real de HU-C-05, HU-C-06 y HU-E-01 con sesión de Mesa y consulta propia del alumno.
- [x] Diff revisado y PR borrador #118 publicada sobre la rama de HU-C-12; cambiar la base a `develop` cuando se integre el PR #116.
