import { texto as textoC19 } from "@/lib/textos";
import { texto } from "@/lib/textos";
import { Badge } from "@/components/ui/badge";
import { agruparHorariosPorDia, ETIQUETA_DIA } from "@/lib/horario-atencion";
import { FichaDatos, FichaSeccion } from "./ficha-seccion";
import { EstadoProfesorDialog } from "./estado-profesor-dialog";
import { HistorialEstadosProfesor } from "./historial-estados-profesor";
import { obtenerHistorialEstadosProfesor } from "@/server/profesores/profesor.estado.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { esModoEdicion, fueActualizada, rutaModoEdicion, rutaTrasGuardar } from "@/lib/modo-edicion";
import { formatearApellidoNombre } from "@/lib/profesor-listado";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import { getParametroNumerico } from "@/server/shared/parametros";
import { fechaUTCHaceAnios } from "@/server/shared/fecha";
import { obtenerCuentaDeProfesor, obtenerDetalleProfesor } from "@/server/profesores/profesor.service";
import { CuentaAccesoCard } from "@/components/shared/cuenta-acceso-card";
import { listarMateriasActivas } from "@/server/materias/materia.service";
import type { OpcionMateria } from "./materias/asociar-materias-form";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaIdentidad } from "./ficha-identidad";
import { FichaContacto } from "./ficha-contacto";
import { FichaMaterias } from "./ficha-materias";
import { FichaHorarios } from "./ficha-horarios";
import { EditarProfesorForm } from "./editar-profesor-form";

/**
 * Ficha del profesor: detalle en modo consulta (HU-D-05 criterio 3) y modo
 * edición de identidad y contacto (HU-D-06) sobre la misma ruta, con
 * `?modo=edicion` (ver `@/lib/modo-edicion`).
 *
 * Permiso: `profesores:leer` gatea el acceso. El botón «Editar» y los
 * accesos de HU-D-02/03/04 solo se muestran con `profesores:editar`; el modo
 * edición lo exige para montar el formulario, y la Server Action lo vuelve
 * a verificar al guardar.
 *
 * `?pagina=` es la página del listado desde la que se abrió: el breadcrumb
 * vuelve a esa misma página, también al pasar por el modo edición.
 *
 * Banners de vuelta (HU-D-06 AC3, HU-D-07 AC4): `?actualizada=1` si cambiaron
 * los datos (con o sin materias) y `?actualizada=materias` si solo cambiaron
 * las materias; `&pendientes=N` suma el aviso de turnos pendientes afectados.
 */
const ACTUALIZADA_SOLO_MATERIAS = "materias";
const MENSAJE_MATERIAS_ACTUALIZADAS = textoC19("ui.clases.profesores.materiasDelProfesorActualizadas");

export default async function ProfesorDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirPermiso("profesores:leer");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const edicion = esModoEdicion(query);
  if (edicion) {
    await exigirPermiso("profesores:editar");
  }

  const profesor = await obtenerDetalleProfesor(id);
  if (!profesor) {
    notFound();
  }
  // Sección «Cuenta de acceso» (HU-A-06 c5) y aviso del email en la edición (c6).
  const cuenta = await obtenerCuentaDeProfesor(profesor.id);

  const paginaListado = Number(query.pagina);
  const pagina = Number.isSafeInteger(paginaListado) && paginaListado > 1 ? paginaListado : null;
  const hrefListado = pagina ? `/profesores?pagina=${pagina}` : "/profesores";
  const conPagina = (ruta: string) => (pagina ? `${ruta}${ruta.includes("?") ? "&" : "?"}pagina=${pagina}` : ruta);
  const rutaFicha = `/profesores/${profesor.id}`;

  const breadcrumb = (
    <Breadcrumb
      tramos={[
        { etiqueta: "Profesores", href: hrefListado },
        { etiqueta: formatearApellidoNombre(profesor.apellido, profesor.nombre) },
      ]}
    />
  );

  if (edicion) {
    const [dniLongitudMin, dniLongitudMax, activas] = await Promise.all([
      getParametroNumerico("dni_longitud_min", 7),
      getParametroNumerico("dni_longitud_max", 8),
      listarMateriasActivas(),
    ]);
    // Selector de HU-D-07: mismas opciones que la asociación de HU-D-03
    // (materias/page.tsx): activas del catálogo + asociadas hoy inactivas.
    const idsAsociadas = new Set(profesor.materias.map((materia) => materia.id));
    const opcionesMaterias: OpcionMateria[] = [
      ...activas.map((materia) => ({
        id: materia.idMateria,
        nombre: materia.nombreMateria,
        codigo: materia.codigoMateria,
        activa: true,
        asociada: idsAsociadas.has(materia.idMateria),
      })),
      ...profesor.materias
        .filter((materia) => !materia.activa)
        .map((materia) => ({ ...materia, asociada: true })),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    // Mismo límite de mayoría de edad que el alta (nuevo/page.tsx).
    const fechaMaximaNacimiento = fechaUTCHaceAnios(18).toISOString().slice(0, 10);

    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 p-6">
        {breadcrumb}
        {/* key: al recargar tras un conflicto de edición llega una `version`
            nueva y el formulario se remonta con los datos actuales. */}
        <EditarProfesorForm
          key={profesor.version}
          profesor={profesor}
          dniLongitudMin={dniLongitudMin}
          dniLongitudMax={dniLongitudMax}
          fechaMaximaNacimiento={fechaMaximaNacimiento}
          rutaConsulta={conPagina(rutaFicha)}
          rutaTrasGuardar={conPagina(rutaTrasGuardar(rutaFicha))}
          rutaTrasGuardarMaterias={conPagina(`${rutaFicha}?actualizada=${ACTUALIZADA_SOLO_MATERIAS}`)}
          opcionesMaterias={opcionesMaterias}
          conCuenta={cuenta.estado !== "SIN_CUENTA"}
        />
      </div>
    );
  }

  const puedeEditar = await tienePermiso("profesores:editar");
  const puedeCambiarEstado = await tienePermiso("profesores:cambiar_estado");
  const historial = await obtenerHistorialEstadosProfesor(profesor.id);
  if (puedeCambiarEstado) {
    return <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-4 sm:p-6">
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">{profesor.nombre} {profesor.apellido}</h1><p className="mt-1 text-sm text-muted-foreground">{texto("ui.profesores.estado.consulta")}</p></div>
        <EstadoProfesorDialog profesor={profesor} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <FichaSeccion titulo={texto("ui.profesores.estado.datos")}>
            <FichaDatos datos={[[texto("ui.profesores.estado.nombre"), profesor.nombre], [texto("ui.profesores.estado.apellido"), profesor.apellido], [texto("ui.profesores.estado.dni"), profesor.dni], [texto("ui.profesores.estado.telefono"), profesor.telefono], [texto("ui.profesores.estado.email"), profesor.email]]} />
            <h3 className="text-sm text-muted-foreground">{texto("ui.profesores.estado.horario")}</h3>
            <div className="flex flex-wrap gap-2">{agruparHorariosPorDia(profesor.horarios).map(({ dia, intervalos }) => <Badge key={dia} variant="muted">{ETIQUETA_DIA[dia]} {intervalos.map((i) => `${i.horaInicio}–${i.horaFin}`).join(", ")}</Badge>)}</div>
          </FichaSeccion>
          <HistorialEstadosProfesor historial={historial} />
        </div>
        <div className="space-y-4">
          <FichaSeccion titulo={texto("ui.profesores.estado.materias")}><div className="flex flex-wrap gap-2">{profesor.materias.map((m) => <Badge key={m.id} variant="muted">{m.nombre}{!m.activa && ` (${texto("ui.profesores.estado.inactiva")})`}</Badge>)}</div></FichaSeccion>
          <CuentaAccesoCard cuenta={cuenta} />
        </div>
      </div>
    </div>;
  }
  const soloMaterias = query.actualizada === ACTUALIZADA_SOLO_MATERIAS;
  const pendientes = Number(query.pendientes);
  const pendientesAfectados = soloMaterias && Number.isSafeInteger(pendientes) && pendientes > 0 ? pendientes : 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6">
      {breadcrumb}

      {fueActualizada(query) && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">{textoC19("ui.clases.profesores.profesorActualizadoCorrectamente")}</p>
      )}
      {soloMaterias && (
        <div role="status" className="space-y-2">
          <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
            {MENSAJE_MATERIAS_ACTUALIZADAS}
          </p>
          {pendientesAfectados > 0 && (
            <p className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">{textoC19(pendientesAfectados === 1 ? "ui.clases.profesores.pendienteAfectada" : "ui.clases.profesores.pendientesAfectadas", { cantidad: pendientesAfectados })}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <FichaEncabezado
          nombre={profesor.nombre}
          apellido={profesor.apellido}
          dni={profesor.dni}
          activo={profesor.activo}
        />
        {puedeEditar && (
          <Link
            href={conPagina(rutaModoEdicion(rutaFicha))}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >{textoC19("ui.formasPago.editar")}</Link>
        )}
      </div>
      <FichaIdentidad profesor={profesor} />
      <FichaContacto
        profesorId={profesor.id}
        telefono={profesor.telefono}
        email={profesor.email}
        puedeEditar={puedeEditar}
      />
      <FichaMaterias
        profesorId={profesor.id}
        activo={profesor.activo}
        materias={profesor.materias}
        puedeEditar={puedeEditar}
      />
      <FichaHorarios
        profesorId={profesor.id}
        activo={profesor.activo}
        horarios={profesor.horarios}
        puedeEditar={puedeEditar}
      />
      {/* HU-A-06 criterio 5: una ficha anterior muestra «Sin cuenta». */}
      <CuentaAccesoCard cuenta={cuenta} />
      <HistorialEstadosProfesor historial={historial} />
    </div>
  );
}
