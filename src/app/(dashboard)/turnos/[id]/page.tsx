import { TurnoDetalleVista } from "./turno-detalle";

export default async function TurnoDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const [{ id }, { volver }] = await Promise.all([params, searchParams]);
  const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";
  return <TurnoDetalleVista id={id} retorno={retorno} />;
}
