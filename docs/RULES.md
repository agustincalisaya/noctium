# RULES.md — Reglas No Negociables del Proyecto Noctium

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · TypeScript · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (generator `prisma-client`) · NextAuth (Credentials Provider) · Tailwind CSS · shadcn/ui

Estas reglas son de cumplimiento obligatorio en todo el código de Noctium. Toda spec de módulo (`docs/specs/spec_modulo_<letra>.md`) y toda task de HU (`docs/tasks/HU-<letra><n>.md`) deben ser consistentes con ellas. Si una excepción puntual es necesaria, se documenta explícitamente en la spec/task correspondiente — nunca se aplica en silencio.

---

## Regla N.° 1 — Prohibido el borrado físico (`DELETE`)
Ninguna entidad del dominio se elimina con `DELETE`. Toda "baja" es una actualización lógica: `is_active: false`, `deleted_at: DateTime`, `deleted_by: <usuario_id>`, `deletion_reason: string`. Cada spec de módulo define cuándo `deletion_reason` es obligatorio (p. ej. condicionado a que la entidad tenga turnos, pagos o historial activo asociado). Los registros dados de baja se preservan siempre — turnos pasados, pagos, historial académico nunca se pierden.

## Regla N.° 2 — Auditoría inmutable encadenada
Toda mutación sensible (altas, bajas lógicas, ediciones, transiciones de estado) emite un evento de dominio, consumido de forma **asíncrona** por el módulo de Sesión/Seguridad (A) para construir un `AuditLog` encadenado por hash (SHA-256 sobre `payload + hash_anterior`). Ningún servicio de negocio escribe `AuditLog` de forma directa o sincrónica.

**Regla de emisión:** el evento se publica **después** de que `prisma.$transaction` resuelva exitosamente — nunca dentro de la transacción, para no acoplar el commit de datos a un consumidor lento.

## Regla N.° 3 — Aislamiento de dominio entre módulos
Un módulo no valida ni consulta directamente tablas internas de otro módulo. La comunicación entre módulos ocurre exclusivamente vía: (a) eventos de dominio, o (b) llamadas explícitas a la capa de servicios **pública** del otro módulo. Ejemplo: Pagos (I) no valida un Turno (C) leyendo su tabla — invoca el servicio público de Turnos o reacciona a su evento.

## Regla N.° 4 — La capa de servicios es la única dueña de la lógica de negocio
Route Handlers (`app/api/**/route.ts`) y Server Actions (`app/**/actions.ts`) son capa delgada: validan el payload con Zod, verifican sesión/permiso, invocan `lib/services/<modulo>/*.service.ts` y traducen el resultado al contrato de respuesta estándar. Ninguna regla de negocio vive en un Route Handler o Server Action.

## Regla N.° 5 — Contrato de respuesta estándar
- **Route Handlers:** éxito → `NextResponse.json({ data, error: null }, { status })`; error → `NextResponse.json({ data: null, error: { code, message } }, { status })`, con `status` semántico (400/401/403/404/409/422).
- **Server Actions:** mismo shape como objeto plano serializable (`return { data, error: null }` / `return { data: null, error: {...} }`) — nunca retornan una instancia de `NextResponse`.

## Regla N.° 6 — Validación Zod previa a la capa de servicios
Todo payload se valida con `schema.safeParse()` antes de tocar la capa de servicios. Un `!success` retorna `400` con el `flatten()` del error de Zod.

## Regla N.° 7 — Concurrencia: condición y mutación en una única sentencia atómica
Prisma sobre PostgreSQL bajo `READ COMMITTED` no aplica bloqueo pesimista implícito. Toda operación que dependa de un estado previo para decidir si puede ejecutarse (cupo de un turno, saldo, umbral de stock/monto) debe resolver la condición y la mutación en una sola sentencia (`updateMany` con la condición dentro del `where`), nunca con `findUnique` + `update` separados. `count === 0` significa que la condición no se cumplía al momento de ejecutar — no asumir que la fila no existe.

```typescript
// Patrón obligatorio — ejemplo genérico (cupo de turno)
const resultado = await tx.turno.updateMany({
  where: { id: turnoId, cupos_disponibles: { gte: 1 } },
  data: { cupos_disponibles: { decrement: 1 } },
});
if (resultado.count === 0) throw new ServiceError("CUPO_INSUFICIENTE");
```

## Regla N.° 8 — Inmutabilidad de registros de hecho consumado
Registros que representan un hecho ya ocurrido (un pago confirmado, un movimiento de historial académico, una asistencia registrada) no admiten `UPDATE` una vez insertados. Toda corrección se resuelve con un registro compensatorio nuevo que referencia al original.

## Regla N.° 9 — Inyección de credenciales y secretos
Ninguna clave, secreto o credencial se hardcodea. Toda credencial (`NEXTAUTH_SECRET`, credenciales de Mercado Pago, etc.) se lee exclusivamente desde variables de entorno inyectadas vía `.env` / secretos de Docker.

## Regla N.° 10 — RBAC granular por acción
Toda ruta protegida requiere sesión autenticada (NextAuth) y verificación de permiso granular por acción (`withPermission("<modulo>:<accion>")`), nunca solo por rol genérico. La matriz de permisos por rol (mesa de entradas, profesor, gerente, alumno) se documenta y mantiene junto a `spec_modulo_A.md`.

