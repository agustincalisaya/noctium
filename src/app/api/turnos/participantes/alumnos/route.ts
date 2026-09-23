import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { buscarAlumnosActivos } from "@/server/alumnos/alumno.service";

export const GET = withPermission("turnos:asignar_participantes", async (req) => {
  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 100) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "La búsqueda es demasiado larga" } }, { status: 400 });
  return NextResponse.json({ data: await buscarAlumnosActivos(query), error: null });
});
