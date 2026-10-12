import { beforeEach, describe, expect, it, vi } from "vitest";
import { conReloj } from "@/server/shared/reloj";

// Impacto de la baja (HU-B-07, spec_modulo_B.md 2.10.1): las lecturas de los
// demás módulos están simuladas; lo que se prueba es el pedido a Turnos y las
// tres condiciones que se conservan.

const m = vi.hoisted(() => ({ listar: vi.fn(), alumno: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { alumno: { findUnique: m.alumno } } }));
vi.mock("@/server/turnos/inscripcion.publico", () => ({
  alumnoTieneRegistros: async () => false,
  darDeBajaInscripcionesDeAlumno: vi.fn(),
  listarInscripcionesDeAlumno: m.listar,
}));
vi.mock("@/server/pagos/pago.publico", () => ({ alumnoTieneRegistros: async () => false }));
vi.mock("@/server/historial/historial.publico", () => ({ alumnoTieneRegistros: async () => false }));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal: async () => [] }));
vi.mock("@/server/usuarios/cuenta.service", () => ({ desactivarCuenta: vi.fn(), reactivarCuenta: vi.fn() }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: vi.fn() }));
vi.mock("@/server/shared/historial-estados", () => ({ listarHistorialEstados: vi.fn(), registrarCambioEstado: vi.fn() }));

const { obtenerImpactoBajaAlumno } = await import("@/server/alumnos/alumno.estado.service");

const ID = "ckalumno";
const inscripcion = (extra: Record<string, unknown> = {}) => ({
  inscripcion_id: "i1", turno_id: "t1", fecha: "2026-10-12", hora_inicio: "16:00", hora_fin: "17:00",
  estado_clase: "DISPONIBLE", vigente_ahora: true, materia: { id: "m1", nombre: "Matemática" },
  profesor: "Ruiz, Marta", profesor_id: "p1", ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.alumno.mockResolvedValue({ idAlumno: ID, nombreAlumno: "Ana", apellidoAlumno: "Pérez", activoAlumno: true, version: 3 });
  m.listar.mockResolvedValue([]);
});

describe("obtenerImpactoBajaAlumno", () => {
  it.each([
    ["mediodía en el centro", "2026-10-05T15:00:00.000Z", "2026-10-05"],
    ["22:00 del 5/10 en el centro (ya es 6/10 en UTC)", "2026-10-06T01:00:00.000Z", "2026-10-05"],
    ["23:30 del 4/10 en el centro", "2026-10-05T02:30:00.000Z", "2026-10-04"],
  ])("pide las inscripciones desde hoy en la zona del centro (%s)", async (_caso, momento, desde) => {
    await conReloj(new Date(momento), () => obtenerImpactoBajaAlumno(ID));
    expect(m.listar).toHaveBeenCalledTimes(1);
    expect(m.listar).toHaveBeenCalledWith(ID, { desde });
  });

  it("conserva solo las que cumplen las tres condiciones, en orden de fecha, hora e inscripción", async () => {
    m.listar.mockResolvedValue([
      inscripcion({ inscripcion_id: "b", fecha: "2026-10-07", hora_inicio: "10:00" }),
      inscripcion({ inscripcion_id: "a", fecha: "2026-10-07", hora_inicio: "10:00" }),
      inscripcion({ inscripcion_id: "temprano", fecha: "2026-10-06", hora_inicio: "09:00", profesor: null, profesor_id: null }),
      inscripcion({ inscripcion_id: "reserva-vencida", vigente_ahora: false }),
      inscripcion({ inscripcion_id: "cancelada", estado_clase: "CANCELADO" }),
      inscripcion({ inscripcion_id: "pendiente", estado_clase: "PENDIENTE" }),
      inscripcion({ inscripcion_id: "en-curso", fecha: "2026-10-05", hora_inicio: "11:30" }),
      inscripcion({ inscripcion_id: "pasada", fecha: "2026-10-03", hora_inicio: "10:00" }),
      inscripcion({ inscripcion_id: "completa", estado_clase: "COMPLETO", fecha: "2026-10-08", hora_inicio: "08:00" }),
    ]);

    const impacto = await conReloj(new Date("2026-10-05T15:00:00.000Z"), () => obtenerImpactoBajaAlumno(ID));

    expect(impacto.inscripciones_futuras.map((i) => i.inscripcion_id)).toEqual(["temprano", "a", "b", "completa"]);
    expect(impacto).toMatchObject({ alumno: { id: ID, nombre: "Ana", apellido: "Pérez" }, version: 3, total: 4, motivo_obligatorio: false });
    expect(impacto.inscripciones_futuras[0]).toMatchObject({ profesor: null });
    expect(impacto.inscripciones_futuras[1]).toMatchObject({ profesor: { id: "p1", nombre_para_mostrar: "Ruiz, Marta" }, materia: { id: "m1", nombre: "Matemática" } });
  });

  it("una clase que empieza exactamente ahora ya no es futura", async () => {
    m.listar.mockResolvedValue([inscripcion({ fecha: "2026-10-05", hora_inicio: "12:00" }), inscripcion({ inscripcion_id: "despues", fecha: "2026-10-05", hora_inicio: "12:01" })]);
    const impacto = await conReloj(new Date("2026-10-05T15:00:00.000Z"), () => obtenerImpactoBajaAlumno(ID));
    expect(impacto.inscripciones_futuras.map((i) => i.inscripcion_id)).toEqual(["despues"]);
  });

  it("un alumno inactivo responde ALUMNO_YA_INACTIVO sin consultar inscripciones", async () => {
    m.alumno.mockResolvedValue({ idAlumno: ID, nombreAlumno: "Ana", apellidoAlumno: "Pérez", activoAlumno: false, version: 4 });
    await expect(obtenerImpactoBajaAlumno(ID)).rejects.toMatchObject({ code: "ALUMNO_YA_INACTIVO" });
    expect(m.listar).not.toHaveBeenCalled();
  });
});
