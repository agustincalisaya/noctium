import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearUsuarioDePrueba, crearFichaMesaEntradaDePrueba, crearInscripcionDePrueba, crearTurnoDePrueba, unico } from "@/server/testing/fabricas";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { crearFormaPago, modificarFormaPago, desactivarFormaPago, reactivarFormaPago, obtenerImpactoFormaPago } from "./forma-pago.service";
import { listarFormasPagoActivas } from "./forma-pago.publico";
import { obtenerDetalleAlumno } from "@/server/alumnos/alumno.service";
import { abrirCaja } from "./caja.service";
import { registrarOperacion } from "./operacion.service";
import { listarClasesPendientesDePago } from "./pago.service";
import { fixtureHuI07 } from "../../../prisma/seed/fixtures/hu-i-07";
import { corregirOperacion } from "./correccion.service";
import { ComprobanteDatosSchema } from "./comprobante.schema";

describe.skipIf(!basePgHabilitada)("HU-I-07 PostgreSQL real aislado", () => {
  let db: PrismaClient;
  let usuarioId: string;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>) => transaccion(fn, { db });
  const crear = async (nombre = unico("I07")) => crearFormaPago({ nombre }, usuarioId);
  const bajar = (id: string, motivo?: string) => enTx((tx) => desactivarFormaPago(tx, id, { motivo }, actorUsuario(usuarioId)));
  const subir = (id: string) => enTx((tx) => reactivarFormaPago(tx, id, actorUsuario(usuarioId)));
  beforeAll(async () => { db = clientePg(); usuarioId = (await crearFichaMesaEntradaDePrueba(db)).usuarioId!; });
  afterAll(async () => { await db?.$disconnect(); });

  it("unicidad incluye inactivas y variantes propias válidas; sin cambios conserva updatedAt", async () => {
    const a = await crear(); const b = await crear();
    await bajar(b.idFormaPago);
    await expect(enTx((tx) => modificarFormaPago(tx, a.idFormaPago, { nombre: b.nombreFormaPago }))).rejects.toMatchObject({ code: "NOMBRE_DUPLICADO" });
    const nombre = `${unico("i07")} Crédito`;
    await enTx((tx) => modificarFormaPago(tx, a.idFormaPago, { nombre }));
    const variante = nombre.toUpperCase().replace("É", "E");
    expect(await enTx((tx) => modificarFormaPago(tx, a.idFormaPago, { nombre: variante }))).toMatchObject({ nombre: variante });
    const antes = await db.formaPago.findUniqueOrThrow({ where: { idFormaPago: a.idFormaPago } });
    await enTx((tx) => modificarFormaPago(tx, a.idFormaPago, { nombre: variante }));
    const despues = await db.formaPago.findUniqueOrThrow({ where: { idFormaPago: a.idFormaPago } });
    expect(despues.updatedAtFormaPago).toEqual(antes.updatedAtFormaPago);
    expect(despues.esEfectivo).toBe(antes.esEfectivo);
  });

  it("impacto cuenta fichas activas e inactivas; sin pagos permite baja sin motivo y reactivar retorna a opciones", async () => {
    const forma = await crear();
    for (const activo of [true, false]) {
      const alumno = await crearAlumnoDePrueba(db, { activo });
      await db.alumno.update({ where: { idAlumno: alumno.idAlumno }, data: { formaPagoPreferidaId: forma.idFormaPago } });
    }
    expect(await obtenerImpactoFormaPago(forma.idFormaPago, db)).toMatchObject({ alumnos_con_preferida: 2, tiene_pagos: false });
    await bajar(forma.idFormaPago);
    expect((await listarFormasPagoActivas()).some((f) => f.id === forma.idFormaPago)).toBe(false);
    await expect(bajar(forma.idFormaPago)).rejects.toMatchObject({ code: "FORMA_PAGO_YA_INACTIVA" });
    await subir(forma.idFormaPago);
    expect((await listarFormasPagoActivas()).some((f) => f.id === forma.idFormaPago)).toBe(true);
    await expect(subir(forma.idFormaPago)).rejects.toMatchObject({ code: "FORMA_PAGO_YA_ACTIVA" });
    const historial = await db.historialEstado.findMany({ where: { entidad: "FORMA_PAGO", entidadId: forma.idFormaPago }, orderBy: { fecha: "asc" } });
    expect(historial.map((h) => [h.accion, h.usuarioId, h.actorTipo, h.motivo])).toEqual([["DESACTIVAR", usuarioId, "USUARIO", null], ["REACTIVAR", usuarioId, "USUARIO", null]]);
    expect(historial.every((h) => h.fecha instanceof Date)).toBe(true);
  });

  it("pago/comprobante reales: exige motivo, conserva filas y snapshot; preferida inactiva no se preselecciona en I-10", async () => {
    const forma = await crear();
    const alumno = await crearAlumnoDePrueba(db);
    await db.alumno.update({ where: { idAlumno: alumno.idAlumno }, data: { formaPagoPreferidaId: forma.idFormaPago } });
    await enTx((tx) => abrirCaja(tx, { usuarioId, fondoInicial: "0" }));
    const clase = await crearTurnoDePrueba(db, { enDias: 4 });
    const inscripcion = await crearInscripcionDePrueba(db, { turnoId: clase.idTurno, alumnoId: alumno.idAlumno, precio: 12000 });
    const cobro = await enTx((tx) => registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId, formaPagoId: forma.idFormaPago, modo: "completo", items: [{ inscripcionId: inscripcion.idInscripcion, monto: "12000" }] }));
    const pagosAntes = await db.pago.findMany({ where: { operacionId: cobro.operacion.id } });
    const comprobanteAntes = await db.comprobante.findUniqueOrThrow({ where: { idComprobante: cobro.comprobante.id } });
    expect(ComprobanteDatosSchema.parse(comprobanteAntes.datos)).toMatchObject({ forma_pago: { nombre: forma.nombreFormaPago } });
    await enTx((tx) => modificarFormaPago(tx, forma.idFormaPago, { nombre: `${forma.nombreFormaPago} nuevo` }));
    expect((await obtenerDetalleAlumno(alumno.idAlumno)).forma_pago_preferida).toBe(`${forma.nombreFormaPago} nuevo`);
    expect(await obtenerImpactoFormaPago(forma.idFormaPago, db)).toMatchObject({ tiene_pagos: true });
    await expect(bajar(forma.idFormaPago)).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO" });
    await bajar(forma.idFormaPago, "El centro ya no la acepta");
    const ficha = await obtenerDetalleAlumno(alumno.idAlumno);
    expect(ficha).toMatchObject({ forma_pago_preferida_id: forma.idFormaPago, forma_pago_preferida_activa: false });
    const pendientes = await listarClasesPendientesDePago(alumno.idAlumno);
    expect(pendientes.alumno.forma_pago_preferida_id).toBeNull();
    expect(pendientes.formas_pago.some((f) => f.id === forma.idFormaPago)).toBe(false);
    expect(await db.pago.findMany({ where: { operacionId: cobro.operacion.id } })).toEqual(pagosAntes);
    expect((await db.comprobante.findUniqueOrThrow({ where: { idComprobante: cobro.comprobante.id } })).datos).toEqual(comprobanteAntes.datos);
    expect(await db.historialEstado.findFirst({ where: { entidadId: forma.idFormaPago, accion: "DESACTIVAR" } })).toMatchObject({ motivo: "El centro ya no la acepta", usuarioId });
    // Diferido I-06 disponible por servicio: conservar la actual inactiva al cambiar fecha,
    // y rechazar cambiar a otra inactiva. Las pantallas de I-06 aún no están.
    const otra = await crear(); await bajar(otra.idFormaPago);
    await expect(enTx((tx) => corregirOperacion(tx, { pagoId: pagosAntes[0].idPago, formaPagoId: otra.idFormaPago,
      motivo: "Cambio de medio", usuario: { id: usuarioId, rol: "GERENTE" } }))).rejects.toMatchObject({ code: "FORMA_PAGO_NO_DISPONIBLE" });
    const corregida = await enTx((tx) => corregirOperacion(tx, { pagoId: pagosAntes[0].idPago,
      fechaPago: new Date(pagosAntes[0].fechaPago.getTime() - 86400000), motivo: "Fecha correcta",
      usuario: { id: usuarioId, rol: "GERENTE" } }));
    expect(corregida.comprobante.datos.forma_pago).toMatchObject({ id: forma.idFormaPago });
    expect(await db.pago.findMany({ where: { operacionId: cobro.operacion.id } })).toEqual(pagosAntes);
    expect((await db.comprobante.findUniqueOrThrow({ where: { idComprobante: cobro.comprobante.id } })).datos).toEqual(comprobanteAntes.datos);

  });

  it("fixture idempotente: Cheque inactiva, un historial; conserva reactivación del usuario", async () => {
    await crearUsuarioDePrueba(db, { rol: "GERENTE" });
    await fixtureHuI07({ prisma: db });
    const cheque = await db.formaPago.findUniqueOrThrow({ where: { nombreNormalizadaFormaPago: "cheque" } });
    expect(cheque.activaFormaPago).toBe(false);
    await fixtureHuI07({ prisma: db });
    expect(await db.historialEstado.count({ where: { entidadId: cheque.idFormaPago, accion: "DESACTIVAR" } })).toBe(1);
    await subir(cheque.idFormaPago);
    await fixtureHuI07({ prisma: db });
    expect((await db.formaPago.findUniqueOrThrow({ where: { idFormaPago: cheque.idFormaPago } })).activaFormaPago).toBe(true);
  });

  it("dos bajas simultáneas de las dos únicas activas: una gana, otra falla y queda exactamente una activa", async () => {
    // Solo en la base descartable del runner. Guarda/restaura las otras activas.
    const a = await crear(); const b = await crear();
    const otras = await db.formaPago.findMany({ where: { activaFormaPago: true, idFormaPago: { notIn: [a.idFormaPago, b.idFormaPago] } }, select: { idFormaPago: true } });
    await db.formaPago.updateMany({ where: { idFormaPago: { in: otras.map((f) => f.idFormaPago) } }, data: { activaFormaPago: false } });
    try {
      const resultados = await Promise.allSettled([bajar(a.idFormaPago), bajar(b.idFormaPago)]);
      expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rechazo.reason).toMatchObject({ code: "ULTIMA_FORMA_PAGO_ACTIVA" });
      expect(await db.formaPago.count({ where: { activaFormaPago: true } })).toBe(1);
    } finally {
      await db.formaPago.updateMany({ where: { idFormaPago: { in: otras.map((f) => f.idFormaPago) } }, data: { activaFormaPago: true } });
    }
  });
});
