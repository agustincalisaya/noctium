import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { ListarTurnosFuturosQuerySchema, ProfesorIdSchema } from "@/server/profesores/profesor.schema";
import { listarTurnosFuturosDeMateria } from "@/server/profesores/profesor.service";

// Lista del modal «Ver turnos» (HU-D-07 AC3, spec_modulo_D.md §2.7): turnos
// futuros DISPONIBLE/COMPLETO de ese profesor y esa materia, de a 10.
// `profesores:leer`, como el resto de la ficha (exclusivo de Mesa de
// Entrada). Capa delgada (Regla N.° 4): valida con Zod (Regla N.° 6) y delega.

const NO_ENCONTRADO: Record<string, string> = {
  PROFESOR_NO_ENCONTRADO: "El profesor no existe",
  MATERIA_NO_ENCONTRADA: "La materia no existe",
};

function errorValidacion(campos: Record<string, string[] | undefined>) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDACION", message: "Datos inválidos", campos } },
    { status: 400 },
  );
}

export const GET = withPermission("profesores:leer", async (req, ctx) => {
  const { id, materiaId } = (await ctx.params) as { id: string; materiaId: string };

  const profesorId = ProfesorIdSchema.safeParse(id);
  if (!profesorId.success) return errorValidacion({ id: flattenError(profesorId.error).formErrors });
  const materia = ProfesorIdSchema.safeParse(materiaId);
  if (!materia.success) return errorValidacion({ materiaId: flattenError(materia.error).formErrors });

  // Todos los parámetros recibidos pasan por el schema `.strict()`: uno ajeno
  // (p. ej. `por_pagina`, que es fijo) se rechaza con 400.
  const query = ListarTurnosFuturosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) {
    const { formErrors, fieldErrors } = flattenError(query.error);
    return errorValidacion(formErrors.length > 0 ? { ...fieldErrors, query: formErrors } : fieldErrors);
  }

  try {
    const data = await listarTurnosFuturosDeMateria(profesorId.data, materia.data, query.data.pagina);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError && NO_ENCONTRADO[error.code]) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: NO_ENCONTRADO[error.code] } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudieron cargar los turnos" } },
      { status: 500 },
    );
  }
});
