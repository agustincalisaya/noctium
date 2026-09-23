import { NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/server/shared/with-permission";
import { listarProfesoresActivosPorMateria } from "@/server/profesores/profesor.service";

export const GET = withPermission("turnos:asignar_participantes", async (req) => {
  const materiaId = new URL(req.url).searchParams.get("materiaId");
  if (!z.cuid().safeParse(materiaId).success) return NextResponse.json({ data: null, error: { code: "VALIDACION", message: "ID de materia inválido" } }, { status: 400 });
  return NextResponse.json({ data: await listarProfesoresActivosPorMateria(materiaId!), error: null });
});
