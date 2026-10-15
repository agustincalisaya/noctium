import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { texto } from "@/lib/textos";
import { GuardarConfiguracionSchema, ListarHistorialQuerySchema } from "@/server/configuracion/configuracion.schema";
import { CATALOGO, CLAVES_CONFIGURABLES } from "@/server/configuracion/parametros-configurables";
import { rolPuedeAccederRuta } from "@/server/shared/rutas-por-rol";

const valores = { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 };
const payload = { valores, esperados: valores };

describe("HU-N-01 schemas", () => {
  it("catálogo coincide con migración, seed y helper compartido vigentes", () => {
    const migracion = readFileSync(resolve("prisma/migrations/20261008120100_sprint3_modelo/migration.sql"), "utf8");
    const seed = readFileSync(resolve("prisma/seed.ts"), "utf8");
    const helper = readFileSync(resolve("src/server/shared/parametros-vigentes.ts"), "utf8");
    for (const clave of CLAVES_CONFIGURABLES) {
      const { campo, porDefecto } = CATALOGO[clave];
      expect(migracion).toContain(`('${clave}', '${porDefecto}')`);
      expect(seed).toContain(`${clave}: "${porDefecto}"`);
      expect(helper).toContain(`${campo}: ["${clave}", ${porDefecto}]`);
    }
    expect(seed).toContain("update: {},");
  });
  it("acepta defectos y ambos bordes enteros", () => {
    expect(GuardarConfiguracionSchema.safeParse(payload).success).toBe(true);
    expect(GuardarConfiguracionSchema.safeParse({ valores: { plazoPagoHoras: 1, cancelacionAnticipacionHoras: 72, umbralPresentismo: 100 }, esperados: { plazoPagoHoras: 72, cancelacionAnticipacionHoras: 1, umbralPresentismo: 1 } }).success).toBe(true);
  });

  it.each([
    { valores: { ...valores, plazoPagoHoras: 0 } },
    { valores: { ...valores, cancelacionAnticipacionHoras: 73 } },
    { valores: { ...valores, umbralPresentismo: 101 } },
    { valores: { ...valores, plazoPagoHoras: 1.5 } },
    { valores: { ...valores, plazoPagoHoras: "24" } },
    { valores: { ...valores, umbralPresentismo: "" } },
    { valores: { plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24 } },
    { valores: { ...valores, centro_nombre: "Otro" } },
    { esperados: { ...valores, umbralPresentismo: 0 } },
    { esperados: { ...valores, centro_nombre: "Otro" } },
  ])("rechaza payload inválido %j", (cambio) => {
    expect(GuardarConfiguracionSchema.safeParse({ ...payload, ...cambio }).success).toBe(false);
  });

  it("los errores de cada campo usan los textos de la pantalla", () => {
    const mensaje = (cambio: Record<string, unknown>) => {
      const r = GuardarConfiguracionSchema.safeParse({ ...payload, valores: { ...valores, ...cambio } });
      return r.success ? null : r.error.issues[0]?.message;
    };
    expect(mensaje({ plazoPagoHoras: 73 })).toBe(texto("ui.configuracion.fueraDeRango", { min: 1, max: 72 }));
    expect(mensaje({ umbralPresentismo: 0 })).toBe(texto("ui.configuracion.fueraDeRango", { min: 1, max: 100 }));
    expect(mensaje({ plazoPagoHoras: 1.5 })).toBe(texto("ui.configuracion.enteroRequerido"));
    expect(mensaje({ plazoPagoHoras: "24" })).toBe(texto("ui.configuracion.enteroRequerido"));
  });

  it("requiere esperados y rechaza claves ajenas arriba", () => {
    expect(GuardarConfiguracionSchema.safeParse({ valores }).success).toBe(false);
    expect(GuardarConfiguracionSchema.safeParse({ ...payload, extra: 1 }).success).toBe(false);
  });

  it("pagina desde 1 por defecto y rechaza parámetros adicionales o inválidos", () => {
    expect(ListarHistorialQuerySchema.parse({})).toEqual({ pagina: 1 });
    expect(ListarHistorialQuerySchema.parse({ pagina: "2" })).toEqual({ pagina: 2 });
    for (const query of [{ pagina: "0" }, { pagina: "1.5" }, { pagina: "" }, { pagina: "a" }, { foo: "" }]) {
      expect(ListarHistorialQuerySchema.safeParse(query).success).toBe(false);
    }
  });

  it("el guard de ruta admite solo Gerente", () => {
    expect(rolPuedeAccederRuta("GERENTE", "/configuracion")).toBe(true);
    for (const rol of ["MESA_ENTRADA", "PROFESOR", "ALUMNO"] as const) {
      expect(rolPuedeAccederRuta(rol, "/configuracion")).toBe(false);
    }
  });
});
