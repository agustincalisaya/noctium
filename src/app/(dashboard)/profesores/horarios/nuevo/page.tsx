import Link from "next/link";
import { redirect } from "next/navigation";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerParametrosHorarioOperativo } from "@/server/shared/parametros";
import {
  listarProfesoresActivos,
  obtenerHorariosDelProfesor,
} from "@/server/profesores/profesor.service";
import { ResumenSemanalHorarios } from "@/components/shared/resumen-semanal-horarios";
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
  const { profesorId: profesorIdParam } = await searchParams;

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
  const horarios = profesor ? await obtenerHorariosDelProfesor(profesor.id) : [];
  const rutaVolver = profesor ? `/profesores/${profesor.id}` : "/profesores";

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-5 p-6">
      <Link
        href={rutaVolver}
        className="rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {profesor ? "Volver a la ficha" : "Volver al listado"}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Registrar horario de atención</h1>
        <p className="text-sm text-muted-foreground">
          El intervalo se repite todas las semanas, para todas las materias del profesor. Horario
          operativo del centro: {parametros.apertura} a {parametros.cierre}.
        </p>
      </div>

      {profesores.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay profesores activos</p>
      ) : (
        <RegistrarHorarioForm
          profesores={profesores}
          profesorIdInicial={profesor?.id ?? ""}
          parametros={parametros}
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
