import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({ nombres: vi.fn() }));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal: m.nombres }));
const { obtenerConfiguracion, listarHistorialConfiguracion, registrarCambioConfiguracion } = await import("@/server/configuracion/configuracion.service");

beforeEach(() => { vi.clearAllMocks(); m.nombres.mockResolvedValue([]); });

describe("servicio de configuración", () => {
  it("falta una fila: error de datos, sin usar el fallback compartido", async () => {
    const db = { parametroSistema: { findMany: vi.fn().mockResolvedValue([
      { clave: "plazo_pago_horas", valor: "24" },
      { clave: "cancelacion_anticipacion_horas", valor: "24" },
    ]) } };
    await expect(obtenerConfiguracion(db as unknown as Prisma.TransactionClient)).rejects.toThrow("Configuración persistida inválida");
  });

  it("historial: orden, paginación, nombre en lote y fallback del id", async () => {
    const fecha = new Date("2026-10-14T10:00:00.000Z");
    const db = { historialParametro: {
      count: vi.fn().mockResolvedValue(11),
      findMany: vi.fn().mockResolvedValue([
        { idHistorialParametro: "b", clave: "plazo_pago_horas", valorAnterior: "24", valorNuevo: "48", usuarioId: "u1", fecha },
        { idHistorialParametro: "a", clave: "umbral_presentismo", valorAnterior: "75", valorNuevo: "80", usuarioId: "u2", fecha },
      ]),
    } };
    m.nombres.mockResolvedValue([{ usuario_id: "u1", nombre_completo: "Ibarra, Marcos" }]);
    const resultado = await listarHistorialConfiguracion({ pagina: 2 }, db as unknown as Prisma.TransactionClient);
    expect(db.historialParametro.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: [{ fecha: "desc" }, { idHistorialParametro: "desc" }] }));
    expect(m.nombres).toHaveBeenCalledWith(["u1", "u2"], db);
    expect(resultado).toMatchObject({ pagina: 2, por_pagina: 10, total: 11, total_paginas: 2 });
    expect(resultado.items.map((i) => i.usuario.nombre)).toEqual(["Ibarra, Marcos", "u2"]);
    expect(resultado.items[0].fecha).toBe(fecha.toISOString());
  });

  it("historial posterior: reintenta con el mismo id y registra el fallo final", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("temporal")).mockRejectedValueOnce(new Error("temporal")).mockResolvedValueOnce({});
    const db = { historialParametro: { create } };
    const cambio = { idHistorialParametro: "id-fijo", clave: "plazo_pago_horas" as const, valorAnterior: "24", valorNuevo: "48", usuarioId: "u1", fecha: new Date() };
    expect(await registrarCambioConfiguracion(cambio, db as unknown as Prisma.TransactionClient, 0)).toBe(true);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls.every(([argumento]) => argumento.data.idHistorialParametro === "id-fijo")).toBe(true);
    create.mockReset().mockRejectedValue(new Error("caído"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await registrarCambioConfiguracion(cambio, db as unknown as Prisma.TransactionClient, 0)).toBe(false);
    expect(create).toHaveBeenCalledTimes(4);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("historial"), expect.objectContaining({ id: "id-fijo", intentos: 4 }));
    log.mockRestore();
  });
});
