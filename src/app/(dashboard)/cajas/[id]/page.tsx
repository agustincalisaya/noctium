import { notFound } from "next/navigation";
import { DetalleCierreCaja } from "@/components/pagos/detalle-cierre-caja";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { texto } from "@/lib/textos";
import { idCajaSchema } from "@/server/pagos/caja.schema";
import { obtenerDetalleCierre } from "@/server/pagos/caja.lecturas";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { exigirPermiso } from "@/server/shared/with-permission";

/**
 * Detalle de un cierre para el gerente (HU-I-12 criterios 8 y 10;
 * spec_modulo_I.md §2.12; foto `Detalle de un cierre.png`): el resumen fijo,
 * quién lo cerró y si fue por ausencia, con «Imprimir». Una caja abierta no
 * tiene cierre que mostrar (CAJA_NO_CERRADA): se responde como no encontrado.
 */
export default async function DetalleCierreGerentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: usuarioId } = await exigirPermiso("cajas:leer_todas");
  const id = idCajaSchema.safeParse((await params).id);
  if (!id.success) notFound();
  let cierre;
  try {
    cierre = await obtenerDetalleCierre(id.data, { usuarioId, esGerente: true });
  } catch (error) {
    if (esErrorDeDominio(error)) notFound();
    throw error;
  }
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6 print:p-0">
      <div className="print:hidden">
        <Breadcrumb tramos={[{ etiqueta: texto("ui.cajas.titulo"), href: "/cajas" }, { etiqueta: texto("ui.caja.cierres.verCierre") }]} />
      </div>
      <DetalleCierreCaja cierre={cierre} hrefVolver="/cajas" />
    </div>
  );
}
