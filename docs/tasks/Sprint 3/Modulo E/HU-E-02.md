# TASK: HU-E-02 — Ver y filtrar el historial de clases del alumno

Sprint 3 · Iván · 3 SP · Issue #171 · Rama `feat/hu-e-02-historial-clases`.
Estado: relevamiento del 09/10/2026 aprobado explícitamente por el usuario; E11 y reorganización documental integrados; implementación en curso sobre develop c0bcd34.

## 0. Relevamiento previo a implementación

Base develop `5935805`. Worktree `/tmp/noctium-sprint3-actual/e02`; actualizar antes de implementar/publicar, sin incorporar commits E11/E08 ajenos al develop integrado. PR0 ya publica listarInscripcionesDeAlumno y servicios de transición; profesor conserva alumnos:leer por compatibilidad. El acceso por clase existe, pero redirige hoy a la ficha general: debe convertirse en vista acotada antes de retirar el permiso.

### Archivos existentes a modificar

- `src/app/(dashboard)/alumnos/[id]/page.tsx` y `page.test.tsx`: pestaña Clases y modo consulta gerente, autorización de ficha.
- `src/app/(dashboard)/alumnos/[id]/ficha-encabezado.tsx`: identidad resumida como figura 66 en pestaña Clases.
- `src/app/(dashboard)/turnos/[id]/alumnos/[alumnoId]/historial/page.tsx`: renderizar historial acotado dentro de la ruta de clase, sin redirigir a ficha general.
- `src/server/shared/rutas-por-rol.ts`: alumnos solo mesa/gerente; mantener ruta de clase para profesor.
- `prisma/seed.ts`: quitar grant profesor alumnos:leer y añadirlo a PERMISOS_REVOCADOS, para que seed no restaure permiso.
- `prisma/seed/fixtures/index.ts`: registrar escenarios propios.
- `src/lib/textos.ts`: `ui.historial.clasesAlumno.*` y aviso consulta.
- `docs/specs/spec_modulo_E.md`, `spec_modulo_A.md`, `spec_modulo_B.md`: notas aditivas/changelog sobre permiso y ruta acotada implementados por E02 según reparto.
- `docs/tasks/Sprint 3/Modulo E/HU-E-02.md`.

### Archivos nuevos

- `src/server/historial/clases-alumno.schema.ts` y `clases-alumno.schema.test.ts`.
- `src/server/historial/clases-alumno.service.ts`, `clases-alumno.service.test.ts`, `clases-alumno.pg.test.ts`.
- `src/types/clases-alumno.types.ts`.
- `src/app/api/alumnos/[id]/clases/route.ts` y `route.test.ts`.
- `src/app/(dashboard)/alumnos/[id]/historial-clases.tsx` y `historial-clases.test.tsx`.
- `src/app/(dashboard)/turnos/[id]/alumnos/[alumnoId]/historial/page.test.tsx`.
- `src/server/shared/rutas-por-rol.test.ts`.
- `src/server/shared/permisos-e02.pg.test.ts`.
- `prisma/migrations/20261009180000_hu_e02_alcance_profesor/migration.sql` (comprobar nombre libre antes de crear).
- `prisma/seed/fixtures/hu-e-02.ts`.
- `docs/testing/HU-E-02.postman_collection.json`, `HU-E-02.sql`, `HU-E-02-evidencia.md`.
- `docs/testing/hu-e-02/clases-mesa-desktop.png`, `clases-gerente-desktop.png`, `clases-mobile.png`, `clases-filtradas.png`, `clases-sin-coincidencias.png`, `resultados-http.json`, `resultado-sql.txt`.

### Brechas visuales y dependencias

Figuras 66–67 muestran Desactivar alumno y Pagos, funciones B07/I02 de otros carriles que esta HU no implementa. Propuesta: integrar solamente los accesos reales disponibles al actualizar develop, conservando la estructura de ficha y la pestaña Clases. No crear enlaces vacíos ni acciones ficticias. El aviso de gerente dice consulta; referencia a corregir/anular pagos se incluye solo cuando ese acceso real esté integrado.

El sidebar conserva un acceso Alumnos para profesor, incompatible con retirada del permiso. Por instrucción expresa del usuario no modificar sidebar: la ruta/API rechazan al profesor y el historial permitido se abre desde sus clases. Documentar esta diferencia de navegación. No hace falta cambiar proxy matcher de alumnos/turnos, que ya cubre ambos.

## 1. Nota de alcance

Spec E §2.7, §3.6, §3.8; B §2.12; C §2.16; PR0 reducido §2.9/§2.13/§5.5; reparto y análisis de dependencias: E02 es dueña de retirar permiso con migración nueva. Figuras 66–67, páginas físicas 59–60, revisadas visualmente con imágenes del usuario.

## 2. Historia

Como mesa o gerente necesito todas las inscripciones del alumno y sus resultados con resumen y filtros para conocer su recorrido.

## 3. Alcance

Consulta de clases, nueve resultados, filtro resultado/fechas, porcentajes y acceso acotado profesor. Fuera de alcance: B07/C14/C24 como pantallas/procesos, pagos/montos, sidebar, H03/H10, modificación de migraciones existentes y merges.

## 4. Backend

GET /api/alumnos/[id]/clases con alumnos:leer; servidor solo mesa/gerente. Ficha inexistente 404; alumno inactivo conserva historial. Query resultado enum nueve códigos, fechas calendario inclusivas, desde ≤ hasta, pagina positiva, por_pagina ≤10. La utilidad fecha transforma a Date: convertir de vuelta a YYYY-MM-DD para fachada C; no enviar Date donde espera string.

Servicio E compone obtenerAlumnoBasico de B, listarInscripcionesDeAlumno de C y una consulta propia en lote sobre clases no anuladas y asistencia vigente. Ninguna consulta SQL cruza tablas de otro módulo. Clasificar con orden contractual: fin inscripción y excepción cancelación anterior; reserva vencida sin marcar; cancelación centro; próxima estrictamente antes de inicio; presente/legacy; ausente; sin registro. Múltiples inscripciones mismo turno son filas independientes. Filtrar y resumir antes de paginar; porcentaje presentes con control / clases con control, entero o null. ASISTIO incluye legacy, que no integra porcentaje. Orden fecha/hora/id descendente. Respuesta pública no incluye precio ni estado pago recibido de C.

Migración nueva elimina exclusivamente permiso profesor alumnos:leer, sin tocar negocio. Seed refleja revocación. Historial de profesor en ruta de clase verifica turno propio, materia de esa clase y alcance inscrito vigente/histórico; no expone ficha/DNI/contacto ni pestañas Clases/Pagos. Conservar API historial:leer con recorte por materia y 403 fuera del alcance; pruebas de regresión E04/E07/E10. Permisos leídos de BD por solicitud aplican también a sesiones existentes.

## 5. Frontend

Ficha con breadcrumb, nombre y DNI/email, tabs con subrayado; filtros compactos Resultado/Desde/Hasta. Grilla cinco columnas × dos filas en escritorio: nueve resultados y porcentaje con denominador; tarjetas blancas, borde fino, etiqueta pequeña y cifra prominente. Tabla blanca Fecha/Hora/Materia/Profesor/Aula/Resultado, separadores finos, etiquetas con texto y links al detalle. Responsive en móvil con grilla adaptada y scroll local de tabla. Gerente aviso de consulta y ninguna escritura. Filtros actualizan sin recarga y reinician página; paginación de 10, oculta si ≤10. Vacío literal y sin coincidencias con limpiar filtros; carga, error y reintento; descartar solicitudes tardías.

## 6. Pruebas y datos

Unit/schema/API/UI: nueve estados y prioridad, frontera inicio, reserva vencida aún no marcada, cancelación anterior/posterior al fin, legacy, filtros AND/inclusivos, resumen filtrado, orden/empates, páginas de 10, todos los roles con 403 y ausencia de montos. PostgreSQL: servicios PR0 crear/finalizar/marcar vencidas para fixtures de todas las vigencias; no editar filas directamente para saltar reglas. Migración aplicada en base descartable y permiso no reaparece al seed repetido; sesión vigente pierde acceso general y conserva historial propio de materia por clase. Contraste SQL y colecciones HTTP. Playwright mesa/gerente/profesor, escritorio/móvil, filtro/error/vacío/paginación, teclado, consola y capturas. No declarar C14/B07/C24 completadas por usar sus estados.

Checks: npm test, test:pg, lint, textos, next typegen + tsc y build; CI último SHA. Entorno anterior tiene servidores locales 55443/55445: inspeccionar identidad/configuración antes de usar runner; nunca resetear base personal/demo.

## 7. Definition of Done

- [x] Relevamiento, navegación y brechas del prototipo aprobados.
- [ ] Nueve estados, filtros y porcentajes verificados.
- [ ] Migración aditiva, seed y acceso profesor comprobados.
- [ ] SQL/API/Playwright y checks documentados con resultados reales.
- [ ] PR independiente a develop, Closes #171, sin merge automático.

Organización documental: task ubicada en `Sprint 3/Modulo E` conforme al PR #223 (solo movimientos, integrado en develop).

## 8. Ajustes de inventario

Se agregó `src/app/(dashboard)/alumnos/[id]/clases/page.tsx` como adaptador de la ficha existente, para publicar la ruta canónica de §2.7 sin duplicar encabezado o permisos. `FichaEncabezado` ya tenía el modo resumido requerido; se reutiliza sin modificar. La migración usa un nombre nuevo libre y solo revoca el grant específico.
