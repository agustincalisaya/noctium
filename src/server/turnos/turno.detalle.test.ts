import type { RolUsuario } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { turno, turnoAlumno, obtenerOpcionProfesorDeUsuario, obtenerEmailDeUsuario, listarPagosDeTurno, obtenerClaseDictadaDeTurno, profesorPuedeRegistrarIndicacion, existeInscripcionVigente } = vi.hoisted(() => ({
  turno: { findFirst: vi.fn() },
  turnoAlumno: { findMany: vi.fn() },
  obtenerOpcionProfesorDeUsuario: vi.fn(),
  obtenerEmailDeUsuario: vi.fn(),
  listarPagosDeTurno: vi.fn(),
  obtenerClaseDictadaDeTurno: vi.fn(),
  profesorPuedeRegistrarIndicacion: vi.fn(),
  existeInscripcionVigente: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { turno, turnoAlumno } }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario }));
vi.mock("@/server/pagos/pago.publico", () => ({ listarPagosDeTurno }));
vi.mock("@/server/historial/historial.publico", () => ({ obtenerClaseDictadaDeTurno, profesorPuedeRegistrarIndicacion }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({ existeInscripcionVigenteConProfesor: existeInscripcionVigente }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: vi.fn() }));
vi.mock("@/server/materias/materia.service", () => ({ verificarMateriaActiva: vi.fn() }));
vi.mock("@/server/profesores/profesor.service", () => ({ profesorActivoDictaMateria: vi.fn(), estaDentroDeHorarioAtencion: vi.fn(), intervalosSeSuperponen: vi.fn(), listarProfesoresActivosPorMateria: vi.fn() }));
vi.mock("@/server/alumnos/alumno.service", () => ({ verificarAlumnoActivo: vi.fn() }));
vi.mock("@/server/aulas/aula.publico", () => ({ verificarAulaActiva: vi.fn() }));

const { obtenerDetalleTurno } = await import("./turno.detalle");

const MESA = { id: "usuario-mesa", rol: "MESA_ENTRADA" as const };
const GERENTE = { id: "usuario-gerente", rol: "GERENTE" as const };
const PROFESOR = { id: "usuario-prof", rol: "PROFESOR" as const };
const CAPACIDADES_MESA = { verPagos: true, verHistorial: true, cancelar: true, reprogramar: true, priorizar: true, registrarPago: true, registrarClase: true };
const CAPACIDADES_GERENTE = { verPagos: true, verHistorial: true, cancelar: false, reprogramar: false, priorizar: false, registrarPago: false, registrarClase: false };
const CAPACIDADES_PROFESOR = { ...CAPACIDADES_GERENTE, verPagos: false, registrarClase: true };
// Antes del inicio (16:00 del 06/10/2026 en Buenos Aires).
const AHORA = new Date("2026-10-06T12:00:00.000-03:00");

type Estado = "PENDIENTE" | "DISPONIBLE" | "COMPLETO" | "CANCELADO";
const registro = ({ estado = "DISPONIBLE" as Estado, cupo = 5 as number | null, alumnos = 2, creadoPor = "usuario-mesa" as string | null, conProfesor = true } = {}) => ({
  idTurno: "turno-1", fechaTurno: new Date("2026-10-06T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T16:00:00.000Z"),
  duracionMinutosTurno: 60, cupoMaximoTurno: cupo, estadoTurno: estado, prioridadTurno: "ALTA",
  profesorId: conProfesor ? "profesor-1" : null,
  profesor: conProfesor ? { idProfesor: "profesor-1", apellidoProfesor: "Méndez", nombreProfesor: "Laura", dniProfesor: "20111222" } : null,
  materiaId: "materia-1", materia: { idMateria: "materia-1", nombreMateria: "Matemática", codigoMateria: "MAT" },
  aulaId: cupo === null ? null : "aula-1", aula: cupo === null ? null : { idAula: "aula-1", nombreAula: "Aula 3", capacidadAula: 6 },
  alumnos: Array.from({ length: alumnos }, (_, i) => ({ turnoId: "turno-1", alumnoId: `alumno-${i}`, alumno: { idAlumno: `alumno-${i}`, apellidoAlumno: "Pérez", nombreAlumno: `Ana ${i}`, dniAlumno: `3000000${i}` } })),
  createdAtTurno: new Date("2026-09-24T12:00:00.000Z"), updatedAtTurno: new Date("2026-09-25T12:00:00.000Z"),
  creadoPorUsuarioId: creadoPor, modificadoPorUsuarioId: "usuario-otro",
});
const PAGO = { id: "pago-1", alumno: { id: "alumno-retirado", nombre_completo: "Ruiz, Tomás" }, monto: "12000.00", forma_pago: { id: "fp", nombre: "Efectivo" }, fecha_pago: "2026-10-01", registrado_en: "2026-10-01T15:00:00.000Z" };

type Usuario = { id: string; rol: RolUsuario };
const detalle = (usuario: Usuario = MESA, capacidades = CAPACIDADES_MESA) => obtenerDetalleTurno("turno-1", usuario, { capacidades, ahora: AHORA });
const ok = async (usuario: Usuario = MESA, capacidades = CAPACIDADES_MESA) => {
  const resultado = await detalle(usuario, capacidades);
  if (resultado.resultado !== "ok") throw new Error(`se esperaba ok y llegó ${resultado.resultado}`);
  return resultado.turno;
};

beforeEach(() => {
  vi.clearAllMocks();
  turno.findFirst.mockResolvedValue(registro());
  turnoAlumno.findMany.mockResolvedValue([]);
  obtenerEmailDeUsuario.mockResolvedValue("mesa@centro.com");
  obtenerOpcionProfesorDeUsuario.mockResolvedValue({ id: "profesor-1", nombreParaMostrar: "Méndez, Laura" });
  listarPagosDeTurno.mockResolvedValue([PAGO]);
  obtenerClaseDictadaDeTurno.mockResolvedValue(null);
  profesorPuedeRegistrarIndicacion.mockResolvedValue(false);
  existeInscripcionVigente.mockResolvedValue(false);
});

describe("HU-C-09 alcance por rol (AC2)", () => {
  it("Mesa de Entrada consulta cualquier turno por id, con la proyección de la excepción de §3.11", async () => {
    await ok();
    expect(obtenerOpcionProfesorDeUsuario).not.toHaveBeenCalled();
    expect(turno.findFirst).toHaveBeenCalledWith({
      where: { idTurno: "turno-1" },
      include: {
        materia: { select: { idMateria: true, nombreMateria: true, codigoMateria: true } },
        profesor: { select: { idProfesor: true, apellidoProfesor: true, nombreProfesor: true, dniProfesor: true } },
        aula: { select: { idAula: true, nombreAula: true, capacidadAula: true } },
        // Solo las inscripciones vigentes ahora (PR-0.md §2.0 y §2.2).
        alumnos: {
          include: { alumno: { select: { idAlumno: true, apellidoAlumno: true, nombreAlumno: true, dniAlumno: true } } },
          where: expect.objectContaining({ vigencia: "VIGENTE" }),
        },
      },
    });
  });

  it.each([[MESA], [GERENTE]])("un id inexistente es no_encontrado para %o", async (usuario) => {
    turno.findFirst.mockResolvedValue(null);
    await expect(detalle(usuario)).resolves.toEqual({ resultado: "no_encontrado" });
  });

  it("el Profesor ve su turno: la ficha sale de la sesión (D) y el where filtra id y profesor a la vez", async () => {
    await ok(PROFESOR, CAPACIDADES_PROFESOR);
    expect(obtenerOpcionProfesorDeUsuario).toHaveBeenCalledWith("usuario-prof");
    expect(turno.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { idTurno: "turno-1", profesorId: "profesor-1" } }));
  });

  it("turno ajeno e inexistente dan el mismo sin_permiso para el Profesor", async () => {
    turno.findFirst.mockResolvedValue(null);
    await expect(detalle(PROFESOR, CAPACIDADES_PROFESOR)).resolves.toEqual({ resultado: "sin_permiso" });
  });

  it("una cuenta de Profesor sin ficha da sin_permiso sin leer el turno", async () => {
    obtenerOpcionProfesorDeUsuario.mockResolvedValue(null);
    await expect(detalle(PROFESOR, CAPACIDADES_PROFESOR)).resolves.toEqual({ resultado: "sin_permiso" });
    expect(turno.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["D", () => obtenerOpcionProfesorDeUsuario.mockRejectedValue(new Error("D caído")), PROFESOR],
    ["Prisma", () => turno.findFirst.mockRejectedValue(new Error("Prisma caído")), MESA],
    ["A", () => obtenerEmailDeUsuario.mockRejectedValue(new Error("A caído")), MESA],
    ["I", () => listarPagosDeTurno.mockRejectedValue(new Error("I caído")), MESA],
  ])("un fallo de %s se propaga: nunca se traduce en sin_permiso", async (_modulo, fallar, usuario) => {
    fallar();
    await expect(detalle(usuario, usuario === PROFESOR ? CAPACIDADES_PROFESOR : CAPACIDADES_MESA)).rejects.toThrow("caído");
  });
});

describe("HU-C-09 campos del detalle (AC1)", () => {
  it("agrega prioridad y el email del creador por A; retira modificado_por y conserva los ids de auditoría", async () => {
    const resultado = await ok();
    expect(resultado).toMatchObject({
      materia: "Matemática", profesor: "Méndez, Laura", fecha: "2026-10-06", hora_inicio: "16:00", hora_fin: "17:00",
      duracion_minutos: 60, aula: "Aula 3", cupo_maximo: 5, estado: "DISPONIBLE", prioridad: "ALTA",
      creado_en: "2026-09-24T12:00:00.000Z", creado_por: "mesa@centro.com", creado_por_id: "usuario-mesa", modificado_por_id: "usuario-otro",
    });
    expect(resultado).not.toHaveProperty("modificado_por");
    expect(obtenerEmailDeUsuario).toHaveBeenCalledExactlyOnceWith("usuario-mesa");
  });

  it("sin creador registrado, creado_por es null y no se consulta A", async () => {
    turno.findFirst.mockResolvedValue(registro({ creadoPor: null }));
    expect((await ok()).creado_por).toBeNull();
    expect(obtenerEmailDeUsuario).not.toHaveBeenCalled();
  });

  it("si A no encuentra la cuenta, creado_por es null: nunca el id como respaldo", async () => {
    obtenerEmailDeUsuario.mockResolvedValue(null);
    const resultado = await ok();
    expect(resultado.creado_por).toBeNull();
    expect(resultado.creado_por_id).toBe("usuario-mesa");
  });

  it("lista todos los alumnos inscriptos, sin paginar, como «Apellido, Nombre»", async () => {
    turno.findFirst.mockResolvedValue(registro({ cupo: 30, alumnos: 25 }));
    const resultado = await ok();
    expect(resultado.alumnos).toHaveLength(25);
    expect(resultado.alumnos[0]).toEqual({ id: "alumno-0", nombre: "Pérez, Ana 0", dni: "30000000", puede_ver_historial: true });
    expect(resultado.alumnos_inscriptos).toBe("25/30");
  });

  it("da al Profesor acceso al historial de su materia desde una inscripción vigente, antes de la primera clase", async () => {
    existeInscripcionVigente.mockResolvedValue(true);
    const resultado = await ok(PROFESOR, CAPACIDADES_PROFESOR);
    expect(resultado.alumnos[0]?.puede_ver_historial).toBe(true);
    expect(existeInscripcionVigente).toHaveBeenCalledWith("alumno-0", "profesor-1", "materia-1");
  });

  it("solo da al Profesor el historial cuando tiene inscripción vigente o clase propia en la materia", async () => {
    const resultado = await ok(PROFESOR, CAPACIDADES_PROFESOR);
    expect(resultado.alumnos[0]?.puede_ver_historial).toBe(false);
    profesorPuedeRegistrarIndicacion.mockResolvedValue(true);
    const resultadoConClase = await ok(PROFESOR, CAPACIDADES_PROFESOR);
    expect(resultadoConClase.alumnos[0]?.puede_ver_historial).toBe(true);
  });

  it.each([
    ["DISPONIBLE sin alumnos", { cupo: 5, alumnos: 0 }, "0/5"],
    ["PENDIENTE con cupo y sin alumnos", { estado: "PENDIENTE" as Estado, cupo: 6, alumnos: 0 }, "0/6"],
    ["PENDIENTE sin aula ni cupo", { estado: "PENDIENTE" as Estado, cupo: null, alumnos: 0, conProfesor: false }, "Sin asignar"],
    ["CANCELADO vacío", { estado: "CANCELADO" as Estado, cupo: 5, alumnos: 0 }, "0/5"],
    ["CANCELADO con alumnos", { estado: "CANCELADO" as Estado, cupo: 5, alumnos: 3 }, "3/5"],
  ])("%s → alumnos_inscriptos %s", async (_caso, opciones, esperado) => {
    turno.findFirst.mockResolvedValue(registro(opciones));
    const resultado = await ok();
    expect(resultado.alumnos_inscriptos).toBe(esperado);
    expect(resultado.alumnos).toHaveLength(opciones.alumnos);
  });

  it("un PENDIENTE sin asignar muestra «Sin asignar» en profesor y aula, y cupo null", async () => {
    turno.findFirst.mockResolvedValue(registro({ estado: "PENDIENTE", cupo: null, alumnos: 0, conProfesor: false }));
    expect(await ok()).toMatchObject({ profesor: "Sin asignar", aula: "Sin asignar", cupo_maximo: null, profesor_id: null, aula_id: null });
  });
});

describe("HU-C-09 pagos (AC1, Q6d)", () => {
  it("con pagos:leer incluye la lista completa de I, con pagos de alumnos ya retirados", async () => {
    const resultado = await ok();
    expect(listarPagosDeTurno).toHaveBeenCalledExactlyOnceWith("turno-1");
    expect(resultado.pagos).toEqual([PAGO]);
  });

  it("con pagos:leer y sin registros devuelve []", async () => {
    listarPagosDeTurno.mockResolvedValue([]);
    expect((await ok(GERENTE, CAPACIDADES_GERENTE)).pagos).toEqual([]);
  });

  it("sin pagos:leer la propiedad se omite y no se consulta I", async () => {
    const resultado = await ok(MESA, { ...CAPACIDADES_MESA, verPagos: false });
    expect(resultado).not.toHaveProperty("pagos");
    expect(listarPagosDeTurno).not.toHaveBeenCalled();
  });

  it("el Profesor nunca recibe pagos, aunque la capacidad llegara en true", async () => {
    const resultado = await ok(PROFESOR, { ...CAPACIDADES_PROFESOR, verPagos: true });
    expect(resultado).not.toHaveProperty("pagos");
    expect(listarPagosDeTurno).not.toHaveBeenCalled();
  });
});

describe("HU-C-24 reservas pendientes (C §2.18.4)", () => {
  const RESERVADA = { alumnoId: "alumno-0", idInscripcion: "insc-0", estadoPago: "RESERVADA", venceEl: new Date("2026-10-06T15:00:00.000-03:00"), precio: 24000 };
  const PAGADA = { alumnoId: "alumno-1", idInscripcion: "insc-1", estadoPago: "PAGADA", venceEl: null, precio: 24000 };
  const SIN_REGISTRAR = { alumnoId: "alumno-1", idInscripcion: "insc-1", estadoPago: "PAGO_SIN_REGISTRAR", venceEl: null, precio: 24000 };

  it("Mesa ve la reserva con su vencimiento y el acceso a «Registrar pago»", async () => {
    turnoAlumno.findMany.mockResolvedValue([RESERVADA, PAGADA]);
    const { alumnos } = await ok();
    expect(alumnos[0]).toMatchObject({
      inscripcion: { id: "insc-0", estado_pago: "RESERVADA", vence_el: "2026-10-06T15:00:00-03:00", precio: 24000 }, puede_registrar_pago: true,
    });
    // Una inscripción pagada informa su estado y no ofrece cobro; sin vencimiento.
    expect(alumnos[1]).toMatchObject({ inscripcion: { id: "insc-1", estado_pago: "PAGADA", precio: 24000 }, puede_registrar_pago: false });
    expect(alumnos[1]!.inscripcion).not.toHaveProperty("vence_el");
  });

  it("ofrece el cobro también para «Pago sin registrar» en una clase que no empezó", async () => {
    turnoAlumno.findMany.mockResolvedValue([SIN_REGISTRAR]);
    expect((await ok()).alumnos[1]).toMatchObject({ inscripcion: { estado_pago: "PAGO_SIN_REGISTRAR" }, puede_registrar_pago: true });
  });

  it("consulta solo las inscripciones vigentes a ahora (una reserva vencida sin marcar no figura)", async () => {
    await ok();
    const { where } = turnoAlumno.findMany.mock.calls[0]![0];
    expect(where.turnoId).toBe("turno-1");
    expect(where.OR).toBeDefined();
  });

  it("en una clase que ya empezó informa la reserva pero no ofrece cobro", async () => {
    turnoAlumno.findMany.mockResolvedValue([RESERVADA]);
    const empezada = await obtenerDetalleTurno("turno-1", MESA, { capacidades: CAPACIDADES_MESA, ahora: new Date("2026-10-06T16:30:00.000-03:00") });
    expect(empezada.resultado === "ok" && empezada.turno.alumnos[0]).toMatchObject({ inscripcion: { estado_pago: "RESERVADA" }, puede_registrar_pago: false });
  });

  it("en una clase cancelada no ofrece cobro", async () => {
    turno.findFirst.mockResolvedValue(registro({ estado: "CANCELADO" }));
    turnoAlumno.findMany.mockResolvedValue([RESERVADA]);
    expect((await ok()).alumnos[0]).toMatchObject({ puede_registrar_pago: false });
  });

  it("el Gerente ve la reserva en modo consulta: sin permiso de cobro no hay acceso a «Registrar pago»", async () => {
    turnoAlumno.findMany.mockResolvedValue([RESERVADA]);
    expect((await ok(GERENTE, CAPACIDADES_GERENTE)).alumnos[0]).toMatchObject({ inscripcion: { estado_pago: "RESERVADA" }, puede_registrar_pago: false });
  });

  it("sin pagos:leer, y para el Profesor, se omiten ambos campos y ni siquiera se consultan las inscripciones", async () => {
    turnoAlumno.findMany.mockResolvedValue([RESERVADA]);
    for (const [usuario, capacidades] of [[MESA, { ...CAPACIDADES_MESA, verPagos: false }], [PROFESOR, { ...CAPACIDADES_PROFESOR, verPagos: true }]] as const) {
      const { alumnos } = await ok(usuario, capacidades);
      expect(alumnos[0]).not.toHaveProperty("inscripcion");
      expect(alumnos[0]).not.toHaveProperty("puede_registrar_pago");
    }
    expect(turnoAlumno.findMany).not.toHaveBeenCalled();
  });
});

describe("HU-C-09 acciones_habilitadas", () => {
  it("Mesa de Entrada en un turno vigente con alumnos", async () => {
    expect((await ok()).acciones_habilitadas).toEqual(["cancelar", "reprogramar", "prioridad", "registrar_pago"]);
  });

  it("el Gerente recibe []", async () => {
    expect((await ok(GERENTE, CAPACIDADES_GERENTE)).acciones_habilitadas).toEqual([]);
  });

  it("un CANCELADO no tiene acciones", async () => {
    turno.findFirst.mockResolvedValue(registro({ estado: "CANCELADO" }));
    expect((await ok()).acciones_habilitadas).toEqual([]);
  });

  it("registrar_clase se emite para Mesa cuando el turno terminó y aún no tiene clase dictada", async () => {
    const despues = await obtenerDetalleTurno("turno-1", MESA, { capacidades: CAPACIDADES_MESA, ahora: new Date("2026-10-06T18:00:00.000-03:00") });
    expect(despues.resultado === "ok" && despues.turno.acciones_habilitadas).toEqual(["prioridad", "registrar_pago", "registrar_clase"]);
  });
});
