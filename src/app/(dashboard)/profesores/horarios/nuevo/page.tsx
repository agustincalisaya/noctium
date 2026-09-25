import { LinkProtegido } from "@/components/sesion/link-protegido";
import { redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import {
  listarProfesoresActivos,
  obtenerHorariosDelProfesor,
  obtenerMateriasDelProfesor,
} from "@/server/profesores/profesor.service";
import { ResumenSemanalHorarios } from "@/components/shared/resumen-semanal-horarios";
import { StepperAltaProfesor } from "@/components/shared/stepper-alta-profesor";
import { RegistrarHorarioForm } from "./registrar-horario-form";

/**
 * Registrar horario de atención (HU-D-04). Desde la ficha se entra con
 * `?profesorId=<id>` y el selector viene precargado; el selector solo ofrece
 * profesores activos (c1), así que un id inactivo o inexistente en la URL
 * se ignora. Debajo del formulario se muestra el resumen semanal del
 * profesor elegido: cambiar de profesor actualiza la URL y el servidor
 * vuelve a renderizar el resumen; guardar lo refresca (c6).
 *
 * Los días y horas ofrecidos salen de `ParametroSistema` (nunca
 * hardcodeados en el formulario). El chequeo de permiso de acá evita montar
 * el formulario; el que importa lo repite la Server Action.
 */
export default async function RegistrarHorarioPage({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const { profesorId: profesorIdParam, alta } = await searchParams;

  try {
    await verificarPermiso("profesores:editar");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/profesores");
    }
    throw error;
  }

  const [parametros, profesores] = await Promise.all([
    obtenerParametrosHorarioOperativo(),
    listarProfesoresActivos(),
  ]);

  const profesor =
    typeof profesorIdParam === "string"
      ? profesores.find((opcion) => opcion.id === profesorIdParam)
      : undefined;
  const [horarios, materias] = profesor
    ? await Promise.all([obtenerHorariosDelProfesor(profesor.id), obtenerMateriasDelProfesor(profesor.id)])
    : [[], []];
  const rutaVolver = profesor ? `/profesores/${profesor.id}` : "/profesores";
  // Paso 3 del wizard de alta (`?alta=1`): solo con un profesor válido; si el
  // id no corresponde a un activo, la pantalla vuelve a su modo normal.
  const modoAlta = alta === "1" && !!profesor;

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-5 p-6">
      {modoAlta ? (
        <StepperAltaProfesor paso={3} />
      ) : (
        <LinkProtegido
          href={rutaVolver}
          className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {profesor ? "Volver a la ficha" : "Volver al listado"}
        </LinkProtegido>
      )}
      <div>
        <h1 className="text-2xl font-semibold">Registrar horario de atención</h1>
        {/* Mismo encabezado que la pantalla de materias (paso 2). */}
        {modoAlta && profesor && (
          <p className="text-sm text-muted-foreground">
            {profesor.apellido}, {profesor.nombre} · DNI {profesor.dni}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          El intervalo se repite todas las semanas, para todas las materias del profesor. Horario
          operativo del centro: {parametros.apertura} a {parametros.cierre}.
        </p>
      </div>

      {/* Advertencia, no bloqueo: el horario es independiente de la materia
          (§2.4) y el servidor lo acepta sin materias asociadas. */}
      {profesor && materias.length === 0 && (
        <p role="status" className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
          Este profesor todavía no tiene materias asignadas.{" "}
          <LinkProtegido
            href={`/profesores/${profesor.id}/materias${modoAlta ? "?alta=1" : ""}`}
            className="font-medium underline underline-offset-4"
          >
            Asignar materias
          </LinkProtegido>
        </p>
      )}

      {profesores.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay profesores activos</p>
      ) : (
        <RegistrarHorarioForm
          profesores={profesores}
          profesorIdInicial={profesor?.id ?? ""}
          parametros={parametros}
          modoAlta={modoAlta}
          cantidadHorarios={horarios.length}
        />
      )}

      {profesor && (
        <section
          aria-labelledby="resumen-semanal"
          className="space-y-3 rounded-md border border-border bg-card p-5 text-card-foreground"
        >
          <h2 id="resumen-semanal" className="text-lg font-semibold">
            Horario de {profesor.apellido}, {profesor.nombre}
          </h2>
          <ResumenSemanalHorarios horarios={horarios} />
        </section>
      )}
    </div>
  );
}
