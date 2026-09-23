import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { CrearMateriaSchema, ListarMateriasQuerySchema } from "@/server/materias/materia.schema";
import { crearMateria, listarMaterias } from "@/server/materias/materia.service";
import { ServiceError } from "@/server/shared/service-error";

export const GET = withPermission("materias:leer", async (req) => {
  const parsed = ListarMateriasQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  const data = await listarMaterias(parsed.data);
  return NextResponse.json({ data, error: null });
});

export const POST = withPermission("materias:crear", async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = CrearMateriaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  try {
    // withPermission() ya garantizó que req.auth.user existe.
    const materia = await crearMateria(parsed.data, req.auth!.user.id);
    return NextResponse.json(
      {
        data: {
          id: materia.idMateria,
          nombre: materia.nombreMateria,
          codigo: materia.codigoMateria,
          is_active: materia.activaMateria,
        },
        error: null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    throw error;
  }
});
