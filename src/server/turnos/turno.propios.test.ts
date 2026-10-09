import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, resolverAlumno, obtenerClase } = vi.hoisted(() => ({
  db: { turno: { count: vi.fn(), findMany: vi.fn() } },
  resolverAlumno: vi.fn(),
  obtenerClase: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoDeUsuario: resolverAlumno }));
vi.mock("@/server/historial/historial.publico", () => ({ obtenerClaseDictadaDeTurno: obtenerClase }));

const { listarTurnosPropios } = await import("./turno.service");
const tx = db as never;
const ahora = new Date("2026-09-29T12:00:00.000Z"); // 09:00 en Argentina.

beforeEach(() => {
  vi.clearAllMocks();
  resolverAlumno.mockResolvedValue({ id: "alumno-propio", activo: true });
  db.turno.count.mockResolvedValueOnce(23).mockResolvedValueOnce(41);
  db.turno.findMany.mockResolvedValue([{
    idTurno: "turno-pasado",
    fechaTurno: new Date("2026-09-28T00:00:00.000Z"),
    horaInicioTurno: new Date("1970-01-01T12:30:00.000Z"),
    duracionMinutosTurno: 90,
    estadoTurno: "CANCELADO",
    // Inscriptos vigentes y cupo: el estado mostrado sale de la ocupación vigente (PR-0.md §2.2).
    cupoMaximoTurno: 4,
    _count: { alumnos: 1 },
    materia: { nombreMateria: "Matemática I" },
    profesor: { apellidoProfesor: "Ríos", nombreProfesor: "Martín" },
    aula: { nombreAula: "Aula 2" },
  }]);
  obtenerClase.mockResolvedValue({ id: "clase-1", registrada_en: "2026-09-29T13:00:00.000Z", alumnos_registrados: 3 });
});

describe("listarTurnosPropios (HU-C-13 §2.14.1)", () => {
  it("deriva al alumno de la sesión, incluye cancelados y devuelve totales y clase dictada", async () => {
    const resultado = await listarTurnosPropios({ vista: "anteriores", pagina: 2, por_pagina: 10 }, "usuario-1", tx, ahora);

    expect(resolverAlumno).toHaveBeenCalledExactlyOnceWith("usuario-1", tx);
    expect(resultado).toEqual({
      items: [{
        turno_id: "turno-pasado", fecha: "2026-09-28", hora_inicio: "12:30", hora_fin: "14:00",
        materia: "Matemática I", profesor: "Ríos, Martín", aula: "Aula 2", estado: "CANCELADO", clase_dictada: true,
      }],
      paginacion: { total: 41, pagina_actual: 2, total_paginas: 5, por_pagina: 10 },
      totales: { proximos: 23, anteriores: 41 },
    });
    expect(db.turno.findMany).toHaveBeenCalledWith(expect.objectContaining({
      // Solo los turnos con una inscripción vigente del alumno (PR-0.md §2.0 y §2.2).
      where: expect.objectContaining({ alumnos: { some: expect.objectContaining({ alumnoId: "alumno-propio", vigencia: "VIGENTE" }) } }),
      skip: 10,
      take: 10,
      orderBy: [{ fechaTurno: "desc" }, { horaInicioTurno: "desc" }, { idTurno: "desc" }],
    }));
    expect(db.turno.count).toHaveBeenCalledTimes(2);
    expect(db.turno.count.mock.calls[1]![0].where.OR).toEqual([
      { fechaTurno: { lt: new Date("2026-09-29T00:00:00.000Z") } },
      { fechaTurno: new Date("2026-09-29T00:00:00.000Z"), horaInicioTurno: { lt: new Date("1970-01-01T09:00:00.000Z") } },
    ]);
    expect(obtenerClase).toHaveBeenCalledExactlyOnceWith("turno-pasado", tx);
  });

  it("usa el límite inclusivo de Próximos, excluye alumnos ajenos y ordena ascendente", async () => {
    db.turno.count.mockReset().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    db.turno.findMany.mockResolvedValueOnce([]);
    const resultado = await listarTurnosPropios({ vista: "proximos", pagina: 1, por_pagina: 10 }, "usuario-1", tx, ahora);
    const filtroProximos = db.turno.count.mock.calls[0]![0].where;

    expect(filtroProximos.alumnos).toEqual({ some: expect.objectContaining({ alumnoId: "alumno-propio", vigencia: "VIGENTE" }) });
    expect(filtroProximos.OR).toEqual([
      { fechaTurno: { gt: new Date("2026-09-29T00:00:00.000Z") } },
      { fechaTurno: new Date("2026-09-29T00:00:00.000Z"), horaInicioTurno: { gte: new Date("1970-01-01T09:00:00.000Z") } },
    ]);
    expect(db.turno.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ fechaTurno: "asc" }, { horaInicioTurno: "asc" }, { idTurno: "asc" }],
    }));
    expect(resultado.paginacion.total_paginas).toBe(1);
    expect(resultado.items).toEqual([]);
    expect(obtenerClase).not.toHaveBeenCalled();
  });

  it("mantiene una página fuera de rango vacía y devuelve totales independientes de esa página", async () => {
    db.turno.count.mockReset().mockResolvedValueOnce(23).mockResolvedValueOnce(41);
    db.turno.findMany.mockResolvedValueOnce([]);

    await expect(listarTurnosPropios({ vista: "anteriores", pagina: 99, por_pagina: 10 }, "usuario-1", tx, ahora))
      .resolves.toMatchObject({
        items: [],
        paginacion: { total: 41, pagina_actual: 99, total_paginas: 5, por_pagina: 10 },
        totales: { proximos: 23, anteriores: 41 },
      });
    expect(db.turno.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 980, take: 10 }));
  });

  it("rechaza una sesión sin ficha vinculada antes de consultar turnos", async () => {
    resolverAlumno.mockResolvedValueOnce(null);

    await expect(listarTurnosPropios({ vista: "proximos", pagina: 1, por_pagina: 10 }, "usuario-sin-alumno", tx, ahora))
      .rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(db.turno.count).not.toHaveBeenCalled();
    expect(db.turno.findMany).not.toHaveBeenCalled();
  });
});
