import { NextResponse } from "next/server";
import type { RolUsuario } from "@prisma/client";
import { tienePermiso, withPermission } from "@/server/shared/with-permission";
import { obtenerDetalleTurno, type CapacidadesDetalle } from "@/server/turnos/turno.detalle";

/**
 * Permisos opcionales del detalle, en paralelo y sin abortar el GET (HU-C-09
 * §4.1). Al Profesor no se le consulta `pagos:leer`: nunca recibe datos de pago.
 */
async function capacidadesDelDetalle(rol: RolUsuario): Promise<CapacidadesDetalle> {
  const [verPagos, cancelar, reprogramar, priorizar, registrarPago, registrarClase] = await Promise.all([
    rol === "PROFESOR" ? false : tienePermiso("pagos:leer"),
    tienePermiso("turnos:cancelar"),
    tienePermiso("turnos:reprogramar"),
    tienePermiso("turnos:priorizar"),
    tienePermiso("pagos:crear"),
    tienePermiso("clases:registrar"),
  ]);
  return { verPagos, cancelar, reprogramar, priorizar, registrarPago, registrarClase };
}

export const GET = withPermission("turnos:leer", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const usuario = req.auth!.user;
  const capacidades = await capacidadesDelDetalle(usuario.rol);
  const detalle = await obtenerDetalleTurno(id, usuario, { capacidades, ahora: new Date() });
  if (detalle.resultado === "sin_permiso") {
    // Mismo cuerpo para turno ajeno, inexistente o cuenta sin ficha (spec_modulo_C.md §2.4).
    return NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" } }, { status: 403 });
  }
  if (detalle.resultado === "no_encontrado") {
    return NextResponse.json({ data: null, error: { code: "TURNO_NO_ENCONTRADO", message: "No se encontró el turno" } }, { status: 404 });
  }
  return NextResponse.json({ data: detalle.turno, error: null });
});
