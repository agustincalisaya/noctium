import { texto as textoC19 } from "@/lib/textos";
import Link from "next/link";
import { texto } from "@/lib/textos";
import { HistorialClases } from "./historial-clases";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerCuentaDeAlumno, obtenerDetalleAlumno } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";
import { parametrosListadoAlumnos } from "@/lib/alumno-listado";
import { HistorialAcademico } from "./historial-academico";
import { HistorialPagos } from "./historial-pagos";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaContacto } from "./ficha-contacto";
import { FichaAltaPago } from "./ficha-alta-pago";
import { CuentaAccesoCard } from "@/components/shared/cuenta-acceso-card";
import { EstadoAlumnoDialog } from "./estado-alumno-dialog";
import { HistorialEstadosAlumno } from "./historial-estados-alumno";
import { obtenerHistorialEstadosAlumno } from "@/server/alumnos/alumno.estado.service";

async function permisoOpcional(accion: string) {
  try {
    return await verificarPermiso(accion);
  } catch (error) {
    if (error instanceof PermisoError && error.status === 403) return null;
    if (error instanceof PermisoError && error.status === 401) redirect("/login");
    throw error;
  }
}

export default async function AlumnoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string; q?: string; tab?: string; volver?: string; materia_id?: string; desde?: string; hasta?: string; forma_pago_id?: string; estado_pago?: string }>;
}) {
  const { id } = await params;
  const { pagina, q, tab, volver, materia_id, desde, hasta, forma_pago_id, estado_pago } = await searchParams;
  const [usuarioFicha, usuarioHistorial, usuarioEditar, usuarioCambiarEstado, usuarioRegistrarExamen, usuarioRegistrarIndicacion, usuarioPagos, usuarioCrearPago] = await Promise.all([
    permisoOpcional("alumnos:leer"),
    permisoOpcional("historial:leer"),
    permisoOpcional("alumnos:editar"),
    permisoOpcional("alumnos:cambiar_estado"),
    permisoOpcional("examenes:registrar"),
    permisoOpcional("indicaciones:registrar"),
    permisoOpcional("pagos:leer"),
    permisoOpcional("pagos:crear"),
  ]);
  if (!usuarioFicha || !["MESA_ENTRADA", "GERENTE"].includes(usuarioFicha.rol)) redirect("/sin-permiso");
  const mostrarClases = tab === "clases";
  if (tab === "pagos" && !usuarioPagos) redirect("/sin-permiso");
  const mostrarPagos = tab === "pagos" && usuarioPagos !== null;
  const gerente = usuarioFicha.rol === "GERENTE";
  const puedeLeerFicha = usuarioFicha !== null;
  const puedeLeerHistorial = usuarioHistorial !== null;
  if (!puedeLeerFicha && !puedeLeerHistorial) redirect("/sin-permiso");

  // Solo se consulta la ficha completa cuando el usuario tiene alumnos:leer.
  // Un acceso exclusivo al historial nunca solicita DNI ni datos de contacto.
  let alumno: Awaited<ReturnType<typeof obtenerDetalleAlumno>> | null = null;
  if (puedeLeerFicha) {
    try {
      alumno = await obtenerDetalleAlumno(id);
    } catch (error) {
      if (error instanceof ServiceError && error.code === "ALUMNO_NO_ENCONTRADO") notFound();
      throw error;
    }
  }

  const mostrarHistorial = !puedeLeerFicha || (tab === "historial" && puedeLeerHistorial);
  const turnoOrigen = volver && /^\/turnos\/[^/]+$/.test(volver) ? volver : "/turnos";
  const paginaListado = Number(pagina);
  const hrefListado = `/alumnos${parametrosListadoAlumnos({
    q: q?.trim() || undefined,
    pagina: Number.isInteger(paginaListado) ? paginaListado : undefined,
  })}`;

  return (
    <div className={`mx-auto w-full min-w-0 space-y-5 p-6 ${mostrarHistorial || mostrarClases || mostrarPagos ? "max-w-6xl" : "max-w-3xl"}`}>
      {puedeLeerFicha && (mostrarHistorial || mostrarClases || mostrarPagos) && alumno ? (
        <nav aria-label={textoC19("ui.clases.interfaz.migasDePan")} className="text-sm text-muted-foreground">
          <Link href={hrefListado} className="text-primary underline underline-offset-4 hover:text-foreground">{textoC19("ui.clases.menu.alumnos")}</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page" className="text-foreground">{alumno.nombre} {alumno.apellido}</span>
        </nav>
      ) : (
        <Link
          href={puedeLeerFicha ? hrefListado : turnoOrigen}
          className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {puedeLeerFicha ? textoC19("ui.clases.interfaz.volverAlListado") : textoC19("ui.historial.clasesAlumno.volverClase")}
        </Link>
      )}

      {puedeLeerFicha && alumno ? (
        <>
          <div className={mostrarPagos ? "flex flex-wrap items-start justify-between gap-3" : undefined}>
          <FichaEncabezado
            alumnoId={alumno.id}
            nombre={alumno.nombre}
            apellido={alumno.apellido}
            dni={alumno.dni}
            email={mostrarHistorial || mostrarClases || mostrarPagos ? alumno.email : null}
            activo={alumno.is_active}
            puedeEditar={!mostrarHistorial && !mostrarClases && !mostrarPagos && !gerente && usuarioEditar !== null}
            modoHistorial={mostrarHistorial || mostrarClases || mostrarPagos}
            accion={!mostrarHistorial && !mostrarClases && !mostrarPagos && usuarioCambiarEstado ? <EstadoAlumnoDialog alumno={{ id: alumno.id, nombre: alumno.nombre, apellido: alumno.apellido, activo: alumno.is_active, version: alumno.version }} /> : undefined}
          />
          {mostrarPagos && usuarioCambiarEstado && <EstadoAlumnoDialog alumno={{ id: alumno.id, nombre: alumno.nombre, apellido: alumno.apellido, activo: alumno.is_active, version: alumno.version }} />}
          </div>
          {gerente && <p className="text-xs text-muted-foreground">{texto("ui.historial.clasesAlumno.consulta")}</p>}
          <nav className="flex gap-5 border-b border-border" aria-label={textoC19("ui.clases.interfaz.seccionesDeLaFicha")}>
            <Link
              href={`/alumnos/${encodeURIComponent(id)}?tab=datos`}
              aria-current={!mostrarHistorial && !mostrarClases && !mostrarPagos ? "page" : undefined}
              className={`border-b-2 px-1 py-2 text-sm ${!mostrarHistorial && !mostrarClases && !mostrarPagos ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >{textoC19("ui.clases.interfaz.datos")}</Link>
            <Link href={`/alumnos/${encodeURIComponent(id)}/clases`} aria-current={mostrarClases ? "page" : undefined} className={`border-b-2 px-1 py-2 text-sm ${mostrarClases ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{texto("ui.historial.clasesAlumno.tab")}</Link>
            {puedeLeerHistorial && <Link
              href={`/alumnos/${encodeURIComponent(id)}?tab=historial`}
              aria-current={mostrarHistorial ? "page" : undefined}
              className={`border-b-2 px-1 py-2 text-sm ${mostrarHistorial ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >{textoC19("ui.indicadores.presentismo.historial")}</Link>}
            {usuarioPagos && <Link href={ `/alumnos/${encodeURIComponent(id)}/pagos` } aria-current={mostrarPagos ? "page" : undefined} className={`border-b-2 px-1 py-2 text-sm ${mostrarPagos ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{texto("ui.pagos.historial.tab")}</Link>}
          </nav>
        </>
      ) : null}

      {mostrarHistorial && puedeLeerHistorial && (
        <HistorialAcademico
          alumnoId={id}
          materiaInicial={materia_id}
          puedeRegistrarExamen={!gerente && usuarioRegistrarExamen !== null}
          puedeRegistrarIndicacion={!gerente && usuarioRegistrarIndicacion !== null}
          mostrarNombre={!puedeLeerFicha}
        />
      )}
      {mostrarClases && <HistorialClases alumnoId={id} />}
      {mostrarPagos && <HistorialPagos alumnoId={id} alumnoNombre={alumno ? `${alumno.nombre} ${alumno.apellido}` : ""} puedeRegistrarPago={usuarioCrearPago?.rol === "MESA_ENTRADA"} iniciales={{ pagina, desde, hasta, forma_pago_id, materia_id, estado_pago }} />}
      {!mostrarHistorial && !mostrarClases && !mostrarPagos && alumno && (
        <>
          <FichaContacto
            alumnoId={alumno.id}
            telefono={alumno.telefono}
            email={alumno.email}
            puedeEditar={!gerente && usuarioEditar !== null}
          />
          <FichaAltaPago
            alumnoId={alumno.id}
            fechaAlta={alumno.created_at}
            formaPagoPreferida={alumno.forma_pago_preferida}
            formaPagoPreferidaActiva={alumno.forma_pago_preferida_activa}
            puedeEditar={!gerente && usuarioEditar !== null}
          />
          <div className="grid items-start gap-5 md:grid-cols-2">
            <CuentaAccesoCard cuenta={await obtenerCuentaDeAlumno(alumno.id)} />
            <HistorialEstadosAlumno historial={await obtenerHistorialEstadosAlumno(alumno.id)} />
          </div>
        </>
      )}
    </div>
  );
}
