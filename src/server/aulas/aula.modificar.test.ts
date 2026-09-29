import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

// HU-K-03: modificarAula() (spec_modulo_K.md §2.4) con `prisma` mockeado.
// ajustarCuposPorCapacidadDeAula() (turno.publico.ts) se espía pero corre la
// implementación real sobre el mismo `tx` falso: así se verifica que se
// llama con ese `tx`, y las transiciones de estado de los turnos.
// El `tx` falso no tiene `eventoTurno`: si Aulas (o el ajuste) intentara
// escribir eventos dentro de la transacción, el test fallaría.

const tx = {
  aula: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  $queryRaw: vi.fn(),
  turnoAlumno: { findMany: vi.fn() },
  turno: { updateMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((callback: (cliente: typeof tx) => unknown) => callback(tx)),
  },
}));

vi.mock("@/server/turnos/turno.publico", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/turnos/turno.publico")>();
  return {
    ...original,
    ajustarCuposPorCapacidadDeAula: vi.fn(original.ajustarCuposPorCapacidadDeAula),
  };
});

const { ajustarCuposPorCapacidadDeAula } = await import("@/server/turnos/turno.publico");
const { modificarAula } = await import("@/server/aulas/aula.service");
const { ModificarAulaSchema } = await import("@/server/aulas/aula.schema");

const ID = "ckaula00000000000000000001";
const USUARIO = "ckusuario0000000000000001";
const ACTUAL = { nombreAula: "Aula 1", capacidadAula: 10, version: 3 };
const hora = new Date("1970-01-01T10:00:00.000Z");
const futuro = (dia: number) => new Date(`2026-10-${String(dia).padStart(2, "0")}T00:00:00.000Z`);

function inscriptos(turnoId: string, cantidad: number) {
  return Array.from({ length: cantidad }, (_, n) => ({ turnoId, alumnoId: `${turnoId}-a${n}` }));
}

async function capturarError(promesa: Promise<unknown>): Promise<ServiceError> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  // 09:00 en America/Argentina/Buenos_Aires.
  vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"));
  tx.aula.findUnique.mockResolvedValue(ACTUAL);
  tx.aula.findFirst.mockResolvedValue(null);
  tx.aula.updateMany.mockResolvedValue({ count: 1 });
  tx.$queryRaw.mockResolvedValue([]);
  tx.turnoAlumno.findMany.mockResolvedValue([]);
  tx.turno.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("modificarAula", () => {
  it("rechaza capacidad menor a los inscriptos de un turno futuro, sin escribir turnos", async () => {
    tx.$queryRaw.mockResolvedValue([
      { idTurno: "t01", estadoTurno: "COMPLETO", cupoMaximoTurno: 10, fechaTurno: futuro(1), horaInicioTurno: hora },
      { idTurno: "t06", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 10, fechaTurno: futuro(2), horaInicioTurno: hora },
    ]);
    tx.turnoAlumno.findMany.mockResolvedValue([...inscriptos("t01", 10), ...inscriptos("t06", 4)]);

    const error = await capturarError(
      modificarAula(ID, { nombre: "Aula 1 B", capacidad: 9, version: 3 }, USUARIO),
    );

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("CAPACIDAD_MENOR_A_INSCRIPTOS");
    expect(error.message).toBe(
      "La nueva capacidad es menor a la cantidad de alumnos ya inscriptos en turnos que usan esta aula",
    );
    expect(error.detalles).toEqual({ turnos_en_conflicto: ["t01"], max_inscriptos: 10 });
    // El throw ocurre dentro del callback de $transaction: el UPDATE del aula
    // (nombre incluido) se revierte con él.
    expect(tx.aula.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(ajustarCuposPorCapacidadDeAula).mock.invocationCallOrder[0]);
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });

  it("los turnos pasados no bloquean ni se modifican", async () => {
    tx.$queryRaw.mockResolvedValue([
      { idTurno: "pasado", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 20,
        fechaTurno: new Date("2026-09-25T00:00:00.000Z"), horaInicioTurno: hora },
      { idTurno: "futuro", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 20, fechaTurno: futuro(1), horaInicioTurno: hora },
    ]);
    tx.turnoAlumno.findMany.mockResolvedValue(inscriptos("futuro", 7));

    const r = await modificarAula(ID, { capacidad: 7, version: 3 }, USUARIO);

    expect(r).toEqual({ id: ID, campos_modificados: ["capacidad"], version: 4, turnos_actualizados: 1 });
    expect(tx.turno.updateMany.mock.calls.map(([{ where }]) => where.idTurno)).toEqual(["futuro"]);
    expect(tx.turno.updateMany.mock.calls[0][0].data).toMatchObject({ cupoMaximoTurno: 7, estadoTurno: "COMPLETO" });
  });

  it("aumentar la capacidad pasa un turno COMPLETO a DISPONIBLE, en el mismo tx", async () => {
    tx.$queryRaw.mockResolvedValue([
      { idTurno: "t01", estadoTurno: "COMPLETO", cupoMaximoTurno: 10, fechaTurno: futuro(1), horaInicioTurno: hora },
    ]);
    tx.turnoAlumno.findMany.mockResolvedValue(inscriptos("t01", 10));

    const r = await modificarAula(ID, { capacidad: 12, version: 3 }, USUARIO);

    expect(r).toEqual({ id: ID, campos_modificados: ["capacidad"], version: 4, turnos_actualizados: 1 });
    expect(tx.aula.updateMany.mock.calls[0][0]).toMatchObject({
      where: { idAula: ID, version: 3 },
      data: { capacidadAula: 12, version: { increment: 1 }, modificadoPorUsuarioId: USUARIO },
    });
    expect(tx.turno.updateMany.mock.calls[0][0].data).toMatchObject({ cupoMaximoTurno: 12, estadoTurno: "DISPONIBLE" });
    expect(ajustarCuposPorCapacidadDeAula).toHaveBeenCalledTimes(1);
    expect(ajustarCuposPorCapacidadDeAula).toHaveBeenCalledWith(ID, 12, USUARIO, tx);
    const ajuste = await vi.mocked(ajustarCuposPorCapacidadDeAula).mock.results[0].value;
    expect(ajuste.eventos.map(({ tipoEvento }: { tipoEvento: string }) => tipoEvento)).toEqual([
      "turno:cupo_actualizado", "turno:disponible_nuevamente",
    ]);
    // Primero se valida la versión del aula, después se bloquean turnos.
    expect(tx.aula.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[0]);
  });

  it("reducir exactamente a los inscriptos pasa el turno a COMPLETO", async () => {
    tx.aula.findUnique.mockResolvedValue({ nombreAula: "Aula 10", capacidadAula: 30, version: 0 });
    tx.$queryRaw.mockResolvedValue([
      { idTurno: "t23", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 30, fechaTurno: futuro(1), horaInicioTurno: hora },
      { idTurno: "t03", estadoTurno: "DISPONIBLE", cupoMaximoTurno: 30, fechaTurno: futuro(2), horaInicioTurno: hora },
    ]);
    tx.turnoAlumno.findMany.mockResolvedValue([...inscriptos("t23", 18), ...inscriptos("t03", 12)]);

    const r = await modificarAula(ID, { capacidad: 18, version: 0 }, USUARIO);

    expect(r.turnos_actualizados).toBe(2);
    const porTurno = new Map(tx.turno.updateMany.mock.calls.map(([{ where, data }]) => [where.idTurno, data]));
    expect(porTurno.get("t23")).toMatchObject({ cupoMaximoTurno: 18, estadoTurno: "COMPLETO" });
    expect(porTurno.get("t03")).toEqual({ cupoMaximoTurno: 18, modificadoPorUsuarioId: USUARIO });
    const ajuste = await vi.mocked(ajustarCuposPorCapacidadDeAula).mock.results[0].value;
    expect(ajuste.eventos.map(({ tipoEvento, turnoId }: { tipoEvento: string; turnoId: string }) =>
      [tipoEvento, turnoId])).toContainEqual(["turno:completado", "t23"]);
  });

  it("aula inactiva: se puede editar (spec §2.4 paso 1 solo exige que exista)", async () => {
    tx.aula.findUnique.mockResolvedValue({ nombreAula: "Aula 12", capacidadAula: 25, version: 0 });
    const r = await modificarAula(ID, { nombre: "Aula 12 B", version: 0 }, USUARIO);
    expect(r.campos_modificados).toEqual(["nombre"]);
    expect(tx.aula.updateMany.mock.calls[0][0].data).not.toHaveProperty("activaAula");
  });

  it("solo nombre: no llama al ajuste de turnos ni toca turnos", async () => {
    const r = await modificarAula(ID, { nombre: "Aula Uno", version: 3 }, USUARIO);

    expect(r).toEqual({ id: ID, campos_modificados: ["nombre"], version: 4, turnos_actualizados: 0 });
    const { data } = tx.aula.updateMany.mock.calls[0][0];
    expect(data).toMatchObject({ nombreAula: "Aula Uno", nombreNormalizadaAula: "aula uno" });
    expect(data.updatedAtAula).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("capacidadAula");
    expect(ajustarCuposPorCapacidadDeAula).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("sin cambios: no escribe ni incrementa la versión", async () => {
    const r = await modificarAula(ID, { nombre: "Aula 1", capacidad: 10, version: 3 }, USUARIO);

    expect(r).toEqual({ id: ID, campos_modificados: [], version: 3, turnos_actualizados: 0 });
    expect(tx.aula.updateMany).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("nombre duplicado con otra aula (activa o inactiva), excluyendo la propia", async () => {
    tx.aula.findFirst.mockResolvedValue({ idAula: "otra" });

    const error = await capturarError(modificarAula(ID, { nombre: "aula 2", version: 3 }, USUARIO));

    expect(error.code).toBe("NOMBRE_DUPLICADO");
    expect(tx.aula.findFirst.mock.calls[0][0].where).toEqual({
      nombreNormalizadaAula: "aula 2",
      NOT: { idAula: ID },
    });
    expect(tx.aula.updateMany).not.toHaveBeenCalled();
  });

  it("cambiar solo mayúsculas del propio nombre no es duplicado", async () => {
    const r = await modificarAula(ID, { nombre: "AULA 1", version: 3 }, USUARIO);
    expect(r.campos_modificados).toEqual(["nombre"]);
  });

  it("P2002 se traduce a NOMBRE_DUPLICADO", async () => {
    tx.aula.updateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x", meta: { target: ["nombreAula"] } }),
    );
    const error = await capturarError(modificarAula(ID, { nombre: "Aula 7", version: 3 }, USUARIO));
    expect(error.code).toBe("NOMBRE_DUPLICADO");
  });

  it("version desactualizada: CONFLICTO_EDICION_CONCURRENTE y no se ajustan turnos", async () => {
    tx.aula.updateMany.mockResolvedValue({ count: 0 });

    const error = await capturarError(modificarAula(ID, { capacidad: 12, version: 2 }, USUARIO));

    expect(error.code).toBe("CONFLICTO_EDICION_CONCURRENTE");
    expect(error.message).toBe("El aula fue modificada por otro usuario. Recargá para ver los datos actuales.");
    expect(ajustarCuposPorCapacidadDeAula).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.turno.updateMany).not.toHaveBeenCalled();
  });

  it("aula inexistente: AULA_NO_ENCONTRADA", async () => {
    tx.aula.findUnique.mockResolvedValue(null);
    const error = await capturarError(modificarAula(ID, { capacidad: 12, version: 0 }, USUARIO));
    expect(error.code).toBe("AULA_NO_ENCONTRADA");
  });
});

// TODO HU-K-03: esperar emitirEventosTurno (Tomás). Cuando exista en
// turno.publico.ts, mockearla y cubrir la emisión post-COMMIT (spec §2.4 paso 6).
describe("modificarAula — eventos de turno después del COMMIT", () => {
  it.todo("emite los eventos del ajuste con emitirEventosTurno, una vez, después de que resolvió $transaction");
  it.todo("no emite nada si la transacción lanzó (capacidad menor a inscriptos, conflicto de version)");
  it.todo("no llama a emitirEventosTurno si no hay eventos (solo nombre, aula sin turnos futuros)");
});

describe("Regla N.° 3 — imports del módulo Aulas", () => {
  const carpeta = join(process.cwd(), "src/server/aulas");
  const fuentes = readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith(".ts") && !archivo.endsWith(".test.ts"))
    .map((archivo) => ({ archivo, codigo: readFileSync(join(carpeta, archivo), "utf8") }));

  it.each(fuentes)("$archivo no importa turno.service.ts", ({ codigo }) => {
    expect(codigo).not.toMatch(/from\s+["']@\/server\/turnos\/turno\.service["']/);
  });

  it.each(fuentes)("$archivo solo importa de Turnos su servicio público", ({ codigo }) => {
    const deTurnos = [...codigo.matchAll(/from\s+["'](@\/server\/turnos\/[^"']+)["']/g)].map(([, ruta]) => ruta);
    expect(deTurnos.every((ruta) => ruta === "@/server/turnos/turno.publico")).toBe(true);
  });
});

describe("ModificarAulaSchema", () => {
  it("normaliza igual que el alta y deja ausente lo que no viene", () => {
    expect(ModificarAulaSchema.parse({ nombre: "  Aula   3 ", version: 0 })).toEqual({ nombre: "Aula 3", version: 0 });
    expect(ModificarAulaSchema.parse({ capacidad: "25", version: 1 })).toEqual({ capacidad: 25, version: 1 });
  });

  it.each([0, -1, 2.5, "abc"])("rechaza capacidad %s", (capacidad) => {
    expect(ModificarAulaSchema.safeParse({ capacidad, version: 0 }).success).toBe(false);
  });

  it("rechaza nombre vacío o de más de 30 caracteres", () => {
    expect(ModificarAulaSchema.safeParse({ nombre: "  ", version: 0 }).success).toBe(false);
    expect(ModificarAulaSchema.safeParse({ nombre: "x".repeat(31), version: 0 }).success).toBe(false);
  });

  it("exige version y rechaza is_active (HU-K-04)", () => {
    expect(ModificarAulaSchema.safeParse({ capacidad: 5 }).success).toBe(false);
    expect(ModificarAulaSchema.safeParse({ capacidad: 5, version: 0, is_active: false }).success).toBe(false);
  });
});
