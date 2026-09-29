import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

const { db, tx } = vi.hoisted(() => {
  const tx = { formaPago: { findFirst: vi.fn(), create: vi.fn() } };
  const db = {
    $transaction: vi.fn(async (callback: (cliente: typeof tx) => unknown) => callback(tx)),
    formaPago: { count: vi.fn(), findMany: vi.fn() },
  };
  return { db, tx };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const { crearFormaPago, listarFormasPago } = await import("./forma-pago.service");

const MENSAJE_DUPLICADO = "Ya existe una forma de pago con ese nombre.";

const violacionUnicidad = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (callback: (cliente: typeof tx) => unknown) => callback(tx));
});

describe("crearFormaPago", () => {
  it("normaliza acentos y mayúsculas para verificar el duplicado", async () => {
    tx.formaPago.findFirst.mockResolvedValue(null);
    tx.formaPago.create.mockResolvedValue({ idFormaPago: "fp1" });

    await crearFormaPago({ nombre: "Tarjeta de DÉBITO" }, "u1");

    expect(tx.formaPago.findFirst).toHaveBeenCalledWith({
      where: { nombreNormalizadaFormaPago: "tarjeta de debito" },
      select: { idFormaPago: true },
    });
  });

  it("crea activa, con el nombre normalizado y el usuario creador", async () => {
    tx.formaPago.findFirst.mockResolvedValue(null);
    const creada = { idFormaPago: "fp1", nombreFormaPago: "Mercado Pago", activaFormaPago: true };
    tx.formaPago.create.mockResolvedValue(creada);

    await expect(crearFormaPago({ nombre: "Mercado Pago" }, "u1")).resolves.toBe(creada);

    expect(tx.formaPago.create).toHaveBeenCalledWith({
      data: {
        nombreFormaPago: "Mercado Pago",
        nombreNormalizadaFormaPago: "mercado pago",
        activaFormaPago: true,
        creadoPorUsuarioId: "u1",
      },
    });
  });

  it("con un duplicado activo lanza NOMBRE_DUPLICADO sin insertar", async () => {
    tx.formaPago.findFirst.mockResolvedValue({ idFormaPago: "fp1" });

    await expect(crearFormaPago({ nombre: "Efectivo" }, "u1")).rejects.toMatchObject({
      code: "NOMBRE_DUPLICADO",
      message: MENSAJE_DUPLICADO,
    });
    expect(tx.formaPago.create).not.toHaveBeenCalled();
  });

  it("no filtra por estado: un duplicado inactivo también se rechaza", async () => {
    tx.formaPago.findFirst.mockResolvedValue({ idFormaPago: "fp-inactiva" });

    await expect(crearFormaPago({ nombre: "Cheque" }, "u1")).rejects.toBeInstanceOf(ServiceError);
    const [{ where }] = tx.formaPago.findFirst.mock.calls[0]!;
    expect(where).toEqual({ nombreNormalizadaFormaPago: "cheque" });
    expect(where).not.toHaveProperty("activaFormaPago");
  });

  it.each([["nombreNormalizadaFormaPago"], ["nombreFormaPago"]])(
    "traduce P2002 sobre %s a NOMBRE_DUPLICADO",
    async (campo) => {
      tx.formaPago.findFirst.mockResolvedValue(null);
      tx.formaPago.create.mockRejectedValue(violacionUnicidad([campo]));

      await expect(crearFormaPago({ nombre: "Efectivo" }, "u1")).rejects.toMatchObject({
        code: "NOMBRE_DUPLICADO",
        message: MENSAJE_DUPLICADO,
      });
    },
  );

  it("relanza los errores que no son P2002", async () => {
    tx.formaPago.findFirst.mockResolvedValue(null);
    const fallo = new Error("conexión caída");
    tx.formaPago.create.mockRejectedValue(fallo);

    await expect(crearFormaPago({ nombre: "Efectivo" }, "u1")).rejects.toBe(fallo);
  });
});

describe("listarFormasPago", () => {
  const forma = (id: string, nombre: string, activa: boolean) => ({
    idFormaPago: id,
    nombreFormaPago: nombre,
    activaFormaPago: activa,
  });

  it("incluye activas e inactivas, ordena por nombre normalizado y mapea el shape", async () => {
    db.formaPago.count.mockResolvedValue(2);
    db.formaPago.findMany.mockResolvedValue([forma("a", "Débito", true), forma("b", "Efectivo", false)]);

    const resultado = await listarFormasPago({ pagina: 1, por_pagina: 20 });

    expect(resultado.items).toEqual([
      { id: "a", nombre: "Débito", is_active: true },
      { id: "b", nombre: "Efectivo", is_active: false },
    ]);
    const [args] = db.formaPago.findMany.mock.calls[0]!;
    expect(args.orderBy).toEqual({ nombreNormalizadaFormaPago: "asc" });
    expect(args).not.toHaveProperty("where");
  });

  it("pagina con skip y take", async () => {
    db.formaPago.count.mockResolvedValue(45);
    db.formaPago.findMany.mockResolvedValue([]);

    const { paginacion } = await listarFormasPago({ pagina: 2, por_pagina: 20 });

    expect(db.formaPago.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(paginacion).toEqual({ total: 45, pagina_actual: 2, total_paginas: 3, por_pagina: 20 });
  });

  it("acota una página fuera de rango a la última", async () => {
    db.formaPago.count.mockResolvedValue(25);
    db.formaPago.findMany.mockResolvedValue([]);

    const { paginacion } = await listarFormasPago({ pagina: 99, por_pagina: 20 });

    expect(db.formaPago.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20 }));
    expect(paginacion.pagina_actual).toBe(2);
  });

  it("respeta un por_pagina menor al máximo", async () => {
    db.formaPago.count.mockResolvedValue(25);
    db.formaPago.findMany.mockResolvedValue([]);

    const { paginacion } = await listarFormasPago({ pagina: 1, por_pagina: 10 });

    expect(db.formaPago.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    expect(paginacion).toMatchObject({ total_paginas: 3, por_pagina: 10 });
  });

  it("sin filas devuelve página 1 y total_paginas 0", async () => {
    db.formaPago.count.mockResolvedValue(0);
    db.formaPago.findMany.mockResolvedValue([]);

    await expect(listarFormasPago({ pagina: 3, por_pagina: 20 })).resolves.toEqual({
      items: [],
      paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 20 },
    });
  });
});
