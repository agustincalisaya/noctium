import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-J-01: servicio del módulo J, con `prisma`, el módulo D y los parámetros
// mockeados.

vi.mock("@/lib/prisma", () => ({
  prisma: { turno: { findMany: vi.fn() } },
}));

vi.mock("@/server/profesores/profesor.service", () => ({
  obtenerOpcionProfesorActivo: vi.fn(),
  obtenerOpcionProfesorDeUsuario: vi.fn(),
}));

vi.mock("@/server/shared/parametros", () => ({
  obtenerParametrosHorarioOperativo: vi.fn(),
}));

const { prisma } = await import("@/lib/prisma");
const { obtenerOpcionProfesorActivo, obtenerOpcionProfesorDeUsuario } = await import(
  "@/server/profesores/profesor.service"
);
const { obtenerParametrosHorarioOperativo } = await import("@/server/shared/parametros");
const { listarTurnosAgendadosDeProfesor, obtenerCalendarioProfesor, resolverProfesorDeLaAgenda } =
  await import("@/server/calendario/calendario.service");

const PROPIO = { id: "ckprofesorpropio", nombreParaMostrar: "Giménez, Laura" };
const OTRO = { id: "ckprofesorotro", nombreParaMostrar: "Acuña, Martín" };

function filaTurno({
  id = "ckturno1",
  fecha = "2026-09-22",
  hora = "10:00",
  duracion = 60,
  alumnos = [["Pérez", "Ana"]],
  aula = "Aula 2" as string | null,
} = {}) {
  return {
    idTurno: id,
    fechaTurno: new Date(`${fecha}T00:00:00.000Z`),
    horaInicioTurno: new Date(`1970-01-01T${hora}:00.000Z`),
    duracionMinutosTurno: duracion,
    materia: { nombreMateria: "Matemática" },
    aula: aula ? { nombreAula: aula } : null,
    alumnos: alumnos.map(([apellidoAlumno, nombreAlumno]) => ({ alumno: { apellidoAlumno, nombreAlumno } })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.turno.findMany).mockResolvedValue([]);
  vi.mocked(obtenerParametrosHorarioOperativo).mockResolvedValue({
    diasOperativos: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
    apertura: "08:00",
    cierre: "20:00",
    granularidadMinutos: 30,
  });
});

describe("listarTurnosAgendadosDeProfesor (criterios 3 y 4)", () => {
  it("filtra AGENDADO en la query, por profesor y rango [desde, hasta)", async () => {
    const desde = new Date("2026-09-21T00:00:00.000Z");
    const hasta = new Date("2026-09-26T00:00:00.000Z");

    await listarTurnosAgendadosDeProfesor("ckprofesor", desde, hasta);

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({
      profesorId: "ckprofesor",
      estadoTurno: "AGENDADO",
      fechaTurno: { gte: desde, lt: hasta },
    });
  });

  it("arma el evento con la forma de la spec y la hora de fin por duración", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([filaTurno({ hora: "14:00", duracion: 180 })] as never);

    const [evento] = await listarTurnosAgendadosDeProfesor("ckprofesor", new Date(), new Date());

    expect(evento).toEqual({
      turno_id: "ckturno1",
      fecha: "2026-09-22",
      hora_inicio: "14:00",
      hora_fin: "17:00",
      alumno: "Pérez, Ana",
      materia: "Matemática",
      aula: "Aula 2",
      estado: "AGENDADO",
    });
  });

  it("une los alumnos de un turno grupal con '; ' y usa '—' si falta alumno o aula", async () => {
    vi.mocked(prisma.turno.findMany).mockResolvedValue([
      filaTurno({ alumnos: [["Pérez", "Ana"], ["Ruiz", "Marcos"]] }),
      filaTurno({ id: "ckturno2", alumnos: [], aula: null }),
    ] as never);

    const [grupal, incompleto] = await listarTurnosAgendadosDeProfesor("ckprofesor", new Date(), new Date());

    expect(grupal!.alumno).toBe("Pérez, Ana; Ruiz, Marcos");
    expect(incompleto!.alumno).toBe("—");
    expect(incompleto!.aula).toBe("—");
  });
});

describe("resolverProfesorDeLaAgenda (criterio 2)", () => {
  it("PROFESOR sin profesorId: usa la ficha vinculada a su cuenta", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);

    const profesor = await resolverProfesorDeLaAgenda({ id: "ckusuario", rol: "PROFESOR" }, undefined, {
      rechazarAjeno: true,
    });

    expect(profesor).toEqual(PROPIO);
    expect(obtenerOpcionProfesorDeUsuario).toHaveBeenCalledWith("ckusuario");
  });

  it("PROFESOR con profesorId ajeno en la página: se ignora y ve la propia", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);

    const profesor = await resolverProfesorDeLaAgenda({ id: "ckusuario", rol: "PROFESOR" }, OTRO.id, {
      rechazarAjeno: false,
    });

    expect(profesor).toEqual(PROPIO);
    expect(obtenerOpcionProfesorActivo).not.toHaveBeenCalled();
  });

  it("PROFESOR con profesorId ajeno en la API: SIN_PERMISO sin consultar turnos", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(PROPIO);

    await expect(
      obtenerCalendarioProfesor({
        usuario: { id: "ckusuario", rol: "PROFESOR" },
        profesorIdSolicitado: OTRO.id,
        lunes: "2026-09-21",
        rechazarAjeno: true,
      }),
    ).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(prisma.turno.findMany).not.toHaveBeenCalled();
    expect(obtenerOpcionProfesorActivo).not.toHaveBeenCalled();
  });

  it("PROFESOR sin ficha vinculada: PROFESOR_SIN_FICHA", async () => {
    vi.mocked(obtenerOpcionProfesorDeUsuario).mockResolvedValue(null);

    await expect(
      resolverProfesorDeLaAgenda({ id: "ckusuario", rol: "PROFESOR" }, undefined, { rechazarAjeno: false }),
    ).rejects.toMatchObject({ code: "PROFESOR_SIN_FICHA" });
  });

  it("Mesa/Gerente: el profesor debe estar activo", async () => {
    vi.mocked(obtenerOpcionProfesorActivo).mockResolvedValueOnce(OTRO).mockResolvedValueOnce(null);

    await expect(
      resolverProfesorDeLaAgenda({ id: "ckmesa", rol: "MESA_ENTRADA" }, OTRO.id, { rechazarAjeno: true }),
    ).resolves.toEqual(OTRO);
    await expect(
      resolverProfesorDeLaAgenda({ id: "ckgerente", rol: "GERENTE" }, "ckinactivo", { rechazarAjeno: true }),
    ).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
    await expect(
      resolverProfesorDeLaAgenda({ id: "ckgerente", rol: "GERENTE" }, undefined, { rechazarAjeno: true }),
    ).rejects.toMatchObject({ code: "PROFESOR_NO_ENCONTRADO" });
  });

  it("Alumno: SIN_PERMISO", async () => {
    await expect(
      resolverProfesorDeLaAgenda({ id: "ckalumno", rol: "ALUMNO" }, OTRO.id, { rechazarAjeno: true }),
    ).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
});

describe("obtenerCalendarioProfesor (criterios 1 y 7)", () => {
  it("consulta del primer al último día operativo y devuelve días, horario y rango", async () => {
    vi.mocked(obtenerOpcionProfesorActivo).mockResolvedValue(OTRO);

    const calendario = await obtenerCalendarioProfesor({
      usuario: { id: "ckgerente", rol: "GERENTE" },
      profesorIdSolicitado: OTRO.id,
      lunes: "2026-09-21",
      rechazarAjeno: true,
    });

    const args = vi.mocked(prisma.turno.findMany).mock.calls[0]![0]!;
    expect(args.where).toMatchObject({
      profesorId: OTRO.id,
      fechaTurno: {
        gte: new Date("2026-09-21T00:00:00.000Z"),
        lt: new Date("2026-09-26T00:00:00.000Z"),
      },
    });
    expect(calendario.profesor).toEqual({ id: OTRO.id, nombre_completo: "Acuña, Martín" });
    expect(calendario.rango).toEqual({ desde: "2026-09-21", hasta: "2026-09-25" });
    expect(calendario.dias.map(({ dia }) => dia)).toEqual(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]);
    expect(calendario.horario).toEqual({ apertura: "08:00", cierre: "20:00", granularidadMinutos: 30 });
    expect(calendario.eventos).toEqual([]);
  });
});
