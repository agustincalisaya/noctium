import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import { mensajeSuperposicion, type DiaSemanaValor } from "@/lib/horario-atencion";
import { construirRegistrarHorarioSchema } from "@/server/profesores/profesor.schema";
import { registrarHorarioProfesor } from "@/server/profesores/profesor.service";

// Registro de horario de atención (HU-D-04, spec_modulo_D.md §2.4, en
// camelCase igual que HU-D-03). Capa delgada (Regla N.° 4): withPermission
// devuelve 401 sin sesión y 403 sin `profesores:editar`; valida con el mismo
// schema que la Server Action y traduce al contrato { data, error }.

const MENSAJES: Record<string, { status: 404 | 409; message: string }> = {
  PROFESOR_NO_ENCONTRADO: { status: 404, message: "El profesor no existe" },
  PROFESOR_INACTIVO: {
    status: 409,
    message: "Solo pueden registrarse horarios de profesores activos",
  },
};

function errorValidacion(campos: Record<string, string[] | undefined>) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDACION", message: "Datos inválidos", campos } },
    { status: 400 },
  );
}

export const POST = withPermission("profesores:editar", async (req, ctx) => {
  const usuarioId = req.auth!.user.id;
  const { id } = (await ctx.params) as { id: string };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: { code: "BODY_INVALIDO", message: "El cuerpo de la solicitud debe ser JSON válido" },
      },
      { status: 400 },
    );
  }

  const schema = construirRegistrarHorarioSchema(await obtenerParametrosHorarioOperativo());
  const parsed = schema.safeParse({ ...(body as object), profesorId: id });
  if (!parsed.success) {
    return errorValidacion(flattenError(parsed.error).fieldErrors);
  }

  try {
    const horario = await registrarHorarioProfesor(parsed.data, usuarioId);
    return NextResponse.json({ data: horario, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "HORARIO_SUPERPUESTO") {
        const { diaSemana, horaInicio, horaFin } = error.detalles as {
          diaSemana: DiaSemanaValor;
          horaInicio: string;
          horaFin: string;
        };
        return NextResponse.json(
          {
            data: null,
            error: { code: error.code, message: mensajeSuperposicion(diaSemana, horaInicio, horaFin) },
          },
          { status: 409 },
        );
      }
      if (typeof error.detalles?.campo === "string") {
        // Reglas de intervalo revalidadas por el servicio (día, franja,
        // granularidad): mismo formato que un error de Zod.
        return errorValidacion({ [error.detalles.campo]: [error.message] });
      }
      const traduccion = MENSAJES[error.code];
      if (traduccion) {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: traduccion.message } },
          { status: traduccion.status },
        );
      }
    }
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
