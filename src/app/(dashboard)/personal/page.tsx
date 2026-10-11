import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { texto } from "@/lib/textos";
import { listarPersonal } from "@/server/personal/personal.service";
import { exigirPermiso } from "@/server/shared/with-permission";

/**
 * Listado mínimo del personal de mesa de entrada (P-45, HU-F-01; DEC-38): todas
 * las fichas, activas e inactivas, sin búsqueda ni paginación (las suma
 * HU-F-03). Cada fila lleva a la ficha. Solo el Gerente (`personal:leer`).
 */
export default async function PersonalPage() {
  await exigirPermiso("personal:leer");
  const { items } = await listarPersonal();
  const ausente = texto("ui.personal.valorAusente");

  const nuevo = (
    <Link href="/personal/nuevo" className={buttonVariants()}>
      <Plus className="size-4" aria-hidden />
      {texto("ui.personal.listado.nuevo")}
    </Link>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{texto("ui.personal.listado.titulo")}</h1>
        {nuevo}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">{texto("ui.personal.listado.vacio")}</p>
          {nuevo}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">{texto("ui.personal.listado.titulo")}</caption>
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{texto("ui.personal.listado.apellido")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{texto("ui.personal.listado.nombre")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{texto("ui.personal.listado.dni")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{texto("ui.personal.listado.telefono")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{texto("ui.personal.listado.email")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{texto("ui.personal.listado.estado")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((integrante) => (
                <tr key={integrante.id} className="border-t border-border hover:bg-accent/50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/personal/${integrante.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {integrante.apellido}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{integrante.nombre}</td>
                  <td className="px-4 py-2">{integrante.dni}</td>
                  <td className="px-4 py-2">{integrante.telefono ?? ausente}</td>
                  <td className="break-all px-4 py-2">{integrante.email}</td>
                  <td className="px-4 py-2">
                    <Badge variant={integrante.activo ? "success" : "muted"}>
                      {integrante.activo ? texto("ui.personal.estado.activo") : texto("ui.personal.estado.inactivo")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
