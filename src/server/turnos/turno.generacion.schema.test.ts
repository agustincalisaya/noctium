import { describe, expect, it } from "vitest";
import { GenerarTurnosSchema, VistaPreviaGeneracionSchema } from "./turno.generacion.schema";

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

describe("HU-C-21: listas opcionales y resolver_automaticamente", () => {
  const aulaOtra = "ckaula00000000000000002";
  const schemas = [["confirmación", GenerarTurnosSchema], ["vista previa", VistaPreviaGeneracionSchema]] as const;

  it.each(schemas)("%s: el pedido de Sprint 2 sin campos nuevos sigue siendo válido y no suma claves", (_nombre, schema) => {
    const resultado = schema.parse(valido);
    expect(Object.keys(resultado).sort()).toEqual(Object.keys(valido).sort());
  });

  it.each(schemas)("%s: acepta listas válidas y transforma sus fechas", (_nombre, schema) => {
    const resultado = schema.parse({ ...valido, aulas_por_fecha: [{ fecha: "2026-10-08", aula_id: aulaOtra }], fechas_excluidas: ["2026-10-15"] });
    expect(resultado.aulas_por_fecha).toEqual([{ fecha: new Date("2026-10-08T00:00:00.000Z"), aula_id: aulaOtra }]);
    expect(resultado.fechas_excluidas).toEqual([new Date("2026-10-15T00:00:00.000Z")]);
  });

  it.each(schemas)("%s: rechaza fecha repetida en aulas_por_fecha", (_nombre, schema) => {
    const resultado = schema.safeParse({ ...valido, aulas_por_fecha: [{ fecha: "2026-10-08", aula_id: aulaOtra }, { fecha: "2026-10-08", aula_id: valido.aula_id }] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["aulas_por_fecha", 1, "fecha"]);
  });

  it.each(schemas)("%s: rechaza fecha repetida en fechas_excluidas", (_nombre, schema) => {
    const resultado = schema.safeParse({ ...valido, fechas_excluidas: ["2026-10-15", "2026-10-15"] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["fechas_excluidas", 1]);
  });

  it.each(schemas)("%s: rechaza una fecha que está en las dos listas", (_nombre, schema) => {
    const resultado = schema.safeParse({ ...valido, aulas_por_fecha: [{ fecha: "2026-10-08", aula_id: aulaOtra }], fechas_excluidas: ["2026-10-08"] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["fechas_excluidas", 0]);
  });

  it.each(schemas)("%s: rechaza aula_id inválido, campos extra y fecha inválida dentro de las listas", (_nombre, schema) => {
    expect(schema.safeParse({ ...valido, aulas_por_fecha: [{ fecha: "2026-10-08", aula_id: "no es cuid" }] }).success).toBe(false);
    expect(schema.safeParse({ ...valido, aulas_por_fecha: [{ fecha: "2026-10-08", aula_id: aulaOtra, cupo: 3 }] }).success).toBe(false);
    expect(schema.safeParse({ ...valido, fechas_excluidas: ["2026-02-30"] }).success).toBe(false);
  });

  it.each(schemas)("%s: limita cada lista a 40 fechas como tope defensivo", (_nombre, schema) => {
    const fechas = Array.from({ length: 41 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
    expect(schema.safeParse({ ...valido, fechas_excluidas: fechas }).success).toBe(false);
    expect(schema.safeParse({ ...valido, fechas_excluidas: fechas.slice(0, 40) }).success).toBe(true);
  });

  it.each(schemas)("%s: conserva mensaje y path del rango invertido", (_nombre, schema) => {
    const resultado = schema.safeParse({ ...valido, fecha_desde: "2026-11-01" });
    expect(resultado.error?.issues).toEqual([expect.objectContaining({ path: ["fecha_hasta"], message: "La fecha hasta debe ser posterior o igual a la fecha desde" })]);
  });

  it("resolver_automaticamente se acepta en la vista previa y se rechaza en la confirmación", () => {
    expect(VistaPreviaGeneracionSchema.parse({ ...valido, resolver_automaticamente: true }).resolver_automaticamente).toBe(true);
    expect(GenerarTurnosSchema.safeParse({ ...valido, resolver_automaticamente: true }).success).toBe(false);
    expect(VistaPreviaGeneracionSchema.safeParse({ ...valido, resolver_automaticamente: "si" }).success).toBe(false);
  });
});
