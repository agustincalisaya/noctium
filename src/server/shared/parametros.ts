import { prisma } from "@/lib/prisma";

/**
 * Lee un parámetro numérico de `ParametroSistema`. Si la clave no está
 * sembrada o el valor no es numérico, usa `valorPorDefecto` — nunca
 * revienta el flujo que lo llama por un parámetro mal cargado.
 */
export async function getParametroNumerico(
  clave: string,
  valorPorDefecto: number,
): Promise<number> {
  const parametro = await prisma.parametroSistema.findUnique({
    where: { clave },
  });
  if (!parametro) return valorPorDefecto;

  const valor = Number(parametro.valor);
  return Number.isFinite(valor) ? valor : valorPorDefecto;
}
