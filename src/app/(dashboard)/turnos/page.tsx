import { auth } from "@/auth";
import { TurnosListado } from "./turnos-listado";

export default async function TurnosPage({ searchParams }: { searchParams: Promise<{ pagina?: string; orden?: string; q?: string }> }) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  const pagina = Number(params.pagina);
  const paginaActual = Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1;
  // Sin `key` (HU-C-02): al paginar, TurnosListado recibe la página nueva por
  // props y la consulta sin remontarse, así la tabla no vuelve a "Cargando".
  return <TurnosListado pagina={paginaActual} q={typeof params.q === "string" ? params.q : ""} orden="fecha_hora_asc" puedeConfigurar={session?.user?.rol === "MESA_ENTRADA"} />;
}
