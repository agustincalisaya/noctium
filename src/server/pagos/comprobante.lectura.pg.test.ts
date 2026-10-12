import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearFichaMesaEntradaDePrueba, crearTurnoDePrueba } from "@/server/testing/fabricas";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { abrirCaja } from "@/server/pagos/caja.service";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { anularPago, type UsuarioOperador } from "@/server/pagos/correccion.service";
import { ComprobanteDatosSchema } from "@/server/pagos/comprobante.schema";
import { comprobanteDelPago, leerComprobante, leerComprobanteDeAlumno } from "@/server/pagos/comprobante.lectura";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): lectura de comprobantes
// (HU-I-11, spec_modulo_I.md §2.9.3/2.9.4) sobre comprobantes emitidos,
// reemplazados y anulados por los servicios reales del PR 0.
describe.skipIf(!basePgHabilitada)("lectura de comprobantes con PostgreSQL real", () => {
  let db: PrismaClient;
  let mesa: UsuarioOperador;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>) => transaccion(fn, { db });

  /** Operación de `clases` clases de un alumno nuevo, con la forma `formaPagoId`. */
  async function operacion(clases: number, formaPagoId = "formapago-efectivo") {
    const alumno = await crearAlumnoDePrueba(db);
    const items = [];
    for (let i = 0; i < clases; i++) {
      const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: `${String(9 + 2 * i).padStart(2, "0")}:00` });
      const insc = await enTx((tx) => crearInscripcion(tx, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, origen: "CENTRO", conReserva: false, actor: actorUsuario(mesa.id) }));
      items.push({ inscripcionId: insc.inscripcion.id, monto: "12000" });
    }
    const r = await enTx((tx) => registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId: mesa.id, formaPagoId, modo: "completo", items }));
    return { ...r, alumnoId: alumno.idAlumno };
  }

  beforeAll(async () => {
    db = clientePg();
    const ficha = await crearFichaMesaEntradaDePrueba(db);
    await enTx((tx) => abrirCaja(tx, { usuarioId: ficha.usuarioId!, fondoInicial: "0" }));
    mesa = { id: ficha.usuarioId!, rol: "MESA_ENTRADA" };
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("vigente: la vista coincide con la copia fija, sin marcas, y es el comprobante del pago", async () => {
    const op = await operacion(1);
    const datos = ComprobanteDatosSchema.parse(op.comprobante.datos);
    const leido = await leerComprobante(db, op.comprobante.id);

    expect(leido).toMatchObject({
      id: op.comprobante.id,
      numero: op.comprobante.numeroVisible,
      emitido_el: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/),
      centro: datos.centro,
      alumno: { nombre_completo: `${datos.alumno.apellido}, ${datos.alumno.nombre}`, dni: datos.alumno.dni },
      fecha_pago: datos.fecha_pago,
      forma_pago: { nombre: datos.forma_pago.nombre },
      registrado_por: datos.registrado_por.nombre_completo,
      total: "12000.00",
      marcas: { anulado: null, reemplazado_por: null, reemplaza_a: null },
    });
    expect(leido?.clases).toEqual(datos.clases.map((c) => ({ materia: c.materia.nombre, fecha: c.fecha, hora_inicio: c.hora_inicio, monto: c.monto })));
    await expect(comprobanteDelPago(db, op.pagos[0]!.id)).resolves.toEqual({ id: op.comprobante.id, numero: op.comprobante.numeroVisible });
  });

  it("copia fija: renombrar la forma de pago después de emitir no cambia el comprobante (§2.9.2)", async () => {
    const forma = await db.formaPago.create({ data: { nombreFormaPago: "Forma HU-I-11", nombreNormalizadaFormaPago: "forma hu-i-11" } });
    const op = await operacion(1, forma.idFormaPago);
    await db.formaPago.update({ where: { idFormaPago: forma.idFormaPago }, data: { nombreFormaPago: "Forma renombrada", nombreNormalizadaFormaPago: "forma renombrada" } });
    expect((await leerComprobante(db, op.comprobante.id))?.forma_pago.nombre).toBe("Forma HU-I-11");
  });

  it("anulación parcial: el pago anulado resuelve al ORIGINAL («Reemplazado por»); el vigente, al reemplazo («reemplaza a»)", async () => {
    const op = await operacion(2);
    const [anulado, vigente] = op.pagos;
    await enTx((tx) => anularPago(tx, { pagoId: anulado!.id, motivo: "Reintegro", usuario: mesa }));

    const delAnulado = await comprobanteDelPago(db, anulado!.id);
    const delVigente = await comprobanteDelPago(db, vigente!.id);
    expect(delAnulado.id).toBe(op.comprobante.id);
    expect(delVigente.id).not.toBe(op.comprobante.id);

    const original = await leerComprobante(db, delAnulado.id);
    expect(original?.marcas).toEqual({ anulado: null, reemplazado_por: delVigente, reemplaza_a: null });
    const reemplazo = await leerComprobante(db, delVigente.id);
    expect(reemplazo?.marcas).toEqual({ anulado: null, reemplazado_por: null, reemplaza_a: { numero: op.comprobante.numeroVisible } });
    expect(reemplazo?.clases).toHaveLength(1);
  });

  it("anulación total: el vigente queda «ANULADO» con el motivo; la vista del alumno no lo trae", async () => {
    const op = await operacion(1);
    await enTx((tx) => anularPago(tx, { pagoId: op.pagos[0]!.id, motivo: "Baja del alumno", usuario: mesa }));

    const delPago = await comprobanteDelPago(db, op.pagos[0]!.id);
    expect(delPago.id).toBe(op.comprobante.id);
    const completo = await leerComprobante(db, delPago.id);
    expect(completo?.marcas.anulado).toEqual({ fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), motivo: "Baja del alumno" });

    const delAlumno = await leerComprobanteDeAlumno(db, delPago.id, op.alumnoId);
    expect(delAlumno?.marcas.anulado).toEqual({ fecha: completo!.marcas.anulado!.fecha });
    expect(delAlumno).not.toHaveProperty("registrado_por");
    expect(delAlumno?.registrado_en_el_centro).toBe(true);
  });

  it("vista del alumno: comprobante de otro alumno → FUERA_DE_ALCANCE; pago o comprobante inexistente", async () => {
    const op = await operacion(1);
    const otro = await crearAlumnoDePrueba(db);
    await expect(leerComprobanteDeAlumno(db, op.comprobante.id, otro.idAlumno)).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE" });
    await expect(comprobanteDelPago(db, "pago-inexistente")).rejects.toMatchObject({ code: "PAGO_NO_ENCONTRADO" });
    await expect(leerComprobante(db, "comprobante-inexistente")).resolves.toBeNull();
  });
});
