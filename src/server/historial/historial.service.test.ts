import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, alumno, materias, profesores, profesorUsuario, profesorAtendio } = vi.hoisted(() => ({
  queryRaw: vi.fn(), alumno: vi.fn(), materias: vi.fn(), profesores: vi.fn(), profesorUsuario: vi.fn(), profesorAtendio: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoBasico: alumno }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: materias }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerNombresProfesores: profesores,
  obtenerOpcionProfesorDeUsuario: profesorUsuario,
}));
vi.mock("./historial.publico", () => ({ profesorAtendioAlumno: profesorAtendio }));

const { obtenerHistorialAlumno } = await import("./historial.service");

const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };
const registroClase = {
  total: 2n, materias_disponibles: ["materia-1"], tipo: "CLASE_DICTADA" as const,
  fecha: new Date("2026-09-28T00:00:00.000Z"), materia_id: "materia-1", profesor_id: "profesor-1",
  nota: null, observaciones: null, turno_id: "turno-1", registro_id: "clase-1",
};
const registroExamen = {
  total: 2n, materias_disponibles: ["materia-1"], tipo: "EXAMEN" as const,
  fecha: new Date("2026-09-30T00:00:00.000Z"), materia_id: "materia-1", profesor_id: null,
  nota: "8.5", observaciones: "Parcial de cinemática", turno_id: null, registro_id: "examen-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  alumno.mockResolvedValue({ id: "alumno-1", nombre: "Emilia", apellido: "Acosta", activo: true });
  materias.mockResolvedValue([{ id: "materia-1", nombre: "Programación I" }]);
  profesores.mockResolvedValue({ "profesor-1": "Acuña, Sergio" });
  profesorUsuario.mockResolvedValue({ id: "profesor-1", nombreParaMostrar: "Acuña, Sergio" });
  profesorAtendio.mockResolvedValue(true);
  queryRaw.mockResolvedValue([registroExamen, registroClase]);
});

describe("HU-E-05 obtenerHistorialAlumno", () => {
  it("combina exámenes y clases en la línea temporal y devuelve solo identidad académica", async () => {
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa);

    expect(resultado).toEqual({
      alumno: { id: "alumno-1", nombre_completo: "Acosta, Emilia" },
      materias_disponibles: [{ id: "materia-1", nombre: "Programación I" }],
      items: [
        { tipo: "EXAMEN", fecha: "2026-09-30", materia: { id: "materia-1", nombre: "Programación I" }, nota: "8.5", observaciones: "Parcial de cinemática" },
        { tipo: "CLASE_DICTADA", fecha: "2026-09-28", materia: { id: "materia-1", nombre: "Programación I" }, profesor: "Acuña, Sergio", turno_id: "turno-1" },
      ],
      paginacion: { total: 2, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
    });
    expect(resultado.alumno).not.toHaveProperty("dni");
    expect(resultado.alumno).not.toHaveProperty("email");
    expect(profesores).toHaveBeenCalledWith(["profesor-1"]);
    expect(materias).toHaveBeenCalledWith(["materia-1"]);
  });

  it("filtra y pagina antes de formar la respuesta", async () => {
    queryRaw.mockResolvedValue([{ ...registroExamen, total: 12n }]);

    const resultado = await obtenerHistorialAlumno("alumno-1", {
      pagina: 2, por_pagina: 10, materia_id: "materia-1",
    }, mesa);

    expect(resultado.paginacion).toEqual({ total: 12, pagina_actual: 2, total_paginas: 2, por_pagina: 10 });
    const [plantilla, ...parametros] = queryRaw.mock.calls[0]! as unknown as [TemplateStringsArray, ...unknown[]];
    const sql = plantilla.join("?");
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("materia_id = ?::text");
    expect(sql).toContain("LIMIT ? OFFSET ?");
    expect(parametros).toContain("alumno-1");
    expect(parametros).toContain("materia-1");
    expect(parametros).toContain(10);
    expect(parametros).toContain(10);
  });

  it("devuelve una lista vacía con paginación cero sin registros", async () => {
    queryRaw.mockResolvedValue([{
      total: 0n, materias_disponibles: [], tipo: null, fecha: null, materia_id: null,
      profesor_id: null, nota: null, turno_id: null, registro_id: null,
    }]);
    materias.mockResolvedValue([]);
    profesores.mockResolvedValue({});

    await expect(obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa)).resolves.toMatchObject({
      items: [], materias_disponibles: [], paginacion: { total: 0, total_paginas: 0 },
    });
    expect(materias).toHaveBeenCalledWith([]);
    expect(profesores).toHaveBeenCalledWith([]);
  });

  it("deniega al profesor antes de consultar existencia o historial si no atendió al alumno", async () => {
    profesorAtendio.mockResolvedValue(false);

    await expect(obtenerHistorialAlumno("alumno-privado", { pagina: 1, por_pagina: 10 }, {
      id: "usuario-profesor", rol: "PROFESOR",
    })).rejects.toMatchObject({ code: "SIN_PERMISO" });

    expect(profesorUsuario).toHaveBeenCalledWith("usuario-profesor", expect.objectContaining({ $queryRaw: queryRaw }));
    expect(alumno).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
