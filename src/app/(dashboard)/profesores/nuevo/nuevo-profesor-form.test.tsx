// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ajuste HU-D-01/HU-D-02: sección "Datos de contacto" del alta, y paso 1 del
// wizard de alta (toast + avance automático a materias, sin pantalla
// intermedia). La Server Action y el toast están mockeados.

const { crearProfesor, verificarDniDisponible, setDirty, push, notificarExito } = vi.hoisted(() => ({
  crearProfesor: vi.fn(),
  verificarDniDisponible: vi.fn(),
  setDirty: vi.fn(),
  push: vi.fn(),
  notificarExito: vi.fn(),
}));
vi.mock("../actions", () => ({ crearProfesor, verificarDniDisponible }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty }) }));
vi.mock("@/components/shared/confirmar-descarte-dialog", () => ({ ConfirmarDescarteDialog: () => null }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ notificarExito }) }));
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  return {
    Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => React.createElement("button", { ...props, "data-variant": variant, "data-size": size }, children),
  };
});
vi.mock("@/components/ui/input", async () => {
  const React = await import("react");
  return { Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props) };
});
vi.mock("@/components/ui/label", async () => {
  const React = await import("react");
  return { Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => React.createElement("label", props) };
});

const { NuevoProfesorForm } = await import("./nuevo-profesor-form");

const PROFESOR = "ckprofesor000000000000001";

let contenedor: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  await act(async () => {
    root.render(<NuevoProfesorForm dniLongitudMin={7} dniLongitudMax={8} fechaMaximaNacimiento="2008-01-01" />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

function campo(nombre: string) {
  return contenedor.querySelector<HTMLInputElement>(`[name="${nombre}"]`)!;
}

function completar(valores: Record<string, string>) {
  for (const [nombre, valor] of Object.entries(valores)) campo(nombre).value = valor;
}

const IDENTIDAD = { nombre: "Ana", apellido: "Gómez", dni: "28456789", fechaNacimiento: "1980-05-10" };

async function enviar() {
  await act(async () => {
    contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("Nuevo profesor — datos de contacto", () => {
  it("muestra la sección opcional con Teléfono y Email, sin asterisco", () => {
    expect(contenedor.querySelector("legend")?.textContent).toBe("Datos de contacto");
    expect(contenedor.textContent).toContain("Opcional. Podés cargarlos ahora o más tarde desde la ficha.");
    expect(contenedor.querySelector('label[for="telefono"]')?.textContent).toBe("Teléfono");
    expect(contenedor.querySelector('label[for="email"]')?.textContent).toBe("Email");
  });

  it("teléfono inválido → error junto al campo, foco en Teléfono, nada enviado y datos conservados", async () => {
    completar({ ...IDENTIDAD, telefono: "123-4567", email: "ana@mail.com" });
    await enviar();

    expect(crearProfesor).not.toHaveBeenCalled();
    expect(campo("telefono").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("El teléfono debe tener entre 8 y 15 dígitos");
    expect(document.activeElement).toBe(campo("telefono"));
    expect(campo("email").value).toBe("ana@mail.com");
    expect(campo("nombre").value).toBe("Ana");
  });

  it("errores en identidad y contacto → foco en el primero del formulario", async () => {
    completar({ ...IDENTIDAD, dni: "12", telefono: "123" });
    await enviar();

    expect(document.activeElement).toBe(campo("dni"));
    expect(campo("telefono").getAttribute("aria-invalid")).toBe("true");
  });

  it("envía teléfono y email en el FormData", async () => {
    crearProfesor.mockResolvedValue({ status: "exito", profesorId: PROFESOR, nombre: "Ana", apellido: "Gómez", conContacto: true });
    completar({ ...IDENTIDAD, telefono: "(0387) 15-412-3456", email: "Ana@Mail.com" });
    await enviar();

    const formData = crearProfesor.mock.calls[0]![1] as FormData;
    expect(formData.get("telefono")).toBe("(0387) 15-412-3456");
    expect(formData.get("email")).toBe("Ana@Mail.com");
  });

  it("email de otra cuenta (servidor) → mensaje genérico junto a Email y foco ahí", async () => {
    crearProfesor.mockResolvedValue({
      status: "error_validacion",
      errores: { email: ["Ese email ya está asociado a otra cuenta"] },
    });
    completar({ ...IDENTIDAD, email: "profesor2@noctium.local" });
    await enviar();

    expect(campo("email").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("Ese email ya está asociado a otra cuenta");
    expect(document.activeElement).toBe(campo("email"));
    expect(campo("email").value).toBe("profesor2@noctium.local");
  });
});

describe("Nuevo profesor — paso 1 del wizard de alta", () => {
  it.each([
    ["sin contacto", false, IDENTIDAD],
    ["con contacto", true, { ...IDENTIDAD, telefono: "1234-5678" }],
  ])("%s: toast de éxito y avance automático a materias (paso 2)", async (_caso, conContacto, valores) => {
    crearProfesor.mockResolvedValue({ status: "exito", profesorId: PROFESOR, nombre: "Ana", apellido: "Gómez", conContacto });
    completar(valores);
    await enviar();

    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(notificarExito).toHaveBeenCalledWith("Profesor registrado correctamente");
    expect(push).toHaveBeenCalledWith(`/profesores/${PROFESOR}/materias?alta=1`);
  });

  it("sin pantalla intermedia: el formulario sigue montado y deshabilitado hasta que navega", async () => {
    crearProfesor.mockResolvedValue({ status: "exito", profesorId: PROFESOR, nombre: "Ana", apellido: "Gómez", conContacto: false });
    completar(IDENTIDAD);
    await enviar();

    expect(contenedor.querySelector("form")).not.toBeNull();
    expect(contenedor.querySelectorAll("a")).toHaveLength(0);
    expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it("error de validación del servidor: no notifica ni navega", async () => {
    crearProfesor.mockResolvedValue({
      status: "error_validacion",
      errores: { dni: ["Ya existe un profesor registrado con ese DNI"] },
    });
    completar(IDENTIDAD);
    await enviar();

    expect(notificarExito).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });
});
