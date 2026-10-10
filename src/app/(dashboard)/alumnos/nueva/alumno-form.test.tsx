// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Alta de alumno con contacto opcional: crearAlumno() y, si se cargó
// contacto, actualizarContactoAlumno() encadenada con el id creado. Las
// Server Actions están mockeadas.
//
// HU-A-06 (criterios 1, 2 y 5): el email pasa a ser obligatorio en la
// pantalla y el alta es una sola llamada atómica (ficha, cuenta y contacto),
// confirmada con el diálogo de HU-C-25 (simulado abajo). Los casos que
// fijaban el alta en dos pasos se ajustan, cada uno con su motivo.

const { crearAlumno, actualizarContactoAlumno, setDirty, push } = vi.hoisted(() => ({
  crearAlumno: vi.fn(),
  actualizarContactoAlumno: vi.fn(),
  setDirty: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/server/alumnos/actions", () => ({ crearAlumno, actualizarContactoAlumno }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), unstable_rethrow: () => {} }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty }) }));
vi.mock("@base-ui/react/alert-dialog", () => ({ AlertDialog: { Root: () => null } }));
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
vi.mock("@/components/ui/label", async () => {
  const React = await import("react");
  return { Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => React.createElement("label", props) };
});

const { AlumnoForm } = await import("./alumno-form");

const ALUMNO = "ckalumno00000000000000001";
const IDENTIDAD = { nombre: "Ana", apellido: "Gómez", dni: "40123456", fecha_nacimiento: "2005-05-10" };
const CREADO = { data: { id: ALUMNO, nombre: "Ana", apellido: "Gómez", dni: "40123456", activo: true }, error: null };

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
    root.render(<AlumnoForm dniLongitudMin={7} dniLongitudMax={8} />);
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

describe("Nuevo alumno — sección de contacto", () => {
  // HU-A-06 c1: el email deja de ser opcional («con él se crea la cuenta de
  // acceso»); el teléfono sigue opcional. Los placeholders no cambian.
  it("muestra Email obligatorio con su ayuda, Teléfono opcional y los mismos placeholders que la pantalla de contacto", () => {
    expect(contenedor.querySelector("legend")?.textContent).toBe("Datos de contacto y cuenta de acceso");
    expect(contenedor.textContent).toContain("Ingresá el email: con él se crea la cuenta de acceso");
    expect(campo("email").required).toBe(true);
    expect(contenedor.textContent).toContain("Opcional.");
    expect(campo("telefono").placeholder).toBe("Ej.: (0387) 15-412-3456");
    expect(campo("email").placeholder).toBe("Ej.: nombre@dominio.com");
  });

  it("teléfono inválido → error junto al campo, foco en Teléfono y no se crea el alumno", async () => {
    completar({ ...IDENTIDAD, telefono: "123-4567", email: "ana@mail.com" });
    await enviar();

    expect(crearAlumno).not.toHaveBeenCalled();
    expect(campo("telefono").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("El teléfono debe tener entre 8 y 15 dígitos");
    expect(document.activeElement).toBe(campo("telefono"));
    expect(campo("email").value).toBe("ana@mail.com");
  });

  it("errores en identidad y contacto → se muestran juntos, foco en el primero del formulario", async () => {
    completar({ ...IDENTIDAD, dni: "12", email: "no-es-email" });
    await enviar();

    expect(crearAlumno).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(campo("dni"));
    expect(campo("email").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("Nuevo alumno — alta y contacto encadenado", () => {
  // HU-A-06 c1: sin email la pantalla ya no registra (antes: alta solo de
  // identidad). El servidor lo sigue admitiendo (spec_modulo_B.md P-B1).
  it("sin email: no abre la confirmación ni crea el alumno; pide el email", async () => {
    completar(IDENTIDAD);
    await enviar();

    expect(contenedor.querySelector("[data-dialogo]")).toBeNull();
    expect(crearAlumno).not.toHaveBeenCalled();
    expect(actualizarContactoAlumno).not.toHaveBeenCalled();
    expect(campo("email").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("Ingresá el email del alumno");
    expect(document.activeElement).toBe(campo("email"));
  });

  // HU-A-06 c2 y c5: ficha, cuenta y contacto en una sola llamada atómica
  // (antes: alta y después contacto con el id creado), con la confirmación de
  // HU-C-25 y el banner con el mensaje de la cuenta.
  it("con email: confirma y crea ficha, cuenta y contacto en una sola llamada", async () => {
    crearAlumno.mockResolvedValue({ ...CREADO, data: { ...CREADO.data, cuenta: { creada: true, debe_cambiar_password: true } } });
    completar({ ...IDENTIDAD, email: "Ana@Mail.com" });
    await enviar();

    expect(contenedor.textContent).toContain("¿Estás seguro de que querés registrar este alumno?");
    expect(contenedor.textContent).toContain("ingresa con ana@mail.com y su DNI como contraseña");
    expect(crearAlumno).not.toHaveBeenCalled();

    await act(async () => {
      contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click();
    });
    expect(crearAlumno).toHaveBeenCalledExactlyOnceWith({ ...IDENTIDAD, genero: undefined, email: "Ana@Mail.com", telefono: "" });
    expect(actualizarContactoAlumno).not.toHaveBeenCalled();
    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(push).toHaveBeenCalledWith("/alumnos?creada=1&cuenta=1");
  });

  // HU-A-06 c1: el email es obligatorio, así que el caso lo completa y
  // confirma; el rechazo por DNI sigue igual, junto al campo y sin navegar.
  it("si el alta falla (DNI duplicado) no intenta guardar el contacto ni redirige", async () => {
    crearAlumno.mockResolvedValue({ data: null, error: { code: "DNI_DUPLICADO", message: "Ya existe un alumno registrado con ese DNI" } });
    completar({ ...IDENTIDAD, telefono: "(0387) 15-412-3456", email: "ana@mail.com" });
    await enviarYConfirmar();

    expect(actualizarContactoAlumno).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain("Ya existe un alumno registrado con ese DNI");
    expect(document.activeElement).toBe(campo("dni"));
  });

  // HU-A-06 c1 y c2: si la cuenta no se puede crear, tampoco la ficha (antes:
  // el alta quedaba y el listado avisaba del contacto). El aviso va junto al
  // campo Email, sin revelar de quién es la cuenta.
  it("email de otra cuenta: no se registra nada; el aviso queda junto al campo Email", async () => {
    crearAlumno.mockResolvedValue({ data: null, error: { code: "EMAIL_YA_ASOCIADO", message: "Ese email ya está asociado a otra cuenta" } });
    completar({ ...IDENTIDAD, email: "alumno2@noctium.local" });
    await enviarYConfirmar();

    expect(push).not.toHaveBeenCalled();
    expect(actualizarContactoAlumno).not.toHaveBeenCalled();
    expect(campo("email").getAttribute("aria-invalid")).toBe("true");
    expect(contenedor.textContent).toContain("Ese email ya está asociado a otra cuenta");
    expect(document.activeElement).toBe(campo("email"));
  });

  // HU-A-06 c2: el alta es atómica, así que un fallo de comunicación no deja
  // un alumno a medias (antes: redirigía con el aviso sin_contacto). El error
  // se muestra en el diálogo de confirmación, sin navegar.
  it("si el alta falla por comunicación, no redirige y lo informa en la confirmación", async () => {
    crearAlumno.mockRejectedValue(new Error("fetch failed"));
    completar({ ...IDENTIDAD, telefono: "(0387) 15-412-3456", email: "ana@mail.com" });
    await enviarYConfirmar();

    expect(push).not.toHaveBeenCalled();
    expect(errorDialogo.actual).toBe("fetch failed");
  });
});
