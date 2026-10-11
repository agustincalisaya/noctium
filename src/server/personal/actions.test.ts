import { beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions del personal (spec_modulo_F.md §2.1 y §2.2, HU-F-01;
// decisión 9 de la task). Con el verificarPermiso real: la sesión y los
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
vi.mock("@/server/personal/personal.service", () => ({
  crearIntegrante: m.crear,
  modificarIntegrante: m.modificar,
  verificarDisponibilidadIntegrante: m.disponibilidad,
  desactivarIntegrante: m.desactivar,
  reactivarIntegrante: m.reactivar,
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
const { crearIntegrante, desactivarIntegrante, modificarIntegrante, reactivarIntegrante, verificarDisponibilidadIntegrante } =
  await import("@/server/personal/actions");
const { revalidatePath } = await import("next/cache");

const ID = "ckficha";
const ALTA = { nombre: "Lucía", apellido: "Fernández", dni: "30123456", fechaNacimiento: "1990-04-12", email: "lucia@mail.com" };
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

describe("crearIntegrante (Server Action)", () => {
  it("valida, llama al servicio con el Gerente y la IP, y revalida el listado", async () => {
    expect(await crearIntegrante(ALTA)).toEqual({ data: { id: ID }, error: null });
    expect(accionPedida()).toBe("personal:crear");
    expect(m.crear).toHaveBeenCalledWith({ ...ALTA, fechaNacimiento: new Date(Date.UTC(1990, 3, 12)) }, "gerente", "10.0.0.7");
    expect(revalidatePath).toHaveBeenCalledWith("/personal");
  });

  it("sin sesión: SESION_INVALIDA, sin validar ni llamar al servicio", async () => {
    m.sesion.actual = null;
    expect(await crearIntegrante(ALTA)).toMatchObject({ data: null, error: { code: "SESION_INVALIDA" } });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect(await crearIntegrante(ALTA)).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR con los errores por campo", async () => {
    expect(await crearIntegrante({ ...ALTA, email: "" })).toEqual({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: "Los datos del integrante no son válidos.",
        detalles: { email: ["Ingresá el email: con él se crea la cuenta de acceso"] },
      },
    });
    expect(m.crear).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.personal.dniDuplicado", "DNI_DUPLICADO"],
    ["errores.cuenta.emailYaAsociado", "EMAIL_YA_ASOCIADO"],
  ] as const)("%s → %s con el texto central", async (clave, code) => {
    const error = new ErrorDeDominio(clave);
    m.crear.mockRejectedValue(error);
    expect(await crearIntegrante(ALTA)).toEqual({ data: null, error: { code, message: error.message } });
  });

  it("un error inesperado no se filtra", async () => {
    m.crear.mockRejectedValue(new Error("connection refused"));
    expect(await crearIntegrante(ALTA)).toEqual({
      data: null,
      error: { code: "ERROR_COMUNICACION", message: "No se pudo conectar. Intentá nuevamente" },
    });
  });
});

describe("modificarIntegrante (Server Action)", () => {
  it("valida con version y revalida el listado y la ficha", async () => {
    expect(await modificarIntegrante(ID, { telefono: null, version: 3 })).toEqual({
      data: { id: ID, campos_modificados: ["telefono"], version: 4 },
      error: null,
    });
    expect(accionPedida()).toBe("personal:editar");
    expect(m.modificar).toHaveBeenCalledWith(ID, { telefono: null, version: 3 }, "gerente");
    expect(revalidatePath).toHaveBeenCalledWith(`/personal/${ID}`);
  });

  it("sin cambios no revalida", async () => {
    m.modificar.mockResolvedValue({ id: ID, campos_modificados: [], version: 3 });
    await modificarIntegrante(ID, { version: 3 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin version: VALIDATION_ERROR", async () => {
    const r = await modificarIntegrante(ID, { telefono: null });
    expect(r.error).toMatchObject({ code: "VALIDATION_ERROR", detalles: { version: expect.any(Array) } });
    expect(m.modificar).not.toHaveBeenCalled();
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await modificarIntegrante(ID, { version: 3 })).error?.code).toBe("SIN_PERMISO");
    expect(m.modificar).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.personal.noEncontrado", "INTEGRANTE_NO_ENCONTRADO"],
    ["errores.personal.conflictoEdicion", "CONFLICTO_EDICION_CONCURRENTE"],
    ["errores.personal.dniDuplicado", "DNI_DUPLICADO"],
    ["errores.cuenta.emailYaAsociado", "EMAIL_YA_ASOCIADO"],
  ] as const)("%s → %s", async (clave, code) => {
    m.modificar.mockRejectedValue(new ErrorDeDominio(clave));
    expect((await modificarIntegrante(ID, { version: 3 })).error?.code).toBe(code);
  });
});

describe("desactivarIntegrante (Server Action, HU-F-05)", () => {
  it("permiso → Zod → servicio con el Gerente como actor; revalida el listado y la ficha", async () => {
    expect(await desactivarIntegrante(ID, { version: 3, motivo: "  Renuncia " })).toEqual({
      data: { id: ID, activo: false, version: 4 },
      error: null,
    });
    expect(accionPedida()).toBe("personal:cambiar_estado");
    expect(m.desactivar).toHaveBeenCalledWith(ID, { version: 3, motivo: "Renuncia" }, { tipo: "USUARIO", usuarioId: "gerente" });
    expect(revalidatePath).toHaveBeenCalledWith("/personal");
    expect(revalidatePath).toHaveBeenCalledWith(`/personal/${ID}`);
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO antes de validar (un cuerpo inválido tampoco se valida)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await desactivarIntegrante(ID, { activo: false })).error?.code).toBe("SIN_PERMISO");
    expect(m.desactivar).not.toHaveBeenCalled();
  });

  it("sin sesión: SESION_INVALIDA", async () => {
    m.sesion.actual = null;
    expect((await desactivarIntegrante(ID, { version: 3 })).error?.code).toBe("SESION_INVALIDA");
    expect(m.desactivar).not.toHaveBeenCalled();
  });

  it("VALIDATION_ERROR: sin version, motivo de 301 caracteres o campo ajeno; no llama al servicio ni revalida", async () => {
    expect((await desactivarIntegrante(ID, {})).error).toMatchObject({ code: "VALIDATION_ERROR", detalles: { version: expect.any(Array) } });
    expect((await desactivarIntegrante(ID, { version: 3, motivo: "a".repeat(301) })).error).toMatchObject({
      code: "VALIDATION_ERROR",
      detalles: { motivo: ["El motivo admite hasta 300 caracteres."] },
    });
    expect((await desactivarIntegrante(ID, { version: 3, usuarioId: "x" })).error?.code).toBe("VALIDATION_ERROR");
    expect(m.desactivar).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.personal.noEncontrado", "INTEGRANTE_NO_ENCONTRADO"],
    ["errores.personal.yaInactivo", "INTEGRANTE_YA_INACTIVO"],
    ["errores.personal.cajaAbierta", "CAJA_ABIERTA"],
    ["errores.personal.motivoRequerido", "MOTIVO_REQUERIDO"],
    ["errores.personal.conflictoEdicion", "CONFLICTO_EDICION_CONCURRENTE"],
  ] as const)("%s → %s con el texto central, sin revalidar", async (clave, code) => {
    const error = new ErrorDeDominio(clave);
    m.desactivar.mockRejectedValue(error);
    expect(await desactivarIntegrante(ID, { version: 3 })).toEqual({ data: null, error: { code, message: error.message } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("reactivarIntegrante (Server Action, HU-F-05)", () => {
  it("permiso → Zod → servicio; revalida el listado y la ficha", async () => {
    expect(await reactivarIntegrante(ID, { version: 4 })).toEqual({ data: { id: ID, activo: true, version: 5 }, error: null });
    expect(accionPedida()).toBe("personal:cambiar_estado");
    expect(m.reactivar).toHaveBeenCalledWith(ID, { version: 4 }, { tipo: "USUARIO", usuarioId: "gerente" });
    expect(revalidatePath).toHaveBeenCalledWith(`/personal/${ID}`);
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO antes de validar", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await reactivarIntegrante(ID, {})).error?.code).toBe("SIN_PERMISO");
    expect(m.reactivar).not.toHaveBeenCalled();
  });

  it("no acepta motivo: VALIDATION_ERROR", async () => {
    expect((await reactivarIntegrante(ID, { version: 4, motivo: "Vuelve" })).error?.code).toBe("VALIDATION_ERROR");
    expect(m.reactivar).not.toHaveBeenCalled();
  });

  it.each([
    ["errores.personal.yaActivo", "INTEGRANTE_YA_ACTIVO"],
    ["errores.personal.conflictoEdicion", "CONFLICTO_EDICION_CONCURRENTE"],
  ] as const)("%s → %s", async (clave, code) => {
    m.reactivar.mockRejectedValue(new ErrorDeDominio(clave));
    expect((await reactivarIntegrante(ID, { version: 4 })).error?.code).toBe(code);
  });
});

describe("verificarDisponibilidadIntegrante (Server Action)", () => {
  it("en el alta pide personal:crear y devuelve solo la disponibilidad", async () => {
    expect(await verificarDisponibilidadIntegrante({ dni: "30123456", email: "Ocupado@Mail.com" })).toEqual({
      data: { dni_disponible: true, email_disponible: false },
      error: null,
    });
    expect(accionPedida()).toBe("personal:crear");
    expect(m.disponibilidad).toHaveBeenCalledWith({ dni: "30123456", email: "ocupado@mail.com", excluirId: undefined });
  });

  it("en la edición (con excluirId) pide personal:editar", async () => {
    await verificarDisponibilidadIntegrante({ dni: "30123456", excluirId: ID });
    expect(accionPedida()).toBe("personal:editar");
    expect(m.disponibilidad).toHaveBeenCalledWith({ dni: "30123456", email: undefined, excluirId: ID });
  });

  it("un valor con formato inválido no se consulta", async () => {
    await verificarDisponibilidadIntegrante({ dni: "12", email: "no-es-email" });
    expect(m.disponibilidad).toHaveBeenCalledWith({ dni: undefined, email: undefined, excluirId: undefined });
  });

  it.each(OTROS_ROLES)("%s: SIN_PERMISO, sin consultar (no sirve de oráculo)", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    expect((await verificarDisponibilidadIntegrante({ dni: "30123456" })).error?.code).toBe("SIN_PERMISO");
    expect(m.disponibilidad).not.toHaveBeenCalled();
  });

  it("sin sesión: SESION_INVALIDA", async () => {
    m.sesion.actual = null;
    expect((await verificarDisponibilidadIntegrante({ dni: "30123456" })).error?.code).toBe("SESION_INVALIDA");
  });
});
