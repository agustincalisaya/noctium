import { redirect } from "next/navigation";
import { verificarPermiso } from "@/server/shared/with-permission";
import { ParticipantesTurno } from "./participantes-turno";

export default async function ParticipantesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  await verificarPermiso("turnos:asignar_participantes").catch(() => redirect("/turnos"));
  const [{ id }, { volver }] = await Promise.all([params, searchParams]);
  const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";
  return <ParticipantesTurno id={id} retorno={retorno} />;
}
