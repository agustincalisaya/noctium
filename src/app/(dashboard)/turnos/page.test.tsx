import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

// HU-C-08: el Profesor ve el listado sin selector de profesor y el
// `profesor_id` de la URL no llega a la API; Gerente y Mesa lo conservan.

const m = vi.hoisted(() => ({ sesion: null as { user: { id: string; rol: string } } | null, materias: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => m.sesion }));
vi.mock("@/server/shared/with-permission", () => ({ verificarPermiso: vi.fn().mockRejectedValue(new Error("sin permiso")) }));
vi.mock("@/server/turnos/turno.service", () => ({ listarOpcionesFiltroMateria: m.materias }));
vi.mock("./turnos-listado", () => ({ TurnosListado: () => null }));

const { default: TurnosPage } = await import("./page");
const AJENO = "cmprofesorajeno00000000001";

type Props = { profesorId: string; puedeFiltrarProfesor: boolean; puedeConfigurar: boolean; materias: unknown[] };
async function propsPara(rol: string, params: Record<string, string> = { profesor_id: AJENO }) {
  m.sesion = { user: { id: `usuario-${rol}`, rol } };
  return ((await TurnosPage({ searchParams: Promise.resolve(params) })) as ReactElement<Props>).props;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.materias.mockResolvedValue([{ id: "materia-1", nombre: "Física", activa: true }]);
});

describe("HU-C-08 /turnos por rol", () => {
  it("Profesor: sin selector, sin acciones de configuración y el profesor_id de la URL se descarta", async () => {
    const props = await propsPara("PROFESOR");
    expect(props).toMatchObject({ profesorId: "", puedeFiltrarProfesor: false, puedeConfigurar: false });
    // HU-C-27 criterio 4: las opciones de materia se piden con la sesión (el servicio las acota a sus clases).
    expect(m.materias).toHaveBeenCalledWith({ id: "usuario-PROFESOR", rol: "PROFESOR" });
  });

  it.each(["GERENTE", "MESA_ENTRADA"])("%s: conserva el profesor_id de la URL y tiene selector", async (rol) => {
    expect(await propsPara(rol)).toMatchObject({ profesorId: AJENO, puedeFiltrarProfesor: true });
  });
});
