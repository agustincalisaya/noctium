# HU-B-03 — Asociar alumno a forma de pago preferida

**Módulo:** B (Alumno) · **Sprint:** 1 · **Prioridad:** 18 · **SP:** 2
**Contrato de referencia:** `spec_modulo_B.md §2.3`
**RBAC:** `alumnos:editar` (ya existe, MESA_ENTRADA-only — reutilizado de HU-B-02, no se crea uno nuevo)
**Schema:** ya completo en `prisma/schema.prisma` (`FormaPago`, `Alumno.formaPagoPreferidaId`) — sin migración necesaria
**Estructura de carpetas:** conforme a Regla N.° 11 de `RULES.md`

---

## 0. Relevamiento previo

Relevamiento realizado por Claude Code sobre `feature/HU-B-03` (creada desde `develop`, con HU-B-04 ya mergeada), verificando directamente en disco sin asumir nada de la spec.

**Hallazgos confirmados en disco:**

- El modelo `FormaPago` (`idFormaPago`, `nombreFormaPago @unique`, `activaFormaPago Boolean @default(true)`) ya existe en `prisma/schema.prisma`, comentado explícitamente como "catálogo activable (HU-B-03)".
- `Alumno.formaPagoPreferidaId String?` ya existe con `@relation` a `FormaPago` — FK nullable simple, sin tabla N:M, exactamente como describe la spec.
- El permiso `alumnos:editar` ya existe, sembrado exclusivamente para MESA_ENTRADA (sin cambios desde HU-B-02) — se reutiliza tal cual.
- `src/server/alumnos/actions.ts` ya existe con `actualizarContactoAlumno()`, patrón exacto a replicar: `verificarPermiso("alumnos:editar")` → invoca el service → `revalidatePath` → traduce `ServiceError`/`PermisoError` a `{ data, error }` plano con un diccionario `MENSAJES_POR_CODIGO` local.
- Discrepancia conocida (ya documentada en HU-B-04): la spec dice que el seed precarga solo 2 formas de pago (Efectivo, Transferencia); el seed real siembra 4 (Efectivo, Transferencia, Débito, Mercado Pago), todas forzadas a `activaFormaPago: true` en cada corrida. No bloquea nada — el criterio 1 pide mostrar únicamente las activas, no limita la cantidad.

### Archivos nuevos

| Archivo | Contenido |
|---|---|
| `src/app/api/alumnos/[id]/forma-pago/route.ts` | `PATCH`, permiso `alumnos:editar`, mismo patrón que `contacto/route.ts` |
| `src/app/(dashboard)/alumnos/[id]/forma-pago/page.tsx` | Página de edición de la forma de pago preferida |
| `src/app/(dashboard)/alumnos/[id]/forma-pago/forma-pago-form.tsx` | Formulario (selector `<select>` + botón Guardar) |
| `docs/tasks/Sprint 1/HU-B-03.md` | Este documento |

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/server/alumnos/alumno.schema.ts` | Agrega `FormaPagoPreferidaSchema` |
| `src/server/alumnos/alumno.service.ts` | Agrega `actualizarFormaPagoPreferida()` y `listarFormasPagoActivas()` |
| `src/server/alumnos/actions.ts` | Agrega la Server Action `actualizarFormaPagoPreferida()` (capa delgada) |
| `src/app/(dashboard)/alumnos/[id]/page.tsx` | Trae `listarFormasPagoActivas()` en paralelo a `obtenerDetalleAlumno()`, pasa los datos a la sección de forma de pago |
| `src/app/(dashboard)/alumnos/[id]/ficha-alta-pago.tsx` | Pasa de solo-lectura a mostrar también un link/acción de edición hacia `/alumnos/[id]/forma-pago` |

---

## 1. Nota de alcance

### Decisiones resueltas (DECISIÓN RESUELTA, Adriel, 2026-09-23)

1. **No se agrega ninguna forma de pago inactiva al seed.** Quedaría permanente en `prisma/seed.ts` para todo el equipo cada vez que se reseedee la base, y es un dato de catálogo inventado sin justificación real de negocio. Los criterios 5 ("no hay formas de pago disponibles") y 6 (desactivación entre apertura y confirmación) se verifican por Nivel 2 (curl/Postman), desactivando una fila a mano en la BD para el test puntual y reactivándola después.
2. **Página separada para la edición**, no un selector inline en la ficha. `/alumnos/[id]/forma-pago`, mismo patrón que `contacto/page.tsx` + `contacto-alumno-form.tsx` — consistente con cómo ya se edita el contacto en este módulo, aunque implique más estructura para un único campo `<select>`.
3. **Botón "Guardar" standalone ya en esta HU**, no se espera a HU-B-06 (que todavía no está en el orden de implementación). Mismo criterio que HU-B-02: cada dato tiene su propio guardado independiente.
4. **`listarFormasPagoActivas()` va en `src/server/alumnos/alumno.service.ts`**, no en un archivo `forma-pago.service.ts` separado — `FormaPago` es catálogo propio del Módulo B, no justifica un archivo aparte por una sola función de lectura.

### Puntos aceptados sin objeción (propuestos por Claude Code, consistentes con precedentes ya sentados del propio módulo)

- **Sin emisión de evento de dominio** `alumno:forma_pago_actualizada`: mismo precedente que `crearAlumno()`/`actualizarContactoAlumno()`, que tampoco emiten nada pese a que `spec_modulo_B.md §4` los documenta. No existe ningún mecanismo de eventos implementado en el repo real todavía; no corresponde que esta función sea la primera en introducirlo unilateralmente.
- **Conversión `"" → null` del `<select>`** (HTML nativo manda `""` para "Sin preferencia", pero `FormaPagoPreferidaSchema` espera `z.string().uuid().nullable()`): se resuelve en la capa delgada (action/route), mismo patrón ya usado en conversiones equivalentes del propio módulo.
- **Concurrencia** (revalidar `activaFormaPago` "en el momento de confirmar", criterio 6): se implementa con el mismo patrón que `actualizarContactoAlumno()` — chequeo dentro de `prisma.$transaction`, antes del update — en vez de `updateMany` atómico de la Regla N.° 7, porque el chequeo es sobre `FormaPago` y la mutación es sobre `Alumno` (filas distintas; la Regla N.° 7 aplica a condición+mutación sobre la misma fila).

### Fuera de alcance de esta historia (texto oficial del PDF)

- Administración del catálogo de formas de pago (Sprint 2, "Registrar forma de pago disponible en el centro").
- Asociación de una forma de pago a un turno y registro de pagos (Sprint 2).

### Fuera de alcance de esta task

- Cualquier dato financiero sensible (número de tarjeta, CBU, etc.) — el catálogo son solo nombres genéricos.
- Unificación con el formulario de "Modificar datos" de HU-B-06 — se implementa standalone (ver decisión 3).
- Alta de una forma de pago inactiva en el seed compartido (ver decisión 1).

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** indicar la forma de pago preferida de un alumno
**Para** agilizar la configuración de futuros turnos y cobros

**SP estimado:** 2

**Criterios de aceptación (oficiales, PDF):**

1. La ficha del alumno muestra únicamente las formas de pago activas precargadas para este Sprint. Cada opción muestra solo su nombre (por ejemplo, Efectivo o Transferencia). No se solicitan ni almacenan números de tarjeta, CBU ni otros datos financieros sensibles.
2. La preferencia es opcional y cada alumno puede tener como máximo una forma de pago preferida. La selección es de opción única e incluye la alternativa "Sin preferencia". El servidor impide que un alumno quede con más de una preferencia.
3. Al guardar una nueva opción, esta reemplaza a la preferencia anterior y se utiliza como valor inicial en operaciones futuras. En cada operación futura el valor inicial puede cambiarse puntualmente sin modificar la preferencia guardada.
4. Cambiar o quitar la preferencia no altera pagos ni turnos históricos. Los registros anteriores conservan la forma de pago con la que fueron creados.
5. Si no existen opciones activas, el sistema informa la situación y permite continuar sin una preferencia. Se muestra "No hay formas de pago disponibles. Podés continuar sin preferencia". La ausencia de opciones no impide guardar el resto de la ficha.
6. Si la forma de pago seleccionada se desactiva entre la apertura del formulario y la confirmación, no se guarda la preferencia y se informa el cambio. La validez de la opción se comprueba nuevamente en el servidor al confirmar.
7. Al guardar correctamente se muestra "Forma de pago preferida actualizada".

---

## 3. Alcance de la task

- `FormaPagoPreferidaSchema` + `actualizarFormaPagoPreferida()` + `listarFormasPagoActivas()` en el service.
- `PATCH /api/alumnos/[id]/forma-pago` (Route Handler) + Server Action equivalente.
- Página `/alumnos/[id]/forma-pago` con formulario standalone (selector + Guardar).
- Link/acción desde `ficha-alta-pago.tsx` hacia la nueva página de edición.

---

## 4. Contrato Backend

### 4.1. Schema

```typescript
export const FormaPagoPreferidaSchema = z.object({
  forma_pago_id: z.string().uuid().nullable(), // null = "Sin preferencia"
});
export type FormaPagoPreferidaInput = z.infer<typeof FormaPagoPreferidaSchema>;
```

### 4.2. Service — `actualizarFormaPagoPreferida()`

1. Si `forma_pago_id` no es `null`: verificar, dentro de una `prisma.$transaction`, que la `FormaPago` exista y tenga `activaFormaPago: true` en el momento de confirmar (no alcanza con que estuviera activa cuando se abrió el formulario). Si no está disponible: `409 FORMA_PAGO_NO_DISPONIBLE`, no se guarda, se informa el cambio.
2. Actualiza `Alumno.formaPagoPreferidaId`, reemplazando cualquier preferencia anterior (FK nullable simple, no requiere lógica adicional de "máximo una preferencia" — ya lo garantiza el modelo).
3. Si `forma_pago_id` es `null`: actualiza `Alumno.formaPagoPreferidaId` a `null` directamente ("Sin preferencia"), sin necesidad de verificar nada.
4. No modifica ningún turno o pago histórico — es únicamente el valor por defecto sugerido en operaciones futuras (regla de no retroactividad).
5. No emite evento de dominio (ver Nota de alcance).

### Service — `listarFormasPagoActivas()`

Devuelve las `FormaPago` con `activaFormaPago: true`, ordenadas por `nombreFormaPago`, proyectando solo `id` y `nombre` (sin exponer ningún otro campo del catálogo).

### 4.3. Route Handler — `PATCH /api/alumnos/[id]/forma-pago/route.ts`

- Protegido con `withPermission("alumnos:editar", ...)`.
- Valida el body con `FormaPagoPreferidaSchema.safeParse()` → 400 con `flatten()` si falla.
- Llama al service, traduce `409 FORMA_PAGO_NO_DISPONIBLE` si corresponde.

**Respuesta `200 OK`:**
```json
{ "data": { "id": "uuid", "forma_pago_preferida_id": "uuid" }, "error": null }
```

**Respuesta `409 Conflict`:**
```json
{ "data": null, "error": { "code": "FORMA_PAGO_NO_DISPONIBLE", "message": "La forma de pago seleccionada ya no está disponible" } }
```

### 4.4. Server Action — `actualizarFormaPagoPreferida()`

En `src/server/alumnos/actions.ts`, mismo patrón que `actualizarContactoAlumno()`: `verificarPermiso("alumnos:editar")` → invoca el service → `revalidatePath("/alumnos/[id]")` → traduce errores con `MENSAJES_POR_CODIGO` local → devuelve `{ data, error }` genérico (no usa `useActionState`, no aplica la excepción de la Regla N.° 5).

### 4.5. Eventos de dominio

No aplica en esta implementación (ver Nota de alcance — sin mecanismo de eventos implementado en el repo real todavía).

---

## 5. Frontend

### `/alumnos/[id]/forma-pago` (nueva)

- Formulario standalone con:
  - `<select>` nativo (sin componente `Select` de shadcn — no existe ninguno en `src/components/ui/` todavía, se usa el mismo criterio que el campo `genero` de HU-B-01).
  - Opción `<option value="">Sin preferencia</option>` + una `<option>` por cada `FormaPago` activa (`nombreFormaPago`).
  - Precargado con la preferencia actual del alumno (vía `listarFormasPagoActivas()` + el valor actual de `obtenerDetalleAlumno()`).
  - Si no hay formas de pago activas: mensaje "No hay formas de pago disponibles. Podés continuar sin preferencia", el resto del formulario (en este caso, solo el botón Guardar con "Sin preferencia" implícito) sigue disponible.
- Al guardar exitosamente: mensaje "Forma de pago preferida actualizada".
- Si el servidor devuelve `409 FORMA_PAGO_NO_DISPONIBLE`: mensaje informando que la opción seleccionada ya no está disponible, no se guarda, el usuario puede volver a elegir.
- Reutiliza `DirtyStateContext`/`ConfirmarDescarteDialog` para "Cancelar" con cambios sin guardar (mismo patrón que `contacto-alumno-form.tsx`).

### `/alumnos/[id]` (ficha)

- `ficha-alta-pago.tsx` pasa de mostrar solo el nombre de la forma de pago preferida (o "—") a incluir también un link/acción hacia `/alumnos/[id]/forma-pago`.

---

## 6. Testing

### Nivel 1 — Unitarios

No aplica (sin test runner instalado en el proyecto, mismo criterio documentado en HUs previas de este módulo).

### Nivel 2 — Integración (curl)

- Actualizar preferencia a una forma de pago activa existente → 200, `forma_pago_preferida_id` correcto.
- Actualizar preferencia a `null` ("Sin preferencia") → 200, campo queda `null`.
- Actualizar preferencia a un `forma_pago_id` inexistente → 404 o 409 (según cómo se resuelva "no existe" vs "existe pero inactiva" — a confirmar con el código real).
- Desactivar una forma de pago a mano en la BD y luego intentar seleccionarla → 409 `FORMA_PAGO_NO_DISPONIBLE`, no se guarda.
- Reactivar esa fila después del test para no dejar el catálogo alterado.
- Sin permiso `alumnos:editar` → 403.
- Sin sesión → 401.
- Body inválido (`forma_pago_id` no es UUID ni `null`) → 400.
- `GET` del listado de formas de pago activas (si se expone como endpoint propio, o verificado indirectamente vía la página) → solo trae las `activaFormaPago: true`.

### Nivel 3 — BD

- Verificar que `Alumno.formaPagoPreferidaId` se actualiza correctamente tras cada operación exitosa.
- Verificar que ningún turno/pago histórico (si existiera alguno de prueba) cambia al modificar la preferencia.

---

## 7. Checklist DoD

- [ ] `FormaPagoPreferidaSchema`, `actualizarFormaPagoPreferida()` y `listarFormasPagoActivas()` implementados.
- [ ] `PATCH /api/alumnos/[id]/forma-pago` implementado y protegido con `alumnos:editar`.
- [ ] Server Action implementada, `{ data, error }` genérico.
- [ ] Página `/alumnos/[id]/forma-pago` implementada, con los 7 criterios de aceptación cubiertos explícitamente.
- [ ] `ficha-alta-pago.tsx` actualizado con el link de edición.
- [ ] `npm run lint` y `npm run build` limpios.
- [ ] Nivel 2 (curl) con evidencia real de los 8 casos.
- [ ] Nivel 3 (BD) con evidencia real.
- [ ] Verificado manualmente por Adriel en el navegador antes del commit final, incluyendo el caso de "forma de pago desactivada entre apertura y confirmación" (probado a mano en dos pestañas o desactivando por SQL mientras el formulario está abierto).

---

## 8. Correcciones posteriores

**Desviación del contrato literal — `forma_pago_id` no es `.uuid()` (encontrada e implementada 2026-09-23):**

`FormaPagoPreferidaSchema` (`spec_modulo_B.md §2.3` y sección 4.1 de esta task) especifica `forma_pago_id: z.string().uuid().nullable()`. Al implementar, se verificó contra la BD real que los `idFormaPago` de las 4 formas de pago sembradas **no son UUID** — son slugs fijos (`formapago-efectivo`, `formapago-transferencia`, `formapago-debito`, `formapago-mercado-pago`), hardcodeados directamente en la migración histórica `20260921210000_sprint1_modelo_completo`, que convirtió lo que originalmente era un enum `FormaPago` en la tabla catálogo actual (`INSERT INTO "formas_pago" ("idFormaPago", ...) VALUES ('formapago-efectivo', ...)`, sin pasar por `@default(cuid())`).

Con `.uuid()` literal, **ninguna** de las 4 formas de pago reales pasaría la validación — todo intento de guardar una preferencia distinta de "Sin preferencia" devolvería `400 VALIDACION` siempre, dejando la funcionalidad completamente rota. Se confirmó además que `.uuid()` no se usa en ningún otro lugar del proyecto para validar un id (`grep` sin más resultados) — todo el resto del código trata los ids como strings opacos, sin exigir ningún formato particular (ni UUID ni cuid).

**Cambio aplicado:** `forma_pago_id: z.string().min(1).nullable()` en `src/server/alumnos/alumno.schema.ts`, en vez de `.uuid()`.

**Esta discrepancia entre la spec y el modelo real es preexistente a esta HU** — no la introdujo la implementación de HU-B-03. Ya estaba latente desde que la migración `20260921210000_sprint1_modelo_completo` fijó esos ids como slugs, antes de que `spec_modulo_B.md §2.3` se escribiera con `.uuid()` en el contrato. Queda registrada acá porque HU-B-03 es la primera HU que efectivamente ejecuta esa validación contra datos reales.
