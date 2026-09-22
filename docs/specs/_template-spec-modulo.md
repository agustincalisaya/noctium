```markdown
# Especificación Técnica — Módulo <LETRA> (<Nombre del Módulo>)
## Noctium — Sprint <N>
## Revisión <N> — <motivo de esta revisión, si no es la primera>

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · Node.js 24 · PostgreSQL 16 · Prisma ORM (`prisma-client`) · Zod · NextAuth
**Referencias normativas:** `docs/RULES.md` (Reglas N.° <...>) · `schema.prisma` · <otros documentos de referencia: backlog, doc de alcance, etc.>

<!-- Solo si esta revisión modifica o amplía secciones existentes -->
**Changelog de esta revisión (trazabilidad Backlog → Spec):**
| HU | Estado previo | Acción |
|---|---|---|
| HU-<LETRA><n> | Gap — no contractualizada | Añadida sección 2.<n> |

---

## 1. Visión General

<Qué subsistema es este módulo, qué entidades principales gestiona, cómo se ubica en la arquitectura Next.js App Router (Route Handlers vs. Server Actions vs. capa de servicios). Si alguna HU fue cancelada o quedó fuera de alcance, se nota acá con la fecha/motivo de la decisión.>

**Alcance de esta revisión:** <qué secciones son nuevas/aditivas y por qué no se renumeran las preexistentes — ver docs/sdd-metodologia.md>.

---

## 2. Interfaces y Contratos (Route Handlers / Server Actions)

### Convenciones generales
- Contrato de respuesta estándar y validación Zod previa: ver `docs/RULES.md` Reglas N.° 5 y 6.
- Toda ruta requiere sesión autenticada y permiso granular vía `withPermission("<modulo>:<accion>")` (Regla N.° 10).

---

### 2.1. <Nombre de la operación — HU-<LETRA><n>>

**Ruta:** `<MÉTODO> /app/api/<recurso>/route.ts`
**Server Action equivalente:** `<nombreFuncion>()` en `app/(dashboard)/<seccion>/actions.ts`

```typescript
// lib/schemas/<modulo>.schema.ts
export const <Nombre>Schema = z.object({
  // ...
});
export type <Nombre>Input = z.infer<typeof <Nombre>Schema>;
```

**Comportamiento esperado:**
- <paso a paso de lo que hace la capa de servicios>

**Respuesta `2xx`:**
```json
{ "data": { }, "error": null }
```

**Errores esperados:**
- `400 VALIDATION_ERROR` — ...
- `404 <ENTIDAD>_NO_ENCONTRADA` — ...
- `409 <CODIGO>` — ...
- `422 <CODIGO>` — ...

---

<!-- Repetir 2.N por cada HU/operación contractualizada del módulo -->

---

## 3. Reglas de Negocio Estrictas (Capa de Servicios)

Toda la lógica listada reside exclusivamente en `lib/services/<modulo>/*.service.ts`. Route Handlers y Server Actions son capa delgada (Regla N.° 4).

### 3.1. <Nombre de la regla>
<Descripción + patrón de código obligatorio si aplica (ver Regla N.° 7 de concurrencia como ejemplo).>

<!-- Repetir 3.N por cada regla no trivial -->

---

## 4. Eventos de Dominio (EDA)

Conforme a `docs/RULES.md` Regla N.° 2: todo evento se emite **después** del `COMMIT`, nunca dentro de la transacción.

| Evento | Disparado por | Payload mínimo |
|---|---|---|
| `<modulo>:<evento>` | <sección 2.N> | `<campo1>, <campo2>, usuario_id` |
```