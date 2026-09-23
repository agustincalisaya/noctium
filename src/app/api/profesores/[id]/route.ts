import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { agruparHorariosPorDia } from "@/lib/horario-atencion";
import { obtenerDetalleProfesor } from "@/server/profesores/profesor.service";

// Detalle del profesor (HU-D-05, spec_modulo_D.md §2.5). Capa delgada:
// withPermission devuelve 401 sin sesión y 403 sin `profesores:leer`; invoca
// obtenerDetalleProfesor(), el mismo servicio que usa la página del detalle,
// y agrupa los horarios por día como pide la spec
// ({ LUNES: [{ horaInicio, horaFin }], ... }, en camelCase como HU-D-03/04).
export const GET = withPermission("profesores:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };

  try {
    const profesor = await obtenerDetalleProfesor(id);
    if (!profesor) {
      return NextResponse.json(
        { data: null, error: { code: "PROFESOR_NO_ENCONTRADO", message: "El profesor no existe" } },
        { status: 404 },
      );
    }

    const { telefono, email, horarios, ...resto } = profesor;
    return NextResponse.json(
      {
        data: {
          ...resto,
          contacto: { telefono, email },
          horarios: Object.fromEntries(
            agruparHorariosPorDia(horarios).map(({ dia, intervalos }) => [
              dia,
              intervalos.map(({ horaInicio, horaFin }) => ({ horaInicio, horaFin })),
            ]),
          ),
        },
        error: null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
