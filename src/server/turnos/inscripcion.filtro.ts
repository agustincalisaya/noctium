import type { EstadoTurno, Prisma } from "@prisma/client";

/**
 * Filtro de Prisma equivalente a `esVigenteEn` (PR-0.md §2.2) sobre
 * `turno_alumno`, para las lecturas por la relación `Turno.alumnos` (`some`,
 * `none`, `_count`, `include`): vigente y, si es una reserva de una clase
 * Disponible o Completa, todavía no vencida a `momento`. Archivo sin
 * dependencias de servidor (solo tipos), porque lo usa `turno.disponibilidad.ts`,
 * que también importa un componente de cliente.
 */
export function filtroVigenteEn(momento: Date): Prisma.TurnoAlumnoWhereInput {
  const confirmados: EstadoTurno[] = ["DISPONIBLE", "COMPLETO"];
  return {
    vigencia: "VIGENTE",
    OR: [
      { estadoPago: { not: "RESERVADA" } },
      { venceEl: null },
      { venceEl: { gt: momento } },
      { turno: { estadoTurno: { notIn: confirmados } } },
    ],
  };
}
