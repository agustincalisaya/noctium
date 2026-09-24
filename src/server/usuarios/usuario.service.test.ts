import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { create } } }));

const { crearCuentaConCredenciales } = await import("./usuario.service");

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ idUsuario: "ckusuario0000000000000001" });
});

describe("crearCuentaConCredenciales", () => {
  it("crea el Usuario con el passwordHash recibido (nunca hashea acá) y devuelve solo el id", async () => {
    const resultado = await crearCuentaConCredenciales({
      email: "ana@test.com",
      passwordHash: "ya-hasheado",
      rol: "ALUMNO",
    });

    expect(create).toHaveBeenCalledWith({
      data: { emailUsuario: "ana@test.com", passwordHashUsuario: "ya-hasheado", rolUsuario: "ALUMNO" },
      select: { idUsuario: true },
    });
    expect(resultado).toEqual({ id: "ckusuario0000000000000001" });
  });

  it("usa el cliente de transacción recibido (db) en vez de `prisma` directo, si se pasa uno", async () => {
    const txFalso = { usuario: { create: vi.fn().mockResolvedValue({ idUsuario: "otro" }) } };

    const resultado = await crearCuentaConCredenciales(
      { email: "b@test.com", passwordHash: "h", rol: "ALUMNO" },
      txFalso as never,
    );

    expect(txFalso.usuario.create).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled(); // el prisma global NO se usó
    expect(resultado).toEqual({ id: "otro" });
  });

  it("no le agrega ningún campo propio a Alumno ni toca esa tabla", async () => {
    await crearCuentaConCredenciales({ email: "c@test.com", passwordHash: "h", rol: "ALUMNO" });
    // Si tocara Alumno, no habría mock para esa tabla y la llamada
    // explotaría — llegar acá sin error ya lo confirma.
    expect(create).toHaveBeenCalledTimes(1);
  });
});
