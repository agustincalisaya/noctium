import { Suspense } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { texto } from "@/lib/textos";
import { ListarGerentesQuerySchema } from "@/server/gerentes/gerente.schema";
import { listarGerentes } from "@/server/gerentes/gerente.service";
import { exigirPermiso } from "@/server/shared/with-permission";
import { ListadoGerentes } from "./listado-gerentes";

/**
 * Listado de gerentes (P-47; HU-G-01 y HU-G-03, prototipo figura 96):
 * búsqueda y paginación de a 10 sobre activos e inactivos, con «(vos)» en la
 * fila del gerente autenticado. Esta página valida el permiso
 * (`gerentes:leer`, solo el Gerente), toma el id de la sesión y entrega el
 * primer render con el `q` y la `pagina` de la URL; la búsqueda la sigue
 * `ListadoGerentes` en el cliente. «Nuevo gerente» va siempre arriba a la
 * derecha.
 */
export default async function GerentesPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[]; q?: string | string[] }>;
}) {
  const sesion = await exigirPermiso("gerentes:leer");
  const { pagina, q } = await searchParams;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold">{texto("ui.gerentes.listado.titulo")}</h1>
          <p className="text-sm text-muted-foreground">{texto("ui.gerentes.listado.subtitulo")}</p>
        </div>
        <Link href="/gerentes/nuevo" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          {texto("ui.gerentes.listado.nuevo")}
        </Link>
      </div>

      {/* Suspense acotado a la tabla, no un `loading.tsx` de segmento: ese
          boundary alcanzaría también a la ficha y rompería el 404 de
          `notFound()` (mismo criterio que `/personal` y `/alumnos`). */}
      <Suspense fallback={<Cargando />}>
        <TablaGerentes pagina={pagina} q={q} sesionUsuarioId={sesion.id} />
      </Suspense>
    </div>
  );
}

function Cargando() {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {texto("ui.gerentes.listado.cargando")}
    </div>
  );
}

async function TablaGerentes({
  pagina,
  q,
  sesionUsuarioId,
}: {
  pagina?: string | string[];
  q?: string | string[];
  sesionUsuarioId: string;
}) {
  // Solo `pagina` y `q`: otros parámetros de la URL (por ejemplo un banner) no
  // tienen que romper el listado. Una página inválida vuelve a la 1 y un `q`
  // inválido (más de 100 caracteres) se ignora, como en `/personal`.
  const paginaSolicitada = Number(typeof pagina === "string" ? pagina : undefined);
  const base = { pagina: Number.isSafeInteger(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : 1 };
  const conBusqueda = ListarGerentesQuerySchema.safeParse({ ...base, ...(typeof q === "string" ? { q } : {}) });
  const query = conBusqueda.success ? conBusqueda.data : ListarGerentesQuerySchema.parse(base);
  const inicial = await listarGerentes(query, sesionUsuarioId);

  // Sin `key`: cuando el paginador navega, ListadoGerentes adopta los datos
  // nuevos sin remontarse.
  return <ListadoGerentes inicial={inicial} qInicial={query.q ?? ""} />;
}
