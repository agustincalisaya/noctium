import { redirect } from "next/navigation";
import { verificarPermiso } from "@/server/shared/with-permission";
import { AulaTurno } from "./aula-turno";

export default async function AulaTurnoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ volver?: string }> }) {
  await verificarPermiso("turnos:asignar_aula").catch(() => redirect("/turnos"));
  const [{ id }, { volver }] = await Promise.all([params, searchParams]);
  const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";
  return <AulaTurno id={id} retorno={retorno} />;
}
