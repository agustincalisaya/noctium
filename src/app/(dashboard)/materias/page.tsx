import Link from "next/link";
import { auth } from "@/auth";

export default async function MateriasPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string }>;
}) {
  const session = await auth();
  const esGerente = session?.user?.rol === "GERENTE";
  const { creada } = await searchParams;

  return (
    <div className="space-y-4 p-6">
      {creada === "1" && (
        <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
          Materia registrada correctamente
        </p>
      )}

      <div className="flex items-center justify-between">
        <div>Materias - en construcción</div>
        {/* Ocultamiento de UI únicamente (criterio 1) — la verificación real
            es la de verificarPermiso("materias:crear") en el Server Action. */}
        {esGerente && (
          <Link href="/materias/nueva" className="text-sm font-medium underline underline-offset-4">
            Nueva materia
          </Link>
        )}
      </div>
    </div>
  );
}
