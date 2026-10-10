import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { contarAlumnosConFormaPagoPreferida } from "./alumno.publico";
it("cuenta activos e inactivos y respeta db del llamador", async () => {
  const count = vi.fn().mockResolvedValue(7);
  const db = { alumno: { count } } as unknown as Prisma.TransactionClient;
  expect(await contarAlumnosConFormaPagoPreferida("fp1", db)).toBe(7);
  expect(count).toHaveBeenCalledWith({ where: { formaPagoPreferidaId: "fp1" } });
});
