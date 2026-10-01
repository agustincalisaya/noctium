import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ConsultarCalendarioQuerySchema } from "@/server/calendario/calendario.schema";
import { obtenerCalendarioProfesor } from "@/server/calendario/calendario.service";
import { fechaISO, hoyEnZonaCentro } from "@/lib/calendario-semana";

// Agenda por profesor (HU-J-01, spec_modulo_J.md §2.1) en vista día,
// semana o mes (HU-J-03, §2.3). Capa
// delgada: withPermission devuelve 401 sin sesión y 403 sin
// `calendario:leer`; el servicio decide de quién es la agenda según el rol
// (un Profesor pidiendo otra agenda -> 403, sin revelar si existe).
export const GET = withPermission("calendario:leer", async (req, ctx) => {
  const { profesorId } = (await ctx.params) as { profesorId: string };

  const query = req.nextUrl.searchParams;
  const parsed = ConsultarCalendarioQuerySchema.safeParse({
    vista: query.get("vista") ?? undefined,
    fecha: query.get("fecha") ?? undefined,
    semana_inicio: query.get("semana_inicio") ?? undefined,
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

  // `semana_inicio` (HU-J-01/J-02) es alias de `fecha`; sin ninguna, hoy en Buenos Aires.
  const { vista, fecha, semana_inicio } = parsed.data;
  const referencia = fecha ?? semana_inicio;
  const fechaReferencia = referencia ? fechaISO(referencia) : hoyEnZonaCentro();

  try {
    const calendario = await obtenerCalendarioProfesor({
      usuario: { id: req.auth!.user!.id, rol: req.auth!.user!.rol },
      profesorIdSolicitado: profesorId,
      vista,
      fecha: fechaReferencia,
      rechazarAjeno: true,
    });
    // Día/semana: eventos (§2.1); mes: un resumen por día (§2.3 punto 4).
    const data =
      calendario.vista === "mes"
        ? { profesor: calendario.profesor, vista: calendario.vista, rango: calendario.rango, dias: calendario.dias }
        : { profesor: calendario.profesor, vista: calendario.vista, rango: calendario.rango, eventos: calendario.eventos };
    return NextResponse.json({ data, error: null }, { status: 200 });
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
