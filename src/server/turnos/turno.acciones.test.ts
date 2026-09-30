import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { calcularAccionesHabilitadas, turnoYaTermino } = await import("./turno.acciones");
const { turnoSigueVigente } = await import("./turno.validaciones");

// Turno del martes 06/10/2026 de 16:00 a 17:00 (hora de Buenos Aires, UTC-3).
const FECHA = new Date("2026-10-06T00:00:00.000Z");
const INICIO = new Date("1970-01-01T16:00:00.000Z");
const instante = (horaLocal: string) => new Date(`2026-10-06T${horaLocal}:00.000-03:00`);

const TODAS = { cancelar: true, reprogramar: true, priorizar: true, registrarPago: true, registrarClase: true };
const NINGUNA = { cancelar: false, reprogramar: false, priorizar: false, registrarPago: false, registrarClase: false };

type Entrada = Parameters<typeof calcularAccionesHabilitadas>[0];
const entrada = (cambios: Partial<Entrada> = {}): Entrada => ({
  estado: "DISPONIBLE", fecha: FECHA, horaInicio: INICIO, duracionMinutos: 60, cantidadAlumnos: 2,
  rol: "MESA_ENTRADA", turnoPropio: false, tieneClaseDictada: false, capacidades: TODAS, ahora: instante("12:00"),
  ...cambios,
});
const acciones = (cambios: Partial<Entrada> = {}) => calcularAccionesHabilitadas(entrada(cambios));

afterEach(() => vi.useRealTimers());

describe("turnoSigueVigente con `ahora` (inicio futuro estricto, a precisión de minuto)", () => {
  it.each([["15:59", true], ["16:00", false], ["16:01", false]])("a las %s → %s", (hora, esperado) => {
    expect(turnoSigueVigente(FECHA, INICIO, instante(hora))).toBe(esperado);
  });

  it("sin `ahora` conserva el comportamiento anterior: usa la hora actual", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instante("15:59"));
    expect(turnoSigueVigente(FECHA, INICIO)).toBe(true);
    vi.setSystemTime(instante("16:00"));
    expect(turnoSigueVigente(FECHA, INICIO)).toBe(false);
  });
});

describe("turnoYaTermino (fecha + hora_fin <= ahora, Buenos Aires)", () => {
  it.each([["16:59", false], ["17:00", true], ["17:01", true]])("fin 17:00, a las %s → %s", (hora, esperado) => {
    expect(turnoYaTermino(FECHA, INICIO, 60, instante(hora))).toBe(esperado);
  });

  it("respeta la duración elegida (2 horas terminan a las 18:00)", () => {
    expect(turnoYaTermino(FECHA, INICIO, 120, instante("17:59"))).toBe(false);
    expect(turnoYaTermino(FECHA, INICIO, 120, instante("18:00"))).toBe(true);
  });

  it("un turno que cruza la medianoche termina al día siguiente", () => {
    const tarde = new Date("1970-01-01T23:00:00.000Z");
    expect(turnoYaTermino(FECHA, tarde, 120, new Date("2026-10-07T00:59:00.000-03:00"))).toBe(false);
    expect(turnoYaTermino(FECHA, tarde, 120, new Date("2026-10-07T01:00:00.000-03:00"))).toBe(true);
  });

  it("un día anterior o posterior se compara por fecha antes que por hora", () => {
    expect(turnoYaTermino(FECHA, INICIO, 60, new Date("2026-10-05T23:59:00.000-03:00"))).toBe(false);
    expect(turnoYaTermino(FECHA, INICIO, 60, new Date("2026-10-07T00:00:00.000-03:00"))).toBe(true);
  });
});

describe("calcularAccionesHabilitadas (spec_modulo_C.md §2.4 y §3.8)", () => {
  it("devuelve las elegibles en el orden fijo", () => {
    expect(acciones({ ahora: instante("17:00") })).toEqual(["prioridad", "registrar_pago", "registrar_clase"]);
    expect(acciones()).toEqual(["cancelar", "reprogramar", "prioridad", "registrar_pago"]);
  });

  it.each(["DISPONIBLE", "COMPLETO"] as const)("cancelar y reprogramar en %s solo con el inicio futuro estricto", (estado) => {
    expect(acciones({ estado, ahora: instante("15:59") })).toEqual(expect.arrayContaining(["cancelar", "reprogramar"]));
    expect(acciones({ estado, ahora: instante("16:00") })).not.toContain("cancelar");
    expect(acciones({ estado, ahora: instante("16:00") })).not.toContain("reprogramar");
    expect(acciones({ estado, ahora: instante("16:01") })).toEqual(["prioridad", "registrar_pago"]);
  });

  it("un PENDIENTE nunca ofrece cancelar: ofrece descartar, incluso vencido, y prioridad", () => {
    expect(acciones({ estado: "PENDIENTE", ahora: instante("15:59") })).toEqual(["descartar", "prioridad"]);
    expect(acciones({ estado: "PENDIENTE", ahora: instante("18:00") })).toEqual(["descartar", "prioridad"]);
  });

  it("prioridad y registrar pago se admiten con el turno vencido", () => {
    expect(acciones({ ahora: instante("16:30") })).toEqual(["prioridad", "registrar_pago"]);
  });

  it("registrar pago exige al menos un alumno inscripto", () => {
    expect(acciones({ cantidadAlumnos: 0 })).not.toContain("registrar_pago");
    expect(acciones({ cantidadAlumnos: 1 })).toContain("registrar_pago");
  });

  it.each([["16:59", false], ["17:00", true], ["17:01", true]])("registrar clase desde la hora de fin: a las %s → %s", (hora, esperado) => {
    expect(acciones({ ahora: instante(hora) }).includes("registrar_clase")).toBe(esperado);
  });

  it("registrar clase no se ofrece si ya hay clase o si todavía no se sabe (hito 2)", () => {
    expect(acciones({ ahora: instante("18:00"), tieneClaseDictada: true })).not.toContain("registrar_clase");
    expect(acciones({ ahora: instante("18:00"), tieneClaseDictada: null })).not.toContain("registrar_clase");
  });

  it("el Profesor registra la clase solo en su propio turno", () => {
    const profesor = { rol: "PROFESOR" as const, capacidades: { ...NINGUNA, registrarClase: true }, ahora: instante("18:00") };
    expect(acciones({ ...profesor, turnoPropio: true })).toEqual(["registrar_clase"]);
    expect(acciones({ ...profesor, turnoPropio: false })).toEqual([]);
  });

  it("registrar clase no aplica a un PENDIENTE", () => {
    expect(acciones({ estado: "PENDIENTE", ahora: instante("18:00") })).not.toContain("registrar_clase");
  });

  it.each([["15:59"], ["18:00"]])("un turno CANCELADO no tiene ninguna acción (a las %s)", (hora) => {
    expect(acciones({ estado: "CANCELADO", ahora: instante(hora) })).toEqual([]);
  });

  it("el Gerente, sin permisos de acción, recibe []", () => {
    expect(acciones({ rol: "GERENTE", capacidades: NINGUNA, ahora: instante("15:59") })).toEqual([]);
    expect(acciones({ rol: "GERENTE", capacidades: NINGUNA, ahora: instante("18:00") })).toEqual([]);
  });

  it("cada acción depende de su permiso", () => {
    const sin = (permiso: keyof typeof TODAS) => acciones({ capacidades: { ...TODAS, [permiso]: false }, ahora: instante("15:59") });
    expect(sin("cancelar")).not.toContain("cancelar");
    expect(acciones({ estado: "PENDIENTE", capacidades: { ...TODAS, cancelar: false } })).not.toContain("descartar");
    expect(sin("reprogramar")).not.toContain("reprogramar");
    expect(sin("priorizar")).not.toContain("prioridad");
    expect(sin("registrarPago")).not.toContain("registrar_pago");
    expect(acciones({ capacidades: { ...TODAS, registrarClase: false }, ahora: instante("18:00") })).not.toContain("registrar_clase");
  });
});
