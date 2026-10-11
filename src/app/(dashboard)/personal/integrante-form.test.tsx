// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Formulario único del integrante de mesa de entrada (HU-F-01, decisión 13 de
// la task; prototipo figura 91), en modo alta y en modo edición. Las Server
// Actions, el router y el estado «sucio» están simulados; el diálogo de
// HU-C-25 se simula conservando su contrato (un rechazo se muestra adentro; si
// resuelve, se cierra).

const m = vi.hoisted(() => ({
  crear: vi.fn(),
  modificar: vi.fn(),
  disponibilidad: vi.fn(),
  setDirty: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  errorDialogo: { actual: "" },
}));
vi.mock("@/server/personal/actions", () => ({
  crearIntegrante: m.crear,
  modificarIntegrante: m.modificar,
  verificarDisponibilidadIntegrante: m.disponibilidad,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, replace: m.replace, refresh: m.refresh }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty: m.setDirty }) }));
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  return {
    Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
      React.createElement("button", { ...props, "data-variant": variant, "data-size": size }, children),
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
vi.mock("@/components/shared/confirmar-descarte-dialog", async () => {
  const React = await import("react");
  return {
    ConfirmarDescarteDialog: (p: { abierto: boolean; onConfirmar: () => void }) =>
      p.abierto
        ? React.createElement("button", { type: "button", "data-descartar": "", onClick: p.onConfirmar }, "Salir sin guardar")
        : null,
  };
});
vi.mock("@/components/shared/confirmar-accion-dialog", async () => {
  const React = await import("react");
  return {
    ConfirmarAccionDialog: (p: { abierto: boolean; titulo: string; detalle?: string; textoConfirmar: string; onConfirmar: () => Promise<void>; onCerrar: () => void }) =>
      p.abierto
        ? React.createElement(
            "div",
            { "data-dialogo": "" },
            React.createElement("p", { "data-titulo": "" }, p.titulo),
            React.createElement("p", { "data-detalle": "" }, p.detalle ?? ""),
            React.createElement(
              "button",
              {
                type: "button",
                "data-confirmar": "",
                onClick: () =>
                  p.onConfirmar().then(p.onCerrar, (e: Error) => {
                    m.errorDialogo.actual = e.message;
                  }),
              },
              p.textoConfirmar,
            ),
          )
        : null,
  };
});

const { IntegranteForm } = await import("./integrante-form");

const ID = "ckficha";
const EMAIL_REQUERIDO = "Ingresá el email: con él se crea la cuenta de acceso";
const DNI_DUPLICADO = "Ya existe un integrante de mesa de entrada con ese DNI";
const EMAIL_EN_USO = "Ese email ya está asociado a otra cuenta";
const INTEGRANTE = {
  id: ID,
  version: 2,
  nombre: "Lucía",
  apellido: "Fernández",
  dni: "30123456",
  fechaNacimiento: "1990-04-12",
  genero: null,
  telefono: "01145551234",
  email: "lucia@mail.com",
};

let contenedor: HTMLDivElement;
let root: Root;

async function montar(conIntegrante = false) {
  await act(async () => {
    root.render(
      conIntegrante ? (
        <IntegranteForm dniLongitudMin={7} dniLongitudMax={8} titulo="Lucía Fernández" integrante={INTEGRANTE} />
      ) : (
        <IntegranteForm dniLongitudMin={7} dniLongitudMax={8} titulo="Nuevo integrante" bajada="Al registrar la ficha se crea su cuenta" />
      ),
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  m.errorDialogo.actual = "";
  m.crear.mockResolvedValue({ data: { id: ID }, error: null });
  m.modificar.mockResolvedValue({ data: { id: ID, campos_modificados: ["telefono"], version: 3 }, error: null });
  m.disponibilidad.mockResolvedValue({ data: { dni_disponible: true, email_disponible: true }, error: null });
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

const campo = (nombre: string) => contenedor.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${nombre}"]`)!;
const botonGuardar = () => contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const botonCancelar = () => [...contenedor.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Cancelar")!;
const errorDe = (nombre: string) => contenedor.querySelector(`#${nombre}-error`)?.textContent;
const dialogo = () => contenedor.querySelector("[data-dialogo]");

/** Escribe como el usuario: el setter nativo + el evento que escucha React. */
async function escribir(nombre: string, valor: string) {
  const elemento = campo(nombre);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(elemento), "value")!.set!;
  await act(async () => {
    setter.call(elemento, valor);
    elemento.dispatchEvent(new Event(elemento instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

async function salirDe(nombre: string) {
  await act(async () => {
    campo(nombre).dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

async function completarAlta() {
  await escribir("nombre", "Lucía");
  await escribir("apellido", "Fernández");
  await escribir("dni", "30123456");
  await escribir("fechaNacimiento", "1990-04-12");
  await escribir("email", "Lucia@Mail.com");
}

async function enviar() {
  await act(async () => {
    contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function confirmar() {
  await act(async () => {
    contenedor.querySelector<HTMLButtonElement>("[data-confirmar]")!.click();
  });
}

describe("modo alta (prototipo figura 91)", () => {
  beforeEach(() => montar());

  it("título, bajada, «Cancelar» y «Registrar» arriba, Identidad y Contacto con la nota del email", () => {
    expect(contenedor.querySelector("h1")?.textContent).toBe("Nuevo integrante");
    const botones = [...contenedor.querySelectorAll("button")].map((b) => b.textContent);
    expect(botones.slice(0, 2)).toEqual(["Cancelar", "Registrar"]);
    // Los botones están antes de las secciones del formulario.
    const primerFieldset = contenedor.querySelector("fieldset")!;
    expect(botonGuardar().compareDocumentPosition(primerFieldset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...contenedor.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(["Identidad", "Contacto"]);
    expect(contenedor.textContent).toContain("El email es obligatorio: con él se crea la cuenta de acceso.");
    expect((campo("genero") as HTMLSelectElement).options[0]!.textContent).toBe("Sin especificar");
    expect(contenedor.querySelector("#telefono-ayuda")?.textContent).toBe("Opcional.");
  });

  it("email vacío: el error del backlog junto al campo, sin confirmar ni llamar al servidor", async () => {
    await completarAlta();
    await escribir("email", "");
    await enviar();
    expect(errorDe("email")).toBe(EMAIL_REQUERIDO);
    expect(dialogo()).toBeNull();
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("errores de identidad junto a cada campo, sin envío parcial", async () => {
    await escribir("dni", "12");
    await enviar();
    expect(errorDe("nombre")).toBe("Ingresá el nombre");
    expect(errorDe("dni")).toBe("El DNI debe tener entre 7 y 8 dígitos");
    expect(errorDe("fechaNacimiento")).toBe("Ingresá la fecha de nacimiento");
    expect(m.crear).not.toHaveBeenCalled();
  });

  it("confirma siempre (DEC-15) y, al registrar, navega a la ficha con el banner del alta", async () => {
    await completarAlta();
    await enviar();
    expect(contenedor.querySelector("[data-titulo]")?.textContent).toBe(
      "¿Estás seguro de que querés registrar a Lucía Fernández como mesa de entrada?",
    );
    expect(contenedor.querySelector("[data-detalle]")?.textContent).toContain("lucia@mail.com");
    expect(contenedor.querySelector("[data-confirmar]")?.textContent).toBe("Registrar integrante");
    expect(m.crear).not.toHaveBeenCalled();

    await confirmar();
    expect(m.crear).toHaveBeenCalledWith({
      nombre: "Lucía",
      apellido: "Fernández",
      dni: "30123456",
      fechaNacimiento: "1990-04-12",
      genero: undefined,
      email: "Lucia@Mail.com",
      telefono: "",
    });
    expect(m.setDirty).toHaveBeenLastCalledWith(false);
    expect(m.push).toHaveBeenCalledWith(`/personal/${ID}?creado=1`);
  });

  it.each([
    ["DNI_DUPLICADO", DNI_DUPLICADO, "dni"],
    ["EMAIL_YA_ASOCIADO", EMAIL_EN_USO, "email"],
  ])("%s del servidor: el diálogo se cierra y el error va junto al campo", async (code, message, nombre) => {
    m.crear.mockResolvedValue({ data: null, error: { code, message } });
    await completarAlta();
    await enviar();
    await confirmar();
    expect(dialogo()).toBeNull();
    expect(errorDe(nombre)).toBe(message);
    expect(m.push).not.toHaveBeenCalled();
  });

  it("otro rechazo (sin permiso, transacción ocupada) se muestra dentro del diálogo", async () => {
    m.crear.mockResolvedValue({ data: null, error: { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" } });
    await completarAlta();
    await enviar();
    await confirmar();
    expect(m.errorDialogo.actual).toBe("No tenés permisos para acceder a esta sección");
  });

  it("una falla de conexión se informa en el diálogo", async () => {
    m.crear.mockRejectedValue(new Error("fetch failed"));
    await completarAlta();
    await enviar();
    await confirmar();
    expect(m.errorDialogo.actual).toBe("No se pudo conectar. Intentá nuevamente");
  });

  it("al salir del DNI y del email verifica la disponibilidad; el aviso del email no dice de quién es", async () => {
    m.disponibilidad.mockResolvedValue({ data: { dni_disponible: false, email_disponible: false }, error: null });
    await escribir("dni", "30123456");
    await salirDe("dni");
    expect(m.disponibilidad).toHaveBeenLastCalledWith({ dni: "30123456" });
    expect(errorDe("dni")).toBe(DNI_DUPLICADO);

    await escribir("email", "ocupado@mail.com");
    await salirDe("email");
    expect(m.disponibilidad).toHaveBeenLastCalledWith({ email: "ocupado@mail.com" });
    expect(errorDe("email")).toBe(EMAIL_EN_USO);

    // Corregir el valor quita el aviso.
    await escribir("dni", "30123457");
    expect(errorDe("dni")).toBeUndefined();
  });

  it("con el DNI marcado como no disponible no abre la confirmación", async () => {
    m.disponibilidad.mockResolvedValue({ data: { dni_disponible: false, email_disponible: true }, error: null });
    await completarAlta();
    await salirDe("dni");
    await enviar();
    expect(dialogo()).toBeNull();
    expect(errorDe("dni")).toBe(DNI_DUPLICADO);
  });

  it("«Cancelar» sin datos vuelve al listado; con datos pide confirmar el descarte", async () => {
    await act(async () => botonCancelar().click());
    expect(m.push).toHaveBeenCalledWith("/personal");

    m.push.mockClear();
    await escribir("nombre", "Lu");
    expect(m.setDirty).toHaveBeenLastCalledWith(true);
    await act(async () => botonCancelar().click());
    expect(m.push).not.toHaveBeenCalled();
    await act(async () => contenedor.querySelector<HTMLButtonElement>("[data-descartar]")!.click());
    expect(m.setDirty).toHaveBeenLastCalledWith(false);
    expect(m.push).toHaveBeenCalledWith("/personal");
  });
});

describe("modo edición", () => {
  beforeEach(() => montar(true));

  it("precarga la ficha y «Guardar» está deshabilitado sin cambios", () => {
    expect(contenedor.querySelector("h1")?.textContent).toBe("Lucía Fernández");
    expect(campo("dni").value).toBe("30123456");
    expect(campo("email").value).toBe("lucia@mail.com");
    expect(botonGuardar().textContent).toBe("Guardar");
    expect(botonGuardar().disabled).toBe(true);
  });

  it("volver al valor guardado (con otro formato) cuenta como sin cambios", async () => {
    await escribir("telefono", "(011) 4555-1234");
    expect(botonGuardar().disabled).toBe(true);
    await escribir("nombre", " Lucía ");
    expect(botonGuardar().disabled).toBe(true);
  });

  it("confirma siempre y manda solo lo que cambió, con version; vuelve a la ficha con el banner", async () => {
    await escribir("telefono", "");
    expect(botonGuardar().disabled).toBe(false);
    await enviar();
    expect(contenedor.querySelector("[data-titulo]")?.textContent).toBe("¿Estás seguro de que querés guardar los cambios de Lucía Fernández?");
    expect(contenedor.querySelector("[data-detalle]")?.textContent).toBe("");
    expect(contenedor.querySelector("[data-confirmar]")?.textContent).toBe("Guardar cambios");

    await confirmar();
    expect(m.modificar).toHaveBeenCalledWith(ID, { version: 2, telefono: null });
    expect(m.replace).toHaveBeenCalledWith(`/personal/${ID}?actualizada=1`);
  });

  it("si cambia el email, la confirmación avisa que cambia el usuario de ingreso", async () => {
    await escribir("email", "nuevo@mail.com");
    await enviar();
    expect(contenedor.querySelector("[data-detalle]")?.textContent).toBe(
      "Cambiar el email también cambia el usuario con el que esta persona ingresa. Va a ingresar con el email nuevo la próxima vez.",
    );
  });

  it("el email no se puede vaciar", async () => {
    await escribir("email", "");
    await enviar();
    expect(errorDe("email")).toBe(EMAIL_REQUERIDO);
    expect(dialogo()).toBeNull();
  });

  it("conflicto de versión: el mensaje con «Recargar», que vuelve a pedir los datos", async () => {
    m.modificar.mockResolvedValue({
      data: null,
      error: { code: "CONFLICTO_EDICION_CONCURRENTE", message: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." },
    });
    await escribir("nombre", "Ana");
    await enviar();
    await confirmar();
    expect(dialogo()).toBeNull();
    const alerta = contenedor.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain("La ficha fue modificada por otro usuario.");
    await act(async () => [...alerta.querySelectorAll("button")].find((b) => b.textContent === "Recargar")!.click());
    expect(m.refresh).toHaveBeenCalled();
  });

  it("la verificación al salir del campo excluye la propia ficha y no consulta un valor sin cambios", async () => {
    await salirDe("dni");
    expect(m.disponibilidad).not.toHaveBeenCalled();
    await escribir("dni", "40111222");
    await salirDe("dni");
    expect(m.disponibilidad).toHaveBeenCalledWith({ dni: "40111222", excluirId: ID });
  });

  it("«Cancelar» sin cambios vuelve a la ficha; con cambios pide confirmar el descarte", async () => {
    await act(async () => botonCancelar().click());
    expect(m.push).toHaveBeenCalledWith(`/personal/${ID}`);
    m.push.mockClear();
    await escribir("apellido", "Gómez");
    await act(async () => botonCancelar().click());
    expect(m.push).not.toHaveBeenCalled();
    expect(contenedor.querySelector("[data-descartar]")).not.toBeNull();
  });
});
