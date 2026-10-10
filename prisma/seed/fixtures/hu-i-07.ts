import type { ContextoFixtures } from "./index";
import { crearFormaPago, desactivarFormaPago } from "../../../src/server/pagos/forma-pago.service";
import { transaccion } from "../../../src/server/shared/transaccion";
import { actorUsuario } from "../../../src/server/shared/historial";

/** Figura 83: Cheque inactiva. No altera preferencias ni catálogos ajenos. */
export async function fixtureHuI07({ prisma }: ContextoFixtures) {
  const gerente = await prisma.usuario.findFirstOrThrow({ where: { rolUsuario: "GERENTE", activoUsuario: true } });
  const existente = await prisma.formaPago.findUnique({ where: { nombreNormalizadaFormaPago: "cheque" } });
  // Un seed repetido conserva cualquier modificación posterior del usuario.
  if (existente) return;
  const cheque = await crearFormaPago({ nombre: "Cheque" }, gerente.idUsuario);
  await transaccion((tx) => desactivarFormaPago(tx, cheque.idFormaPago, {}, actorUsuario(gerente.idUsuario)), { db: prisma });
}
