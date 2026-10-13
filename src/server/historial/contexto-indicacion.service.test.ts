import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ profesor: vi.fn(), origen: vi.fn(), propia: vi.fn(), fecha: new Date("2026-10-13T12:00:00Z") }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: m.profesor }));
vi.mock("@/server/turnos/turno.publico", () => ({ obtenerClaseOrigenHistorial: m.origen }));
vi.mock("@/server/historial/historial.publico", () => ({ profesorPuedeRegistrarIndicacion: m.propia }));
vi.mock("@/server/shared/reloj", () => ({ ahora: () => m.fecha }));
import { emitirContextoIndicacion, validarContextoIndicacion } from "./contexto-indicacion.service";
const anterior = process.env.AUTH_SECRET;
const db = { claseDictada: { findFirst: vi.fn() } };
beforeEach(() => {
  vi.clearAllMocks(); process.env.AUTH_SECRET = "secreto-aislado-solo-test-contexto";
  m.fecha = new Date("2026-10-13T12:00:00Z"); m.profesor.mockResolvedValue({ id: "p" });
  m.origen.mockResolvedValue({ profesor_id: "p", materia_id: "A", alumno_inscripto: true }); m.propia.mockResolvedValue(true);
});
afterAll(() => { if (anterior === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = anterior; });
const emitir = () => emitirContextoIndicacion("u", "al", "A", "t", db as never);
const validar = (token?: string, usuario = "u", alumno = "al", materia = "A") => validarContextoIndicacion(token, usuario, alumno, materia, db as never);
describe("E04 contexto de navegación", () => {
  it("firma el origen, admite clase futura y verifica primera clase propia al guardar", async () => {
    const token = await emitir(); expect(m.propia).not.toHaveBeenCalled(); await validar(token);
    expect(m.propia).toHaveBeenCalledWith("p", "al", "A", db);
    m.propia.mockResolvedValue(false); await expect(validar(token)).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
  it("rechaza otra materia, alumno, usuario, firma, secreto y contexto ausente", async () => {
    const token = await emitir();
    for (const fn of [() => validar(token, "u", "al", "B"), () => validar(token, "u", "otro"), () => validar(token, "otro"), () => validar(token + "x"), () => validar()]) await expect(fn()).rejects.toMatchObject({ code: "SIN_PERMISO" });
    process.env.AUTH_SECRET = "otro-secreto-de-prueba"; await expect(validar(token)).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
  it("vence en dos horas y revalida profesor/materia actuales", async () => {
    const token = await emitir(); m.fecha = new Date("2026-10-13T14:00:01Z"); await expect(validar(token)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    m.fecha = new Date("2026-10-13T13:00:00Z"); m.origen.mockResolvedValue({ profesor_id: "otro", materia_id: "A", alumno_inscripto: true }); await expect(validar(token)).rejects.toMatchObject({ code: "SIN_PERMISO" });
  });
  it("no emite contexto para un alumno ajeno a la clase", async () => {
    m.origen.mockResolvedValue({ profesor_id: "p", materia_id: "A", alumno_inscripto: false }); db.claseDictada.findFirst.mockResolvedValue(null);
    await expect(emitir()).rejects.toMatchObject({ code: "SIN_PERMISO" });
    db.claseDictada.findFirst.mockResolvedValue({ idClaseDictada: "cd" }); await expect(emitir()).resolves.toEqual(expect.any(String));
  });
});
