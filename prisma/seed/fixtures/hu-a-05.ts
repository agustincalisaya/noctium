import { createHash } from "node:crypto";
import type { ContextoFixtures } from "./index";

/**
 * HU-A-05: enlaces de recuperación que no se pueden generar desde la pantalla
 * de forma reproducible (PR-0.md §2.16, «enlace de recuperación vencido»;
 * decisión 18 de la task). Se escriben directo en `tokens_recuperacion` con
 * valores conocidos y constantes: de cada uno se guarda solo el hash SHA-256
 * en hex, igual que el servicio. Ninguno puede quedar vigente:
 *
 * - vencido: venció el 01/01/2026 y nunca se usó;
 * - usado: ya consumido, con un vencimiento lejano para que el único motivo
 *   del 410 sea el uso.
 *
 * Son de la cuenta del profesor de A-06 (`a06.profesor.primer.ingreso`), que
 * el recorrido de la recuperación no usa: pedir un enlace nuevo para otra
 * cuenta no los toca. El resto de los escenarios reutiliza las cuentas de la
 * fixture de A-06 (corre antes). Cada enlace se busca por su hash antes de
 * insertarlo, así que correr el seed dos veces no duplica nada.
 *
 * Para probarlos: `/restablecer-contrasena?token=<valor>` o
 * `POST /api/auth/restablecer-password` → 410 ENLACE_INVALIDO.
 */
export const ENLACE_VENCIDO_HU_A05 = "hu-a-05-enlace-vencido-demo-0001";
export const ENLACE_USADO_HU_A05 = "hu-a-05-enlace-usado-demo-0002";

const EMAIL_CUENTA = "a06.profesor.primer.ingreso@noctium.local";

const ENLACES = [
  {
    valor: ENLACE_VENCIDO_HU_A05,
    creadoEnToken: new Date("2026-01-01T02:30:00.000Z"),
    venceEnToken: new Date("2026-01-01T03:00:00.000Z"),
    consumidoEnToken: null,
  },
  {
    valor: ENLACE_USADO_HU_A05,
    creadoEnToken: new Date("2026-01-01T02:30:00.000Z"),
    venceEnToken: new Date("2099-01-01T03:00:00.000Z"),
    consumidoEnToken: new Date("2026-01-01T02:40:00.000Z"),
  },
];

const hash = (valor: string) => createHash("sha256").update(valor, "utf8").digest("hex");

export async function fixtureHuA05({ prisma }: ContextoFixtures) {
  const cuenta = await prisma.usuario.findUniqueOrThrow({ where: { emailUsuario: EMAIL_CUENTA }, select: { idUsuario: true } });
  for (const { valor, ...fechas } of ENLACES) {
    const tokenHashRecuperacion = hash(valor);
    if (await prisma.tokenRecuperacion.findUnique({ where: { tokenHashRecuperacion }, select: { idTokenRecuperacion: true } })) continue;
    await prisma.tokenRecuperacion.create({ data: { usuarioId: cuenta.idUsuario, tokenHashRecuperacion, ...fechas } });
  }
}
