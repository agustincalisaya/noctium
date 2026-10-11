import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearFichaGerenteDePrueba, unico } from "@/server/testing/fabricas";
import { actorUsuario } from "@/server/shared/historial";
import { listarHistorialEstados } from "@/server/shared/historial-estados";
import { transaccion } from "@/server/shared/transaccion";
import * as bloqueos from "@/server/shared/bloquear";
import * as transacciones from "@/server/shared/transaccion";
import * as cuentas from "@/server/usuarios/cuenta.service";
import { abrirCaja, calcularResumen, cerrarCaja, declararEfectivo } from "@/server/pagos/caja.service";
import { obtenerNombresPersonal } from "@/server/personal/personal.publico";
import {
  crearIntegrante,
  desactivarIntegrante,
  obtenerDetalleIntegrante,
  reactivarIntegrante,
} from "@/server/personal/personal.service";

// PostgreSQL real (`npm run test:pg -- src/server/personal`): baja y
// reactivación del personal de mesa de entrada con su cuenta
// (spec_modulo_F.md §2.4 a §2.7, §3.1, §3.4 a §3.6 y §4; HU-F-05 y HU-A-06 c7).

describe.skipIf(!basePgHabilitada)("HU-F-05 baja y reactivación del personal, con PostgreSQL real", () => {
  let db: PrismaClient;
  /** Gerente con ficha: su nombre se resuelve en el historial. */
  let gerente: string;
  let nombreGerente: string;
  let secuencia = 0;
  /** DNI de 8 dígitos sin repetir en la corrida; empieza con 7 para no chocar con el seed ni con F-01. */
  const dni = () => `7${`${Date.now() % 10_000}${String(++secuencia % 1000).padStart(3, "0")}`.padStart(7, "0").slice(-7)}`;
  const alta = (doc = dni(), correo = `${unico("f05")}@prueba.local`) => ({
    nombre: "Marta",
    apellido: "Quiroga",
    dni: doc,
    fechaNacimiento: new Date(Date.UTC(1988, 6, 21)),
    email: correo,
  });

  beforeAll(async () => {
    db = clientePg();
    const ficha = await crearFichaGerenteDePrueba(db);
    gerente = ficha.usuarioId!;
    nombreGerente = `${ficha.apellidoFichaGerente}, ${ficha.nombreFichaGerente}`;
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const actor = () => actorUsuario(gerente);
  const integrante = () => crearIntegrante(alta(), gerente);
  const ficha = (id: string) => db.fichaMesaEntrada.findUniqueOrThrow({ where: { idFichaMesaEntrada: id } });
  const cuentaDe = async (id: string) => db.usuario.findUniqueOrThrow({ where: { idUsuario: (await ficha(id)).usuarioId! } });
  const usuarioDe = async (id: string) => (await ficha(id)).usuarioId!;
  const abrir = (usuarioId: string) => transaccion((tx) => abrirCaja(tx, { usuarioId, fondoInicial: "0.00" }));
  /** Cierra la caja: propia, o por ausencia con el gerente. */
  async function cerrar(cajaId: string, usuarioId: string, porAusencia = false) {
    const quien = porAusencia ? gerente : usuarioId;
    const { huella } = await transaccion((tx) => declararEfectivo(tx, { cajaId, usuarioId: quien, efectivoDeclarado: "0.00", porAusencia }));
    await transaccion((tx) => cerrarCaja(tx, { cajaId, usuarioId: quien, huella, porAusencia }));
    expect((await calcularResumen(db, cajaId)).resumen.tipo_diferencia).toBe("CUADRA");
  }
  /** Espera a que otra transacción quede esperando un bloqueo de fila. */
  async function esperarTransaccionBloqueada() {
    for (let intento = 0; intento < 100; intento++) {
      const [{ esperando }] = await db.$queryRaw<{ esperando: number }[]>`
        SELECT count(*)::int AS esperando FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (esperando > 0) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("ninguna transacción quedó esperando el bloqueo");
  }
  /** La primera llamada a `bloquear` se detiene con el bloqueo tomado hasta `soltar()`. */
  function pausarPrimerBloqueo() {
    let soltar!: () => void, tomado!: () => void;
    const listo = new Promise<void>((r) => { tomado = r; });
    const espera = new Promise<void>((r) => { soltar = r; });
    const original = bloqueos.bloquear;
    let primera = true;
    const espia = vi.spyOn(bloqueos, "bloquear").mockImplementation(async (tx, input) => {
      const resultado = await original(tx, input);
      if (primera) { primera = false; tomado(); await espera; }
      return resultado;
    });
    return { listo, soltar: () => soltar(), restaurar: () => espia.mockRestore() };
  }

  it("baja con cuenta: ficha y cuenta inactivas, versión, modificador, sesiones revocadas, marca intacta e historial después del commit", async () => {
    const { id } = await integrante();
    expect((await cuentaDe(id)).debeCambiarPasswordUsuario).toBe(true);
    expect(await obtenerDetalleIntegrante(id)).toMatchObject({
      historialEstados: [], cajaAbierta: false, motivoObligatorioAlDesactivar: false,
    });

    // Cuando corre la cola de después del commit, la baja ya es visible desde otra conexión.
    const vistoAlEscribirHistorial: boolean[] = [];
    const original = transacciones.despuesDelCommit;
    const espia = vi.spyOn(transacciones, "despuesDelCommit").mockImplementation((tx, tarea) => original(tx, async () => {
      vistoAlEscribirHistorial.push(!(await ficha(id)).activoFichaMesaEntrada);
      return tarea();
    }));
    try {
      expect(await desactivarIntegrante(id, { version: 0, motivo: "  Dejó el centro " }, actor())).toEqual({ id, activo: false, version: 1 });
    } finally {
      espia.mockRestore();
    }
    expect(vistoAlEscribirHistorial).toEqual([true]);

    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: false, version: 1, modificadoPorUsuarioId: gerente });
    const cuenta = await cuentaDe(id);
    expect(cuenta.activoUsuario).toBe(false);
    expect(cuenta.sesionesValidasDesdeUsuario).not.toBeNull();
    expect(cuenta.debeCambiarPasswordUsuario).toBe(true);
    expect(await listarHistorialEstados("FICHA_MESA_ENTRADA", id)).toEqual([
      expect.objectContaining({ accion: "DESACTIVAR", motivo: "Dejó el centro", actor_tipo: "USUARIO", usuario_id: gerente }),
    ]);
    expect((await obtenerDetalleIntegrante(id)).historialEstados).toEqual([
      expect.objectContaining({ accion: "DESACTIVAR", motivo: "Dejó el centro", usuarioId: gerente, usuarioNombre: nombreGerente }),
    ]);
  });

  it("rollback: si falla la cuenta, la ficha sigue activa, la cuenta intacta y no queda historial", async () => {
    const { id } = await integrante();
    const original = cuentas.desactivarCuenta;
    const fallo = vi.spyOn(cuentas, "desactivarCuenta").mockImplementationOnce(async (tx, usuarioId) => {
      await original(tx, usuarioId);
      throw new Error("fallo inyectado después de la cuenta");
    });
    try {
      await expect(desactivarIntegrante(id, { version: 0 }, actor())).rejects.toThrow("fallo inyectado");
    } finally {
      fallo.mockRestore();
    }
    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: true, version: 0, modificadoPorUsuarioId: null });
    expect(await cuentaDe(id)).toMatchObject({ activoUsuario: true, sesionesValidasDesdeUsuario: null });
    expect(await listarHistorialEstados("FICHA_MESA_ENTRADA", id)).toHaveLength(0);
  });

  it("reactivar: ficha y cuenta activas, umbral de sesiones y marca conservados; varias bajas y reactivaciones se conservan", async () => {
    const { id } = await integrante();
    await desactivarIntegrante(id, { version: 0 }, actor());
    const baja = await cuentaDe(id);
    await expect(reactivarIntegrante(id, { version: 0 }, actor())).rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
    expect(await reactivarIntegrante(id, { version: 1 }, actor())).toEqual({ id, activo: true, version: 2 });
    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: true, version: 2, modificadoPorUsuarioId: gerente });
    const alta = await cuentaDe(id);
    expect(alta.activoUsuario).toBe(true);
    expect(alta.debeCambiarPasswordUsuario).toBe(true);
    expect(alta.sesionesValidasDesdeUsuario).toEqual(baja.sesionesValidasDesdeUsuario);
    await expect(reactivarIntegrante(id, { version: 2 }, actor())).rejects.toMatchObject({ code: "INTEGRANTE_YA_ACTIVO" });

    await desactivarIntegrante(id, { version: 2, motivo: "Licencia" }, actor());
    await expect(desactivarIntegrante(id, { version: 3 }, actor())).rejects.toMatchObject({ code: "INTEGRANTE_YA_INACTIVO" });
    await reactivarIntegrante(id, { version: 3 }, actor());
    const historial = await listarHistorialEstados("FICHA_MESA_ENTRADA", id);
    expect(historial.map((h) => h.accion)).toEqual(["REACTIVAR", "DESACTIVAR", "REACTIVAR", "DESACTIVAR"]);
    expect(historial.find((h) => h.motivo === "Licencia")?.accion).toBe("DESACTIVAR");
    expect(historial.find((h) => h.accion === "REACTIVAR")?.motivo).toBeNull();
    expect((await obtenerDetalleIntegrante(id)).historialEstados.map((h) => h.accion)).toEqual(historial.map((h) => h.accion));
  });

  it("caja abierta: la baja falla y no cambia nada; cerrada, pide motivo (registró operaciones) y procede", async () => {
    const { id } = await integrante();
    const usuarioId = await usuarioDe(id);
    const caja = await abrir(usuarioId);
    expect(await obtenerDetalleIntegrante(id)).toMatchObject({ cajaAbierta: true, motivoObligatorioAlDesactivar: true });
    await expect(desactivarIntegrante(id, { version: 0, motivo: "Renuncia" }, actor())).rejects.toMatchObject({ code: "CAJA_ABIERTA", status: 409 });
    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: true, version: 0 });
    expect((await cuentaDe(id)).activoUsuario).toBe(true);
    expect(await listarHistorialEstados("FICHA_MESA_ENTRADA", id)).toHaveLength(0);

    await cerrar(caja.id, usuarioId);
    expect(await obtenerDetalleIntegrante(id)).toMatchObject({ cajaAbierta: false, motivoObligatorioAlDesactivar: true });
    await expect(desactivarIntegrante(id, { version: 0 }, actor())).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO", status: 400 });
    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: true, version: 0 });
    await desactivarIntegrante(id, { version: 0, motivo: "Renuncia" }, actor());
    expect((await ficha(id)).activoFichaMesaEntrada).toBe(false);

    // Nada se borra: su caja sigue, cerrada, y su nombre se sigue resolviendo.
    expect(await db.caja.findUniqueOrThrow({ where: { idCaja: caja.id } })).toMatchObject({ usuarioId, estado: "CERRADA" });
    expect(await obtenerNombresPersonal([usuarioId])).toEqual([{ usuario_id: usuarioId, nombre_completo: "Quiroga, Marta" }]);
  });

  it("caja cerrada por ausencia: la baja procede", async () => {
    const { id } = await integrante();
    const usuarioId = await usuarioDe(id);
    const caja = await abrir(usuarioId);
    await cerrar(caja.id, usuarioId, true);
    expect(await db.caja.findUniqueOrThrow({ where: { idCaja: caja.id } })).toMatchObject({ porAusencia: true, cerradaPorUsuarioId: gerente });
    expect(await desactivarIntegrante(id, { version: 0, motivo: "Abandono" }, actor())).toMatchObject({ activo: false });
  });

  it("concurrencia (regla 3.4): si abrirCaja gana, la baja espera, ve la caja y responde CAJA_ABIERTA", async () => {
    const { id } = await integrante();
    const usuarioId = await usuarioDe(id);
    const pausa = pausarPrimerBloqueo();
    const apertura = abrir(usuarioId);
    let baja: Promise<unknown> | undefined;
    try {
      await pausa.listo;
      baja = desactivarIntegrante(id, { version: 0, motivo: "Renuncia" }, actor());
      const resultado = Promise.allSettled([baja]);
      await esperarTransaccionBloqueada();
      pausa.soltar();
      await apertura;
      const [r] = await resultado;
      expect(r).toMatchObject({ status: "rejected", reason: { code: "CAJA_ABIERTA" } });
    } finally {
      pausa.soltar();
      pausa.restaurar();
    }
    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: true, version: 0 });
    expect(await db.caja.count({ where: { usuarioId, estado: "ABIERTA" } })).toBe(1);
  });

  it("concurrencia (regla 3.4): si la baja gana, abrirCaja espera, encuentra la ficha inactiva y responde INTEGRANTE_INACTIVO", async () => {
    const { id } = await integrante();
    const usuarioId = await usuarioDe(id);
    const pausa = pausarPrimerBloqueo();
    const baja = desactivarIntegrante(id, { version: 0 }, actor());
    try {
      await pausa.listo;
      const resultado = Promise.allSettled([abrir(usuarioId)]);
      await esperarTransaccionBloqueada();
      pausa.soltar();
      await baja;
      const [r] = await resultado;
      expect(r).toMatchObject({ status: "rejected", reason: { code: "INTEGRANTE_INACTIVO" } });
    } finally {
      pausa.soltar();
      pausa.restaurar();
    }
    expect((await ficha(id)).activoFichaMesaEntrada).toBe(false);
    expect(await db.caja.count({ where: { usuarioId } })).toBe(0);
  });

  it("dos bajas simultáneas con la misma versión: una confirma, la otra recibe conflicto o ya inactivo, un solo historial", async () => {
    const { id } = await integrante();
    const rs = await Promise.allSettled([
      desactivarIntegrante(id, { version: 0 }, actor()),
      desactivarIntegrante(id, { version: 0 }, actor()),
    ]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = rs.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(["CONFLICTO_EDICION_CONCURRENTE", "INTEGRANTE_YA_INACTIVO"]).toContain(rechazo.reason.code);
    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: false, version: 1 });
    expect(await listarHistorialEstados("FICHA_MESA_ENTRADA", id)).toHaveLength(1);
  });

  it("el DNI y el email de la ficha inactiva siguen reservados", async () => {
    const datos = alta();
    const { id } = await crearIntegrante(datos, gerente);
    await desactivarIntegrante(id, { version: 0 }, actor());
    await expect(crearIntegrante(alta(datos.dni), gerente)).rejects.toMatchObject({ code: "DNI_DUPLICADO" });
    await expect(crearIntegrante(alta(dni(), datos.email), gerente)).rejects.toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
  });

  it("ficha sin cuenta: baja sin motivo y reactivación con historial, sin tocar ninguna cuenta", async () => {
    const id = unico("fm");
    await db.fichaMesaEntrada.create({
      data: {
        idFichaMesaEntrada: id, usuarioId: null, activoFichaMesaEntrada: true,
        nombreFichaMesaEntrada: "Sin", apellidoFichaMesaEntrada: "Cuenta",
        nombreNormalizadoFichaMesaEntrada: "sin", apellidoNormalizadoFichaMesaEntrada: "cuenta",
        dniFichaMesaEntrada: dni(), fechaNacimientoFichaMesaEntrada: new Date(Date.UTC(1990, 0, 1)),
        emailFichaMesaEntrada: `${unico("sincuenta")}@prueba.local`,
      },
    });
    const desactivar = vi.spyOn(cuentas, "desactivarCuenta");
    const reactivar = vi.spyOn(cuentas, "reactivarCuenta");
    try {
      expect(await obtenerDetalleIntegrante(id)).toMatchObject({ cuenta: { estado: "SIN_CUENTA" }, cajaAbierta: false, motivoObligatorioAlDesactivar: false });
      await desactivarIntegrante(id, { version: 0 }, actor());
      await reactivarIntegrante(id, { version: 1 }, actor());
      expect(desactivar).not.toHaveBeenCalled();
      expect(reactivar).not.toHaveBeenCalled();
    } finally {
      desactivar.mockRestore();
      reactivar.mockRestore();
    }
    expect(await ficha(id)).toMatchObject({ activoFichaMesaEntrada: true, version: 2, usuarioId: null });
    expect((await listarHistorialEstados("FICHA_MESA_ENTRADA", id)).map((h) => h.accion)).toEqual(["REACTIVAR", "DESACTIVAR"]);
  });

  it("id inexistente: INTEGRANTE_NO_ENCONTRADO en la baja y en la reactivación (bloquear no lanza)", async () => {
    await expect(desactivarIntegrante("ck-no-existe", { version: 0 }, actor())).rejects.toMatchObject({ code: "INTEGRANTE_NO_ENCONTRADO", status: 404 });
    await expect(reactivarIntegrante("ck-no-existe", { version: 0 }, actor())).rejects.toMatchObject({ code: "INTEGRANTE_NO_ENCONTRADO", status: 404 });
  });
});
