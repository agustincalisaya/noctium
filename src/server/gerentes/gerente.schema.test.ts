import { describe, expect, it } from "vitest";
import { flattenError } from "zod";
import {
  DesactivarGerenteSchema,
  ListarGerentesQuerySchema,
  ReactivarGerenteSchema,
  POR_PAGINA_GERENTES,
  construirAltaGerenteSchema,
  construirModificarGerenteSchema,
} from "@/server/gerentes/gerente.schema";

// Schemas de los gerentes (spec_modulo_G.md §2.1 y §2.2, HU-G-01 c1 y c2;
// decisión 3 de la task: las reglas de HU-F-01).

const alta = construirAltaGerenteSchema(7, 8);
const modificar = construirModificarGerenteSchema(7, 8);
const EMAIL_REQUERIDO = "Ingresá el email: con él se crea la cuenta de acceso";
const ALTA = { nombre: "Marcos", apellido: "Ibarra", dni: "27111222", fechaNacimiento: "1985-03-20", email: "marcos@mail.com" };

function errores(resultado: ReturnType<typeof alta.safeParse> | ReturnType<typeof modificar.safeParse>) {
  if (resultado.success) throw new Error("Se esperaba un error");
  return flattenError(resultado.error);
}

describe("construirAltaGerenteSchema", () => {
  it("acepta el alta mínima y la devuelve normalizada", () => {
    expect(alta.parse({ ...ALTA, nombre: "  Ana   María ", genero: "FEMENINO" })).toMatchObject({
      nombre: "Ana María",
      apellido: "Ibarra",
      dni: "27111222",
      fechaNacimiento: new Date("1985-03-20T00:00:00.000Z"),
      genero: "FEMENINO",
      email: "marcos@mail.com",
    });
  });

  it("normaliza el contacto: email en minúsculas y teléfono normalizado; teléfono vacío = sin teléfono", () => {
    expect(alta.parse({ ...ALTA, email: "  Marcos.Ibarra@Mail.COM ", telefono: "(011) 4555-1234" })).toMatchObject({
      email: "marcos.ibarra@mail.com",
      telefono: "01145551234",
    });
    expect(alta.parse({ ...ALTA, telefono: "" }).telefono).toBeUndefined();
  });

  it.each([undefined, null, "", "   "])("email %j: el mensaje del backlog", (email) => {
    expect(errores(alta.safeParse({ ...ALTA, email })).fieldErrors.email).toEqual([EMAIL_REQUERIDO]);
  });

  it("email con formato inválido o de más de 254 caracteres", () => {
    expect(errores(alta.safeParse({ ...ALTA, email: "no-es-email" })).fieldErrors.email).toEqual(["Ingresá un email válido"]);
    const largo = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.com`;
    expect(largo.length).toBeGreaterThan(254);
    expect(errores(alta.safeParse({ ...ALTA, email: largo })).fieldErrors.email).toBeDefined();
  });

  it("teléfono de 8 a 15 dígitos", () => {
    expect(errores(alta.safeParse({ ...ALTA, telefono: "1234567" })).fieldErrors.telefono).toEqual([
      "El teléfono debe tener entre 8 y 15 dígitos",
    ]);
    expect(alta.safeParse({ ...ALTA, telefono: "1234567890123456" }).success).toBe(false);
    expect(alta.safeParse({ ...ALTA, telefono: "12345678" }).success).toBe(true);
  });

  it("nombre y apellido: largo y caracteres, con los mensajes de la identidad", () => {
    expect(errores(alta.safeParse({ ...ALTA, nombre: "A" })).fieldErrors.nombre).toEqual([
      "El nombre debe tener al menos 2 caracteres",
    ]);
    expect(errores(alta.safeParse({ ...ALTA, apellido: "a".repeat(51) })).fieldErrors.apellido).toEqual([
      "El apellido no puede superar los 50 caracteres",
    ]);
    expect(errores(alta.safeParse({ ...ALTA, apellido: "Prueba 2" })).fieldErrors.apellido).toEqual([
      "El apellido solo admite letras, espacios, acentos, apóstrofes y guiones",
    ]);
    expect(alta.safeParse({ ...ALTA, apellido: "D'Angelo-Núñez" }).success).toBe(true);
  });

  it("DNI numérico con la longitud configurada", () => {
    expect(errores(alta.safeParse({ ...ALTA, dni: "2711122A" })).fieldErrors.dni).toEqual(["Ingresá el DNI solo con números"]);
    expect(errores(alta.safeParse({ ...ALTA, dni: "123456" })).fieldErrors.dni).toEqual(["El DNI debe tener entre 7 y 8 dígitos"]);
    expect(construirAltaGerenteSchema(8, 8).safeParse({ ...ALTA, dni: "1234567" }).success).toBe(false);
  });

  it("fecha de nacimiento: ni futura ni inexistente", () => {
    expect(errores(alta.safeParse({ ...ALTA, fechaNacimiento: "2999-01-01" })).fieldErrors.fechaNacimiento).toEqual([
      "La fecha de nacimiento no puede ser futura",
    ]);
    expect(alta.safeParse({ ...ALTA, fechaNacimiento: "2001-02-30" }).success).toBe(false);
    expect(errores(alta.safeParse({ ...ALTA, fechaNacimiento: "" })).fieldErrors.fechaNacimiento).toEqual([
      "Ingresá la fecha de nacimiento",
    ]);
  });

  it.each([{ activo: false }, { usuarioId: "ckusuario" }, { rol: "GERENTE" }, { version: 0 }])(
    ".strict() rechaza %j: el rol lo fija el servicio",
    (extra) => {
      expect(alta.safeParse({ ...ALTA, ...extra }).success).toBe(false);
    },
  );

  it("exige la identidad completa", () => {
    expect(Object.keys(errores(alta.safeParse({ email: "x@mail.com" })).fieldErrors).sort()).toEqual([
      "apellido",
      "dni",
      "fechaNacimiento",
      "nombre",
    ]);
  });
});

describe("construirModificarGerenteSchema", () => {
  it("campo ausente = no se toca: solo `version` es obligatoria", () => {
    expect(modificar.parse({ version: 3 })).toEqual({ version: 3 });
    expect(errores(modificar.safeParse({ telefono: null })).fieldErrors.version).toBeDefined();
    expect(modificar.safeParse({ version: -1 }).success).toBe(false);
    expect(modificar.safeParse({ version: 1.5 }).success).toBe(false);
    expect(modificar.safeParse({ version: "3" }).success).toBe(false);
  });

  it("teléfono: null lo quita; la cadena vacía se rechaza", () => {
    expect(modificar.parse({ telefono: null, version: 0 })).toEqual({ telefono: null, version: 0 });
    expect(modificar.safeParse({ telefono: "", version: 0 }).success).toBe(false);
    expect(modificar.safeParse({ telefono: "   ", version: 0 }).success).toBe(false);
  });

  it("email: no se puede vaciar ni quitar, con el mensaje del backlog", () => {
    for (const email of [null, "", "  "]) {
      expect(errores(modificar.safeParse({ email, version: 0 })).fieldErrors.email).toEqual([EMAIL_REQUERIDO]);
    }
    expect(modificar.parse({ email: "Nuevo@Mail.com", version: 0 }).email).toBe("nuevo@mail.com");
  });

  it("género: null vuelve a «Sin especificar»", () => {
    expect(modificar.parse({ genero: null, version: 0 })).toEqual({ genero: null, version: 0 });
    expect(modificar.parse({ genero: "OTRO", version: 0 }).genero).toBe("OTRO");
    expect(modificar.safeParse({ genero: "X", version: 0 }).success).toBe(false);
  });

  it("la identidad, si viene, con las mismas validaciones que el alta", () => {
    expect(errores(modificar.safeParse({ dni: "12", version: 0 })).fieldErrors.dni).toEqual(["El DNI debe tener entre 7 y 8 dígitos"]);
    expect(modificar.parse({ nombre: " Ana   María ", version: 0 }).nombre).toBe("Ana María");
  });

  it.each([{ activo: true }, { usuarioId: "x" }, { rol: "GERENTE" }])(".strict() rechaza %j", (extra) => {
    expect(modificar.safeParse({ version: 0, ...extra }).success).toBe(false);
  });
});

describe("ListarGerentesQuerySchema (HU-G-03)", () => {
  it("pagina por defecto 1 y q recortado", () => {
    expect(ListarGerentesQuerySchema.parse({})).toEqual({ pagina: 1 });
    expect(ListarGerentesQuerySchema.parse({ pagina: "3", q: "  ferreyra " })).toEqual({ pagina: 3, q: "ferreyra" });
    expect(POR_PAGINA_GERENTES).toBe(10);
  });

  it.each(["0", "-1", "1.5", "abc"])("rechaza pagina=%s", (pagina) => {
    expect(ListarGerentesQuerySchema.safeParse({ pagina }).success).toBe(false);
  });

  it("q de hasta 100 caracteres (se mide después de recortar)", () => {
    expect(ListarGerentesQuerySchema.safeParse({ q: "a".repeat(100) }).success).toBe(true);
    expect(ListarGerentesQuerySchema.safeParse({ q: ` ${"a".repeat(100)} ` }).success).toBe(true);
    expect(ListarGerentesQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
  });

  it.each([{ por_pagina: "5" }, { orden: "dni" }])(".strict() rechaza %j: por_pagina no es parámetro", (extra) => {
    expect(ListarGerentesQuerySchema.safeParse({ pagina: "1", ...extra }).success).toBe(false);
  });
});

describe("DesactivarGerenteSchema (HU-G-05)", () => {
  it("motivo recortado; vacío o con solo espacios equivale a no enviado", () => {
    expect(DesactivarGerenteSchema.parse({ version: 3, motivo: "  Dejó el centro  " })).toEqual({ version: 3, motivo: "Dejó el centro" });
    expect(DesactivarGerenteSchema.parse({ version: 3, motivo: "   " })).toEqual({ version: 3, motivo: undefined });
    expect(DesactivarGerenteSchema.parse({ version: 3, motivo: "" })).toEqual({ version: 3, motivo: undefined });
    expect(DesactivarGerenteSchema.parse({ version: 0 })).toEqual({ version: 0 });
  });

  it("motivo de 300 caracteres pasa; de 301, el mensaje del archivo central", () => {
    expect(DesactivarGerenteSchema.safeParse({ version: 0, motivo: "a".repeat(300) }).success).toBe(true);
    const r = DesactivarGerenteSchema.safeParse({ version: 0, motivo: "a".repeat(301) });
    expect(r.success).toBe(false);
    if (!r.success) expect(flattenError(r.error).fieldErrors.motivo).toEqual(["El motivo admite hasta 300 caracteres."]);
  });

  it.each([{}, { version: -1 }, { version: 1.5 }, { version: "2" }, { version: null }])("version obligatoria, entera y no negativa: %j", (cuerpo) => {
    expect(DesactivarGerenteSchema.safeParse(cuerpo).success).toBe(false);
  });

  it.each([{ activo: false }, { usuarioId: "ckotro" }, { motivoBaja: "x" }])(".strict() rechaza %j", (extra) => {
    expect(DesactivarGerenteSchema.safeParse({ version: 0, ...extra }).success).toBe(false);
  });
});

describe("ReactivarGerenteSchema (HU-G-05)", () => {
  it("solo la version", () => {
    expect(ReactivarGerenteSchema.parse({ version: 4 })).toEqual({ version: 4 });
  });

  it.each([{}, { version: -1 }, { version: 1.5 }, { version: "4" }])("version obligatoria y entera: %j", (cuerpo) => {
    expect(ReactivarGerenteSchema.safeParse(cuerpo).success).toBe(false);
  });

  it.each([{ motivo: "Vuelve" }, { activo: true }, { usuarioId: "ckotro" }])(".strict() rechaza %j (no pide motivo)", (extra) => {
    expect(ReactivarGerenteSchema.safeParse({ version: 0, ...extra }).success).toBe(false);
  });
});
