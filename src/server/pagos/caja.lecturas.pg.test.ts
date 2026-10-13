import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearFichaGerenteDePrueba, crearFichaMesaEntradaDePrueba, crearTurnoDePrueba } from "@/server/testing/fabricas";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { isoCentro } from "@/server/shared/fechas-centro";
import { anularMovimiento, registrarMovimiento } from "@/server/pagos/caja.service";
import { abrirMiCaja, cerrarMiCaja, cerrarPorAusencia, declararMiEfectivo, declararPorAusencia } from "@/server/pagos/caja.flujos";
import {
  listarCajasYCierres, listarIntegrantesConCaja, listarMisCierres, obtenerCajaPropia, obtenerDetalleCierre,
} from "@/server/pagos/caja.lecturas";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- src/server/pagos/caja.lecturas.pg.test.ts`):
// lecturas de HU-I-12 (spec_modulo_I.md §2.10.2 y §2.12). La base es compartida
// entre archivos, así que cada prueba filtra por sus propios integrantes.
describe.skipIf(!basePgHabilitada)("lecturas de la caja con PostgreSQL real", () => {
  let db: PrismaClient;
  const opciones = () => ({ db });
  const integrante = async () => (await crearFichaMesaEntradaDePrueba(db)).usuarioId!;

  async function cobro(usuarioId: string, formaPagoId: string, hora: string) {
    const alumno = await crearAlumnoDePrueba(db);
    const turno = await crearTurnoDePrueba(db, { hora });
    await transaccion(async (tx) => {
      const insc = await crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(usuarioId) });
      return registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId, formaPagoId, modo: "completo", items: [{ inscripcionId: insc.inscripcion.id, monto: "12000" }] });
    }, { db });
    return alumno;
  }

  /** Abre, declara lo esperado y cierra (cuadra). */
  async function cajaCerrada(usuarioId: string, fondo = "1000") {
    await abrirMiCaja(usuarioId, fondo, opciones());
    const { huella, caja_id } = await declararMiEfectivo(usuarioId, fondo, opciones());
    await cerrarMiCaja(usuarioId, { huella }, opciones());
    return caja_id;
  }

  beforeAll(async () => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });

  it("obtenerCajaPropia: cobros con monto y forma vigentes, movimientos (con el anulado marcado), del más nuevo al más viejo y sin ningún total", async () => {
    const usuarioId = await integrante();
    expect(await obtenerCajaPropia(usuarioId, db)).toEqual({ caja: null });
    const { id: cajaId } = await abrirMiCaja(usuarioId, "5000", opciones());
    const alumno = await cobro(usuarioId, "formapago-transferencia", "11:00");
    const ingreso = await transaccion((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "INGRESO", monto: "1000", concepto: "Ingreso de cambio" }), { db });
    await transaccion((tx) => registrarMovimiento(tx, { cajaId, usuarioId, tipo: "EGRESO", monto: "200", concepto: "Librería" }), { db });
    await transaccion((tx) => anularMovimiento(tx, { movimientoId: ingreso.id, usuarioId, motivo: "Error" }), { db });

    const { caja } = await obtenerCajaPropia(usuarioId, db);
    expect(caja).toMatchObject({ id: cajaId, fondo_inicial: "5000.00", efectivo_declarado: null });
    expect(caja!.items).toHaveLength(3);
    const tipos = caja!.items.map((i) => i.tipo);
    expect(tipos.filter((t) => t === "MOVIMIENTO")).toHaveLength(2);
    expect(caja!.items.find((i) => i.id === ingreso.id)).toMatchObject({ tipo: "MOVIMIENTO", movimiento: "INGRESO", monto: "1000.00", anulado: true, detalle: "Ingreso de cambio" });
    const cobroItem = caja!.items.find((i) => i.tipo === "COBRO")!;
    expect(cobroItem).toMatchObject({
      forma_pago: { id: "formapago-transferencia" }, monto: "12000.00", anulado: false,
      detalle: expect.stringContaining(`${alumno.apellidoAlumno}, ${alumno.nombreAlumno} · `),
    });
    const momentos = caja!.items.map((i) => i.momento);
    expect([...momentos].sort().reverse()).toEqual(momentos);
    const texto = JSON.stringify(caja);
    for (const prohibida of ["efectivo_esperado", "\"total\"", "diferencia", "huella"]) expect(texto).not.toContain(prohibida);

    // Con el efectivo declarado, la caja propia lo informa (para entrar directo al paso 2) pero sigue sin totales.
    await declararMiEfectivo(usuarioId, "6000", opciones());
    const declarada = (await obtenerCajaPropia(usuarioId, db)).caja!;
    expect(declarada.efectivo_declarado).toBe("6000.00");
    expect(JSON.stringify(declarada)).not.toContain("efectivo_esperado");
  });

  it("mis cierres y detalle: solo los propios, con el resumen fijo; ajeno FUERA_DE_ALCANCE; abierta CAJA_NO_CERRADA", async () => {
    const usuarioId = await integrante();
    const otro = await integrante();
    const primera = await cajaCerrada(usuarioId, "100");
    const segunda = await cajaCerrada(usuarioId, "200");
    const ajena = await cajaCerrada(otro);

    const mis = await listarMisCierres(usuarioId, 1, db);
    expect(mis.items.map((c) => c.id)).toEqual([segunda, primera]);
    expect(mis.paginacion).toEqual({ total: 2, pagina_actual: 1, total_paginas: 1, por_pagina: 10 });
    expect(mis.items[0]).toMatchObject({ fondo_inicial: "200.00", efectivo_esperado: "200.00", efectivo_declarado: "200.00", tipo_diferencia: "CUADRA", cerrada_por: null });

    const detalle = await obtenerDetalleCierre(primera, { usuarioId, esGerente: false }, db);
    expect(detalle).toMatchObject({ id: primera, resumen: { fondo_inicial: "100.00", efectivo_esperado: "100.00" }, centro: expect.any(Object) });
    await expect(obtenerDetalleCierre(ajena, { usuarioId, esGerente: false }, db)).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE" });
    const { id: abierta } = await abrirMiCaja(usuarioId, "0", opciones());
    await expect(obtenerDetalleCierre(abierta, { usuarioId, esGerente: false }, db)).rejects.toMatchObject({ code: "CAJA_NO_CERRADA" });
    await expect(obtenerDetalleCierre(abierta, { usuarioId: "g", esGerente: true }, db)).rejects.toMatchObject({ code: "CAJA_NO_CERRADA" });
  });

  it("listado del gerente: abiertas con antigüedad sin montos; cierres filtrados por integrante y por fecha de cierre, de a 10", async () => {
    const usuarioId = await integrante();
    const gerente = (await crearFichaGerenteDePrueba(db)).usuarioId!;
    for (let i = 0; i < 11; i++) await cajaCerrada(usuarioId, String(i));
    const { id: abierta } = await abrirMiCaja(usuarioId, "0", opciones());
    // Un cierre por ausencia del mismo integrante.
    const { huella } = await declararPorAusencia(gerente, abierta, "0", opciones());
    await cerrarPorAusencia(gerente, abierta, { huella }, opciones());
    const { id: abiertaNueva } = await abrirMiCaja(usuarioId, "0", opciones());

    const hoy = isoCentro(new Date()).slice(0, 10);
    const p1 = await listarCajasYCierres({ integranteId: usuarioId, desde: hoy, hasta: hoy, pagina: 1 }, db);
    expect(p1.cierres.paginacion).toEqual({ total: 12, pagina_actual: 1, total_paginas: 2, por_pagina: 10 });
    expect(p1.cierres.items).toHaveLength(10);
    expect(p1.cierres.items[0]).toMatchObject({ id: abierta, por_ausencia: true, cerrada_por: { id: gerente } });
    expect(p1.cierres.items.every((c) => c.integrante.id === usuarioId)).toBe(true);
    const p2 = await listarCajasYCierres({ integranteId: usuarioId, pagina: 2 }, db);
    expect(p2.cierres.items).toHaveLength(2);

    const fila = p1.abiertas.find((a) => a.id === abiertaNueva)!;
    expect(fila).toMatchObject({ integrante: { id: usuarioId }, antiguedad_minutos: expect.any(Number) });
    expect(Object.keys(fila).sort()).toEqual(["abierta_el", "antiguedad_minutos", "id", "integrante"]);

    // Un rango que no incluye hoy no trae cierres de este integrante.
    const pasado = await listarCajasYCierres({ integranteId: usuarioId, desde: "2020-01-01", hasta: "2020-12-31", pagina: 1 }, db);
    expect(pasado.cierres.paginacion.total).toBe(0);
    expect(pasado.cierres.paginacion.pagina_actual).toBe(1);

    const integrantes = await listarIntegrantesConCaja(db);
    expect(integrantes.some((i) => i.id === usuarioId && i.nombre_completo?.endsWith(", Integrante"))).toBe(true);
    expect(integrantes.filter((i) => i.id === usuarioId)).toHaveLength(1);
  });
});
