import { TurnoDetalleVista } from "./turno-detalle";
import { auth } from "@/auth";

export default async function TurnoDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const [{ id }, { volver }, session] = await Promise.all([params, searchParams, auth()]);
  const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";
  return <TurnoDetalleVista id={id} retorno={retorno} puedeConfigurar={session?.user?.rol === "MESA_ENTRADA"} />;
}
