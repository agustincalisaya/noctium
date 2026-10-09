import type { AccionHistorialEstado, ActorTipo, EntidadHistorialEstado, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encolarHistorial, type ActorDominio } from "@/server/shared/historial";
import { ahora } from "@/server/shared/reloj";
import type { Tx } from "@/server/shared/transaccion";

/**
 * Historial de bajas y reactivaciones (PR-0.md §2.13 y §2.14, R7-PR0-1):
 * alumnos (HU-B-07), profesores (HU-D-08), fichas de mesa de entrada
 * (HU-F-05) y de gerente (HU-G-05) y formas de pago (HU-I-07). La escritura
 * va después del commit, con reintento e idempotencia (Regla N.° 2, opción b).
 */

export type CambioEstado = {
  entidad: EntidadHistorialEstado;
  id: string;
  accion: AccionHistorialEstado;
  motivo?: string | null;
  actor: ActorDominio;
};

/**
 * Encola el registro del cambio de estado para después del commit de la
 * transacción del llamador; la fecha es `ahora()` al encolar. Devuelve el id
 * del registro (generado antes del commit).
 */
export function registrarCambioEstado(tx: Tx, cambio: CambioEstado): { id: string } {
  const motivo = cambio.motivo?.trim() || null;
  const registro = encolarHistorial(tx, {
    tipo: "ESTADO", entidad: cambio.entidad, entidadId: cambio.id, accion: cambio.accion,
    motivo, actor: cambio.actor, fecha: ahora(),
  });
  return { id: registro.id };
}

export type EntradaHistorialEstado = {
  id: string;
  accion: AccionHistorialEstado;
  motivo: string | null;
  fecha: Date;
  actor_tipo: ActorTipo;
  /** Usuario que hizo el cambio; `null` si fue el proceso automático. El nombre lo resuelve quien muestra (DEC-37). */
  usuario_id: string | null;
};

/** Historial de estados de una entidad, del más reciente al más antiguo (desempate por id). Solo lectura. */
export async function listarHistorialEstados(
  entidad: EntidadHistorialEstado,
  id: string,
  db: Prisma.TransactionClient = prisma,
): Promise<EntradaHistorialEstado[]> {
  const filas = await db.historialEstado.findMany({
    where: { entidad, entidadId: id },
    orderBy: [{ fecha: "desc" }, { idHistorialEstado: "desc" }],
  });
  return filas.map((fila) => ({
    id: fila.idHistorialEstado,
    accion: fila.accion,
    motivo: fila.motivo,
    fecha: fila.fecha,
    actor_tipo: fila.actorTipo,
    usuario_id: fila.usuarioId,
  }));
}
