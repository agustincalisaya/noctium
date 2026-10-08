import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Parámetros del centro que edita HU-N-01 (PR-0.md §2.6). Lee la base en
 * cada llamada, sin caché: un cambio rige en la operación siguiente (P-N2).
 * Un valor ausente o mal cargado cae al valor por defecto de la migración.
 */
export type ParametrosVigentes = {
  plazoPagoHoras: number;
  cancelacionAnticipacionHoras: number;
  umbralPresentismo: number;
};

const CLAVES = {
  plazoPagoHoras: ["plazo_pago_horas", 24],
  cancelacionAnticipacionHoras: ["cancelacion_anticipacion_horas", 24],
  umbralPresentismo: ["umbral_presentismo", 75],
} as const;

type Db = Pick<Prisma.TransactionClient, "parametroSistema">;

export async function parametrosVigentes(db: Db = prisma): Promise<ParametrosVigentes> {
  const filas = await db.parametroSistema.findMany({
    where: { clave: { in: Object.values(CLAVES).map(([clave]) => clave) } },
  });
  const valores = new Map(filas.map(({ clave, valor }) => [clave, Number(valor.trim())]));
  const entero = ([clave, defecto]: readonly [string, number]) => {
    const valor = valores.get(clave);
    return valor !== undefined && Number.isSafeInteger(valor) && valor > 0 ? valor : defecto;
  };
  return {
    plazoPagoHoras: entero(CLAVES.plazoPagoHoras),
    cancelacionAnticipacionHoras: entero(CLAVES.cancelacionAnticipacionHoras),
    umbralPresentismo: entero(CLAVES.umbralPresentismo),
  };
}

/** Datos fijos del centro para comprobantes e impresiones (HU-I-11 criterio 2, HU-I-12 criterio 8). */
export async function datosCentro(db: Db = prisma): Promise<{ nombre: string; domicilio: string; telefono: string }> {
  const filas = await db.parametroSistema.findMany({
    where: { clave: { in: ["centro_nombre", "centro_domicilio", "centro_telefono"] } },
  });
  const valor = (clave: string) => filas.find((fila) => fila.clave === clave)?.valor ?? "";
  return { nombre: valor("centro_nombre"), domicilio: valor("centro_domicilio"), telefono: valor("centro_telefono") };
}
