// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ajuste HU-D-01/HU-D-02: sección "Datos de contacto" del alta, y paso 1 del
// wizard de alta (toast + avance automático a materias, sin pantalla
// intermedia). La Server Action y el toast están mockeados.
//
// HU-A-06 (criterios 1, 2 y 5, spec_modulo_D.md §2.9.1): el email pasa a ser
// obligatorio en la pantalla, el registro se confirma con el diálogo de
// HU-C-25 (simulado abajo) y el toast informa la cuenta creada. Los casos que
// fijaban lo anterior se ajustan, cada uno con su motivo.

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

// Diálogo de HU-C-25 simulado: conserva el contrato de onConfirmar (un rechazo
// se muestra adentro; si resuelve, se cierra).
const errorDialogo = vi.hoisted(() => ({ actual: "" }));
vi.mock("@/components/shared/confirmar-accion-dialog", async () => {
  const React = await import("react");
  return {
    ConfirmarAccionDialog: (p: { abierto: boolean; titulo: string; detalle?: string; textoConfirmar: string; onConfirmar: () => Promise<void>; onCerrar: () => void }) =>
      p.abierto
        ? React.createElement(
            "div",
            { "data-dialogo": "" },
            React.createElement("p", null, p.titulo),
            React.createElement("p", null, p.detalle),
            React.createElement(
              "button",
              { type: "button", "data-confirmar": "", onClick: () => p.onConfirmar().then(p.onCerrar, (e: Error) => { errorDialogo.actual = e.message; }) },
              p.textoConfirmar,
            ),
          )
        : null,
  };
});

const { NuevoProfesorForm } = await import("./nuevo-profesor-form");

const EXITO = "Profesor registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.";

const PROFESOR = "ckprofesor000000000000001";

let contenedor: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  errorDialogo.actual = "";
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

/** HU-C-25: envía y confirma en el diálogo. */
async function enviarYConfirmar() {
  await enviar();
  await act(async () => {
    contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click();
  });
}

describe("Nuevo profesor — datos de contacto", () => {
  // HU-A-06 c1 (prototipo fig. 85): el email deja de ser opcional («con él se
  // crea la cuenta de acceso») y lleva asterisco; el teléfono sigue opcional.
  it("muestra Email obligatorio con su ayuda y Teléfono opcional", () => {
    expect(contenedor.querySelector("legend")?.textContent).toBe("Datos de contacto y cuenta de acceso");
    expect(contenedor.querySelector('label[for="telefono"]')?.textContent).toBe("Teléfono");
    expect(contenedor.textContent).toContain("Opcional.");
    expect(contenedor.querySelector('label[for="email"]')?.textContent).toBe("Email *");
    expect(campo("email").required).toBe(true);
    expect(contenedor.textContent).toContain("Ingresá el email: con él se crea la cuenta de acceso");
  });

  // HU-A-06 c1: sin email la pantalla no registra (el servidor sí lo admite, P-D1).
  it("sin email: no abre la confirmación ni registra; pide el email", async () => {
    completar(IDENTIDAD);
    await enviar();

    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(crearProfesor).not.toHaveBeenCalled();
    expect(campo("email").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("Ingresá el email del profesor");
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

  // HU-C-25: ahora se envía después de confirmar en el diálogo, que nombra el
  // email con el que va a ingresar.
  it("envía teléfono y email en el FormData", async () => {
    crearProfesor.mockResolvedValue({ status: "exito", profesorId: PROFESOR, nombre: "Ana", apellido: "Gómez", conContacto: true });
    completar({ ...IDENTIDAD, telefono: "(0387) 15-412-3456", email: "Ana@Mail.com" });
    await enviar();
    expect(contenedor.textContent).toContain("¿Estás seguro de que querés registrar este profesor?");
    expect(contenedor.textContent).toContain("ingresa con ana@mail.com y su DNI como contraseña");
    expect(crearProfesor).not.toHaveBeenCalled();
    await act(async () => {
      contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click();
    });

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
    // HU-C-25: el rechazo llega al confirmar y cierra el diálogo.
    await enviarYConfirmar();

    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(campo("email").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("Ese email ya está asociado a otra cuenta");
    expect(document.activeElement).toBe(campo("email"));
    expect(campo("email").value).toBe("profesor2@noctium.local");
  });
});

describe("Nuevo profesor — paso 1 del wizard de alta", () => {
  // HU-A-06 c1 y c5: el email es obligatorio (los dos casos lo cargan), se
  // confirma con HU-C-25 y el toast (que se conserva, spec_modulo_D.md
  // §2.9.1) informa la cuenta creada (antes: «Profesor registrado correctamente»).
  it.each([
    ["solo email", true, { ...IDENTIDAD, email: "ana@mail.com" }],
    ["email y teléfono", true, { ...IDENTIDAD, telefono: "1234-5678", email: "ana@mail.com" }],
  ])("%s: toast de éxito y avance automático a materias (paso 2)", async (_caso, conContacto, valores) => {
    crearProfesor.mockResolvedValue({ status: "exito", profesorId: PROFESOR, nombre: "Ana", apellido: "Gómez", conContacto });
    completar(valores);
    await enviarYConfirmar();

    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(notificarExito).toHaveBeenCalledWith(EXITO);
    expect(push).toHaveBeenCalledWith(`/profesores/${PROFESOR}/materias?alta=1`);
  });

  // HU-A-06 c1: con email obligatorio y la confirmación de HU-C-25.
  it("sin pantalla intermedia: el formulario sigue montado y deshabilitado hasta que navega", async () => {
    crearProfesor.mockResolvedValue({ status: "exito", profesorId: PROFESOR, nombre: "Ana", apellido: "Gómez", conContacto: true });
    completar({ ...IDENTIDAD, email: "ana@mail.com" });
    await enviarYConfirmar();

    expect(contenedor.querySelector("form")).not.toBeNull();
    expect(contenedor.querySelectorAll("a")).toHaveLength(0);
    expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it("error de validación del servidor: no notifica ni navega", async () => {
    crearProfesor.mockResolvedValue({
      status: "error_validacion",
      errores: { dni: ["Ya existe un profesor registrado con ese DNI"] },
    });
    // HU-A-06 c1: con email obligatorio y la confirmación de HU-C-25.
    completar({ ...IDENTIDAD, email: "ana@mail.com" });
    await enviarYConfirmar();

    expect(notificarExito).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });
});
