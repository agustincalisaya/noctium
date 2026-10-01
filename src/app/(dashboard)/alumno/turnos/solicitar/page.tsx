import { redirect } from "next/navigation";
import { exigirPermiso } from "@/server/shared/with-permission";
import { obtenerAlumnoDeUsuario } from "@/server/alumnos/alumno.publico";
import { SolicitarTurno } from "./solicitar-turno";

export default async function SolicitarTurnoPage() {
  const usuario = await exigirPermiso("turnos:solicitar_propio");
  const alumno = await obtenerAlumnoDeUsuario(usuario.id);
  if (!alumno) redirect("/sin-permiso");
  return <SolicitarTurno />;
}
