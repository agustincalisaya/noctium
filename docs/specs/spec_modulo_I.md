# Especificación Técnica — Módulo I (Pagos)
## Noctium — Sprint 2
## Revisión 2 — precisiones de HU-I-03 sobre la versión del 29/09/2026 (conserva HU-I-01)

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° 1, 2, 3, 4, 5, 6, 7, 8, 10, 11) · `spec_modulo_A.md` (sesión/RBAC, matriz §2.4) · `spec_modulo_B.md` (§2.3, forma de pago preferida) · `spec_modulo_C.md` Revisión 5 (§2.4 detalle de turno, §2.15 servicios públicos) · `spec_modulo_K.md` y `spec_modulo_L.md` (patrón de catálogo y unicidad) · `schema.prisma` · `docs/tasks/Sprint 2/HU-Sprint-2.md` · `docs/adicionales/mapa-pantallas-sprint-2.md` (§1, §2, §4) · `docs/DESIGN.md` §6

**HU contractualizadas en la spec:** HU-I-03 (Registrar y listar formas de pago del centro), HU-I-01 (Registrar pago) — Sprint 2.

**Nota aditiva de sincronización HU-I-01 (01/10/2026):** el modelo `Pago`, sus relaciones y permisos ya existen en la migración `20260928150100_sprint2_modelo` y el seed vigente; HU-I-01 no crea otra migración. Se reutiliza `listarPagosDeTurno()` de la fachada `pago.publico.ts` ya integrada en develop por HU-C-09: consume B en lote y no importa Turnos, conservando el aislamiento sin ciclo C → I → C. La ruta de detalle existente comprueba `pagos:leer` antes de pedir la lista y omite por completo `pagos` para el Profesor. Task y evidencia: `docs/tasks/Sprint 2/HU-I-01.md`, `docs/testing/HU-I-01-evidencia.md`. Sin cambios en respuestas, reglas de negocio ni numeración; precisión aditiva de validación de IDs históricos.

**Presentación solicitada (01/10/2026):** HU-I-01 muestra `Total registrado` como en la página 5 del PDF, sumando únicamente las filas recibidas en centavos exactos. Este pedido explícito del usuario extiende la presentación sin total de HU-C-09; no representa saldo, precio esperado ni validación del monto del turno.

**Compatibilidad verificada en integración (01/10/2026):** la migración inicial creó las formas con ids `formapago-efectivo`, `formapago-transferencia`, `formapago-debito`, `formapago-mercado-pago`, conservados por el seed. La validación CUID de §2.4 rechazaba pagos válidos contra ese catálogo. `forma_pago_id` acepta un CUID **o exactamente uno de esos cuatro ids existentes**; las reglas de existencia/actividad siguen validándose en el servicio. No se migran ids ni se alteran referencias históricas. El ejemplo de schema de §2.4 debe interpretarse con esta precisión aditiva.

**Backlog v2 del 28/09/2026:** (1) **HU-C-11 se retiró**: el turno ya no lleva forma de pago, así que esta spec ya no la consume ni la propone desde el turno; (2) **HU-I-01 ahora registra qué alumno paga** (AC1, AC3, AC4): el pago lleva `alumnoId` y la forma de pago se propone a partir de la **preferida del alumno elegido** (HU-B-03), sin obligarla; (3) HU-I-01 depende ahora de HU-C-09 (detalle del turno, de donde sale la lista de inscriptos) y no de HU-C-11; (4) HU-I-03 ya no menciona turnos.

**Nota aditiva — 01/10/2026 (`spec_modulo_H.md` Revisión 2):** se agrega la fila `sumarPagosPorMes()` en §2.3, la lectura agregada que consume el indicador "Ingresos cobrados por mes" (HU-H-01 revisada). Es de solo lectura, no cambia el modelo `Pago` ni ninguna regla de negocio, y no se renumera nada.

**Changelog de Revisión 1 (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-I-03 | Gap — no contractualizada | Añadidas secciones 2.1 y 2.2 |
| HU-I-01 | Gap — no contractualizada | Añadidas secciones 2.4 y 2.5 (opciones del modal) |
| HU-C-11 | Vigente en el backlog previo | Retirada del backlog v2: esta spec ya no la consume |

**Changelog de Revisión 2 (HU-I-03):** se precisa el alcance del endpoint de opciones, las fixtures para pruebas de inactivas y el estado de la migración ya versionada. Además (29/09/2026): el mensaje del `409` y el del campo vacío pasan a los textos del mockup (páginas 24 y 25) y del prototipo; el schema colapsa los espacios antes de validar el largo; y se aclara que la garantía frente a la carrera es el índice único. HU-I-01 y los contratos existentes conservan sus secciones y numeración.

**Detalle por sección y modelo:**
| HU / sección | Estado previo | Acción |
|---|---|---|
| Modelo `FormaPago` | Existe desde Sprint 1 como catálogo de seed (`Efectivo`, `Transferencia`, `Débito`, `Mercado Pago`) con `idFormaPago`, `nombreFormaPago @unique`, `activaFormaPago`. Lo lee HU-B-03 | Pasa a ser **propiedad de este módulo**. Se le agregan `nombreNormalizadaFormaPago`, `createdAtFormaPago` y `creadoPorUsuarioId` (§2.1, migración). Sin cambio de contrato en B; B pasa a consumirlo por §2.3. `listarFormasPagoActivas()` se **mueve** de `alumno.service.ts` a esta spec |
| HU-I-03 | Gap — no contractualizada | Secciones 2.1 y 2.2 |
| HU-I-01 | Gap — no contractualizada | Secciones 2.4 y 2.5 (opciones del modal) |
| Modelo `Pago` | No existe en `schema.prisma` | Nuevo (§2.4), **con `alumnoId`** (backlog v2) |
| `spec_modulo_C.md` §2.4 | El detalle no muestra pagos | Lo ajusta la Revisión 5 de C; consume `listarPagosDeTurno()` (§2.3), que ahora devuelve el alumno de cada pago |

**Fuera de alcance de esta spec (explícito):**
- Modificar, dar de baja o reactivar una forma de pago (HU-I-03 AC5): existe el estado `Inactiva` pero ninguna acción de este sprint lo alcanza desde la UI. Para comprobar estas ramas, crear fixtures inactivas aisladas en la base de test o usar mocks según el nivel de prueba. HU-I-03 no exige una forma inactiva en el seed de demo. El `upsert` de las cuatro formas auditado en `b9cc43b` fija `activaFormaPago: true` al actualizar; no usarlo como fixture inactiva ni alterar su política de reactivación en esta HU.
- **Editar o anular un pago ya registrado.** Un pago es un registro de hecho consumado (Regla N.° 8): no admite `UPDATE`; una corrección se resolvería con un registro compensatorio que lo referencie, y el PO planificó una HU en Sprint 3 para solventar los casos en que haya que corregir (Q6c). Ver "Puntos abiertos".
- Historial de pagos por alumno (HU-I-04) y estado de cuenta (HU-I-02), ambos de Sprint 3. (El pago **guarda** el alumno desde este sprint, así que HU-I-04 no requerirá migrar datos; lo que queda fuera es la pantalla.)
- Asociar una forma de pago **al turno** (HU-C-11, retirada del sprint).
- Pantalla o listado global de "Pagos" (mapa de pantallas §2): el pago vive solo en el Detalle de turno.
- Precios por materia y validación contra un monto total esperado (HU-I-01 AC2 y AC3).
- Integración con pasarelas de pago: sin checkout, webhooks ni conciliación. La forma de pago es un dato de texto que carga Mesa de Entrada.
- Comprobantes y notificaciones.

---

## 1. Visión General

El Módulo I gestiona dos entidades independientes:

1. **`FormaPago`** — catálogo de las formas de pago que el centro admite. Lo administra solo el Gerente. Desde este sprint es propiedad de este módulo.
2. **`Pago`** — registro puntual de que un alumno abonó un turno (alumno, monto, forma de pago, fecha). Lo carga Mesa de Entrada desde el Detalle de turno.

**La forma de pago vive solo en el pago.** HU-C-11 (asociar una forma de pago al turno) se retiró del backlog: el turno no tiene forma de pago propia. Al registrar un pago, la forma de pago se **propone** con la preferida del alumno elegido (HU-B-03), sin obligarla, y se elige entre las activas.

**Presentación (mapa de pantallas):** las formas de pago tienen **pantalla propia** (listado, página completa) con el alta en modal; el pago **no** tiene pantalla: es una acción en modal dentro del Detalle de turno (`/turnos/[id]`).

Implementación estándar del proyecto: Route Handlers delgados que delegan en `src/server/pagos/forma-pago.service.ts` y `src/server/pagos/pago.service.ts` (Reglas N.° 4 y 11). Como en Turnos, el frontend llama directamente a los Route Handlers; **no** se crea `actions.ts` sin uso.

**Historial y alcance de Revisión 2:** la Revisión 1 creó las secciones 2.1 a 2.5. Esta revisión solo precisa HU-I-03 en las secciones indicadas en el changelog; preserva la numeración, los contratos de HU-I-01 y la propiedad de `FormaPago` en I.

---

## 2. Interfaces y Contratos

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: `docs/RULES.md` Reglas N.° 5 y 6.
- Los ids de `FormaPago` y `Pago` son CUID según `schema.prisma`. **El `turno_id` no se valida como CUID** (los turnos de seed tienen ids `seed-turno-NN`); un id inexistente responde `404` desde el servicio, igual que las rutas de Turno.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("<recurso>:<accion>")` (Regla N.° 10). Permisos nuevos (se siembran en migración y en `seed.ts`; matriz completa en `spec_modulo_A.md` §2.4):

| Permiso | Roles |
|---|---|
| `formas_pago:crear` | GERENTE |
| `formas_pago:leer` | GERENTE, MESA_ENTRADA (la usa también el modal de HU-I-01) |
| `pagos:crear` | MESA_ENTRADA |
| `pagos:leer` | MESA_ENTRADA, GERENTE (el PROFESOR **no** ve montos) **Ratificado por el PO (29/09/2026) — Q6d** |

- Ubicación de archivos según la Regla N.° 11: tipos en `src/types/pago.types.ts`; `src/server/pagos/actions.ts` no se crea (ver sección 1); services, schemas y servicios públicos en `src/server/pagos/{forma-pago.service.ts, forma-pago.schema.ts, pago.service.ts, pago.schema.ts, forma-pago.publico.ts, pago.publico.ts}`; Route Handlers en `app/api/formas-pago/**` y `app/api/pagos/**`.

---

### 2.1. Alta de forma de pago (HU-I-03)

**Ruta:** `POST /api/formas-pago` (Route Handler en `src/app/api/formas-pago/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `crearFormaPago()` en `src/server/pagos/forma-pago.service.ts`
**Permiso requerido:** `formas_pago:crear`
**Presentación:** modal (`Dialog`) sobre el listado; toast "Forma de pago registrada correctamente" (mapa de pantallas §4, `DESIGN.md` §6.1).

```typescript
// src/server/pagos/forma-pago.schema.ts
export const CrearFormaPagoSchema = z.object({
  nombre: z.string()
    .transform((v) => v.trim().replace(/\s+/g, " ")) // primero se recorta y se colapsan los espacios...
    .pipe(z.string()                                    // ...y recién después se valida el largo
      .min(1, "Ingresá el nombre de la forma de pago.") // campo vacío (mockup); con vacío se muestra solo este mensaje
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(40, "El nombre no puede superar los 40 caracteres")),
}).strict(); // rechaza cualquier campo extra: no se solicita ni almacena ningún dato financiero (HU-I-03 AC1)
export type CrearFormaPagoInput = z.infer<typeof CrearFormaPagoSchema>;
```

**Comportamiento esperado (`forma-pago.service.ts` → `crearFormaPago`):**
1. Calcular `nombreNormalizadaFormaPago = normalizarTexto(nombre)` con la utilidad compartida (`spec_modulo_L.md` §2.1; misma que Materias y Aulas).
2. Verificar unicidad aplicativa contra **todas** las formas de pago, activas e inactivas. Si existe: `409 NOMBRE_DUPLICADO`.
3. Revalidación inmediatamente antes del `INSERT` + defensa del constraint único (`P2002`), traducido al mismo `409` (patrón de `spec_modulo_L.md` §3.2). La revalidación mejora el mensaje, pero **no cierra la carrera**: la garantía frente a dos altas simultáneas es el índice único con la captura de `P2002`.
4. Insertar con `activaFormaPago: true`, `createdAtFormaPago` y `creadoPorUsuarioId`.

**Modelo (cambios en `schema.prisma`):**
```prisma
model FormaPago {
  idFormaPago               String   @id @default(cuid())
  nombreFormaPago           String   @unique
  nombreNormalizadaFormaPago String  @unique   // NUEVO: unicidad case/acento-insensitiva
  activaFormaPago           Boolean  @default(true)
  createdAtFormaPago        DateTime @default(now())  // NUEVO (Regla N.° 2, opción a)
  creadoPorUsuarioId        String?                    // NUEVO, escalar sin relación
  alumnos Alumno[]
  pagos   Pago[]    // NUEVO
  @@map("formas_pago")
}
```

**Estado de migración y despliegue:** la base de código auditada en `b9cc43b` ya contiene el modelo y la migración versionada `20260928150100_sprint2_modelo`, con backfill literal de cuatro formas, `NOT NULL` e índice único de `nombreNormalizadaFormaPago`. Su aplicación en cada base no se comprobó. Antes de desplegar en una base no migrada, verificar los nombres preexistentes, las colisiones bajo `normalizarTexto()` y el estado de la migración; si existen otros nombres o colisiones, preparar un saneamiento seguro o una migración adicional apropiada antes de imponer unicidad. No reescribir una migración ya aplicada. El seed auditado fija el nombre normalizado en el `upsert`; verificar su versión vigente al implementar.

**Trazabilidad:** opción (a) de la Regla N.° 2 (columnas de la propia fila), igual que Materias y Aulas. No hay tabla de eventos de Pagos.

**Respuesta `201 Created`:**
```json
{ "data": { "id": "cuid", "nombre": "Tarjeta de crédito", "is_active": true }, "error": null }
```
**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "NOMBRE_DUPLICADO", "message": "Ya existe una forma de pago con ese nombre." } }
```

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — nombre fuera de 2–40 caracteres o campo extra (`.strict()`).
- `403 SIN_PERMISO` — rol sin `formas_pago:crear`.
- `409 NOMBRE_DUPLICADO` — ya existe una forma de pago (activa o inactiva) con ese nombre normalizado, o `P2002` del constraint único.

---

### 2.2. Listado y opciones de formas de pago (HU-I-03)

**Ruta (listado):** `GET /api/formas-pago` (Route Handler en `src/app/api/formas-pago/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `listarFormasPago()` en `src/server/pagos/forma-pago.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `formas_pago:leer`

```typescript
export const ListarFormasPagoQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  por_pagina: z.coerce.number().int().positive().max(20).default(20),
});
```

**Comportamiento esperado:**
- Incluye formas de pago activas e inactivas; cada ítem: nombre y estado (`Activa` / `Inactiva`).
- Orden: `nombreNormalizadaFormaPago` ascendente (HU-I-03 AC4), paginación server-side con metadatos — mismo patrón que Materias y Aulas.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "items": [{ "id": "cuid", "nombre": "Débito", "is_active": true }],
    "paginacion": { "total": 4, "pagina_actual": 1, "total_paginas": 1, "por_pagina": 20 }
  },
  "error": null
}
```

**Ruta (opciones para selectores):** `GET /api/formas-pago/opciones` — **solo activas**, sin paginar, orden alfabético normalizado, array directo (mismo formato que las rutas de opciones de Turno). Está previsto para el modal de HU-I-01; las páginas actuales de B obtienen las opciones por el servicio público interno de I. Permiso `formas_pago:leer`. Servicio: `listarFormasPagoActivas()` (§2.3).
```json
{ "data": [{ "id": "cuid", "nombre": "Efectivo" }], "error": null }
```

**Alcance de HU-I-03:** esta historia implementa `POST /api/formas-pago` y `GET /api/formas-pago` (listado de gestión). El endpoint HTTP `/api/formas-pago/opciones` queda especificado para HU-I-01 y no se crea en la task I-03. Las páginas actuales de B obtienen las opciones mediante el servicio interno `listarFormasPagoActivas()` de I, sin una ruta HTTP nueva.

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — `pagina` o `por_pagina` inválidos (solo el listado).
- `403 SIN_PERMISO` — rol sin `formas_pago:leer`.

---

### 2.3. Servicios públicos del módulo

Conforme a la Regla N.° 3, **provistos por este módulo**, en `forma-pago.publico.ts` y `pago.publico.ts`. Otros módulos los invocan en lugar de consultar `formas_pago` o `pagos`. No son endpoints ni exigen un permiso `formas_pago:*`/`pagos:*`: el control de acceso lo hace la ruta del módulo consumidor. En las funciones que lo declaran, el parámetro opcional `db` recibe el `Prisma.TransactionClient` del llamador; `listarFormasPagoActivas()` no recibe `db`.

| Función | Devuelve | Consumidores |
|---|---|---|
| `verificarFormaPagoActiva(id, db?)` | `{ id, nombre } \| null` si existe y está activa | B §2.3, §2.4 de esta spec |
| `existeFormaPago(id, db?)` | `boolean`: existe, activa o inactiva | separar "no existe" de "inactiva" |
| `obtenerFormaPago(id, db?)` | `{ id, nombre, is_active } \| null` | mostrar el nombre histórico de una forma desactivada (en el detalle de pagos y en la ficha del alumno) |
| `listarFormasPagoActivas()` | `{ id, nombre }[]`, orden alfabético normalizado | selectores |
| `listarPagosDeTurno(turnoId, db?)` | `{ id, alumno: { id, nombre_completo }, monto, forma_pago: { id, nombre }, fecha_pago, registrado_en }[]`, más recientes primero. Los nombres de alumno salen de `obtenerAlumnosBasicos()` (Módulo B, §2.8), en una sola consulta en lote | C §2.4 (detalle) |
| `sumarPagosPorMes(desde, hasta, db?)` — **NUEVA el 01/10/2026** | `desde` y `hasta` son meses `AAAA-MM` con límites inclusivos. Devuelve `{ mes: "AAAA-MM", total }[]`, **solo los meses con pagos**, en orden cronológico. `total` es la suma exacta de `montoPago` como texto decimal con dos decimales (`"450000.00"`, misma convención que `monto` en `listarPagosDeTurno`), agrupada por el mes de `fechaPago` (`@db.Date`). Suma **todos** los pagos sin filtrar por forma de pago ni por el estado del turno (son hechos consumados, §3.6). `$queryRaw` parametrizado, de solo lectura | HU-H-01 revisada, `spec_modulo_H.md` §2.2 |

**Consumido por este módulo:** `bloquearTurnoParaOperacion(turnoId, tx)` de `spec_modulo_C.md` §2.15 — devuelve el turno bloqueado con `FOR SHARE` y **la lista de alumnos inscriptos** (`alumno_ids`), mismo patrón que `bloquearMateriasParaAsociar` (`spec_modulo_L.md` §2.3); y `obtenerAlumnosBasicos(ids)` de `spec_modulo_B.md` §2.8 para nombres y forma de pago preferida.

**Aislamiento y ciclos de importación:** Turnos consume `pago.publico.ts` y Pagos consume `turno.publico.ts`. Para evitar un import circular (precedente: `turno.disponibilidad.ts`), **ninguno de los dos archivos `*.publico.ts` importa nada del otro módulo**.

---

### 2.4. Registrar pago (HU-I-01)

**Ruta:** `POST /api/pagos` (Route Handler en `src/app/api/pagos/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `registrarPago()` en `src/server/pagos/pago.service.ts`
**Permiso requerido:** `pagos:crear` (Mesa de Entrada)
**Presentación:** modal (`Dialog`) en el Detalle de turno (`/turnos/[id]`); toast "Pago registrado correctamente". Campos del modal (HU-I-01 AC1): **Alumno** (entre los inscriptos del turno, **con buscador**; **se preselecciona solo si hay uno**), **Monto**, **Forma de pago** (entre las activas; por defecto la preferida del alumno elegido, sin obligarla) y **Fecha de pago** (por defecto hoy). Las opciones las provee 2.5.

```typescript
// src/server/pagos/pago.schema.ts
export const RegistrarPagoSchema = z.object({
  turno_id: z.string().trim().min(1, "Falta el turno"), // sin .cuid(), ver convenciones
  alumno_id: z.string().cuid({ error: "Elegí el alumno que paga" }), // HU-I-01 AC1 (backlog v2)
  // String decimal con punto: evita errores de coma flotante. El frontend normaliza la
  // coma decimal del input es-AR ("1500,50") a punto antes de enviar.
  monto: z.string().trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "El monto debe ser un número positivo con hasta 2 decimales")
    .refine((v) => Number(v) > 0, "El monto debe ser mayor a cero"),
  forma_pago_id: z.string().cuid(),
  // Solo valida que sea una fecha de calendario válida (utilidad compartida, spec_modulo_B.md §2.1); por defecto, hoy.
  // La regla «no puede ser futura» NO está en Zod: la valida el servicio (§2.4 paso 4), porque «hoy» se mide en America/Argentina/Buenos_Aires.
  fecha_pago: fechaCalendarioValidaSchema.optional(),
}).strict();
export type RegistrarPagoInput = z.infer<typeof RegistrarPagoSchema>;
```

**Comportamiento esperado (`pago.service.ts` → `registrarPago`), dentro de una única `prisma.$transaction`:**
1. Bloquear y leer el turno con `bloquearTurnoParaOperacion(turno_id, tx)`. Si no existe: `404 TURNO_NO_ENCONTRADO`. El bloqueo compartido impide que una cancelación concurrente (`spec_modulo_C.md` §2.10, que toma la fila con `UPDATE`) deje un pago sobre un turno cancelado (Regla N.° 7).
2. El turno debe estar `DISPONIBLE` o `COMPLETO`; de lo contrario `409 TURNO_NO_ADMITE_PAGO`. **Se admite un turno vencido**: pagar después de la clase es el caso normal (`spec_modulo_C.md` §3.8). **Ratificado por el PO (29/09/2026) — Q6a**
3. **El alumno debe estar inscripto en el turno** (HU-I-01 AC1): `alumno_id ∈ turno.alumno_ids` (lista que devolvió el bloqueo del paso 1). Si no: `409 ALUMNO_NO_INSCRIPTO`, "El alumno no está inscripto en este turno". No se exige que el alumno siga activo: el pago es un hecho consumado (Regla N.° 8) y la inscripción ya existe. Si el turno tiene **un solo inscripto**, la UI lo preselecciona, pero el servidor **siempre exige `alumno_id`** en el body (no lo infiere).
3b. Validar la forma de pago con `verificarFormaPagoActiva(forma_pago_id, tx)`. Inexistente (`existeFormaPago`): `404 FORMA_PAGO_NO_ENCONTRADA`. Inactiva: `409 FORMA_PAGO_NO_DISPONIBLE` (mismo código que `spec_modulo_B.md` §2.3).
4. `fecha_pago`: si no viene, hoy en `America/Argentina/Buenos_Aires`. **No puede ser futura, y esa regla la valida el servicio, no Zod** (`RegistrarPagoSchema` solo comprueba que sea una fecha de calendario válida). Si `fecha_pago` es posterior a hoy en esa zona, el servicio lanza `ServiceError("FECHA_PAGO_FUTURA")` y la ruta responde `400` con el sobre de error estándar, **sin** el detalle por campo de `flatten()`:
   ```json
   { "data": null, "error": { "code": "FECHA_PAGO_FUTURA", "message": "La fecha de pago no puede ser futura" } }
   ```
   Como este paso va después de los pasos 1 a 3b, un turno inexistente, un alumno no inscripto o una forma de pago inválida se informan antes que la fecha futura.
5. Insertar el `Pago`. Un turno admite **más de un pago** (AC3): pagos parciales de un mismo alumno o de distintos alumnos inscriptos; cada uno es una fila independiente con su propio alumno, monto, forma de pago y fecha; **no** se valida ningún monto total esperado (Noctium no modela precios este sprint).

La forma de pago llega **propuesta en el modal** con la preferida del alumno (dato que entrega 2.5), pero solo en la UI: el servicio no la infiere, la recibe siempre en el body.

**Modelo (nuevo en `schema.prisma`):**
```prisma
model Pago {
  idPago             String   @id @default(cuid())
  turnoId            String
  alumnoId           String                        // quién paga (backlog v2); debe estar inscripto en el turno
  montoPago          Decimal  @db.Decimal(11, 2)   // hasta 999.999.999,99
  formaPagoId        String
  fechaPago          DateTime @db.Date
  createdAtPago      DateTime @default(now())      // Regla N.° 2, opción (a)
  creadoPorUsuarioId String?                       // escalar sin relación, igual que el resto del schema

  turno     Turno     @relation(fields: [turnoId], references: [idTurno])
  alumno    Alumno    @relation(fields: [alumnoId], references: [idAlumno])
  formaPago FormaPago @relation(fields: [formaPagoId], references: [idFormaPago])

  @@index([turnoId, createdAtPago])
  @@index([alumnoId, createdAtPago]) // HU-I-04 (Sprint 3) listará por alumno
  @@map("pagos")
}
```
Sin `updatedAtPago`: un pago no se actualiza (§3.6). `Turno`, `Alumno` y `FormaPago` agregan la relación inversa `pagos Pago[]`. Las FK a `turnos`, `alumnos` y `formas_pago` son `RESTRICT`: un turno o un alumno con pagos nunca se borra, y de todos modos no se borran (Regla N.° 1).

**Respuesta `201 Created`:**
```json
{
  "data": {
    "id": "cuid", "turno_id": "cuid", "alumno": { "id": "cuid", "nombre_completo": "Pérez, Ana" }, "monto": "15000.50",
    "forma_pago": { "id": "cuid", "nombre": "Transferencia" }, "fecha_pago": "2026-09-28"
  },
  "error": null
}
```

**Errores esperados:**

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | (validación Zod, `flatten()`) | monto inválido o ≤ 0, falta el alumno, campo extra, `fecha_pago` con formato de fecha inválido |
| 400 | `FECHA_PAGO_FUTURA` | `fecha_pago` posterior a hoy; la valida el servicio (§2.4 paso 4), con el sobre estándar y el mensaje «La fecha de pago no puede ser futura» (sin `flatten()`) |
| 403 | `SIN_PERMISO` | rol sin `pagos:crear` |
| 404 | `TURNO_NO_ENCONTRADO` | el turno no existe |
| 404 | `FORMA_PAGO_NO_ENCONTRADA` | la forma de pago no existe |
| 409 | `TURNO_NO_ADMITE_PAGO` | turno `PENDIENTE` o `CANCELADO` |
| 409 | `ALUMNO_NO_INSCRIPTO` | el alumno no figura entre los inscriptos del turno |
| 409 | `FORMA_PAGO_NO_DISPONIBLE` | la forma de pago está inactiva |

**Visualización (HU-I-01 AC4):** el pago queda visible en el Detalle de turno, en la lista "Pagos registrados", con **alumno**, fecha, monto y forma de pago de cada uno, vía `listarPagosDeTurno()`. Solo lo ve quien tiene `pagos:leer`.

---

### 2.5. Opciones del modal de pago (HU-I-01)

**Ruta:** `GET /api/pagos/opciones?turno_id=` (Route Handler en `src/app/api/pagos/opciones/route.ts`)
**Server Action equivalente:** — (solo Route Handler)
**Servicio:** `obtenerOpcionesPago()` en `src/server/pagos/pago.service.ts` (nombre a confirmar contra el código)
**Permiso requerido:** `pagos:crear`

Devuelve lo que el modal necesita en una sola llamada, para no obligar a la UI a pedir la ficha de cada alumno.

**Respuesta `200 OK`:**
```json
{
  "data": {
    "alumnos": [ { "id": "cuid", "nombre_completo": "Pérez, Ana", "dni": "40100001", "forma_pago_preferida_id": "cuid" } ],
    "formas_pago": [ { "id": "cuid", "nombre": "Efectivo" } ],
    "preseleccionar_alumno_id": "cuid"
  },
  "error": null
}
```

**Comportamiento esperado:**
- **Buscador del alumno (HU-I-01 AC1, backlog del 28/09):** se resuelve **en el cliente** sobre la lista `alumnos` de esta respuesta, que ya está acotada por el cupo del turno (no puede superar la capacidad del aula). Filtra por apellido y nombre sin distinguir mayúsculas ni acentos, y por DNI parcial si el texto son solo dígitos. **No hay endpoint de búsqueda nuevo** ni se llama al buscador de alumnos de B (ese devuelve alumnos de todo el centro, no los inscriptos de un turno). Para poder buscar por DNI, cada alumno de `alumnos` agrega `dni` (dato que ya expone `obtenerAlumnosBasicos()`).
- `alumnos`: los inscriptos del turno (`obtenerAlumnosInscriptosDeTurno()` de `spec_modulo_C.md` §2.15) con nombre y forma de pago preferida (`obtenerAlumnosBasicos()`, Módulo B). `forma_pago_preferida_id` es `null` si el alumno está "Sin preferencia" **o** si su preferida está desactivada (no se propone una forma que ya no se puede elegir).
- `formas_pago`: solo las activas, orden alfabético normalizado.
- `preseleccionar_alumno_id`: presente **solo si hay exactamente un inscripto**; si no, se omite.
- Turno inexistente: `404 TURNO_NO_ENCONTRADO`. Turno sin inscriptos: `200` con `alumnos: []`; la UI deshabilita "Registrar pago" y muestra "El turno no tiene alumnos inscriptos".

**Errores esperados:**
- `400` (validación Zod, `flatten()`) — falta `turno_id`.
- `403 SIN_PERMISO` — rol sin `pagos:crear`.
- `404 TURNO_NO_ENCONTRADO` — el turno no existe.

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `src/server/pagos/forma-pago.service.ts` y `src/server/pagos/pago.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. Unicidad case/acento-insensitiva contra el universo completo (activas + inactivas)
Mismo patrón que `spec_modulo_L.md` §3.1 y `spec_modulo_K.md` §3.1: una forma de pago inactiva sigue "ocupando" su nombre. Doble validación (aplicativa + constraint `P2002`).

### 3.2. `FormaPago` es del Módulo I; los demás la consumen por servicio
Alumnos (HU-B-03) no lee la tabla directamente: usa §2.3. (Turnos dejó de consumirla al retirarse HU-C-11.)

### 3.3. Sin datos financieros sensibles
Ningún schema acepta ni almacena número de tarjeta, CBU, alias ni credenciales. Los schemas son `.strict()`: un campo extra se rechaza, no se ignora.

### 3.4. El pago no es retroactivo respecto del catálogo
Desactivar una forma de pago no altera los pagos ya registrados: el `Pago` conserva su `formaPagoId` y el nombre se resuelve por consulta (`obtenerFormaPago`, que devuelve también las inactivas). Mismo criterio que `spec_modulo_B.md` §3.5. Y la preferida de un alumno que se desactivó no se propone en el modal (§2.5).

### 3.5. El pago pertenece a un alumno inscripto
Todo `Pago` guarda el `alumnoId` de quien paga, y ese alumno debe figurar entre los inscriptos del turno **al momento de registrarlo** (§2.4 paso 3). Como `TurnoAlumno` puede cambiar después (un alumno puede quitarse de un turno futuro), el `alumnoId` del pago se conserva aunque el alumno deje de estar inscripto: es un hecho consumado (Regla N.° 8).

### 3.6. Un pago es inmutable (Regla N.° 8)
`Pago` es un registro de hecho consumado: no existen rutas de edición ni de baja, y ningún servicio ejecuta `UPDATE` ni `DELETE` sobre él. Una corrección futura se hará con un **registro compensatorio nuevo** que referencie al original (se contractualizará como sección aditiva en Sprint 3, junto con HU-I-02/I-04). Hasta entonces, un monto mal cargado **no se puede corregir desde la aplicación**: el equipo debe saberlo antes de la demo. El PO resolvió Q6c el 29/09/2026 planificando esa HU de corrección para Sprint 3.

### 3.7. Concurrencia
Registrar un pago no depende de un estado que otro pago pueda invalidar (no hay saldo ni total esperado), por lo que no requiere `updateMany` condicional. La única condición sensible, "el turno sigue confirmado", se cubre con el `FOR SHARE` de §2.4 paso 1.

---

## 4. Trazabilidad de Mutaciones (Regla N.° 2)

Conforme a `docs/RULES.md` Regla N.° 2, este módulo usa la **opción (a) — columnas de auditoría en la propia entidad**, que se persisten en la misma operación (no hay escritura posterior a la transacción): la trazabilidad (qué, cuándo, quién) queda en las columnas de la propia fila (`createdAtFormaPago` / `createdAtPago` y `creadoPorUsuarioId`), como Materias, Aulas y Profesores. **No existe** tabla de eventos de Pagos ni se emiten eventos en este sprint. Si Sprint 3 agrega anulaciones o compensaciones (varios eventos sobre el mismo pago), se pasa a la opción (b) en esa spec.

---

## 5. Puntos abiertos (todos resueltos el 29/09/2026)

| # | Punto | Dónde impacta | Resolvió | Propuesta contractualizada |
|---|---|---|---|---|
| Q6a | ¿En qué estados de turno se registra un pago? | §2.4 paso 2 | PO (29/09/2026) | `DISPONIBLE` y `COMPLETO`, incluso vencidos — **ratificado 29/09/2026** |
| ~~Q6b~~ | **Resuelto por el backlog v2:** el pago guarda el alumno (HU-I-01 AC1, AC3, AC4) | Modelo §2.4 | — | `alumnoId` obligatorio, debe estar inscripto |
| Q6c | Sin editar ni anular, un monto mal tipeado no tiene corrección hasta la HU que se planifique | §3.6 | PO (29/09/2026) | **Resuelto 29/09/2026:** el PO planificará una HU en Sprint 3 para corregir estos casos (Regla N.° 8) |
| Q6d | ¿El profesor ve los montos en el detalle de sus turnos? | Permisos, §2.3 | PO (29/09/2026) | No — **ratificado 29/09/2026** |
| — | Tope del monto (9 dígitos enteros) y del nombre (2–40) son propuestas del SM | §2.1, §2.4 | SM (fijado) | Fijados |
| — | ¿Un alumno inactivo puede figurar como pagador? | §2.4 paso 3 | SM (fijado) | Sí, si está inscripto (hecho consumado); no se valida `activo` |
| — | B lee hoy `FormaPago` directo (`alumno.service.ts`) | Changelog, §3.2 | Relevamiento del código | Debe pasar a `verificarFormaPagoActiva()`; `listarFormasPagoActivas()` se mueve a este módulo |
