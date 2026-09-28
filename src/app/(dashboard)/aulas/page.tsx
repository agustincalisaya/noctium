import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PermisoError, verificarPermiso } from "@/server/shared/with-permission";
import { ListarAulasQuerySchema } from "@/server/aulas/aula.schema";
import { listarAulas } from "@/server/aulas/aula.service";
import { AulasInteractivas } from "./aulas-interactivas";

export default async function AulasPage({
  searchParams,
}: {
  searchParams: Promise<{ creada?: string; pagina?: string }>;
}) {
  let rol;
  try {
    ({ rol } = await verificarPermiso("aulas:leer"));
  } catch (error) {
    if (error instanceof PermisoError) redirect("/home");
    throw error;
  }

  const { creada, pagina } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-6xl px-1 py-2 sm:px-2">
      <Suspense fallback={<CargandoAulas />}>
        <ContenidoAulas pagina={pagina} esGerente={rol === "GERENTE"} creada={creada === "1"} />
      </Suspense>
    </div>
  );
}

function CargandoAulas() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-card p-12 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Cargando aulas
    </div>
  );
}

async function ContenidoAulas({
  pagina,
  esGerente,
  creada,
}: {
  pagina: string | undefined;
  esGerente: boolean;
  creada: boolean;
}) {
  const paginaSolicitada = Number(pagina);
  const query = ListarAulasQuerySchema.parse({
    pagina: Number.isFinite(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : undefined,
  });
  const { items, paginacion } = await listarAulas(query);

  return <AulasInteractivas items={items} paginacion={paginacion} esGerente={esGerente} creada={creada} />;
}
