import { notFound } from "next/navigation";
import { ComprobanteCard } from "@/components/pagos/comprobante-card";
import { prisma } from "@/lib/prisma";
import { leerComprobante } from "@/server/pagos/comprobante.lectura";
import { exigirPermiso } from "@/server/shared/with-permission";

/** Comprobante de pago, vista de mesa de entrada y gerente (HU-I-11, spec_modulo_I.md §2.9.3). */
export default async function ComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso("comprobantes:leer");
  const { id } = await params;
  const comprobante = await leerComprobante(prisma, id);
  if (!comprobante) notFound();
  return <ComprobanteCard comprobante={comprobante} />;
}
