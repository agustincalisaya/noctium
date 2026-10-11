import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { esModoEdicion, fueActualizada, rutaModoEdicion } from "@/lib/modo-edicion";
import { PermisoError, exigirPermiso, tienePermiso, verificarPermiso } from "@/server/shared/with-permission";
import { obtenerMateriaPorId } from "@/server/materias/materia.service";
import { ServiceError } from "@/server/shared/service-error";
import { texto } from "@/lib/textos";
import { formatearMonto } from "@/lib/moneda";
import { precioClase } from "@/server/shared/precio-clase";
import { CambiarTarifaDialog } from "./cambiar-tarifa-dialog";
import { EditarMateriaForm } from "./editar-materia-form";

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Ficha de materia (HU-L-02) con modo edición (HU-L-03) sobre la misma ruta:
 * `?modo=edicion` (ver `@/lib/modo-edicion`). El chequeo de `materias:editar`
 * de acá evita montar el formulario para un rol sin permiso; el rechazo que
 * realmente importa lo repite `modificarMateria()` en la Server Action.
 */
export default async function MateriaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const edicion = esModoEdicion(query);

  try {
    await verificarPermiso("materias:leer");
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect("/materias");
    }
    throw error;
  }

  if (edicion) {
    await exigirPermiso("materias:editar");
  }

  const puedeCambiarTarifa = await tienePermiso("materias:cambiar_tarifa");
  const conTarifa = puedeCambiarTarifa || await tienePermiso("materias:ver_tarifa");
  let materia;
  try {
    materia = await obtenerMateriaPorId(id, { conTarifa });
  } catch (error) {
    if (error instanceof ServiceError && error.code === "MATERIA_NO_ENCONTRADA") {
      notFound();
    }
    throw error;
  }

  const breadcrumb = <Breadcrumb tramos={[{ etiqueta: "Materias", href: "/materias" }, { etiqueta: materia.nombre }]} />;

  if (edicion) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-5 p-6">
        {breadcrumb}
        {/* key: al recargar tras un conflicto de edición llega una `version`
            nueva y el formulario se remonta con los datos actuales. */}
        <EditarMateriaForm key={materia.version} materia={materia} />
      </div>
    );
  }

  const puedeEditar = await tienePermiso("materias:editar");

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-6">
      {breadcrumb}
      {fueActualizada(query) && <p role="status" className="rounded-md bg-success px-3 py-2 text-sm text-success-foreground">Materia actualizada correctamente</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{materia.nombre}</h1>
        {puedeEditar && <Link href={rutaModoEdicion(`/materias/${materia.id}`)} className={buttonVariants({ variant: "outline", size: "sm" })}>Modificar</Link>}
      </div>
      <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
        <section className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">{texto("ui.materias.datos")}</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">{texto("ui.materias.nombre")}</dt><dd>{materia.nombre}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{texto("ui.materias.codigo")}</dt><dd className="font-mono">{materia.codigo ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{texto("ui.materias.estado")}</dt><dd><Badge variant={materia.is_active ? "success" : "muted"}>{materia.is_active ? "Activa" : "Inactiva"}</Badge></dd></div>
            <div><dt className="text-xs text-muted-foreground">{texto("ui.materias.ultimaModificacion")}</dt><dd>{materia.version > 0 ? formatearFecha(materia.updated_at) : texto("ui.materias.sinCambios")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{texto("ui.materias.alta")}</dt><dd>{formatearFecha(materia.created_at)}</dd></div>
          </dl>
        </section>
        <section className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-5 md:col-start-2 md:row-start-1">
          <h2 className="text-sm font-semibold">{texto("ui.materias.profesores")}</h2>
          {materia.profesores.length === 0 ? <p className="text-sm text-muted-foreground">Sin profesores asociados</p> :
            <ul className="flex flex-wrap gap-2">{materia.profesores.map((profesor) => <li key={profesor.id}><Badge variant="muted">{profesor.nombre_completo}</Badge></li>)}</ul>}
          <p className="text-xs text-muted-foreground">{texto("ui.materias.profesoresAviso")}</p>
        </section>
        {conTarifa && <section className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-5 md:col-start-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{texto("ui.materias.tarifa.titulo")}</h2>
            {puedeCambiarTarifa && materia.is_active && <CambiarTarifaDialog key={materia.tarifa_hora ?? "sin-tarifa"} id={materia.id} nombre={materia.nombre} tarifaActual={materia.tarifa_hora ?? null} />}
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-mono text-2xl font-semibold">{materia.tarifa_hora == null ? texto("ui.materias.tarifa.sinTarifa") : formatearMonto(materia.tarifa_hora)}</p>
            {materia.tarifa_hora != null && <p className="text-xs text-muted-foreground">{texto("ui.materias.tarifa.ejemplo", { precio: formatearMonto(precioClase({ tarifaHora: materia.tarifa_hora }, 120)) })}</p>}
          </div>
          <p className="text-xs text-muted-foreground">{texto("ui.materias.tarifa.aviso")}</p>
          {!materia.historial_tarifas?.length ? <p className="text-sm text-muted-foreground">{texto("ui.materias.tarifa.sinHistorial")}</p> :
            <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-xs"><caption className="sr-only">{texto("ui.materias.tarifa.titulo")}</caption>
              <thead className="text-muted-foreground"><tr><th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">{texto("ui.materias.tarifa.fecha")}</th><th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">{texto("ui.materias.tarifa.anterior")}</th><th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">{texto("ui.materias.tarifa.nueva")}</th><th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">{texto("ui.materias.tarifa.usuario")}</th><th scope="col" className="border-b border-border px-2 py-2 text-left font-medium">{texto("ui.materias.tarifa.tipo")}</th></tr></thead>
              <tbody>{materia.historial_tarifas.map((fila, index) => <tr key={`${fila.fecha}-${index}`} className="border-b border-border last:border-0">
                <td className="px-2 py-3">{new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }).format(new Date(fila.fecha))}</td>
                <td className="px-2 py-3 font-mono">{fila.tarifa_anterior === null ? texto("ui.materias.tarifa.sinTarifa") : formatearMonto(fila.tarifa_anterior)}</td>
                <td className="px-2 py-3 font-mono">{formatearMonto(fila.tarifa_nueva)}</td>
                <td className="px-2 py-3">{fila.usuario.nombre ?? texto("ui.materias.tarifa.usuarioSinFicha")}</td>
                <td className="px-2 py-3">{texto(fila.masivo ? "ui.materias.tarifa.masivo" : "ui.materias.tarifa.individual")}</td>
              </tr>)}</tbody>
            </table></div>}
        </section>}
      </div>
    </div>
  );
}
