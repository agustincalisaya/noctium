import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ListarAlumnosQuerySchema } from "@/server/alumnos/alumno.schema";
import { listarAlumnos } from "@/server/alumnos/alumno.service";
import { ListadoAlumnos } from "./listado-alumnos";

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; pagina?: string; q?: string; sin_contacto?: string; motivo?: string }>;
}) {
  let rol;
  try {
    ({ rol } = await verificarPermiso("alumnos:leer"));
  } catch (error) {
    if (error instanceof PermisoError) redirect("/home");
    throw error;
  }

  const { creada, pagina, q, sin_contacto: sinContacto, motivo } = await searchParams;
  const esMesaDeEntrada = rol === "MESA_ENTRADA";

  return (
    <div className="space-y-4 p-6">
      {creada === "1" && (
        <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Alumno registrado correctamente
        </p>
      )}
      {/* Alta con contacto cuyo guardado falló (alumno-form.tsx): el alumno
          quedó creado, solo falta el contacto. */}
      {creada === "1" && sinContacto && (
        <p role="status" className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
          {motivo === "email_ya_asociado"
            ? "Los datos de contacto no se guardaron: el email ya está asociado a otra cuenta."
            : "Los datos de contacto no se guardaron."}{" "}
          Podés cargarlos más tarde desde la ficha.{" "}
          {esMesaDeEntrada && (
            <Link href={`/alumnos/${encodeURIComponent(sinContacto)}/contacto`} className="font-medium underline underline-offset-4">
              Cargar datos de contacto
            </Link>
          )}
        </p>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Alumnos</h1>
          <p className="text-sm text-muted-foreground">
            Buscá por apellido, nombre o DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).
          </p>
        </div>
        {/* Ocultamiento de UI únicamente — la verificación real es la de
            verificarPermiso("alumnos:crear") en el Server Action. */}
        {esMesaDeEntrada && (
          <Link
            href="/alumnos/nueva"
            className="flex items-center text-sm font-medium underline underline-offset-4"
          >
            <GraduationCap className="mr-2 size-4" aria-hidden />
            Nuevo alumno
          </Link>
        )}
      </div>

      {/*
       * Suspense manual, acotado a esta tabla — a propósito NO es un
       * `loading.tsx` de archivo: ese boundary es automático a nivel de
       * segmento de ruta y cascadea a TODOS los hijos, incluido
       * `alumnos/[id]/page.tsx`, rompiendo el status code 404 de
       * `notFound()` en el detalle (mismo hallazgo que HU-L-02 en
       * Materias). Mismo patrón que `materias/page.tsx`.
       */}
      <Suspense fallback={<CargandoAlumnos />}>
        <TablaAlumnos pagina={pagina} q={q} esMesaDeEntrada={esMesaDeEntrada} />
      </Suspense>
    </div>
  );
}

function CargandoAlumnos() {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando alumnos
    </div>
  );
}

async function TablaAlumnos({
  pagina,
  q,
  esMesaDeEntrada,
}: {
  pagina: string | undefined;
  q: string | undefined;
  esMesaDeEntrada: boolean;
}) {
  const paginaSolicitada = Number(pagina);
  const base = {
    pagina: Number.isFinite(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : undefined,
  };
  // Un `q` inválido escrito a mano en la URL (más de 100 caracteres) se
  // ignora en vez de romper la página: el listado sale sin filtro.
  const conBusqueda = ListarAlumnosQuerySchema.safeParse({ ...base, q });
  const query = conBusqueda.success ? conBusqueda.data : ListarAlumnosQuerySchema.parse(base);
  const inicial = await listarAlumnos(query);

  // Sin `key`: cuando el paginador navega, ListadoAlumnos adopta los datos
  // nuevos sin remontarse, así la tabla no se desarma (HU-B-05, 1.4).
  return (
    <ListadoAlumnos
      inicial={inicial}
      qInicial={query.q ?? ""}
      esMesaDeEntrada={esMesaDeEntrada}
    />
  );
}
