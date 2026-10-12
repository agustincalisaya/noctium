import { beforeEach, describe, expect, it, vi } from "vitest";

// Server Actions de baja y reactivación del alumno (HU-B-07, spec_modulo_B.md
// 2.10.2 y 2.11). Con el verificarPermiso real: la sesión y los permisos salen
// de mocks de `auth` y de `prisma`; el servicio está simulado.

const m = vi.hoisted(() => ({
  desactivar: vi.fn(),
  reactivar: vi.fn(),
  permiso: vi.fn(),
  sesion: { actual: null as { user: { id: string; rol: string } } | null },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: vi.fn() }),
  headers: async () => new Headers(),
}));
vi.mock("@/server/alumnos/alumno.estado.service", () => ({ desactivarAlumno: m.desactivar, reactivarAlumno: m.reactivar }));
vi.mock("@/server/alumnos/alumno.service", () => ({}));
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
  obtenerIp: vi.fn(),
}));

import { ErrorDeDominio } from "@/server/shared/error-dominio";
const { desactivarAlumno, reactivarAlumno } = await import("@/server/alumnos/actions");
const { revalidatePath } = await import("next/cache");

const ID = "ckalumno";
const ACCIONES = [
  ["desactivarAlumno", desactivarAlumno, m.desactivar, { version: 2, motivo: "Se mudó" }],
  ["reactivarAlumno", reactivarAlumno, m.reactivar, { version: 3 }],
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  m.sesion.actual = { user: { id: "mesa", rol: "MESA_ENTRADA" } };
  m.permiso.mockImplementation(async ({ where }) => (where.rolPermiso_accionPermiso.rolPermiso === "MESA_ENTRADA" ? {} : null));
  m.desactivar.mockResolvedValue({ id: ID, activo: false, version: 3, inscripciones_quitadas: 1 });
  m.reactivar.mockResolvedValue({ id: ID, activo: true, version: 4 });
});

describe.each(ACCIONES)("%s", (_nombre, accion, servicio, valido) => {
  it("pide alumnos:cambiar_estado, llama al servicio con el actor de la sesión y revalida el listado y la ficha", async () => {
    const respuesta = await accion(ID, valido);
    expect(respuesta.error).toBeNull();
    expect(m.permiso.mock.calls[0]![0].where.rolPermiso_accionPermiso).toEqual({ rolPermiso: "MESA_ENTRADA", accionPermiso: "alumnos:cambiar_estado" });
    expect(servicio).toHaveBeenCalledWith(ID, valido, { tipo: "USUARIO", usuarioId: "mesa" });
    expect(revalidatePath).toHaveBeenCalledWith("/alumnos");
    expect(revalidatePath).toHaveBeenCalledWith(`/alumnos/${ID}`);
  });

  it.each(["GERENTE", "PROFESOR", "ALUMNO"])("%s sin permiso: SIN_PERMISO y el servicio no se llama", async (rol) => {
    m.sesion.actual = { user: { id: "otro", rol } };
    const respuesta = await accion(ID, valido);
    expect(respuesta).toEqual({ data: null, error: { code: "SIN_PERMISO", message: expect.any(String) } });
    expect(servicio).not.toHaveBeenCalled();
  });

  it("sin permiso y con un payload inválido: responde SIN_PERMISO y no revela nada de la validación", async () => {
    m.sesion.actual = { user: { id: "gerente", rol: "GERENTE" } };
    const respuesta = await accion(ID, { version: "no es un número", campo_ajeno: true });
    expect(respuesta.error).toMatchObject({ code: "SIN_PERMISO" });
    expect(respuesta.error).not.toHaveProperty("detalles");
    expect(servicio).not.toHaveBeenCalled();
  });

  it("sin sesión: SESION_INVALIDA aunque el payload sea inválido", async () => {
    m.sesion.actual = null;
    const respuesta = await accion(ID, {});
    expect(respuesta.error).toMatchObject({ code: "SESION_INVALIDA" });
    expect(respuesta.error).not.toHaveProperty("detalles");
    expect(servicio).not.toHaveBeenCalled();
  });

  it("con permiso y un payload inválido: VALIDATION_ERROR con el detalle por campo y sin llamar al servicio", async () => {
    const respuesta = await accion(ID, { version: -1 });
    expect(respuesta.error).toMatchObject({ code: "VALIDATION_ERROR", detalles: { version: [expect.any(String)] } });
    expect(servicio).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un error de dominio del servicio vuelve como {code, message} sin revalidar", async () => {
    servicio.mockRejectedValue(new ErrorDeDominio("errores.alumno.conflictoEdicion"));
    const respuesta = await accion(ID, valido);
    expect(respuesta).toEqual({ data: null, error: { code: "CONFLICTO_EDICION_CONCURRENTE", message: expect.any(String) } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
