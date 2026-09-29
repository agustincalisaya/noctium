import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Contrato público del Módulo I (spec_modulo_I.md §2.3, Regla N.° 3): otros
 * módulos leen el catálogo de formas de pago por acá y no consultan
 * `formas_pago` directamente. Son lecturas internas: no exigen permiso (el
 * control de acceso lo hace la ruta del consumidor) y este archivo no
 * importa nada de otros módulos.
 */

/** `{ id, nombre }` si la forma existe y está activa; `null` si no existe o está inactiva. */
export async function verificarFormaPagoActiva(
  id: string,
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; nombre: string } | null> {
  const forma = await db.formaPago.findFirst({
    where: { idFormaPago: id, activaFormaPago: true },
    select: { idFormaPago: true, nombreFormaPago: true },
  });
  return forma ? { id: forma.idFormaPago, nombre: forma.nombreFormaPago } : null;
}

/** `true` si la forma existe, activa o inactiva. */
export async function existeFormaPago(id: string, db: Prisma.TransactionClient = prisma): Promise<boolean> {
  return (await db.formaPago.count({ where: { idFormaPago: id } })) > 0;
}

/** Forma de pago activa o inactiva (nombre histórico); `null` si no existe. */
export async function obtenerFormaPago(
  id: string,
  db: Prisma.TransactionClient = prisma,
): Promise<{ id: string; nombre: string; is_active: boolean } | null> {
  const forma = await db.formaPago.findUnique({
    where: { idFormaPago: id },
    select: { idFormaPago: true, nombreFormaPago: true, activaFormaPago: true },
  });
  return forma
    ? { id: forma.idFormaPago, nombre: forma.nombreFormaPago, is_active: forma.activaFormaPago }
    : null;
}

/** Formas de pago activas para selectores, en orden alfabético normalizado. */
export async function listarFormasPagoActivas(): Promise<{ id: string; nombre: string }[]> {
  const formas = await prisma.formaPago.findMany({
    where: { activaFormaPago: true },
    orderBy: { nombreNormalizadaFormaPago: "asc" },
    select: { idFormaPago: true, nombreFormaPago: true },
  });
  return formas.map((forma) => ({ id: forma.idFormaPago, nombre: forma.nombreFormaPago }));
}
