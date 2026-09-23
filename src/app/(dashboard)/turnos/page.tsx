import { auth } from "@/auth";
import { TurnosListado } from "./turnos-listado";

export default async function TurnosPage({ searchParams }: { searchParams: Promise<{ pagina?: string; orden?: string }> }) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  const pagina = Number(params.pagina);
  const paginaActual = Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1;
  return <TurnosListado key={paginaActual} pagina={paginaActual} orden="fecha_hora_asc" puedeConfigurar={session?.user?.rol === "MESA_ENTRADA"} />;
}
