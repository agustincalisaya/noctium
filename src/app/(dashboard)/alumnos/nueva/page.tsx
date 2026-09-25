import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { auth } from "@/auth";
import { getParametroNumerico } from "@/server/shared/parametros";
import { AlumnoForm } from "./alumno-form";

export default async function NuevoAlumnoPage() {
  // Gateo de UI (criterio 1: "solo los roles autorizados"); la verificación
  // real es la de verificarPermiso("alumnos:crear") dentro del Server
  // Action — esto solo evita mostrar el formulario a quien no podría
  // enviarlo (mismo patrón que materias/nueva/page.tsx, HU-L-01).
  const session = await auth();
  if (session?.user?.rol !== "MESA_ENTRADA") {
    redirect("/alumnos");
  }

  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="flex items-center text-xl font-semibold">
          <GraduationCap className="mr-2 size-5" aria-hidden />
          Nuevo alumno
        </h1>
        <p className="text-sm text-muted-foreground">
          Registrá los datos de identidad y, si los tenés, de contacto del alumno.
        </p>
      </div>
      <AlumnoForm dniLongitudMin={dniLongitudMin} dniLongitudMax={dniLongitudMax} />
    </main>
  );
}
