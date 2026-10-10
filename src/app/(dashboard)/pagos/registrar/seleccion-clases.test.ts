import { describe, expect, it } from "vitest";
import type { ClasePendienteDePago } from "@/types/pago.types";
import { erroresDeSeleccion, itemsDeOperacion, motivoDeFila, seleccionInicial, totalElegido, type Seleccion } from "./seleccion-clases";

const clase = (extra: Partial<ClasePendienteDePago>): ClasePendienteDePago => ({
  inscripcion_id: "i1", turno_id: "t1", fecha: "2026-10-12", hora_inicio: "18:00", hora_fin: "19:00",
  materia: { id: "m1", nombre: "Física I" }, profesor: null, estado_pago: "RESERVADA", vence_el: "2026-10-11T18:00:00-03:00",
  precio: 12000, origen_precio: "INSCRIPCION", marcada: false, ...extra,
});
const clases = [clase({}), clase({ inscripcion_id: "i2", turno_id: "t2", precio: 11000 }), clase({ inscripcion_id: null, turno_id: "t9", precio: 18000, estado_pago: "SE_INSCRIBE_AL_PAGAR", origen_precio: "TARIFA_VIGENTE", marcada: true })];
const con = (seleccion: Seleccion, clave: string, cambio: Partial<Seleccion[string]>): Seleccion => ({ ...seleccion, [clave]: { ...seleccion[clave]!, ...cambio } });

describe("selección del paso 2 (HU-I-10 criterio 4)", () => {
  it("arranca con el precio de cada clase y solo la clase marcada elegida", () => {
    const seleccion = seleccionInicial(clases);
    expect(Object.entries(seleccion).map(([clave, fila]) => [clave, fila.elegida, fila.monto])).toEqual([
      ["i1", false, "12000"], ["i2", false, "11000"], ["T:t9", true, "18000"],
    ]);
    expect(totalElegido(clases, seleccion)).toBe(18000);
  });
  it("el total se recalcula al marcar, desmarcar y cambiar un importe", () => {
    let seleccion = seleccionInicial(clases);
    seleccion = con(seleccion, "i1", { elegida: true });
    expect(totalElegido(clases, seleccion)).toBe(30000);
    seleccion = con(seleccion, "T:t9", { elegida: false });
    expect(totalElegido(clases, seleccion)).toBe(12000);
    seleccion = con(seleccion, "i1", { modificando: true, monto: "10000.50" });
    expect(totalElegido(clases, seleccion)).toBe(10000.5);
    seleccion = con(seleccion, "i1", { monto: "abc" });
    expect(totalElegido(clases, seleccion)).toBe(0);
  });
  it("exige motivo si el importe difiere del precio, e importe válido", () => {
    let seleccion = con(seleccionInicial(clases), "i1", { elegida: true, modificando: true, monto: "10000" });
    expect(erroresDeSeleccion(clases, seleccion)).toEqual({ i1: { motivo: "requerido" } });
    seleccion = con(seleccion, "i1", { monto: "0" });
    expect(erroresDeSeleccion(clases, seleccion)).toEqual({ i1: { monto: "invalido" } });
    seleccion = con(seleccion, "i1", { monto: "12000" });
    expect(erroresDeSeleccion(clases, seleccion)).toEqual({});
  });
  it("arma los ítems del body: inscripcion_id o turno_id, y el motivo solo si el importe difiere", () => {
    let seleccion = con(seleccionInicial(clases), "i1", { elegida: true, modificando: true, monto: "10000", motivo: " Beca " });
    seleccion = con(seleccion, "i2", { elegida: true, modificando: true, monto: "11000", motivo: "ignorado" });
    expect(itemsDeOperacion(clases, seleccion)).toEqual([
      { inscripcion_id: "i1", monto: "10000", motivo_ajuste: "Beca" },
      { inscripcion_id: "i2", monto: "11000" },
      { turno_id: "t9", monto: "18000" },
    ]);
    expect(motivoDeFila(clases[0]!, seleccion.i1)).toBe("Beca");
    expect(motivoDeFila(clases[1]!, seleccion.i2)).toBeNull();
  });
});
