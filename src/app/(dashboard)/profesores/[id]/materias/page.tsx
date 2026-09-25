import { LinkProtegido } from "@/components/sesion/link-protegido";
import { notFound, redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { StepperAltaProfesor } from "@/components/shared/stepper-alta-profesor";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { listarMateriasActivas } from "@/server/materias/materia.service";
import {
  obtenerFichaProfesor,
  obtenerMateriasDelProfesor,
} from "@/server/profesores/profesor.service";
import { AsociarMateriasForm, type OpcionMateria } from "./asociar-materias-form";

const MENSAJE_PROFESOR_INACTIVO = "Solo pueden asociarse materias a profesores activos";

/**
 * Asociación de materias al profesor (HU-D-03). El chequeo de permiso de acá
 * evita montar el formulario para un rol sin `profesores:editar`; el rechazo
 * que realmente importa lo repite `asociarMateriasProfesor()` en
 * `src/server/profesores/actions.ts` (mismo criterio que `contacto/page.tsx`).
 *
 * Las opciones son la unión de las materias activas del catálogo y las ya
 * asociadas que hoy están inactivas (HU-D-03 §1 punto 12): una asociación
 * existente nunca se oculta solo porque la materia se dio de baja. Las
 * inactivas no asociadas no se muestran.
 */
export default async function AsociarMateriasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ alta?: string }>;
}) {
  const [{ id }, { alta }] = await Promise.all([params, searchParams]);
  // Paso 2 del wizard de alta (`?alta=1`, desde /profesores/nuevo): stepper,
  // "Completar esto más tarde" y, al guardar, avance automático al horario.
  const modoAlta = alta === "1";

  try {
    await verificarPermiso("profesores:editar");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/profesores");
    }
    throw error;
  }

  const profesor = await obtenerFichaProfesor(id);
  if (!profesor) {
    notFound();
  }

  const [asociadas, activas] = await Promise.all([
    obtenerMateriasDelProfesor(profesor.id),
    listarMateriasActivas(),
  ]);

  // Mismo contrato de "materia activa" que turnos/configuracion (HU-C-03).
  const materiasActivas = activas.map((materia) => ({
    id: materia.idMateria,
    nombre: materia.nombreMateria,
    codigo: materia.codigoMateria,
  }));
  const idsAsociadas = new Set(asociadas.map((materia) => materia.id));
  const opciones: OpcionMateria[] = [
    ...materiasActivas.map((materia) => ({
      ...materia,
      activa: true,
      asociada: idsAsociadas.has(materia.id),
    })),
    ...asociadas
      .filter((materia) => !materia.activa)
      .map((materia) => ({ ...materia, asociada: true })),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const rutaFicha = `/profesores/${profesor.id}`;
  let contenido;
  if (!profesor.activo) {
    contenido = <p className="text-sm text-muted-foreground">{MENSAJE_PROFESOR_INACTIVO}</p>;
  } else if (materiasActivas.length === 0) {
    contenido = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">No hay materias activas para asociar</p>
        {/* Sin materias para elegir el wizard no se traba: se puede seguir con el horario. */}
        {modoAlta && (
          <LinkProtegido
            href={`/profesores/horarios/nuevo?profesorId=${profesor.id}&alta=1`}
            className={buttonVariants({ variant: "default" })}
          >
            Continuar con el horario
          </LinkProtegido>
        )}
      </div>
    );
  } else {
    contenido = <AsociarMateriasForm profesorId={profesor.id} opciones={opciones} modoAlta={modoAlta} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-5 p-6">
      {modoAlta ? (
        <StepperAltaProfesor paso={2} />
      ) : (
        <LinkProtegido
          href={rutaFicha}
          className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Volver a la ficha
        </LinkProtegido>
      )}
      <div>
        <h1 className="text-2xl font-semibold">Materias del profesor</h1>
        <p className="text-sm text-muted-foreground">
          {profesor.apellido}, {profesor.nombre} · DNI {profesor.dni}
        </p>
      </div>
      {contenido}
    </div>
  );
}
