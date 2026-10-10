import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { Tx } from "@/server/shared/transaccion";
const mocks = vi.hoisted(() => ({ bloquear: vi.fn(), historial: vi.fn(), contar: vi.fn() }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: mocks.bloquear }));
vi.mock("@/server/shared/historial-estados", () => ({ registrarCambioEstado: mocks.historial }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ contarAlumnosConFormaPagoPreferida: mocks.contar }));
import { modificarFormaPago, obtenerImpactoFormaPago, desactivarFormaPago, reactivarFormaPago } from "./forma-pago.service";
const forma = { idFormaPago: "fp1", nombreFormaPago: "Débito", activaFormaPago: true };
const actor = { tipo: "USUARIO" as const, usuarioId: "gerente" };
const db = { formaPago: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn() }, pago: { count: vi.fn() }, correccionOperacion: { count: vi.fn() } };
const tx = db as unknown as Tx;
beforeEach(() => {
  vi.resetAllMocks(); db.formaPago.findUnique.mockResolvedValue(forma); db.formaPago.findFirst.mockResolvedValue(null);
  db.formaPago.count.mockResolvedValue(2); db.pago.count.mockResolvedValue(0); db.correccionOperacion.count.mockResolvedValue(0);
  db.formaPago.update.mockImplementation(async ({ data }) => ({ ...forma, ...data })); mocks.contar.mockResolvedValue(6);
});
describe("I-07 dominio", () => {
  it("sin cambios bloquea y devuelve sin escribir", async () => {
    expect(await modificarFormaPago(tx, "fp1", { nombre: "Débito" })).toEqual({ id: "fp1", nombre: "Débito", is_active: true });
    expect(db.formaPago.update).not.toHaveBeenCalled();
  });
  it("variante propia válida; unicidad excluye propia y update no toca esEfectivo", async () => {
    await modificarFormaPago(tx, "fp1", { nombre: "DEBITO" });
    expect(db.formaPago.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { nombreNormalizadaFormaPago: "debito", idFormaPago: { not: "fp1" } } }));
    expect(db.formaPago.update).toHaveBeenCalledWith(expect.objectContaining({ data: { nombreFormaPago: "DEBITO", nombreNormalizadaFormaPago: "debito" } }));
  });
  it("duplicado activo/inactivo y carrera P2002 dan mismo código", async () => {
    db.formaPago.findFirst.mockResolvedValue({ idFormaPago: "otro" });
    await expect(modificarFormaPago(tx, "fp1", { nombre: "Cheque" })).rejects.toMatchObject({ code: "NOMBRE_DUPLICADO", status: 409 });
    db.formaPago.findFirst.mockResolvedValue(null);
    db.formaPago.update.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "6" }));
    await expect(modificarFormaPago(tx, "fp1", { nombre: "Cheque" })).rejects.toMatchObject({ code: "NOMBRE_DUPLICADO" });
  });
  it("inexistente rechaza las cuatro operaciones", async () => {
    db.formaPago.findUnique.mockResolvedValue(null);
    for (const llamada of [() => modificarFormaPago(tx, "no", { nombre: "Nuevo" }), () => obtenerImpactoFormaPago("no", tx), () => desactivarFormaPago(tx, "no", {}, actor), () => reactivarFormaPago(tx, "no", actor)])
      await expect(llamada()).rejects.toMatchObject({ code: "FORMA_PAGO_NO_ENCONTRADA", status: 404 });
  });
  it("impacto consulta fachada B con tx, pagos y última activa", async () => {
    db.formaPago.count.mockResolvedValue(1); db.pago.count.mockResolvedValue(2);
    expect(await obtenerImpactoFormaPago("fp1", tx)).toEqual({ alumnos_con_preferida: 6, tiene_pagos: true, es_ultima_activa: true });
    expect(mocks.contar).toHaveBeenCalledWith("fp1", tx);
  });
  it("última activa se comprueba luego de bloquear conjunto y fila, sin escritura ni historial", async () => {
    db.formaPago.count.mockResolvedValue(1);
    await expect(desactivarFormaPago(tx, "fp1", {}, actor)).rejects.toMatchObject({ code: "ULTIMA_FORMA_PAGO_ACTIVA" });
    expect(mocks.bloquear).toHaveBeenCalledWith(tx, { formasPago: { activas: true, ids: ["fp1"] } });
    expect(mocks.bloquear.mock.invocationCallOrder[0]).toBeLessThan(db.formaPago.count.mock.invocationCallOrder[0]);
    expect(db.formaPago.update).not.toHaveBeenCalled(); expect(mocks.historial).not.toHaveBeenCalled();
  });
  it("pagos existentes exigen motivo; baja válida registra actor y motivo", async () => {
    db.pago.count.mockResolvedValue(1);
    await expect(desactivarFormaPago(tx, "fp1", { motivo: "  " }, actor)).rejects.toMatchObject({ code: "MOTIVO_REQUERIDO", status: 400 });
    expect(await desactivarFormaPago(tx, "fp1", { motivo: "No se acepta" }, actor)).toEqual({ id: "fp1", nombre: "Débito", is_active: false });
    expect(mocks.historial).toHaveBeenCalledWith(tx, { entidad: "FORMA_PAGO", id: "fp1", accion: "DESACTIVAR", motivo: "No se acepta", actor });
  });
  it("baja sin pagos permite motivo omitido; estados repetidos rechazan", async () => {
    await desactivarFormaPago(tx, "fp1", {}, actor);
    await expect(reactivarFormaPago(tx, "fp1", actor)).rejects.toMatchObject({ code: "FORMA_PAGO_YA_ACTIVA" });
    db.formaPago.findUnique.mockResolvedValue({ ...forma, activaFormaPago: false });
    await expect(desactivarFormaPago(tx, "fp1", {}, actor)).rejects.toMatchObject({ code: "FORMA_PAGO_YA_INACTIVA" });
    expect(await reactivarFormaPago(tx, "fp1", actor)).toMatchObject({ is_active: true });
    expect(mocks.historial).toHaveBeenLastCalledWith(tx, { entidad: "FORMA_PAGO", id: "fp1", accion: "REACTIVAR", actor });
  });
});
