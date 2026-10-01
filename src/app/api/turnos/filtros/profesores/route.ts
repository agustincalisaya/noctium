import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { listarOpcionesFiltroProfesor } from "@/server/turnos/turno.service";

const MENSAJE_SIN_PERMISO = "No tenés permisos para acceder a esta sección";

/**
 * Selector «Profesor» del listado de turnos (HU-C-08, spec_modulo_C.md §2.7):
 * `turnos:leer` más verificación de rol, porque el Profesor también tiene
 * `turnos:leer` pero su listado ya está acotado a sus turnos y no tiene
 * selector (AC1, R5-12).
 */
export const GET = withPermission("turnos:leer", async (req) => {
  const rol = req.auth!.user.rol;
  if (rol !== "GERENTE" && rol !== "MESA_ENTRADA") {
    return NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: MENSAJE_SIN_PERMISO } }, { status: 403 });
  }
  return NextResponse.json({ data: await listarOpcionesFiltroProfesor(), error: null });
});
