import { TurnoConfiguracion } from "../../turno-configuracion";

export default async function ModificarTurnoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  const [{ id }, { volver }] = await Promise.all([params, searchParams]);
  const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";
  return <TurnoConfiguracion id={id} retorno={retorno} />;
}
