import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { texto } from "@/lib/textos";
import { cn } from "@/lib/utils";
import type { ListadoGerentes as DatosListado } from "@/types/gerente.types";

/**
 * Tabla del listado mínimo de gerentes (P-47, HU-G-01; DEC-38): todas las
 * fichas, activas e inactivas, en el orden del servidor, con cada fila
 * enlazada a la ficha. Sin búsqueda, paginación ni «(vos)»: los suma HU-G-03.
 * Sin estado vacío: siempre figura al menos el gerente autenticado.
 */
export function ListadoGerentes({ listado }: { listado: DatosListado }) {
  const ausente = texto("ui.gerentes.valorAusente");

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{texto("ui.gerentes.listado.titulo")}</caption>
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.apellido")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.nombre")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.dni")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.telefono")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.email")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{texto("ui.gerentes.listado.estado")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {listado.items.map((gerente) => (
            <tr
              key={gerente.id}
              data-inactivo={gerente.activo ? undefined : ""}
              className={cn("relative transition-colors hover:bg-accent", !gerente.activo && "opacity-60")}
            >
              <td className="px-4 py-2 font-medium text-foreground">
                {/* Toda la fila enlaza a la ficha, como en el personal. */}
                <Link
                  href={`/gerentes/${gerente.id}`}
                  className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {gerente.apellido}
                </Link>
              </td>
              <td className="px-4 py-2">{gerente.nombre}</td>
              <td className="px-4 py-2 text-muted-foreground">{gerente.dni}</td>
              <td className="px-4 py-2 text-muted-foreground">{gerente.telefono ?? ausente}</td>
              <td className="max-w-[16rem] truncate px-4 py-2 text-muted-foreground" title={gerente.email}>
                {gerente.email}
              </td>
              <td className="px-4 py-2">
                <Badge variant={gerente.activo ? "success" : "muted"}>
                  {gerente.activo ? texto("ui.gerentes.estado.activo") : texto("ui.gerentes.estado.inactivo")}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
