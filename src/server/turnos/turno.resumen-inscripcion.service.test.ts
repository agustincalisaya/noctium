import { beforeEach, describe, expect, it, vi } from "vitest";
import { conReloj } from "@/server/shared/reloj";

const { db, alumno, materias, tarifas, profesores, aula, parametros } = vi.hoisted(() => ({
  db: { turno: { findUnique: vi.fn() }, turnoAlumno: { findMany: vi.fn() } },
  alumno: vi.fn(), materias: vi.fn(), tarifas: vi.fn(), profesores: vi.fn(), aula: vi.fn(), parametros: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/alumnos/alumno.publico", () => ({ obtenerAlumnoDeUsuario: alumno }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: materias, obtenerTarifasPorIds: tarifas }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerNombresProfesores: profesores }));
vi.mock("@/server/aulas/aula.publico", () => ({ obtenerNombreAula: aula }));
vi.mock("@/server/shared/parametros-vigentes", () => ({ parametrosVigentes: parametros }));
const { obtenerResumenInscripcion } = await import("@/server/turnos/turno.resumen-inscripcion.service");
const momento = new Date("2026-10-09T18:00:00Z");
const turno = {
  idTurno: "t1", estadoTurno: "DISPONIBLE", materiaId: "m1", profesorId: "p1", aulaId: "a1",
  fechaTurno: new Date("2026-10-13T00:00:00Z"), horaInicioTurno: new Date("1970-01-01T16:00:00Z"),
  duracionMinutosTurno: 120, cupoMaximoTurno: 8,
};
const consultar = () => conReloj(momento, () => obtenerResumenInscripcion("t1", "u1"));
beforeEach(() => {
  vi.resetAllMocks();
  alumno.mockResolvedValue({ id: "al1", activo: true });
  db.turno.findUnique.mockResolvedValue(turno);
  db.turnoAlumno.findMany.mockResolvedValue([]);
  materias.mockResolvedValue([{ id: "m1", nombre: "Física I" }]);
  tarifas.mockResolvedValue([{ id: "m1", tarifaHora: 12000 }]);
  profesores.mockResolvedValue({ p1: "Pérez, Ana" });
  aula.mockResolvedValue({ id: "a1", nombre: "Aula 2" });
  parametros.mockResolvedValue({ cancelacionAnticipacionHoras: 24 });
});

describe("C-20 resumen informativo", () => {
  it("datos completos, fecha calendario intacta, offset del centro y campos interinos null", async () => {
    expect(await consultar()).toEqual({
      turno_id: "t1", materia: { id: "m1", nombre: "Física I" }, profesor: { id: "p1", nombre_para_mostrar: "Pérez, Ana" },
      fecha: "2026-10-13", hora_inicio: "16:00", hora_fin: "18:00", duracion_min: 120,
      aula: { id: "a1", nombre: "Aula 2" }, cupo: 8, lugares_disponibles: 8, precio: 24000,
      plazo_pago_horas: null, vence_pago_el: null,
      limite_cancelacion_en_linea: "2026-10-12T16:00:00-03:00", limite_cancelacion_pasado: false,
    });
    expect(alumno).toHaveBeenCalledWith("u1", db);
    expect(aula).toHaveBeenCalledWith("a1", db);
  });
  it.each([[60, 12000, "17:00"], [120, 24000, "18:00"], [180, 36000, "19:00"]])("precio y fin para %i minutos", async (min, precio, fin) => {
    db.turno.findUnique.mockResolvedValue({ ...turno, duracionMinutosTurno: min });
    expect(await consultar()).toMatchObject({ duracion_min: min, precio, hora_fin: fin });
  });
  it("cuenta solo inscripciones vigentes, incluso con estado guardado COMPLETO y reserva vencida sin marcar", async () => {
    db.turno.findUnique.mockResolvedValue({ ...turno, estadoTurno: "COMPLETO", cupoMaximoTurno: 2 });
    db.turnoAlumno.findMany.mockResolvedValue([
      { idInscripcion: "i1", alumnoId: "otro", vigencia: "VIGENTE", estadoPago: "PAGO_SIN_REGISTRAR", venceEl: null },
      { idInscripcion: "i2", alumnoId: "al1", vigencia: "VIGENTE", estadoPago: "RESERVADA", venceEl: momento },
    ]);
    expect(await consultar()).toMatchObject({ cupo: 2, lugares_disponibles: 1 });
  });
  it("calcula límite pasado en el servidor, incluido el instante exacto, y lee el parámetro vigente", async () => {
    parametros.mockResolvedValue({ cancelacionAnticipacionHoras: 97 });
    expect(await consultar()).toMatchObject({ limite_cancelacion_en_linea: "2026-10-09T15:00:00-03:00", limite_cancelacion_pasado: true });
    parametros.mockResolvedValue({ cancelacionAnticipacionHoras: 96 });
    expect(await consultar()).toMatchObject({ limite_cancelacion_pasado: false });
  });
  it("rechaza ausencia de ficha", async () => {
    alumno.mockResolvedValue(null);
    await expect(consultar()).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(db.turno.findUnique).not.toHaveBeenCalled();
  });
  it("rechaza clase inexistente", async () => {
    db.turno.findUnique.mockResolvedValue(null);
    await expect(consultar()).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
  });
  it.each(["PENDIENTE", "CANCELADO"])("rechaza %s", async (estado) => {
    db.turno.findUnique.mockResolvedValue({ ...turno, estadoTurno: estado });
    await expect(consultar()).rejects.toMatchObject({ code: "TURNO_NO_DISPONIBLE" });
  });
  it("rechaza clase iniciada, incluso en el instante exacto", async () => {
    db.turno.findUnique.mockResolvedValue({ ...turno, fechaTurno: new Date("2026-10-09T00:00:00Z"), horaInicioTurno: new Date("1970-01-01T15:00:00Z") });
    await expect(consultar()).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
  });
  it("rechaza sin cupo antes de alumno inactivo", async () => {
    db.turno.findUnique.mockResolvedValue({ ...turno, cupoMaximoTurno: 0 });
    alumno.mockResolvedValue({ id: "al1", activo: false });
    await expect(consultar()).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
  });
  it("rechaza alumno inactivo", async () => {
    alumno.mockResolvedValue({ id: "al1", activo: false });
    await expect(consultar()).rejects.toMatchObject({ code: "ALUMNO_INACTIVO" });
  });
  it("rechaza inscripción vigente del mismo alumno", async () => {
    db.turnoAlumno.findMany.mockResolvedValue([{ idInscripcion: "i1", alumnoId: "al1", vigencia: "VIGENTE", estadoPago: "PAGO_SIN_REGISTRAR", venceEl: null }]);
    await expect(consultar()).rejects.toMatchObject({ code: "ALUMNO_YA_ASIGNADO" });
  });
  it("rechaza tarifa null con el error 422 para alumno", async () => {
    tarifas.mockResolvedValue([{ id: "m1", tarifaHora: null }]);
    await expect(consultar()).rejects.toMatchObject({ code: "MATERIA_SIN_TARIFA", status: 422, message: "Esta clase todavía no tiene precio. Comunicate con el centro." });
  });
});
