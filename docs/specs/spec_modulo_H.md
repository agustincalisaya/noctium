# Especificación Técnica — Módulo H (Indicadores / Dashboard)
## Noctium — Sprint 2

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth · shadcn/ui (`chart-*` de `docs/DESIGN.md`)
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 3, 4, 5, 6, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` (Alumno, §2.8) · `spec_modulo_C.md` Revisión 5 (Turno, §2.15, estado `CANCELADO`) · `schema.prisma` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§2, "Indicadores") · `docs/DESIGN.md` (§2 tokens `--chart-1` a `--chart-5`)

**HU contractualizadas en esta revisión:** HU-H-01 (Ver cantidad de turnos por mes), HU-H-02 (Ver cantidad de alumnos por mes) — Sprint 2. Es la **primera revisión** del módulo: no existía `spec_modulo_H.md`.

**Fuera de alcance de esta spec (explícito):**
- Indicadores por materia (HU-H-03) y por profesor (HU-H-04), de Sprint 3.
- Ocupación, pagos y rendimiento (mencionados en el mapa de historias inicial): no forman parte de Sprint 2.
- Exportar, imprimir o programar el envío de los indicadores.
- Cualquier escritura: el módulo es **exclusivamente de lectura**.

---

## 1. Visión General

El Módulo H es la pantalla **"Indicadores"** del Gerente: **una sola pantalla con dos indicadores** (turnos por mes y alumnos nuevos por mes), no dos pantallas (mapa de pantallas §2). Es de solo lectura, no tiene tablas propias y no emite eventos.

Principio de diseño: **el módulo compone, no calcula**. No consulta `turnos` ni `alumnos` (Regla N.° 3): pide los conteos a los servicios públicos de Turnos (`spec_modulo_C.md` §2.15) y de Alumnos (`spec_modulo_B.md` §2.8), completa los meses sin datos con cero y da formato a la respuesta. Por eso un único endpoint devuelve ambas series: comparten un selector de rango (HU-H-02 AC4) y un único cálculo de los meses del rango.

Implementación estándar: Route Handler delgado que delega en `src/server/indicadores/indicadores.service.ts` (Reglas N.° 4 y 11).

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta requiere `withPermission("indicadores:leer")` (Regla N.° 10). **Permiso nuevo, exclusivo de GERENTE** (matriz en `spec_modulo_A.md` §2.4). Mesa de Entrada, Profesor y Alumno reciben `403 SIN_PERMISO`.
- Ubicación de archivos (Regla N.° 11): `src/types/indicadores.types.ts`, `src/server/indicadores/indicadores.service.ts`, `src/server/indicadores/indicadores.schema.ts`, Route Handler en `app/api/indicadores/route.ts`.
- **Zona horaria:** todos los meses se calculan en `America/Argentina/Buenos_Aires`.

---

### 2.1. Turnos por mes y alumnos nuevos por mes (HU-H-01, HU-H-02)

**Ruta:** `GET /app/api/indicadores/route.ts`
**Servicio:** `indicadores.service.ts` → `obtenerIndicadoresMensuales()`
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
});
export type IndicadoresQuery = z.infer<typeof IndicadoresQuerySchema>;
```

**Comportamiento esperado:**
1. **Rango por defecto (AC1 de ambas HU):** los últimos **6 meses incluyendo el actual**. Si solo viene `hasta`, `desde` es 5 meses antes; si solo viene `desde`, `hasta` es el mes actual.
2. **Rango ajustable:** cualquier rango `[desde, hasta]` con `desde ≤ hasta` (HU-H-01 AC3). **Tope de 24 meses**: si lo excede, `400` con el mensaje "El rango máximo es de 24 meses". **[DEFAULT DEL SM — Q8, sin respuesta del PO al 28/09: se implementa esto salvo objeción]**. Se permiten meses futuros (hay turnos programados hasta 30 días adelante); las altas de alumnos de esos meses son 0.
3. Generar la lista de meses del rango, **todos** — un mes sin datos **se muestra con valor 0**, nunca se omite (HU-H-01 AC4, HU-H-02 AC3).
4. **Turnos por mes** — invocar `contarTurnosPorMes(desde, hasta)` (Módulo C, §2.15). Reglas de conteo, ya resueltas en ese servicio:
   - Se agrupan por el **mes de la fecha del turno** (`fechaTurno`), **no** por la fecha de creación (HU-H-01 AC1).
   - Cuentan los turnos `DISPONIBLE`, `COMPLETO` y `CANCELADO`. **Los `PENDIENTE` no se cuentan**: todavía no representan una clase real (AC2).
5. **Alumnos por mes** — invocar `contarAlumnosNuevosPorMes(desde, hasta)` (Módulo B, `spec_modulo_B.md` §2.8). Reglas de conteo, ya resueltas en ese servicio:
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

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica reside en `src/server/indicadores/indicadores.service.ts` (Regla N.° 4).

### 3.1. El módulo no consulta tablas de otros módulos
Los conteos vienen de los servicios públicos `contarTurnosPorMes()` (`spec_modulo_C.md` §2.15) y `contarAlumnosNuevosPorMes()` (`spec_modulo_B.md` §2.8). Cualquier indicador futuro se agrega pidiendo una función pública nueva al módulo dueño del dato, nunca con un `SELECT` directo.

### 3.2. El mes de un turno es el de su fecha, no el de su creación
Un turno creado en septiembre para una clase en octubre cuenta en octubre. `CANCELADO` **sí** cuenta (el turno se registró): es una decisión de negocio explícita de HU-H-01 AC2 y contrasta con los calendarios, que lo excluyen.

### 3.3. Los meses sin datos se muestran con cero
La lista de meses se genera en este módulo; los servicios de conteo no devuelven ceros. Omitir un mes sin datos rompería la lectura del gráfico.

### 3.4. Zona horaria consistente
El mes de un `@db.Date` (turno) es su propia fecha calendario. El mes de un timestamp (alta de alumno) se calcula en `America/Argentina/Buenos_Aires`. Las consultas usan `$queryRaw` parametrizado (`Prisma.sql`), nunca SQL concatenado.

### 3.5. Solo lectura
El módulo no crea, modifica ni transiciona ningún dato. Por eso no aplica la Regla N.° 2 (trazabilidad de mutaciones) y no emite eventos.

---

## 4. Eventos de Dominio (EDA)

Este módulo **no emite eventos de dominio**: es exclusivamente de lectura (misma conclusión que `spec_modulo_J.md` §4).

---

## 5. Puntos abiertos

| # | Punto | Dónde impacta | Quién resuelve | Propuesta contractualizada |
|---|---|---|---|---|
| Q8 | ¿Tope de meses del rango? | 2.1 paso 2 | PO | 24 meses |
| — | Librería de gráficos | Frontend | Equipo, en la task | Componente `chart` de shadcn/ui |
