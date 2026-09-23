import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { listarMateriasActivas } from "@/server/materias/materia.service";
import { parametrosConfiguracionTurno } from "@/server/turnos/turno.validaciones";

export const GET = withPermission("turnos:crear", async () => {
  const [materias, parametros] = await Promise.all([listarMateriasActivas(), parametrosConfiguracionTurno()]);
  return NextResponse.json({ data: { materias: materias.map((materia) => ({ id: materia.idMateria, nombre: materia.nombreMateria, codigo: materia.codigoMateria })), parametros }, error: null });
});
