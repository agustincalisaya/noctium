import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { esModoEdicion, fueActualizada, rutaModoEdicion, rutaTrasGuardar } from "@/lib/modo-edicion";
import { formatearApellidoNombre } from "@/lib/profesor-listado";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import { getParametroNumerico } from "@/server/shared/parametros";
import { fechaUTCHaceAnios } from "@/server/shared/fecha";
import { obtenerDetalleProfesor } from "@/server/profesores/profesor.service";
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
const MENSAJE_MATERIAS_ACTUALIZADAS = "Materias del profesor actualizadas";

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
        />
      </div>
    );
  }

  const puedeEditar = await tienePermiso("profesores:editar");
  const soloMaterias = query.actualizada === ACTUALIZADA_SOLO_MATERIAS;
  const pendientes = Number(query.pendientes);
  const pendientesAfectados = soloMaterias && Number.isSafeInteger(pendientes) && pendientes > 0 ? pendientes : 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6">
      {breadcrumb}

      {fueActualizada(query) && (
        <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Profesor actualizado correctamente
        </p>
      )}
      {soloMaterias && (
        <div role="status" className="space-y-2">
          <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
            {MENSAJE_MATERIAS_ACTUALIZADAS}
          </p>
          {pendientesAfectados > 0 && (
            <p className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
              Atención: hay {pendientesAfectados} turnos pendientes de las materias quitadas que no van a
              poder confirmarse con este profesor.
            </p>
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
          >
            Editar
          </Link>
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
    </div>
  );
}
