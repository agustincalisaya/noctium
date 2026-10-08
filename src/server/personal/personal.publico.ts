import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bloquear } from "@/server/shared/bloquear";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import type { Tx } from "@/server/shared/transaccion";

/**
 * Fachada del módulo F (personal de mesa de entrada) con lo mínimo que usan
 * los servicios del PR 0 (spec_modulo_F.md §2.7): la caja exige un integrante
 * activo y el comprobante guarda el nombre de quien registró el cobro. Las HU
 * de F y G suman acá el resto de sus lecturas sin cambiar estas firmas.
 */

/**
 * «Apellido, Nombre» de cada cuenta del personal (mesa de entrada o gerente)
 * por su `usuarioId`. Las cuentas sin ficha no aparecen. Solo lectura.
 */
export async function obtenerNombresPersonal(
  usuarioIds: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<{ usuario_id: string; nombre_completo: string }[]> {
  const unicos = [...new Set(usuarioIds)];
  if (unicos.length === 0) return [];
  const [mesa, gerentes] = await Promise.all([
    db.fichaMesaEntrada.findMany({
      where: { usuarioId: { in: unicos } },
      select: { usuarioId: true, nombreFichaMesaEntrada: true, apellidoFichaMesaEntrada: true },
    }),
    db.fichaGerente.findMany({
      where: { usuarioId: { in: unicos } },
      select: { usuarioId: true, nombreFichaGerente: true, apellidoFichaGerente: true },
    }),
  ]);
  const nombres = new Map<string, string>();
  for (const f of mesa) nombres.set(f.usuarioId!, `${f.apellidoFichaMesaEntrada}, ${f.nombreFichaMesaEntrada}`);
  for (const f of gerentes) nombres.set(f.usuarioId!, `${f.apellidoFichaGerente}, ${f.nombreFichaGerente}`);
  return unicos.flatMap((id) => (nombres.has(id) ? [{ usuario_id: id, nombre_completo: nombres.get(id)! }] : []));
}

/**
 * Bloquea la ficha de mesa de entrada de la cuenta y exige que esté activa
 * (spec_modulo_I.md §2.10.1 paso 1). Lanza INTEGRANTE_INACTIVO si la cuenta
 * no tiene ficha de mesa de entrada o está inactiva. Toma el bloqueo con
 * `bloquear` (nivel recurso): el llamador no puede haber tomado antes un
 * bloqueo de un nivel posterior.
 */
export async function bloquearIntegranteActivo(tx: Tx, usuarioId: string): Promise<{ fichaId: string }> {
  const ficha = await tx.fichaMesaEntrada.findUnique({ where: { usuarioId }, select: { idFichaMesaEntrada: true } });
  if (!ficha) throw new ErrorDeDominio("errores.caja.integranteInactivo");
  await bloquear(tx, { recursos: { fichasMesaEntrada: [ficha.idFichaMesaEntrada] } });
  const bloqueada = await tx.fichaMesaEntrada.findUnique({
    where: { idFichaMesaEntrada: ficha.idFichaMesaEntrada },
    select: { activoFichaMesaEntrada: true, usuarioId: true },
  });
  if (!bloqueada?.activoFichaMesaEntrada || bloqueada.usuarioId !== usuarioId) {
    throw new ErrorDeDominio("errores.caja.integranteInactivo");
  }
  return { fichaId: ficha.idFichaMesaEntrada };
}
