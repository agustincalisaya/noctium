import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique } } }));

const { obtenerEmailDeUsuario } = await import("./usuario.service");

beforeEach(() => vi.clearAllMocks());

describe("obtenerEmailDeUsuario (spec_modulo_A.md §2.5)", () => {
  it("devuelve solo el email de la cuenta, sin pedir el hash ni otros campos", async () => {
    findUnique.mockResolvedValue({ emailUsuario: "mesa@centro.com" });

    await expect(obtenerEmailDeUsuario("ckusuario0000000000000001")).resolves.toBe("mesa@centro.com");
    expect(findUnique).toHaveBeenCalledWith({
      where: { idUsuario: "ckusuario0000000000000001" },
      select: { emailUsuario: true },
    });
  });

  it("devuelve null si la cuenta no existe (nunca el id como respaldo)", async () => {
    findUnique.mockResolvedValue(null);

    await expect(obtenerEmailDeUsuario("inexistente")).resolves.toBeNull();
  });

  it("propaga un fallo de infraestructura en vez de convertirlo en null", async () => {
    findUnique.mockRejectedValue(new Error("conexión caída"));

    await expect(obtenerEmailDeUsuario("ckusuario0000000000000001")).rejects.toThrow("conexión caída");
  });
});
