import { beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions de gerentes (spec_modulo_G.md §2.1, §2.2, §2.5 y §2.6;
// HU-G-01, decisiones 9 y 10 de la task, y HU-G-05). Con el verificarPermiso real: la sesión y los
// permisos salen de mocks de `auth` y de `prisma`; el servicio está simulado.

const m = vi.hoisted(() => ({
  crear: vi.fn(),
  modificar: vi.fn(),
  disponibilidad: vi.fn(),
  desactivar: vi.fn(),
  reactivar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: vi.fn() }),
  headers: async () => new Headers({ "x-forwarded-for": "10.0.0.7, 10.0.0.1" }),
}));
vi.mock("@/server/gerentes/gerente.service", () => ({
  crearGerente: m.crear,
  modificarGerente: m.modificar,
  verificarDisponibilidadGerente: m.disponibilidad,
  desactivarGerente: m.desactivar,
  reactivarGerente: m.reactivar,
}));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rolPermiso: { findUnique: m.permiso },
    usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) },
    tokenRevocado: { findUnique: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({
  auth: async () => m.sesion.actual,
  decodificarToken: vi.fn(),
  obtenerIp: (request: Request) => request.headers.get("x-forwarded-for")!.split(",")[0]!.trim(),
}));

import { ErrorDeDominio } from "@/server/shared/error-dominio";
const { crearGerente, desactivarGerente, modificarGerente, reactivarGerente, verificarDisponibilidadGerente } =
  await import("@/server/gerentes/actions");
const { revalidatePath } = await import("next/cache");

const ID = "ckficha";
const ALTA = { nombre: "Marcos", apellido: "Ibarra", dni: "27111222", fechaNacimiento: "1985-03-20", email: "marcos@mail.com" };
const OTROS_ROLES = ["MESA_ENTRADA", "PROFESOR", "ALUMNO"] as const;

function accionPedida(): string {
  return m.permiso.mock.calls[0]![0].where.rolPermiso_accionPermiso.accionPermiso;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "gerente", rol: "GERENTE" } };
  m.permiso.mockImplementation(async ({ where }) => (where.rolPermiso_accionPermiso.rolPermiso === "GERENTE" ? {} : null));
  m.crear.mockResolvedValue({ id: ID });
  m.modificar.mockResolvedValue({ id: ID, campos_modificados: ["telefono"], version: 4 });
  m.disponibilidad.mockResolvedValue({ dni_disponible: true, email_disponible: false });
  m.desactivar.mockResolvedValue({ id: ID, activo: false, version: 4 });
  m.reactivar.mockResolvedValue({ id: ID, activo: true, version: 5 });
});

describe("crearGerente (Server Action)", () => {
  it("valida, llama al servicio con el Gerente y la IP, y revalida el listado", async () => {
    expect(await crearGerente(ALTA)).toEqual({ data: { id: ID }, error: null });
    expect(accionPedida()).toBe("gerentes:crear");
    expect(m.crear).toHaveBeenCalledWith({ ...ALTA, fechaNacimiento: new Date(Date.UTC(1985, 2, 20)) }, "gerente", "10.0.0.7");
    expect(revalidatePath).toHaveBeenCalledWith("/gerentes");
  });

  it("sin sesión: SESION_INVALIDA, sin validar ni llamar al servicio", async () => {
    m.sesion.actual = null;
    expect(await crearGerente(ALTA)).toMatchObject({ data: null, error: { code: "SESION_INVALIDA" } });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO antes de validar (un cuerpo inválido tampoco se valida)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect(await crearGerente(ALTA)).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect((await crearGerente({ nada: true })).error?.code).toBe("SIN_PERMISO");
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR con los errores por campo", async () => {
    expect(await crearGerente({ ...ALTA, email: "" })).toEqual({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Los datos del gerente no son válidos.",
        detalles: { email: ["Ingresá el email: con él se crea la cuenta de acceso"] },
      },
    });
    expect(m.crear).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.gerente.dniDuplicado", "DNI_DUPLICADO"],
    ["errores.cuenta.emailYaAsociado", "EMAIL_YA_ASOCIADO"],
  ] as const)("%s → %s con el texto central", async (clave, code) => {
    const error = new ErrorDeDominio(clave);
    m.crear.mockRejectedValue(error);
    expect(await crearGerente(ALTA)).toEqual({ data: null, error: { code, message: error.message } });
  });

  it("un error inesperado no se filtra", async () => {
    m.crear.mockRejectedValue(new Error("connection refused"));
    expect(await crearGerente(ALTA)).toEqual({
      data: null,
      error: { code: "ERROR_COMUNICACION", message: "No se pudo conectar. Intentá nuevamente" },
    });
  });
});

describe("modificarGerente (Server Action)", () => {
  it("valida con version y revalida el listado y la ficha", async () => {
    expect(await modificarGerente(ID, { telefono: null, version: 3 })).toEqual({
      data: { id: ID, campos_modificados: ["telefono"], version: 4 },
      error: null,
    });
    expect(accionPedida()).toBe("gerentes:editar");
    expect(m.modificar).toHaveBeenCalledWith(ID, { telefono: null, version: 3 }, "gerente");
    expect(revalidatePath).toHaveBeenCalledWith("/gerentes");
    expect(revalidatePath).toHaveBeenCalledWith(`/gerentes/${ID}`);
  });

  it("sin cambios no revalida", async () => {
    m.modificar.mockResolvedValue({ id: ID, campos_modificados: [], version: 3 });
    await modificarGerente(ID, { version: 3 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin version: VALIDATION_ERROR", async () => {
    const r = await modificarGerente(ID, { telefono: null });
    expect(r.error).toMatchObject({ code: "VALIDATION_ERROR", detalles: { version: expect.any(Array) } });
    expect(m.modificar).not.toHaveBeenCalled();
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO antes de validar", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await modificarGerente(ID, { version: 3 })).error?.code).toBe("SIN_PERMISO");
    expect((await modificarGerente(ID, { email: "" })).error?.code).toBe("SIN_PERMISO");
    expect(m.modificar).not.toHaveBeenCalled();
  });

  it("sin sesión: SESION_INVALIDA", async () => {
    m.sesion.actual = null;
    expect((await modificarGerente(ID, { version: 3 })).error?.code).toBe("SESION_INVALIDA");
    expect(m.modificar).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.gerente.noEncontrado", "GERENTE_NO_ENCONTRADO"],
    ["errores.gerente.conflictoEdicion", "CONFLICTO_EDICION_CONCURRENTE"],
    ["errores.gerente.dniDuplicado", "DNI_DUPLICADO"],
    ["errores.cuenta.emailYaAsociado", "EMAIL_YA_ASOCIADO"],
  ] as const)("%s → %s", async (clave, code) => {
    m.modificar.mockRejectedValue(new ErrorDeDominio(clave));
    expect((await modificarGerente(ID, { version: 3 })).error?.code).toBe(code);
  });
});

describe("verificarDisponibilidadGerente (Server Action)", () => {
  it("en el alta pide gerentes:crear y devuelve solo la disponibilidad", async () => {
    expect(await verificarDisponibilidadGerente({ dni: "27111222", email: "Ocupado@Mail.com" })).toEqual({
      data: { dni_disponible: true, email_disponible: false },
      error: null,
    });
    expect(accionPedida()).toBe("gerentes:crear");
    expect(m.disponibilidad).toHaveBeenCalledWith({ dni: "27111222", email: "ocupado@mail.com", excluirId: undefined });
  });

  it("en la edición (con excluirId) pide gerentes:editar", async () => {
    await verificarDisponibilidadGerente({ dni: "27111222", excluirId: ID });
    expect(accionPedida()).toBe("gerentes:editar");
    expect(m.disponibilidad).toHaveBeenCalledWith({ dni: "27111222", email: undefined, excluirId: ID });
  });

  it("un valor con formato inválido no se consulta", async () => {
    await verificarDisponibilidadGerente({ dni: "12", email: "no-es-email" });
    expect(m.disponibilidad).toHaveBeenCalledWith({ dni: undefined, email: undefined, excluirId: undefined });
  });

  it("excluirId inexistente: GERENTE_NO_ENCONTRADO del servicio", async () => {
    m.disponibilidad.mockRejectedValue(new ErrorDeDominio("errores.gerente.noEncontrado"));
    expect((await verificarDisponibilidadGerente({ dni: "27111222", excluirId: "no-existe" })).error).toEqual({
      code: "GERENTE_NO_ENCONTRADO",
      message: "El gerente no existe",
    });
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO, sin consultar (no sirve de oráculo)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await verificarDisponibilidadGerente({ dni: "27111222" })).error?.code).toBe("SIN_PERMISO");
    expect(m.disponibilidad).not.toHaveBeenCalled();
  });

  it("sin sesión: SESION_INVALIDA", async () => {
    m.sesion.actual = null;
    expect((await verificarDisponibilidadGerente({ dni: "27111222" })).error?.code).toBe("SESION_INVALIDA");
  });
});

describe("desactivarGerente (Server Action, HU-G-05)", () => {
  it("permiso → Zod → servicio con el Gerente como actor; revalida el listado y la ficha", async () => {
    expect(await desactivarGerente(ID, { version: 3, motivo: "  Renuncia " })).toEqual({
      data: { id: ID, activo: false, version: 4 },
      error: null,
    });
    expect(accionPedida()).toBe("gerentes:cambiar_estado");
    expect(m.desactivar).toHaveBeenCalledWith(ID, { version: 3, motivo: "Renuncia" }, { tipo: "USUARIO", usuarioId: "gerente" });
    expect(revalidatePath).toHaveBeenCalledWith("/gerentes");
    expect(revalidatePath).toHaveBeenCalledWith(`/gerentes/${ID}`);
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO antes de validar (un cuerpo inválido tampoco se valida)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await desactivarGerente(ID, { version: 3 })).error?.code).toBe("SIN_PERMISO");
    expect((await desactivarGerente(ID, { activo: false })).error?.code).toBe("SIN_PERMISO");
    expect(m.desactivar).not.toHaveBeenCalled();
  });

  it("sin sesión: SESION_INVALIDA", async () => {
    m.sesion.actual = null;
    expect((await desactivarGerente(ID, { version: 3 })).error?.code).toBe("SESION_INVALIDA");
    expect(m.desactivar).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR: sin version, motivo de 301 caracteres o campo ajeno; no llama al servicio ni revalida", async () => {
    expect((await desactivarGerente(ID, {})).error).toMatchObject({ code: "VALIDATION_ERROR", detalles: { version: expect.any(Array) } });
    expect((await desactivarGerente(ID, { version: 3, motivo: "a".repeat(301) })).error).toMatchObject({
      code: "VALIDATION_ERROR",
      detalles: { motivo: ["El motivo admite hasta 300 caracteres."] },
    });
    expect((await desactivarGerente(ID, { version: 3, usuarioId: "x" })).error?.code).toBe("VALIDATION_ERROR");
    expect(m.desactivar).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.gerente.noEncontrado", "GERENTE_NO_ENCONTRADO"],
    ["errores.gerente.yaInactivo", "GERENTE_YA_INACTIVO"],
    ["errores.gerente.ultimoGerenteActivo", "ULTIMO_GERENTE_ACTIVO"],
    ["errores.gerente.noPuedeDesactivarseASiMismo", "NO_PUEDE_DESACTIVARSE_A_SI_MISMO"],
    ["errores.gerente.motivoRequerido", "MOTIVO_REQUERIDO"],
    ["errores.gerente.conflictoEdicion", "CONFLICTO_EDICION_CONCURRENTE"],
  ] as const)("%s → %s con el texto central, sin revalidar", async (clave, code) => {
    const error = new ErrorDeDominio(clave);
    m.desactivar.mockRejectedValue(error);
    expect(await desactivarGerente(ID, { version: 3 })).toEqual({ data: null, error: { code, message: error.message } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un error inesperado no se filtra", async () => {
    m.desactivar.mockRejectedValue(new Error("detalle técnico"));
    expect(await desactivarGerente(ID, { version: 3 })).toEqual({
      data: null,
      error: { code: "ERROR_COMUNICACION", message: "No se pudo conectar. Intentá nuevamente" },
    });
  });
});

describe("reactivarGerente (Server Action, HU-G-05)", () => {
  it("permiso → Zod → servicio; revalida el listado y la ficha", async () => {
    expect(await reactivarGerente(ID, { version: 4 })).toEqual({ data: { id: ID, activo: true, version: 5 }, error: null });
    expect(accionPedida()).toBe("gerentes:cambiar_estado");
    expect(m.reactivar).toHaveBeenCalledWith(ID, { version: 4 }, { tipo: "USUARIO", usuarioId: "gerente" });
    expect(revalidatePath).toHaveBeenCalledWith("/gerentes");
    expect(revalidatePath).toHaveBeenCalledWith(`/gerentes/${ID}`);
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO antes de validar", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await reactivarGerente(ID, {})).error?.code).toBe("SIN_PERMISO");
    expect(m.reactivar).not.toHaveBeenCalled();
  });

  it("sin sesión: SESION_INVALIDA", async () => {
    m.sesion.actual = null;
    expect((await reactivarGerente(ID, { version: 4 })).error?.code).toBe("SESION_INVALIDA");
    expect(m.reactivar).not.toHaveBeenCalled();
  });

  it("no acepta motivo ni campos ajenos y exige version: VALIDATION_ERROR", async () => {
    expect((await reactivarGerente(ID, { version: 4, motivo: "Vuelve" })).error?.code).toBe("VALIDATION_ERROR");
    expect((await reactivarGerente(ID, {})).error).toMatchObject({ code: "VALIDATION_ERROR", detalles: { version: expect.any(Array) } });
    expect(m.reactivar).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.gerente.noEncontrado", "GERENTE_NO_ENCONTRADO"],
    ["errores.gerente.yaActivo", "GERENTE_YA_ACTIVO"],
    ["errores.gerente.conflictoEdicion", "CONFLICTO_EDICION_CONCURRENTE"],
  ] as const)("%s → %s, sin revalidar", async (clave, code) => {
    m.reactivar.mockRejectedValue(new ErrorDeDominio(clave));
    expect((await reactivarGerente(ID, { version: 4 })).error?.code).toBe(code);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
