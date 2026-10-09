# TASK: HU-H-01 — Ver cantidad de turnos por mes

**Módulo:** H (Indicadores / Dashboard)<br>
**Sprint:** 2<br>
**Responsable:** Iván<br>
**Contrato de referencia:** `docs/specs/spec_modulo_H.md` §2.1, §3.1–3.5 · `docs/specs/spec_modulo_C.md` §2.15 · `docs/RULES.md` reglas 3, 4, 5, 6, 10 y 11 · `docs/DESIGN.md` §2 · `docs/adicionales/mapa-pantallas-sprint-2.md` §2 · `docs/tasks/Sprint 2/HU-Sprint-2.md` §24 · Issue #103<br>
**RBAC:** `indicadores:leer` — ya existe y es exclusivo de `GERENTE`; no se modifica.<br>
**Schema:** sin cambios. Los modelos, el permiso y la migración `CANCELADO` ya están en `develop`.

**Estado:** relevamiento aprobado el 30/09/2026. Implementada en PR propio; HU-H-02 extiende esta base en un PR apilado.

---

## 0. Relevamiento previo a implementación

Revisado sobre la rama `feature/hu-h-01-hu-h-02`, creada desde `origin/develop` en `e44f270`.

- La función pública `contarTurnosPorMes()` ya existe en `src/server/turnos/turno.publico.ts`. Agrupa por `fechaTurno`, incluye `DISPONIBLE`, `COMPLETO` y `CANCELADO`, y excluye `PENDIENTE`.
- El permiso `indicadores:leer` ya está en la matriz RBAC y en la base de Sprint 2.
- `src/app/(dashboard)/gerente/page.tsx` solo muestra un placeholder. El menú de Gerente todavía no enlaza a Indicadores.
- No hay una librería de gráficos ni un componente chart instalado. Se acordó usar SVG propio con `--chart-1`, etiquetas de valor y alternativa accesible en tabla; no agregar dependencias.
- El backlog y la issue estiman 1 SP; el PDF de asignación lista 2 SP. Esta task conserva 1 SP y deja registrada la discrepancia sin reestimar.

### Archivos aprobados para esta HU

**Nuevos**

- `docs/tasks/Sprint 2/HU-H-01.md`
- `src/types/indicadores.types.ts`
- `src/server/indicadores/indicadores.schema.ts`
- `src/server/indicadores/indicadores.schema.test.ts`
- `src/server/indicadores/indicadores.service.ts`
- `src/server/indicadores/indicadores.service.test.ts`
- `src/app/api/indicadores/route.ts`
- `src/app/api/indicadores/route.test.ts`
- `src/app/(dashboard)/gerente/indicadores-client.tsx`
- `src/app/(dashboard)/gerente/indicadores-client.test.tsx`
- `src/components/indicadores/grafico-mensual.tsx`
- `src/components/indicadores/grafico-mensual.test.tsx`

**Existentes a modificar**

- `src/app/(dashboard)/gerente/page.tsx` — reemplazar el placeholder por la pantalla de Indicadores y el gate de rol.
- `src/components/layout/Sidebar.tsx` — agregar el acceso de Gerente a `/gerente`.

El relevamiento quedó confirmado por Iván antes de implementar. No se modifican `schema.prisma`, `seed.ts`, permisos, dependencias ni specs de otros módulos.

---

## 1. Nota de alcance

HU-H-01 establece la pantalla Indicadores, el rango compartido y `GET /api/indicadores` con la serie de turnos. HU-H-02 se entrega en un PR posterior apilado sobre esta rama: amplía el contrato con alumnos y agrega el segundo gráfico sin duplicar la infraestructura compartida.

La dependencia que ya estaba pendiente quedó integrada: la función pública de Turnos está disponible. C-05 no bloquea la implementación; la función ya cuenta `CANCELADO`. La comprobación con un turno cancelado mediante la UI de C-05 podrá repetirse cuando esa HU se integre.

**Fuera de alcance:**

- Desgloses por materia o profesor (HU-H-03/HU-H-04, Sprint 3).
- Exportar, imprimir, enviar o modificar datos.
- Cambios en el contrato público del módulo C.

---

## 2. Historia de Usuario

**Como** Gerente<br>
**Necesito** ver cuántos turnos se registraron por mes<br>
**Para** evaluar el volumen de actividad del centro.

**SP estimado:** 1 según issue y backlog del Sprint 2; el PDF de asignación indica 2 SP.

**Criterios:** agrupar por fecha del turno; contar Disponible, Completo y Cancelado; excluir Pendiente; rango inicial de seis meses incluido el actual; rango ajustable; mostrar meses vacíos con cero; no separar por materia ni profesor.

---

## 3. Alcance de esta task

Implementación de backend y frontend conforme a `spec_modulo_H.md` §2.1. Incluye el conteo de turnos mediante el servicio público de C, endpoint de lectura protegido, dos selectores de mes y un gráfico de barras en la pantalla Indicadores.

**Fuera de alcance:** cambios de esquema/base de datos, permisos nuevos, filtros de negocio adicionales, nuevas pantallas y cualquier operación de escritura.

---

## 4. Contrato Backend

### 4.1. Query

`GET /api/indicadores?desde=AAAA-MM&hasta=AAAA-MM`. Ambos parámetros son opcionales; por defecto se consultan los seis meses hasta el mes actual de `America/Argentina/Buenos_Aires`. Rango inclusivo de hasta 24 meses. Mes invertido, fecha mal formada o rango mayor responde `400` con errores Zod.

### 4.2. Servicio

`obtenerIndicadoresMensuales()` delega `contarTurnosPorMes(desde, hasta)` al módulo C y completa los meses sin datos con cero. No consulta tablas de otros módulos directamente.

### 4.3. Route Handler

`GET /api/indicadores`, protegido con `withPermission("indicadores:leer")`. Respuesta estándar `{ data, error }`; los datos incluyen rango y lista mensual de turnos. HU-H-02 agrega la serie de alumnos en el PR dependiente.

---

## 5. Frontend

- Pantalla completa Indicadores en la ruta ya existente `/gerente`, visible para Gerente.
- Un selector compartido Desde/Hasta, inicializado con los últimos seis meses.
- Selectores desplegables con “Desde” y “Hasta” dentro de cada control y nombres de mes en español; se puede elegir cualquier mes dentro de los últimos 24 meses, hasta el mes actual.
- El gráfico usa `--chart-1`. Incluye el valor de cada mes y el total del período, con etiquetas legibles y sin códigos de HU en el texto visible al cliente.
- Meses sin actividad permanecen visibles con valor 0. Si todo el período está vacío, se informa “No hay datos para el período seleccionado”.
- Gráfico SVG compacto que aprovecha el ancho de la tarjeta, se desplaza horizontalmente en rangos largos o pantallas estrechas, destaca el último mes y ofrece una tabla con nombre accesible para lectores de pantalla.
- Diseño consistente con los tokens de `docs/DESIGN.md`.

---

## 6. Testing

### Nivel 1 — Unitarios

- Validación de formato, orden y límite de 24 meses; resolución del período por defecto y mes actual en la zona horaria contractual.
- Composición de datos: recuentos de Turnos, meses ordenados y ceros en meses vacíos.
- Route Handler: respuesta estándar, validación `400` y rechazo por permiso.
- UI: carga, cambio de rango, estado vacío, errores y lectura accesible de los valores.

### Nivel 2 — Postman

- `GET /api/indicadores` sin parámetros → seis meses para el gráfico de turnos.
- Rango explícito de uno y varios meses → inclusivo.
- Mes inválido, invertido o rango mayor a 24 → `400`.
- Sesión ausente → `401`; rol sin permiso → `403`.

### Nivel 3 — BD

- Consultas de solo lectura: contrastar el GET con `contarTurnosPorMes()` y verificar que el conteo usa fecha del turno, incluye `CANCELADO` y excluye `PENDIENTE`.
- No hay mutaciones ni persistencia propia en el módulo H.
- La comprobación de cancelación real queda pendiente hasta integrar C-05; no bloquea esta task.

**Evidencia de ejecución local (30/09/2026):**

- `npm test`: 67 archivos aprobados, 7 omitidos; 911 pruebas aprobadas, 37 omitidas y 3 TODO. Incluye pruebas de esquema, servicio, endpoint, gráfico y pantalla.
- `npm run lint`, `npx prisma generate` y `npm run build`: aprobados durante la implementación inicial. Build Next.js 16.3.5, con TypeScript.
- Tras compactar los gráficos a 260 px y ajustar el eje para mantener barras legibles: `npm test -- src/components/indicadores/grafico-mensual.test.tsx 'src/app/(dashboard)/gerente/indicadores-client.test.tsx'` (7 pruebas aprobadas), `npm run lint`, `./node_modules/.bin/tsc --noEmit` y `git diff --check` aprobados.
- Postman/curl manual y comparación directa en PostgreSQL: pendientes. Las 7 suites `.pg.test.ts` quedaron omitidas en este entorno.
- Revisión visual manual en navegador: pendiente; no hubo un navegador conectado a la sesión de automatización.

---

## 7. Definition of Done

- [x] Relevamiento confirmado antes de implementar.
- [x] Servicio, esquema y Route Handler siguen el contrato SDD.
- [x] Frontend usa el rango seleccionado y muestra el indicador de turnos.
- [x] Unitarias, lint, generación de Prisma y build documentados con su resultado.
- [ ] Postman/curl manual, verificación directa de BD y revisión visual manual pendientes.
- [x] No se consulta directamente una tabla de otro módulo.
- [ ] PR de HU-H-01 contra `develop`; HU-H-02 se abre aparte con base en esta rama.
