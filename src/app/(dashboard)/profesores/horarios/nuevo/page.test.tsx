import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Ajuste HU-D-01/HU-D-02: la acción "Registrar horario de atención" del alta
// entra a esta página con ?profesorId=<id>. El id se resuelve en el servidor
// contra los profesores activos; uno inválido, inexistente o inactivo deja
// el selector vacío. Servicios y permiso mockeados.

const { listarProfesoresActivos, obtenerHorariosDelProfesor } = vi.hoisted(() => ({
  listarProfesoresActivos: vi.fn(),
  obtenerHorariosDelProfesor: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/sesion/link-protegido", () => ({ LinkProtegido: () => null }));
vi.mock("@/components/shared/resumen-semanal-horarios", () => ({ ResumenSemanalHorarios: () => null }));
vi.mock("./registrar-horario-form", () => ({ RegistrarHorarioForm: () => null }));
vi.mock("@/server/shared/with-permission", () => ({
  PermisoError: class PermisoError extends Error {},
  verificarPermiso: vi.fn(async () => ({ id: "ckusuario0000000000000001" })),
}));
vi.mock("@/server/shared/parametros", () => ({
  obtenerParametrosHorarioOperativo: vi.fn(async () => ({
    dias: ["LUNES"],
    apertura: "08:00",
    cierre: "20:00",
    granularidad: 30,
  })),
}));
vi.mock("@/server/profesores/profesor.service", () => ({ listarProfesoresActivos, obtenerHorariosDelProfesor }));

const { default: RegistrarHorarioPage } = await import("./page");
const { RegistrarHorarioForm } = await import("./registrar-horario-form");

const ACTIVO = { id: "ckprofesor000000000000001", nombre: "Ana", apellido: "Gómez", dni: "28456789" };

function buscarFormulario(nodo: ReactNode): ReactElement<{ profesorIdInicial: string }> | null {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarFormulario(hijo);
      if (encontrado) return encontrado;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(nodo)) return null;
  if (nodo.type === RegistrarHorarioForm) return nodo as unknown as ReactElement<{ profesorIdInicial: string }>;
  return buscarFormulario(nodo.props.children);
}

async function profesorIdInicial(searchParams: Record<string, string | string[] | undefined>) {
  const pagina = await RegistrarHorarioPage({ searchParams: Promise.resolve(searchParams) });
  return buscarFormulario(pagina)?.props.profesorIdInicial;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Solo profesores activos: un inactivo (ej. Molina) no está en esta lista.
  listarProfesoresActivos.mockResolvedValue([ACTIVO]);
  obtenerHorariosDelProfesor.mockResolvedValue([]);
});

describe("/profesores/horarios/nuevo con ?profesorId=", () => {
  it("profesor activo recién creado → queda preseleccionado y se carga su resumen", async () => {
    expect(await profesorIdInicial({ profesorId: ACTIVO.id })).toBe(ACTIVO.id);
    expect(obtenerHorariosDelProfesor).toHaveBeenCalledWith(ACTIVO.id);
  });

  it.each([
    ["con formato inválido", { profesorId: "abc" }],
    ["inexistente", { profesorId: "ckprofesor000000000000404" }],
    ["inactivo (no está entre los activos)", { profesorId: "ckprofesor000000000000005" }],
    ["repetido en la URL", { profesorId: [ACTIVO.id, ACTIVO.id] }],
    ["ausente", {}],
  ])("id %s → selector vacío, sin resumen", async (_caso, searchParams) => {
    expect(await profesorIdInicial(searchParams)).toBe("");
    expect(obtenerHorariosDelProfesor).not.toHaveBeenCalled();
  });
});
