import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { agruparHorariosPorDia } from "@/lib/horario-atencion";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";
import { construirModificarProfesorSchema } from "@/server/profesores/profesor.schema";
import { modificarProfesor, obtenerDetalleProfesor } from "@/server/profesores/profesor.service";

// Detalle del profesor (HU-D-05, spec_modulo_D.md §2.5). Capa delgada:
// withPermission devuelve 401 sin sesión y 403 sin `profesores:leer`; invoca
// obtenerDetalleProfesor(), el mismo servicio que usa la página del detalle,
// y agrupa los horarios por día como pide la spec
// ({ LUNES: [{ horaInicio, horaFin }], ... }, en camelCase como HU-D-03/04).
// Incluye `version` (HU-D-06, spec §2.5), para precargar el modo edición.
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

// spec_modulo_D.md §2.6 (HU-D-06).
const STATUS_POR_CODIGO: Record<string, number> = {
  PROFESOR_NO_ENCONTRADO: 404,
  DNI_DUPLICADO: 409,
  EMAIL_YA_ASOCIADO: 409,
  CONFLICTO_EDICION_CONCURRENTE: 409,
};

const MENSAJE_EMAIL_YA_ASOCIADO = "Ese email ya está asociado a otra cuenta";

// Modificación de identidad y contacto (HU-D-06, spec_modulo_D.md §2.6).
// Capa delgada: withPermission (401/403), Zod con el largo de DNI vigente,
// servicio y traducción al contrato estándar. El rechazo «al menos un medio
// de contacto» (N-2) se expone como error de validación del campo telefono,
// igual que el de §2.2 (D-06-6).
export const PATCH = withPermission("profesores:editar", async (req, ctx) => {
  const { id } = (await ctx.params) as { id: string };

  const body = await req.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { data: null, error: { code: "BODY_INVALIDO", message: "El cuerpo de la solicitud no es JSON válido" } },
      { status: 400 },
    );
  }

  try {
    const [dniLongitudMin, dniLongitudMax] = await Promise.all([
      getParametroNumerico("dni_longitud_min", 7),
      getParametroNumerico("dni_longitud_max", 8),
    ]);
    const parsed = construirModificarProfesorSchema(dniLongitudMin, dniLongitudMax).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDACION", message: "Datos inválidos", detalles: flattenError(parsed.error) },
        },
        { status: 400 },
      );
    }

    // withPermission() ya garantizó que req.auth.user existe.
    const data = await modificarProfesor(id, parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "CONTACTO_REQUERIDO") {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: "VALIDACION",
              message: "Datos inválidos",
              detalles: { formErrors: [], fieldErrors: { telefono: [error.message] } },
            },
          },
          { status: 400 },
        );
      }
      const message = error.code === "EMAIL_YA_ASOCIADO" ? MENSAJE_EMAIL_YA_ASOCIADO : error.message;
      return NextResponse.json(
        { data: null, error: { code: error.code, message } },
        { status: STATUS_POR_CODIGO[error.code] ?? 400 },
      );
    }
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
