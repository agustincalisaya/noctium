// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-I-03: tabla de formas de pago y alta en modal. El fetch autenticado, el
// router y el toast están mockeados.

const { fetchAutenticado, refresh, exito, fallo } = vi.hoisted(() => ({
  fetchAutenticado: vi.fn(),
  refresh: vi.fn(),
  exito: vi.fn(),
  fallo: vi.fn(),
}));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: exito, error: fallo } }));

const { FormasPagoInteractivas } = await import("./formas-pago-interactivas");

const LISTADO = {
  items: [
    { id: "fp1", nombre: "Efectivo", is_active: true },
    { id: "fp2", nombre: "Cheque", is_active: false },
  ],
  paginacion: { total: 2, pagina_actual: 1, total_paginas: 1, por_pagina: 20 },
};
const VACIO = {
  items: [],
  paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 20 },
};
const MENSAJE_DUPLICADO = "Ya existe una forma de pago con ese nombre.";
const MENSAJE_VACIO = "Ingresá el nombre de la forma de pago.";

const respuesta = (status: number, cuerpo: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => cuerpo }) as Response;

let contenedor: HTMLDivElement;
let root: Root;

async function montar(listado = LISTADO) {
  await act(async () => {
    root.render(<FormasPagoInteractivas {...listado} />);
  });
}

const boton = (texto: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === texto) as HTMLButtonElement | undefined;
const input = () => document.querySelector<HTMLInputElement>("#nombre-forma-pago");
const alerta = () => document.querySelector('[role="alert"]');

async function abrirModal() {
  await act(async () => {
    boton("Nueva forma de pago")!.click();
  });
}

async function escribir(valor: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input()!, valor);
    input()!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function registrar() {
  await act(async () => {
    boton("Registrar forma de pago")!.click();
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe("listado", () => {
  it("muestra los textos literales, las columnas y una etiqueta por estado", async () => {
    await montar();

    expect(contenedor.querySelector("h1")?.textContent).toBe("Formas de pago");
    expect(contenedor.textContent).toContain(
      "Catálogo que mesa de entrada usa al registrar pagos y al asociar la forma de pago preferida del alumno. Es solo un nombre: no conecta con ninguna pasarela de pago.",
    );
    expect([...contenedor.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Nombre", "Estado", "Acciones"]);
    const filas = [...contenedor.querySelectorAll("tbody tr")].map((fila) =>
      [...fila.querySelectorAll("td")].map((celda) => celda.textContent),
    );
    expect(filas).toEqual([
      ["Efectivo", "Activa", "EditarDesactivar"],
      ["Cheque", "Inactiva", "EditarReactivar"],
    ]);
  });

  it("ofrece editar y la acción de estado correspondiente sin Preferida por", async () => {
    await montar();

    expect(contenedor.querySelectorAll("tbody button")).toHaveLength(4);
    expect(boton("Editar")).toBeTruthy();
    expect(boton("Desactivar")).toBeTruthy();
    expect(boton("Reactivar")).toBeTruthy();
    expect(contenedor.textContent).not.toContain("Preferida por");
  });

  it("sin formas de pago muestra la tabla solo con encabezados y sin texto de estado vacío", async () => {
    await montar(VACIO);

    expect(contenedor.querySelectorAll("th")).toHaveLength(3);
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(0);
    expect(contenedor.textContent).not.toContain("No hay formas de pago registradas");
  });

  it("no muestra el paginador con una sola página", async () => {
    await montar();

    expect(contenedor.querySelector('nav[aria-label="Paginación"]')).toBeNull();
  });

  it("muestra el paginador con varias páginas, con enlaces a /formas-pago?pagina=N", async () => {
    await montar({ ...LISTADO, paginacion: { total: 45, pagina_actual: 2, total_paginas: 3, por_pagina: 20 } });

    const enlaces = [...contenedor.querySelectorAll('nav[aria-label="Paginación"] a')].map((a) => a.getAttribute("href"));
    expect(enlaces).toEqual(["/formas-pago?pagina=1", "/formas-pago?pagina=3"]);
  });
});

describe("modal Nueva forma de pago", () => {
  it("abre con título, texto de apoyo, un solo campo Nombre y los dos botones", async () => {
    await montar();
    expect(input()).toBeNull();

    await abrirModal();

    expect(document.body.textContent).toContain("Es solo un nombre en el catálogo: no se piden ni guardan datos financieros.");
    expect(document.querySelectorAll("#nombre-forma-pago")).toHaveLength(1);
    expect(document.querySelectorAll("input")).toHaveLength(1);
    expect(input()!.placeholder).toBe("Ej.: Tarjeta de débito");
    expect(input()!.maxLength).toBe(40);
    expect(document.querySelector("label[for='nombre-forma-pago']")?.textContent).toBe("Nombre");
    expect(boton("Cancelar")).toBeDefined();
    expect(boton("Registrar forma de pago")).toBeDefined();
    expect(alerta()).toBeNull();
  });

  it("enfoca el campo Nombre al abrir", async () => {
    await montar();
    await abrirModal();
    // Base UI mueve el foco después de montar el popup.
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 50));
    });

    expect(document.activeElement).toBe(input());
  });

  it("Cancelar cierra el modal sin llamar al servidor", async () => {
    await montar();
    await abrirModal();

    await act(async () => {
      boton("Cancelar")!.click();
    });

    expect(input()).toBeNull();
    expect(fetchAutenticado).not.toHaveBeenCalled();
  });

  it("éxito: envía el nombre, cierra el modal, avisa con el toast literal y refresca el listado", async () => {
    fetchAutenticado.mockResolvedValue(
      respuesta(201, { data: { id: "fp3", nombre: "Mercado Pago", is_active: true }, error: null }),
    );
    await montar();
    await abrirModal();
    await escribir("Mercado Pago");

    await registrar();

    expect(fetchAutenticado).toHaveBeenCalledExactlyOnceWith(
      "/api/formas-pago",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ nombre: "Mercado Pago" }) }),
    );
    expect(exito).toHaveBeenCalledExactlyOnceWith("Forma de pago registrada correctamente");
    expect(refresh).toHaveBeenCalledOnce();
    expect(input()).toBeNull();
    expect(fallo).not.toHaveBeenCalled();
  });

  it("campo vacío (400): un solo aviso con el mensaje del campo, el modal sigue abierto y el input queda inválido", async () => {
    fetchAutenticado.mockResolvedValue(
      respuesta(400, {
        data: null,
        error: {
          code: "VALIDACION",
          message: "Datos inválidos",
          detalles: { formErrors: [], fieldErrors: { nombre: [MENSAJE_VACIO] } },
        },
      }),
    );
    await montar();
    await abrirModal();

    await registrar();

    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(alerta()?.textContent).toBe(MENSAJE_VACIO);
    expect(input()!.getAttribute("aria-invalid")).toBe("true");
    expect(exito).not.toHaveBeenCalled();
    expect(fallo).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("nombre repetido (409): muestra el mensaje en el aviso del modal sin cerrarlo ni usar toast", async () => {
    fetchAutenticado.mockResolvedValue(
      respuesta(409, { data: null, error: { code: "NOMBRE_DUPLICADO", message: MENSAJE_DUPLICADO } }),
    );
    await montar();
    await abrirModal();
    await escribir("efectivo");

    await registrar();

    expect(alerta()?.textContent).toBe(MENSAJE_DUPLICADO);
    expect(input()!.value).toBe("efectivo");
    expect(exito).not.toHaveBeenCalled();
    expect(fallo).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("el aviso se limpia al reenviar", async () => {
    fetchAutenticado
      .mockResolvedValueOnce(respuesta(409, { data: null, error: { code: "NOMBRE_DUPLICADO", message: MENSAJE_DUPLICADO } }))
      .mockResolvedValueOnce(respuesta(201, { data: { id: "fp3", nombre: "Otra", is_active: true }, error: null }));
    await montar();
    await abrirModal();
    await escribir("Efectivo");
    await registrar();
    expect(alerta()).not.toBeNull();

    await escribir("Otra");
    await registrar();

    expect(alerta()).toBeNull();
    expect(exito).toHaveBeenCalledOnce();
  });

  it("error de servidor (500): toast de error y sin aviso dentro del modal", async () => {
    fetchAutenticado.mockResolvedValue(
      respuesta(500, { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } }),
    );
    await montar();
    await abrirModal();
    await escribir("Efectivo");

    await registrar();

    expect(fallo).toHaveBeenCalledExactlyOnceWith("No se pudo conectar. Intentá nuevamente");
    expect(alerta()).toBeNull();
    expect(exito).not.toHaveBeenCalled();
  });

  it("error de red: toast de error y el botón se rehabilita", async () => {
    fetchAutenticado.mockRejectedValue(new TypeError("Failed to fetch"));
    await montar();
    await abrirModal();
    await escribir("Efectivo");

    await registrar();

    expect(fallo).toHaveBeenCalledExactlyOnceWith("No se pudo conectar. Intentá nuevamente");
    expect(boton("Registrar forma de pago")!.disabled).toBe(false);
  });

  it("deshabilita el envío mientras la petición está en curso", async () => {
    let resolver!: (valor: Response) => void;
    fetchAutenticado.mockReturnValue(new Promise<Response>((resolve) => (resolver = resolve)));
    await montar();
    await abrirModal();
    await escribir("Efectivo");

    await registrar();

    expect(boton("Registrar forma de pago")!.disabled).toBe(true);
    await registrar();
    expect(fetchAutenticado).toHaveBeenCalledOnce();

    await act(async () => {
      resolver(respuesta(201, { data: { id: "fp3", nombre: "Efectivo", is_active: true }, error: null }));
    });
    expect(exito).toHaveBeenCalledOnce();
  });
});

const accionFila = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
async function cambiarCampo(selector: string, valor: string, area = false) {
  await act(async () => {
    const campo = document.querySelector(selector)!;
    const prototipo = area ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototipo, "value")!.set!.call(campo, valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(nombre: string) { await act(async () => { boton(nombre)!.click(); }); }
describe("I-07 edición y estados", () => {
  it("nombre precargado, guardar sin cambios deshabilitado y cancelar descarta", async () => {
    await montar(); await act(async () => accionFila("Editar Efectivo").click());
    expect(document.querySelector<HTMLInputElement>("#nombre-fp1")?.value).toBe("Efectivo");
    expect(boton("Guardar")?.disabled).toBe(true);
    await cambiarCampo("#nombre-fp1", "Efectivo nuevo"); expect(boton("Guardar")?.disabled).toBe(false);
    await click("Cancelar"); expect(fetchAutenticado).not.toHaveBeenCalled();
    await act(async () => accionFila("Editar Efectivo").click());
    expect(document.querySelector<HTMLInputElement>("#nombre-fp1")?.value).toBe("Efectivo");
  });
  it("confirmación de editar mantiene error y nombre; Volver conserva formulario y éxito refresca", async () => {
    await montar(); await act(async () => accionFila("Editar Efectivo").click());
    await cambiarCampo("#nombre-fp1", "Nuevo nombre"); await click("Guardar");
    expect(document.body.textContent).toContain("¿Estás seguro de que querés modificar la forma de pago Efectivo?");
    await click("Volver"); expect(document.querySelector<HTMLInputElement>("#nombre-fp1")?.value).toBe("Nuevo nombre");
    await click("Guardar");
    fetchAutenticado.mockResolvedValueOnce(respuesta(409, { error: { message: MENSAJE_DUPLICADO } }));
    await click("Guardar"); expect(alerta()?.textContent).toContain(MENSAJE_DUPLICADO);
    fetchAutenticado.mockResolvedValueOnce(respuesta(200, { data: { id: "fp1", nombre: "Nuevo nombre", is_active: true }, error: null }));
    await click("Guardar");
    expect(fetchAutenticado).toHaveBeenLastCalledWith("/api/formas-pago/fp1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ nombre: "Nuevo nombre" }) }));
    expect(exito).toHaveBeenCalledWith("Forma de pago actualizada correctamente"); expect(refresh).toHaveBeenCalledOnce();
  });
  it("desactivar incluye impacto/motivo obligatorio, contador, rojo reversible y éxito", async () => {
    fetchAutenticado.mockResolvedValueOnce(respuesta(200, { alumnos_con_preferida: 6, tiene_pagos: true, es_ultima_activa: false }));
    await montar(); await act(async () => accionFila("Desactivar Efectivo").click());
    expect(document.body.textContent).toContain("6 alumnos la tienen como forma de pago preferida");
    expect(document.body.textContent).not.toContain("Esta acción no se puede deshacer");
    const confirmar = document.querySelector<HTMLButtonElement>('[role="alertdialog"] button:last-child')!;
    expect(confirmar.disabled).toBe(true); expect(confirmar.className).toContain("bg-destructive");
    expect(document.querySelector<HTMLTextAreaElement>("#motivo-fp1")?.required).toBe(true);
    await cambiarCampo("#motivo-fp1", "No se acepta", true); expect(confirmar.disabled).toBe(false);
    expect(document.body.textContent).toContain("12 / 300");
    fetchAutenticado.mockResolvedValueOnce(respuesta(200, { id: "fp1", nombre: "Efectivo", is_active: false }));
    await act(async () => confirmar.click());
    expect(fetchAutenticado).toHaveBeenLastCalledWith("/api/formas-pago/fp1/desactivacion", expect.objectContaining({ method: "POST", body: JSON.stringify({ motivo: "No se acepta" }) }));
    expect(exito).toHaveBeenCalledWith("Forma de pago desactivada");
  });
  it("impacto fallido permite reintentar; última activa bloquea la baja", async () => {
    fetchAutenticado.mockRejectedValueOnce(new Error("Sin conexión"));
    await montar(); await act(async () => accionFila("Desactivar Efectivo").click());
    expect(alerta()?.textContent).toContain("No se pudo conectar. Intentá nuevamente");
    fetchAutenticado.mockResolvedValueOnce(respuesta(200, { alumnos_con_preferida: 0, tiene_pagos: false, es_ultima_activa: true }));
    await click("Reintentar"); expect(document.body.textContent).toContain("Debe quedar al menos una forma de pago activa");
    expect(document.querySelector<HTMLButtonElement>('[role="alertdialog"] button:last-child')?.disabled).toBe(true);
  });
  it("reactivar solicita confirmación, no envía body y usa éxito literal", async () => {
    await montar(); await act(async () => accionFila("Reactivar Cheque").click());
    fetchAutenticado.mockResolvedValueOnce(respuesta(200, { id: "fp2", nombre: "Cheque", is_active: true }));
    const confirmar = document.querySelector<HTMLButtonElement>('[role="alertdialog"] button:last-child')!;
    await act(async () => confirmar.click());
    expect(fetchAutenticado).toHaveBeenCalledWith("/api/formas-pago/fp2/reactivacion", { method: "POST" });
    expect(exito).toHaveBeenCalledWith("Forma de pago reactivada");
  });
});
