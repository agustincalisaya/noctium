import { Suspense } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { texto } from "@/lib/textos";
import { ListarPersonalQuerySchema } from "@/server/personal/personal.schema";
import { listarPersonal } from "@/server/personal/personal.service";
import { exigirPermiso } from "@/server/shared/with-permission";
import { ListadoPersonal } from "./listado-personal";

/**
 * Listado del personal de mesa de entrada (P-45; HU-F-01 y HU-F-03, prototipo
 * figura 92): búsqueda y paginación de a 10 sobre activos e inactivos. Esta
 * página valida el permiso (`personal:leer`, solo el Gerente) y entrega el
 * primer render con el `q` y la `pagina` de la URL; la búsqueda la sigue
 * `ListadoPersonal` en el cliente. «Nuevo integrante» va siempre arriba a la
 * derecha.
 */
export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[]; q?: string | string[] }>;
}) {
  await exigirPermiso("personal:leer");
  const { pagina, q } = await searchParams;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold">{texto("ui.personal.listado.titulo")}</h1>
          <p className="text-sm text-muted-foreground">{texto("ui.personal.listado.subtitulo")}</p>
        </div>
        <Link href="/personal/nuevo" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          {texto("ui.personal.listado.nuevo")}
        </Link>
      </div>

      {/* Suspense acotado a la tabla, no un `loading.tsx` de segmento: ese
          boundary alcanzaría también a la ficha y rompería el 404 de
          `notFound()` (mismo criterio que `/alumnos`). */}
      <Suspense fallback={<Cargando />}>
        <TablaPersonal pagina={pagina} q={q} />
      </Suspense>
    </div>
  );
}

function Cargando() {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {texto("ui.personal.listado.cargando")}
    </div>
  );
}

async function TablaPersonal({ pagina, q }: { pagina?: string | string[]; q?: string | string[] }) {
  // Solo `pagina` y `q`: otros parámetros de la URL (por ejemplo un banner) no
  // tienen que romper el listado. Una página inválida vuelve a la 1 y un `q`
  // inválido (más de 100 caracteres) se ignora, como en `/alumnos`.
  const paginaSolicitada = Number(typeof pagina === "string" ? pagina : undefined);
  const base = { pagina: Number.isSafeInteger(paginaSolicitada) && paginaSolicitada > 0 ? paginaSolicitada : 1 };
  const conBusqueda = ListarPersonalQuerySchema.safeParse({ ...base, ...(typeof q === "string" ? { q } : {}) });
  const query = conBusqueda.success ? conBusqueda.data : ListarPersonalQuerySchema.parse(base);
  const inicial = await listarPersonal(query);

  // Sin `key`: cuando el paginador navega, ListadoPersonal adopta los datos
  // nuevos sin remontarse.
  return <ListadoPersonal inicial={inicial} qInicial={query.q ?? ""} />;
}
