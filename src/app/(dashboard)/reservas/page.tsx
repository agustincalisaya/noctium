import { texto } from "@/lib/textos";
import type { FiltrosReservas, PestanaReservas, VencenReservas } from "@/lib/reservas-listado";
import { listarMateriasActivas } from "@/server/materias/materia.service";
import { exigirPermiso } from "@/server/shared/with-permission";
import { listarReservasPendientes, listarReservasVencidas, resumenReservas } from "@/server/turnos/inscripcion.publico";
import { ReservasPendientesQuerySchema, ReservasVencidasQuerySchema, filtrosReservas } from "@/server/turnos/reserva.schema";
import { ListadoReservas, type ListadoInicial } from "./listado-reservas";
import { ResumenReservas } from "./resumen-reservas";

type Parametros = Record<string, string | string[] | undefined>;

/**
 * «Reservas» (HU-C-26, spec_modulo_C.md §2.20): reservas pendientes de pago de
 * todas las clases, solo para mesa de entrada (`reservas:leer`, criterio 8).
 * Entrega el primer render con la pestaña (`?tab=`), los filtros y la página
 * de la URL; los filtros los sigue `ListadoReservas` en el cliente. Las
 * lecturas son exclusivamente las públicas de C (criterio 8, Regla N.° 3).
 */
export default async function ReservasPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  await exigirPermiso("reservas:leer");
  const parametros = await searchParams;
  const tab: PestanaReservas = parametros.tab === "vencidas" ? "vencidas" : "pendientes";
  const query = leerQuery(tab, parametros);

  const [resumen, listado, materias] = await Promise.all([
    resumenReservas(),
    tab === "pendientes"
      ? listarReservasPendientes(filtrosReservas(query)).then((datos): ListadoInicial => ({ tab, datos }))
      : listarReservasVencidas(filtrosReservas(query)).then((datos): ListadoInicial => ({ tab, datos })),
    listarMateriasActivas(),
  ]);
  const filtros: FiltrosReservas = {
    ...(query.alumno ? { alumno: query.alumno } : {}),
    ...(query.materia_id ? { materiaId: query.materia_id } : {}),
    ...(tab === "pendientes" && "vencen" in query && query.vencen ? { vencen: query.vencen as VencenReservas } : {}),
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{texto("ui.reservas.titulo")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{texto("ui.reservas.subtitulo")}</p>
      </div>

      <ResumenReservas resumen={resumen} />

      {/* Sin `key`: al paginar o refrescar, ListadoReservas adopta los datos nuevos sin remontarse. */}
      <ListadoReservas
        listado={listado}
        filtrosIniciales={filtros}
        materias={materias.map((m) => ({ id: m.idMateria, nombre: m.nombreMateria }))}
      />

      <p className="text-sm text-muted-foreground">
        {resumen.vencieron_hoy === 1
          ? texto("ui.reservas.pie.procesoAutomaticoUna")
          : texto("ui.reservas.pie.procesoAutomatico", { n: resumen.vencieron_hoy })}
      </p>
    </div>
  );
}

/**
 * Filtros de la URL validados con el mismo schema que la API. Un parámetro
 * inválido (o ajeno, como un banner) se ignora en vez de romper la pantalla,
 * igual que en `/personal`.
 */
function leerQuery(tab: PestanaReservas, parametros: Parametros) {
  const candidato: Record<string, string> = {};
  for (const clave of ["alumno", "materia_id", "pagina", ...(tab === "pendientes" ? ["vencen"] : [])]) {
    const valor = parametros[clave];
    if (typeof valor === "string" && valor !== "") candidato[clave] = valor;
  }
  const schema = tab === "pendientes" ? ReservasPendientesQuerySchema : ReservasVencidasQuerySchema;
  const completo = schema.safeParse(candidato);
  if (completo.success) return completo.data;
  const invalidos = new Set(Object.keys(completo.error.flatten().fieldErrors));
  return schema.parse(Object.fromEntries(Object.entries(candidato).filter(([clave]) => !invalidos.has(clave))));
}
