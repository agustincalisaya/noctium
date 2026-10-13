import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearFichaGerenteDePrueba, crearFichaMesaEntradaDePrueba, crearTurnoDePrueba } from "@/server/testing/fabricas";
import { fechaCentro } from "@/server/shared/fechas-centro";
import { actorUsuario } from "@/server/shared/historial";
import { ahora, conReloj } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { abrirCaja } from "@/server/pagos/caja.service";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { anularPago, corregirOperacion, corregirPago, type UsuarioOperador } from "@/server/pagos/correccion.service";
import { obtenerHistorialDePago } from "@/server/pagos/correccion.lecturas";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): historial de cambios del pago (HU-I-06, DEC-27).
describe.skipIf(!basePgHabilitada)("HU-I-06: historial de cambios del pago con PostgreSQL real", () => {
  let db: PrismaClient;
  const DIA = 24 * 60 * 60 * 1000;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>, momento?: Date) =>
    momento ? conReloj(momento, () => transaccion(fn, { db })) : transaccion(fn, { db });

  let mesa: UsuarioOperador & { nombre: string };
  let gerente: UsuarioOperador & { nombre: string };

  async function operacion(clases: number) {
    const alumno = await crearAlumnoDePrueba(db);
    const items = [];
    for (let i = 0; i < clases; i++) {
      const turno = await crearTurnoDePrueba(db, { enDias: 5, hora: `${String(8 + 2 * i).padStart(2, "0")}:00` });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.id) }));
      items.push({ inscripcionId: insc.inscripcion.id, monto: "12000" });
    }
    return enTx((tx) => registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId: mesa.id, formaPagoId: "formapago-efectivo", modo: "completo", items }));
  }

  beforeAll(async () => {
    db = clientePg();
    const fichaMesa = await crearFichaMesaEntradaDePrueba(db);
    await enTx((tx) => abrirCaja(tx, { usuarioId: fichaMesa.usuarioId!, fondoInicial: "0" }));
    mesa = { id: fichaMesa.usuarioId!, rol: "MESA_ENTRADA", nombre: `${fichaMesa.apellidoFichaMesaEntrada}, ${fichaMesa.nombreFichaMesaEntrada}` };
    const fichaGerente = await crearFichaGerenteDePrueba(db);
    gerente = { id: fichaGerente.usuarioId!, rol: "GERENTE", nombre: `${fichaGerente.apellidoFichaGerente}, ${fichaGerente.nombreFichaGerente}` };
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("pago sin correcciones: cambios [] y el registro con quien lo cobró", async () => {
    const op = await operacion(1);
    const r = await obtenerHistorialDePago(op.pagos[0]!.id, db);
    expect(r).toEqual({
      registro: {
        monto: "12000.00", forma_pago: { id: "formapago-efectivo", nombre: expect.any(String) },
        fecha_pago: op.operacion.fechaPago.toISOString().slice(0, 10),
        registrado_por: { usuario_id: mesa.id, nombre_completo: mesa.nombre },
        registrado_en: expect.stringMatching(/-03:00$/),
      },
      cambios: [],
    });
  });

  it("cada evento con su anterior → nuevo real; las de la operación hechas desde otro pago también figuran; más nuevo primero", async () => {
    const op = await operacion(2);
    const [p1, p2] = op.pagos;
    const t0 = ahora().getTime();
    const ayer = new Date(fechaCentro(ahora()).getTime() - DIA);
    await enTx((tx) => corregirPago(tx, { pagoId: p1!.id, monto: "11000", motivo: "Descuento", usuario: mesa }), new Date(t0 + 1000));
    await enTx((tx) => corregirPago(tx, { pagoId: p1!.id, monto: "10000", motivo: "Beca parcial", usuario: mesa }), new Date(t0 + 2000));
    // Desde el otro pago: la forma y la fecha son de la operación.
    await enTx((tx) => corregirOperacion(tx, { pagoId: p2!.id, formaPagoId: "formapago-transferencia", fechaPago: ayer, motivo: "Error de carga", usuario: gerente }), new Date(t0 + 3000));
    await enTx((tx) => anularPago(tx, { pagoId: p1!.id, motivo: "Reintegro", usuario: gerente }), new Date(t0 + 4000));

    const r = await obtenerHistorialDePago(p1!.id, db);
    expect(r.registro).toMatchObject({ monto: "10000.00", forma_pago: { id: "formapago-transferencia" }, fecha_pago: ayer.toISOString().slice(0, 10) });
    expect(r.cambios.map((c) => [c.tipo, c.valor_anterior, c.valor_nuevo, c.motivo, c.usuario?.nombre_completo])).toEqual([
      ["ANULACION", "10000.00", null, "Reintegro", gerente.nombre],
      ["CORRECCION_FECHA", op.operacion.fechaPago.toISOString().slice(0, 10), ayer.toISOString().slice(0, 10), "Error de carga", gerente.nombre],
      ["CORRECCION_FORMA", expect.any(String), expect.any(String), "Error de carga", gerente.nombre],
      ["CORRECCION_MONTO", "11000.00", "10000.00", "Beca parcial", mesa.nombre],
      ["CORRECCION_MONTO", "12000.00", "11000.00", "Descuento", mesa.nombre],
    ]);
    const formas = await db.formaPago.findMany({ where: { idFormaPago: { in: ["formapago-efectivo", "formapago-transferencia"] } } });
    const nombre = (id: string) => formas.find((f) => f.idFormaPago === id)!.nombreFormaPago;
    expect(r.cambios[2]).toMatchObject({ valor_anterior: nombre("formapago-efectivo"), valor_nuevo: nombre("formapago-transferencia") });

    // El otro pago ve las correcciones de la operación, pero no las de monto ni la anulación de p1.
    expect((await obtenerHistorialDePago(p2!.id, db)).cambios.map((c) => c.tipo)).toEqual(["CORRECCION_FECHA", "CORRECCION_FORMA"]);
  });

  it("pago inexistente → PAGO_NO_ENCONTRADO", async () => {
    await expect(obtenerHistorialDePago("c000000000000000000000000", db)).rejects.toMatchObject({ code: "PAGO_NO_ENCONTRADO", status: 404 });
  });
});
