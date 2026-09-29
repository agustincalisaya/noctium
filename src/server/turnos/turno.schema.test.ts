import { describe, expect, it } from "vitest";
import { DisponibilidadProfesorQuerySchema } from "./turno.schema";

const base = { materia_id: " ckmateria0000000000000001 ", duracion_min: "120" };

describe("HU-C-07 DisponibilidadProfesorQuerySchema", () => {
  it("exige materia_id y duración, coerciona la duración y deja las fechas opcionales", () => {
    expect(DisponibilidadProfesorQuerySchema.parse(base)).toEqual({
      materia_id: "ckmateria0000000000000001", duracion_min: 120,
    });
    expect(DisponibilidadProfesorQuerySchema.safeParse({ duracion_min: "60" }).success).toBe(false);
    expect(DisponibilidadProfesorQuerySchema.safeParse({ materia_id: "  ", duracion_min: "60" }).success).toBe(false);
    expect(DisponibilidadProfesorQuerySchema.safeParse({ materia_id: base.materia_id }).success).toBe(false);
  });

  it.each(["60", "120", "180"])("admite la duración permitida %s", (duracion_min) => {
    expect(DisponibilidadProfesorQuerySchema.parse({ ...base, duracion_min }).duracion_min).toBe(Number(duracion_min));
  });

  it.each(["0", "90", "240", "60.5", "abc"])("rechaza la duración no permitida %s", (duracion_min) => {
    expect(DisponibilidadProfesorQuerySchema.safeParse({ ...base, duracion_min }).success).toBe(false);
  });

  it("reutiliza la validación estricta de fechas y devuelve fechas calendario UTC", () => {
    expect(DisponibilidadProfesorQuerySchema.parse({ ...base, desde: "2026-09-29", hasta: "2026-10-28" }))
      .toEqual({ materia_id: "ckmateria0000000000000001", duracion_min: 120,
        desde: new Date("2026-09-29T00:00:00.000Z"), hasta: new Date("2026-10-28T00:00:00.000Z") });
    expect(DisponibilidadProfesorQuerySchema.safeParse({ ...base, desde: "2026-02-30" }).success).toBe(false);
    expect(DisponibilidadProfesorQuerySchema.safeParse({ ...base, hasta: "2026-13-01" }).success).toBe(false);
  });
});
