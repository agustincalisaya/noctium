# RULES.md — Reglas No Negociables del Proyecto Noctium

**Metodología:** Specification-Driven Development (SDD)
**Stack:** Next.js 16 (App Router) · TypeScript · Node.js 24 · PostgreSQL 16 (Docker) · Prisma ORM (generator `prisma-client`) · NextAuth (Credentials Provider) · Tailwind CSS · shadcn/ui

Estas reglas son de cumplimiento obligatorio en todo el código de Noctium. Toda spec de módulo (`docs/specs/spec_modulo_<letra>.md`) y toda task de HU (`docs/tasks/HU-<letra><n>.md`) deben ser consistentes con ellas. Si una excepción puntual es necesaria, se documenta explícitamente en la spec/task correspondiente — nunca se aplica en silencio.

---

## Regla N.° 1 — Prohibido el borrado físico (`DELETE`)
Ninguna entidad del dominio se elimina con `DELETE`. Toda "baja" es una actualización lógica: `is_active: false`, `deleted_at: DateTime`, `deleted_by: <usuario_id>`, `deletion_reason: string`. Cada spec de módulo define cuándo `deletion_reason` es obligatorio (p. ej. condicionado a que la entidad tenga turnos, pagos o historial activo asociado). Los registros dados de baja se preservan siempre — turnos pasados, pagos, historial académico nunca se pierden.

## Regla N.° 2 — Trazabilidad de mutaciones sensibles
Toda mutación sensible (alta, baja lógica, edición, transición de estado) registra de forma verificable **qué** ocurrió, **cuándo** y **quién** la realizó. El mecanismo se elige por caso, sin necesidad de infraestructura de eventos asíncrona ni encadenamiento por hash:

- **(a) Columnas de auditoría en la propia entidad** (`created_at`, `creado_por_usuario_id`, `updated_at`, etc.) — patrón por defecto cuando la trazabilidad requerida es la del ciclo de vida normal del registro (quién y cuándo lo creó/modificó).
- **(b) Escritura directa y síncrona a una tabla de eventos por dominio** — cuando se necesita registrar múltiples eventos discretos sobre la misma entidad a lo largo del tiempo (intentos, cambios de estado repetibles, eventos de seguridad). Ver `EventoSeguridad` (módulo A) como patrón de referencia.

La escritura ocurre **después** de que `prisma.$transaction` resuelva exitosamente cuando el registro de trazabilidad es una tabla separada (opción b) — nunca dentro de la misma transacción de negocio, para no acoplar el commit de datos a una escritura secundaria. Cuando la trazabilidad es parte de la propia fila (opción a), se persiste en la misma operación.

Cada spec de módulo indica cuál de las dos opciones usa y por qué, como parte de su documentación normal — no hace falta una nota de excepción cada vez que se elige (a) por sobre (b) o viceversa.

> Nota de historial: esta regla reemplaza una versión anterior que exigía un event bus asíncrono y un `AuditLog` encadenado por hash SHA-256. Se ajustó porque ningún requisito externo (cátedra/PO) pedía ese nivel de garantía, y los primeros módulos implementados (A y L) ya habían resuelto la trazabilidad de forma efectiva con columnas de auditoría y escritura directa. Decisión de equipo, revisada a partir de la implementación real.

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