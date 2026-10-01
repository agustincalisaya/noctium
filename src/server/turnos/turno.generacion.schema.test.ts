import { describe, expect, it } from "vitest";
import { GenerarTurnosSchema } from "./turno.generacion.schema";

const valido = {
  materia_id: "materia-1",
  profesor_id: "ckprofesor000000000000001",
  horario_id: "ckhorario000000000000001",
  duracion_min: 120,
  hora_inicio: "15:30",
  aula_id: "ckaula00000000000000001",
  fecha_desde: "2026-10-01",
  fecha_hasta: "2026-10-31",
};

describe("GenerarTurnosSchema", () => {
  it.each([60, 120, 180])("acepta %i minutos y transforma fechas válidas", (duracion) => {
    const resultado = GenerarTurnosSchema.parse({ ...valido, duracion_min: duracion });
    expect(resultado.duracion_min).toBe(duracion);
    expect(resultado.fecha_desde).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });

  it.each([30, 90, 240, "60"])("rechaza duración no contractual %s", (duracion) => {
    expect(GenerarTurnosSchema.safeParse({ ...valido, duracion_min: duracion }).success).toBe(false);
  });

  it.each([
    { fecha_desde: "2026-02-30" },
    { fecha_hasta: "2026-13-01" },
    { fecha_desde: "2026-11-01" },
  ])("rechaza fechas inválidas o invertidas: %o", (cambio) => {
    expect(GenerarTurnosSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });

  it.each(["materia_id", "profesor_id", "horario_id", "hora_inicio", "aula_id", "fecha_desde", "fecha_hasta"] as const)("exige %s", (campo) => {
    const entrada = { ...valido } as Record<string, unknown>;
    delete entrada[campo];
    expect(GenerarTurnosSchema.safeParse(entrada).success).toBe(false);
  });

  it("rechaza campos extra y hora inválida", () => {
    expect(GenerarTurnosSchema.safeParse({ ...valido, turno_ids: [] }).success).toBe(false);
    expect(GenerarTurnosSchema.safeParse({ ...valido, hora_inicio: "25:00" }).success).toBe(false);
  });
});
