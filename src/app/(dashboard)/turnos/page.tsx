import { auth } from "@/auth";
import { TurnosListado } from "./turnos-listado";
import { verificarPermiso } from "@/server/shared/with-permission";
import { listarOpcionesFiltroMateria } from "@/server/turnos/turno.service";
import { fechaCalendarioValidaSchema } from "@/server/shared/fecha.schema";
import { PERIODOS_LISTADO_TURNOS } from "@/server/turnos/turno.schema";
import type { PeriodoListadoTurnos } from "@/types/turno.types";

type Parametros = { pagina?: string; q?: string; profesor_id?: string; periodo?: string; desde?: string; hasta?: string; materia_id?: string };

const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
/** Fecha AAAA-MM-DD real del calendario, o "" (HU-C-27: un enlace editado a mano no termina en un 400). */
const fechaValida = (valor: unknown) => (fechaCalendarioValidaSchema.safeParse(texto(valor)).success ? texto(valor).trim() : "");

export default async function TurnosPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const [params, session, puedeDescartar] = await Promise.all([
    searchParams, auth(),
    verificarPermiso("turnos:cancelar").then(() => true, () => false),
  ]);
  const pagina = Number(params.pagina);
  const paginaActual = Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1;
  // HU-C-27: filtros saneados. Con fechas manda el rango (como en la API); sin
  // período ni fechas, «Hoy». Las opciones de materia salen del servidor
  // (Regla N.° 3 resuelta en listarOpcionesFiltroMateria); sin opciones, el
  // selector queda solo con «Todas».
  const desde = fechaValida(params.desde);
  const hasta = fechaValida(params.hasta);
  const periodoUrl = (PERIODOS_LISTADO_TURNOS as readonly string[]).includes(texto(params.periodo)) ? texto(params.periodo) as PeriodoListadoTurnos : undefined;
  const periodo = desde || hasta ? undefined : periodoUrl ?? "hoy";
  const materias = session?.user ? await listarOpcionesFiltroMateria(session.user).catch(() => []) : [];
  const materiaId = materias.some(({ id }) => id === params.materia_id) ? texto(params.materia_id) : "";
  // Sin `key` (HU-C-02): al paginar, TurnosListado recibe la página nueva por
  // props y la consulta sin remontarse, así la tabla no vuelve a "Cargando".
  // HU-C-08: el selector de profesor es solo de Gerente y Mesa de Entrada; el
  // Profesor ve sus turnos sin selector (el servidor acota por la sesión).
  const rol = session?.user?.rol;
  return <TurnosListado pagina={paginaActual} q={texto(params.q)} profesorId={texto(params.profesor_id)} periodo={periodo} desde={desde} hasta={hasta} materiaId={materiaId} materias={materias} puedeConfigurar={rol === "MESA_ENTRADA"} puedeDescartar={puedeDescartar} puedeFiltrarProfesor={rol === "GERENTE" || rol === "MESA_ENTRADA"} />;
}
