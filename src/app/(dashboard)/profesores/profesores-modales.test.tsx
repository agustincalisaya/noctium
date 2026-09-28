// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty: vi.fn() }) }));
vi.mock("@/components/shared/confirmar-descarte-dialog", () => ({ ConfirmarDescarteDialog: () => null }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: vi.fn() }));
vi.mock("./nuevo/nuevo-profesor-form", () => ({ NuevoProfesorForm: () => <div>Formulario de alta</div> }));
vi.mock("./[id]/contacto/contacto-profesor-form", () => ({ ContactoProfesorForm: () => null }));
vi.mock("./[id]/materias/asociar-materias-form", () => ({ AsociarMateriasForm: () => null }));
vi.mock("./horarios/nuevo/registrar-horario-form", () => ({ RegistrarHorarioForm: () => null }));

const { fetchAutenticado } = await import("@/lib/fetch-autenticado");
const { AbrirNuevoProfesor, AbrirProfesor, ProfesoresModales } = await import("./profesores-modales");

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); });

const props = {
  puedeCrear: true,
  puedeEditar: true,
  dniLongitudMin: 7,
  dniLongitudMax: 8,
  fechaMaximaNacimiento: "2008-09-28",
  materiasActivas: [],
  parametrosHorario: { apertura: "08:00", cierre: "20:00", granularidadMinutos: 30, diasOperativos: ["LUNES" as const] },
};

describe("Modales de profesores", () => {
  it("abre la ficha al pulsar una fila sin navegar", async () => {
    vi.mocked(fetchAutenticado).mockResolvedValue({ ok: true, json: async () => ({ data: {
      id: "prof-1", nombre: "Pedro", apellido: "Ávila", dni: "32200009", activo: true,
      fechaNacimiento: "1980-06-01T00:00:00.000Z", fechaAlta: "2026-09-27T00:00:00.000Z",
      genero: "MASCULINO", telefono: null, email: null, materias: [], horarios: [],
    } }) } as Response);
    await act(async () => root.render(<ProfesoresModales {...props}><AbrirProfesor id="prof-1" nombre="Ávila, Pedro" /></ProfesoresModales>));
    const boton = container.querySelector("button")!;
    expect(boton.closest("a")).toBeNull();
    await act(async () => boton.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Datos personales");
    expect(fetchAutenticado).toHaveBeenCalledWith("/api/profesores/prof-1/ficha", expect.objectContaining({ cache: "no-store" }));
  });

  it("abre el alta en un modal", async () => {
    await act(async () => root.render(<ProfesoresModales {...props}><AbrirNuevoProfesor /></ProfesoresModales>));
    await act(async () => container.querySelector("button")!.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Formulario de alta");
  });
});
