import { describe, expect, it } from "vitest";
import { DesactivarProfesorSchema, ReactivarProfesorSchema, TurnosLoteSchema, CambiarProfesorLoteSchema, ListarTurnosFuturosBajaQuerySchema } from "@/server/profesores/profesor.schema";
import { rolPuedeAccederRuta } from "@/server/shared/rutas-por-rol";
const id = "ckturno00000000000000001";
describe("HU-D-08 contratos estrictos", () => {
  it("baja exige versión y acepta motivo normalizado hasta 300", () => {
    expect(DesactivarProfesorSchema.parse({ version: 0, motivo: "  Regresa más adelante  " }).motivo).toBe("Regresa más adelante");
    expect(DesactivarProfesorSchema.safeParse({ version: 1, motivo: "x".repeat(300) }).success).toBe(true);
    expect(DesactivarProfesorSchema.safeParse({ version: 1, motivo: "x".repeat(301) }).success).toBe(false);
    for (const input of [{}, { version: -1 }, { version: 0.5 }, { version: "0" }, { version: 0, activo: false }]) expect(DesactivarProfesorSchema.safeParse(input).success).toBe(false);
  });
  it("reactivar no admite motivo ni cambios de ficha", () => {
    expect(ReactivarProfesorSchema.safeParse({ version: 2 }).success).toBe(true);
    expect(ReactivarProfesorSchema.safeParse({ version: 2, motivo: "" }).success).toBe(false);
  });
  it("lotes no admiten vacíos, ids repetidos, 101 ids ni campos ajenos", () => {
    expect(TurnosLoteSchema.safeParse({ turno_ids: [id] }).success).toBe(true);
    expect(TurnosLoteSchema.safeParse({ turno_ids: ["seed-turno-01"] }).success).toBe(true);
    for (const turno_ids of [[], [id, id], ["   "], Array.from({ length: 101 }, (_, n) => `ckturno${n.toString().padStart(19, "0")}`)]) expect(TurnosLoteSchema.safeParse({ turno_ids }).success).toBe(false);
    expect(CambiarProfesorLoteSchema.safeParse({ turno_ids: [id] }).success).toBe(false);
    expect(TurnosLoteSchema.safeParse({ turno_ids: [id], usuario_id: id }).success).toBe(false);
  });
  it("página y filtro válidos; tamaño de página fijo", () => {
    expect(ListarTurnosFuturosBajaQuerySchema.parse({})).toEqual({ pagina: 1 });
    expect(ListarTurnosFuturosBajaQuerySchema.parse({ pagina: "2" })).toEqual({ pagina: 2 });
    expect(ListarTurnosFuturosBajaQuerySchema.safeParse({ por_pagina: 100 }).success).toBe(false);
  });
});
describe("HU-D-08 acceso de consulta", () => {
  it.each(["/profesores", "/profesores/abc"])("Gerente accede a %s", (ruta) => { expect(rolPuedeAccederRuta("GERENTE", ruta)).toBe(true); });
  it.each(["/profesores/nuevo", "/profesores/horarios/nuevo", "/profesores/abc/contacto", "/profesores/abc/materias"])("Gerente no accede a %s", (ruta) => { expect(rolPuedeAccederRuta("GERENTE", ruta)).toBe(false); expect(rolPuedeAccederRuta("MESA_ENTRADA", ruta)).toBe(true); });
  it.each(["PROFESOR", "ALUMNO"] as const)("%s no consulta profesores", (rol) => { expect(rolPuedeAccederRuta(rol, "/profesores/abc")).toBe(false); });
});
