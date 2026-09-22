import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { CrearMateriaSchema } from "@/server/materias/materia.schema";
import { crearMateria } from "@/server/materias/materia.service";
import { ServiceError } from "@/server/shared/service-error";

// GET (listado) es HU-L-02, todavía no implementada.
export async function GET() {
  return NextResponse.json({ error: "No implementado" }, { status: 501 });
}

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
