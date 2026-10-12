# Validación PO — HU-H-06 · Panel de indicadores con pestañas y filtro de período

**Rama revisada:** `feature/prueba` @ `17f5daa` (la HU entró a `develop` con la PR #218).
**Fuente de verdad:** el texto de la HU pegado en el pedido de validación (no la task).
**Leído:** `prisma/schema.prisma`, `docs/RULES.md`, `docs/DESIGN.md` (incluida la nota «Series de indicadores — fidelidad del prototipo», 09/10/2026), `prisma/seed.ts`, `prisma/seed/fixtures/hu-h-06.ts` e `index.ts`, `docs/specs/spec_modulo_H.md` (Revisión 3, §2.4, §3.9–3.17 y la «Nota aditiva — fidelidad visual, 09/10/2026»), `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-H-06), `docs/tasks/Sprint 3/Modulo H/HU-H-06.md`, `docs/testing/Modulo H/hu-h-06/HU-H-06-evidencia.md`. No hay en `docs/` un documento técnico de developers del Sprint 3 aparte de las specs, `PR-0.md` y `HU-Sprint-3.md`.
**Aviso sobre el seed:** el árbol de trabajo tiene `prisma/seed.ts` **modificado y sin commitear** (+101 líneas: alumnos 41..52 y un «paso 13» de HU-I-10). No es de esta HU y no se tocó. Además, **el seed falla hoy (12/10/2026)** en el fixture de HU-E-02, que corre **antes** que el de HU-H-06 (ver sección 6).

**Pruebas corridas (sin modificar nada):**

| Qué | Resultado |
|---|---|
| `vitest run` completo (suite unitaria e interfaz) | **250 archivos / 3170 tests en verde**, 51 archivos (349 tests) PG omitidos por diseño, sin fallos |
| Tests propios de la HU dentro de esa corrida: `grafico-indicador.test.tsx`, `filtro-periodo.test.tsx`, `gerente/indicadores-client.test.tsx`, `api/indicadores/ocupacion-resumen/route.test.ts`, `indicadores.service.test.ts`, `indicadores.schema.test.ts`, rutas de ingresos y ocupación | En verde |
| `npm run test:pg -- src/server/indicadores` (base descartable) **con el reloj real** | `clases` y `presentismo`: 4/4 en verde. `cancelaciones.service.pg.test.ts`: **falla al sembrar** (`Error: Fixture E02 sin inscripción inicial`, `prisma/seed/fixtures/hu-e-02.ts:52`) |
| Lo mismo con `SEED_FECHA_HOY=2026-10-09` | **3 archivos, 10/10 en verde** → la falla depende de la fecha (fechas fijas del fixture E02 que chocan con «hoy»), no del código de H-06 |
| `npx tsx scripts/verificar-claves-textos.ts` (comprobador HU-C-23) | «Claves de textos verificadas.» |

---

## 1. Trazabilidad de criterios

Archivos principales: `src/app/(dashboard)/gerente/page.tsx` (P), `src/app/(dashboard)/gerente/indicadores-client.tsx` (CLI), `src/components/indicadores/grafico-indicador.tsx` (GI), `graficos-indicadores.tsx` (GR), `filtro-periodo.tsx` (FP), `use-indicador.ts` (UI), `src/server/indicadores/indicadores.service.ts` / `.schema.ts`, `src/app/api/indicadores/*/route.ts`, textos en `src/lib/textos.ts` (`ui.indicadores.panel.*`).

| # | Criterio / viñeta | Dónde | Estado | Justificación |
|---|---|---|---|---|
| 1 | Pantalla «Indicadores» con pestañas Actividad (Ingresos cobrados, Tasa de ocupación, HU-H-03), Índice de Presentismo (H-07) y Cancelaciones (H-10); sin pestañas Pagos/Ocupación | CLI `PESTANAS` (l.10, 21-28); Actividad renderiza `GraficoIngresos`, `GraficoOcupacion`, `ClasesIndicadores`; Presentismo → `PanelPresentismo`; Cancelaciones → `CancelacionesIndicadores` | **CUBIERTO** | Tres pestañas con `role="tab"`, navegación con flechas/Home/End, Actividad inicial. No existen pestañas Pagos ni Ocupación |
| 2 | Filtro de período fijo arriba, aplica a todas las secciones; Desde–Hasta, 6 meses por defecto, máximo 24 | FP (`ajustarPeriodo`, 27 opciones = 23 atrás + 3 adelante); CLI l.14 (default `-5..actual`); servidor `RangoIndicadoresQuerySchema` (default 6, tope 24, `400 VALIDATION_ERROR`) | **CUBIERTO** | Si se invierte o supera 24, ajusta el otro extremo y avisa «El período máximo es de 24 meses.» (DEC-40). El filtro está arriba de las pestañas; ojo: es «fijo arriba» en el sentido de ubicación, **no** es `sticky` al desplazarse (aceptable según la spec) |
| 2 | Dentro del panel reemplaza al selector de rango propio de H-01/H-02 | GR: `GraficoIngresos`/`GraficoOcupacion` reciben `rango` y no tienen selectores | **CUBIERTO** | — |
| 2.a | Al cambiar de pestaña se conserva el período | `rango` vive en `IndicadoresClient` (estado del padre) | **CUBIERTO** | Test «conserva período y difiere pedidos al cambiar de pestaña». Al volver a una pestaña los datos se vuelven a pedir (se desmonta) — no es un problema |
| 2.b | Leyenda de cada gráfico indica qué fecha usa | `ui.indicadores.panel.leyendaIngresos`, `.leyendaOcupacion`, `ui.indicadores.clases.leyendaMateria`, `.leyendaProfesor`, `ui.indicadores.presentismo.leyenda`, `.ordenMateria`, `ui.indicadores.cancelaciones.leyendaMes`, `.leyendaMateria` | **PARCIAL** | Lo dicen Ingresos («Por fecha de pago…»), Ocupación («Por fecha de la clase…»), Clases por materia y Cancelaciones por mes. **No lo dicen 4 gráficos:** Clases por profesor («Horas: duración de sus clases Disponibles y Completas.»), Inscriptos vs. presentes por mes («Clases dictadas con asistencia individual. Sobre cada par, los ausentes.»), Presentismo por materia («De menor a mayor índice de presentismo») y Cancelaciones por materia («Las bajas no se incluyen.»). La spec §2.4.5 sí proponía la fecha para todos |
| 2.b | Ingresos: por fecha de pago, monto vigente, sin anulados (HU-I-06) | `obtenerIngresosPorMes` → `sumarPagosPorMes` (`pago.publico.ts:213`, `sqlFechaPagoVigente`, `sqlMontoVigente`, `sqlPagoNoAnulado`) | **CUBIERTO** | Leyenda: «Por fecha de pago · monto vigente, sin anulados.» HU-I-06 no tiene pantalla todavía: se prueba con el script de la sección 6 |
| 2.b | Ocupación = inscripciones vigentes (Reservadas no vencidas, Pagadas y Pago sin registrar) / cupo, en clases Disponibles y Completas del período | `promediarOcupacionTurnosPorMes` (`turno.publico.ts:339`, `sqlVigenteEn(ahora())`, `DISPONIBLE/COMPLETO`, `cupo > 0`) | **CUBIERTO (cálculo) / PARCIAL (leyenda)** | Cálculo correcto. La leyenda dice «inscripciones vigentes / cupo» pero **no enumera** «Reservadas no vencidas, Pagadas y Pago sin registrar», y **agrega «hasta hoy»**: la ocupación excluye las clases futuras (decisión R2-c / T3 de la spec, informada al PO como P-H3). La HU no menciona ese recorte → **DESVÍO documentado en la spec**, para que el PO lo ratifique |
| 2.c | Sin filtros globales por Materia/Profesor/Aula | CLI/FP | **CUBIERTO** | No existen |
| 3 | Se actualizan sin recargar al cambiar el período | UI: `useEffect` por `clave` (ruta+rango), `AbortController`, descarte de respuestas tardías por secuencia | **CUBIERTO** | Test «descarta respuesta de un período anterior» |
| 3 | Indicador de carga; ante error mensaje con «Reintentar» | GI l.68-69 (`Skeleton` con `role="status"`; `role="alert"` + botón «Reintentar»); `reintentar` por tarjeta | **CUBIERTO** | El reintento pide solo esa tarjeta (test). Detalle menor: si la respuesta no es JSON (p. ej. un 500 con HTML), `use-indicador.ts:23` muestra el `message` técnico del navegador en lugar del texto central |
| 4 | Gráfico sin datos → «No hay datos para el período seleccionado» y el resto visible | GI l.70; estados calculados por tarjeta en GR / componentes de H-03, H-07, H-10 | **CUBIERTO** | Ocupación decide «vacío» por `turnos === 0` del resumen (0 % con clases reales se muestra, test). «Clases por materia/profesor» usan su propio texto de HU-H-03 («No hay clases en el período seleccionado»), que la spec §2.4.4 permite |
| 5 | Valor de cada barra o punto escrito sobre él | GI l.82 (`LabelList` en barras); l.84 `Line` **sin** etiqueta | **PARCIAL** | Las barras muestran su valor. **Los puntos de la línea no**: el componente no soporta etiquetas en series `linea`, y la única línea del panel —el Índice de presentismo de «Inscriptos vs. presentes por mes»— no muestra el valor de cada punto (solo en tooltip y tabla) |
| 5 | Al pasar el cursor o tocar, el detalle | GI l.80 `ChartTooltip` con valor exacto (moneda / % con 1 decimal) | **CUBIERTO** | Recharts muestra el tooltip también al tocar; verificar en el celular |
| 5 | «Ver como tabla» con los mismos datos | GI l.63/65 (botón con `aria-pressed`) y l.91-93 (tabla siempre renderizada, `sr-only` cuando está oculta) | **CUBIERTO** | Test de tabla en `grafico-indicador.test.tsx` y en el cliente |
| 5 | Componente común con barras agrupadas + línea superpuesta, reutilizado por H-01, H-02, H-03, H-07, H-10 | `GraficoIndicador` (`ComposedChart`, `Bar`+`Line`, eje secundario %); usado en GR, `clases-indicadores.tsx`, `presentismo-indicadores.tsx`, `cancelaciones-indicadores.tsx` | **CUBIERTO** | — |
| 6 | Solo Gerente; el servidor rechaza con 403 a otros roles | P: `exigirPermiso("indicadores:leer")`; las 10 rutas `GET /api/indicadores/*` con `withPermission("indicadores:leer")`; seed: solo `["GERENTE","indicadores:leer"]` (`seed.ts:919`); proxy `/gerente/:path*` y `rutas-por-rol.ts: gerente: ["GERENTE"]` | **CUBIERTO** | Test 401/403 en `ocupacion-resumen/route.test.ts` y rutas hermanas |
| 7 | Gráficos primero, grilla de 2 columnas en ancho / 1 en angosto | CLI l.25 `grid-cols-1 lg:grid-cols-2`; ídem en H-07 y H-10 | **CUBIERTO** | — |
| 7 | Total en el encabezado; tasas, tablas y avisos debajo | GI l.62/65 (total + «en el período»); Ingresos: suma; Ocupación: `ocupacion_promedio` de `GET /api/indicadores/ocupacion-resumen`; H-07: aviso y tabla debajo; H-10: tasas debajo | **CUBIERTO** | Ocupación del período ponderada por clases (test «1 clase al 100 % + 9 al 0 % = 10 %») |
| 7.a | > 12 meses: gráficos por mes a ancho completo | GI l.37 y l.58 (`largo` → `lg:col-span-2`); H-07 envuelve con `doceMeses` | **CUBIERTO** | Ingresos, Ocupación, Inscriptos vs. presentes y Cancelaciones por mes |
| 7.a | Eje: mes abreviado, año solo en enero y en el primer mes («Ene ’26») | `etiquetaMesCorta` (GR l.8) en Ingresos, Ocupación y Cancelaciones por mes | **PARCIAL** | Correcto en esos tres. **«Inscriptos vs. presentes» usa otro formateador** (`presentismo-indicadores.tsx:13`, `Intl` `month:"short"`) que produce **«oct 25», «nov», «ene 26»** (minúscula, sin apóstrofo) en vez de «Oct ’25», «Ene ’26» |
| 7.a | Valor compacto en una línea («3,8 M», «988 mil», «53%»); meses sin datos sin valor | GI `valorCompacto` y `etiquetaValor` (l.24-28, 52); l.82 oculta la etiqueta si todas las barras del mes son 0 | **CUBIERTO (con observación)** | Montos: «3,8 M», «988 mil» (test). Porcentajes: se escriben con hasta 1 decimal («53,2%»), no redondeados como el ejemplo «53%». Se aplica también con ≤ 12 meses (no molesta) |
| 7.b | Si no entran: scroll horizontal dentro de la tarjeta sin achicar, arranca en los meses recientes, aviso debajo | GI l.40 (`anchoMinimo`), l.45 (`scrollLeft = scrollWidth`), l.73 (`overflow-x-auto`), l.89 (aviso) | **CUBIERTO** | Aviso literal correcto. Evidencia del dev: `periodo-24-meses-mobile.png` |
| 7.c | Los gráficos por materia y por profesor no cambian | GI: `largo` solo con `mensual`; horizontales sin scroll | **CUBIERTO** | — |

**Desvíos task ↔ HU / spec:**
- **Tasa de ocupación en barras, sin línea de meta 80 %** (GR l.21, color `--brand-accent`). La task y la spec §2.4.4 pedían «línea con meta 80 %»; la «Nota aditiva — fidelidad visual, 09/10/2026» de la spec lo cambió a barras por instrucción explícita (figuras 52–54 del prototipo). La HU no dice nada del tipo de gráfico: **no es un desvío de la HU**, pero `META_OCUPACION_PORCENTAJE` y `ui.indicadores.panel.meta` quedaron sin uso.
- **«hasta hoy» en la ocupación**: ver criterio 2.b (DESVÍO documentado en la spec, T3/P-H3).

---

## 2. Textos literales (HU-C-23)

| Texto del criterio | En `src/lib/textos.ts` | ¿Coincide? |
|---|---|---|
| «Indicadores» | `ui.indicadores.panel.titulo` = «Indicadores» | Sí |
| «Actividad» / «Índice de Presentismo» / «Cancelaciones» | `ui.indicadores.panel.actividad` / `.presentismo` / `.cancelaciones` | Sí |
| «Desde» / «Hasta» | `ui.indicadores.panel.desde` / `.hasta` | Sí |
| «Reintentar» | `ui.indicadores.panel.reintentar` | Sí |
| «No hay datos para el período seleccionado» | `ui.indicadores.panel.vacio` | Sí (sin punto final, igual que la HU) |
| «Ver como tabla» | `ui.indicadores.panel.tabla` | Sí |
| «Se muestran los meses más recientes. Desplazá el gráfico hacia la izquierda para ver los anteriores.» | `ui.indicadores.panel.scroll` | Sí |
| «Ingresos cobrados» / «Tasa de ocupación» (nombres de los gráficos) | `ui.indicadores.panel.ingresos` = «Ingresos cobrados **por mes**»; `.ocupacion` = «Tasa de ocupación **por mes**» | **No palabra por palabra**: agregan «por mes». Aceptable si el PO lo considera el mismo nombre; anotarlo |
| «Inscriptos vs. presentes» | `ui.indicadores.presentismo.mensual` = «Inscriptos vs. presentes **por mes**» | Ídem |
| «Cancelaciones por mes» | `ui.indicadores.cancelaciones.mes` | Sí |
| Ejemplos de formato «Ene ’26», «3,8 M», «988 mil», «53%» | Generados por código (`etiquetaMesCorta`, `valorCompacto`) | «Ene ’26», «3,8 M», «988 mil» sí. **«53%» → se muestra «53,2%» si hay decimal**. **«Ene ’26» no en Inscriptos vs. presentes** («ene 26») |

Textos de la spec que el criterio no cita literalmente pero que conviene mirar: el aviso «El período máximo es de 24 meses.» coincide con DEC-40. El mensaje de error («No se pudo cargar este indicador. Intentá nuevamente.») es propuesto (P-H12), la HU no lo fija.

---

## 3. Reglas de servidor

| Regla | ¿Aplica? | Verificación |
|---|---|---|
| Validación Zod previa (Regla 6) | Sí | Las 3 rutas de la HU hacen `RangoIndicadoresQuerySchema.safeParse` antes del service; `400 { code: "VALIDATION_ERROR", message: "Parámetros inválidos", detalles: flatten() }`. Mensajes: «Formato de mes inválido (AAAA-MM)», «El mes desde no puede ser posterior al mes hasta», «El rango máximo es de 24 meses» |
| Permisos / 403 (Reglas 10 y criterio 6) | Sí | `withPermission("indicadores:leer")` en las 10 rutas del panel; pantalla con `exigirPermiso` → `/sin-permiso`. Sin sesión 401 `SESION_INVALIDA`, otro rol 403 `SIN_PERMISO` |
| Capa delgada (Regla 4) y contrato (Regla 5) | Sí | Rutas: parsean, llaman al service y devuelven `{ data, error: null }` |
| Aislamiento (Regla 3) | Sí | H solo usa `sumarPagosPorMes` (I) y `promediarOcupacionTurnosPorMes` (C) |
| Transacciones / bloqueos (Regla 7) | **No aplica** | Solo lectura; la spec §3.16 dice que no abren transacción ni bloquean. Correcto |
| Registros nuevos en lugar de modificar (Regla 8) | **No aplica a H**; sí al dato | Ingresos lee el **monto vigente** (`CorreccionPago`) y excluye **anulados** (`AnulacionPago`): justamente la Regla 8 de I. H no escribe nada |
| Trazabilidad (Regla 2) | No aplica | Sin mutaciones |

### Endpoints relevantes

| Método y ruta | Uso en el panel |
|---|---|
| `GET /api/indicadores/ingresos-por-mes?desde=AAAA-MM&hasta=AAAA-MM` | Ingresos cobrados (H-01) |
| `GET /api/indicadores/ocupacion-por-mes?desde=…&hasta=…` | Tasa de ocupación por mes (H-02) |
| `GET /api/indicadores/ocupacion-resumen?desde=…&hasta=…` | **Nuevo de H-06**: total del encabezado de Ocupación |
| `GET /api/indicadores/clases-por-materia`, `/clases-por-profesor` | Actividad (H-03) |
| `GET /api/indicadores/presentismo-por-mes`, `/presentismo-por-materia`, `/alumnos-presentismo-bajo?pagina=1` | Índice de Presentismo (H-07) |
| `GET /api/indicadores/cancelaciones-por-mes`, `/cancelaciones-por-materia` | Cancelaciones (H-10) |
| Pantalla `GET /gerente` | `exigirPermiso("indicadores:leer")` |

### Snippets para la consola del navegador

Iniciar sesión con **mesa.entrada@noctium.local**, **profesor1@noctium.local** o **alumno01@noctium.local** (contraseña `Password123!`), abrir cualquier pantalla de la app (mismo origen), F12 → Consola, pegar:

**a) Todas las rutas del panel con otro rol (esperado: 403 `SIN_PERMISO` en las 10):**
```js
const rutas = ["ingresos-por-mes", "ocupacion-por-mes", "ocupacion-resumen", "clases-por-materia", "clases-por-profesor",
  "presentismo-por-mes", "presentismo-por-materia", "alumnos-presentismo-bajo", "cancelaciones-por-mes", "cancelaciones-por-materia"];
for (const r of rutas) {
  const res = await fetch(`/api/indicadores/${r}?desde=2026-05&hasta=2026-10`);
  console.log(r, res.status, (await res.json()).error);
}
// esperado: cada línea "… 403 { code: 'SIN_PERMISO', message: … }"
```

**b) Solo la ruta nueva de H-06:**
```js
const r = await fetch("/api/indicadores/ocupacion-resumen?desde=2026-05&hasta=2026-10");
console.log(r.status, await r.json()); // esperado: 403 { data: null, error: { code: "SIN_PERMISO", … } }
```

**c) Con el Gerente (control positivo y validación 400):**
```js
for (const q of ["", "?desde=2026-05&hasta=2026-10", "?desde=2024-09&hasta=2026-09", "?desde=2026-10&hasta=2026-09", "?desde=2026-13"]) {
  const r = await fetch(`/api/indicadores/ocupacion-resumen${q}`);
  console.log(q || "(sin rango)", r.status, await r.json());
}
// esperado: 200, 200, 400 "El rango máximo es de 24 meses", 400 "desde posterior a hasta", 400 "Formato de mes inválido"
```

**d) Sin sesión (401):** en una ventana de incógnito, abrir `http://localhost:3000/api/indicadores/ocupacion-resumen` → `401 SESION_INVALIDA`.

**e) Pantalla:** con mesa/profesor/alumno, navegar a `/gerente` → redirige a `/sin-permiso`.

---

## 4. Definición de Terminado

| Ítem | Estado | Detalle |
|---|---|---|
| Textos visibles en el archivo central | **Incumple (menor)** | Panel H-06: todo centralizado. Pero dentro del panel hay literales en código: `presentismo-indicadores.tsx:36/38` arma el detalle del total como `` `${presentes} de ${inscriptos}` `` («de» fijo); `clases-indicadores.tsx:21` escribe `` ` · ${horas} h` `` («h» fijo); `use-indicador.ts:23` puede mostrar el mensaje técnico del navegador ante una respuesta no-JSON. Son de H-07/H-03 o de borde, pero se ven en el panel |
| Ningún texto visible con «turno» | **Cumple** | Ninguna clave `ui.indicadores.*` contiene «turno». (El campo `turnos` del JSON de `ocupacion-resumen` no se muestra) |
| Confirmación HU-C-25 en toda operación que guarda | **No aplica** | El panel no guarda nada |
| Tests en verde | **Cumple, con aviso** | Unitarios 3170/3170. PG de indicadores 10/10 con `SEED_FECHA_HOY=2026-10-09`; con el reloj de hoy el seed falla en el fixture E02 (ajeno a H-06, pero bloquea sembrar la base de prueba hoy) |
| `verificar-claves-textos` | Cumple | — |

---

## 5. Extras y violaciones

### Implementado sin que la HU lo pida
1. **Endpoint nuevo `GET /api/indicadores/ocupacion-resumen`** para el total del encabezado de Ocupación (promedio por clase del período). Necesario para cumplir «el total de cada gráfico en su encabezado»; razonable.
2. **Selectores con 3 meses hacia adelante** (DEC-40). La HU no lo pide; los meses futuros siempre dan Ocupación vacía (excluye clases futuras).
3. **Navegación de pestañas con teclado** (flechas, Inicio, Fin) y `role="tab"`: plus de accesibilidad.
4. **Cambio en `turno.validaciones.ts`** (defaults de reloj con `ahora()`) para poder sembrar históricos; compartido con E-09. Fuera del panel, documentado en la task.
5. **Fixture `hu-h-06.ts`**: 23 meses con clases y pagos (cada 4.º mes vacío, importes de 3.800.000 para probar «3,8 M»).

### Violaciones a RULES.md / DESIGN.md
1. **Colores fuera de `--chart-*`** (spec §2.4.4 «prohibido»): Ocupación y Presentes usan `--brand-accent`; Cancelaciones usa `--destructive`, `--chart-expired`, `--chart-withdrawal`; Índice usa `--chart-attendance-index`. **Quedó regularizado** en `DESIGN.md` («Series de indicadores — fidelidad del prototipo», 09/10/2026), así que no es violación de DESIGN.md, sí una contradicción con el texto original de la spec §2.4.4. Los tokens nuevos no tienen valor para modo oscuro (`globals.css` solo redefine `--chart-1..5` en `.dark`).
2. **Componentes cliente importan de `@/server/...`** (`indicadores-client.tsx:8`, `filtro-periodo.tsx:4` importan helpers de `indicadores.schema.ts`). No lo prohíbe RULES.md y el archivo no tiene nada sensible, pero mezcla capas.
3. Sin violaciones de Reglas 1–11 en el servidor.

---

## 6. Datos para la prueba manual

### Credenciales (todas con `Password123!`)
| Usuario | Para qué |
|---|---|
| `gerente@noctium.local` (Silvia Paredes) | Todos los criterios 1–5 y 7 |
| `gerente2@noctium.local` | Segundo gerente (control) |
| `mesa.entrada@noctium.local`, `profesor1@noctium.local`, `alumno01@noctium.local` | Criterio 6 (403 y `/sin-permiso`) |

### Cómo sembrar hoy
El seed con el reloj real **falla** en el fixture de HU-E-02 (`Fixture E02 sin inscripción inicial`), que corre antes que el de HU-H-06, así que la base quedaría sin los datos de esta HU. Sin tocar código, sembrar con fecha fija (verificado: con esa fecha pasan todos los fixtures):

```powershell
$env:SEED_FECHA_HOY = "2026-10-09"; npx prisma db seed; Remove-Item Env:SEED_FECHA_HOY
```
(en Git Bash: `SEED_FECHA_HOY=2026-10-09 npx prisma db seed`). Conviene hacerlo sobre una base recién migrada (`npx prisma migrate reset` si la base ya tiene una corrida fallida).

### Datos del fixture HU-H-06 (relativos a octubre de 2026)
- Clases de **Matemática (MAT101)**, **profesor1** (DNI 27100001), **Aula 1** (cupo 10), lunes 11:00, en los 23 meses anteriores salvo **cada cuarto mes**: sin datos de H-06 en **jun-2026, feb-2026, oct-2025, jun-2025 y feb-2025**. En los meses múltiplos de 3 hacia atrás hay 2 clases.
- Un pago por clase (alumno de menor DNI, transferencia): **$ 3.800.000** en jul-2026, abr-2026, ene-2026, jul-2025, abr-2025, ene-2025, oct-2024 (→ «3,8 M»); **$ 988.000 + atraso × 1.000** en el resto (sep-2026 = $ 989.000 → «989 mil»).
- Solo este fixture crea pagos: en los meses «hueco» Ingresos es 0. Los fixtures de H-03 (abr–sep 2026) y H-10 (sep-2025–sep-2026) agregan clases, así que **jun-2026** debería tener Ocupación y Clases con datos e Ingresos vacío.

### Casos por criterio
| Criterio | Cómo probarlo |
|---|---|
| 1 | Gerente → menú «Indicadores» (`/gerente`). Ver 3 pestañas, Actividad seleccionada, con Ingresos, Ocupación, Clases por materia, Clases por profesor |
| 2 | Al entrar: Desde = mayo 2026, Hasta = octubre 2026. Elegir Desde = octubre 2024 con Hasta = octubre 2026 (25 meses) → Hasta se ajusta y aparece «El período máximo es de 24 meses.». Elegir Desde posterior a Hasta → se iguala. Cambiar a Cancelaciones y volver → el período se conserva. Leer la leyenda de cada uno de los 8 gráficos |
| 3 | Cambiar el período y observar skeletons sin recarga. Error: DevTools → Network → clic derecho sobre `ingresos-por-mes` → «Block request URL», cambiar el período → solo Ingresos muestra el error y «Reintentar»; desbloquear y pulsar «Reintentar» → solo esa tarjeta se recarga |
| 4 | Desde = Hasta = **junio 2026** → Ingresos «No hay datos para el período seleccionado», Ocupación y Clases visibles (confirmar con «Ver como tabla»; si junio tuviera ingresos por otros datos, buscar en la tabla de 24 meses un mes con Ingresos 0 y Ocupación > 0). Todo vacío: Desde = Hasta = **enero 2027** |
| 5 | En cada gráfico, valor escrito sobre cada barra; pasar el mouse / tocar → tooltip con valor exacto («$ 989.000,00», «43,1%»). «Ver como tabla» → mismos números. Pestaña Índice de Presentismo: comprobar que **los puntos de la línea del índice no tienen el valor escrito** (bloqueante 2) |
| 6 | Snippets de la sección 3 con mesa/profesor/alumno; `/gerente` → `/sin-permiso` |
| 7 | Ventana ancha: 2 columnas. Período **noviembre 2024–octubre 2026**: Ingresos, Ocupación, Inscriptos vs. presentes y Cancelaciones por mes a ancho completo; eje «Nov ’24 … Ene ’25 … Ene ’26»; valores «3,8 M» / «989 mil»; meses hueco sin valor. Con DevTools en modo móvil (390 px): scroll horizontal dentro de la tarjeta, posicionado en los meses recientes, y el aviso debajo. Comparar el eje de **Inscriptos vs. presentes** («nov 24», «ene 25» → bloqueante 3) |

### Preparación: pago anulado y pago corregido (criterio 2, «monto vigente, sin anulados»)
HU-I-06 tiene servicio pero **no tiene pantalla ni ruta** todavía. Script de una sola vez, por los servicios de dominio (registra `AnulacionPago` y `CorreccionPago`, no modifica el pago). Guardarlo **fuera del control de versiones** (p. ej. `scripts/tmp-hu-h-06-pagos.ts`), correrlo una vez y borrarlo:

```ts
// npx tsx scripts/tmp-hu-h-06-pagos.ts   (borrarlo después; no commitear)
// Anula el pago de $ 3.800.000 de julio de 2026 y corrige a $ 500.000 el de
// septiembre de 2026 (fixture HU-H-06), como el Gerente.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { transaccion } from "../src/server/shared/transaccion";
import { anularPago, corregirPago } from "../src/server/pagos/correccion.service";

async function main() {
  const gerente = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
  const usuario = { id: gerente.idUsuario, rol: gerente.rolUsuario };
  const caja = await prisma.caja.findFirst({ where: { estado: "ABIERTA" } }); // solo se usa si la caja del pago está cerrada
  const delMes = (desde: string, hasta: string) => prisma.pago.findFirstOrThrow({
    where: { fechaPago: { gte: new Date(`${desde}T00:00:00Z`), lt: new Date(`${hasta}T00:00:00Z`) } },
    orderBy: { fechaPago: "asc" },
  });
  const julio = await delMes("2026-07-01", "2026-08-01");
  const septiembre = await delMes("2026-09-01", "2026-10-01");
  console.log("Julio:", julio.idPago, julio.montoPago.toString(), "· Septiembre:", septiembre.idPago, septiembre.montoPago.toString());
  await transaccion((tx) => anularPago(tx, { pagoId: julio.idPago, motivo: "Prueba PO HU-H-06", usuario, cajaAjusteId: caja?.idCaja }), { db: prisma });
  await transaccion((tx) => corregirPago(tx, { pagoId: septiembre.idPago, monto: "500000", motivo: "Prueba PO HU-H-06", usuario, cajaAjusteId: caja?.idCaja }), { db: prisma });
  console.log("Listo: julio anulado, septiembre corregido a $ 500.000");
}
main().catch((e) => { console.error(e.code ?? "", e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

Resultado esperado en el panel (mayo–octubre 2026): **julio en 0 y sin valor escrito**, **septiembre «500 mil»**, y el total del encabezado baja **$ 4.289.000**. Si responde `errores.pago.yaAnulado` / `sinCambios`, ya se corrió antes. Si el fixture dejara más de un pago en julio, el script anula el primero; anotar el monto que imprime.

---

## 7. Veredicto preliminar

**Volver al dev** (cambios chicos, de interfaz y textos; el servidor está bien).

**Bloqueantes:**
1. **Criterio 2 — leyendas sin la fecha** en 4 de los 8 gráficos del panel: Clases por profesor, Inscriptos vs. presentes por mes, Presentismo por materia y Cancelaciones por materia. La HU pide que «la leyenda de cada gráfico indica qué fecha usa». Arreglo: textos en `src/lib/textos.ts`.
2. **Criterio 5 — la línea del Índice de presentismo no muestra el valor de cada punto.** `GraficoIndicador` solo pone etiquetas en las barras (`grafico-indicador.tsx:84`, `Line` sin `LabelList`); el componente común debería soportarlo para series `linea`.
3. **Criterio 7 — eje de «Inscriptos vs. presentes»** con «oct 25 / nov / ene 26» en lugar de «Oct ’25 / Nov / Ene ’26»: usa un formateador propio (`presentismo-indicadores.tsx:13`) en vez de `etiquetaMesCorta`.

**Para decidir o anotar (no bloquean):**
4. Ocupación excluye las clases futuras («hasta hoy», T3/P-H3) y su leyenda no enumera «Reservadas no vencidas, Pagadas y Pago sin registrar»: ratificar el recorte y decidir si la leyenda debe listar los estados.
5. Porcentajes compactos con decimal («53,2%») en vez de «53%».
6. Nombres de gráficos con «por mes» agregado («Ingresos cobrados por mes», «Tasa de ocupación por mes»).
7. Ocupación pasó de línea con meta 80 % a barras sin meta (nota aditiva de la spec, 09/10); constante y texto de la meta sin uso.
8. Literales fuera del archivo central en H-07/H-03 («de», «h») y mensaje técnico posible ante respuesta no-JSON.
9. Tokens de color nuevos sin valor para modo oscuro.
10. **Entorno:** el seed falla hoy en el fixture HU-E-02 (fechas fijas); sembrar con `SEED_FECHA_HOY=2026-10-09`. Avisar al responsable de HU-E-02. `prisma/seed.ts` tiene además cambios locales sin commitear, ajenos a esta HU.
11. «Monto vigente / sin anulados» solo se puede probar por script hasta que HU-I-06 tenga pantalla.
