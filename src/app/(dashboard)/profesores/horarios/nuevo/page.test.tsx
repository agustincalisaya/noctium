import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Ajuste HU-D-01/HU-D-02: la acción "Registrar horario de atención" del alta
// entra a esta página con ?profesorId=<id>. El id se resuelve en el servidor
// contra los profesores activos; uno inválido, inexistente o inactivo deja
// el selector vacío. Servicios y permiso mockeados.

const { listarProfesoresActivos, obtenerHorariosDelProfesor, obtenerMateriasDelProfesor } = vi.hoisted(() => ({
  listarProfesoresActivos: vi.fn(),
  obtenerHorariosDelProfesor: vi.fn(),
  obtenerMateriasDelProfesor: vi.fn(),
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
vi.mock("@/components/shared/stepper-alta-profesor", () => ({ StepperAltaProfesor: () => null }));
vi.mock("@/server/profesores/profesor.service", () => ({
  listarProfesoresActivos,
  obtenerHorariosDelProfesor,
  obtenerMateriasDelProfesor,
}));

const { default: RegistrarHorarioPage } = await import("./page");
const { RegistrarHorarioForm } = await import("./registrar-horario-form");

const ACTIVO = { id: "ckprofesor000000000000001", nombre: "Ana", apellido: "Gómez", dni: "28456789" };

type PropsFormulario = { profesorIdInicial: string; modoAlta: boolean; cantidadHorarios: number };

function buscarFormulario(nodo: ReactNode): ReactElement<PropsFormulario> | null {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarFormulario(hijo);
      if (encontrado) return encontrado;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(nodo)) return null;
  if (nodo.type === RegistrarHorarioForm) return nodo as unknown as ReactElement<PropsFormulario>;
  return buscarFormulario(nodo.props.children);
}

async function propsFormulario(searchParams: Record<string, string | string[] | undefined>) {
  const pagina = await RegistrarHorarioPage({ searchParams: Promise.resolve(searchParams) });
  return buscarFormulario(pagina)?.props;
}

async function profesorIdInicial(searchParams: Record<string, string | string[] | undefined>) {
  return (await propsFormulario(searchParams))?.profesorIdInicial;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Solo profesores activos: un inactivo (ej. Molina) no está en esta lista.
  listarProfesoresActivos.mockResolvedValue([ACTIVO]);
  obtenerHorariosDelProfesor.mockResolvedValue([]);
  obtenerMateriasDelProfesor.mockResolvedValue([]);
});

describe("/profesores/horarios/nuevo con ?alta=1 (paso 3 del wizard de alta)", () => {
  it("profesor activo → modo alta, con la cantidad de intervalos ya cargados", async () => {
    obtenerHorariosDelProfesor.mockResolvedValue([{ id: "h1" }, { id: "h2" }]);
    const props = await propsFormulario({ profesorId: ACTIVO.id, alta: "1" });
    expect(props?.modoAlta).toBe(true);
    expect(props?.cantidadHorarios).toBe(2);
  });

  it("profesor inválido → la pantalla vuelve a su modo normal", async () => {
    expect((await propsFormulario({ profesorId: "abc", alta: "1" }))?.modoAlta).toBe(false);
  });

  it("sin ?alta=1 → modo normal", async () => {
    expect((await propsFormulario({ profesorId: ACTIVO.id }))?.modoAlta).toBe(false);
  });
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
