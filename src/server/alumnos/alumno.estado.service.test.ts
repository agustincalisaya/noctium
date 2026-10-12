import { describe, expect, it } from "vitest";
import { DesactivarAlumnoSchema, ReactivarAlumnoSchema } from "@/server/alumnos/alumno.schema";

describe("HU-B-07 contratos de estado", () => {
  it("normaliza el motivo y admite hasta 300 caracteres", () => {
    expect(DesactivarAlumnoSchema.parse({ version: 0, motivo: "  Se mudó  " })).toEqual({ version: 0, motivo: "Se mudó" });
    expect(DesactivarAlumnoSchema.parse({ version: 0, motivo: "   " })).toEqual({ version: 0, motivo: undefined });
    expect(DesactivarAlumnoSchema.safeParse({ version: 0, motivo: "x".repeat(300) }).success).toBe(true);
    expect(DesactivarAlumnoSchema.safeParse({ version: 0, motivo: "x".repeat(301) }).success).toBe(false);
  });

  it("exige versión entera no negativa y rechaza campos ajenos", () => {
    for (const input of [{}, { version: -1 }, { version: 0.5 }, { version: "0" }, { version: 0, activo: false }]) {
      expect(DesactivarAlumnoSchema.safeParse(input).success).toBe(false);
    }
    expect(ReactivarAlumnoSchema.safeParse({ version: 2 }).success).toBe(true);
    expect(ReactivarAlumnoSchema.safeParse({ version: 2, motivo: "no" }).success).toBe(false);
  });
});
