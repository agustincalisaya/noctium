import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirPermiso, tienePermiso } from "@/server/shared/with-permission";
import { obtenerDetalleProfesor } from "@/server/profesores/profesor.service";
import { FichaEncabezado } from "./ficha-encabezado";
import { FichaIdentidad } from "./ficha-identidad";
import { FichaContacto } from "./ficha-contacto";
import { FichaMaterias } from "./ficha-materias";
import { FichaHorarios } from "./ficha-horarios";

/**
 * Detalle del profesor en modo consulta (HU-D-05 criterio 3): identidad,
 * estado y fecha de alta, contacto (HU-D-02), todas las materias asociadas
 * (HU-D-03) y el horario de atención agrupado por día (HU-D-04).
 *
 * Permiso: `profesores:leer` gatea el acceso. Los accesos a editar contacto,
 * asociar materias y registrar horario son de HU-D-02/03/04 y solo se
 * muestran con `profesores:editar` (cada acción lo vuelve a verificar).
 *
 * `?pagina=` es la página del listado desde la que se abrió: "Volver al
 * listado" vuelve a esa misma página.
 */
export default async function ProfesorDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  await exigirPermiso("profesores:leer");
  const puedeEditar = await tienePermiso("profesores:editar");

  const [{ id }, { pagina }] = await Promise.all([params, searchParams]);

  const profesor = await obtenerDetalleProfesor(id);
  if (!profesor) {
    notFound();
  }

  const paginaListado = Number(pagina);
  const hrefListado =
    Number.isSafeInteger(paginaListado) && paginaListado > 1
      ? `/profesores?pagina=${paginaListado}`
      : "/profesores";

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5 p-6">
      <Link
        href={hrefListado}
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver al listado
      </Link>
      <FichaEncabezado
        nombre={profesor.nombre}
        apellido={profesor.apellido}
        dni={profesor.dni}
        activo={profesor.activo}
      />
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
