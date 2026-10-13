import { notFound } from "next/navigation";
import { DetalleCierreCaja } from "@/components/pagos/detalle-cierre-caja";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { texto } from "@/lib/textos";
import { idCajaSchema } from "@/server/pagos/caja.schema";
import { obtenerDetalleCierre } from "@/server/pagos/caja.lecturas";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { exigirPermiso } from "@/server/shared/with-permission";

/**
 * Detalle de uno de mis cierres (HU-I-12 criterio 8; spec_modulo_I.md §2.12)
 * con «Imprimir». Un cierre ajeno, inexistente o una caja todavía abierta se
 * responden como no encontrados: mesa de entrada solo ve los suyos.
 */
export default async function DetalleMiCierrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: usuarioId } = await exigirPermiso("cajas:leer");
  const id = idCajaSchema.safeParse((await params).id);
  if (!id.success) notFound();
  let cierre;
  try {
    cierre = await obtenerDetalleCierre(id.data, { usuarioId, esGerente: false });
  } catch (error) {
    if (esErrorDeDominio(error)) notFound();
    throw error;
  }
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6 print:p-0">
      <div className="print:hidden">
        <Breadcrumb tramos={[{ etiqueta: texto("ui.caja.titulo"), href: "/caja" }, { etiqueta: texto("ui.caja.cierres.verCierre") }]} />
      </div>
      <DetalleCierreCaja cierre={cierre} hrefVolver="/caja" />
    </div>
  );
}
