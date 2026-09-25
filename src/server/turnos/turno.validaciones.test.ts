import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { parametroSistema: { findMany } } }));

const { parametrosConfiguracionTurno, validarConfiguracionTurno } = await import("./turno.validaciones");
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
