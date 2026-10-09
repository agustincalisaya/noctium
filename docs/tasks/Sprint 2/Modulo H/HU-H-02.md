# TASK: HU-H-02 — Ver cantidad de alumnos nuevos por mes

**Módulo:** H (Indicadores / Dashboard)<br>
**Sprint:** 2<br>
**Responsable:** Iván<br>
**Contrato de referencia:** `docs/specs/spec_modulo_H.md` §2.1, §3.1–3.5 · `docs/specs/spec_modulo_B.md` §2.8 y §3.10 · `docs/RULES.md` reglas 3, 4, 5, 6, 10 y 11 · `docs/DESIGN.md` §2 · `docs/adicionales/mapa-pantallas-sprint-2.md` §2 · `docs/tasks/Sprint 2/HU-Sprint-2.md` §25 · Issue #104<br>
**RBAC:** `indicadores:leer` — ya existe y es exclusivo de `GERENTE`; no se modifica.<br>
**Schema:** sin cambios. Los modelos, el permiso y los servicios públicos requeridos ya están en `develop`.

**Estado:** relevamiento aprobado el 30/09/2026. Implementada en PR propio apilado sobre HU-H-01.

---

## 0. Relevamiento previo a implementación

Revisado sobre `feature/hu-h-01-hu-h-02`, creada desde `origin/develop` en `e44f270`, con HU-H-01 implementada en el commit `10c1dcf`. El PR de HU-H-02 tiene como base la rama de HU-H-01 para mostrar solo su diff incremental.

- La función pública `contarAlumnosNuevosPorMes()` está en `src/server/alumnos/alumno.publico.ts`. Cuenta fichas activas e inactivas, con o sin usuario asociado, agrupadas por `createdAtAlumno` en `America/Argentina/Buenos_Aires`.
- El permiso `indicadores:leer` ya existe en RBAC.
- El endpoint y la pantalla son compartidos con HU-H-01; ambas historias usan los mismos meses y filtros.
- No hay librería de gráficos ni componente chart instalado. Se acordó usar SVG propio con los tokens `--chart-1` y `--chart-2`, tabla accesible y sin nuevas dependencias.
- El backlog y la issue estiman 1 SP; el PDF de asignación lista 2 SP. Esta task conserva 1 SP y deja registrada la discrepancia sin reestimar.

### Archivos de esta HU

- `docs/tasks/Sprint 2/HU-H-02.md`
- `src/types/indicadores.types.ts`
- `src/server/indicadores/indicadores.service.ts` y `.test.ts`
- `src/app/api/indicadores/route.test.ts`
- `src/app/(dashboard)/gerente/indicadores-client.tsx` y `.test.tsx`

El PR de HU-H-01 aporta la ruta, los selectores, la pantalla base y el gráfico de turnos. Este PR agrega la serie de alumnos a ese contrato y presenta el segundo gráfico; no repite la infraestructura de la primera historia.

El relevamiento quedó confirmado por Iván antes de implementar. No se modifican `schema.prisma`, `seed.ts`, permisos, dependencias ni specs de otros módulos.

---

## 1. Nota de alcance

HU-H-02 extiende el endpoint y la pantalla ya integrados por HU-H-01. El módulo H delega el conteo al servicio público de B y no consulta la tabla de alumnos. Este PR se mantiene apilado hasta que HU-H-01 se integre a `develop`; luego se retargetea su base a `develop`.

La dependencia de HU-B-01/HU-B-08 ya está disponible mediante `contarAlumnosNuevosPorMes()`. No distingue estado de la ficha ni existencia de una cuenta de acceso.

**Fuera de alcance:**

- Desgloses por rol, materia o profesor.
- Exportar, imprimir, enviar o modificar datos.
- Cambios en el contrato público del módulo B.

---

## 2. Historia de Usuario

**Como** Gerente<br>
**Necesito** ver cuántos alumnos nuevos se registraron por mes<br>
**Para** evaluar el crecimiento de la base de alumnos del centro.

**SP estimado:** 1 según issue y backlog del Sprint 2; el PDF de asignación indica 2 SP.

**Criterios:** contar todas las fichas por fecha de alta, con o sin cuenta vinculada; compartir el mismo rango de HU-H-01; mostrar meses sin altas con cero; no filtrar por rol ni otro criterio.

---

## 3. Alcance de esta task

Implementación incremental de backend y frontend conforme a `spec_modulo_H.md` §2.1. El servicio agrega el conteo mensual de alumnos a la respuesta existente y la página de Gerente muestra la serie junto al gráfico de turnos, con los mismos selectores.

**Fuera de alcance:** cambios de esquema/base de datos, permisos nuevos, filtros de negocio adicionales, nuevas pantallas y cualquier operación de escritura.

---

## 4. Contrato Backend

### 4.1. Query

Usa el rango inclusivo `desde`/`hasta` de `GET /api/indicadores`, compartido con HU-H-01. Por defecto son seis meses incluyendo el actual de `America/Argentina/Buenos_Aires`; máximo 24 meses.

### 4.2. Servicio

`obtenerIndicadoresMensuales()` delega `contarAlumnosNuevosPorMes(desde, hasta)` al módulo B y completa meses sin altas con cero. No consulta tablas de otros módulos directamente.

### 4.3. Route Handler

Comparte `GET /api/indicadores`, `withPermission("indicadores:leer")` y el shape estándar `{ data, error }` con HU-H-01.

---

## 5. Frontend

- El gráfico “Alumnos nuevos por mes” aparece junto al de turnos en la página Indicadores.
- El rango Desde/Hasta es único y actualiza ambas series simultáneamente.
- Los selectores son desplegables, incluyen “Desde” y “Hasta” en el control, muestran los meses en español y permiten elegir dentro de los últimos 24 meses hasta el mes actual.
- El gráfico usa `--chart-2`; muestra valor por mes y total del período, con etiquetas legibles y sin códigos de HU en el texto visible al cliente.
- Los meses sin altas siguen visibles con valor 0. Si el rango entero es cero, se mantiene el gráfico y se muestra “No hay datos para el período seleccionado”.
- Gráfico SVG compacto que aprovecha el ancho de la tarjeta, se desplaza horizontalmente en rangos largos o pantallas estrechas, destaca el último mes y ofrece una tabla con nombre accesible para lectores de pantalla.

---

## 6. Testing

### Nivel 1 — Unitarios

- El servicio integra meses con y sin altas, conservando el valor cero.
- Los cambios de rango actualizan turnos y alumnos juntos.
- UI: muestra los valores, el total, el estado vacío, los errores y etiquetas accesibles.

### Nivel 2 — Postman

- El mismo `GET /api/indicadores` devuelve `alumnos_nuevos` en cada mes del rango.
- Rango inválido o mayor a 24 meses → `400`; sesión ausente → `401`; rol sin permiso → `403`.

### Nivel 3 — BD

- Contrastar la serie con `contarAlumnosNuevosPorMes()` sobre PostgreSQL.
- Confirmar altas agrupadas por fecha local, incluyendo fichas activas/inactivas y con/sin cuenta.
- Módulo H es de solo lectura y no escribe en ninguna tabla.

**Evidencia de ejecución local (30/09/2026):**

- `npm test`: 67 archivos aprobados, 7 omitidos; 911 pruebas aprobadas, 37 omitidas y 3 TODO. Incluye pruebas de esquema, servicio, endpoint, gráficos y pantalla.
- `npm run lint`, `npx prisma generate` y `npm run build`: aprobados durante la implementación inicial. Build Next.js 16.3.5, con TypeScript.
- Tras compactar los gráficos a 260 px y ajustar el eje para mantener barras legibles: `npm test -- src/components/indicadores/grafico-mensual.test.tsx 'src/app/(dashboard)/gerente/indicadores-client.test.tsx'` (7 pruebas aprobadas), `npm run lint`, `./node_modules/.bin/tsc --noEmit` y `git diff --check` aprobados.
- Postman/curl manual y comparación directa en PostgreSQL: pendientes. Las 7 suites `.pg.test.ts` quedaron omitidas en este entorno.
- Revisión visual manual en navegador: pendiente; no hubo un navegador conectado a la sesión de automatización.

---

## 7. Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Conteo delegado al servicio público de B.
- [x] Mismo rango para ambas series; meses vacíos en cero.
- [x] Unitarias, lint, generación de Prisma y build documentados con su resultado.
- [ ] Postman/curl manual, verificación directa de BD y revisión visual manual pendientes.
- [x] No se consulta directamente una tabla de otro módulo.
- [ ] PR de HU-H-02 contra `feature/hu-h-01`; retargetear a `develop` después de integrar HU-H-01.
