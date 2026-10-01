import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerDetalleAlumno } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";
import { parametrosListadoAlumnos } from "@/lib/alumno-listado";
import { HistorialAcademico } from "./historial-academico";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaContacto } from "./ficha-contacto";
import { FichaAltaPago } from "./ficha-alta-pago";

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
  searchParams: Promise<{ pagina?: string; q?: string; tab?: string; volver?: string }>;
}) {
  const { id } = await params;
  const { pagina, q, tab, volver } = await searchParams;
  const [usuarioFicha, usuarioHistorial, usuarioEditar, usuarioRegistrarExamen] = await Promise.all([
    permisoOpcional("alumnos:leer"),
    permisoOpcional("historial:leer"),
    permisoOpcional("alumnos:editar"),
    permisoOpcional("examenes:registrar"),
  ]);
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
    <div className={`mx-auto w-full min-w-0 space-y-5 p-6 ${mostrarHistorial ? "max-w-6xl" : "max-w-3xl"}`}>
      {puedeLeerFicha && mostrarHistorial && alumno ? (
        <nav aria-label="Migas de pan" className="text-sm text-muted-foreground">
          <Link href={hrefListado} className="text-primary underline underline-offset-4 hover:text-foreground">Alumnos</Link>
          <span aria-hidden="true" className="px-2">/</span>
          <span aria-current="page" className="text-foreground">{alumno.nombre} {alumno.apellido}</span>
        </nav>
      ) : (
        <Link
          href={puedeLeerFicha ? hrefListado : turnoOrigen}
          className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {puedeLeerFicha ? "Volver al listado" : "Volver al turno"}
        </Link>
      )}

      {puedeLeerFicha && alumno ? (
        <>
          <FichaEncabezado
            alumnoId={alumno.id}
            nombre={alumno.nombre}
            apellido={alumno.apellido}
            dni={alumno.dni}
            email={mostrarHistorial ? alumno.email : null}
            activo={alumno.is_active}
            puedeEditar={!mostrarHistorial && usuarioEditar !== null}
            modoHistorial={mostrarHistorial}
          />
          <nav className="flex gap-5 border-b border-border" aria-label="Secciones de la ficha">
            <Link
              href={`/alumnos/${encodeURIComponent(id)}?tab=datos`}
              aria-current={!mostrarHistorial ? "page" : undefined}
              className={`border-b-2 px-1 py-2 text-sm ${!mostrarHistorial ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >Datos</Link>
            {puedeLeerHistorial && <Link
              href={`/alumnos/${encodeURIComponent(id)}?tab=historial`}
              aria-current={mostrarHistorial ? "page" : undefined}
              className={`border-b-2 px-1 py-2 text-sm ${mostrarHistorial ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >Historial académico</Link>}
          </nav>
        </>
      ) : null}

      {mostrarHistorial && puedeLeerHistorial && (
        <HistorialAcademico
          alumnoId={id}
          puedeRegistrarExamen={usuarioRegistrarExamen !== null}
          mostrarNombre={!puedeLeerFicha}
        />
      )}
      {!mostrarHistorial && alumno && (
        <>
          <FichaContacto
            alumnoId={alumno.id}
            telefono={alumno.telefono}
            email={alumno.email}
            puedeEditar={usuarioEditar !== null}
          />
          <FichaAltaPago
            alumnoId={alumno.id}
            fechaAlta={alumno.created_at}
            formaPagoPreferida={alumno.forma_pago_preferida}
            puedeEditar={usuarioEditar !== null}
          />
        </>
      )}
    </div>
  );
}
