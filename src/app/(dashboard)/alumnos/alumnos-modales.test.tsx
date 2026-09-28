// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty: vi.fn() }) }));
vi.mock("@/components/shared/confirmar-descarte-dialog", () => ({ ConfirmarDescarteDialog: () => null }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: vi.fn() }));
vi.mock("./nueva/alumno-form", () => ({ AlumnoForm: () => <div>Formulario de alta</div> }));
vi.mock("./[id]/editar/editar-alumno-form", () => ({ EditarAlumnoForm: () => <div>Formulario de edición</div> }));
vi.mock("./[id]/contacto/contacto-alumno-form", () => ({ ContactoAlumnoForm: () => <div>Formulario de contacto</div> }));
vi.mock("./[id]/forma-pago/forma-pago-form", () => ({ FormaPagoForm: () => <div>Formulario de pago</div> }));

const { fetchAutenticado } = await import("@/lib/fetch-autenticado");
const { AbrirAlumno, AbrirNuevoAlumno, AlumnosModales } = await import("./alumnos-modales");
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); });

const props = { puedeCrear: true, puedeEditar: true, dniLongitudMin: 7, dniLongitudMax: 8, formasPagoActivas: [] };
const alumno = { id: "alumno-1", nombre: "Florencia", apellido: "Castro", dni: "40100015", is_active: true, telefono: "12345678", email: null, forma_pago_preferida: "Débito", forma_pago_preferida_id: "debito", created_at: "2026-09-27T00:00:00.000Z", fecha_nacimiento: "2000-06-03", genero: null, version: 1 };

describe("Modales de alumnos", () => {
  it("abre la ficha y sus formularios sobre el listado", async () => {
    vi.mocked(fetchAutenticado).mockResolvedValue({ ok: true, json: async () => ({ data: alumno }) } as Response);
    await act(async () => root.render(<AlumnosModales {...props}><AbrirAlumno id={alumno.id} nombre="Castro, Florencia" /></AlumnosModales>));
    await act(async () => container.querySelector("button")!.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Fecha de alta y forma de pago");
    expect(fetchAutenticado).toHaveBeenCalledWith("/api/alumnos/alumno-1", expect.objectContaining({ cache: "no-store" }));
    for (const [boton, contenido] of [["Modificar datos", "Formulario de edición"], ["Editar contacto", "Formulario de contacto"], ["Editar forma de pago", "Formulario de pago"]]) {
      await act(async () => { [...document.querySelectorAll("button")].find((item) => item.textContent === boton)!.click(); });
      expect(document.body.textContent).toContain(contenido);
      await act(async () => { [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Volver a la ficha"))!.click(); });
    }
  });

  it("abre el alta sin navegar", async () => {
    await act(async () => root.render(<AlumnosModales {...props}><AbrirNuevoAlumno /></AlumnosModales>));
    await act(async () => container.querySelector("button")!.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Formulario de alta");
  });
});
