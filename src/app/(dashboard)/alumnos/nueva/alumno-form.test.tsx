// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Alta de alumno con contacto opcional: crearAlumno() y, si se cargó
// contacto, actualizarContactoAlumno() encadenada con el id creado. Las
// Server Actions están mockeadas.

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

describe("Nuevo alumno — sección de contacto", () => {
  it("muestra Teléfono y Email opcionales con los mismos placeholders que la pantalla de contacto", () => {
    expect(contenedor.querySelector("legend")?.textContent).toBe("Datos de contacto");
    expect(contenedor.textContent).toContain("Opcional. Podés cargarlos ahora o más tarde desde la ficha.");
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
  it("sin contacto: solo crea el alumno y redirige al listado", async () => {
    crearAlumno.mockResolvedValue(CREADO);
    completar(IDENTIDAD);
    await enviar();

    expect(crearAlumno).toHaveBeenCalledWith({ ...IDENTIDAD, genero: undefined });
    expect(actualizarContactoAlumno).not.toHaveBeenCalled();
    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(push).toHaveBeenCalledWith("/alumnos?creada=1");
  });

  it("con contacto: crea el alumno y después guarda el contacto con el id creado", async () => {
    crearAlumno.mockResolvedValue(CREADO);
    actualizarContactoAlumno.mockResolvedValue({ data: { id: ALUMNO, telefono: "0387154123456", email: "ana@mail.com" }, error: null });
    completar({ ...IDENTIDAD, email: "Ana@Mail.com" });
    await enviar();

    expect(crearAlumno.mock.invocationCallOrder[0]).toBeLessThan(actualizarContactoAlumno.mock.invocationCallOrder[0]);
    const [alumnoId, formData] = actualizarContactoAlumno.mock.calls[0]! as [string, FormData];
    expect(alumnoId).toBe(ALUMNO);
    expect(formData.get("email")).toBe("Ana@Mail.com");
    expect(formData.get("telefono")).toBe("");
    expect(push).toHaveBeenCalledWith("/alumnos?creada=1");
  });

  it("si el alta falla (DNI duplicado) no intenta guardar el contacto ni redirige", async () => {
    crearAlumno.mockResolvedValue({ data: null, error: { code: "DNI_DUPLICADO", message: "Ya existe un alumno registrado con ese DNI" } });
    completar({ ...IDENTIDAD, telefono: "(0387) 15-412-3456" });
    await enviar();

    expect(actualizarContactoAlumno).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain("Ya existe un alumno registrado con ese DNI");
    expect(document.activeElement).toBe(campo("dni"));
  });

  it("si el contacto falla por email de otra cuenta, no revierte el alta: redirige con aviso y motivo", async () => {
    crearAlumno.mockResolvedValue(CREADO);
    actualizarContactoAlumno.mockResolvedValue({ data: null, error: { code: "EMAIL_YA_ASOCIADO", message: "Ese email ya está asociado a otra cuenta" } });
    completar({ ...IDENTIDAD, email: "alumno2@noctium.local" });
    await enviar();

    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(push).toHaveBeenCalledWith(`/alumnos?creada=1&sin_contacto=${ALUMNO}&motivo=email_ya_asociado`);
  });

  it("si el contacto falla por comunicación, redirige con aviso genérico", async () => {
    crearAlumno.mockResolvedValue(CREADO);
    actualizarContactoAlumno.mockRejectedValue(new Error("fetch failed"));
    completar({ ...IDENTIDAD, telefono: "(0387) 15-412-3456" });
    await enviar();

    expect(push).toHaveBeenCalledWith(`/alumnos?creada=1&sin_contacto=${ALUMNO}`);
  });
});
