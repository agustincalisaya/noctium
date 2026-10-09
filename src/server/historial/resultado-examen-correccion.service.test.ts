import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    correccionResultadoExamen: { findFirst: vi.fn(), create: vi.fn() },
    anulacionResultadoExamen: { findUnique: vi.fn(), create: vi.fn() },
  },
  transaccion: vi.fn(), profesor: vi.fn(), email: vi.fn(), parametro: vi.fn(), now: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (callback: (tx: typeof m.tx) => unknown) => m.transaccion(callback) }));
vi.mock("@/server/shared/reloj", () => ({ ahora: () => m.now() }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: m.profesor }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: m.email }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: m.parametro }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ verificarAlumnoActivo: vi.fn() }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: vi.fn() }));
vi.mock("./historial.publico", () => ({ profesorAtendioAlumno: vi.fn() }));
const { corregirResultadoExamen, anularResultadoExamen } = await import("./resultado-examen.service");

const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };
const profesor = { id: "prof-user", rol: "PROFESOR" as const };
const fechaOriginal = new Date("2026-09-27T00:00:00.000Z");
const momentoDentroDePlazo = new Date("2026-10-16T14:30:00.000Z");
const crearResultado = () => ({
  idResultadoExamen: "examen-1", alumnoId: "alumno-1", materiaId: "materia-1",
  fechaExamen: fechaOriginal, notaExamen: new Prisma.Decimal("8.5"),
  createdAtResultadoExamen: new Date("2026-10-09T15:00:00.000Z"), creadoPorUsuarioId: "prof-user",
});

beforeEach(() => {
  vi.clearAllMocks();
  m.now.mockReturnValue(momentoDentroDePlazo);
  m.transaccion.mockImplementation((callback: (tx: typeof m.tx) => unknown) => callback(m.tx));
  m.profesor.mockResolvedValue({ id: "profesor-1" });
  m.email.mockResolvedValue("mesa@noctium.local");
  m.parametro.mockImplementation((nombre: string) => Promise.resolve(nombre === "nota_minima" ? 1 : 10));
  m.tx.$queryRaw.mockResolvedValue([crearResultado()]);
  m.tx.correccionResultadoExamen.findFirst.mockResolvedValue(null);
  m.tx.correccionResultadoExamen.create.mockResolvedValue({ idCorreccionResultado: "correccion-1" });
  m.tx.anulacionResultadoExamen.findUnique.mockResolvedValue(null);
  m.tx.anulacionResultadoExamen.create.mockResolvedValue({ idAnulacionResultado: "anulacion-1" });
});

describe("HU-E-10 corregirResultadoExamen", () => {
  it("bloquea el original y crea una corrección compensatoria con valor anterior y auditoría", async () => {
    m.email.mockResolvedValue("profesor1@noctium.local");
    await expect(corregirResultadoExamen("alumno-1", "examen-1", { nota: "9", motivo: "La nota se cargó mal" }, profesor)).resolves.toEqual({
      id: "correccion-1", resultado_id: "examen-1", alumno_id: "alumno-1", materia_id: "materia-1",
      fecha_examen: "2026-09-27", nota: "9.0", fecha_anterior: "2026-09-27", nota_anterior: "8.5",
      motivo: "La nota se cargó mal", registrada_en: momentoDentroDePlazo.toISOString(), registrada_por: "profesor1@noctium.local",
    });
    expect(m.tx.$queryRaw.mock.calls[0]?.[0].join("")).toContain("FOR UPDATE");
    expect(m.tx.correccionResultadoExamen.findFirst).toHaveBeenCalledWith({
      where: { resultadoExamenId: "examen-1" },
      orderBy: [{ createdAtCorreccion: "desc" }, { idCorreccionResultado: "desc" }],
      select: { fechaNueva: true, notaNueva: true },
    });
    expect(m.tx.correccionResultadoExamen.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      resultadoExamenId: "examen-1", fechaAnterior: fechaOriginal, notaAnterior: new Prisma.Decimal("8.5"),
      fechaNueva: fechaOriginal, notaNueva: new Prisma.Decimal("9"), motivo: "La nota se cargó mal", creadoPorUsuarioId: "prof-user",
    }), select: { idCorreccionResultado: true } });
    expect(crearResultado().notaExamen.toFixed(1)).toBe("8.5");
  });

  it("usa la última corrección como valor anterior y permite al Profesor corregir en el séptimo día", async () => {
    m.tx.correccionResultadoExamen.findFirst.mockResolvedValue({ fechaNueva: new Date("2026-09-28T00:00:00.000Z"), notaNueva: new Prisma.Decimal("8.9") });
    const fechaNueva = new Date("2026-09-29T00:00:00.000Z");
    await corregirResultadoExamen("alumno-1", "examen-1", { fecha_examen: fechaNueva, motivo: "Fecha corregida" }, profesor);
    expect(m.tx.correccionResultadoExamen.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      fechaAnterior: new Date("2026-09-28T00:00:00.000Z"), notaAnterior: new Prisma.Decimal("8.9"),
      fechaNueva, notaNueva: new Prisma.Decimal("8.9"),
    }), select: { idCorreccionResultado: true } });
  });

  it("deniega al Profesor después del día 7 y si el examen no es suyo", async () => {
    m.now.mockReturnValue(new Date("2026-10-17T14:30:00.000Z"));
    await expect(corregirResultadoExamen("alumno-1", "examen-1", { nota: "9", motivo: "Cambio" }, profesor)).rejects.toMatchObject({ code: "PLAZO_CORRECCION_VENCIDO" });
    m.now.mockReturnValue(momentoDentroDePlazo);
    await expect(corregirResultadoExamen("alumno-1", "examen-1", { nota: "9", motivo: "Cambio" }, { id: "otro-user", rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(m.tx.correccionResultadoExamen.create).not.toHaveBeenCalled();
  });

  it("oculta un resultado inexistente al Profesor y devuelve 404 a Mesa", async () => {
    m.tx.$queryRaw.mockResolvedValue([]);
    await expect(corregirResultadoExamen("alumno-1", "id-no-cuid", { nota: "9", motivo: "Cambio" }, mesa)).rejects.toMatchObject({ code: "RESULTADO_NO_ENCONTRADO" });
    await expect(corregirResultadoExamen("alumno-1", "id-no-cuid", { nota: "9", motivo: "Cambio" }, profesor)).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });

  it("rechaza examen anulado, sin cambios, fecha futura y nota fuera de escala", async () => {
    m.tx.anulacionResultadoExamen.findUnique.mockResolvedValue({ idAnulacionResultado: "anulacion-1" });
    await expect(corregirResultadoExamen("alumno-1", "examen-1", { nota: "9", motivo: "Cambio" }, mesa)).rejects.toMatchObject({ code: "RESULTADO_ANULADO" });
    m.tx.anulacionResultadoExamen.findUnique.mockResolvedValue(null);
    await expect(corregirResultadoExamen("alumno-1", "examen-1", { nota: "8.5", motivo: "Mismo valor" }, mesa)).rejects.toMatchObject({ code: "CORRECCION_SIN_CAMBIOS" });
    await expect(corregirResultadoExamen("alumno-1", "examen-1", { fecha_examen: new Date("2999-01-01T00:00:00.000Z"), motivo: "Fecha futura" }, mesa)).rejects.toMatchObject({ code: "FECHA_EXAMEN_FUTURA" });
    await expect(corregirResultadoExamen("alumno-1", "examen-1", { nota: "11", motivo: "Fuera de escala" }, mesa)).rejects.toMatchObject({ code: "NOTA_FUERA_DE_RANGO" });
    expect(m.tx.correccionResultadoExamen.create).not.toHaveBeenCalled();
  });
});

describe("HU-E-10 anularResultadoExamen", () => {
  it("crea una anulación inmutable con motivo, actor y fecha; Mesa no tiene plazo", async () => {
    await expect(anularResultadoExamen("alumno-1", "examen-1", { motivo: "Se cargó a otro alumno" }, mesa)).resolves.toEqual({
      id: "anulacion-1", resultado_id: "examen-1", motivo: "Se cargó a otro alumno",
      registrada_en: momentoDentroDePlazo.toISOString(), registrada_por: "mesa@noctium.local",
    });
    expect(m.tx.anulacionResultadoExamen.create).toHaveBeenCalledWith({ data: {
      resultadoExamenId: "examen-1", motivo: "Se cargó a otro alumno", creadoPorUsuarioId: "mesa-1",
      createdAtAnulacion: momentoDentroDePlazo,
    }, select: { idAnulacionResultado: true } });
  });

  it("deniega una segunda anulación, autor ajeno o Profesor vencido", async () => {
    m.tx.anulacionResultadoExamen.findUnique.mockResolvedValue({ idAnulacionResultado: "anulacion-1" });
    await expect(anularResultadoExamen("alumno-1", "examen-1", { motivo: "Repetida" }, mesa)).rejects.toMatchObject({ code: "RESULTADO_ANULADO" });
    m.tx.anulacionResultadoExamen.findUnique.mockResolvedValue(null);
    await expect(anularResultadoExamen("alumno-1", "examen-1", { motivo: "Ajena" }, { id: "otro-user", rol: "PROFESOR" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    m.now.mockReturnValue(new Date("2026-10-17T14:30:00.000Z"));
    await expect(anularResultadoExamen("alumno-1", "examen-1", { motivo: "Vencida" }, profesor)).rejects.toMatchObject({ code: "PLAZO_CORRECCION_VENCIDO" });
    expect(m.tx.anulacionResultadoExamen.create).not.toHaveBeenCalled();
  });
});
