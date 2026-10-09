import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, alumno, materias, profesores, profesorUsuario, email, opciones, asistencia, vigente, propia, now } = vi.hoisted(() => ({
  queryRaw: vi.fn(), alumno: vi.fn(), materias: vi.fn(), profesores: vi.fn(), profesorUsuario: vi.fn(), email: vi.fn(), opciones: vi.fn(), asistencia: vi.fn(), vigente: vi.fn(), propia: vi.fn(), now: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoBasico: alumno }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: materias }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerNombresProfesores: profesores,
  obtenerOpcionProfesorDeUsuario: profesorUsuario,
}));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: email }));
vi.mock("@/server/shared/reloj", () => ({ ahora: () => now() }));
vi.mock("./indicacion.service", () => ({ opcionesDeIndicacion: opciones }));
vi.mock("./historial.publico", () => ({ asistenciaDeAlumno: asistencia, profesorPuedeRegistrarIndicacion: propia }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ existeInscripcionVigenteConProfesor: vigente }));

const { obtenerHistorialAlumno } = await import("./historial.service");

const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };
const registroClase = {
  total: 2n, materias_disponibles: ["materia-1"], tipo: "CLASE_DICTADA" as const,
  fecha: new Date("2026-09-28T00:00:00.000Z"), materia_id: "materia-1", profesor_id: "profesor-1",
  nota: null, observaciones: null, indicacion: null, registrada_en: null, clase_dictada_id: null, creado_por_usuario_id: null,
  turno_id: "turno-1", registro_id: "clase-1", temas_vistos: null, observaciones_internas: null,
  observacion_registrada_en: null, observacion_creada_por_id: null,
  creado_en: new Date("2026-09-28T12:00:00.000Z"), asistencia: null,
  corregido: null, anulado: null, anulacion_motivo: null, anulacion_en: null, anulacion_por: null, resultado_creado_por: null,
};
const registroExamen = {
  total: 2n, materias_disponibles: ["materia-1"], tipo: "EXAMEN" as const,
  fecha: new Date("2026-09-30T00:00:00.000Z"), materia_id: "materia-1", profesor_id: null,
  nota: "8.5", observaciones: "Parcial de cinemática", indicacion: null, registrada_en: null, clase_dictada_id: null, creado_por_usuario_id: null,
  turno_id: null, registro_id: "examen-1", temas_vistos: null, observaciones_internas: null,
  observacion_registrada_en: null, observacion_creada_por_id: null,
  creado_en: new Date("2026-10-01T12:00:00.000Z"), asistencia: null,
  corregido: false, anulado: false, anulacion_motivo: null, anulacion_en: null, anulacion_por: null, resultado_creado_por: "mesa-1",
};
const registroIndicacion = {
  total: 1n, materias_disponibles: ["materia-1"], tipo: "INDICACION" as const,
  fecha: new Date("2026-09-30T00:00:00.000Z"), materia_id: "materia-1", profesor_id: null,
  nota: null, observaciones: null, indicacion: "Practicar ecuaciones", registrada_en: new Date("2026-09-30T01:30:00.000Z"),
  clase_dictada_id: "clase-1", creado_por_usuario_id: "mesa-1", turno_id: null, registro_id: "indicacion-1",
  temas_vistos: null, observaciones_internas: null, observacion_registrada_en: null, observacion_creada_por_id: null,
  creado_en: new Date("2026-09-30T01:30:00.000Z"), asistencia: null,
  corregido: null, anulado: null, anulacion_motivo: null, anulacion_en: null, anulacion_por: null, resultado_creado_por: null,
};

function valoresSql(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor.flatMap(valoresSql);
  if (valor && typeof valor === "object" && "values" in valor) return valoresSql((valor as { values: unknown }).values);
  return [valor];
}

beforeEach(() => {
  vi.clearAllMocks();
  alumno.mockResolvedValue({ id: "alumno-1", nombre: "Emilia", apellido: "Acosta", activo: true });
  materias.mockResolvedValue([{ id: "materia-1", nombre: "Programación I" }]);
  profesores.mockResolvedValue({ "profesor-1": "Acuña, Sergio" });
  profesorUsuario.mockResolvedValue({ id: "profesor-1", nombreParaMostrar: "Acuña, Sergio" });
  email.mockResolvedValue("mesa@noctium.local");
  now.mockReturnValue(new Date("2026-10-02T12:00:00.000Z"));
  opciones.mockResolvedValue({ materias: [], clases: [] });
  vigente.mockResolvedValue(true);
  propia.mockResolvedValue(false);
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
      indicaciones_opciones: { materias: [], clases: [] },
      items: [
        { tipo: "EXAMEN", id: "examen-1", fecha: "2026-09-30", materia: { id: "materia-1", nombre: "Programación I" }, nota: "8.5", observaciones: "Parcial de cinemática", corregido: false, anulado: false, puede_corregir: true },
        { tipo: "CLASE_DICTADA", id: "clase-1", fecha: "2026-09-28", materia: { id: "materia-1", nombre: "Programación I" }, profesor: "Acuña, Sergio", turno_id: "turno-1", asistencia: null },
      ],
      paginacion: { total: 2, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
    });
    expect(resultado.alumno).not.toHaveProperty("dni");
    expect(resultado.alumno).not.toHaveProperty("email");
    expect(profesores).toHaveBeenCalledWith(["profesor-1"]);
    expect(materias).toHaveBeenCalledWith(["materia-1"]);
  });

  it("filtra y pagina antes de formar la respuesta e incluye indicaciones en la consulta", async () => {
    queryRaw.mockResolvedValue([{ ...registroExamen, total: 12n }]);
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 2, por_pagina: 10, materia_id: "materia-1" }, mesa);

    expect(resultado.paginacion).toEqual({ total: 12, pagina_actual: 2, total_paginas: 2, por_pagina: 10 });
    const [plantilla, ...parametros] = queryRaw.mock.calls[0]! as unknown as [TemplateStringsArray, ...unknown[]];
    const sql = plantilla.join("?");
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("materia_id = ?::text");
    expect(sql).toContain("LIMIT ? OFFSET ?");
    expect(sql).toContain("'INDICACION'::text AS tipo");
    expect(sql).toContain('clase."anuladaEl" IS NULL');
    expect(asistencia).toHaveBeenCalledWith("alumno-1");
    expect(parametros).toContain("alumno-1");
    expect(parametros).toContain("materia-1");
    expect(parametros).toContain(10);
  });

  it("devuelve indicación, autor, hora local y vínculo solo si la clase sigue vigente", async () => {
    queryRaw.mockResolvedValue([registroIndicacion]);
    opciones.mockResolvedValue({ materias: [{ id: "materia-1", nombre: "Programación I" }], clases: [{ id: "clase-1", materia_id: "materia-1", fecha: "2026-09-28" }] });
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa);

    expect(resultado.items).toEqual([{
      tipo: "INDICACION", id: "indicacion-1", fecha: "2026-09-30", materia: { id: "materia-1", nombre: "Programación I" },
      indicacion: "Practicar ecuaciones", registrada_en: "2026-09-30T01:30:00.000Z", registrada_por: "mesa@noctium.local", clase_dictada_id: "clase-1",
    }]);
    expect(email).toHaveBeenCalledExactlyOnceWith("mesa-1");
    expect(opciones).toHaveBeenCalledExactlyOnceWith("alumno-1", undefined);
  });

  it("adjunta la observación y limita el texto interno al equipo y al Profesor titular", async () => {
    queryRaw.mockResolvedValue([{
      ...registroClase, temas_vistos: "Funciones lineales", observaciones_internas: "Preparar práctica",
      observacion_registrada_en: new Date("2026-09-29T14:00:00.000Z"), observacion_creada_por_id: "autor-1",
    }]);
    email.mockResolvedValue("profesor@noctium.local");
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa);
    expect(resultado.items[0]).toMatchObject({ observacion: {
      temas_vistos: "Funciones lineales", observaciones_internas: "Preparar práctica",
      registrada_en: "2026-09-29T14:00:00.000Z", registrada_por: "profesor@noctium.local",
    } });
    expect(email).toHaveBeenCalledWith("autor-1");

    const profesorAjeno = { id: "usuario-profesor", rol: "PROFESOR" as const };
    profesorUsuario.mockResolvedValue({ id: "otro-profesor", nombreParaMostrar: "Otro" });
    const acotado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "materia-1" }, profesorAjeno);
    expect(acotado.items[0]).toMatchObject({ observacion: { temas_vistos: "Funciones lineales", registrada_por: "profesor@noctium.local" } });
    expect(acotado.items[0]).not.toHaveProperty("observacion.observaciones_internas");

    const gerente = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, { id: "gerente-1", rol: "GERENTE" });
    expect(gerente.items[0]).toMatchObject({ observacion: { observaciones_internas: "Preparar práctica" } });
  });

  it("devuelve una lista vacía con paginación cero sin registros", async () => {
    queryRaw.mockResolvedValue([{
      total: 0n, materias_disponibles: [], tipo: null, fecha: null, materia_id: null, profesor_id: null, nota: null,
      observaciones: null, indicacion: null, registrada_en: null, clase_dictada_id: null, creado_por_usuario_id: null,
      turno_id: null, registro_id: null, asistencia: null, temas_vistos: null, observaciones_internas: null,
      observacion_registrada_en: null, observacion_creada_por_id: null, creado_en: null,
      corregido: null, anulado: null, anulacion_motivo: null, anulacion_en: null, anulacion_por: null, resultado_creado_por: null,
    }]);
    materias.mockResolvedValue([]);
    profesores.mockResolvedValue({});

    await expect(obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa)).resolves.toMatchObject({
      items: [], materias_disponibles: [], paginacion: { total: 0, total_paginas: 0 },
    });
    expect(materias).toHaveBeenCalledWith([]);
    expect(profesores).toHaveBeenCalledWith([]);
  });

  it("deniega al Profesor antes de consultar datos si falta el contexto o la materia no le corresponde", async () => {
    const profesor = { id: "usuario-profesor", rol: "PROFESOR" as const };
    await expect(obtenerHistorialAlumno("alumno-privado", { pagina: 1, por_pagina: 10 }, profesor)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(profesorUsuario).toHaveBeenCalledWith("usuario-profesor", expect.objectContaining({ $queryRaw: queryRaw }));
    expect(alumno).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();

    vigente.mockResolvedValue(false);
    propia.mockResolvedValue(false);
    await expect(obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "ajena" }, profesor)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(alumno).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe("HU-E-09 resumen aditivo de Profesor", () => {
  const profesor = { id: "usuario-profesor", rol: "PROFESOR" as const };
  it("solo solicita la materia autorizada, nunca todas las materias", async () => {
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "materia-1" }, profesor);
    expect(asistencia).toHaveBeenCalledExactlyOnceWith("alumno-1", "materia-1");
    expect(resultado.asistencia_por_materia).toHaveLength(1);
    expect(materias).toHaveBeenCalledWith(["materia-1"]);
  });
  it("sin contexto de materia deniega el historial y no entrega resumen nuevo de todas las materias", async () => {
    await expect(obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, profesor)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(asistencia).not.toHaveBeenCalled();
  });
  it("materia ajena no entrega historial ni resumen", async () => {
    vigente.mockResolvedValue(false);
    propia.mockResolvedValue(false);
    await expect(obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "ajena" }, profesor)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(asistencia).not.toHaveBeenCalled();
  });
});

describe("HU-E-10 valores vigentes y visibilidad de resultados de examen", () => {
  it("permite corregir a Mesa, limita al Profesor creador y no permite al Gerente", async () => {
    const profesor = { id: "usuario-profesor", rol: "PROFESOR" as const };
    const gerente = { id: "gerente-1", rol: "GERENTE" as const };
    queryRaw.mockResolvedValue([{ ...registroExamen, resultado_creado_por: "usuario-profesor", creado_en: new Date("2026-10-01T12:00:00.000Z") }]);
    const deProfesor = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "materia-1" }, profesor);
    expect(deProfesor.items[0]).toMatchObject({ id: "examen-1", corregido: false, anulado: false, puede_corregir: true });

    queryRaw.mockResolvedValue([{ ...registroExamen, resultado_creado_por: "otro-profesor" }]);
    const deOtro = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "materia-1" }, profesor);
    expect(deOtro.items[0]).toMatchObject({ puede_corregir: false });

    const deGerente = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, gerente);
    expect(deGerente.items[0]).toMatchObject({ puede_corregir: false });
  });

  it("muestra anulados con motivo a Mesa y Gerencia, y los excluye para Profesor", async () => {
    queryRaw.mockResolvedValue([{
      ...registroExamen,
      anulado: true,
      anulacion_motivo: "Error de carga",
      anulacion_en: new Date("2026-10-02T14:00:00.000Z"),
      anulacion_por: "mesa-1",
    }]);
    const mesaResultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, mesa);
    expect(mesaResultado.items[0]).toMatchObject({
      id: "examen-1", anulado: true, puede_corregir: false,
      anulacion: { motivo: "Error de carga", anulada_en: "2026-10-02T14:00:00.000Z", anulada_por: "mesa@noctium.local" },
    });
    const gerenteResultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10 }, { id: "gerente-1", rol: "GERENTE" });
    expect(gerenteResultado.items[0]).toMatchObject({ anulado: true, puede_corregir: false });
    queryRaw.mockResolvedValue([]);
    const profesorResultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "materia-1" }, { id: "profesor-1", rol: "PROFESOR" });
    expect(profesorResultado.items).toEqual([]);
  });

  it("excluye examen anulado en el SQL del Profesor y trae corrección vigente", async () => {
    const profesor = { id: "usuario-profesor", rol: "PROFESOR" as const };
    queryRaw.mockResolvedValue([{
      ...registroExamen,
      resultado_creado_por: "usuario-profesor",
      corregido: true,
      fecha: new Date("2026-10-01T00:00:00.000Z"),
      nota: "9.5",
    }]);
    const resultado = await obtenerHistorialAlumno("alumno-1", { pagina: 1, por_pagina: 10, materia_id: "materia-1" }, profesor);
    const [plantilla] = queryRaw.mock.calls.at(-1)! as unknown as [TemplateStringsArray, ...unknown[]];
    const sql = plantilla.join("?");
    const parametros = valoresSql(queryRaw.mock.calls.at(-1));
    expect(sql).toContain("anulaciones_resultado_examen");
    expect(parametros).toContain(false);
    expect(resultado.items[0]).toMatchObject({ fecha: "2026-10-01", nota: "9.5", corregido: true, puede_corregir: true });
  });
});
