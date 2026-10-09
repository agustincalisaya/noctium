import { Prisma, type EstadoTurno } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Lecturas de clases del módulo C para otros módulos (PR-0.md §2.9 y §2.13,
 * spec_modulo_H.md §2.8.1, spec_modulo_D.md). Solo lectura, sin bloqueo.
 *
 * Etapa 3: la spec H ubica `contarClasesPorMes` en `turno.publico.ts`, que es
 * un archivo de 2.0; se consolida ahí (con un reexporte) al adaptarlo.
 */

type Db = Prisma.TransactionClient;
type EstadoContable = Exclude<EstadoTurno, "PENDIENTE">;

/**
 * Clases por mes de su fecha y por estado (y por materia o profesor si se
 * pide), con la suma de sus duraciones. Solo DISPONIBLE, COMPLETO y
 * CANCELADO: PENDIENTE es un error de programación. Con `por: "profesor"` no
 * se cuentan las clases sin profesor. No depende de las inscripciones.
 */
export async function contarClasesPorMes(
  rango: { desde: string; hasta: string },
  opciones: { estados: EstadoContable[]; por?: "materia" | "profesor" },
  db: Db = prisma,
): Promise<{ mes: string; estado: EstadoContable; materia_id?: string; profesor_id?: string; cantidad: number; minutos: number }[]> {
  if (opciones.estados.length === 0) throw new Error("contarClasesPorMes: estados no puede ser vacía");
  if ((opciones.estados as string[]).includes("PENDIENTE")) throw new Error("contarClasesPorMes: PENDIENTE no se cuenta");
  if (!/^\d{4}-\d{2}$/.test(rango.desde) || !/^\d{4}-\d{2}$/.test(rango.hasta)) throw new Error("contarClasesPorMes: meses AAAA-MM");
  const fin = new Date(`${rango.hasta}-01T00:00:00.000Z`);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const clave = opciones.por === "materia" ? Prisma.sql`t."materiaId"` : opciones.por === "profesor" ? Prisma.sql`t."profesorId"` : Prisma.sql`NULL::text`;
  const sinProfesor = opciones.por === "profesor" ? Prisma.sql`AND t."profesorId" IS NOT NULL` : Prisma.empty;
  const filas = await db.$queryRaw<{ mes: string; estado: EstadoContable; clave: string | null; cantidad: number; minutos: number }[]>(Prisma.sql`
    SELECT to_char(t."fechaTurno", 'YYYY-MM') AS mes, t."estadoTurno"::text AS estado, ${clave} AS clave,
      count(*)::int AS cantidad, COALESCE(sum(t."duracionMinutosTurno"), 0)::int AS minutos
    FROM "turnos" t
    WHERE t."estadoTurno"::text IN (${Prisma.join(opciones.estados)}) ${sinProfesor}
      AND t."fechaTurno" >= CAST(${`${rango.desde}-01`} AS date) AND t."fechaTurno" < CAST(${fin.toISOString().slice(0, 10)} AS date)
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, ${clave} COLLATE "C"`);
  return filas.map((f) => ({
    mes: f.mes, estado: f.estado,
    ...(opciones.por === "materia" ? { materia_id: f.clave! } : {}),
    ...(opciones.por === "profesor" ? { profesor_id: f.clave! } : {}),
    cantidad: f.cantidad, minutos: f.minutos,
  }));
}

/**
 * Alcance del gerente en el flujo de baja de un profesor (HU-D-08, PR-0.md
 * §2.9, R3-PR0-D2): `true` si la clase pertenece al profesor indicado, sin
 * mirar estado ni fecha (que sea futura y esté Disponible o Completa lo exige
 * la función de C que la procesa).
 */
export async function gerentePuedeGestionarClaseDeBaja(turnoId: string, profesorId: string, db: Db = prisma): Promise<boolean> {
  const turno = await db.turno.findUnique({ where: { idTurno: turnoId }, select: { profesorId: true } });
  return turno?.profesorId === profesorId;
}
