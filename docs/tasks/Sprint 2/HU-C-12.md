# TASK: HU-C-12 — Solicitar turno propio

| Campo | Valor |
| --- | --- |
| Módulo | C (Turno) |
| Sprint | 2 |
| Responsable | Iván |
| SP estimado | 3 |
| Estado | PR #116 actualizada con develop; helper oficial de Alumno integrado y Playwright aprobado, incluida compatibilidad con la rama de HU-C-17. |
| Contrato | `docs/specs/spec_modulo_C.md` §2.5, §2.14.2 y §3.7; `docs/specs/spec_modulo_B.md` §2.8; `docs/specs/spec_modulo_A.md` §2.4 |
| Backlog | `docs/tasks/Sprint 2/HU-Sprint-2.md` §19 |
| Pantalla | `docs/adicionales/mapa-pantallas-sprint-2.md` §2 |
| Reglas | `docs/RULES.md` y `docs/DESIGN.md` |

---

## 0. Relevamiento previo a implementación

Relevado inicialmente sobre `develop` en el commit `99594dd` (28/09/2026). Iván dio el OK explícito para continuar el 28/09/2026. Después se actualizó esta rama por fast-forward a `27d392d` (merge de PR #108, servicios públicos de Turnos) y luego a `dab8a6d` (merge de la guía de pantallas). Ambos cambios se revisaron contra HU-C-12; ninguno incorpora migraciones ni cambia su contrato backend.

### Archivos nuevos previstos

| Archivo | Propósito |
| --- | --- |
| `src/app/api/turnos/inscripcion/opciones/route.ts` | GET con permiso `turnos:solicitar_propio` y filtros de opciones. |
| `src/app/api/turnos/[id]/inscripcion/route.ts` | POST sin body; toma el usuario de la sesión y nunca recibe `alumno_id`. |
| `src/app/(dashboard)/alumno/turnos/solicitar/page.tsx` | Página protegida de “Solicitar turno”. Ruta propuesta hasta integrar HU-C-13. |
| `src/app/(dashboard)/alumno/turnos/solicitar/solicitar-turno.tsx` | Selección Materia → Profesor → Horario, resumen, inscripción y banner. |
| `src/components/layout/Sidebar.tsx` y `SidebarNav.tsx` | Mostrar “Mis turnos” y “Solicitar turno” en la navegación del rol ALUMNO. |
| `src/server/turnos/turno.autoservicio.test.ts` | Casos de opciones, identidad y revalidación de inscripción. |
| `src/server/alumnos/alumno.publico.ts` | Implementación local mínima del contrato público de B §2.8; Iván autorizó agregarla mientras llega el PR 0' de Lautaro. |

### Archivos existentes previstos para modificar

| Archivo | Cambio previsto |
| --- | --- |
| `src/server/turnos/turno.service.ts` | Extraer `inscribirAlumnoEnTurno()` del alta individual de HU-C-04; reutilizarlo para el autoservicio y agregar consulta de opciones. Mantener la API y conducta de Mesa de Entrada. |
| `src/server/turnos/turno.schema.ts` | Validación Zod de `materia_id` y `profesor_id` opcionales para GET. |
| `src/server/turnos/turno.inscripciones.test.ts` | Cubrir la regresión de HU-C-04 tras la extracción. |
| `src/app/(dashboard)/alumno/page.tsx` | Destino mínimo “Mis turnos” para la navegación y el regreso tras inscribirse; no implementa el listado completo de HU-C-13. |

**Contrato ajeno pendiente:** `src/server/alumnos/alumno.publico.ts` con `obtenerAlumnoDeUsuario(usuarioId, db?)` corresponde al PR 0' de Lautaro. Iván autorizó implementarlo de forma mínima en esta rama local para poder comprobar HU-C-12; al integrar el PR 0' se compara y se usa la versión acordada con Lautaro. Turnos no consulta `Alumno` directamente. El PR 0 de migraciones y permisos ya está incorporado en `develop`.

### Puntos a confirmar en la revisión

1. **Ruta:** `/alumno/turnos/solicitar` conserva el pathname local aprobado. `/alumno` es el destino mínimo “Mis turnos” hasta que HU-C-13 implemente la consulta completa.
2. **Referencia visual:** el mapa de pantallas §2 y `Noctium pantallas Sprint 2.pdf`, págs. 27 y 29, fijan sidebar, breadcrumb, tres paneles numerados, conteos de opciones, aula asignada en los horarios, resumen inferior y retorno a “Mis turnos” tras la inscripción.
3. **Aula en la opción:** la spec §2.14.2 dice que el GET de horarios no devuelve aula; el PDF sí la muestra. Iván confirmó para HU-C-12 que se muestre como en el PDF. Se agrega el nombre del aula como dato informativo, sin volverla seleccionable.
4. **Handoff de Lautaro:** confirmar disponibilidad y firma real de `obtenerAlumnoDeUsuario()` antes de cerrar la integración. El contrato publicado en la spec es `{ id, activo } | null`.

**Decisión técnica relevada:** para las etiquetas del selector se pueden usar los servicios públicos ya existentes `listarMateriasActivas()` (Módulo L) y `listarProfesoresActivosPorMateria()` (Módulo D), filtrando sus resultados por los ids de turnos inscribibles consultados dentro de Turnos. Esto respeta la Regla N.° 3 sin agregar un contrato a esos módulos. Antes de editar `turno.service.ts` hay que coordinar el archivo compartido con Emir y Tomás, como indica el documento de división del sprint.

**Actualización de base (PR #108):** se revisó `src/server/turnos/turno.publico.ts`, incorporado en `27d392d`. Sus operaciones públicas cubren lectura bloqueada, conteo de inscriptos, conteos de turnos y ajuste de cupos por capacidad de aula; no exponen el listado de opciones ni el alta transaccional del autoservicio. HU-C-12 conserva en `turno.service.ts` su núcleo de inscripción con bloqueo `FOR UPDATE` y la consulta de opciones filtradas por identidad de sesión; no duplica las operaciones agregadas por PR #108.

**Actualización de referencia (commit `dab8a6d`):** la nueva guía de pantallas confirma que la sección 2 del mapa es la fuente normativa de ruta/presentación y que el PDF sirve como referencia visual. La fila HU-C-12 mantiene la página completa propia ya implementada. El commit solo modifica documentación de pantallas/SDD; no añade archivos en `prisma/migrations`, `prisma/schema.prisma` ni `prisma/seed.ts`.

---

## 1. Nota de alcance

El alumno se inscribe en un turno `DISPONIBLE` ya creado; no crea turnos ni elige aula. HU-C-17 debe producir turnos `DISPONIBLE` con 0 alumnos que entren en las opciones, pero la implementación inicial puede usar turnos del seed. Antes de cerrar la HU se verifica la integración real con un turno generado por HU-C-17 cuando esa HU esté disponible.

**Fuera de alcance:** el listado completo de HU-C-13 (próximos/anteriores, cancelados y paginación), cancelación o cambio de inscripción, cobro online, cambios de `schema.prisma`, migraciones y `seed.ts`. Se incorpora solo una pantalla mínima de “Mis turnos” para que el menú y el regreso posterior a HU-C-12 tengan un destino real.

## 2. Historia de Usuario

**Como** Alumno, **necesito** inscribirme a un turno existente eligiendo materia, profesor y horario, **para** reservar mi lugar sin depender de Mesa de Entrada.

## 3. Alcance de esta task

- GET de opciones filtradas en orden materia → profesor → horario, con conteos por materia/profesor y aula informativa. Solo turnos futuros `DISPONIBLE` con cupo libre y sin inscripción previa del alumno autenticado.
- POST de inscripción propia sin body ni id de alumno enviado por el cliente, con permiso `turnos:solicitar_propio`.
- Reutilización del núcleo transaccional de HU-C-04: bloqueo de fila, estado, vigencia, alumno activo, inscripción previa, superposición, cupo y transición a `COMPLETO`. El autoservicio pasa al núcleo el estado `activo` resuelto desde la sesión para no volver a consultar la ficha.
- Página propia con estados vacíos, errores útiles, resumen y banner de éxito que diga “Te inscribiste correctamente” y “El pago se abona en el centro”.

## 4. Contrato backend

**Opciones:** `GET /api/turnos/inscripcion/opciones?materia_id=&profesor_id=`. La consulta resuelve la identidad desde la sesión mediante el servicio público de Alumno y devuelve únicamente las opciones inscribibles. Materias y profesores incluyen `turnos_con_lugar`; cada horario incluye `aula` según la decisión visual de §0 y no incluye datos de otros alumnos.

**Inscripción:** `POST /api/turnos/[id]/inscripcion`, sin body. `obtenerAlumnoDeUsuario(session.user.id)` devuelve `{ id, activo }`; si no hay ficha vinculada, se responde `403 SIN_PERMISO`. El núcleo `inscribirAlumnoEnTurno(turnoId, alumnoId, { origen: "AUTOSERVICIO", alumnoActivo }, tx)` comparte reglas con Mesa de Entrada. La capa de autoservicio traduce `TURNO_PENDIENTE` y `TURNO_CANCELADO` a `TURNO_NO_DISPONIBLE`, y adapta el mensaje de superposición a segunda persona. Una ficha inactiva responde `409 ALUMNO_INACTIVO`. El evento `turno:alumno_agregado` incluye `origen: "AUTOSERVICIO"`; si se completa el cupo también se emite `turno:completado`, después del commit.

**Errores principales:** `SIN_PERMISO`, `TURNO_NO_ENCONTRADO`, `TURNO_NO_DISPONIBLE`, `TURNO_VENCIDO`, `CUPO_INSUFICIENTE`, `ALUMNO_INACTIVO`, `ALUMNO_YA_ASIGNADO`, `ALUMNO_NO_DISPONIBLE`. La variante de Mesa de Entrada conserva sus códigos y mensajes actuales, salvo el contrato explícito para `CANCELADO`.

## 5. Frontend

**Pantalla:** Solicitar turno, página completa; ver la fila HU-C-12 en `docs/adicionales/mapa-pantallas-sprint-2.md` §2. La nueva `docs/adicionales/guia-pantallas-referencia-sprint-2.md` §2–4 explica la jerarquía de referencias y el flujo SDD. Para la interacción se sigue el PDF, pág. 29: elección Materia → Profesor → Horario, resumen con aula y botones “Cancelar” e “Inscribirme”. Al cambiar materia se limpian profesor y horario; al cambiar profesor se limpia horario. Si una combinación queda sin turnos, se muestra “No hay turnos disponibles para esta combinación” y se permite elegir otra. Al confirmar se navega a `/alumno?inscripcion=exitosa`, donde el destino mínimo “Mis turnos” muestra el banner “Te inscribiste correctamente / El pago se abona en el centro”.

## 6. Testing y evidencia

1. **Unitario:** opciones según filtro, turno futuro con cupo, exclusión del alumno ya inscripto, inscripción válida, turno completo, vencido, duplicado, superposición, cupo agotado por concurrencia y regresión de HU-C-04.
2. **Postman / API:** GET en sus tres niveles, POST exitoso y errores esperados con permiso y cuerpo `{ data, error }`; comprobar que un `alumno_id` enviado por el cliente no determina la identidad.
3. **Base de datos y UI:** verificar `TurnoAlumno`, estado `COMPLETO` al llegar al cupo y `EventoTurno` con origen; recorrer la página en Chromium mediante Playwright. Repetir con un turno creado por HU-C-17 cuando la integración esté disponible.

Registrar como **bloqueado** cualquier criterio que no pueda comprobarse por una dependencia externa; no marcarlo como aprobado.

**Entorno local al relevar:** dependencias instaladas con `npm ci --ignore-scripts`. Como el daemon de Docker no responde, se preparó un contenedor aislado de PostgreSQL 16 con Podman (`noctium-hu-c-12-pg`, `127.0.0.1:55432`, base `noctium_hu_c12` y volumen propio); `.env` es local e ignorado por Git. `prisma migrate deploy` aplicó las 33 migraciones, `prisma generate` generó el cliente y `prisma db seed` terminó sin errores. La consulta directa confirmó 25 turnos `DISPONIBLE` y 7 fichas de alumno activas con cuenta. No se usó `migrate reset` ni se tocaron bases compartidas.

### Evidencia local (28/09/2026)

- **Código en la base actualizada:** `npm run build` y `npm run lint` terminaron sin errores. `npm test`: 389 pruebas pasaron y 18 pruebas PostgreSQL se omitieron por defecto. Ejecuté por separado `turno.publico.pg.test.ts` y `turno.reservas.pg.test.ts` contra la base aislada: 9 pruebas pasaron en cada suite. Las 24 pruebas focalizadas en inscripciones HU-C-04/HU-C-12 también pasaron en la corrida anterior.
- **Opciones y permisos:** con sesión de Alumno, los tres niveles de GET devolvieron `200` (6 materias, 2 profesores para Matemática y los horarios de la combinación). El horario incluye fecha, horas, cupos libres y nombre del aula; no incluye datos de otros alumnos. Profesor sin materia devolvió `400 VALIDACION`; sin sesión, GET y POST devolvieron `401 SESION_INVALIDA`; con sesión de Mesa de Entrada, ambos devolvieron `403 SIN_PERMISO`.
- **Inscripción y revalidación:** POST en `seed-turno-10` pasó de 12/30 a 13/30; repetirlo devolvió `409 ALUMNO_YA_ASIGNADO`. Un id inexistente devolvió `404 TURNO_NO_ENCONTRADO`. En `seed-turno-21`, una solicitud con un `alumno_id` ajeno en el body inscribió a la ficha de la sesión (9/10), no a la indicada en el body. La inscripción siguiente llegó a 10/10 y respondió `COMPLETO`.
- **Persistencia:** consultas SQL en la base aislada confirmaron `TurnoAlumno` para el alumno de sesión, `estadoTurno = COMPLETO` en `seed-turno-21`, dos eventos `turno:alumno_agregado` con `origen = AUTOSERVICIO` y un evento `turno:completado`. `seed-turno-05`, que tenía 0/20 alumnos, apareció en las opciones y admitió la primera inscripción.
- **Pantalla:** Playwright con Chromium comprobó la selección Materia → Profesor → Horario y el resumen con aula en escritorio (1440 × 1000); completó una inscripción y confirmó el retorno a `/alumno?inscripcion=exitosa` con el banner “Te inscribiste correctamente / El pago se abona en el centro”. La fila y el evento de esa inscripción de prueba se eliminaron después; el turno de seed recuperó sus 6 cupos. En móvil (390 × 844) comprobó ambos enlaces del menú, el acceso desplazable a los botones y ausencia de desborde horizontal.
- **Pendiente externo:** HU-C-17 todavía no está integrada en `develop`; no se puede comprobar un turno creado por esa implementación. También falta comparar el helper local de Alumno con el PR 0' de Lautaro. El destino “Mis turnos” queda limitado a navegación y confirmación; su listado completo sigue en HU-C-13.

### Integración de `develop` (29/09/2026)

- Se incorporaron los merges de HU-L-03 (#110), revisión de specs y servicios públicos (#113) y HU-C-16 (#115). La spec vigente de Turnos ahora define `obtenerAlumnoDeUsuario()` como `{ id, activo }`, el parámetro opcional `alumnoActivo` en el núcleo de inscripción y la traducción de `TURNO_PENDIENTE` / `TURNO_CANCELADO` para autoservicio. La implementación local quedó alineada con ese contrato.
- El módulo Aula publicó sus funciones en `src/server/aulas/aula.publico.ts`; Turnos ya importa `verificarAulaActiva()` desde allí.
- Las verificaciones posteriores a esos merges se registran en el apartado siguiente.

### Revalidación antes del PR (29/09/2026)

- **Unitarias:** `npm test` terminó con 420 pruebas aprobadas y 18 PostgreSQL omitidas por la guarda predeterminada. Ejecuté esas dos suites por separado contra la base aislada: `turno.publico.pg.test.ts` (9) y `turno.reservas.pg.test.ts` (9), todas aprobadas.
- **CI local:** `npm run lint`, `npx prisma generate` y `npm run build` terminaron sin errores; el build incluyó las dos rutas API y la pantalla de C-12. Esos son los tres pasos que ejecuta `.github/workflows/ci.yaml` después de instalar dependencias.
- **API con sesión real:** GET sin filtros devolvió `200` y seis materias; el filtro Materia → Profesor devolvió `200`, una opción de profesor y dos horarios con aula y cupos. Profesor sin materia devolvió `400 VALIDACION`; sin sesión, GET devolvió `401 SESION_INVALIDA`; con sesión de Mesa de Entrada, GET y POST devolvieron `403 SIN_PERMISO`.
- **POST e identidad:** desde la pantalla se inscribió al alumno autenticado en `seed-turno-06` y volvió a `/alumno?inscripcion=exitosa`. Un segundo POST a `seed-turno-24` incluyó un `alumno_id` de otro alumno en el cuerpo; respondió `200` y la nueva relación `TurnoAlumno` fue la de la ficha de la sesión. La consulta directa confirmó el evento `turno:alumno_agregado` con `origen = AUTOSERVICIO`.
- **UI y limpieza:** Playwright comprobó selección, resumen con aula, navegación de regreso y banner de éxito. A 390 × 844 px verificó los enlaces “Mis turnos” y “Solicitar turno” y ausencia de desborde horizontal. Eliminé las dos relaciones y eventos creados por estas pruebas, además de los fixtures de las suites PostgreSQL, y confirmé que los cupos del seed volvieran a sus valores previos; no se hizo reset ni reseed.
- **Pendiente externo:** HU-C-17 sigue sin estar en `develop`, por lo que la comprobación con un turno generado por esa implementación sigue bloqueada. También falta comparar el helper local con el PR 0' de Lautaro. La pantalla “Mis turnos” continúa limitada al destino y al aviso; el listado de HU-C-13 queda fuera de alcance.

### Actualización y comprobación de integración (01/10/2026)

- Se integró `origin/develop` en `66966ab` (incluye HU-C-05, HU-C-06, HU-C-18 y HU-E-01). Se resolvieron los conflictos en Sidebar, `alumno.publico.ts` y `turno.service.ts`, conservando la configuración actual del wizard y las validaciones de los servicios públicos de Profesor.
- El helper mínimo de Alumno se sustituyó por el archivo oficial de `develop`. `obtenerAlumnoDeUsuario(usuarioId, db?)` conserva exactamente `{ id, activo } | null`; la comparación con el PR 0' queda resuelta.
- Se corrigió una aserción PostgreSQL heredada de HU-C-04: el helper público actual rechaza una ficha inactiva con `ALUMNO_INACTIVO` y conserva `detalles.alumno_id`. No se cambió el comportamiento del servicio para acomodar la prueba.
- `npm test`: **1.287 aprobadas**, 58 PostgreSQL omitidas por su guarda. Las **58 PostgreSQL** se ejecutaron por separado y pasaron en una base nueva `noctium_test`, dentro del contenedor aislado de pruebas, incluyendo reservas, participantes, cancelación y reprogramación.
- `npm run lint`, `npx prisma generate`, `npm run build` (Next.js 16.3.8/Turbopack) y `npx tsc --noEmit` después del build: aprobados.
- **Playwright con aplicación de producción y sesiones reales:** selección Materia → Profesor → Horario, aula informativa, resumen, inscripción desde móvil y regreso con el aviso de éxito. La base confirmó la identidad de sesión, el evento con `origen: AUTOSERVICIO` y la transición del último cupo a `COMPLETO`.
- **Integración HU-C-17:** se creó un checkout temporal de C-12/C-13 combinado con `origin/feature/HU-C-17` en `2937a5b`, sin incorporar esos cambios a esta PR. Su servicio real de vista previa y confirmación generó un turno `DISPONIBLE` 0/1; Playwright lo encontró e inscribió al alumno hasta 1/1 `COMPLETO`. La compatibilidad queda comprobada; la integración de HU-C-17 en `develop` sigue pendiente del equipo.
- **Concurrencia y revalidación:** dos sesiones reales disputaron un último cupo; solo una obtuvo `200`, la otra `409`, con una sola relación persistida. Un `alumno_id` ajeno en el body no alteró la identidad. Cancelar un turno después de seleccionarlo produjo `409`, un mensaje visible y recarga de opciones sin insertar la inscripción.
- **Presentación:** 1440 × 1000 y 390 × 844, sin desborde horizontal; menú móvil, acceso a ambos flujos, botones y paginación comprobados. Sin excepciones JavaScript; el `409` del caso de conflicto es esperado.
- Las capturas y el reporte de comprobaciones se guardaron como evidencia local. Se retiraron los fixtures creados para Playwright y se eliminó la base temporal de suites; no se hizo reset ni reseed de la base del usuario.

## 7. Definition of Done

- [x] Relevamiento de §0 revisado y aprobado por Iván.
- [x] Contrato de opciones y ruta de pantalla confirmados por Iván.
- [x] Contrato público de Alumno oficial integrado y comparado con la implementación inicial.
- [x] Backend y frontend cumplen los seis criterios del backlog y la spec §2.14.2 con los turnos locales disponibles.
- [x] HU-C-04 mantiene su comportamiento, comprobado con regresión.
- [x] Evidencia unitario, API, base de datos y UI documentada.
- [x] Inscripción con un turno generado por la rama real de HU-C-17 comprobada en un checkout temporal; su merge en `develop` queda a cargo del equipo.
- [x] Navegación “Mis turnos” / “Solicitar turno” y regreso con el aviso de éxito implementados; el listado HU-C-13 completo queda fuera de este task.
- [x] Diff local acotado a HU-C-12, revalidado y preparado para una PR dirigida a `develop`.
