import { TurnoDetalleVista } from "./turno-detalle";
import { auth } from "@/auth";
import { verificarPermiso } from "@/server/shared/with-permission";

export default async function TurnoDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const [{ id }, { volver }, session, puedeGestionarAlumnos, puedeAsignarAula] = await Promise.all([
    params, searchParams, auth(),
    verificarPermiso("turnos:asignar_participantes").then(() => true, () => false),
    verificarPermiso("turnos:asignar_aula").then(() => true, () => false),
  ]);
  const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";
  return <TurnoDetalleVista id={id} retorno={retorno} puedeConfigurar={session?.user?.rol === "MESA_ENTRADA"} puedeGestionarAlumnos={puedeGestionarAlumnos} puedeAsignarAula={puedeAsignarAula} />;
}
