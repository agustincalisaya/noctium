import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { texto } from "@/lib/textos";
import { listarGerentes } from "@/server/gerentes/gerente.service";
import { exigirPermiso } from "@/server/shared/with-permission";
import { ListadoGerentes } from "./listado-gerentes";

/**
 * Listado mínimo de gerentes (P-47, HU-G-01; DEC-38): valida el permiso
 * (`gerentes:leer`, solo el Gerente) y muestra todas las fichas. «Nuevo
 * gerente» va arriba a la derecha. HU-G-03 suma la búsqueda, la paginación y
 * «(vos)».
 */
export default async function GerentesPage() {
  await exigirPermiso("gerentes:leer");
  const listado = await listarGerentes();

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{texto("ui.gerentes.listado.titulo")}</h1>
        <Link href="/gerentes/nuevo" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          {texto("ui.gerentes.listado.nuevo")}
        </Link>
      </div>
      <ListadoGerentes listado={listado} />
    </div>
  );
}
