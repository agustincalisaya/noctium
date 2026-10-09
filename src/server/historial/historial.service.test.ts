import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, alumno, materias, profesores, profesorUsuario, profesorAtendio, asistencia, vigente, propia, email } = vi.hoisted(() => ({
  queryRaw: vi.fn(), alumno: vi.fn(), materias: vi.fn(), profesores: vi.fn(), profesorUsuario: vi.fn(), profesorAtendio: vi.fn(), asistencia: vi.fn(), vigente: vi.fn(), propia: vi.fn(), email: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoBasico: alumno }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: materias }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerNombresProfesores: profesores,
  obtenerOpcionProfesorDeUsuario: profesorUsuario,
}));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: email }));
vi.mock("./historial.publico", () => ({ profesorAtendioAlumno: profesorAtendio, asistenciaDeAlumno: asistencia, profesorPuedeRegistrarIndicacion: propia }));

vi.mock("@/server/turnos/inscripcion.publico", () => ({ existeInscripcionVigenteConProfesor: vigente }));

const { obtenerHistorialAlumno } = await import("./historial.service");

const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };
const registroClase = {
  total: 2n, materias_disponibles: ["materia-1"], tipo: "CLASE_DICTADA" as const,
  fecha: new Date("2026-09-28T00:00:00.000Z"), materia_id: "materia-1", profesor_id: "profesor-1",
  nota: null, observaciones: null, turno_id: "turno-1", registro_id: "clase-1",
  temas_vistos: null, observaciones_internas: null, observacion_registrada_en: null, observacion_creada_por_id: null,
};
const registroExamen = {
  total: 2n, materias_disponibles: ["materia-1"], tipo: "EXAMEN" as const,
  fecha: new Date("2026-09-30T00:00:00.000Z"), materia_id: "materia-1", profesor_id: null,
  nota: "8.5", observaciones: "Parcial de cinemática", turno_id: null, registro_id: "examen-1",
  temas_vistos: null, observaciones_internas: null, observacion_registrada_en: null, observacion_creada_por_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  alumno.mockResolvedValue({ id: "alumno-1", nombre: "Emilia", apellido: "Acosta", activo: true });
  materias.mockResolvedValue([{ id: "materia-1", nombre: "Programación I" }]);
  profesores.mockResolvedValue({ "profesor-1": "Acuña, Sergio" });
  profesorUsuario.mockResolvedValue({ id: "profesor-1", nombreParaMostrar: "Acuña, Sergio" });
  profesorAtendio.mockResolvedValue(true);
  vigente.mockResolvedValue(true); propia.mockResolvedValue(false);
  email.mockResolvedValue("profesor@noctium.local");
  queryRaw.mockResolvedValue([registroExamen, registroClase]);
  asistencia.mockResolvedValue([{ materia_id: "materia-1", presentes: 1, ausentes: 1, sin_control: 1, porcentaje: 50 }]);
});

describe("HU-E-05 obtenerHistorialAlumno", () => {
  it("combina exámenes y clases en la línea temporal y devuelve solo identidad académica", async () => {
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa);

    expect(resultado).toEqual({
      asistencia_por_materia: [{ materia_id: "materia-1", presentes: 1, ausentes: 1, sin_control: 1, porcentaje: 50 }],
      alumno: { id: "alumno-1", nombre_completo: "Acosta, Emilia" },
      materias_disponibles: [{ id: "materia-1", nombre: "Programación I" }],
      items: [
        { tipo: "EXAMEN", fecha: "2026-09-30", materia: { id: "materia-1", nombre: "Programación I" }, nota: "8.5", observaciones: "Parcial de cinemática" },
        { tipo: "CLASE_DICTADA", fecha: "2026-09-28", materia: { id: "materia-1", nombre: "Programación I" }, profesor: "Acuña, Sergio", turno_id: "turno-1", asistencia: null },
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
    expect(sql).toContain("IS NULL");
    expect(asistencia).toHaveBeenCalledWith("alumno-1");
    expect(parametros).toContain("alumno-1");
    expect(parametros).toContain("materia-1");
    expect(parametros).toContain(10);
    expect(parametros).toContain(10);
  });

  it("adjunta la observación de clase y limita el texto interno al Profesor titular", async () => {
    queryRaw.mockResolvedValue([{ ...registroClase, temas_vistos: "Funciones lineales", observaciones_internas: "Preparar práctica", observacion_registrada_en: new Date("2026-09-29T14:00:00.000Z"), observacion_creada_por_id: "autor-1" }]);
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa);
    expect(resultado.items[0]).toMatchObject({ observacion: {
      temas_vistos: "Funciones lineales", observaciones_internas: "Preparar práctica",
      registrada_en: "2026-09-29T14:00:00.000Z", registrada_por: "profesor@noctium.local",
    } });
    expect(email).toHaveBeenCalledWith("autor-1");

    const profesorAjeno = { id: "usuario-profesor", rol: "PROFESOR" as const };
    profesorUsuario.mockResolvedValue({ id: "otro-profesor", nombreParaMostrar: "Otro" });
    const acotado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, profesorAjeno);
    expect(acotado.items[0]).toMatchObject({ observacion: {
      temas_vistos: "Funciones lineales", registrada_por: "profesor@noctium.local",
    } });
    expect(acotado.items[0]).not.toHaveProperty("observacion.observaciones_internas");

    const gerente = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, { id: "gerente-1", rol: "GERENTE" });
    expect(gerente.items[0]).toMatchObject({ observacion: { observaciones_internas: "Preparar práctica" } });
  });

  it("devuelve una lista vacía con paginación cero sin registros", async () => {
    queryRaw.mockResolvedValue([{
      total: 0n, materias_disponibles: [], tipo: null, fecha: null, materia_id: null,
      profesor_id: null, nota: null, turno_id: null, registro_id: null,
      temas_vistos: null, observaciones_internas: null, observacion_registrada_en: null, observacion_creada_por_id: null,
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


describe("HU-E-09 resumen aditivo de Profesor", () => {
  const profesor = { id: "usuario-profesor", rol: "PROFESOR" as const };
  it("solo solicita la materia autorizada, nunca todas las materias", async () => {
    const r = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "materia-1" }, profesor);
    expect(asistencia).toHaveBeenCalledExactlyOnceWith("alumno-1", "materia-1");
    expect(r.asistencia_por_materia).toHaveLength(1);
  });
  it("sin contexto de materia no entrega resumen nuevo de todas las materias", async () => {
    const r = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, profesor);
    expect(r.asistencia_por_materia).toEqual([]); expect(asistencia).not.toHaveBeenCalled();
  });
  it("materia ajena no entrega resumen aunque el contrato anterior permita historial general", async () => {
    vigente.mockResolvedValue(false); propia.mockResolvedValue(false);
    const r = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "ajena" }, profesor);
    expect(r.asistencia_por_materia).toEqual([]); expect(asistencia).not.toHaveBeenCalled();
  });
});
