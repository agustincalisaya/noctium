import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  tx: { observacionClase: { create: vi.fn() }, claseDictada: { findFirst: vi.fn() } },
  bloquear: vi.fn(), profesor: vi.fn(), email: vi.fn(), lectura: vi.fn(), permiso: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { observacionClase: { findUnique: m.lectura } } }));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: m.bloquear }));
vi.mock("@/server/shared/reloj", () => ({ ahora: () => new Date("2026-10-09T14:00:00.000Z") }));
vi.mock("@/server/profesores/profesor.publico", () => ({ obtenerOpcionProfesorDeUsuario: m.profesor }));
vi.mock("@/server/usuarios/usuario.service", () => ({ obtenerEmailDeUsuario: m.email }));
const { registrarObservacionClase, leerObservacionDeClase } = await import("./observacion-clase.service");

const mesa = { id: "mesa-1", rol: "MESA_ENTRADA" as const };
const profesor = { id: "usuario-profesor", rol: "PROFESOR" as const };
const clase = { idClaseDictada: "clase-1", profesorId: "profesor-1" };
const input = { temas_vistos: "Funciones lineales", observaciones_internas: "Revisar práctica" };

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.claseDictada.findFirst.mockResolvedValue(clase);
  m.tx.observacionClase.create.mockResolvedValue({ createdAtObservacion: new Date("2026-10-09T14:00:00.000Z") });
  m.profesor.mockResolvedValue({ id: "profesor-1" });
  m.email.mockResolvedValue("mesa@noctium.local");
  m.lectura.mockResolvedValue(null);
});

describe("registrarObservacionClase", () => {
  it("bloquea la clase y guarda la observación con autor y momento", async () => {
    await expect(registrarObservacionClase(m.tx as never, "turno-1", input, mesa)).resolves.toEqual({
      id: expect.any(String), clase_dictada_id: "clase-1", temas_vistos: "Funciones lineales",
      observaciones_internas: "Revisar práctica", registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local",
    });
    expect(m.bloquear).toHaveBeenCalledWith(m.tx, { clases: ["turno-1"] });
    expect(m.tx.observacionClase.create).toHaveBeenCalledWith({ data: {
      idObservacionClase: expect.any(String), claseDictadaId: "clase-1", temasVistos: "Funciones lineales",
      observacionesInternas: "Revisar práctica", createdAtObservacion: new Date("2026-10-09T14:00:00.000Z"), creadoPorUsuarioId: "mesa-1",
    }, select: { createdAtObservacion: true } });
  });

  it("guarda el campo opcional vacío como NULL", async () => {
    await registrarObservacionClase(m.tx as never, "turno-1", { temas_vistos: "Álgebra", observaciones_internas: "" }, mesa);
    expect(m.tx.observacionClase.create.mock.calls[0][0].data.observacionesInternas).toBeNull();
  });

  it("404 cuando el turno no tiene clase dictada vigente", async () => {
    m.tx.claseDictada.findFirst.mockResolvedValue(null);
    await expect(registrarObservacionClase(m.tx as never, "turno-1", input, mesa)).rejects.toMatchObject({ code: "CLASE_NO_REGISTRADA" });
    expect(m.tx.observacionClase.create).not.toHaveBeenCalled();
  });

  it("solo admite Mesa y al Profesor titular de la clase", async () => {
    await expect(registrarObservacionClase(m.tx as never, "turno-1", input, profesor)).resolves.toMatchObject({ clase_dictada_id: "clase-1" });
    m.profesor.mockResolvedValue({ id: "profesor-ajeno" });
    await expect(registrarObservacionClase(m.tx as never, "turno-1", input, profesor)).rejects.toMatchObject({ code: "SIN_PERMISO" });
    await expect(registrarObservacionClase(m.tx as never, "turno-1", input, { id: "gerente-1", rol: "GERENTE" })).rejects.toMatchObject({ code: "SIN_PERMISO" });
    expect(m.tx.observacionClase.create).toHaveBeenCalledOnce();
  });

  it("responde con el error de dominio de duplicado si otra transacción ganó", async () => {
    m.tx.observacionClase.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }));
    await expect(registrarObservacionClase(m.tx as never, "turno-1", input, mesa)).rejects.toMatchObject({ code: "OBSERVACIONES_YA_REGISTRADAS", status: 409 });
  });
});

describe("leerObservacionDeClase", () => {
  const encontrada = {
    idObservacionClase: "obs-1", temasVistos: "Funciones", observacionesInternas: "Nota del profesor",
    createdAtObservacion: new Date("2026-10-09T14:00:00.000Z"), creadoPorUsuarioId: "autor-1",
    clase: { profesorId: "profesor-1", anuladaEl: null },
  };

  it("incluye el campo interno para Mesa y expone autor y fecha", async () => {
    m.lectura.mockResolvedValue(encontrada);
    await expect(leerObservacionDeClase("clase-1", mesa)).resolves.toEqual({
      id: "obs-1", clase_dictada_id: "clase-1", temas_vistos: "Funciones", observaciones_internas: "Nota del profesor",
      registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local",
    });
    expect(m.email).toHaveBeenCalledWith("autor-1");
  });

  it("incluye el campo interno para Gerencia en modo de consulta", async () => {
    m.lectura.mockResolvedValue(encontrada);
    await expect(leerObservacionDeClase("clase-1", { id: "gerente-1", rol: "GERENTE" })).resolves.toMatchObject({
      observaciones_internas: "Nota del profesor",
    });
  });

  it("solo incluye texto interno para el Profesor autor de la clase", async () => {
    m.lectura.mockResolvedValue(encontrada);
    m.profesor.mockResolvedValue({ id: "profesor-ajeno" });
    await expect(leerObservacionDeClase("clase-1", profesor)).resolves.toEqual({
      id: "obs-1", clase_dictada_id: "clase-1", temas_vistos: "Funciones", registrada_en: "2026-10-09T14:00:00.000Z", registrada_por: "mesa@noctium.local",
    });
    m.profesor.mockResolvedValue({ id: "profesor-1" });
    await expect(leerObservacionDeClase("clase-1", profesor)).resolves.toMatchObject({ observaciones_internas: "Nota del profesor" });
  });

  it("omite las observaciones de una clase anulada", async () => {
    m.lectura.mockResolvedValue({ ...encontrada, clase: { ...encontrada.clase, anuladaEl: new Date() } });
    await expect(leerObservacionDeClase("clase-1", mesa)).resolves.toBeNull();
  });
});
