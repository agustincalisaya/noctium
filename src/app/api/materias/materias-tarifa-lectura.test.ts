import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ permiso: vi.fn(), listar: vi.fn(), obtener: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({ tienePermiso: m.permiso, withPermission: (_: string, fn: unknown) => fn }));
vi.mock("@/server/materias/materia.service", () => ({ listarMaterias: m.listar, obtenerMateriaPorId: m.obtener }));
import { GET as listado } from "./route";
import { GET as detalle } from "./[id]/route";
beforeEach(() => { vi.clearAllMocks(); m.listar.mockResolvedValue({ items: [] }); m.obtener.mockResolvedValue({ id: "m" }); });
it.each(["GERENTE", "MESA_ENTRADA", "PROFESOR"])("resuelve visibilidad de %s en ambos GET", async (rol) => {
  m.permiso.mockImplementation(async (p: string) => (rol === "GERENTE" && p === "materias:cambiar_tarifa") || (rol === "MESA_ENTRADA" && p === "materias:ver_tarifa"));
  await listado({ nextUrl: new URL("http://localhost/api/materias") } as never, { params: Promise.resolve({}) });
  await detalle({} as never, { params: Promise.resolve({ id: "m" }) });
  expect(m.listar).toHaveBeenCalledWith({ pagina: 1, por_pagina: 20 }, { conTarifa: rol !== "PROFESOR" });
  expect(m.obtener).toHaveBeenCalledWith("m", { conTarifa: rol !== "PROFESOR" });
});
