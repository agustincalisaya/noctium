import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ListarFormasPagoQuerySchema } from "@/server/pagos/forma-pago.schema";
import { listarFormasPago } from "@/server/pagos/forma-pago.service";
import { FormasPagoInteractivas } from "./formas-pago-interactivas";

export default async function FormasPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  // La protección real es este guard (Regla N.° 10): el ítem del menú solo
  // oculta el acceso al resto de los roles.
  try {
    await verificarPermiso("formas_pago:crear");
  } catch (error) {
    if (error instanceof PermisoError) redirect("/home");
    throw error;
  }

  const { pagina } = await searchParams;

  return (
    <div className="p-6">
      {/* Suspense manual acotado a esta página, mismo criterio que Materias. */}
      <Suspense fallback={<CargandoFormasPago />}>
        <ListadoFormasPago pagina={pagina} />
      </Suspense>
    </div>
  );
}

function CargandoFormasPago() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Formas de pago</h1>
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Cargando formas de pago
      </div>
    </div>
  );
}

async function ListadoFormasPago({ pagina }: { pagina: string | undefined }) {
  const paginaSolicitada = Number(pagina);
  const query = ListarFormasPagoQuerySchema.parse({
    pagina: Number.isInteger(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : undefined,
  });
  const listado = await listarFormasPago(query);

  return <FormasPagoInteractivas items={listado.items} paginacion={listado.paginacion} />;
}
