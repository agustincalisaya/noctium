import { describe, expect, it } from "vitest";
import { AnularResultadoExamenSchema, CorregirResultadoExamenSchema } from "./resultado-examen.schema";

describe("HU-E-10 esquemas de corrección y anulación", () => {
  it("acepta corrección de fecha, nota o ambas, pero siempre con motivo", () => {
    expect(CorregirResultadoExamenSchema.parse({ fecha_examen: "2026-09-27", motivo: "Fecha cargada mal" })).toEqual({
      fecha_examen: new Date("2026-09-27T00:00:00.000Z"), motivo: "Fecha cargada mal",
    });
    expect(CorregirResultadoExamenSchema.parse({ nota: "9.0", motivo: "Nota cargada mal" })).toEqual({ nota: "9.0", motivo: "Nota cargada mal" });
    expect(CorregirResultadoExamenSchema.parse({ fecha_examen: "2026-09-27", nota: "9.0", motivo: "Corrección completa" })).toMatchObject({ nota: "9.0" });
  });

  it("rechaza campos extra, corrección vacía, motivos vacíos y motivos mayores de 300", () => {
    expect(CorregirResultadoExamenSchema.safeParse({ motivo: "Sin cambio" }).success).toBe(false);
    expect(CorregirResultadoExamenSchema.safeParse({ nota: "8", motivo: " " }).success).toBe(false);
    expect(CorregirResultadoExamenSchema.safeParse({ nota: "8", motivo: "x".repeat(301) }).success).toBe(false);
    expect(CorregirResultadoExamenSchema.safeParse({ nota: "8", materia_id: "materia-2", motivo: "Cambio" }).success).toBe(false);
    expect(CorregirResultadoExamenSchema.safeParse({ fecha_examen: "2026-02-30", motivo: "Fecha inválida" }).success).toBe(false);
  });

  it("exige motivo estricto para anular", () => {
    expect(AnularResultadoExamenSchema.parse({ motivo: "Se registró al alumno equivocado" })).toEqual({ motivo: "Se registró al alumno equivocado" });
    expect(AnularResultadoExamenSchema.safeParse({ motivo: "   " }).success).toBe(false);
    expect(AnularResultadoExamenSchema.safeParse({ motivo: "x".repeat(301) }).success).toBe(false);
    expect(AnularResultadoExamenSchema.safeParse({ motivo: "Error", nota: "8" }).success).toBe(false);
  });
});
