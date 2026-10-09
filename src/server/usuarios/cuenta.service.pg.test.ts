import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearUsuarioDePrueba, unico } from "@/server/testing/fabricas";
import { ahora, conReloj } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario, PROCESO_AUTOMATICO } from "@/server/shared/historial";
import { listarHistorialEstados, registrarCambioEstado } from "@/server/shared/historial-estados";
import {
  cambiarEmailCuenta,
  cambiarPassword,
  crearCuentaParaFicha,
  desactivarCuenta,
  filtrarCuentasActivas,
  obtenerEstadoCuenta,
  obtenerResumenCuenta,
  reactivarCuenta,
  revocarSesiones,
  verificarEmailNoAsociadoAOtraCuenta,
} from "@/server/usuarios/cuenta.service";

// PostgreSQL real (`npm run test:pg -- <ruta>`): cuentas de acceso (HU-A-06,
// PR-0.md §2.7 y §2.13) e historial de bajas y reactivaciones.
describe.skipIf(!basePgHabilitada)("cuentas e historial de estados con PostgreSQL real", () => {
  let db: PrismaClient;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>, momento?: Date) =>
    momento ? conReloj(momento, () => transaccion(fn, { db })) : transaccion(fn, { db });
  const sesionesDesde = async (id: string) => (await db.usuario.findUniqueOrThrow({ where: { idUsuario: id } })).sesionesValidasDesdeUsuario;

  beforeAll(async () => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  it("crearCuentaParaFicha: DNI como contraseña (solo el hash), marca de cambio obligatorio y evento CUENTA_CREADA", async () => {
    const email = `${unico("Ficha")}@Prueba.Local`;
    const { usuario_id } = await enTx((tx) => crearCuentaParaFicha(tx, { email, dni: "30111222", rol: "PROFESOR", ip: "10.0.0.1" }));
    const usuario = await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuario_id } });
    expect(usuario).toMatchObject({ emailUsuario: email.toLowerCase(), rolUsuario: "PROFESOR", activoUsuario: true, debeCambiarPasswordUsuario: true });
    expect(usuario.passwordHashUsuario).not.toContain("30111222");
    expect(await bcrypt.compare("30111222", usuario.passwordHashUsuario)).toBe(true);
    const eventos = await db.eventoSeguridad.findMany({ where: { usuarioId: usuario_id } });
    expect(eventos).toEqual([expect.objectContaining({ tipoEvento: "CUENTA_CREADA", emailEvento: email.toLowerCase(), ipEvento: "10.0.0.1" })]);
    expect(JSON.stringify(eventos)).not.toContain("30111222");
    // Email en uso (sin distinguir mayúsculas): EMAIL_YA_ASOCIADO y no se crea nada.
    await expect(enTx((tx) => crearCuentaParaFicha(tx, { email: email.toUpperCase(), dni: "1", rol: "GERENTE" }))).rejects.toMatchObject({
      code: "EMAIL_YA_ASOCIADO", status: 409, message: "Ese email ya está asociado a otra cuenta",
    });
    await expect(enTx((tx) => crearCuentaParaFicha(tx, { email: "no-es-email", dni: "1", rol: "GERENTE" }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("dos altas simultáneas con el mismo email: una gana y la otra EMAIL_YA_ASOCIADO", async () => {
    const email = `${unico("dup")}@prueba.local`;
    const resultados = await Promise.allSettled([1, 2].map((n) => enTx((tx) => crearCuentaParaFicha(tx, { email, dni: String(n), rol: "MESA_ENTRADA" }))));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
  });

  it("cambiarEmailCuenta no revoca sesiones; un email de otra cuenta responde EMAIL_YA_ASOCIADO", async () => {
    const a = await crearUsuarioDePrueba(db);
    const b = await crearUsuarioDePrueba(db);
    const nuevo = `${unico("nuevo")}@prueba.local`;
    await expect(enTx((tx) => cambiarEmailCuenta(tx, { usuarioId: a.idUsuario, email: nuevo }))).resolves.toEqual({ cambio: true });
    await expect(enTx((tx) => cambiarEmailCuenta(tx, { usuarioId: a.idUsuario, email: nuevo }))).resolves.toEqual({ cambio: false });
    expect(await sesionesDesde(a.idUsuario)).toBeNull();
    await expect(enTx((tx) => cambiarEmailCuenta(tx, { usuarioId: b.idUsuario, email: nuevo }))).rejects.toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
    await expect(verificarEmailNoAsociadoAOtraCuenta(nuevo, { excluirUsuarioId: a.idUsuario }, db)).resolves.toBeUndefined();
  });

  it("(d) desactivar revoca las sesiones (truncado a segundos); reactivar no las restaura; revocarSesiones nunca retrocede", async () => {
    const usuario = await crearUsuarioDePrueba(db);
    const momento = new Date("2031-03-10T15:20:30.987Z");
    await expect(enTx((tx) => desactivarCuenta(tx, usuario.idUsuario), momento)).resolves.toEqual({ cambio: true });
    expect((await sesionesDesde(usuario.idUsuario))!.toISOString()).toBe("2031-03-10T15:20:30.000Z");
    await expect(enTx((tx) => desactivarCuenta(tx, usuario.idUsuario))).resolves.toEqual({ cambio: false });
    await expect(enTx((tx) => reactivarCuenta(tx, usuario.idUsuario))).resolves.toEqual({ cambio: true });
    await expect(enTx((tx) => reactivarCuenta(tx, usuario.idUsuario))).resolves.toEqual({ cambio: false });
    expect((await sesionesDesde(usuario.idUsuario))!.toISOString()).toBe("2031-03-10T15:20:30.000Z");
    // Un reloj anterior no la mueve hacia atrás; uno posterior la adelanta.
    await enTx((tx) => revocarSesiones(tx, usuario.idUsuario), new Date("2030-01-01T00:00:00.000Z"));
    expect((await sesionesDesde(usuario.idUsuario))!.toISOString()).toBe("2031-03-10T15:20:30.000Z");
    await enTx((tx) => revocarSesiones(tx, usuario.idUsuario), new Date("2031-03-10T15:21:00.400Z"));
    expect((await sesionesDesde(usuario.idUsuario))!.toISOString()).toBe("2031-03-10T15:21:00.000Z");
  });

  it("cambiarPassword: hash nuevo, quita la marca, revoca las sesiones y registra el evento; conservarSesionActual dice si se reemite", async () => {
    const email = `${unico("pass")}@prueba.local`;
    const { usuario_id } = await enTx((tx) => crearCuentaParaFicha(tx, { email, dni: "28111222", rol: "GERENTE" }));
    await expect(enTx((tx) => cambiarPassword(tx, { usuarioId: usuario_id, nueva: "OtraClave123!", conservarSesionActual: true }))).resolves.toEqual({ reemitir_sesion: true });
    const usuario = await db.usuario.findUniqueOrThrow({ where: { idUsuario: usuario_id } });
    expect(usuario.debeCambiarPasswordUsuario).toBe(false);
    expect(await bcrypt.compare("OtraClave123!", usuario.passwordHashUsuario)).toBe(true);
    expect(usuario.sesionesValidasDesdeUsuario!.getTime()).toBeLessThanOrEqual(ahora().getTime());
    await expect(enTx((tx) => cambiarPassword(tx, { usuarioId: usuario_id, nueva: "Tercera123!", conservarSesionActual: false, origen: "RECUPERACION" }))).resolves.toEqual({ reemitir_sesion: false });
    const tipos = (await db.eventoSeguridad.findMany({ where: { usuarioId: usuario_id }, orderBy: { creadoEnEvento: "asc" } })).map((e) => e.tipoEvento);
    expect(tipos).toEqual(["CUENTA_CREADA", "PASSWORD_CAMBIADA", "RECUPERACION_CONFIRMADA"]);
  });

  it("lecturas: estado y resumen (con SIN_CUENTA) sin el hash, y filtrarCuentasActivas", async () => {
    const activa = await crearUsuarioDePrueba(db, { rol: "GERENTE" });
    const inactiva = await crearUsuarioDePrueba(db, { rol: "GERENTE", activo: false });
    const estado = await obtenerEstadoCuenta(activa.idUsuario, db);
    expect(estado).toEqual({ email: activa.emailUsuario, rol: "GERENTE", activa: true, debe_cambiar_password: false });
    expect(JSON.stringify(estado)).not.toContain("hash");
    expect(await obtenerResumenCuenta(inactiva.idUsuario, db)).toMatchObject({ estado: "INACTIVA" });
    expect(await obtenerResumenCuenta(null, db)).toEqual({ estado: "SIN_CUENTA", email: null, rol: null, debe_cambiar_password: false });
    expect(await obtenerResumenCuenta("no-existe", db)).toMatchObject({ estado: "SIN_CUENTA" });
    expect(await filtrarCuentasActivas(db, [inactiva.idUsuario, activa.idUsuario, "no-existe", activa.idUsuario])).toEqual([activa.idUsuario]);
  });

  it("(e) listarHistorialEstados: completo, del más reciente al más antiguo, y una transacción que revierte no deja registro", async () => {
    const id = unico("prof");
    const gerente = await crearUsuarioDePrueba(db, { rol: "GERENTE" });
    const momentos = ["2031-01-05T10:00:00.000Z", "2031-02-05T10:00:00.000Z", "2031-03-05T10:00:00.000Z"].map((m) => new Date(m));
    await enTx(async (tx) => { registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "DESACTIVAR", motivo: "Licencia", actor: actorUsuario(gerente.idUsuario) }); }, momentos[0]);
    await enTx(async (tx) => { registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "REACTIVAR", actor: actorUsuario(gerente.idUsuario) }); }, momentos[1]);
    await enTx(async (tx) => { registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "DESACTIVAR", motivo: "  ", actor: PROCESO_AUTOMATICO }); }, momentos[2]);
    await expect(enTx(async (tx) => {
      registrarCambioEstado(tx, { entidad: "PROFESOR", id, accion: "REACTIVAR", actor: actorUsuario(gerente.idUsuario) });
      throw new Error("revierte");
    })).rejects.toThrow("revierte");
    // Otra entidad con el mismo id no se mezcla.
    await enTx(async (tx) => { registrarCambioEstado(tx, { entidad: "ALUMNO", id, accion: "DESACTIVAR", actor: actorUsuario(gerente.idUsuario) }); });

    const historial = await listarHistorialEstados("PROFESOR", id, db);
    expect(historial.map((h) => [h.accion, h.fecha.toISOString(), h.motivo, h.actor_tipo, h.usuario_id])).toEqual([
      ["DESACTIVAR", momentos[2]!.toISOString(), null, "PROCESO_AUTOMATICO", null],
      ["REACTIVAR", momentos[1]!.toISOString(), null, "USUARIO", gerente.idUsuario],
      ["DESACTIVAR", momentos[0]!.toISOString(), "Licencia", "USUARIO", gerente.idUsuario],
    ]);
    expect(await listarHistorialEstados("ALUMNO", id, db)).toHaveLength(1);
    expect(await listarHistorialEstados("FICHA_GERENTE", id, db)).toEqual([]);
  });
});
