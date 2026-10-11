import type { Prisma } from "@prisma/client";
import { usuarioRegistroOperaciones as registroPagosYCajas } from "@/server/pagos/pago.publico";
import { usuarioRegistroOperaciones as registroClases } from "@/server/turnos/turno.publico";
import { usuarioRegistroOperaciones as registroTarifas } from "@/server/materias/materia.publico";
import { usuarioRegistroCambiosDeEstado } from "@/server/shared/historial-estados";

/**
 * «Registró operaciones» (DEC-39, spec_modulo_F.md §2.7): `true` si la cuenta
 * figura como actor de algún registro. Recorre en orden la lectura de cada
 * módulo dueño, publicada en su fachada (Regla N.° 3), y corta en la primera
 * verdadera. Cada HU suma su propia línea (HU-N-01, la de parámetros); las
 * fachadas no importan este archivo, para no crear ciclos. Lo consumen
 * HU-F-05 y HU-G-05. Solo lectura.
 */
export async function usuarioRegistroOperaciones(tx: Prisma.TransactionClient, usuarioId: string): Promise<boolean> {
  const lineas = [
    // I: pagos, correcciones, anulaciones, cajas, movimientos y ajustes.
    () => registroPagosYCajas(tx, usuarioId),
    // C: clases creadas o modificadas e inscripciones desde el centro.
    () => registroClases(usuarioId, tx),
    // L: cambios de tarifa.
    () => registroTarifas(usuarioId, tx),
    // Bajas y reactivaciones de cualquier entidad.
    () => usuarioRegistroCambiosDeEstado(usuarioId, tx),
  ];
  for (const linea of lineas) if (await linea()) return true;
  return false;
}
