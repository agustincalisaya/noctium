import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

// HU-D-07: ActualizarMateriasProfesorSchema, actualizarMateriasDeProfesor()
// y listarTurnosFuturosDeMateria() (spec_modulo_D.md §2.7), con `prisma` y
// los servicios públicos de Materias y Turnos mockeados.

const { tx, prismaMock, orden } = vi.hoisted(() => {
  const orden: string[] = [];
  const tx = {
    profesor: { updateMany: vi.fn(), findUnique: vi.fn() },
    profesorMateria: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(async () => { orden.push("delete"); return { count: 1 }; }) },
    horarioProfesor: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    turno: { findMany: vi.fn(), count: vi.fn() },
  };
  const prismaMock = {
    $transaction: vi.fn(async (callback: (cliente: typeof tx) => unknown) => callback(tx)),
    profesor: { findUnique: vi.fn() },
  };
  return { tx, prismaMock, orden };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { bloquear, contar, listar, materiasPorIds } = vi.hoisted(() => ({
  bloquear: vi.fn(), contar: vi.fn(), listar: vi.fn(), materiasPorIds: vi.fn(),
}));
vi.mock("@/server/materias/materia.service", () => ({ bloquearMateriasParaAsociar: bloquear }));
vi.mock("@/server/materias/materia.publico", () => ({ obtenerMateriasPorIds: materiasPorIds }));
vi.mock("@/server/turnos/turno.publico", () => ({
  contarTurnosFuturosDeProfesorPorMateria: contar,
  listarTurnosFuturosDeProfesorPorMateria: listar,
}));

const { ActualizarMateriasProfesorSchema, ListarTurnosFuturosQuerySchema } = await import(
  "@/server/profesores/profesor.schema"
);
const { actualizarMateriasDeProfesor, listarTurnosFuturosDeMateria } = await import(
  "@/server/profesores/profesor.service"
);

const PROFESOR = "ckprofesor000000000000001";
const USUARIO = "ckusuario0000000000000001";
const MAT = "ckmateria0000000000000001";
const FIS = "ckmateria0000000000000002";
const QUI = "ckmateria0000000000000003";
const ING = "ckmateria0000000000000004";

async function capturarError(promesa: Promise<unknown>): Promise<ServiceError> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

function actuales(...ids: string[]) {
  tx.profesorMateria.findMany.mockResolvedValue(ids.map((materiaId) => ({ materiaId })));
}

function activa(id: string, nombre = id) {
  return { id, nombre, codigo: null, activa: true };
}

beforeEach(() => {
  vi.clearAllMocks();
  orden.length = 0;
  tx.profesor.updateMany.mockResolvedValue({ count: 1 });
  tx.profesorMateria.createMany.mockResolvedValue({ count: 0 });
  contar.mockImplementation(async () => {
    orden.push("contar");
    return { confirmados: 0, pendientes: 0 };
  });
});

describe("ActualizarMateriasProfesorSchema", () => {
  it("acepta el conjunto vacío (profesor sin materias)", () => {
    expect(ActualizarMateriasProfesorSchema.safeParse({ materia_ids: [] }).success).toBe(true);
  });

  it.each([
    [{ materia_ids: ["123"] }, "Materia inválida"],
    [{ materia_ids: [MAT, MAT] }, "No repitas materias"],
    [{ materia_ids: Array.from({ length: 101 }, (_, i) => `ckmateria${String(i).padStart(16, "0")}`) }, "Demasiadas materias"],
  ])("rechaza %j", (body, mensaje) => {
    const resultado = ActualizarMateriasProfesorSchema.safeParse(body);
    expect(resultado.success).toBe(false);
    expect(resultado.error!.issues.map((i) => i.message)).toContain(mensaje);
  });

  it.each([{ materiaIds: [MAT] }, { materia_ids: [MAT], version: 1 }, {}])("rechaza claves ajenas o faltantes: %j", (body) => {
    expect(ActualizarMateriasProfesorSchema.safeParse(body).success).toBe(false);
  });

  it("query del modal: página por defecto 1, sin por_pagina", () => {
    expect(ListarTurnosFuturosQuerySchema.parse({})).toEqual({ pagina: 1 });
    expect(ListarTurnosFuturosQuerySchema.safeParse({ pagina: "0" }).success).toBe(false);
    expect(ListarTurnosFuturosQuerySchema.safeParse({ pagina: "abc" }).success).toBe(false);
    expect(ListarTurnosFuturosQuerySchema.safeParse({ pagina: "1", por_pagina: "50" }).success).toBe(false);
  });
});

describe("actualizarMateriasDeProfesor", () => {
  it("bloquea al profesor activo sin tocar `version` (HU-D-07 §0.3 punto 4)", async () => {
    actuales(MAT);
    bloquear.mockResolvedValue([activa(QUI)]);
    await actualizarMateriasDeProfesor(PROFESOR, [MAT, QUI], USUARIO);
    expect(tx.profesor.updateMany).toHaveBeenCalledWith({
      where: { idProfesor: PROFESOR, activoProfesor: true },
      data: { modificadoPorUsuarioId: USUARIO },
    });
  });

  it("agrega varias en la misma operación (AC2), con auditoría y sin skipDuplicates", async () => {
    actuales();
    bloquear.mockResolvedValue([activa(MAT), activa(QUI)]);
    await expect(actualizarMateriasDeProfesor(PROFESOR, [MAT, QUI], USUARIO)).resolves.toEqual({
      agregadas: [MAT, QUI], quitadas: [], pendientes_afectados: 0, sin_cambios: false,
    });
    expect(bloquear).toHaveBeenCalledWith([MAT, QUI], tx);
    expect(tx.profesorMateria.createMany).toHaveBeenCalledWith({
      data: [
        { profesorId: PROFESOR, materiaId: MAT, creadoPorUsuarioId: USUARIO },
        { profesorId: PROFESOR, materiaId: QUI, creadoPorUsuarioId: USUARIO },
      ],
    });
  });

  it("quita sin turnos futuros: DELETE antes del conteo (concurrencia con HU-C-04)", async () => {
    actuales(MAT, QUI);
    await expect(actualizarMateriasDeProfesor(PROFESOR, [MAT], USUARIO)).resolves.toMatchObject({ quitadas: [QUI] });
    expect(tx.profesorMateria.deleteMany).toHaveBeenCalledWith({ where: { profesorId: PROFESOR, materiaId: QUI } });
    expect(contar).toHaveBeenCalledWith(PROFESOR, QUI, tx);
    expect(orden).toEqual(["delete", "contar"]);
  });

  it("rechaza la baja con turnos futuros e informa el N de cada materia (AC3)", async () => {
    actuales(MAT, FIS);
    contar.mockImplementation(async (_p: string, materia: string) =>
      materia === MAT ? { confirmados: 3, pendientes: 0 } : { confirmados: 4, pendientes: 0 });
    const error = await capturarError(actualizarMateriasDeProfesor(PROFESOR, [], USUARIO));
    expect(error.code).toBe("MATERIA_CON_TURNOS_FUTUROS");
    expect(error.detalles).toEqual({ detalle: [{ materia_id: MAT, cantidad: 3 }, { materia_id: FIS, cantidad: 4 }] });
    expect(contar).toHaveBeenCalledTimes(2); // recorre todas antes de lanzar
  });

  it("error parcial: agregar + quitar libre + quitar bloqueada → todo se revierte (el error sale del $transaction)", async () => {
    actuales(FIS, QUI);
    bloquear.mockResolvedValue([activa(ING)]);
    contar.mockImplementation(async (_p: string, materia: string) =>
      ({ confirmados: materia === FIS ? 1 : 0, pendientes: 0 }));
    const error = await capturarError(actualizarMateriasDeProfesor(PROFESOR, [ING], USUARIO));
    expect(error.code).toBe("MATERIA_CON_TURNOS_FUTUROS");
    expect(error.detalles).toEqual({ detalle: [{ materia_id: FIS, cantidad: 1 }] });
    // Las escrituras ocurrieron dentro del callback: el rechazo de la promesa
    // del $transaction es lo que hace el ROLLBACK de todas.
    expect(tx.profesorMateria.createMany).toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("PENDIENTE no bloquea, pero se informa en pendientes_afectados", async () => {
    actuales(MAT);
    contar.mockResolvedValue({ confirmados: 0, pendientes: 2 });
    await expect(actualizarMateriasDeProfesor(PROFESOR, [], USUARIO)).resolves.toEqual({
      agregadas: [], quitadas: [MAT], pendientes_afectados: 2, sin_cambios: false,
    });
  });

  it("agregar una inactiva → MATERIA_INACTIVA, sin INSERT", async () => {
    actuales();
    bloquear.mockResolvedValue([activa(MAT), { ...activa(QUI, "Historia de la Ciencia"), activa: false }]);
    const error = await capturarError(actualizarMateriasDeProfesor(PROFESOR, [MAT, QUI], USUARIO));
    expect(error.code).toBe("MATERIA_INACTIVA");
    expect(error.detalles).toEqual({ materias: [{ id: QUI, nombre: "Historia de la Ciencia" }] });
    expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
  });

  it("agregar un id inexistente → MATERIA_NO_ENCONTRADA", async () => {
    actuales();
    bloquear.mockResolvedValue([]);
    expect((await capturarError(actualizarMateriasDeProfesor(PROFESOR, [MAT], USUARIO))).code).toBe("MATERIA_NO_ENCONTRADA");
  });

  it("una asociada inactiva que sigue en el conjunto no se revalida", async () => {
    actuales(MAT, QUI);
    bloquear.mockResolvedValue([activa(FIS)]);
    await actualizarMateriasDeProfesor(PROFESOR, [MAT, QUI, FIS], USUARIO);
    expect(bloquear).toHaveBeenCalledWith([FIS], tx);
  });

  it("sin cambios: no escribe y revierte el bloqueo del paso 1", async () => {
    actuales(MAT, FIS);
    let rechazada = false;
    prismaMock.$transaction.mockImplementationOnce(async (callback) => {
      try {
        return await callback(tx);
      } catch (error) {
        rechazada = true; // el $transaction real haría ROLLBACK del updateMany
        throw error;
      }
    });
    await expect(actualizarMateriasDeProfesor(PROFESOR, [FIS, MAT], USUARIO)).resolves.toEqual({
      agregadas: [], quitadas: [], pendientes_afectados: 0, sin_cambios: true,
    });
    expect(rechazada).toBe(true);
    expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
    expect(tx.profesorMateria.deleteMany).not.toHaveBeenCalled();
  });

  it("conjunto vacío sobre una materia libre la quita", async () => {
    actuales(MAT);
    await expect(actualizarMateriasDeProfesor(PROFESOR, [], USUARIO)).resolves.toMatchObject({ quitadas: [MAT] });
  });

  it.each([
    [{ idProfesor: PROFESOR }, "PROFESOR_INACTIVO"],
    [null, "PROFESOR_NO_ENCONTRADO"],
  ])("profesor no activo (%j) → %s", async (existe, codigo) => {
    tx.profesor.updateMany.mockResolvedValue({ count: 0 });
    tx.profesor.findUnique.mockResolvedValue(existe);
    expect((await capturarError(actualizarMateriasDeProfesor(PROFESOR, [MAT], USUARIO))).code).toBe(codigo);
    expect(tx.profesorMateria.findMany).not.toHaveBeenCalled();
  });

  it("P2002 (dos guardados simultáneos) → MATERIA_YA_ASOCIADA", async () => {
    actuales();
    bloquear.mockResolvedValue([activa(MAT)]);
    tx.profesorMateria.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "test" }),
    );
    expect((await capturarError(actualizarMateriasDeProfesor(PROFESOR, [MAT], USUARIO))).code).toBe("MATERIA_YA_ASOCIADA");
  });

  it("no toca horarios ni lee turnos directamente (AC5, Regla N.° 3)", async () => {
    actuales(MAT, QUI);
    bloquear.mockResolvedValue([activa(FIS)]);
    await actualizarMateriasDeProfesor(PROFESOR, [MAT, FIS], USUARIO);
    expect(tx.horarioProfesor.findMany).not.toHaveBeenCalled();
    expect(tx.horarioProfesor.create).not.toHaveBeenCalled();
    expect(tx.horarioProfesor.deleteMany).not.toHaveBeenCalled();
    expect(tx.turno.findMany).not.toHaveBeenCalled();
    expect(tx.turno.count).not.toHaveBeenCalled();
  });
});

describe("listarTurnosFuturosDeMateria", () => {
  it("delega en Turnos con 10 por página", async () => {
    prismaMock.profesor.findUnique.mockResolvedValue({ idProfesor: PROFESOR });
    materiasPorIds.mockResolvedValue([{ ...activa(MAT), activa: false }]); // inactiva: igual se lista
    listar.mockResolvedValue({ items: [], total: 0, pagina: 2, por_pagina: 10 });
    await expect(listarTurnosFuturosDeMateria(PROFESOR, MAT, 2)).resolves.toEqual({ items: [], total: 0, pagina: 2, por_pagina: 10 });
    expect(listar).toHaveBeenCalledWith(PROFESOR, MAT, { pagina: 2, porPagina: 10 });
  });

  it("profesor inexistente → PROFESOR_NO_ENCONTRADO", async () => {
    prismaMock.profesor.findUnique.mockResolvedValue(null);
    expect((await capturarError(listarTurnosFuturosDeMateria(PROFESOR, MAT, 1))).code).toBe("PROFESOR_NO_ENCONTRADO");
  });

  it("materia inexistente → MATERIA_NO_ENCONTRADA", async () => {
    prismaMock.profesor.findUnique.mockResolvedValue({ idProfesor: PROFESOR });
    materiasPorIds.mockResolvedValue([]);
    expect((await capturarError(listarTurnosFuturosDeMateria(PROFESOR, MAT, 1))).code).toBe("MATERIA_NO_ENCONTRADA");
    expect(listar).not.toHaveBeenCalled();
  });
});
