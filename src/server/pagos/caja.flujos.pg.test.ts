import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearFichaGerenteDePrueba, crearFichaMesaEntradaDePrueba, crearTurnoDePrueba } from "@/server/testing/fabricas";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { abrirMiCaja, cerrarMiCaja, cerrarPorAusencia, declararMiEfectivo, declararPorAusencia } from "@/server/pagos/caja.flujos";
import { obtenerResumenCierre } from "@/server/pagos/caja.lecturas";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- src/server/pagos/caja.flujos.pg.test.ts`):
// los flujos HTTP de HU-I-12 sobre el servicio del PR 0. Equivale al nivel 3
// (BD) de la task: verifica las filas de `cajas` después de cada paso.
describe.skipIf(!basePgHabilitada)("flujos de la caja con PostgreSQL real", () => {
  let db: PrismaClient;
  const opciones = () => ({ db });

  async function integrante() {
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    return ficha.usuarioId!;
  }

  async function cobro(usuarioId: string, formaPagoId = "formapago-efectivo", hora = "10:00") {
    const alumno = await crearAlumnoDePrueba(db);
    const turno = await crearTurnoDePrueba(db, { hora });
    await transaccion(async (tx) => {
      const insc = await crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(usuarioId) });
      return registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId, formaPagoId, modo: "completo", items: [{ inscripcionId: insc.inscripcion.id, monto: "12000" }] });
    }, { db });
  }

  beforeAll(async () => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  it("abrir: fila ABIERTA con efectivoDeclarado NULL; una segunda apertura es CAJA_YA_ABIERTA", async () => {
    const usuarioId = await integrante();
    const caja = await abrirMiCaja(usuarioId, "0", opciones());
    expect(caja).toMatchObject({ fondo_inicial: "0.00", abierta_el: expect.stringMatching(/-03:00$/) });
    expect(await db.caja.findUniqueOrThrow({ where: { idCaja: caja.id } })).toMatchObject({ estado: "ABIERTA", efectivoDeclarado: null, usuarioId });
    await expect(abrirMiCaja(usuarioId, "100", opciones())).rejects.toMatchObject({ code: "CAJA_YA_ABIERTA", status: 409 });
    expect(await db.caja.count({ where: { usuarioId, estado: "ABIERTA" } })).toBe(1);
  });

  it("dos aperturas simultáneas del mismo integrante dejan una sola caja (Regla N.° 7)", async () => {
    const usuarioId = await integrante();
    const resultados = await Promise.allSettled([abrirMiCaja(usuarioId, "10", opciones()), abrirMiCaja(usuarioId, "20", opciones())]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CAJA_YA_ABIERTA" });
  });

  it("sin caja abierta: declarar y ver el resumen responden CAJA_NO_ABIERTA; cerrar, CAJA_YA_CERRADA", async () => {
    const usuarioId = await integrante();
    await expect(declararMiEfectivo(usuarioId, "10", opciones())).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA" });
    await expect(obtenerResumenCierre({ usuarioId }, db)).rejects.toMatchObject({ code: "CAJA_NO_ABIERTA" });
    await expect(cerrarMiCaja(usuarioId, { huella: "x" }, opciones())).rejects.toMatchObject({ code: "CAJA_YA_CERRADA" });
  });

  it("cierre propio completo: declarar una vez, CAJA_CAMBIO tras un cobro nuevo, motivo exigido y cierre con el resumen fijo", async () => {
    const usuarioId = await integrante();
    const { id: cajaId } = await abrirMiCaja(usuarioId, "5000", opciones());
    await cobro(usuarioId, "formapago-efectivo", "08:00");
    await expect(obtenerResumenCierre({ usuarioId }, db)).rejects.toMatchObject({ code: "EFECTIVO_NO_DECLARADO" });

    const paso1 = await declararMiEfectivo(usuarioId, "17000", opciones());
    expect(paso1).toMatchObject({ caja_id: cajaId, resumen: { efectivo_esperado: "17000.00", efectivo_declarado: "17000.00", tipo_diferencia: "CUADRA" } });
    expect(paso1.integrante.nombre_completo).toMatch(/, Integrante$/);
    // Tras declarar: el monto queda guardado y la caja sigue abierta.
    expect(await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } })).toMatchObject({ estado: "ABIERTA" });
    expect((await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } })).efectivoDeclarado?.toFixed(2)).toBe("17000.00");
    await expect(declararMiEfectivo(usuarioId, "1", opciones())).rejects.toMatchObject({ code: "EFECTIVO_YA_DECLARADO" });
    expect((await obtenerResumenCierre({ usuarioId }, db)).huella).toBe(paso1.huella);

    // Entra un cobro mientras se cierra: el mismo declarado, esperado nuevo, faltante.
    await cobro(usuarioId, "formapago-efectivo", "09:00");
    const cambio = await cerrarMiCaja(usuarioId, { huella: paso1.huella }, opciones()).catch((e) => e);
    expect(cambio).toMatchObject({ code: "CAJA_CAMBIO", status: 409 });
    expect(cambio.datos.resumen).toMatchObject({ efectivo_esperado: "29000.00", efectivo_declarado: "17000.00", diferencia: "-12000.00", tipo_diferencia: "FALTANTE" });
    expect((await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } })).estado).toBe("ABIERTA");

    await expect(cerrarMiCaja(usuarioId, { huella: cambio.datos.huella }, opciones())).rejects.toMatchObject({ code: "MOTIVO_DIFERENCIA_REQUERIDO", status: 400 });
    const cerrada = await cerrarMiCaja(usuarioId, { huella: cambio.datos.huella, motivo: "Se dio mal un vuelto" }, opciones());
    expect(cerrada).toMatchObject({ caja_id: cajaId, estado: "CERRADA", diferencia: "-12000.00", tipo_diferencia: "FALTANTE", por_ausencia: false });

    const fila = await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } });
    expect(fila).toMatchObject({ estado: "CERRADA", cerradaPorUsuarioId: usuarioId, cerradaPorActorTipo: "USUARIO", porAusencia: false, motivo: "Se dio mal un vuelto" });
    expect(fila.efectivoEsperado?.toFixed(2)).toBe("29000.00");
    expect(fila.diferencia?.toFixed(2)).toBe("-12000.00");
    expect(fila.resumen).toMatchObject({ efectivo_esperado: "29000.00", cobros_por_forma: [{ cantidad: 2, total: "24000.00" }] });
    expect(fila.cerradaEl).toBeInstanceOf(Date);

    // Doble cierre y nueva apertura después del cierre.
    await expect(cerrarMiCaja(usuarioId, { huella: cambio.datos.huella, motivo: "x" }, opciones())).rejects.toMatchObject({ code: "CAJA_YA_CERRADA" });
    await expect(abrirMiCaja(usuarioId, "0", opciones())).resolves.toMatchObject({ fondo_inicial: "0.00" });
  });

  it("cierre por ausencia: el gerente declara y cierra la caja de otro; queda porAusencia con el gerente como responsable", async () => {
    const usuarioId = await integrante();
    const gerente = (await crearFichaGerenteDePrueba(db)).usuarioId!;
    const { id: cajaId } = await abrirMiCaja(usuarioId, "1000", opciones());
    await expect(obtenerResumenCierre({ usuarioId: gerente, cajaId }, db)).rejects.toMatchObject({ code: "EFECTIVO_NO_DECLARADO" });
    const paso1 = await declararPorAusencia(gerente, cajaId, "1000", opciones());
    expect(paso1).toMatchObject({ caja_id: cajaId, integrante: { id: usuarioId }, resumen: { tipo_diferencia: "CUADRA" } });
    const cerrada = await cerrarPorAusencia(gerente, cajaId, { huella: paso1.huella }, opciones());
    expect(cerrada).toMatchObject({ estado: "CERRADA", por_ausencia: true, tipo_diferencia: "CUADRA" });
    expect(await db.caja.findUniqueOrThrow({ where: { idCaja: cajaId } })).toMatchObject({
      estado: "CERRADA", porAusencia: true, cerradaPorUsuarioId: gerente, cerradaPorActorTipo: "USUARIO", motivo: null,
    });
    await expect(declararPorAusencia(gerente, cajaId, "1", opciones())).rejects.toMatchObject({ code: "CAJA_YA_CERRADA" });
    await expect(declararPorAusencia(gerente, "no-existe", "1", opciones())).rejects.toMatchObject({ code: "CAJA_NO_ENCONTRADA", status: 404 });
  });

  it("por ausencia sobre la propia caja: FUERA_DE_ALCANCE", async () => {
    const usuarioId = await integrante();
    const { id: cajaId } = await abrirMiCaja(usuarioId, "0", opciones());
    await expect(declararPorAusencia(usuarioId, cajaId, "0", opciones())).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE", status: 403 });
    await expect(obtenerResumenCierre({ usuarioId, cajaId }, db)).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE" });
  });

  it("el integrante y el gerente cierran a la vez: gana uno y el otro recibe CAJA_YA_CERRADA", async () => {
    const usuarioId = await integrante();
    const gerente = (await crearFichaGerenteDePrueba(db)).usuarioId!;
    await abrirMiCaja(usuarioId, "500", opciones());
    const { huella, caja_id: cajaId } = await declararMiEfectivo(usuarioId, "500", opciones());
    const resultados = await Promise.allSettled([
      cerrarMiCaja(usuarioId, { huella }, opciones()),
      cerrarPorAusencia(gerente, cajaId, { huella }, opciones()),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CAJA_YA_CERRADA" });
  });
});
