# TASK: HU-<LETRA><n> — <Nombre corto de la HU>

**Módulo:** <Letra> (<Nombre del módulo>)
**Sprint:** <N>
**Contrato de referencia:** `docs/specs/spec_modulo_<letra>.md` sección <N> · reglas sección <N> · eventos sección 4
**RBAC:** <permisos que ya existen y no se tocan en esta task, o los que hay que crear>
**Schema:** <si ya está migrado, aclarar "ya completo, sin migración"; si no, qué modelo/campo hay que agregar>

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:
- **Archivos nuevos a crear** (ruta exacta, uno por uno).
- **Archivos existentes a modificar** (ruta exacta + qué cambia en cada uno).
- Todo punto marcado en esta task como **"relevar antes de asumir"** — con la pregunta concreta, nunca resuelto por inferencia propia del agente.

No se procede a la implementación (sección 4 en adelante) hasta recibir el OK sobre este relevamiento. Si el relevamiento no encuentra nada que relevar (todo está resuelto en la task), igual se lista el detalle de archivos a crear/modificar antes de tocar código.

---

## 1. Nota de alcance <si aplica desacoplamiento de otra HU no implementada, explicarlo acá — ver ejemplo HU-B4>

<Decisión de alcance explícita si el contrato real difiere de lo que la spec narra en prosa, y de qué otras HUs depende esta implementación (o explícitamente de cuáles NO depende).>

**Fuera de alcance de esta task (explícito):**
- <ítem que la HU roza pero no implementa, y por qué>
- <ítem 2>

---

## 2. Historia de Usuario

**Como** <rol>
**Necesito** <funcionalidad>
**Para** <objetivo de negocio>

**SP estimado:** <n>

---

## 3. Alcance de esta task

Implementación <frontend + backend / solo backend / etc.> conforme a `spec_modulo_<letra>.md` §<N>. Incluye:
- Capa de servicios (`lib/services/<modulo>/<nombre>.service.ts`)
- Route Handlers (`app/api/...`)
- Server Actions equivalentes (`app/(dashboard)/...`)
- Schemas Zod
- Emisión de eventos de dominio hacia el módulo de Sesión (A)
- UI: <qué pantallas/componentes>

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- <ítem>

---

## 4. Contrato Backend

### 4.1. Schema Zod

**Archivo:** `lib/schemas/<modulo>.schema.ts`

```typescript
export const <Nombre>Schema = z.object({
  // ...
});
export type <Nombre>Input = z.infer<typeof <Nombre>Schema>;
```

### 4.2. Servicio

**Archivo:** `lib/services/<modulo>/<nombre>.service.ts`
**Función:** `<nombreFuncion>(...): Promise<...>`

Comportamiento exigido, en este orden, dentro de una única `prisma.$transaction` (si toca más de una tabla — Regla N.° del RULES.md):
1. <paso>
2. <paso>
3. Commit.
4. **Después del COMMIT:** emitir el evento `<modulo>:<evento>` (ver sección 6).

**Errores de servicio a definir:** `<CODIGO_1>`, `<CODIGO_2>`.

### 4.3. Route Handler

**Archivo:** `app/api/.../route.ts`
**Método:** `<GET|POST|PATCH>`
**Permiso de acceso:** `withPermission("<modulo>:<accion>")`

### 4.4. Server Action

**Archivo:** `app/(dashboard)/.../actions.ts`
**Función:** `<nombreFuncion>()` — wrapper delgado sobre el servicio (validar sesión, invocar servicio, `revalidatePath` si aplica).

### 4.5. Eventos de dominio

**Archivo:** `lib/events/event-types.ts` — agregar `<modulo>:<evento>` si no existe declarado.
**Listener de auditoría:** handler en `audit-log.listener.ts`, patrón `void registrarAuditLog(...)` — nunca `await`, el servicio nunca llama `registrarAuditLog()` directo (Regla N.° 2).

---

## 5. Frontend

- <pantalla/componente 1, con qué gatea la acción por permiso>
- <pantalla/componente 2>
- Seguir la guía de diseño del proyecto (shadcn/ui + Tailwind).

**Fuera de alcance de frontend:** <si corresponde>

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios
- <caso de éxito>
- <caso de error 1>
- <caso de error 2>
- Emisión de evento después del `COMMIT`, no dentro de la transacción (mock/spy).

### Nivel 2 — Postman
- <request exitoso> → `2xx`, cuerpo conforme spec.
- <request con error esperado> → `4xx` con código correcto.

### Nivel 3 — BD / TablePlus
- Verificar columnas relevantes (`is_active`, `deleted_at`, campos de estado) tras la operación.
- Verificar en `AuditLog` que el evento fue escrito con encadenamiento SHA-256 intacto.

**Evidencia esperada:** Postman + SQL para el contrato de API y capa de datos; capturas de UI si hay frontend.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] Service, Route Handler y Server Action implementados, sin lógica de negocio fuera de la capa de servicios.
- [ ] Endpoints responden con el shape estándar `{ data, error }` y status codes semánticos.
- [ ] Eventos de dominio emitidos tras `COMMIT`, nunca dentro de la transacción.
- [ ] Frontend funcional (si aplica).
- [ ] Ningún `DELETE` físico en ningún punto del código.
- [ ] Tests de los 3 niveles documentados con evidencia.
- [ ] PR con diff acotado exclusivamente a esta HU.