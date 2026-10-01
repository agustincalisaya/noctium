# TASK: HU-E-05 — Ver historial académico del alumno

**Módulo:** E (Atención académica / Historial) · **Sprint:** 2 · **SP estimado:** 2  
**Contrato de referencia:** `docs/specs/spec_modulo_E.md` §§1, 2.3–2.4, 3.1, 3.5 y 4 · `spec_modulo_A.md` §2.4 · `spec_modulo_B.md` §2.8 · `spec_modulo_C.md` §2.4 · `spec_modulo_D.md` §2.8 · `spec_modulo_L.md` · `docs/RULES.md` Reglas 3–6, 10 y 11  
**Pantalla:** tab «Historial académico» dentro de `/alumnos/[id]`; mapa Sprint 2 §1 y §2; mockup de referencia, pág. 18.  
**RBAC:** permiso existente `historial:leer` (MESA_ENTRADA, GERENTE, PROFESOR); no se crean permisos.  
**Schema:** lectura únicamente; no requiere migración.

**Estado:** implementación y verificación completadas en `feature/hu-e-05`, apilada sobre `feature/hu-e-01`. Pasan TypeScript, ESLint y la suite completa. Se verificaron interfaz, API y persistencia usando Playwright/Chromium y una base PostgreSQL temporal.

---

## 0. Relevamiento previo a implementación

Relevamiento común autorizado por el usuario en la solicitud original; HU-E-05 se publica después de HU-E-01 para disponer de clases dictadas y de su servicio público de alcance.

- Base revisada: `develop` en `830d4b4`; rama de publicación `feature/hu-e-05`, apilada sobre `feature/hu-e-01`.
- Archivos backend de esta HU: `src/types/historial.types.ts`; `src/server/historial/historial.service.ts`, `historial.schema.ts`, `historial.publico.ts`; `src/server/materias/materia.publico.ts`; `src/app/api/alumnos/[id]/historial/route.ts`; y la capacidad de acceso y su enlace desde C-09.
- Archivos frontend de esta HU: `src/app/(dashboard)/alumnos/[id]/page.tsx`, `ficha-encabezado.tsx`, nuevo `historial-academico.tsx`, `src/components/shared/pagination.tsx` y `src/app/(dashboard)/turnos/[id]/turno-alumnos-card.tsx` para el enlace «Ver historial». El alta de resultados se integra después mediante HU-E-06.
- `obtenerNombresProfesores()` y servicios públicos de alumno existen. El contrato de `obtenerMateriasPorIds()` ya está publicado en `spec_modulo_L.md` §2.5 y su implementación de lectura se incorpora en `src/server/materias/materia.publico.ts` en esta rama como apoyo para E-05/E-06. No crea una HU-L-03 ni amplía esa historia; E sigue sin consultar directamente la tabla de materias.
- Seguridad ratificada en E §2.3: con `historial:leer` pero sin `alumnos:leer`, la ficha muestra solo historial y no consulta datos de contacto. Un profesor ve el historial completo solo de alumnos que atendió; el control va antes de consultar la existencia.
- Diferencia visual: el mockup muestra conteos separados de clases y exámenes, pero el contrato de respuesta solo entrega `paginacion.total`; la implementación conservará el contrato y mostrará el total unificado. El enlace desde C-09 apunta a `/alumnos/[id]?tab=historial` para abrir el tab previsto.

## 1. Nota de alcance

Vista de solo lectura que combina clases y exámenes en una línea de tiempo unificada. Depende de E-01 y E-06 para datos, de los públicos A/B/D/L para etiquetas y del enlace desde C-09 para el acceso de Gerente y Profesor.

**Fuera de alcance:** alta desde esta vista salvo la acción propia E-06; cambios de registros, datos de contacto para roles sin `alumnos:leer`, búsqueda/exportación y otros filtros distintos de materia.

## 2. Historia de Usuario

**Como** personal de mesa de entrada, gerente o profesor,  
**necesito** ver las clases dictadas y los resultados de examen de un alumno,  
**para** tener una vista completa de su recorrido académico.

**SP estimado:** 2.

**Criterios de aceptación:**

1. El tab lista clases y exámenes en una línea de tiempo por fecha descendente.
2. Las clases muestran fecha, materia y profesor; los exámenes, fecha, materia y nota, y observaciones cuando existan; tipo distinguible también por texto/ícono.
3. Filtrar por materia.
4. Sin registros: «Este alumno todavía no tiene historial académico».
5. La lectura no muta registros; las altas pertenecen a E-01/E-06.
6. Paginar de a 10 sobre el resultado filtrado; cambio de filtro vuelve a página 1; sin paginación con 10 o menos.

## 3. Alcance de esta task

Crear el GET y la vista del tab en la ficha existente; autorizar la ficha con `alumnos:leer` o `historial:leer`; para el segundo caso mostrar solo la vista de historial. Nunca pedir DNI, email ni contacto cuando solo existe `historial:leer`.

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/historial/historial.schema.ts` con `materia_id?`, `pagina` positiva y `por_pagina` máximo 10, según §2.3.

### 4.2. Servicio y ruta

**Archivo:** `src/server/historial/historial.service.ts` → `obtenerHistorialAlumno()`  
**Ruta:** `GET /api/alumnos/[id]/historial`, permiso `historial:leer`.

- Verificar primero alcance del profesor con `profesorAtendioAlumno()` y luego existencia con `obtenerAlumnoBasico()`; no discriminar alumno ajeno/inexistente al profesor.
- Unir ambos tipos en una sola consulta parametrizada (`UNION ALL`), filtrar antes de paginar, ordenar fecha y creación descendente y resolver nombres en lote por servicios públicos de D/L.
- Responder los campos de §2.3 y paginación exacta; sin registros devolver `items: []`.
- Sin `alumnos:leer`, no consultar ni devolver datos de contacto. Errores: `400`, `403 SIN_PERMISO`, `404 ALUMNO_NO_ENCONTRADO`.
- El módulo E no lee tablas de otros módulos; la función L `obtenerMateriasPorIds()` es dependencia obligatoria.

## 5. Frontend

- En la ficha existente, «Datos» y «Historial académico» se mantienen en la misma ruta; entrada desde C-09 abre el tab mediante `?tab=historial`.
- La lista sigue el mockup de referencia (pág. 18): fecha, materia y etiqueta «Clase dictada»/«Examen», con profesor o nota; filtro por materia y paginación de a 10.
- Extender `Pagination` con rango/números opcionales para reproducir «Mostrando X–Y de N» sin cambiar la presentación de los otros listados.
- Para Gerente/Profesor mostrar identidad académica mínima sin DNI/email ni otras secciones; para Mesa conservar la ficha de datos y contacto existente.
- Esta HU implementa solo consulta. La acción «Registrar resultado de examen» se integra en esta pestaña mediante HU-E-06.

## 6. Testing (evidencia ejecutada)

### Nivel 1 — Unitarios

- Alcance antes de existencia; alumno inactivo visible; mezcla y orden de clases/exámenes; filtro previo a paginación; páginas vacías/finales.

### Nivel 2 — API (Playwright autenticado; contratos equivalentes a la colección Postman)

- Profesor atendió/no atendió; Gerente/Mesa; id inexistente; filtro de materia; página 1 y posterior.

### Nivel 3 — BD / SQL directo y navegador

- Validar que la unión incluye solo clases donde aparece el alumno y todos sus exámenes; sin escrituras; evidencia de filtro/paginación y vista history-only.

### Evidencia — 2026-09-30 (Playwright / Chromium y PostgreSQL temporal)

- Se abrió el historial desde «Ver historial» en el detalle C-09 para una alumna inscripta en `seed-turno-27`; la vista mostró la clase registrada.
- Al filtrar por «Programación I», la ruta respondió `200` y conservó los registros de esa materia.
- 4 unitarios cubren unión y orden, filtro/paginación, resultado vacío y autorización del profesor antes de consultar la existencia.
- La alumna sin registros mostró el texto exacto «Este alumno todavía no tiene historial académico».
- Con 11 registros, Playwright mostró 1–10 de 11; «Siguiente» mostró el registro 11 (21/09/2026), y cambiar el filtro desde la segunda página reinició la vista a la primera página.
- Un profesor pudo abrir por C-09 el historial de un alumno que atendió. La página no expuso DNI, email ni la pestaña «Datos». Para un alumno ajeno y para un ID inexistente, el GET respondió el mismo `403 SIN_PERMISO` y el mismo mensaje; no reveló si el alumno existe.
- En la ficha con permiso `alumnos:leer`, la cabecera del tab muestra «Alumnos / Nombre Apellido», sin el enlace «Volver al listado»; la vista exclusiva de historial del profesor conserva su acceso de regreso al turno.
- SQL de solo lectura confirmó 11 elementos combinados (1 clase y 10 exámenes) para el alumno de prueba y cero para la alumna vacía. La comparación posterior a la lectura confirmó que el historial no insertó registros.
- No se ejecutó Postman como aplicación: el filtro y los casos de autorización/API se probaron con llamadas autenticadas desde Playwright.

## 7. Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Públicos de D/L integrados sin consultas directas a sus tablas.
- [x] Permisos de ficha y datos de contacto separados correctamente.
- [x] Una sola línea de tiempo, filtro, vacío y paginación de 10.
- [x] Enlace desde C-09 visible solo cuando `puede_ver_historial` es `true`.
- [x] Evidencia unitaria, de API y de persistencia/interfaz registrada; las llamadas API se hicieron desde Playwright, no desde Postman.
