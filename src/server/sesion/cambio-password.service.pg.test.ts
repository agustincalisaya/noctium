import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { unico } from "@/server/testing/fabricas";
import { comparePassword, hashPassword } from "@/lib/password";
import { transaccion } from "@/server/shared/transaccion";
import { crearCuentaParaFicha } from "@/server/usuarios/cuenta.service";
import { cambiarPasswordPropia } from "@/server/sesion/cambio-password.service";

// PostgreSQL real (`npm run test:pg -- <ruta>`): cambio de la propia
// contraseña (HU-A-06, spec_modulo_A.md §2.6.3, §3.3, §3.7, §3.11 y §4).

describe.skipIf(!basePgHabilitada)("cambiarPasswordPropia con PostgreSQL real", () => {
  let db: PrismaClient;
  const IP = "10.1.2.3";
  const DNI = "3011122";
  const NUEVA = "NuevaClave1";

  beforeAll(async () => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  /** Cuenta como la deja el alta de una ficha: DNI como contraseña y la marca. */
  async function cuentaConMarca() {
    const email = `${unico("primer")}@prueba.local`;
    const { usuario_id } = await transaccion((tx) => crearCuentaParaFicha(tx, { email, dni: DNI, rol: "PROFESOR", ip: IP }), { db });
    return { id: usuario_id, email };
  }

  /** Cuenta sin la marca, con contraseña conocida (como una de autorregistro). */
  async function cuentaSinMarca(password = "Actual123") {
    const email = `${unico("micuenta")}@prueba.local`;
    const u = await db.usuario.create({
      data: { emailUsuario: email, passwordHashUsuario: await hashPassword(password), rolUsuario: "ALUMNO" },
    });
    return { id: u.idUsuario, email };
  }

  const cuenta = (id: string) => db.usuario.findUniqueOrThrow({ where: { idUsuario: id } });
  const intentos = (email: string) => db.intentoLoginFallido.count({ where: { emailIntento: email, ipIntento: IP } });

  it("primer ingreso: con un DNI de 7 dígitos, sin pedir la actual; quita la marca y revoca las demás sesiones", async () => {
    const { id, email } = await cuentaConMarca();
    const antes = Math.floor(Date.now() / 1000);

    await expect(cambiarPasswordPropia({ password_nueva: NUEVA, confirmacion: NUEVA }, id, IP, { db })).resolves.toEqual({
      reemitir_sesion: true,
    });

    const despues = await cuenta(id);
    expect(despues.debeCambiarPasswordUsuario).toBe(false);
    expect(await comparePassword(NUEVA, despues.passwordHashUsuario)).toBe(true);
    expect(await comparePassword(DNI, despues.passwordHashUsuario)).toBe(false);

    // §3.7: la sesión vieja (iniciada antes) cae; la reemitida (iat_sesion = ahora) sigue viva.
    const desde = Math.floor(despues.sesionesValidasDesdeUsuario!.getTime() / 1000);
    expect(desde).toBeGreaterThanOrEqual(antes);
    expect(antes - 1 < desde).toBe(true);
    expect(Math.floor(Date.now() / 1000) < desde).toBe(false);

    const eventos = await db.eventoSeguridad.findMany({ where: { usuarioId: id, tipoEvento: "PASSWORD_CAMBIADA" } });
    expect(eventos).toEqual([expect.objectContaining({ emailEvento: email, ipEvento: IP })]);
    const todos = JSON.stringify(await db.eventoSeguridad.findMany({ where: { usuarioId: id } }));
    for (const sensible of [DNI, NUEVA, despues.passwordHashUsuario]) expect(todos).not.toContain(sensible);
  });

  it("primer ingreso: el DNI como contraseña nueva no pasa la política (400, sin cambios)", async () => {
    const { id } = await cuentaConMarca();
    await expect(cambiarPasswordPropia({ password_nueva: DNI, confirmacion: DNI }, id, IP, { db })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect((await cuenta(id)).debeCambiarPasswordUsuario).toBe(true);
  });

  it("nueva igual a la vigente → 422 PASSWORD_IGUAL_A_ACTUAL, sin cambios ni evento", async () => {
    const { id } = await cuentaSinMarca("Actual123");
    const hashAntes = (await cuenta(id)).passwordHashUsuario;
    await expect(
      cambiarPasswordPropia({ password_actual: "Actual123", password_nueva: "Actual123", confirmacion: "Actual123" }, id, IP, { db }),
    ).rejects.toMatchObject({ code: "PASSWORD_IGUAL_A_ACTUAL", status: 422 });
    const despues = await cuenta(id);
    expect(despues.passwordHashUsuario).toBe(hashAntes);
    expect(despues.sesionesValidasDesdeUsuario).toBeNull();
    expect(await db.eventoSeguridad.count({ where: { usuarioId: id, tipoEvento: "PASSWORD_CAMBIADA" } })).toBe(0);
  });

  it("«Mi cuenta»: actual incorrecta → 422 y fila en IntentoLoginFallido; actual correcta → cambia", async () => {
    const { id, email } = await cuentaSinMarca("Actual123");
    await expect(
      cambiarPasswordPropia({ password_actual: "Mala1234", password_nueva: NUEVA, confirmacion: NUEVA }, id, IP, { db }),
    ).rejects.toMatchObject({ code: "PASSWORD_ACTUAL_INCORRECTA", status: 422 });
    expect(await intentos(email)).toBe(1);

    await expect(
      cambiarPasswordPropia({ password_actual: "Actual123", password_nueva: NUEVA, confirmacion: NUEVA }, id, IP, { db }),
    ).resolves.toEqual({ reemitir_sesion: true });
    expect(await comparePassword(NUEVA, (await cuenta(id)).passwordHashUsuario)).toBe(true);
  });

  it("«Mi cuenta»: con el límite de intentos alcanzado responde 429 antes de comparar (no suma intentos)", async () => {
    const { id, email } = await cuentaSinMarca("Actual123");
    await db.intentoLoginFallido.createMany({ data: Array.from({ length: 5 }, () => ({ emailIntento: email, ipIntento: IP })) });
    await expect(
      cambiarPasswordPropia({ password_actual: "Actual123", password_nueva: NUEVA, confirmacion: NUEVA }, id, IP, { db }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEDIDO", status: 429 });
    expect(await intentos(email)).toBe(5);
    expect(await comparePassword("Actual123", (await cuenta(id)).passwordHashUsuario)).toBe(true);
  });

  it("dos cambios simultáneos con la misma contraseña nueva: uno gana y el otro recibe PASSWORD_IGUAL_A_ACTUAL", async () => {
    const { id } = await cuentaConMarca();
    const resultados = await Promise.allSettled(
      [1, 2].map(() => cambiarPasswordPropia({ password_nueva: NUEVA, confirmacion: NUEVA }, id, IP, { db })),
    );
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({
      code: "PASSWORD_IGUAL_A_ACTUAL",
    });
    expect(await db.eventoSeguridad.count({ where: { usuarioId: id, tipoEvento: "PASSWORD_CAMBIADA" } })).toBe(1);
  });
});
