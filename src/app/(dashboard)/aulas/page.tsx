import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { auth } from "@/auth";

// Listado real: HU-K-02 (fuera de alcance de HU-K-01). Esta página sigue
// siendo un stub — solo se agrega el banner de éxito del alta y el acceso
// a "Nueva aula", gateado por rol (la verificación real es la de
// verificarPermiso("aulas:crear") en el Server Action).
export default async function AulasPage({
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
        <p className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">
          Aula registrada correctamente
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Aulas</h1>
        {esGerente && (
          <Link
            href="/aulas/nueva"
            className="flex items-center text-sm font-medium underline underline-offset-4"
          >
            <DoorOpen className="mr-2 size-4" aria-hidden />
            Nueva aula
          </Link>
        )}
      </div>

      <p className="text-sm text-muted-foreground">Aulas - en construcción (listado: HU-K-02)</p>
    </div>
  );
}
