import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import {
  ActualizarMateriasProfesorSchema,
  AsociarMateriasProfesorSchema,
  ProfesorIdSchema,
} from "@/server/profesores/profesor.schema";
import {
  actualizarMateriasDeProfesor,
  asociarMateriasAProfesor,
} from "@/server/profesores/profesor.service";

// Asociación de materias al profesor (HU-D-03, spec_modulo_D.md §2.3 con
// nota de sincronización: camelCase). Capa delgada (Regla N.° 4): valida
// id y body con Zod, invoca asociarMateriasAProfesor() y traduce el
// resultado al contrato { data, error } (Regla N.° 5) — mismo servicio que
// usa la Server Action de src/server/profesores/actions.ts.

const MENSAJES: Record<string, { status: 404 | 409; message: string }> = {
  PROFESOR_NO_ENCONTRADO: { status: 404, message: "El profesor no existe" },
  MATERIA_NO_ENCONTRADA: { status: 404, message: "Alguna de las materias no existe" },
  PROFESOR_INACTIVO: {
    status: 409,
    message: "Solo pueden asociarse materias a profesores activos",
  },
  MATERIA_YA_ASOCIADA: { status: 409, message: "Alguna de las materias ya está asociada al profesor" },
};

function materiasDeDetalles(error: ServiceError): { id: string; nombre: string }[] {
  const materias = error.detalles?.materias;
  return Array.isArray(materias) ? (materias as { id: string; nombre: string }[]) : [];
}

/** "La materia 'Física' ya no está activa" / "Las materias 'Física', 'Química' ya no están activas" (spec §2.3). */
function mensajeMateriasInactivas(materias: { nombre: string }[]): string {
  const nombres = materias.map(({ nombre }) => `'${nombre}'`).join(", ");
  return materias.length === 1
    ? `La materia ${nombres} ya no está activa`
    : `Las materias ${nombres} ya no están activas`;
}

function errorValidacion(campos: Record<string, string[] | undefined>) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDACION", message: "Datos inválidos", campos } },
    { status: 400 },
  );
}

export const POST = withPermission("profesores:editar", async (req, ctx) => {
  // withPermission ya devolvió 401/403 si no había sesión válida con el
  // permiso — acá req.auth.user siempre está presente.
  const usuarioId = req.auth!.user.id;
  const { id } = (await ctx.params) as { id: string };

  const profesorId = ProfesorIdSchema.safeParse(id);
  if (!profesorId.success) {
    return errorValidacion({ id: flattenError(profesorId.error).formErrors });
  }

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

  const parsed = AsociarMateriasProfesorSchema.safeParse(body);
  if (!parsed.success) {
    return errorValidacion(flattenError(parsed.error).fieldErrors);
  }

  try {
    const asociadas = await asociarMateriasAProfesor(
      profesorId.data,
      parsed.data.materiaIds,
      usuarioId,
    );
    return NextResponse.json(
      {
        data: {
          profesorId: profesorId.data,
          materiasAsociadas: asociadas.map((materia) => materia.id),
        },
        error: null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "MATERIA_INACTIVA") {
        const materias = materiasDeDetalles(error);
        return NextResponse.json(
          {
            data: null,
            error: {
              code: error.code,
              message: mensajeMateriasInactivas(materias),
              materiaIdsInvalidas: materias.map((materia) => materia.id),
            },
          },
          { status: 409 },
        );
      }

      const traduccion = MENSAJES[error.code];
      if (traduccion) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: error.code,
              message: traduccion.message,
              ...(error.code === "MATERIA_YA_ASOCIADA"
                ? { materiaIdsInvalidas: materiasDeDetalles(error).map((materia) => materia.id) }
                : {}),
            },
          },
          { status: traduccion.status },
        );
      }
    }
    // Cualquier otro error: nunca un detalle técnico en el body (mismo
    // criterio que app/api/profesores/route.ts).
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});

function bloqueosDeDetalles(error: ServiceError): { materia_id: string; cantidad: number }[] {
  const detalle = error.detalles?.detalle;
  return Array.isArray(detalle) ? (detalle as { materia_id: string; cantidad: number }[]) : [];
}

/** Literal de HU-D-07 AC3 cuando la baja rechazada es de una sola materia. */
function mensajeTurnosFuturos(bloqueos: { cantidad: number }[]): string {
  if (bloqueos.length === 1) {
    return `No se puede quitar: el profesor tiene ${bloqueos[0]!.cantidad} turnos futuros de esta materia`;
  }
  return "No se pueden quitar algunas materias: el profesor tiene turnos futuros de ellas";
}

// Modificación de las materias asociadas (HU-D-07, spec_modulo_D.md §2.7):
// el body es el CONJUNTO FINAL (`materia_ids`, snake_case como los contratos
// nuevos de Sprint 2). Mismo servicio que la Server Action
// `actualizarMateriasProfesor()`.
export const PUT = withPermission("profesores:editar", async (req, ctx) => {
  const usuarioId = req.auth!.user.id;
  const { id } = (await ctx.params) as { id: string };

  const profesorId = ProfesorIdSchema.safeParse(id);
  if (!profesorId.success) {
    return errorValidacion({ id: flattenError(profesorId.error).formErrors });
  }

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

  const parsed = ActualizarMateriasProfesorSchema.safeParse(body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = flattenError(parsed.error);
    return errorValidacion(formErrors.length > 0 ? { ...fieldErrors, body: formErrors } : fieldErrors);
  }

  try {
    const resultado = await actualizarMateriasDeProfesor(profesorId.data, parsed.data.materia_ids, usuarioId);
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "MATERIA_CON_TURNOS_FUTUROS") {
        const detalle = bloqueosDeDetalles(error);
        return NextResponse.json(
          { data: null, error: { code: error.code, message: mensajeTurnosFuturos(detalle), detalle } },
          { status: 409 },
        );
      }
      if (error.code === "MATERIA_INACTIVA") {
        const materias = materiasDeDetalles(error);
        return NextResponse.json(
          {
            data: null,
            error: {
              code: error.code,
              message: mensajeMateriasInactivas(materias),
              materia_ids_invalidas: materias.map((materia) => materia.id),
            },
          },
          { status: 409 },
        );
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
