import { describe, expect, it } from "vitest";
import { RegistrarClaseDictadaSchema } from "./clase-dictada.schema";
describe("HU-E-09 schema HTTP", () => {
  it("permite lista vacía y normaliza ids", () => {
    expect(RegistrarClaseDictadaSchema.parse({ asistencias: [] })).toEqual({ asistencias: [] });
    expect(RegistrarClaseDictadaSchema.parse({ asistencias: [{ alumno_id: " a ", estado: "AUSENTE" }] }).asistencias[0].alumno_id).toBe("a");
  });
  it.each([{}, null, { asistencias: [{ alumno_id: "", estado: "PRESENTE" }] }, { asistencias: [{ alumno_id: "a", estado: "OTRO" }] }, { asistencias: [], otro: true }, { asistencias: [{ alumno_id: "a", estado: "PRESENTE", inscripcionId: "x" }] }, { asistencias: Array.from({ length: 501 }, () => ({ alumno_id: "a", estado: "PRESENTE" })) }])("rechaza payload fuera del contrato", (payload) => {
    expect(RegistrarClaseDictadaSchema.safeParse(payload).success).toBe(false);
  });
});

import { CorregirAsistenciaSchema, AnularClaseDictadaSchema } from "./clase-dictada.schema";
it.each(["", "   ", "x".repeat(301)])("E11 exige motivo válido: %s", motivo => {
 expect(AnularClaseDictadaSchema.safeParse({ motivo }).success).toBe(false);
 expect(CorregirAsistenciaSchema.safeParse({ motivo, asistencias: [] }).success).toBe(false);
});
it("E11 acepta motivo de 300 y rechaza campos desconocidos", () => {
 expect(AnularClaseDictadaSchema.parse({ motivo: "x".repeat(300) }).motivo.length).toBe(300);
 expect(CorregirAsistenciaSchema.safeParse({ motivo: "ok", asistencias: [], extra: true }).success).toBe(false);
});
