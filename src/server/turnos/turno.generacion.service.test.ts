import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerarTurnosSchema } from "./turno.generacion.schema";

const { materiaActiva, profesorActivo, dictaMateria, horario, aulasActivas, aulaActiva, existeAula, nombreAula, listarAulas,
  parametrosHorario, parametros, buscarTurnos, crearTurno, actualizarTurno, borrarTurno, crearEvento } = vi.hoisted(() => ({
  materiaActiva: vi.fn(), profesorActivo: vi.fn(), dictaMateria: vi.fn(), horario: vi.fn(),
  aulasActivas: vi.fn(), aulaActiva: vi.fn(), existeAula: vi.fn(),
  nombreAula: vi.fn(async (id: string) => ({ id, nombre: "Aula por defecto" })), listarAulas: vi.fn(async () => []), parametrosHorario: vi.fn(),
  parametros: vi.fn(), buscarTurnos: vi.fn(), crearTurno: vi.fn(), actualizarTurno: vi.fn(), borrarTurno: vi.fn(), crearEvento: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  parametroSistema: { findMany: parametros },
  turno: { findMany: buscarTurnos, create: crearTurno, update: actualizarTurno, delete: borrarTurno },
  eventoTurno: { create: crearEvento },
} }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  obtenerOpcionProfesorActivo: profesorActivo, profesorActivoDictaMateria: dictaMateria, obtenerHorarioDeProfesor: horario,
}));
vi.mock("@/server/aulas/aula.publico", () => ({
  hayAulasActivas: aulasActivas, verificarAulaActiva: aulaActiva, existeAula,
  obtenerNombreAula: nombreAula, listarAulasActivasParaTurno: listarAulas,
}));
vi.mock("@/server/shared/parametros", () => ({ obtenerParametrosHorarioOperativo: parametrosHorario }));

const { vistaPreviaGeneracion } = await import("./turno.generacion.service");
const ahora = new Date("2026-09-30T12:00:00.000Z"); // 09:00 en Buenos Aires
const base = {
  materia_id: "materia-1", profesor_id: "ckprofesor000000000000001", horario_id: "ckhorario000000000000001",
  duracion_min: 120, hora_inicio: "10:00", aula_id: "ckaula00000000000000001",
  fecha_desde: "2026-10-05", fecha_hasta: "2026-10-19",
};
const entrada = (cambios: Partial<typeof base> = {}) => GenerarTurnosSchema.parse({ ...base, ...cambios });
type TurnoGuardado = { fechaTurno: Date; horaInicioTurno: Date; duracionMinutosTurno: number; profesorId: string; materiaId: string; aulaId: string; estadoTurno: "PENDIENTE" | "DISPONIBLE" | "COMPLETO" | "CANCELADO" };
let turnos: TurnoGuardado[];
const guardado = (fecha: string, hora: string, estado: TurnoGuardado["estadoTurno"], cambios: Partial<TurnoGuardado> = {}): TurnoGuardado => ({
  fechaTurno: new Date(`${fecha}T00:00:00.000Z`), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
  duracionMinutosTurno: 120, profesorId: base.profesor_id, materiaId: base.materia_id, aulaId: base.aula_id,
  estadoTurno: estado, ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
  turnos = [];
  materiaActiva.mockResolvedValue({ idMateria: base.materia_id });
  profesorActivo.mockResolvedValue({ id: base.profesor_id });
  dictaMateria.mockResolvedValue(true);
  horario.mockResolvedValue({ horario_id: base.horario_id, dia_semana: "LUNES", hora_inicio: "08:00", hora_fin: "14:00" });
  aulasActivas.mockResolvedValue(true);
  aulaActiva.mockResolvedValue({ idAula: base.aula_id, capacidadAula: 20 });
  existeAula.mockResolvedValue(false);
  parametrosHorario.mockResolvedValue({ diasOperativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"], apertura: "08:00", cierre: "20:00", granularidadMinutos: 30 });
  parametros.mockResolvedValue([
    { clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "40" },
  ]);
  buscarTurnos.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => turnos.filter((turno) => {
    if (turno.fechaTurno.getTime() !== (where.fechaTurno as Date).getTime()) return false;
    if (where.materiaId && turno.materiaId !== where.materiaId) return false;
    if (where.aulaId && turno.aulaId !== where.aulaId) return false;
    if (typeof where.profesorId === "string" && turno.profesorId !== where.profesorId) return false;
    if (where.profesorId && typeof where.profesorId === "object" && !(where.profesorId as { in: string[] }).in.includes(turno.profesorId)) return false;
    if (where.estadoTurno && typeof where.estadoTurno === "object") {
      const estado = where.estadoTurno as { not?: string; in?: string[] };
      if (estado.not && turno.estadoTurno === estado.not) return false;
      if (estado.in && !estado.in.includes(turno.estadoTurno)) return false;
    }
    return true;
  }));
});

describe("vistaPreviaGeneracion", () => {
  it("devuelve todas las fechas sin escrituras ni eventos", async () => {
    await expect(vistaPreviaGeneracion(entrada(), ahora)).resolves.toMatchObject({
      cantidad: 3, fechas: ["2026-10-05", "2026-10-12", "2026-10-19"].map((fecha) => ({ fecha, estado: "OK", motivos: [] })),
      hay_conflictos: false, fechas_omitidas_vencidas: 0,
    });
    expect(crearTurno).not.toHaveBeenCalled();
    expect(actualizarTurno).not.toHaveBeenCalled();
    expect(borrarTurno).not.toHaveBeenCalled();
    expect(crearEvento).not.toHaveBeenCalled();
  });

  it("informa conflictos por fecha sin impedir la respuesta completa", async () => {
    turnos.push(guardado("2026-10-12", "10:00", "DISPONIBLE", { materiaId: "otra-materia", profesorId: "otro-profesor" }));
    const resultado = await vistaPreviaGeneracion(entrada(), ahora);
    expect(resultado).toMatchObject({ cantidad: 3, hay_conflictos: true, fechas: [
      { estado: "OK" }, { estado: "CONFLICTO", motivos: ["AULA_OCUPADA"] }, { estado: "OK" },
    ] });
    expect(crearTurno).not.toHaveBeenCalled();
  });

  it("detecta TURNO_EXISTENTE aun si está PENDIENTE y lo prioriza", async () => {
    turnos.push(guardado("2026-10-05", "10:00", "PENDIENTE"));
    const resultado = await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora);
    expect(resultado.fechas).toMatchObject([{ fecha: "2026-10-05", estado: "CONFLICTO", motivos: ["TURNO_EXISTENTE"] }]);
  });

  it.each(["DISPONIBLE", "COMPLETO"] as const)("detecta ocupación del profesor en estado %s", async (estado) => {
    turnos.push(guardado("2026-10-05", "10:00", estado, { materiaId: "otra-materia", aulaId: "otra-aula" }));
    const resultado = await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora);
    expect(resultado.fechas[0]?.motivos).toEqual(["PROFESOR_OCUPADO"]);
  });

  it("devuelve ambos conflictos físicos en el orden del contrato", async () => {
    turnos.push(guardado("2026-10-05", "10:00", "COMPLETO", { materiaId: "otra-materia" }));
    const resultado = await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora);
    expect(resultado.fechas[0]?.motivos).toEqual(["AULA_OCUPADA", "PROFESOR_OCUPADO"]);
  });

  it("CANCELADO y turnos contiguos no bloquean; un turno existente confirmado sí", async () => {
    turnos.push(guardado("2026-10-05", "10:00", "CANCELADO"));
    turnos.push(guardado("2026-10-05", "08:00", "DISPONIBLE"));
    turnos.push(guardado("2026-10-05", "12:00", "COMPLETO"));
    expect((await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora)).fechas[0]?.estado).toBe("OK");
    turnos.push(guardado("2026-10-05", "11:00", "DISPONIBLE"));
    expect((await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora)).fechas[0]?.motivos).toEqual(["TURNO_EXISTENTE"]);
  });

  it("acepta exactamente seis meses y rechaza un día adicional", async () => {
    const inicio = { fecha_desde: "2026-10-05", fecha_hasta: "2027-04-05" };
    await expect(vistaPreviaGeneracion(entrada(inicio), ahora)).resolves.toMatchObject({ cantidad: 27 });
    await expect(vistaPreviaGeneracion(entrada({ ...inicio, fecha_hasta: "2027-04-06" }), ahora)).rejects.toMatchObject({ code: "RANGO_EXCEDIDO" });
  });

  it("rechaza inicio pasado y rango sin día coincidente", async () => {
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-09-28", fecha_hasta: "2026-10-05" }), ahora)).rejects.toMatchObject({ code: "RANGO_EXCEDIDO" });
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-10-06", fecha_hasta: "2026-10-06" }), ahora)).rejects.toMatchObject({ code: "SIN_FECHAS_EN_RANGO" });
  });

  it("cuenta hoy futuro y omite hoy vencido", async () => {
    horario.mockResolvedValue({ dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "20:00" });
    const rango = { fecha_desde: "2026-09-30", fecha_hasta: "2026-10-07" };
    expect(await vistaPreviaGeneracion(entrada(rango), ahora)).toMatchObject({ cantidad: 2, fechas_omitidas_vencidas: 0 });
    const tarde = new Date("2026-09-30T15:00:00.000Z"); // 12:00 local
    expect(await vistaPreviaGeneracion(entrada(rango), tarde)).toMatchObject({ cantidad: 1, fechas_omitidas_vencidas: 1 });
    await expect(vistaPreviaGeneracion(entrada({ ...rango, fecha_hasta: "2026-09-30" }), tarde)).rejects.toMatchObject({ code: "SIN_FECHAS_EN_RANGO" });
  });

  it("aplica el máximo sobre fechas generables después de omitir hoy vencido", async () => {
    horario.mockResolvedValue({ dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "20:00" });
    parametros.mockResolvedValueOnce([{ clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "1" }]);
    const tarde = new Date("2026-09-30T15:00:00.000Z");
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-09-30", fecha_hasta: "2026-10-07" }), tarde))
      .resolves.toMatchObject({ cantidad: 1, fechas_omitidas_vencidas: 1, fechas: [{ fecha: "2026-10-07" }] });
  });

  it("devuelve SIN_FECHAS_EN_RANGO cuando solo quedaba hoy y ya venció", async () => {
    horario.mockResolvedValue({ dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "20:00" });
    const tarde = new Date("2026-09-30T15:00:00.000Z");
    await expect(vistaPreviaGeneracion(entrada({ fecha_desde: "2026-09-30", fecha_hasta: "2026-09-30" }), tarde))
      .rejects.toMatchObject({ code: "SIN_FECHAS_EN_RANGO" });
  });

  it("rechaza franja fuera de hora o granularidad", async () => {
    await expect(vistaPreviaGeneracion(entrada({ hora_inicio: "08:15" }), ahora)).rejects.toMatchObject({ code: "FUERA_DE_FRANJA" });
    await expect(vistaPreviaGeneracion(entrada({ hora_inicio: "13:00" }), ahora)).rejects.toMatchObject({ code: "FUERA_DE_FRANJA" });
  });

  it.each(["generacion_maxima_meses", "generacion_maxima_turnos"])("requiere %s sin fallback", async (clave) => {
    parametros.mockResolvedValueOnce([{ clave: clave === "generacion_maxima_meses" ? "generacion_maxima_turnos" : "generacion_maxima_meses", valor: "6" }]);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: "CONFIGURACION_GENERACION_INCOMPLETA" });
  });

  it("aplica el máximo configurado de turnos", async () => {
    parametros.mockResolvedValueOnce([{ clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "2" }]);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: "RANGO_EXCEDIDO" });
  });

  it.each([
    ["materia inactiva", materiaActiva, "MATERIA_NO_DISPONIBLE"],
    ["profesor inactivo", profesorActivo, "PROFESOR_NO_ENCONTRADO"],
    ["sin relación materia-profesor", dictaMateria, "PROFESOR_NO_DICTA_MATERIA"],
    ["horario ajeno o inexistente", horario, "HORARIO_NO_ENCONTRADO"],
    ["sin aulas activas", aulasActivas, "SIN_AULAS_ACTIVAS"],
    ["aula inexistente", aulaActiva, "AULA_NO_ENCONTRADA"],
  ] as const)("rechaza %s", async (_nombre, dependencia, codigo) => {
    dependencia.mockResolvedValueOnce(null);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: codigo });
    expect(buscarTurnos).not.toHaveBeenCalled();
  });

  it("distingue aula inactiva", async () => {
    aulaActiva.mockResolvedValueOnce(null);
    existeAula.mockResolvedValueOnce(true);
    await expect(vistaPreviaGeneracion(entrada(), ahora)).rejects.toMatchObject({ code: "AULA_INACTIVA" });
  });
});

describe("HU-C-21: validaciones de las listas en el servicio", () => {
  const otraAula = "ckaula00000000000000002";
  const conListas = (cambios: Record<string, unknown>) => GenerarTurnosSchema.parse({ ...base, ...cambios });

  it.each([
    ["aulas_por_fecha", { aulas_por_fecha: [{ fecha: "2026-10-06", aula_id: otraAula }] }, "2026-10-06"],
    ["fechas_excluidas", { fechas_excluidas: ["2026-10-26"] }, "2026-10-26"],
  ] as const)("una fecha de %s fuera de las calculadas es VALIDATION_ERROR sin consultar disponibilidad", async (campo, cambios, fecha) => {
    await expect(vistaPreviaGeneracion(conListas(cambios), ahora)).rejects.toMatchObject({ code: "VALIDATION_ERROR", detalles: { campo, fecha } });
    expect(buscarTurnos).not.toHaveBeenCalled();
  });

  it("una fecha de hoy ya vencida no pertenece a las calculadas", async () => {
    horario.mockResolvedValue({ dia_semana: "MIERCOLES", hora_inicio: "08:00", hora_fin: "20:00" });
    const tarde = new Date("2026-09-30T15:00:00.000Z");
    await expect(vistaPreviaGeneracion(conListas({ fecha_desde: "2026-09-30", fecha_hasta: "2026-10-07", fechas_excluidas: ["2026-09-30"] }), tarde))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", detalles: { campo: "fechas_excluidas", fecha: "2026-09-30" } });
  });

  it("el aula de una fecha igual al aula por defecto es VALIDATION_ERROR (D10)", async () => {
    await expect(vistaPreviaGeneracion(conListas({ aulas_por_fecha: [{ fecha: "2026-10-12", aula_id: base.aula_id }] }), ahora))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", detalles: { campo: "aulas_por_fecha", fecha: "2026-10-12" } });
    expect(buscarTurnos).not.toHaveBeenCalled();
  });

  it("los errores de Sprint 2 conservan su precedencia sobre las listas", async () => {
    await expect(vistaPreviaGeneracion(conListas({ hora_inicio: "08:15", fechas_excluidas: ["2026-10-26"] }), ahora)).rejects.toMatchObject({ code: "FUERA_DE_FRANJA" });
  });
});

describe("HU-C-21: aula por fecha, exclusión, cupo y sin aulas libres", () => {
  const otraAula = "ckaula00000000000000002";
  const terceraAula = "ckaula00000000000000003";
  const conListas = (cambios: Record<string, unknown>) => GenerarTurnosSchema.parse({ ...base, ...cambios });
  const capacidades: Record<string, number> = { [base.aula_id]: 20, [otraAula]: 8, [terceraAula]: 30 };
  const nombres: Record<string, string> = { [base.aula_id]: "Aula 1", [otraAula]: "Aula 2", [terceraAula]: "Aula 3" };

  beforeEach(() => {
    aulaActiva.mockImplementation(async (id: string) => capacidades[id] ? { idAula: id, capacidadAula: capacidades[id] } : null);
    nombreAula.mockImplementation(async (id: string) => nombres[id] ? { id, nombre: nombres[id] } : null);
    listarAulas.mockResolvedValue(Object.keys(capacidades).map((id) => ({ id, nombre: nombres[id], capacidad: capacidades[id] })));
    // La lectura agrupada de aulas libres filtra con `in`; la validación por fecha, con valores simples.
    const porFecha = buscarTurnos.getMockImplementation()!;
    buscarTurnos.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      const fechas = where.fechaTurno as Date | { in: Date[] };
      if (fechas instanceof Date) return porFecha({ where });
      const aulas = (where.aulaId as { in: string[] }).in;
      return turnos.filter((turno) => fechas.in.some((fecha) => fecha.getTime() === turno.fechaTurno.getTime())
        && aulas.includes(turno.aulaId) && ["DISPONIBLE", "COMPLETO"].includes(turno.estadoTurno));
    });
  });

  it("un pedido de Sprint 2 suma los campos nuevos con el aula por defecto", async () => {
    const resultado = await vistaPreviaGeneracion(entrada(), ahora);
    expect(resultado).toEqual({
      cantidad: 3, cantidad_incluida: 3, con_aula_cambiada: 0, excluidas: 0, hay_conflictos: false, fechas_omitidas_vencidas: 0,
      fechas: ["2026-10-05", "2026-10-12", "2026-10-19"].map((fecha) => ({
        fecha, estado: "OK", motivos: [], aula: { id: base.aula_id, nombre: "Aula 1" }, aula_cambiada: false,
        cupo: 20, cupo_aula_por_defecto: 20, excluida: false, sin_aulas_libres: false, solo_excluible: false,
      })),
    });
    expect(listarAulas).not.toHaveBeenCalled();
  });

  it("el aula de una fecha cambia solo esa fecha, con su cupo; cada aula distinta se lee una vez", async () => {
    turnos.push(guardado("2026-10-12", "10:00", "DISPONIBLE", { materiaId: "otra-materia", profesorId: "otro-profesor" }));
    const resultado = await vistaPreviaGeneracion(conListas({ aulas_por_fecha: [{ fecha: "2026-10-12", aula_id: otraAula }, { fecha: "2026-10-19", aula_id: otraAula }] }), ahora);
    expect(resultado).toMatchObject({ cantidad: 3, cantidad_incluida: 3, con_aula_cambiada: 2, excluidas: 0, hay_conflictos: false });
    expect(resultado.fechas[0]).toMatchObject({ aula: { id: base.aula_id, nombre: "Aula 1" }, aula_cambiada: false, cupo: 20 });
    expect(resultado.fechas[1]).toMatchObject({ estado: "OK", motivos: [], aula: { id: otraAula, nombre: "Aula 2" }, aula_cambiada: true, cupo: 8, cupo_aula_por_defecto: 20 });
    expect(aulaActiva.mock.calls.map(([id]) => id)).toEqual([base.aula_id, otraAula]);
  });

  it("un aula elegida que está ocupada marca AULA_OCUPADA en esa fecha y sigue como cambiada", async () => {
    turnos.push(guardado("2026-10-12", "11:00", "COMPLETO", { materiaId: "otra-materia", profesorId: "otro-profesor", aulaId: otraAula }));
    const resultado = await vistaPreviaGeneracion(conListas({ aulas_por_fecha: [{ fecha: "2026-10-12", aula_id: otraAula }] }), ahora);
    expect(resultado.hay_conflictos).toBe(true);
    expect(resultado.fechas[1]).toMatchObject({ estado: "CONFLICTO", motivos: ["AULA_OCUPADA"], aula_cambiada: true, solo_excluible: false, sin_aulas_libres: false });
  });

  it.each([
    ["inexistente", false, "AULA_NO_ENCONTRADA"],
    ["inactiva", true, "AULA_INACTIVA"],
  ] as const)("un aula de fecha %s responde %s con la fecha en detalles", async (_caso, existe, codigo) => {
    const ausente = "ckaula00000000000000009";
    existeAula.mockResolvedValueOnce(existe);
    await expect(vistaPreviaGeneracion(conListas({ aulas_por_fecha: [{ fecha: "2026-10-12", aula_id: ausente }] }), ahora))
      .rejects.toMatchObject({ code: codigo, detalles: { campo: "aulas_por_fecha", fecha: "2026-10-12", aula_id: ausente } });
    expect(buscarTurnos).not.toHaveBeenCalled();
  });

  it("una fecha excluida vuelve sin consultar disponibilidad y no cuenta para los conflictos", async () => {
    turnos.push(guardado("2026-10-12", "10:00", "PENDIENTE"));
    const resultado = await vistaPreviaGeneracion(conListas({ fechas_excluidas: ["2026-10-12"] }), ahora);
    expect(resultado).toMatchObject({ cantidad: 3, cantidad_incluida: 2, excluidas: 1, con_aula_cambiada: 0, hay_conflictos: false });
    expect(resultado.fechas[1]).toEqual({
      fecha: "2026-10-12", estado: "OK", motivos: [], aula: { id: base.aula_id, nombre: "Aula 1" }, aula_cambiada: false,
      cupo: 20, cupo_aula_por_defecto: 20, excluida: true, sin_aulas_libres: false, solo_excluible: false,
    });
    const fechasConsultadas = buscarTurnos.mock.calls.map(([{ where }]) => (where.fechaTurno as Date).toISOString().slice(0, 10));
    expect(fechasConsultadas).not.toContain("2026-10-12");
    expect(buscarTurnos).toHaveBeenCalledTimes(6);
  });

  it("todas las fechas excluidas → SIN_FECHAS_EN_RANGO; el tope sigue contando las calculadas", async () => {
    await expect(vistaPreviaGeneracion(conListas({ fechas_excluidas: ["2026-10-05", "2026-10-12", "2026-10-19"] }), ahora))
      .rejects.toMatchObject({ code: "SIN_FECHAS_EN_RANGO", message: "Tiene que quedar al menos una fecha para generar." });
    parametros.mockResolvedValueOnce([{ clave: "generacion_maxima_meses", valor: "6" }, { clave: "generacion_maxima_turnos", valor: "2" }]);
    await expect(vistaPreviaGeneracion(conListas({ fechas_excluidas: ["2026-10-05"] }), ahora)).rejects.toMatchObject({ code: "RANGO_EXCEDIDO" });
  });

  it.each([
    [["PROFESOR_OCUPADO"], { materiaId: "otra-materia", aulaId: otraAula }],
    [["TURNO_EXISTENTE"], {}],
    [["AULA_OCUPADA", "PROFESOR_OCUPADO"], { materiaId: "otra-materia" }],
  ] as const)("motivos %j → solo_excluible, sin calcular aulas libres", async (motivos, cambios) => {
    turnos.push(guardado("2026-10-05", "10:00", "DISPONIBLE", cambios));
    const resultado = await vistaPreviaGeneracion(entrada({ fecha_hasta: "2026-10-05" }), ahora);
    expect(resultado.fechas[0]).toMatchObject({ motivos, solo_excluible: true, sin_aulas_libres: false });
    expect(listarAulas).not.toHaveBeenCalled();
  });

  it("sin_aulas_libres solo con AULA_OCUPADA: false si queda alguna libre, true si no", async () => {
    turnos.push(guardado("2026-10-05", "10:00", "DISPONIBLE", { materiaId: "otra-materia", profesorId: "otro-profesor" }));
    turnos.push(guardado("2026-10-12", "10:00", "DISPONIBLE", { materiaId: "otra-materia", profesorId: "otro-profesor" }));
    for (const [aulaId, profesorId] of [[otraAula, "p2"], [terceraAula, "p3"]]) {
      turnos.push(guardado("2026-10-12", "11:00", "COMPLETO", { materiaId: "otra-materia", profesorId, aulaId }));
    }
    const resultado = await vistaPreviaGeneracion(entrada(), ahora);
    expect(resultado.fechas.map(({ motivos, sin_aulas_libres }) => [motivos, sin_aulas_libres])).toEqual([
      [["AULA_OCUPADA"], false], [["AULA_OCUPADA"], true], [[], false],
    ]);
    expect(listarAulas).toHaveBeenCalledOnce();
  });
});
