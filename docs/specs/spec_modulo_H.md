```markdown
# Especificación Técnica — Módulo H (Indicadores / Dashboard)
## Noctium — Sprint 2
## Revisión 2 — HU-H-01 y HU-H-02 revisadas: Ingresos cobrados y Tasa de ocupación (decisión de PO, 01/10/2026)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth · shadcn/ui (`chart` sobre Recharts, `card`, `skeleton`; tokens `chart-*` de `docs/DESIGN.md`)
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_C.md` (Turno, §2.15 servicios públicos) · `spec_modulo_I.md` (Pagos, §2.3 servicios públicos) · `schema.prisma` · `docs/adicionales/nuevosindicadores.md` (task de esta revisión) · `docs/adicionales/mapa-pantallas-sprint-2.md` (§2, "Indicadores") · `docs/DESIGN.md` (§2 tokens `--chart-1`, `--chart-2`, `--muted-foreground`)

**HU contractualizadas en esta revisión:** HU-H-01 revisada (Ingresos cobrados por mes) y HU-H-02 revisada (Tasa de ocupación promedio por mes). **Reemplazan** a las HU-H-01 (turnos por mes) y HU-H-02 (alumnos nuevos por mes) de la Revisión 1, por decisión del PO del 01/10/2026. Task: `docs/adicionales/nuevosindicadores.md`.

**Changelog de Revisión 2:**
| Sección | Estado previo | Acción |
|---|---|---|
| 2.1 (`GET /api/indicadores`, turnos y alumnos por mes) | Vigente e implementada | **Reemplazada** por 2.2 y 2.3. Se conserva el texto como historial y no se renumera. El endpoint, `obtenerIndicadoresMensuales()` y el gráfico SVG propio se retiran del código |
| Convenciones generales — esquema del rango | `IndicadoresQuerySchema` | Se renombra `RangoIndicadoresQuerySchema` (nombre de la task). Conserva meses `AAAA-MM`, el rango por defecto de 6 meses y el tope de 24 (Q8) |
| 2.2 | — | **Nueva:** `GET /api/indicadores/ingresos-por-mes` (HU-H-01 revisada) |
| 2.3 | — | **Nueva:** `GET /api/indicadores/ocupacion-por-mes` (HU-H-02 revisada) |
| 3.1 | Consumía `contarTurnosPorMes()` (C) y `contarAlumnosNuevosPorMes()` (B) | Consume `sumarPagosPorMes()` (I §2.3) y `promediarOcupacionTurnosPorMes()` (C §2.15). Las dos funciones anteriores se retiran de B y C (sin consumidores) |
| 3.2 | El mes de un turno es el de su fecha; `CANCELADO` cuenta | Se conserva el criterio del mes. La regla sobre `CANCELADO` aplicaba solo a 2.1 y queda reemplazada por 3.6 |
| 3.6 a 3.8 | — | **Nuevas** (ocupación, ingresos, redondeo) |
| 5 | Q8 y librería | Se agregan las decisiones de esta revisión y los puntos abiertos que siguen para el PO |

**Decisiones de relevamiento (01/10/2026, DECISIÓN RESUELTA — no relevar de nuevo):**
- La pantalla sigue en `/gerente`, donde ya apuntan el Sidebar y `proxy.ts`. No se crea `app/(dashboard)/indicadores/`.
- El rango se elige **por mes** (`AAAA-MM`, dos selectores) con el tope de 24 meses de Q8. No se usa un Date Range Picker por día.
- La ocupación toma solo turnos con `fechaTurno ≤ hoy` (Buenos Aires) y mide inscriptos sobre cupo. Los meses futuros salen en 0%.
- Sin Server Actions: el módulo es de solo lectura y el frontend llama a los Route Handlers (misma decisión que la Revisión 1).
- Ubicación según la Regla N.° 11 (`src/server/indicadores/`), no `lib/services/` ni `lib/schemas/` como proponía la task.
- El permiso `indicadores:leer` ya existía (seed, solo GERENTE). Se reutiliza y no se crea ninguno nuevo.

---

### Historial — Revisión 1 (primera versión, módulo nuevo de Sprint 2)

**HU contractualizadas en la Revisión 1:** HU-H-01 (Ver cantidad de turnos por mes), HU-H-02 (Ver cantidad de alumnos por mes) — Sprint 2. Es la **primera revisión** del módulo: no existía `spec_modulo_H.md`.

**Changelog de la Revisión 1 (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-H-01 | Gap — no contractualizada | Añadida sección 2.1 |
| HU-H-02 | Gap — no contractualizada | Añadida sección 2.1 |

**Fuera de alcance de esta spec (explícito):**
- Indicadores por materia (HU-H-03) y por profesor (HU-H-04), de Sprint 3.
- Ocupación, pagos y rendimiento (mencionados en el mapa de historias inicial): no forman parte de Sprint 2. *(Revisión 2: ocupación e ingresos **sí** entran en Sprint 2 por decisión del PO del 01/10/2026; rendimiento sigue fuera.)*
- Exportar, imprimir o programar el envío de los indicadores.
- Cualquier escritura: el módulo es **exclusivamente de lectura**.

---

## 1. Visión General

El Módulo H es la pantalla **"Indicadores"** del Gerente: **una sola pantalla con dos indicadores** (turnos por mes y alumnos nuevos por mes), no dos pantallas (mapa de pantallas §2). Es de solo lectura, no tiene tablas propias y no emite eventos.

Principio de diseño: **el módulo compone, no calcula**. No consulta `turnos` ni `alumnos` (Regla N.° 3): pide los conteos a los servicios públicos de Turnos (`spec_modulo_C.md` §2.15) y de Alumnos (`spec_modulo_B.md` §2.8), completa los meses sin datos con cero y da formato a la respuesta. Por eso un único endpoint devuelve ambas series: comparten un selector de rango (HU-H-02 AC4) y un único cálculo de los meses del rango.

Implementación estándar: Route Handler delgado que delega en `src/server/indicadores/indicadores.service.ts` (Reglas N.° 4 y 11).

**Desde la Revisión 2** los dos indicadores son **Ingresos cobrados por mes** (§2.2) y **Tasa de ocupación promedio por mes** (§2.3). Siguen en una sola pantalla, con un selector de rango compartido. Cada indicador tiene su propio endpoint porque las unidades son distintas (pesos y porcentaje), así que no comparten eje ni respuesta. El principio "el módulo compone, no calcula" se mantiene: las sumas y promedios por mes los entregan los servicios públicos de Pagos (I) y Turnos (C). H completa los meses sin datos, convierte a porcentaje y redondea.

**Alcance de esta revisión:** módulo nuevo de Sprint 2; la sección 2.1 y las reglas 3.1 a 3.5 son nuevas y aditivas. No hay secciones preexistentes, por lo que no se renumera nada (criterio de `docs/adicionales/sdd-metodologia.md`); los indicadores de Sprint 3 (HU-H-03 y HU-H-04) se agregarán como secciones nuevas al final de la §2.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("indicadores:leer")` (Regla N.° 10). **Permiso nuevo, exclusivo de GERENTE** (matriz en `spec_modulo_A.md` §2.4). Mesa de Entrada, Profesor y Alumno reciben `403 SIN_PERMISO`.
- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/indicadores.types.ts`, services en `src/server/indicadores/indicadores.service.ts`, schemas Zod en `src/server/indicadores/indicadores.schema.ts` y Route Handler en `app/api/indicadores/route.ts`. Sin `actions.ts`: el módulo es de solo lectura y el frontend llama al Route Handler. Imports siempre con el alias `@/`.
- **Zona horaria:** todos los meses se calculan en `America/Argentina/Buenos_Aires`.

---

### 2.1. Turnos por mes y alumnos nuevos por mes (HU-H-01, HU-H-02) — REEMPLAZADA en Revisión 2

> **Reemplazada por 2.2 y 2.3 (Revisión 2, 01/10/2026).** Se conserva como historial. `GET /api/indicadores`, `obtenerIndicadoresMensuales()`, `contarTurnosPorMes()` (C) y `contarAlumnosNuevosPorMes()` (B) ya no existen en el código.

**Ruta:** `GET /api/indicadores`
**Server Action equivalente:** — (solo Route Handler; módulo de solo lectura)
**Servicio:** `obtenerIndicadoresMensuales()` en `src/server/indicadores/indicadores.service.ts`
**Permiso requerido:** `indicadores:leer`
**Pantalla:** "Indicadores" (nueva, mapa de pantallas §2). Página completa; dos gráficos con **un solo selector de rango** para ambos.

```typescript
// src/server/indicadores/indicadores.schema.ts
const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato de mes inválido (AAAA-MM)");

export const IndicadoresQuerySchema = z.object({
  desde: mesSchema.optional(), // por defecto: 5 meses antes del mes actual (rango de 6 meses)
  hasta: mesSchema.optional(), // por defecto: el mes actual
}).refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
  message: "El mes desde no puede ser posterior al mes hasta", path: ["desde"],
}).refine((q) => q.hasta || !q.desde || q.desde <= mesActual(), {
  // solo `desde`: `hasta` es el mes actual, y un `desde` posterior dejaría un rango invertido
  message: "El mes desde no puede ser posterior al mes actual", path: ["desde"],
});
// mesActual(): mes de hoy en America/Argentina/Buenos_Aires, formato AAAA-MM (helper de indicadores.service.ts)
export type IndicadoresQuery = z.infer<typeof IndicadoresQuerySchema>;
```

**Comportamiento esperado:**
1. **Rango por defecto (AC1 de ambas HU):** los últimos **6 meses incluyendo el actual**. Si solo viene `hasta`, `desde` es 5 meses antes; si solo viene `desde`, `hasta` es el mes actual (y si ese `desde` es posterior al mes actual, `400` "El mes desde no puede ser posterior al mes actual").
2. **Rango ajustable:** cualquier rango `[desde, hasta]` con `desde ≤ hasta` (HU-H-01 AC3). **Tope de 24 meses**: si lo excede, `400` con el mensaje "El rango máximo es de 24 meses". **Ratificado por el PO (29/09/2026) — Q8**. Se permiten meses futuros (hay turnos programados a futuro: hasta 30 días los que se configuran de a uno, `ANTICIPACION_MAXIMA_DIAS`, y hasta `generacion_maxima_meses` —6 meses— los que genera `spec_modulo_C.md` §2.9); las altas de alumnos de esos meses son 0.
3. Generar la lista de meses del rango, **todos** — un mes sin datos **se muestra con valor 0**, nunca se omite (HU-H-01 AC4, HU-H-02 AC3).
4. **Turnos por mes** — invocar `contarTurnosPorMes(desde, hasta, db?)` (Módulo C, `spec_modulo_C.md` §2.15). Contrato de la llamada, según C §2.15: `desde` y `hasta` son meses `AAAA-MM` y los **límites son inclusivos** (desde el primer día de `desde` hasta el último día de `hasta`); devuelve `{ mes: "AAAA-MM", cantidad }[]`, **solo los meses con datos**. Reglas de conteo, ya resueltas en ese servicio:
   - Se agrupan por el **mes de la fecha del turno** (`fechaTurno`), **no** por la fecha de creación (HU-H-01 AC1).
   - Cuentan los turnos `DISPONIBLE`, `COMPLETO` y `CANCELADO`. **Los `PENDIENTE` no se cuentan**: todavía no representan una clase real (AC2).
5. **Alumnos por mes** — invocar `contarAlumnosNuevosPorMes(desde, hasta, db?)` (Módulo B, `spec_modulo_B.md` §2.8), con el mismo formato (`AAAA-MM`, límites inclusivos) y el mismo resultado (`{ mes, cantidad }[]`, solo meses con datos). Reglas de conteo, ya resueltas en ese servicio:
   - Se agrupan por la **fecha de alta de la ficha** (`createdAtAlumno`, un timestamp) convertida a `America/Argentina/Buenos_Aires`, no a UTC: un alta a las 22:00 del 30 de septiembre en Salta pertenece a septiembre, aunque en UTC ya sea octubre.
   - Se cuentan **todas** las fichas dadas de alta en el mes, **activas o inactivas, con o sin cuenta de acceso vinculada** (HU-H-02 AC2). Es un conteo simple: no distingue por otro criterio (AC5).
6. Combinar ambas series sobre la misma lista de meses. Los dos servicios devuelven solo los meses con datos (sin ceros): completar con `0` es responsabilidad de este módulo.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "rango": { "desde": "2026-04", "hasta": "2026-09", "meses": 6 },
    "meses": [
      { "mes": "2026-04", "turnos": 0,  "alumnos_nuevos": 3 },
      { "mes": "2026-05", "turnos": 12, "alumnos_nuevos": 5 },
      { "mes": "2026-09", "turnos": 27, "alumnos_nuevos": 8 }
    ]
  },
  "error": null
}
```
`mes` es siempre `AAAA-MM` (estable, ordenable); el nombre legible ("septiembre 2026") lo arma la UI con `Intl.DateTimeFormat("es-AR")`.

**Errores esperados:** `400` (validación Zod con `flatten()`, o rango > 24 meses) · `403 SIN_PERMISO`.

**Frontend:**
- Un único selector de rango (dos selectores de mes, "Desde" y "Hasta", con el rango por defecto precargado) que actualiza **ambos** gráficos.
- Dos gráficos de barras, uno por indicador. Los colores salen de los tokens `--chart-1` y `--chart-2` (`docs/DESIGN.md` §2): **prohibido** usar colores hex o de la paleta por defecto de Tailwind.
- **Accesibilidad:** cada barra lleva su valor en texto (etiqueta de dato o tabla alternativa), no depende solo del color.
- Un mes con valor 0 se dibuja con altura 0 pero conserva su etiqueta en el eje.
- Sin datos en todo el rango: los gráficos se muestran igual con todos los meses en 0, más un texto de apoyo "No hay datos para el período seleccionado".
- **Librería de gráficos:** `docs/DESIGN.md` define los tokens `--chart-*` pero no fija la librería. Recomendación: el componente `chart` de shadcn/ui (basado en Recharts). Si el equipo prefiere otra, se documenta en la task.

---

### Convenciones comunes a 2.2 y 2.3 (Revisión 2)

```typescript
// src/server/indicadores/indicadores.schema.ts
export const RangoIndicadoresQuerySchema = z.object({
  desde: mesSchema.optional(), // AAAA-MM. Por defecto: 5 meses antes de `hasta` (6 meses incluyendo el actual)
  hasta: mesSchema.optional(), // AAAA-MM. Por defecto: el mes actual en America/Argentina/Buenos_Aires
}).superRefine(/* desde ≤ hasta; un `desde` solo no puede ser posterior al mes actual; tope de 24 meses */);
export type RangoIndicadoresInput = z.infer<typeof RangoIndicadoresQuerySchema>;
```

- Se mantienen las mismas reglas de rango que en 2.1 (pasos 1 y 2): 6 meses por defecto incluyendo el actual, tope de 24 (Q8) y mensajes iguales.
- **Validación:** un query inválido devuelve `400` con `{ data: null, error: { code: "VALIDATION_ERROR", message: "Parámetros inválidos", detalles: <flatten()> } }`. El código `VALIDATION_ERROR` es el de la task, y en el proyecto conviven `VALIDACION` y `VALIDATION_ERROR`.
- **Permiso:** `withPermission("indicadores:leer")`. Sin sesión → `401 SESION_INVALIDA`; con sesión y sin permiso → `403 SIN_PERMISO`.
- **Respuesta:** `data` es un arreglo con **todos** los meses del rango, en orden cronológico, con clave `mes` en formato `AAAA-MM`. El primer y el último elemento son el rango resuelto: el frontend los usa para precargar los selectores en la primera carga.

### 2.2. Ingresos cobrados por mes (HU-H-01 revisada) — NUEVA en Revisión 2

**Ruta:** `GET /api/indicadores/ingresos-por-mes?desde=AAAA-MM&hasta=AAAA-MM`
**Servicio:** `obtenerIngresosPorMes(rango: RangoIndicadoresInput)` en `src/server/indicadores/indicadores.service.ts`
**Consume:** `sumarPagosPorMes(desde, hasta, db?)` de `spec_modulo_I.md` §2.3
**Permiso requerido:** `indicadores:leer`

**Comportamiento esperado:**
1. Resolver el rango (convenciones comunes).
2. Pedir a Pagos la suma de `montoPago` agrupada por el mes de `fechaPago` (un `@db.Date`, así que el mes es su fecha calendario), con límites inclusivos.
3. Se consideran **todos** los pagos del período, sin distinguir forma de pago, turno ni estado del turno (AC3; ver Punto abierto P1).
4. Completar con `0` los meses sin pagos (AC2) y devolver en orden cronológico.
5. `total` es un `number` en pesos con hasta dos decimales. Pagos lo entrega como texto decimal exacto (`"450000.00"`) y H lo convierte con `Number()`. El valor máximo de `Decimal(11,2)` sumado en un mes sigue siendo exacto en coma flotante para dos decimales en los volúmenes del centro.

**Respuesta `200 OK`:**
```json
{ "data": [{ "mes": "2026-05", "total": 450000 }, { "mes": "2026-06", "total": 0 }], "error": null }
```

**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

### 2.3. Tasa de ocupación promedio por mes (HU-H-02 revisada) — NUEVA en Revisión 2

**Ruta:** `GET /api/indicadores/ocupacion-por-mes?desde=AAAA-MM&hasta=AAAA-MM`
**Servicio:** `obtenerOcupacionPromedioPorMes(rango: RangoIndicadoresInput)` en `src/server/indicadores/indicadores.service.ts`
**Consume:** `promediarOcupacionTurnosPorMes(desde, hasta, fechaMaxima, db?)` de `spec_modulo_C.md` §2.15
**Permiso requerido:** `indicadores:leer`

**Comportamiento esperado:**
1. Resolver el rango (convenciones comunes) y la fecha de hoy en `America/Argentina/Buenos_Aires` (`fechaMaxima`, `AAAA-MM-DD`).
2. **Turnos elegibles:** estado `DISPONIBLE` o `COMPLETO`, `cupoMaximoTurno` no nulo y mayor que cero (tienen aula asignada), `fechaTurno` dentro del rango **y `fechaTurno ≤ fechaMaxima`** (solo turnos ya dictados o del día; decisión de relevamiento). `CANCELADO` y `PENDIENTE` quedan excluidos (AC2).
3. Por turno: `ocupación = inscriptos / cupoMaximoTurno`, donde `inscriptos` es la cantidad de filas de `turno_alumno` del turno. Es el mismo criterio que el texto `"n/m"` del listado y el detalle (C §2.4).
4. Agrupar por mes de `fechaTurno` y promediar (promedio simple por turno, no ponderado por cupo).
5. Convertir a porcentaje y **redondear a 1 decimal** (AC4; ver P3). Completar con `0` los meses sin turnos elegibles (AC3), incluidos los meses futuros.

**Respuesta `200 OK`:**
```json
{ "data": [{ "mes": "2026-05", "ocupacion_promedio": 64.2 }, { "mes": "2026-06", "ocupacion_promedio": 71.8 }], "error": null }
```

**Errores esperados:** `400 VALIDATION_ERROR` · `401 SESION_INVALIDA` · `403 SIN_PERMISO`.

**Frontend (2.2 y 2.3, pantalla `/gerente`):**
- Arriba de ambos gráficos va un único control de rango: los dos selectores de mes "Desde" y "Hasta" que ya existían. Un cambio vuelve a pedir **los dos** endpoints.
- Dos `Card`, una por indicador, en grilla de 2 columnas en desktop y 1 en mobile. Mientras cargan, cada una muestra un `Skeleton` adentro.
- **Ingresos:** Bar Chart de serie simple, color `--chart-1`. **Ocupación:** Line Chart, color `--chart-2`, con una línea de referencia horizontal en la meta (P4) en `--muted-foreground`. Nunca se combinan en un mismo eje.
- Se usan `ChartContainer`, `ChartTooltip`/`ChartTooltipContent` y `ChartLegend`/`ChartLegendContent` de shadcn. El tooltip muestra el valor exacto: el monto en moneda local con `Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })` y el porcentaje con 1 decimal.
- **Sin datos en ambos indicadores** (todo el rango en 0): se reemplazan los gráficos por el mensaje "Todavía no hay suficientes datos para este período".
- La página verifica el permiso `indicadores:leer` (no el rol). Sin permiso redirige a `/sin-permiso` y sin sesión a `/login`, con `exigirPermiso("indicadores:leer")` de `with-permission.ts`. La task mencionaba `/no-autorizado`, pero esa ruta no existe.
- **Accesibilidad:** cada `Card` incluye una tabla visualmente oculta con los valores por mes, igual que el gráfico de la Revisión 1, para no depender solo del color ni del hover.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/indicadores/indicadores.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. El módulo no consulta tablas de otros módulos
Los datos vienen de servicios públicos de otros módulos. En la Revisión 1 eran `contarTurnosPorMes()` (`spec_modulo_C.md` §2.15) y `contarAlumnosNuevosPorMes()` (`spec_modulo_B.md` §2.8). **Desde la Revisión 2** son `sumarPagosPorMes()` (`spec_modulo_I.md` §2.3) y `promediarOcupacionTurnosPorMes()` (`spec_modulo_C.md` §2.15). Cualquier indicador futuro se agrega pidiendo una función pública nueva al módulo dueño del dato, nunca con un `SELECT` directo.

### 3.2. El mes de un turno es el de su fecha, no el de su creación
Un turno creado en septiembre para una clase en octubre cuenta en octubre. `CANCELADO` **sí** cuenta (el turno se registró): es una decisión de negocio explícita de HU-H-01 AC2 y contrasta con los calendarios, que lo excluyen. *(Revisión 2: el criterio del mes sigue vigente para la ocupación. La inclusión de `CANCELADO` aplicaba solo al conteo de 2.1 y queda reemplazada por 3.6.)*

### 3.3. Los meses sin datos se muestran con cero
La lista de meses se genera en este módulo; los servicios de conteo no devuelven ceros. Omitir un mes sin datos rompería la lectura del gráfico.

### 3.4. Zona horaria consistente
El mes de un `@db.Date` (turno) es su propia fecha calendario. El mes de un timestamp (alta de alumno) se calcula en `America/Argentina/Buenos_Aires`. Las consultas usan `$queryRaw` parametrizado (`Prisma.sql`), nunca SQL concatenado.

### 3.5. Solo lectura
El módulo no crea, modifica ni transiciona ningún dato. Por eso no aplica la Regla N.° 2 (trazabilidad de mutaciones) y no emite eventos.

### 3.6. Qué turnos cuentan para la ocupación (Revisión 2)
Solo `DISPONIBLE` y `COMPLETO` con cupo asignado (`cupoMaximoTurno > 0`) y `fechaTurno ≤ hoy` en Buenos Aires. `CANCELADO` no representa una clase dictada; `PENDIENTE` todavía no tiene cupo. Un turno futuro todavía no se dictó y su inscripción puede cambiar, así que contarlo distorsionaría la lectura de "qué se ocupó".

### 3.7. Qué pagos cuentan como ingreso (Revisión 2)
Todos los `Pago` con `fechaPago` en el mes, sin filtrar por forma de pago ni por el estado actual del turno. Un pago es un hecho consumado (Regla N.° 8, I §3.6): el dinero se cobró aunque el turno se haya cancelado después. Es la propuesta por defecto de la task; la ratificación está pendiente con el PO (P1).

### 3.8. Redondeo (Revisión 2)
Los servicios de C e I entregan valores sin redondear: el promedio como razón 0–1 y la suma como texto decimal exacto. El redondeo a 1 decimal del porcentaje se hace una sola vez, en H, con la mitad hacia arriba (igual que `ROUND` de PostgreSQL), para que el tooltip y la tabla accesible muestren el mismo número. **Nota de sincronización (01/10/2026, detectada en el contraste SQL de nivel 3):** con `AVG` sobre `float8` el resultado dependía del orden de suma, y un 38,75% salía 38,7 o 38,8 según el rango consultado. Por eso C promedia en `numeric` y H elimina el ruido binario (`toPrecision(12)`) antes de `Math.round`.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Este módulo no usa ni la opción (a) (columnas de auditoría) ni la opción (b) (tabla de eventos) de la Regla N.° 2: es exclusivamente de lectura, no tiene tablas propias, no muta ningún dato y por lo tanto no hay mutaciones que trazar ni eventos de dominio que emitir (misma conclusión que `spec_modulo_J.md` §4).

---

## 5. Decisiones registradas

| # | Punto | Dónde impacta | Quién resuelve | Decisión contractualizada |
|---|---|---|---|---|
| Q8 | ¿Tope de meses del rango? | 2.1 paso 2 | PO | 24 meses — **ratificado 29/09/2026** |
| — | Librería de gráficos | Frontend | Equipo, en la task | Componente `chart` de shadcn/ui (instalado en la Revisión 2, con `recharts`) |
| R2-a | Ruta de la pantalla | Frontend | Implementador, confirmado en relevamiento (01/10/2026) | Se mantiene `/gerente` |
| R2-b | Granularidad del rango | Convenciones 2.2/2.3 | Ídem | Por mes, tope de 24 (Q8) |
| R2-c | Turnos futuros en la ocupación | 2.3, 3.6 | Ídem | Excluidos (`fechaTurno ≤ hoy`), se mide con inscriptos |
| R2-d | Server Actions | 2.2, 2.3 | Ídem | No se agregan |

**Puntos abiertos para el PO (Revisión 2, se implementó la propuesta por defecto de la task y quedan pendientes de ratificación):**
| # | Punto | Implementado provisoriamente |
|---|---|---|
| P1 | ¿Se excluyen los pagos de turnos cancelados después? | No se excluyen (3.7) |
| P3 | Redondeo de la ocupación | 1 decimal (3.8) |
| P4 | Meta de referencia del Line Chart | 80%, constante `META_OCUPACION_PORCENTAJE` en el frontend (no es configurable) |
| P5 | KPI cards de variación % | Fuera de alcance |
```
