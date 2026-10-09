import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conReloj } from "@/server/shared/reloj";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { parametroSistema: { findMany } } }));

const { calcularTopeReprogramacion, parametrosConfiguracionTurno, validarConfiguracionTurno, validarDiaReprogramable, validarFechaHoraTurno } = await import("./turno.validaciones");
const MATERIA = "ckmateria0000000000000001";
// Jueves, día operativo, dentro de la anticipación máxima.
const configuracion = (hora_inicio: string, duracion_min: number) => ({ fecha: new Date("2026-10-01T00:00:00.000Z"), hora_inicio, materia_id: MATERIA, duracion_min });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T15:00:00.000Z"));
  findMany.mockResolvedValue([
    { clave: "horario_operativo_desde", valor: "08:00" },
    { clave: "horario_operativo_hasta", valor: "20:00" },
    { clave: "granularidad_turno_minutos", valor: "30" },
    { clave: "dias_operativos", valor: "LUNES,MARTES,MIERCOLES,JUEVES,VIERNES" },
    { clave: "anticipacion_maxima_dias", valor: "30" },
  ]);
});
afterEach(() => { vi.useRealTimers(); });

describe("HU-C-03 parametrosConfiguracionTurno (Revisión 4)", () => {
  it("expone las duraciones permitidas en vez de una duración estándar", async () => {
    const parametros = await parametrosConfiguracionTurno();
    expect(parametros.duraciones_permitidas_minutos).toEqual([60, 120, 180]);
    expect(parametros).not.toHaveProperty("duracion_minutos");
    expect(findMany.mock.calls[0]![0].where.clave.in).not.toContain("duracion_turno_estandar_minutos");
  });
});

describe("HU-C-03 validarConfiguracionTurno con duración variable (Revisión 4)", () => {
  it.each([[60, "11:00"], [120, "12:00"], [180, "13:00"]])("con %i minutos calcula hora_fin %s", async (duracion, horaFin) => {
    await expect(validarConfiguracionTurno(configuracion("10:00", duracion))).resolves.toEqual({ fecha: "2026-10-01", hora_fin: horaFin, duracion_min: duracion });
  });

  it("cerca del cierre acepta 1h y 2h que terminan hasta las 20:00", async () => {
    await expect(validarConfiguracionTurno(configuracion("18:00", 60))).resolves.toMatchObject({ hora_fin: "19:00" });
    await expect(validarConfiguracionTurno(configuracion("18:00", 120))).resolves.toMatchObject({ hora_fin: "20:00" });
  });

  it("cerca del cierre rechaza una franja de 2h/3h que no entra, aunque la de 1h con la misma hora sí entre", async () => {
    await expect(validarConfiguracionTurno(configuracion("18:30", 60))).resolves.toMatchObject({ hora_fin: "19:30" });
    await expect(validarConfiguracionTurno(configuracion("18:30", 120))).rejects.toMatchObject({ code: "FUERA_DE_HORARIO_OPERATIVO" });
    await expect(validarConfiguracionTurno(configuracion("18:00", 180))).rejects.toMatchObject({ code: "FUERA_DE_HORARIO_OPERATIVO" });
  });

  it("revalida la duración en el servicio (defensa en profundidad)", async () => {
    await expect(validarConfiguracionTurno(configuracion("10:00", 90))).rejects.toMatchObject({ code: "DURACION_NO_PERMITIDA" });
  });
});

const { turnoNoHaComenzado, turnoSigueVigente } = await import("./turno.validaciones");

describe("spec C §2.15 turnoNoHaComenzado (fecha + hora_inicio >= ahora, a minuto, Buenos Aires)", () => {
  // Turno del 01/10/2026 a las 10:00 locales = 13:00 UTC (UTC-3, sin horario de verano).
  const fecha = new Date("2026-10-01T00:00:00.000Z");
  const horaInicio = new Date("1970-01-01T10:00:00.000Z");

  it.each([
    ["1 minuto antes del inicio", "2026-10-01T12:59:00.000Z", true, true],
    ["el mismo minuto del inicio", "2026-10-01T13:00:00.000Z", true, false],
    ["el mismo minuto, a los 59 segundos", "2026-10-01T13:00:59.999Z", true, false],
    ["1 minuto después del inicio", "2026-10-01T13:01:00.000Z", false, false],
  ])("%s: no comenzó = %s; turnoSigueVigente sigue estricto = %s", (_caso, ahora, noComenzo, vigente) => {
    vi.setSystemTime(new Date(ahora));
    expect(turnoNoHaComenzado(fecha, horaInicio)).toBe(noComenzo);
    expect(turnoSigueVigente(fecha, horaInicio)).toBe(vigente);
  });

  it("compara contra la fecha local y no la UTC al cruzar la medianoche", () => {
    // 01/10 00:30 UTC = 30/09 21:30 en Buenos Aires: un turno del 30/09 a las 21:30 no comenzó.
    vi.setSystemTime(new Date("2026-10-01T00:30:00.000Z"));
    expect(turnoNoHaComenzado(new Date("2026-09-30T00:00:00.000Z"), new Date("1970-01-01T21:30:00.000Z"))).toBe(true);
    expect(turnoNoHaComenzado(new Date("2026-09-30T00:00:00.000Z"), new Date("1970-01-01T21:29:00.000Z"))).toBe(false);
  });
});

describe("HU-C-06 tope de reprogramación (N-4) y validaciones compartidas", () => {
  const fecha = (valor: string) => new Date(`${valor}T00:00:00.000Z`);

  it("el tope es max(fecha actual del turno, hoy + anticipación)", async () => {
    const parametros = await parametrosConfiguracionTurno();
    expect(calcularTopeReprogramacion(fecha("2026-09-30"), parametros).toISOString().slice(0, 10)).toBe("2026-10-24");
    expect(calcularTopeReprogramacion(fecha("2027-02-23"), parametros).toISOString().slice(0, 10)).toBe("2027-02-23");
  });

  it("sin tope explícito rige hoy + anticipación (comportamiento de HU-C-03 intacto)", async () => {
    await expect(validarFechaHoraTurno({ fecha: fecha("2026-10-26"), hora_inicio: "10:00", duracion_min: 60 })).rejects.toMatchObject({ code: "ANTICIPACION_EXCEDIDA", message: "La fecha no puede superar 30 días de anticipación" });
  });

  it("con el tope N-4 admite la fecha actual del turno aunque supere hoy + anticipación, y rechaza el día siguiente", async () => {
    const topeFecha = fecha("2027-02-23");
    await expect(validarFechaHoraTurno({ fecha: fecha("2027-02-23"), hora_inicio: "10:00", duracion_min: 60 }, { topeFecha })).resolves.toMatchObject({ fecha: "2027-02-23", hora_fin: "11:00" });
    await expect(validarFechaHoraTurno({ fecha: fecha("2027-02-24"), hora_inicio: "10:00", duracion_min: 60 }, { topeFecha })).rejects.toMatchObject({ code: "ANTICIPACION_EXCEDIDA", message: "La fecha no puede ser posterior al 23/02/2027" });
  });

  it("validación a nivel de día para las opciones", async () => {
    const parametros = await parametrosConfiguracionTurno();
    const tope = fecha("2026-10-24");
    expect(() => validarDiaReprogramable(fecha("2026-09-24"), tope, parametros)).not.toThrow();
    expect(() => validarDiaReprogramable(fecha("2026-09-23"), tope, parametros)).toThrow(expect.objectContaining({ code: "FECHA_PASADA" }));
    expect(() => validarDiaReprogramable(fecha("2026-09-26"), tope, parametros)).toThrow(expect.objectContaining({ code: "DIA_NO_OPERATIVO" }));
    expect(() => validarDiaReprogramable(fecha("2026-10-26"), tope, parametros)).toThrow(expect.objectContaining({ code: "ANTICIPACION_EXCEDIDA" }));
  });
});


describe("fixtures históricos con reloj de dominio (PR 0)", () => {
  it("valida con el contexto inyectado y conserva la fecha real fuera de él", async () => {
    const historico = { fecha: new Date("2024-10-03T00:00:00.000Z"), hora_inicio: "10:00", duracion_min: 60 };
    await conReloj(new Date("2024-10-01T12:00:00.000Z"), async () => {
      await expect(validarFechaHoraTurno(historico)).resolves.toMatchObject({ fecha: "2024-10-03", hora_fin: "11:00" });
      expect(turnoSigueVigente(historico.fecha, new Date("1970-01-01T10:00:00.000Z"))).toBe(true);
      const parametros = await parametrosConfiguracionTurno();
      expect(calcularTopeReprogramacion(historico.fecha, parametros).toISOString().slice(0, 10)).toBe("2024-10-31");
      expect(() => validarDiaReprogramable(historico.fecha, new Date("2024-10-31T00:00:00.000Z"), parametros)).not.toThrow();
    });
    await expect(validarFechaHoraTurno(historico)).rejects.toMatchObject({ code: "FECHA_PASADA" });
  });
});
