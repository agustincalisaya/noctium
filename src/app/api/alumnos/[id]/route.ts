import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerDetalleAlumno } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";

// Detalle de alumno (HU-B-04, spec_modulo_B.md §2.4).
export const GET = withPermission("alumnos:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };

  try {
    const data = await obtenerDetalleAlumno(id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    throw error;
  }
});
