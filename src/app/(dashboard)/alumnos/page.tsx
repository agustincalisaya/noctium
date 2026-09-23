import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { auth } from "@/auth";

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string }>;
}) {
  const session = await auth();
  const esMesaDeEntrada = session?.user?.rol === "MESA_ENTRADA";
  const { creada } = await searchParams;

  return (
    <div className="space-y-4 p-6">
      {creada === "1" && (
        <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Alumno registrado correctamente
        </p>
      )}

      <div className="flex items-center justify-between">
        <div>Alumnos - en construcción</div>
        {/* Ocultamiento de UI únicamente (criterio 1) — la verificación real
            es la de verificarPermiso("alumnos:crear") en el Server Action. */}
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
    </div>
  );
}
