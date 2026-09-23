# TASK: HU-B-02 — Registrar datos de contacto del alumno

**Módulo:** B (Alumno)
**Sprint:** 1
**Contrato de referencia:** `docs/specs/spec_modulo_B.md` sección 2.2 · reglas sección 3.2 (aislamiento de dominio) · eventos sección 4 · ver Nota de alcance
**RBAC:** `alumnos:editar` — **nuevo**, exclusivo de MESA_ENTRADA (no existe todavía en el seed; hoy solo está `alumnos:crear`)
**Schema:** ya completo, sin migración — `Alumno` ya tiene `telefonoAlumno`, `emailAlumno`, `modificadoPorUsuarioId`, `updatedAtAlumno` (`@updatedAt`)
**Estructura de carpetas:** conforme a la Regla N.° 11 de `RULES.md` (agregada el 2026-09-23, después de la primera versión de esta task — ver corrección en sección 0)

---

## 0. Relevamiento previo a implementación (Claude Code)

Relevamiento realizado el 2026-09-23 con `develop` actualizado (HU-D-01 `bd6a8f0`, HU-D-02 `7bebd36` ya mergeadas), y verificado contra el texto completo y literal de `spec_modulo_B.md` §2.2 (documento oficial, subido al proyecto de referencia el mismo día). Resultado con las decisiones ya resueltas.

**Archivos nuevos a crear:**

| Archivo | Contenido |
|---|---|
| `src/app/api/alumnos/[id]/contacto/route.ts` | Route Handler `PATCH` — exigido literalmente por `spec_modulo_B.md` §2.2 |
| `src/app/(dashboard)/alumnos/[id]/page.tsx` *(reemplaza el stub actual "Detalle de alumno - en construcción")* | Ficha del alumno: encabezado + sección de contacto |
| `src/app/(dashboard)/alumnos/[id]/ficha-encabezado.tsx` | Encabezado de la ficha (apellido, nombre, DNI, estado) |
| `src/app/(dashboard)/alumnos/[id]/ficha-contacto.tsx` | Sección de contacto con botón "Editar contacto" / "Cargar contacto" |
| `src/app/(dashboard)/alumnos/[id]/contacto/page.tsx` | Server Component: chequeo de permiso `alumnos:editar` con redirect, trae el contacto actual |
| `src/app/(dashboard)/alumnos/[id]/contacto/contacto-alumno-form.tsx` | Formulario cliente |
| `src/types/alumno.types.ts` | Tipos de la ficha — ubicación fijada por Regla N.° 11 de `RULES.md` (no `alumno.types.ts` suelto junto a la ruta) |
| `src/server/alumnos/actions.ts` | Server Action `actualizarContactoAlumno(alumnoId, formData)` — ubicación fijada por Regla N.° 11 (no `src/app/(dashboard)/alumnos/actions.ts`) |

**Archivos existentes a modificar:**

| Archivo | Cambio |
|---|---|
| `src/server/alumnos/alumno.schema.ts` | Agregar `ContactoAlumnoSchema` — reexport de `src/server/shared/contacto.schema.ts` (`ContactoSchema`), que ya implementa exactamente las reglas que documenta `spec_modulo_B.md` §2.2 (teléfono normalizado 8-15 dígitos, email trim+lowercase+máx 254, al menos uno obligatorio) |
| `src/server/alumnos/alumno.service.ts` | Agregar `obtenerFichaAlumno()` y `actualizarContactoAlumno()` |
| `prisma/seed.ts` | Agregar upsert de `alumnos:editar`, exclusivo MESA_ENTRADA |

**Nota sobre Regla N.° 11:** el código ya mergeado de HU-B-01 (`src/app/(dashboard)/alumnos/actions.ts`) y de HU-D-02 (`src/app/(dashboard)/profesores/actions.ts`, `profesor.types.ts` junto a la ruta) **no** sigue esta estructura — es código legado anterior a la regla, no una excepción vigente. Esta task no migra ese código existente (fuera de alcance), pero todo lo nuevo que crea sí sigue la Regla N.° 11 al pie de la letra. Si `src/server/alumnos/actions.ts` ya existiera con otra función (no debería, HU-B-01 usó la ubicación vieja), avisar antes de tocarlo.

**Adicional a relevar antes de implementar:** revisar si `contacto-alumno-form.tsx` va a consumir la Server Action vía `useActionState` (como `materia-form.tsx`/`contacto-profesor-form.tsx`, si estos últimos lo hacen). De ser así, aplica la excepción de la Regla N.° 5 de `RULES.md`: el shape de retorno de la action es el estado específico del formulario (no el `{data, error}` genérico), y la traducción de código de error a mensaje de UI vive en la action, no en el service. Confirmarlo contra el código real de `contacto-profesor-form.tsx` antes de definir la firma exacta.

**Punto marcado como deuda/riesgo, no ambigüedad a resolver acá:** la verificación de email duplicado (`spec_modulo_B.md` §2.2, punto 2 de "Comportamiento esperado") es una query directa de Prisma contra `Usuario` (tabla de Módulo A) dentro de la transacción de `alumno.service.ts`. El texto literal de la Regla N.° 3 de `RULES.md` ("Un módulo no valida ni consulta directamente tablas internas de otro módulo") no distingue lectura de escritura, mientras que `spec_modulo_B.md` §3.2 solo prohíbe explícitamente la creación/modificación directa de `Usuario`, no la lectura. Documentado como deuda técnica / posible tensión entre `RULES.md` y `spec_modulo_B.md`, a resolver por el equipo de forma centralizada — no como un fix unilateral de esta task.

---

## 1. Nota de alcance

**Decisiones resueltas (Adriel, 2026-09-23):**

1. **Route Handler (corrección tras leer `spec_modulo_B.md` directamente):** `spec_modulo_B.md` §2.2 exige explícitamente `PATCH /app/api/alumnos/[id]/contacto/route.ts`, además de la Server Action equivalente. **Se implementa el Route Handler**, siguiendo el contrato literal de la spec oficial de Módulo B y el precedente ya sentado dentro del propio módulo por HU-B-01 (que sí tiene Route Handler + Server Action). Esta HU se guía por su propio contrato documentado, no por atajos tomados en otras HU de otros módulos.
2. **Aislamiento de dominio (Regla N.° 3 de RULES.md):** se implementa la verificación de email duplicado como query directa de Prisma a `Usuario` dentro de la transacción de `actualizarContactoAlumno()` — es lo que exige `spec_modulo_B.md` §2.2 en la práctica, dado que no existe hoy ningún servicio público de Módulo A para esto. **Queda documentado como deuda técnica / posible tensión entre RULES.md N.° 3 y la spec, a resolver por el equipo** — no se crea código nuevo en Módulo A dentro de esta task.
3. **Permiso `alumnos:editar`:** exclusivo de MESA_ENTRADA (mismo criterio que `alumnos:crear` de HU-B-01).
4. **Payload de la Server Action:** `actualizarContactoAlumno()` recibe `FormData`.
5. **Mensaje de error 409:** textual a `spec_modulo_B.md` §2.2 — **"Ese email ya está asociado a una cuenta existente"**.

**Piezas de código genuinamente compartidas, reutilizadas sin reimplementar** (esto no es "copiar el scope de otra HU", es la utilidad misma que la spec pide reusar — `spec_modulo_B.md` §2.2 dice textual: "mismo requisito en `spec_modulo_D.md` §2.2"):
- `src/server/shared/contacto.schema.ts` (`ContactoSchema`)
- `src/server/shared/contacto.ts` (`normalizarTelefono()`, `contarDigitosTelefono()`)
- `src/lib/enfocar-primer-invalido.ts` (`enfocarPrimerCampoInvalido()`)
- `src/components/shared/confirmar-descarte-dialog.tsx` (`ConfirmarDescarteDialog`, usado junto con `useDirtyState()` — no son mecanismos alternativos, es estado + UI)

**Fuera de alcance de esta historia** (textual del documento oficial "Historias de Usuario - Sprint 1", no una decisión de esta task):
- Verificación del email mediante código (esa verificación solo aplica en el autorregistro, HU-B-08 — acá alcanza con la validación de formato + unicidad).
- Registro de múltiples teléfonos o emails por alumno (un solo teléfono, un solo email).
- Envío de notificaciones o recordatorios (esta HU solo guarda el dato de contacto, no dispara ninguna comunicación).

**Fuera de alcance de esta task (adicional, decisiones de implementación):**
- Corregir la tensión RULES.md N.°3 / spec, ni en esta HU ni en HU-D-02.
- Listado completo de alumnos (HU-B-04) — la ficha `/alumnos/[id]` se agrega para esta HU puntual, no se construye el listado ni su Route Handler `GET` (ese es contrato de HU-B-04, `spec_modulo_B.md` §2.4).
- Forma de pago preferida (HU-B-03).
- Modificar identidad (HU-B-06).
- Emisión de eventos de dominio: `spec_modulo_B.md` §4 lista `alumno:contacto_actualizado` como evento a emitir tras el commit. **No se implementa** — mismo criterio ya resuelto a nivel de proyecto: `RULES.md` Regla N.° 2 (reescrita) no exige tabla de eventos para trazabilidad de ciclo de vida normal, y no existe infraestructura de eventos en el código real (mismo camino que tomó HU-D-02 con `profesor:contacto_actualizado`). La trazabilidad queda en `modificadoPorUsuarioId` / `updatedAtAlumno` (patrón (a) de la Regla N.° 2).

---

## 2. Historia de Usuario

**Como** personal de mesa de entrada
**Necesito** registrar los datos de contacto de un alumno
**Para** comunicarle turnos y novedades del centro

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación frontend + backend conforme a `spec_modulo_B.md` §2.2. Incluye:

- Schema Zod: `ContactoAlumnoSchema` (reexport de `ContactoSchema` compartido).
- Servicio (`src/server/alumnos/alumno.service.ts`): `obtenerFichaAlumno()` y `actualizarContactoAlumno()`.
- Route Handler `PATCH /api/alumnos/[id]/contacto`.
- Server Action equivalente (`src/server/alumnos/actions.ts` → `actualizarContactoAlumno(alumnoId, formData)`).
- Tipos de dominio en `src/types/alumno.types.ts`.
- Permiso `alumnos:editar`, exclusivo MESA_ENTRADA.
- UI: ficha del alumno (`/alumnos/[id]`) con sección de contacto, y formulario de edición (`/alumnos/[id]/contacto`).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia): todo lo indicado en la sección 1.

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `src/server/alumnos/alumno.schema.ts`

```typescript
import { ContactoSchema } from "@/server/shared/contacto.schema";

export const ContactoAlumnoSchema = ContactoSchema;
export type ContactoAlumnoInput = z.infer<typeof ContactoAlumnoSchema>;
```

### 4.2. Servicio

**Archivo:** `src/server/alumnos/alumno.service.ts`
**Funciones:** `obtenerFichaAlumno(alumnoId)`, `actualizarContactoAlumno(alumnoId, input, usuarioId)`

Comportamiento exigido por `spec_modulo_B.md` §2.2, dentro de una única `prisma.$transaction`:
1. Verificar que el alumno exista (activo o inactivo).
2. Si se informa `telefono`: ya viene normalizado por `ContactoSchema`/`normalizarTelefono()` (8-15 dígitos, conserva `+` inicial).
3. Si se informa `email`: verificar que no pertenezca a otra cuenta (`tx.usuario.findFirst` sobre `emailUsuario`, `mode: "insensitive"`, excluyendo la cuenta vinculada al propio alumno vía `usuarioId`). Ver Nota de alcance, punto 2.
4. Actualizar únicamente los campos provistos, `modificadoPorUsuarioId` y `updatedAtAlumno` (automático vía `@updatedAt`).
5. Commit. **No** se emite evento (ver Nota de alcance).

**Errores de servicio:** `ALUMNO_NO_ENCONTRADO`, `EMAIL_YA_ASOCIADO`.

### 4.3. Route Handler

**Archivo:** `src/app/api/alumnos/[id]/contacto/route.ts`
**Método:** `PATCH`
**Permiso de acceso:** `withPermission("alumnos:editar")`

Wrapper delgado: valida el payload con `ContactoAlumnoSchema.safeParse()` (Regla N.° 6), invoca `actualizarContactoAlumno()`, traduce al contrato estándar (Regla N.° 5):

- `200 OK`: `{ "data": { "id": "...", "telefono": "...", "email": "..." }, "error": null }`
- `409 Conflict`: `{ "data": null, "error": { "code": "EMAIL_YA_ASOCIADO", "message": "Ese email ya está asociado a una cuenta existente" } }`
- `404`: alumno inexistente.

### 4.4. Server Action

**Archivo:** `src/server/alumnos/actions.ts` (Regla N.° 11 de `RULES.md`)
**Función:** `actualizarContactoAlumno(alumnoId: string, formData: FormData)` — mismo comportamiento que el Route Handler, como objeto plano serializable (nunca `NextResponse`), salvo que esté ligada a `useActionState` (ver nota de la sección 0, Regla N.° 5). Traduce `EMAIL_YA_ASOCIADO` a error del campo email; cualquier error no previsto → "No se pudo conectar. Intentá nuevamente". `revalidatePath` de la ficha.

### 4.5. Eventos de dominio

No aplica en esta implementación — ver Nota de alcance, "Fuera de alcance".

---

## 5. Frontend

- `/alumnos/[id]` — ficha del alumno: encabezado (apellido, nombre, DNI, estado) + sección "Datos de contacto" con botón "Editar contacto" o "Cargar contacto" (según haya datos previos).
- `/alumnos/[id]/contacto` — formulario con precarga del contacto actual, validación con `ContactoAlumnoSchema` en cliente y servidor, foco al primer campo inválido vía `enfocarPrimerCampoInvalido()`, botón deshabilitado + spinner durante el envío, `useDirtyState()` + `ConfirmarDescarteDialog` para Cancelar con confirmación.
- Seguir `docs/DESIGN.md` (tokens de shadcn/ui + Tailwind — nunca colores hex ni paleta default de Tailwind directamente en componentes). En particular: el mensaje de éxito ("Datos de contacto del alumno guardados correctamente") usa `bg-success`/`text-success-foreground` — nunca `bg-emerald-*` hardcodeado, para no repetir el mismo bug que se corrigió en HU-B-01.

**Fuera de alcance de frontend:** listado de alumnos (HU-B-04), edición de identidad (HU-B-06).

---

## 6. Testing (tres niveles, según metodología del proyecto)

> **Nota:** el proyecto no tiene test runner instalado (`vitest` se importa en archivos `*.test.ts` existentes, pero no está instalado ni hay script `test`; excluidos del build vía `tsconfig.json`). El Nivel 1 no es ejecutable hoy — documentar los casos igual, dejando aclarado que no corrieron.

### Nivel 1 — Unitarios (no ejecutables por ahora, documentar igual)
- `actualizarContactoAlumno()`: caso de éxito, alumno inexistente, email ya asociado a otra cuenta (propia cuenta del alumno permitido).

### Nivel 2 — Postman / curl
- Envío válido (solo teléfono, solo email, ambos) → `200`.
- Ambos vacíos → `4xx`, "Ingresá al menos un teléfono o un email de contacto".
- Teléfono/email inválido → `4xx` con el mensaje específico.
- Email de otra cuenta → `409 EMAIL_YA_ASOCIADO`, mensaje exacto "Ese email ya está asociado a una cuenta existente".
- Sin permiso (rol distinto de MESA_ENTRADA) → `403`.
- Alumno inexistente → `404`.
- Probar contra el Route Handler real (`PATCH /api/alumnos/[id]/contacto`), no solo la Server Action.

### Nivel 3 — BD / TablePlus
- Verificar `telefonoAlumno`, `emailAlumno`, `modificadoPorUsuarioId`, `updatedAtAlumno` tras la operación.
- Verificar que vaciar un campo lo guarde como `null`, siempre que quede al menos uno cargado.

**Evidencia esperada:** curl/Postman + SQL; capturas de UI del flujo completo (ficha → editar contacto → guardado → ficha actualizada).

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] Service, Route Handler y Server Action implementados, sin lógica de negocio fuera de la capa de servicios.
- [ ] Endpoint responde con el shape estándar `{ data, error }` y status codes semánticos.
- [ ] Reutiliza `ContactoSchema`, `normalizarTelefono()`, `enfocarPrimerCampoInvalido()`, `ConfirmarDescarteDialog` — sin reimplementar.
- [ ] Permiso `alumnos:editar` agregado al seed, exclusivo MESA_ENTRADA.
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Frontend funcional: ficha `/alumnos/[id]` + formulario `/alumnos/[id]/contacto`.
- [ ] `npm run lint` y `npm run build` corren limpios.
- [ ] Tests de los niveles 2 y 3 documentados con evidencia (Nivel 1 documentado como no ejecutable, ver sección 6).
- [ ] PR con diff acotado exclusivamente a esta HU — sin tocar código de Módulo A ni de otros módulos.
- [ ] Verificado manualmente por Adriel en el navegador antes del commit final.

---

## 8. Correcciones posteriores

### 8.1. Bug: editar un solo campo borraba el otro (reportado por Adriel tras probar en el navegador, 2026-09-23)

**Síntoma:** en `/alumnos/[id]/contacto`, editar solo el teléfono (dejando el email intacto, con un valor ya cargado) guardaba el email como vacío.

**Causa confirmada (ninguna de las dos hipótesis originales, una tercera más precisa):**
- **No** era el punto 1 (precarga del input): confirmado con lectura directa del DOM (`document.getElementById('email').value`) en tres repros distintos vía navegador (navegación directa, navegación por `<Link>`, edición real + click) — el input **sí** trae el valor precargado correctamente vía `defaultValue`, en los tres casos.
- **Sí** estaba relacionado con el punto 2, pero de forma más específica de lo planteado: el problema no era que un campo "vacío pero no tocado" se interpretara como intención de borrado — el formulario real nunca produce esa situación, porque sus dos `<input>` siempre están presentes en el `FormData` (confirmado). El problema real es que **`actualizarContactoAlumno()` en `alumno.service.ts` nunca distinguía "el campo no vino en el payload" de "vino vacío"**: escribía `telefonoAlumno`/`emailAlumno` incondicionalmente en cada `UPDATE`, con `input.telefono ?? null` / `input.email ?? null`. Esto viola el texto literal de `spec_modulo_B.md` §2.2 punto 3 ("Actualiza únicamente los campos provistos") y es alcanzable por cualquier consumidor de la API que omita una clave del payload — confirmado reproduciéndolo directamente contra el Route Handler real vía curl (`PATCH` con `{"telefono":"..."}`, sin la clave `email`) antes de tocar el formulario: el email se ponía en `NULL` igual.
- No pude reproducir pérdida de datos a través de la UI real en mis intentos (3 flujos distintos, todos preservaron el campo no tocado) — la causa confirmada es a nivel de contrato de servicio/API, no del formulario en sí, pero corresponde corregirla igual porque viola la spec y es alcanzable por Postman/otros clientes.

**Fix:** `actualizarContactoAlumno()` ahora recibe un tercer parámetro `camposProvistos: { telefono: boolean; email: boolean }`, calculado en la capa delgada **antes** de parsear con Zod (`formData.has("telefono")`/`formData.has("email")` en la Server Action; `"telefono" in body`/`"email" in body` en el Route Handler) — Zod por sí solo no alcanza porque `ContactoSchema` colapsa tanto "no provisto" como "provisto vacío" al mismo `undefined`. El `UPDATE` ahora solo incluye la columna cuando `camposProvistos.<campo>` es `true`; si es `false`, la columna ni se menciona en el `data` de Prisma (no se toca).

**Verificación post-fix:**
- `PATCH` solo `telefono` (clave `email` ausente) → email se mantiene igual, no se pisa. ✓
- `PATCH` con `email: ""` (clave presente, valor vacío — vaciado explícito) → email se guarda `NULL`. ✓ (comportamiento de "vaciar campo" intacto)
- `PATCH` solo `email` (clave `telefono` ausente) → teléfono se mantiene igual. ✓
- Matriz completa de Nivel 2 (ambos vacíos, email de otra cuenta, email de cuenta propia) re-corrida sin regresiones.
- Re-verificado en navegador real: editar solo teléfono con email precargado → pantalla de éxito y ficha muestran el email intacto, confirmado también en BD.
- `npm run lint` y `npm run build` corridos de nuevo tras el fix — limpios.

**Nota:** el patrón original (escribir ambos campos siempre) es el mismo que usa `actualizarContactoProfesor()` de HU-D-02 — ese código ya mergeado a develop tiene la misma clase de bug latente, alcanzable de la misma forma (payload con una clave omitida). No se tocó en esta task (fuera de alcance, es código de otro módulo/HU ya mergeada) — queda como hallazgo a reportar aparte.