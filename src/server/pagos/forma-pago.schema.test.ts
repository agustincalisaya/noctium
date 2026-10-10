import { describe, expect, it } from "vitest";
import { CrearFormaPagoSchema, ListarFormasPagoQuerySchema, ModificarFormaPagoSchema, DesactivarFormaPagoSchema } from "./forma-pago.schema";

const mensajes = (valor: unknown) => {
  const resultado = CrearFormaPagoSchema.safeParse(valor);
  return resultado.success ? [] : resultado.error.issues.map((issue) => issue.message);
};

describe("CrearFormaPagoSchema", () => {
  it("acepta un nombre válido y lo devuelve recortado", () => {
    expect(CrearFormaPagoSchema.parse({ nombre: "  Efectivo  " })).toEqual({ nombre: "Efectivo" });
  });

  it("colapsa los espacios internos", () => {
    expect(CrearFormaPagoSchema.parse({ nombre: "Tarjeta   de \t débito" })).toEqual({
      nombre: "Tarjeta de débito",
    });
  });

  it("rechaza un campo extra (.strict)", () => {
    expect(CrearFormaPagoSchema.safeParse({ nombre: "Efectivo", numero_tarjeta: "4111" }).success).toBe(false);
  });

  it("con el campo vacío o solo espacios informa un único mensaje", () => {
    expect(mensajes({ nombre: "" })).toEqual(["Ingresá el nombre de la forma de pago."]);
    expect(mensajes({ nombre: "   " })).toEqual(["Ingresá el nombre de la forma de pago."]);
  });

  it("rechaza 1 carácter y acepta 2", () => {
    expect(mensajes({ nombre: "a" })).toEqual(["El nombre debe tener al menos 2 caracteres"]);
    expect(CrearFormaPagoSchema.safeParse({ nombre: "ab" }).success).toBe(true);
  });

  it("acepta 40 caracteres y rechaza 41", () => {
    expect(CrearFormaPagoSchema.safeParse({ nombre: "a".repeat(40) }).success).toBe(true);
    expect(mensajes({ nombre: "a".repeat(41) })).toEqual(["El nombre no puede superar los 40 caracteres"]);
  });

  it("colapsa los espacios antes de validar el largo", () => {
    // 43 caracteres crudos; después de colapsar los espacios dobles quedan 39.
    const crudo = `${"a".repeat(12)}   ${"b".repeat(12)}   ${"c".repeat(11)}`;
    expect(crudo.length).toBeGreaterThan(40);
    expect(CrearFormaPagoSchema.safeParse({ nombre: crudo }).success).toBe(true);
    // "a      b" colapsa a "a b" (3 caracteres): supera el mínimo de 2.
    expect(CrearFormaPagoSchema.safeParse({ nombre: "a      b" }).success).toBe(true);
  });

  it("rechaza si falta el nombre o no es texto", () => {
    expect(CrearFormaPagoSchema.safeParse({}).success).toBe(false);
    expect(CrearFormaPagoSchema.safeParse({ nombre: 5 }).success).toBe(false);
  });
});

describe("ListarFormasPagoQuerySchema", () => {
  it("usa pagina 1 y por_pagina 20 por defecto", () => {
    expect(ListarFormasPagoQuerySchema.parse({})).toEqual({ pagina: 1, por_pagina: 20 });
  });

  it("coacciona textos y rechaza por_pagina mayor a 20, cero o no enteros", () => {
    expect(ListarFormasPagoQuerySchema.parse({ pagina: "2", por_pagina: "10" })).toEqual({ pagina: 2, por_pagina: 10 });
    expect(ListarFormasPagoQuerySchema.safeParse({ por_pagina: "21" }).success).toBe(false);
    expect(ListarFormasPagoQuerySchema.safeParse({ pagina: "0" }).success).toBe(false);
    expect(ListarFormasPagoQuerySchema.safeParse({ pagina: "1.5" }).success).toBe(false);
  });
});

describe("I-07 schemas estrictos", () => {
  it("edición reutiliza el alta y rechaza esEfectivo", () => {
    expect(ModificarFormaPagoSchema).toBe(CrearFormaPagoSchema);
    expect(ModificarFormaPagoSchema.safeParse({ nombre: "Débito", esEfectivo: true }).success).toBe(false);
  });
  it("baja permite omitir motivo o espacios; valida límite después de trim y rechaza campos extra", () => {
    expect(DesactivarFormaPagoSchema.parse({})).toEqual({});
    expect(DesactivarFormaPagoSchema.parse({ motivo: "  " })).toEqual({ motivo: undefined });
    expect(DesactivarFormaPagoSchema.parse({ motivo: " x " })).toEqual({ motivo: "x" });
    expect(DesactivarFormaPagoSchema.safeParse({ motivo: "x".repeat(300) }).success).toBe(true);
    expect(DesactivarFormaPagoSchema.safeParse({ motivo: "x".repeat(301) }).success).toBe(false);
    expect(DesactivarFormaPagoSchema.safeParse({ motivo: 1 }).success).toBe(false);
    expect(DesactivarFormaPagoSchema.safeParse({ activa: false }).success).toBe(false);
  });
});
