# TASK: HU-H-01 y HU-H-02 (revisión Sprint 2) — Indicadores de Gerente: Ingresos cobrados y Tasa de ocupación

**Módulo:** H (Indicadores)
**Dueño funcional (actor):** Gerente
**Implementa:** Cali
**Sprint:** 2
**Story Points:** 5 (estimado — reemplaza los 2 SP de las HU-H-01/H-02 originales; sube por la agregación cruzada con Pagos y Turnos, y por no existir aún `spec_modulo_H.md`)
**Spec de referencia:** `docs/specs/spec_modulo_H.md` — **no existe todavía**; se crea en el Paso 0 de esta task, según `docs/adicionales/sdd-metodologia.md` ("si no existe, se crea con la Visión General y la primera sección de Interfaces antes de tocar código"). Referencias cruzadas a `spec_modulo_C.md` (Turno: `cupo_maximo`, alumnos inscriptos, estados) — tampoco existe aún un `spec_modulo_I.md` formal para Pagos.

**Reemplaza:** las HU-H-01 ("Ver cantidad de turnos por mes") y HU-H-02 ("Ver cantidad de alumnos por mes") definidas en `docs/tasks/Sprint 2/HU-Sprint-2.md`, ítems 24–25. Decisión de PO: 01/10/2026.

---

## 0. Paso 0 para el implementador (relevamiento previo — obligatorio antes de codear)

1. Crear `docs/specs/spec_modulo_H.md` con Visión General + primera sección de Interfaces (el contrato de los dos endpoints de esta task), siguiendo `_template-spec-modulo.md`.
2. `grep -n "model Pago" prisma/schema.prisma` — confirmar nombre exacto de los campos de monto y fecha (se asume `monto` y `fecha` según lo narrado en `guion-demo-sprint-2.md`, pero no hay spec formal del módulo I que lo contractualice).
3. `grep -n "model Turno" prisma/schema.prisma` — confirmar nombre exacto de `cupo_maximo` (o equivalente), la relación con alumnos inscriptos, y el enum de estados (`DISPONIBLE`, `COMPLETO`, `CANCELADO`, `PENDIENTE`).
4. `grep -rn "cupoMaximoTurno\|alumnos_inscriptos" src/` — ver cómo se calcula hoy la ocupación de un turno para el listado (HU-C-01), y reutilizar el mismo criterio en vez de duplicar lógica.
5. Confirmar si ya existe un permiso de este módulo (de cuando se diseñaron las H-01/H-02 originales) antes de crear uno nuevo.
6. Reportar archivos a crear/modificar y esperar confirmación explícita antes de implementar.

---

## 1. Nota de alcance

Esta task reemplaza, dentro del mismo Sprint 2 y la misma pantalla "Indicadores" (`mapa-pantallas-sprint-2.md`), los dos indicadores originalmente aprobados. No agrega una pantalla nueva — sigue siendo una única pantalla para el rol Gerente, con un selector de rango de fechas compartido entre ambos indicadores.

**Impacto en otros documentos (a resolver antes del cierre de sprint, fuera del código de esta task):**
- `docs/adicionales/guion-demo-sprint-2.md`, Paso 6: el guion hablado de Adriel cita textualmente "turnos por mes" y "alumnos nuevos por mes" — debe reescribirse para citar Ingresos y Ocupación.
- Checklist de datos de prueba del mismo documento (punto 6): pedir datos de pagos y de ocupación variada entre meses, no solo "turnos de varios meses".

**Fuera de alcance de esta task (explícito):**
- Desglose por profesor o por materia (sigue siendo HU-H-03/H-04, Sprint 3).
- Cualquier cambio a HU-I-01 (Registrar pago) o a `spec_modulo_C.md` — esta task solo **lee** esos datos.
- KPI cards de variación % respecto al período anterior (ver Punto abierto 5).

---

## 2. Historias de Usuario

### HU-H-01 (revisada) — Ingresos cobrados por mes

**Como** Gerente
**Necesito** ver el total cobrado por mes en los últimos N meses
**Para** evaluar la salud financiera del centro sin pedir un reporte aparte

**Criterios de aceptación:**
1. La pantalla "Indicadores" muestra el total de `Pago.monto` agrupado por el mes de `Pago.fecha`, para el rango seleccionado (por defecto los últimos 6 meses incluyendo el actual).
2. Si un mes del rango no tiene pagos registrados, se muestra igual con valor $0 (no se omite el mes).
3. Se consideran todos los pagos registrados en el período, sin distinguir forma de pago ni turno asociado (ver Punto abierto 1).
4. El rango de meses es el mismo selector compartido con HU-H-02 (revisada) — una sola pantalla, un solo control de rango para ambos indicadores.

### HU-H-02 (revisada) — Tasa de ocupación promedio por mes

**Como** Gerente
**Necesito** ver qué porcentaje promedio de cupo se ocupó en los turnos dictados cada mes
**Para** decidir si conviene abrir o cerrar comisiones

**Criterios de aceptación:**
1. La pantalla "Indicadores" muestra, junto al gráfico de Ingresos, el promedio mensual de `alumnos_inscriptos / cupo_maximo` sobre los turnos en estado Completo o Disponible (con aula asignada) del mes correspondiente a la fecha del turno.
2. Los turnos Cancelado y Pendiente no se incluyen en el cálculo — Cancelado porque no representa ocupación real dictada, Pendiente porque todavía no tiene cupo asignado.
3. Si un mes no tiene turnos elegibles, se muestra con valor 0% (no se omite el mes).
4. El resultado se expresa como porcentaje con un decimal (ej. "68.3%").
5. Mismo rango de meses y mismo selector que HU-H-01 (revisada).

**Justificación de secuencia:** ambas dependen de datos ya existentes desde Sprint 1 (Turno con `cupo_maximo`) y Sprint 2 (HU-I-01, Registrar pago) — no agregan modelo de datos nuevo, solo agregación de lectura.

---

## 3. Alcance de esta task

Implementación backend + frontend conforme al nuevo `spec_modulo_H.md` (creado en el Paso 0). Incluye:
- Servicio `src/lib/services/indicadores/indicadores.service.ts`:
  - `obtenerIngresosPorMes(desde, hasta)`
  - `obtenerOcupacionPromedioPorMes(desde, hasta)`
- Route Handlers `GET /api/indicadores/ingresos-por-mes` y `GET /api/indicadores/ocupacion-por-mes`.
- Server Actions equivalentes en `app/(dashboard)/indicadores/actions.ts`.
- Schema Zod del query param de rango (`desde`, `hasta`).
- Pantalla `app/(dashboard)/indicadores/page.tsx` con los dos gráficos y el selector de rango.

**Fuera de alcance de esta task:**
- Nuevo modelo de datos o migración (se agrega sobre tablas existentes).
- Emisión de evento de dominio: no corresponde — es un endpoint de solo lectura, sin efecto en el estado del sistema.

---

## 4. Contrato Backend

### 4.1. Schema Zod — rango de fechas compartido

**Archivo:** `lib/schemas/indicadores.schema.ts`

```typescript
export const RangoIndicadoresQuerySchema = z.object({
  desde: z.coerce.date().optional(), // default: hoy - 6 meses, calculado en el servicio
  hasta: z.coerce.date().optional(), // default: hoy
}).refine((d) => !d.desde || !d.hasta || d.desde <= d.hasta, {
  message: "desde no puede ser posterior a hasta",
});
export type RangoIndicadoresInput = z.infer<typeof RangoIndicadoresQuerySchema>;
```

### 4.2. Servicio — Ingresos por mes

**Archivo:** `lib/services/indicadores/indicadores.service.ts`
**Función:** `obtenerIngresosPorMes(desde: Date, hasta: Date): Promise<{ mes: string; total: number }[]>`

Comportamiento:
1. Agrupar `Pago` por mes de `fecha` (`date_trunc('month', fecha)` o equivalente Prisma) dentro de `[desde, hasta]`.
2. Sumar `monto` por grupo.
3. Completar con $0 los meses del rango sin filas (no delegarlo al frontend).
4. Devolver ordenado cronológicamente.

**Errores de servicio a definir:** ninguno esperado — `desde > hasta` queda cubierto por el `.refine()` del schema, `400 VALIDATION_ERROR`.

### 4.3. Servicio — Ocupación promedio por mes

**Función:** `obtenerOcupacionPromedioPorMes(desde: Date, hasta: Date): Promise<{ mes: string; ocupacion_promedio: number }[]>`

Comportamiento:
1. Traer `Turno` con estado `DISPONIBLE` o `COMPLETO` y `cupo_maximo` no nulo, cuya `fecha` caiga en `[desde, hasta]`.
2. Por turno: `ocupacion = alumnos_inscriptos / cupo_maximo`.
3. Agrupar por mes de `Turno.fecha` y promediar.
4. Completar con 0% los meses sin turnos elegibles.
5. Redondear a 1 decimal (ver Punto abierto 3).

### 4.4. Route Handlers

| Ruta | Método | Permiso |
|---|---|---|
| `GET /api/indicadores/ingresos-por-mes` | GET | `withPermission("indicadores:leer")` |
| `GET /api/indicadores/ocupacion-por-mes` | GET | `withPermission("indicadores:leer")` |

**RBAC:** se asume que `indicadores:leer` ya existe o se crea asignado únicamente al rol Gerente — **confirmar en Paso 0** si ya existe un permiso de este módulo desde las HU-H-01/H-02 originales, para no duplicarlo.

**Respuesta `200 OK` (ingresos):**
```json
{ "data": [{ "mes": "2026-05", "total": 450000 }, { "mes": "2026-06", "total": 512000 }], "error": null }
```

**Respuesta `200 OK` (ocupación):**
```json
{ "data": [{ "mes": "2026-05", "ocupacion_promedio": 64.2 }, { "mes": "2026-06", "ocupacion_promedio": 71.8 }], "error": null }
```

### 4.5. Server Actions

**Archivo:** `app/(dashboard)/indicadores/actions.ts`
**Funciones:** `obtenerIngresosPorMesAction()`, `obtenerOcupacionPromedioPorMesAction()` — wrappers delgados (validar sesión + rol Gerente, invocar servicio).

### 4.6. Trazabilidad / Auditoría

No aplica (Regla N.° 2 de `RULES.md` es para escritura; esta task es de solo lectura).

---

## 5. Frontend

### 5.1. Pantalla

`app/(dashboard)/indicadores/page.tsx` — reemplaza el contenido que hubiera para H-01/H-02 originales. Sin permiso `indicadores:leer` → `redirect("/no-autorizado")`.

- Un único control de rango de fechas (Date Range Picker de shadcn) arriba de ambos gráficos, afectando a los dos a la vez.
- Dos `Card`, una por indicador, en grilla de 2 columnas en desktop / 1 columna en mobile.
- Estado de carga: `Skeleton` dentro de cada `Card` mientras resuelve.
- Estado vacío: si el rango no tiene datos en ninguno de los dos indicadores, mensaje "Todavía no hay suficientes datos para este período" en vez de un gráfico en cero.

### 5.2. Gráficos — sección específica (tipo de chart por indicador)

No usar un tipo de gráfico genérico por defecto: cada indicador tiene una forma de lectura distinta.

| Indicador | Componente shadcn/ui | Color (token `DESIGN.md`) | Justificación |
|---|---|---|---|
| **Ingresos cobrados por mes** | **Bar Chart** (serie simple) | `--chart-1` (azul petróleo) | Monto discreto por mes, no tendencia continua — la barra permite comparar montos exactos mes a mes de un vistazo. |
| **Tasa de ocupación promedio** | **Line Chart**, con línea de referencia horizontal (meta, ver Punto abierto 4) | `--chart-2` (acento) para la serie; `--muted-foreground` para la línea de referencia | Porcentaje continuo donde importa la tendencia (¿sube o baja mes a mes?) — la línea comunica mejor la dirección que una barra. |

- Ambos gráficos van en `Card` separadas — nunca combinados en un mismo eje Y (unidades distintas: pesos vs. porcentaje).
- Tooltip de cada gráfico debe mostrar el valor exacto (monto formateado en moneda local / porcentaje con 1 decimal).
- Reutilizar `ChartContainer`, `ChartTooltip` y `ChartLegend` de shadcn, no reimplementar tooltips a mano.

**Fuera de alcance de frontend:** KPI cards de variación % (Punto abierto 5) y gráfico Radial de ocupación "snapshot del mes actual" — quedan para una iteración futura si el PO lo prioriza.

---

## 6. Testing (tres niveles)

### Nivel 1 — Unitarios
- `obtenerIngresosPorMes`: rango con pagos en todos los meses; rango con un mes sin pagos (debe devolver $0, no omitir el mes); `desde > hasta` → error de validación.
- `obtenerOcupacionPromedioPorMes`: turnos Completo/Disponible promediados correctamente; turnos Cancelado y Pendiente excluidos (fixture con ambos, confirmar que no alteran el promedio); mes sin turnos elegibles → 0%.
- `withPermission("indicadores:leer")` presente en ambas rutas.

### Nivel 2 — Postman
| # | Caso | Esperado |
|---|---|---|
| 1 | Ingresos, rango con datos | `200`, array con un total por mes, meses sin pagos en $0 |
| 2 | Ocupación, rango con datos | `200`, array con `ocupacion_promedio` por mes |
| 3 | Rango inválido (`desde > hasta`) | `400 VALIDATION_ERROR` |
| 4 | Usuario sin rol Gerente | `403` |
| 5 | Sin sesión | `401` |

### Nivel 3 — BD
```sql
-- Ingresos: suma manual de contraste
SELECT date_trunc('month', fecha) AS mes, SUM(monto) FROM pagos
WHERE fecha BETWEEN :desde AND :hasta GROUP BY 1 ORDER BY 1;

-- Ocupación: promedio manual de contraste
SELECT date_trunc('month', fecha) AS mes, AVG(alumnos_inscriptos::float / cupo_maximo) AS ocupacion
FROM turnos
WHERE estado IN ('DISPONIBLE', 'COMPLETO') AND cupo_maximo IS NOT NULL
  AND fecha BETWEEN :desde AND :hasta GROUP BY 1 ORDER BY 1;
```

---

## 7. Puntos abiertos / Decisiones pendientes

1. **¿Los pagos de turnos luego cancelados se excluyen de "Ingresos cobrados"?** No hay spec de Pagos que lo defina. Propuesta por defecto: no se excluyen (el dinero se cobró, más allá de que el turno se cancele después) — confirmar con el PO.
2. **Nombre y existencia del permiso `indicadores:leer`.** Si las HU-H-01/H-02 originales ya crearon un permiso distinto, reutilizarlo en vez de duplicar (relevar en Paso 0).
3. **Redondeo de la tasa de ocupación.** Propuesto a 1 decimal; confirmar si el PO prefiere entero para simplificar la lectura.
4. **Meta de referencia en el Line Chart de ocupación.** Se propuso 80% como ilustrativa — ningún documento del proyecto define una meta real; confirmar o dejarla configurable.
5. **KPI cards de variación % vs. mes anterior:** fuera de alcance de esta task para mantener el diff acotado; candidata a HU futura.
6. **Actualización de `guion-demo-sprint-2.md`:** fuera del código de esta task, pero debe resolverse antes de la demo — asignar dueño.

---

## 8. Checklist de Definition of Done

- [ ] `spec_modulo_H.md` creado (Paso 0.1) con Visión General e Interfaz de estos dos endpoints.
- [ ] Relevamiento previo (Paso 0) confirmado antes de implementar.
- [ ] Lógica de agregación solo en `indicadores.service.ts`; rutas y actions como wrappers finos.
- [ ] Ambos endpoints responden `{ data, error }`, completan meses sin datos en 0.
- [ ] Turnos Cancelado y Pendiente excluidos del cálculo de ocupación (verificado con test).
- [ ] Gráficos implementados según la tabla 5.2 (Bar para ingresos, Line con referencia para ocupación), usando tokens de `DESIGN.md` — sin hex ni default de Tailwind.
- [ ] Selector de rango único, compartido entre ambos gráficos.
- [ ] Tests de los 3 niveles con evidencia.
- [ ] `docs/tasks/Sprint 2/HU-Sprint-2.md` actualizado: ítems 24–25 marcados como reemplazados, referenciando esta task.
- [ ] Puntos abiertos 1–4 comunicados al PO antes del cierre del sprint.
- [ ] PR con diff acotado exclusivamente a esta task.