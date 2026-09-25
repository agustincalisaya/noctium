import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ConsultarCalendarioMateriaQuerySchema } from "@/server/calendario/calendario.schema";
import { obtenerCalendarioMateria } from "@/server/calendario/calendario.service";
import { fechaISO, hoyEnZonaCentro, lunesDeLaSemana } from "@/lib/calendario-semana";

// Calendario semanal por materia (HU-J-02, spec_modulo_J.md §2.2). Capa
// delgada: withPermission devuelve 401 sin sesión y 403 sin
// `calendario:leer`; el servicio decide el alcance según el rol (un
// Profesor solo ve sus turnos, y una materia que no dicta -> 403).
export const GET = withPermission("calendario:leer", async (req, ctx) => {
  const { materiaId } = (await ctx.params) as { materiaId: string };

  const parsed = ConsultarCalendarioMateriaQuerySchema.safeParse({
    semana_inicio: req.nextUrl.searchParams.get("semana_inicio") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDACION",
          message: "Parámetros inválidos",
          campos: flattenError(parsed.error).fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const { semana_inicio } = parsed.data;
  const lunes = lunesDeLaSemana(semana_inicio ? fechaISO(semana_inicio) : hoyEnZonaCentro());

  try {
    const { materia, rango, eventos } = await obtenerCalendarioMateria({
      usuario: { id: req.auth!.user!.id, rol: req.auth!.user!.rol },
      materiaId,
      lunes,
    });
    return NextResponse.json({ data: { materia, rango, eventos }, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "SIN_PERMISO" || error.code === "PROFESOR_SIN_FICHA") {
        return NextResponse.json(
          {
            data: null,
            error: { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" },
          },
          { status: 403 },
        );
      }
      if (error.code === "MATERIA_NO_ENCONTRADA") {
        return NextResponse.json(
          {
            data: null,
            error: { code: "MATERIA_NO_ENCONTRADA", message: "La materia no existe o no está activa" },
          },
          { status: 404 },
        );
      }
    }
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
