import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ServiceError } from "@/server/shared/service-error";
import { CrearAulaSchema } from "@/server/aulas/aula.schema";
import { crearAula } from "@/server/aulas/aula.service";

// GET (listado) es HU-K-02 — fuera de alcance de esta HU.
export async function GET() {
  return NextResponse.json({ data: null, error: { code: "NO_IMPLEMENTADO", message: "No implementado" } }, { status: 501 });
}

export const POST = withPermission("aulas:crear", async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = CrearAulaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() } },
      { status: 400 },
    );
  }

  try {
    // withPermission() ya garantizó que req.auth.user existe.
    const aula = await crearAula(parsed.data, req.auth!.user.id);
    return NextResponse.json(
      {
        data: {
          id: aula.idAula,
          nombre: aula.nombreAula,
          capacidad: aula.capacidadAula,
          is_active: aula.activaAula,
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
