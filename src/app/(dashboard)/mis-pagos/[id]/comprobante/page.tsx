import { notFound, redirect } from "next/navigation";
import { ComprobanteCard } from "@/components/pagos/comprobante-card";
import { prisma } from "@/lib/prisma";
import { obtenerAlumnoDeUsuario } from "@/server/alumnos/alumno.publico";
import { comprobanteDelPago, leerComprobanteDeAlumno } from "@/server/pagos/comprobante.lectura";
import { esErrorDeDominio } from "@/server/shared/error-dominio";
import { exigirPermiso } from "@/server/shared/with-permission";
import type { ComprobanteLeido } from "@/types/pago.types";

/**
 * Comprobante de un pago propio, vista del alumno (HU-I-11, spec_modulo_I.md
 * §2.9.3): sin quién registró ni el motivo de una anulación. El `[id]` es el
 * del pago, como en `GET /api/mis-pagos/[id]/comprobante`.
 */
export default async function MiComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPermiso("comprobantes:leer_propios");
  const { id } = await params;
  const alumno = await obtenerAlumnoDeUsuario(usuario.id);
  if (!alumno) redirect("/sin-permiso");
  let comprobante: ComprobanteLeido | null;
  try {
    const { id: comprobanteId } = await comprobanteDelPago(prisma, id);
    comprobante = await leerComprobanteDeAlumno(prisma, comprobanteId, alumno.id);
  } catch (error) {
    if (esErrorDeDominio(error, "errores.pago.noEncontrado")) notFound();
    if (esErrorDeDominio(error, "errores.pago.fueraDeAlcance")) redirect("/sin-permiso");
    throw error;
  }
  if (!comprobante) notFound();
  return <ComprobanteCard comprobante={comprobante} />;
}
