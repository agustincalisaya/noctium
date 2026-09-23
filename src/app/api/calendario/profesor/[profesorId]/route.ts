import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ConsultarCalendarioProfesorQuerySchema } from "@/server/calendario/calendario.schema";
import { obtenerCalendarioProfesor } from "@/server/calendario/calendario.service";
import { fechaISO, hoyEnZonaCentro, lunesDeLaSemana } from "@/lib/calendario-semana";

// Agenda semanal por profesor (HU-J-01, spec_modulo_J.md §2.1). Capa
// delgada: withPermission devuelve 401 sin sesión y 403 sin
// `calendario:leer`; el servicio decide de quién es la agenda según el rol
// (un Profesor pidiendo otra agenda -> 403, sin revelar si existe).
export const GET = withPermission("calendario:leer", async (req, ctx) => {
  const { profesorId } = (await ctx.params) as { profesorId: string };

  const parsed = ConsultarCalendarioProfesorQuerySchema.safeParse({
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
    const { profesor, rango, eventos } = await obtenerCalendarioProfesor({
      usuario: { id: req.auth!.user!.id, rol: req.auth!.user!.rol },
      profesorIdSolicitado: profesorId,
      lunes,
      rechazarAjeno: true,
    });
    return NextResponse.json({ data: { profesor, rango, eventos }, error: null }, { status: 200 });
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
      if (error.code === "PROFESOR_NO_ENCONTRADO") {
        return NextResponse.json(
          {
            data: null,
            error: { code: "PROFESOR_NO_ENCONTRADO", message: "El profesor no existe o no está activo" },
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
