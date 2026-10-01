import { describe, expect, it } from "vitest";
import { DisponibilidadProfesorQuerySchema, OpcionesReprogramacionQuerySchema, ReprogramarTurnoSchema } from "./turno.schema";

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

describe("HU-C-06 ReprogramarTurnoSchema y OpcionesReprogramacionQuerySchema", () => {
  it("acepta fecha y hora de inicio", () => {
    const parsed = ReprogramarTurnoSchema.parse({ fecha: "2026-10-07", hora_inicio: "17:00" });
    expect(parsed.fecha.toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(parsed.hora_inicio).toBe("17:00");
  });

  it.each(["duracion_min", "profesor_id", "materia_id", "aula_id", "estado"])("AC5: rechaza el campo extra %s", (campo) => {
    expect(ReprogramarTurnoSchema.safeParse({ fecha: "2026-10-07", hora_inicio: "17:00", [campo]: "x" }).success).toBe(false);
  });

  it.each([
    [{ fecha: "2026-02-30", hora_inicio: "17:00" }], [{ fecha: "07/10/2026", hora_inicio: "17:00" }],
    [{ fecha: "2026-10-07", hora_inicio: "25:00" }], [{ fecha: "2026-10-07" }], [{ hora_inicio: "17:00" }], [null],
  ])("rechaza datos inválidos %j", (body) => {
    expect(ReprogramarTurnoSchema.safeParse(body).success).toBe(false);
  });

  it("la query de opciones exige una fecha válida y no admite otros parámetros", () => {
    expect(OpcionesReprogramacionQuerySchema.safeParse({ fecha: "2026-10-07" }).success).toBe(true);
    expect(OpcionesReprogramacionQuerySchema.safeParse({}).success).toBe(false);
    expect(OpcionesReprogramacionQuerySchema.safeParse({ fecha: "2026-10-07", hora: "10:00" }).success).toBe(false);
  });
});
