import { auth } from "@/auth";
import { TurnosListado } from "./turnos-listado";
import { verificarPermiso } from "@/server/shared/with-permission";

export default async function TurnosPage({ searchParams }: { searchParams: Promise<{ pagina?: string; orden?: string; q?: string; profesor_id?: string }> }) {
  const [params, session, puedeDescartar] = await Promise.all([
    searchParams, auth(),
    verificarPermiso("turnos:cancelar").then(() => true, () => false),
  ]);
  const pagina = Number(params.pagina);
  const paginaActual = Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1;
  // Sin `key` (HU-C-02): al paginar, TurnosListado recibe la página nueva por
  // props y la consulta sin remontarse, así la tabla no vuelve a "Cargando".
  // HU-C-08: el selector de profesor es solo de Gerente y Mesa de Entrada; el
  // Profesor ve sus turnos sin selector (el servidor acota por la sesión).
  const rol = session?.user?.rol;
  return <TurnosListado pagina={paginaActual} q={typeof params.q === "string" ? params.q : ""} profesorId={typeof params.profesor_id === "string" ? params.profesor_id : ""} orden="fecha_hora_asc" puedeConfigurar={rol === "MESA_ENTRADA"} puedeDescartar={puedeDescartar} puedeFiltrarProfesor={rol === "GERENTE" || rol === "MESA_ENTRADA"} esProfesor={rol === "PROFESOR"} />;
}
