import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { turno, profesores, horario, materiaActiva, opcionActiva, dictaMateria, horarios, parametros } = vi.hoisted(() => ({
  turno: { findUnique: vi.fn(), findMany: vi.fn() }, profesores: vi.fn(), horario: vi.fn(), materiaActiva: vi.fn(),
  opcionActiva: vi.fn(), dictaMateria: vi.fn(), horarios: vi.fn(), parametros: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { turno } }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: materiaActiva }));
vi.mock("@/server/profesores/profesor.publico", () => ({
  listarProfesoresActivosPorMateria: profesores, estaDentroDeHorarioAtencion: horario,
  obtenerOpcionProfesorActivo: opcionActiva, profesorActivoDictaMateria: dictaMateria, obtenerHorariosDeAtencion: horarios,
}));
vi.mock("./turno.validaciones", async (importOriginal) => ({
  ...await importOriginal<typeof import("./turno.validaciones")>(), parametrosConfiguracionTurno: parametros,
}));
vi.mock("@/server/profesores/profesor.service", () => ({
  intervalosSeSuperponen: (a: { inicio: number; fin: number }, b: { inicio: number; fin: number }) => a.inicio < b.fin && b.inicio < a.fin,
}));

const { listarOpcionesProfesorTurno, listarProfesoresPorMateria, listarOpcionesProfesorWizard, calcularDisponibilidadProfesor, calcularAgendaProfesorWizard } = await import("./turno.profesor.service");
const TURNO = "ckturno00000000000000001";
const [ANA, BETO, CARLA] = ["ckprofesor000000000000001", "ckprofesor000000000000002", "ckprofesor000000000000003"];
const actual = {
  idTurno: TURNO, estadoTurno: "PENDIENTE", fechaTurno: new Date("2026-10-01T00:00:00.000Z"),
  horaInicioTurno: new Date("1970-01-01T10:00:00.000Z"), duracionMinutosTurno: 60, materiaId: "ckmateria0000000000000001",
};
const otro = (profesorId: string, inicio: string) => ({ profesorId, horaInicioTurno: new Date(`1970-01-01T${inicio}:00.000Z`), duracionMinutosTurno: 60 });

beforeEach(() => {
  vi.clearAllMocks();
  turno.findUnique.mockResolvedValue(actual);
  turno.findMany.mockResolvedValue([]);
  profesores.mockResolvedValue([{ id: ANA, nombre: "Ana", apellido: "Gómez" }, { id: BETO, nombre: "Beto", apellido: "López" }, { id: CARLA, nombre: "Carla", apellido: "Ruiz" }]);
  horario.mockResolvedValue(true);
  materiaActiva.mockResolvedValue({ idMateria: actual.materiaId });
  opcionActiva.mockResolvedValue({ id: ANA, nombreParaMostrar: "Gómez, Ana" });
  dictaMateria.mockResolvedValue(true);
  horarios.mockResolvedValue([{ horario_id: "h1", dia_semana: "MARTES", hora_inicio: "08:00", hora_fin: "12:00" }]);
  parametros.mockResolvedValue({ dias_operativos: ["MARTES", "MIERCOLES"], apertura: "08:00", cierre: "20:00", granularidad_minutos: 30, anticipacion_maxima_dias: 30 });
});

describe("HU-C-07 §2.8.1 listarProfesoresPorMateria", () => {
  it("devuelve solo id, nombre y apellido de los profesores activos asociados, sin filtrar por horario", async () => {
    profesores.mockResolvedValueOnce([{ id: ANA, nombre: "Ana", apellido: "Gómez", interno: "no exponer" }]);
    await expect(listarProfesoresPorMateria(actual.materiaId)).resolves.toEqual([{ id: ANA, nombre: "Ana", apellido: "Gómez" }]);
    expect(materiaActiva).toHaveBeenCalledExactlyOnceWith(actual.materiaId);
    expect(profesores).toHaveBeenCalledExactlyOnceWith(actual.materiaId);
    expect(horario).not.toHaveBeenCalled();
    expect(turno.findMany).not.toHaveBeenCalled();
  });

  it("rechaza una materia inexistente o inactiva antes de listar profesores", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(listarProfesoresPorMateria(actual.materiaId)).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(profesores).not.toHaveBeenCalled();
  });

  it("distingue una materia activa sin profesores asociados", async () => {
    profesores.mockResolvedValueOnce([]);
    await expect(listarProfesoresPorMateria(actual.materiaId)).rejects.toMatchObject({ code: "SIN_PROFESORES_PARA_MATERIA" });
  });
});

describe("Corrección wizard Paso 2 listarOpcionesProfesorWizard", () => {
  it("rechaza materia inactiva antes de consultar el contrato público de Profesor", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(listarOpcionesProfesorWizard(actual.materiaId)).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(profesores).not.toHaveBeenCalled();
    expect(horarios).not.toHaveBeenCalled();
  });

  it("excluye solo a quien no tiene horarios y entrega los horarios de los demás", async () => {
    horarios.mockImplementation(async (id: string) => id === BETO ? [] : [{ horario_id: `h-${id}`, dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" }]);
    await expect(listarOpcionesProfesorWizard(actual.materiaId)).resolves.toEqual([
      { id: ANA, nombre: "Ana", apellido: "Gómez", horarios: [{ horario_id: `h-${ANA}`, dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" }] },
      { id: CARLA, nombre: "Carla", apellido: "Ruiz", horarios: [{ horario_id: `h-${CARLA}`, dia_semana: "MARTES", hora_inicio: "16:00", hora_fin: "20:00" }] },
    ]);
    expect(horarios).toHaveBeenCalledTimes(3);
    expect(horario).not.toHaveBeenCalled();
    expect(turno.findMany).not.toHaveBeenCalled();
  });

  it("con profesores asociados pero sin horarios devuelve lista vacía", async () => {
    horarios.mockResolvedValue([]);
    await expect(listarOpcionesProfesorWizard(actual.materiaId)).resolves.toEqual([]);
  });
});

describe("HU-C-04 §2.6 listarOpcionesProfesorTurno", () => {
  it("devuelve los profesores de la materia libres y dentro de su horario, en el formato { id, nombre, apellido }", async () => {
    await expect(listarOpcionesProfesorTurno(TURNO)).resolves.toEqual([
      { id: ANA, nombre: "Ana", apellido: "Gómez" }, { id: BETO, nombre: "Beto", apellido: "López" }, { id: CARLA, nombre: "Carla", apellido: "Ruiz" },
    ]);
    expect(profesores).toHaveBeenCalledWith(actual.materiaId);
    expect(horario).toHaveBeenCalledWith(ANA, actual.fechaTurno, "10:00", "11:00");
  });
  it("excluye a quien tiene un turno DISPONIBLE/COMPLETO superpuesto y a quien no atiende en ese horario", async () => {
    turno.findMany.mockResolvedValueOnce([otro(ANA, "10:30"), otro(BETO, "11:00")]);
    horario.mockImplementation(async (profesorId: string) => profesorId !== CARLA);
    await expect(listarOpcionesProfesorTurno(TURNO)).resolves.toEqual([{ id: BETO, nombre: "Beto", apellido: "López" }]);
    expect(turno.findMany.mock.calls[0]![0].where).toMatchObject({
      idTurno: { not: TURNO }, fechaTurno: actual.fechaTurno, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] }, profesorId: { in: [ANA, BETO, CARLA] },
    });
    expect(turno.findMany).toHaveBeenCalledTimes(1);
  });
  it("devuelve lista vacía si ninguno está disponible en ese horario", async () => {
    horario.mockResolvedValue(false);
    await expect(listarOpcionesProfesorTurno(TURNO)).resolves.toEqual([]);
  });
  it("distingue una materia sin profesores activos", async () => {
    profesores.mockResolvedValueOnce([]);
    await expect(listarOpcionesProfesorTurno(TURNO)).rejects.toMatchObject({ code: "SIN_PROFESORES_PARA_MATERIA", message: "No hay profesores activos asociados a esta materia" });
  });
  it("rechaza turno inexistente o ya confirmado", async () => {
    turno.findUnique.mockResolvedValueOnce(null);
    await expect(listarOpcionesProfesorTurno(TURNO)).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
    turno.findUnique.mockResolvedValueOnce({ ...actual, estadoTurno: "DISPONIBLE" });
    await expect(listarOpcionesProfesorTurno(TURNO)).rejects.toMatchObject({ code: "TURNO_YA_DISPONIBLE" });
  });
});

describe("HU-C-07 §2.8.2 calcularDisponibilidadProfesor", () => {
  const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
  const consulta = (desde = "2026-09-29", hasta = desde, duracion_min = 60) => ({ materia_id: actual.materiaId, duracion_min, desde: dia(desde), hasta: dia(hasta) });
  const ocupado = (fecha: string, hora: string, duracion: number) => ({ fechaTurno: dia(fecha), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`), duracionMinutosTurno: duracion });

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T07:00:00.000Z")); });
  afterEach(() => vi.useRealTimers());

  it("verifica materia, profesor activo y asociación en ese orden", async () => {
    materiaActiva.mockResolvedValueOnce(null);
    await expect(calcularDisponibilidadProfesor(ANA, consulta())).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    expect(opcionActiva).not.toHaveBeenCalled();
    opcionActiva.mockResolvedValueOnce(null);
    await expect(calcularDisponibilidadProfesor(ANA, consulta())).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    expect(dictaMateria).not.toHaveBeenCalled();
    dictaMateria.mockResolvedValueOnce(false);
    await expect(calcularDisponibilidadProfesor(ANA, consulta())).rejects.toMatchObject({ code: "PROFESOR_NO_DICTA_MATERIA" });
    expect(horarios).not.toHaveBeenCalled();
  });

  it("usa defaults, recorta el rango y rechaza rango efectivo invertido", async () => {
    const base = { materia_id: actual.materiaId, duracion_min: 60 };
    const respuesta = await calcularDisponibilidadProfesor(ANA, base);
    expect(respuesta.rango).toEqual({ desde: "2026-09-29", hasta: "2026-10-29" });
    expect(parametros).toHaveBeenCalled();
    const recortada = await calcularDisponibilidadProfesor(ANA, consulta("2026-09-01", "2026-12-01"));
    expect(recortada.rango).toEqual(respuesta.rango);
    await expect(calcularDisponibilidadProfesor(ANA, consulta("2026-11-01", "2026-12-01"))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(calcularDisponibilidadProfesor(ANA, consulta("2026-09-01", "2026-09-28"))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await calcularDisponibilidadProfesor(ANA, consulta("2026-10-29", "2026-10-29"))).rango).toEqual({ desde: "2026-10-29", hasta: "2026-10-29" });
  });

  it("devuelve forma contractual y franja libre completa con granularidad", async () => {
    const respuesta = await calcularDisponibilidadProfesor(ANA, consulta());
    expect(respuesta).toEqual({
      profesor: { id: ANA, nombre_completo: "Gómez, Ana" }, duracion_min: 60,
      rango: { desde: "2026-09-29", hasta: "2026-09-29" },
      fechas: [{ fecha: "2026-09-29", dia_semana: "MARTES", franjas: [{
        hora_inicio: "08:00", hora_fin: "12:00", tramos_libres: [{ desde: "08:00", hasta: "12:00" }],
        inicios: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"],
      }] }],
    });
    expect(turno.findMany).toHaveBeenCalledWith({ where: { profesorId: ANA, fechaTurno: { gte: dia("2026-09-29"), lte: dia("2026-09-29") }, estadoTurno: { in: ["DISPONIBLE", "COMPLETO"] } }, select: { fechaTurno: true, horaInicioTurno: true, duracionMinutosTurno: true } });
  });

  it.each(["DISPONIBLE", "COMPLETO"])("resta turnos %s usando el intervalo real y conserva los contiguos", async (estado) => {
    const fila = { ...ocupado("2026-09-29", "09:00", 120), estadoTurno: estado };
    turno.findMany.mockImplementationOnce(async ({ where }: { where: { estadoTurno: { in: string[] } } }) =>
      where.estadoTurno.in.includes(fila.estadoTurno) ? [fila] : []);
    const respuesta = await calcularDisponibilidadProfesor(ANA, consulta());
    expect(turno.findMany.mock.calls[0]![0].where.estadoTurno.in).toContain(estado);
    expect(respuesta.fechas[0]?.franjas[0]).toEqual({
      hora_inicio: "08:00", hora_fin: "12:00",
      tramos_libres: [{ desde: "08:00", hasta: "09:00" }, { desde: "11:00", hasta: "12:00" }],
      inicios: ["08:00", "11:00"],
    });
  });

  it("PENDIENTE y CANCELADO no bloquean porque la consulta los excluye", async () => {
    await calcularDisponibilidadProfesor(ANA, consulta());
    expect(turno.findMany.mock.calls[0]![0].where.estadoTurno).toEqual({ in: ["DISPONIBLE", "COMPLETO"] });
  });

  it.each([60, 120, 180])("duración %i ofrece solo inicios que caben completos", async (duracion) => {
    const respuesta = await calcularDisponibilidadProfesor(ANA, consulta("2026-09-29", "2026-09-29", duracion));
    expect(respuesta.fechas[0]?.franjas[0]?.inicios.at(-1)).toBe(duracion === 60 ? "11:00" : duracion === 120 ? "10:00" : "09:00");
  });

  it("omite días no operativos, días sin franja, franjas sin inicios y devuelve fechas vacías", async () => {
    expect((await calcularDisponibilidadProfesor(ANA, consulta("2026-09-29", "2026-10-02"))).fechas.map(({ fecha }) => fecha)).toEqual(["2026-09-29"]);
    horarios.mockResolvedValueOnce([]);
    expect((await calcularDisponibilidadProfesor(ANA, consulta())).fechas).toEqual([]);
    horarios.mockResolvedValueOnce([{ horario_id: "h2", dia_semana: "MARTES", hora_inicio: "08:00", hora_fin: "09:00" }]);
    expect((await calcularDisponibilidadProfesor(ANA, consulta("2026-09-29", "2026-09-29", 120))).fechas).toEqual([]);
  });

  it("conserva una franja ocupada sin inicios cuando otra del mismo día está libre", async () => {
    horarios.mockResolvedValueOnce([
      { horario_id: "h1", dia_semana: "MARTES", hora_inicio: "08:00", hora_fin: "10:00" },
      { horario_id: "h2", dia_semana: "MARTES", hora_inicio: "10:00", hora_fin: "12:00" },
    ]);
    turno.findMany.mockResolvedValueOnce([ocupado("2026-09-29", "08:00", 120)]);
    const respuesta = await calcularDisponibilidadProfesor(ANA, consulta());
    expect(respuesta.fechas).toHaveLength(1);
    expect(respuesta.fechas[0]?.franjas).toEqual([
      { hora_inicio: "08:00", hora_fin: "10:00", tramos_libres: [], inicios: [] },
      { hora_inicio: "10:00", hora_fin: "12:00", tramos_libres: [{ desde: "10:00", hasta: "12:00" }], inicios: ["10:00", "10:30", "11:00"] },
    ]);
  });

  it("limita al horario operativo y elimina inicios de hoy pasados o actuales", async () => {
    vi.setSystemTime(new Date("2026-09-29T12:00:00.000Z")); // 09:00 en Buenos Aires
    horarios.mockResolvedValueOnce([{ horario_id: "h1", dia_semana: "MARTES", hora_inicio: "07:00", hora_fin: "21:00" }]);
    const respuesta = await calcularDisponibilidadProfesor(ANA, consulta());
    expect(respuesta.fechas[0]?.franjas[0]?.hora_inicio).toBe("08:00");
    expect(respuesta.fechas[0]?.franjas[0]?.hora_fin).toBe("20:00");
    expect(respuesta.fechas[0]?.franjas[0]?.inicios[0]).toBe("09:30");
  });

  it("respeta granularidad configurada y omite la fecha si hoy ya no quedan inicios", async () => {
    parametros.mockResolvedValueOnce({ dias_operativos: ["MARTES"], apertura: "08:00", cierre: "20:00", granularidad_minutos: 20, anticipacion_maxima_dias: 30 });
    const respuesta = await calcularDisponibilidadProfesor(ANA, consulta());
    expect(respuesta.fechas[0]?.franjas[0]?.inicios).toContain("08:20");
    expect(respuesta.fechas[0]?.franjas[0]?.inicios).not.toContain("08:30");
    vi.setSystemTime(new Date("2026-09-29T14:30:00.000Z")); // 11:30 local
    expect((await calcularDisponibilidadProfesor(ANA, consulta())).fechas).toEqual([]);
  });

  it("alinea a 90 minutos, igual que la validación del POST/PATCH", async () => {
    parametros.mockResolvedValueOnce({ dias_operativos: ["MARTES"], apertura: "08:00", cierre: "20:00", granularidad_minutos: 90, anticipacion_maxima_dias: 30 });
    const respuesta = await calcularDisponibilidadProfesor(ANA, consulta());
    expect(respuesta.fechas[0]?.franjas[0]?.inicios).toEqual(["09:00", "10:30"]);
  });

  it("usa el día local de Buenos Aires cuando UTC ya pasó a la fecha siguiente", async () => {
    vi.setSystemTime(new Date("2026-09-30T02:50:00.000Z")); // martes 29, 23:50 local
    const respuesta = await calcularDisponibilidadProfesor(ANA, { materia_id: actual.materiaId, duracion_min: 60, hasta: dia("2026-09-29") });
    expect(respuesta.rango.desde).toBe("2026-09-29");
    expect(respuesta.rango.hasta).toBe("2026-09-29");
    expect(respuesta.fechas).toEqual([]);
    expect(turno.findMany.mock.calls[0]![0].where.fechaTurno.gte).toEqual(dia("2026-09-29"));
  });
});

describe("Corrección wizard Paso 3 calcularAgendaProfesorWizard", () => {
  const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
  const consulta = (duracion_min = 60, desde = "2026-09-29", hasta = desde) => ({ materia_id: actual.materiaId, duracion_min, desde: dia(desde), hasta: dia(hasta) });
  const ocupado = (fecha: string, hora: string, duracion: number) => ({ fechaTurno: dia(fecha), horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`), duracionMinutosTurno: duracion });
  const diaAgenda = async (duracion = 60) => (await calcularAgendaProfesorWizard(ANA, consulta(duracion))).meses[0]!.dias.find(({ fecha }) => fecha === "2026-09-29")!;

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T07:00:00.000Z")); });
  afterEach(() => vi.useRealTimers());

  it("sin turnos entrega rango, mes completo, franja recurrente y bloques libres iguales a C-07", async () => {
    const agenda = await calcularAgendaProfesorWizard(ANA, consulta());
    const contractual = await calcularDisponibilidadProfesor(ANA, consulta());
    expect(agenda).toMatchObject({ profesor: contractual.profesor, duracion_min: 60, granularidad_min: 30,
      rango: contractual.rango, franjas_recurrentes: [{ horario_id: "h1", dia_semana: "MARTES", hora_inicio: "08:00", hora_fin: "12:00" }],
      meses: [{ anio: 2026, mes: 9, etiqueta: "Septiembre 2026" }],
    });
    expect(agenda.meses[0]!.dias).toHaveLength(30);
    const fecha = await diaAgenda();
    expect(fecha).toMatchObject({ fecha: "2026-09-29", dia_semana: "MARTES", numero: 29, en_rango: true, operativo: true, seleccionable: true, tiene_horarios_libres: true });
    expect(fecha.franjas[0]).toMatchObject({ hora_inicio: "08:00", hora_fin: "12:00", tramos_libres: [{ desde: "08:00", hasta: "12:00" }], tramos_ocupados: [] });
    expect(fecha.franjas[0]).not.toHaveProperty("inicios");
    expect(fecha.franjas[0]!.bloques[0]).toEqual({ inicio: "08:00", fin: "09:00", estado: "LIBRE", seleccionable: true });
    expect(fecha.franjas[0]!.bloques.filter(({ seleccionable }) => seleccionable).map(({ inicio }) => inicio)).toEqual(contractual.fechas[0]!.franjas[0]!.inicios);
  });

  it("ocupación parcial explícita marca cada inicio superpuesto y conserva contigüidad", async () => {
    turno.findMany.mockResolvedValue([ocupado("2026-09-29", "09:00", 120)]);
    const fecha = await diaAgenda();
    expect(fecha.franjas[0]!.tramos_ocupados).toEqual([{ desde: "09:00", hasta: "11:00" }]);
    expect(fecha.franjas[0]!.tramos_libres).toEqual([{ desde: "08:00", hasta: "09:00" }, { desde: "11:00", hasta: "12:00" }]);
    expect(fecha.franjas[0]!.bloques.find(({ inicio }) => inicio === "08:00")?.estado).toBe("LIBRE");
    expect(fecha.franjas[0]!.bloques.find(({ inicio }) => inicio === "08:30")?.estado).toBe("OCUPADO");
    expect(fecha.franjas[0]!.bloques.find(({ inicio }) => inicio === "11:00")?.estado).toBe("LIBRE");
    expect(fecha.franjas[0]!.bloques.find(({ inicio }) => inicio === "08:30")?.seleccionable).toBe(false);
  });

  it("franja totalmente ocupada conserva fecha y ocupados, sin hacerla seleccionable", async () => {
    turno.findMany.mockResolvedValue([ocupado("2026-09-29", "08:00", 240)]);
    const fecha = await diaAgenda();
    expect(fecha.franjas[0]!.tramos_libres).toEqual([]);
    expect(fecha.franjas[0]!.tramos_ocupados).toEqual([{ desde: "08:00", hasta: "12:00" }]);
    expect(fecha.franjas[0]!.bloques.every(({ estado, seleccionable }) => estado === "OCUPADO" && !seleccionable)).toBe(true);
    expect(fecha.seleccionable).toBe(false);
  });

  it("dos ocupaciones en una franja dejan solo los inicios realmente válidos", async () => {
    turno.findMany.mockResolvedValue([ocupado("2026-09-29", "08:30", 60), ocupado("2026-09-29", "10:00", 60)]);
    const fecha = await diaAgenda();
    expect(fecha.franjas[0]!.tramos_ocupados).toEqual([{ desde: "08:30", hasta: "09:30" }, { desde: "10:00", hasta: "11:00" }]);
    expect(fecha.franjas[0]!.bloques.filter(({ seleccionable }) => seleccionable).map(({ inicio }) => inicio)).toEqual(["11:00"]);
  });

  it.each([60, 120, 180])("duración %i entrega fin completo y solo inicios contractuales", async (duracion) => {
    const fecha = await diaAgenda(duracion);
    const contractual = await calcularDisponibilidadProfesor(ANA, consulta(duracion));
    const libres = fecha.franjas[0]!.bloques.filter(({ seleccionable }) => seleccionable);
    expect(libres.map(({ inicio }) => inicio)).toEqual(contractual.fechas[0]!.franjas[0]!.inicios);
    expect(libres[0]!.fin).toBe(duracion === 60 ? "09:00" : duracion === 120 ? "10:00" : "11:00");
  });

  it("usa granularidad y distingue VENCIDO de OCUPADO", async () => {
    parametros.mockResolvedValue({ dias_operativos: ["MARTES"], apertura: "08:00", cierre: "20:00", granularidad_minutos: 20, anticipacion_maxima_dias: 30 });
    vi.setSystemTime(new Date("2026-09-29T11:15:00.000Z")); // 08:15 local
    const fecha = await diaAgenda();
    expect(fecha.franjas[0]!.bloques.find(({ inicio }) => inicio === "08:00")?.estado).toBe("VENCIDO");
    expect(fecha.franjas[0]!.bloques.find(({ inicio }) => inicio === "08:20")?.estado).toBe("LIBRE");
    expect(fecha.franjas[0]!.bloques.some(({ inicio }) => inicio === "08:30")).toBe(false);
  });

  it("incluye fecha operativa sin horario, no operativa y días fuera del rango sin selección", async () => {
    const agenda = await calcularAgendaProfesorWizard(ANA, consulta(60, "2026-09-29", "2026-10-02"));
    const sept = agenda.meses[0]!.dias;
    const oct = agenda.meses[1]!.dias;
    expect(sept.find(({ fecha }) => fecha === "2026-09-30")).toMatchObject({ operativo: true, franjas: [], seleccionable: false });
    expect(oct.find(({ fecha }) => fecha === "2026-10-01")).toMatchObject({ operativo: false, franjas: [], seleccionable: false });
    expect(oct.find(({ fecha }) => fecha === "2026-10-03")).toMatchObject({ en_rango: false, seleccionable: false });
  });

  it("recorta el rango igual que C-07 y conserva sus errores de validación", async () => {
    const agenda = await calcularAgendaProfesorWizard(ANA, consulta(60, "2026-09-01", "2026-12-01"));
    expect(agenda.rango).toEqual({ desde: "2026-09-29", hasta: "2026-10-29" });
    await expect(calcularAgendaProfesorWizard(ANA, consulta(60, "2026-11-01", "2026-12-01"))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    materiaActiva.mockResolvedValueOnce(null);
    await expect(calcularAgendaProfesorWizard(ANA, consulta())).rejects.toMatchObject({ code: "MATERIA_NO_DISPONIBLE" });
    opcionActiva.mockResolvedValueOnce(null);
    await expect(calcularAgendaProfesorWizard(ANA, consulta())).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    dictaMateria.mockResolvedValueOnce(false);
    await expect(calcularAgendaProfesorWizard(ANA, consulta())).rejects.toMatchObject({ code: "PROFESOR_NO_DICTA_MATERIA" });
  });
});
