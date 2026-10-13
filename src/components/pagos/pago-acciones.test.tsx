// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, exito } = vi.hoisted(() => ({ fetchMock: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetchMock }));
vi.mock("sonner", () => ({ toast: { success: exito } }));

const { PagoAcciones } = await import("./pago-acciones");

const PAGO = {
  id: "pago-1", monto: "12000.00", forma_pago: { id: "formapago-efectivo", nombre: "Efectivo", is_active: true },
  fecha_pago: "2026-10-08", anulado: false, puede_corregir: true, clases_de_la_operacion: 3,
};
const FORMAS = [{ id: "formapago-efectivo", nombre: "Efectivo" }, { id: "formapago-transferencia", nombre: "Transferencia" }];
const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 400, status, json: async () => cuerpo });
const actualizar = vi.fn();
let root: Root;
let container: HTMLDivElement;

const boton = (scope: ParentNode, nombre: string) => [...scope.querySelectorAll("button")].find((b) => b.textContent === nombre) as HTMLButtonElement | undefined;
const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const alerta = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const cambiar = async (selector: string, valor: string) => {
  const campo = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)!;
  const prototipo = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : campo instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototipo, "value")!.set!.call(campo, valor);
  await act(async () => { campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
};
const enviarFormulario = () => act(async () => {
  dialogo()!.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});
const click = (elemento: HTMLElement | undefined) => act(async () => { elemento!.click(); });
const render = (pago = PAGO) => act(async () => root.render(
  <PagoAcciones pago={pago} alumnoNombre="Sofía Acosta" claseEtiqueta="Física I del Jue 08/10" onActualizado={actualizar} />,
));
/** Pedidos POST hechos al servidor, con su cuerpo. */
const posts = () => fetchMock.mock.calls
  .filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
  .map(([url, init]) => [url, JSON.parse(String((init as RequestInit).body))]);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/formas-pago/opciones") return respuesta(200, { data: FORMAS, error: null });
    if (init?.method === "POST") return respuesta(200, { data: {}, error: null });
    throw new Error(`fetch inesperado ${url}`);
  });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("PagoAcciones (HU-I-06)", () => {
  it("Corregir y Anular solo con puede_corregir; Ver detalle siempre", async () => {
    await render();
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Corregir", "Anular", "Ver detalle"]);
    await render({ ...PAGO, puede_corregir: false });
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Ver detalle"]);
    await render({ ...PAGO, anulado: true, puede_corregir: false });
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Ver detalle"]);
  });

  it("Corregir: formulario precargado con los vigentes; sin cambios, error de cliente sin llamar al servidor", async () => {
    await render();
    await click(boton(container, "Corregir"));
    expect(dialogo()!.textContent).toContain("Corregir pago");
    expect(dialogo()!.textContent).toContain("Sofía Acosta · Física I del Jue 08/10");
    expect(document.querySelector<HTMLInputElement>("#pago-pago-1-monto")!.value).toBe("12000");
    expect(document.querySelector<HTMLInputElement>("#pago-pago-1-fecha")!.value).toBe("2026-10-08");
    expect(document.querySelector<HTMLSelectElement>("#pago-pago-1-forma")!.value).toBe("formapago-efectivo");
    await cambiar("#pago-pago-1-motivo", "Nada");
    await enviarFormulario();
    expect(dialogo()!.textContent).toContain("No cambiaste ningún dato del pago.");
    expect(posts()).toEqual([]);
    expect(alerta()).toBeNull();
  });

  it("Corregir: exige el motivo antes de confirmar", async () => {
    await render();
    await click(boton(container, "Corregir"));
    await cambiar("#pago-pago-1-monto", "10000");
    await enviarFormulario();
    expect(dialogo()!.textContent).toContain("Ingresá el motivo.");
    expect(alerta()).toBeNull();
  });

  it("Corregir: avisa a cuántas clases alcanza al cambiar la forma, envía solo lo que cambió y confirma de forma reversible", async () => {
    await render();
    await click(boton(container, "Corregir"));
    expect(dialogo()!.textContent).not.toContain("alcanza a");
    await cambiar("#pago-pago-1-forma", "formapago-transferencia");
    expect(dialogo()!.textContent).toContain("Este cambio alcanza a 3 clases de esta operación.");
    await cambiar("#pago-pago-1-monto", "11000");
    await cambiar("#pago-pago-1-motivo", "Se cargó mal");
    await enviarFormulario();

    const confirmacion = alerta()!;
    expect(confirmacion.textContent).toContain("¿Estás seguro de que querés corregir este pago?");
    expect(confirmacion.textContent).toContain("Monto: $ 12.000 → $ 11.000");
    expect(confirmacion.textContent).toContain("Forma de pago: Efectivo → Transferencia");
    expect(confirmacion.textContent).not.toContain("Esta acción no se puede deshacer.");
    await click(boton(confirmacion, "Corregir pago"));

    expect(posts()).toEqual([["/api/pagos/pago-1/correccion", { monto: "11000", forma_pago_id: "formapago-transferencia", motivo: "Se cargó mal" }]]);
    expect(exito).toHaveBeenCalledExactlyOnceWith("Pago corregido correctamente");
    expect(actualizar).toHaveBeenCalledOnce();
    expect(alerta()).toBeNull();
    expect(dialogo()).toBeNull();
  });

  it("la forma vigente inactiva se conserva con la etiqueta «Inactiva» y no se envía si no se cambia", async () => {
    await render({ ...PAGO, forma_pago: { id: "formapago-vieja", nombre: "Cheque", is_active: false }, clases_de_la_operacion: 1 });
    await click(boton(container, "Corregir"));
    const forma = document.querySelector<HTMLSelectElement>("#pago-pago-1-forma")!;
    expect(forma.value).toBe("formapago-vieja");
    expect([...forma.options].map((o) => o.textContent)).toEqual(["Cheque (Inactiva)", "Efectivo", "Transferencia"]);
    await cambiar("#pago-pago-1-fecha", "2026-10-07");
    expect(dialogo()!.textContent).toContain("Este cambio alcanza a 1 clase de esta operación.");
    await cambiar("#pago-pago-1-motivo", "Fecha");
    await enviarFormulario();
    await click(boton(alerta()!, "Corregir pago"));
    expect(posts()).toEqual([["/api/pagos/pago-1/correccion", { fecha_pago: "2026-10-07", motivo: "Fecha" }]]);
  });

  it("un rechazo del servidor queda dentro de la confirmación, sin cerrarla ni recargar", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/formas-pago/opciones") return respuesta(200, { data: FORMAS, error: null });
      if (init?.method === "POST") return respuesta(403, { data: null, error: { code: "FUERA_DE_ALCANCE", message: "No podés corregir este pago." } });
      throw new Error(url);
    });
    await render();
    await click(boton(container, "Corregir"));
    await cambiar("#pago-pago-1-monto", "10000");
    await cambiar("#pago-pago-1-motivo", "x");
    await enviarFormulario();
    await click(boton(alerta()!, "Corregir pago"));
    expect(alerta()!.textContent).toContain("No podés corregir este pago.");
    expect(alerta()!.textContent).not.toContain("Caja abierta donde registrar el ajuste");
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("Anular: una sola confirmación irreversible con el motivo adentro; «Usar el motivo Reintegro» lo precarga sin enviar", async () => {
    await render();
    await click(boton(container, "Anular"));
    expect(dialogo()).toBeNull();
    const confirmacion = alerta()!;
    expect(confirmacion.textContent).toContain("¿Estás seguro de que querés anular el pago de $ 12.000 de Sofía Acosta (Física I del Jue 08/10)?");
    expect(confirmacion.textContent).toContain("El pago no se borra: queda «Anulado» y deja de sumar.");
    expect(confirmacion.textContent).toContain("Esta acción no se puede deshacer.");
    expect(boton(confirmacion, "Anular pago")!.disabled).toBe(true);

    await click(boton(confirmacion, "Usar el motivo «Reintegro»"));
    expect(document.querySelector<HTMLTextAreaElement>("#pago-pago-1-motivo")!.value).toBe("Reintegro");
    expect(confirmacion.textContent).toContain("9 / 300");
    expect(posts()).toEqual([]);

    await cambiar("#pago-pago-1-motivo", "Reintegro por cancelación");
    await click(boton(confirmacion, "Anular pago"));
    expect(posts()).toEqual([["/api/pagos/pago-1/anulacion", { motivo: "Reintegro por cancelación" }]]);
    expect(exito).toHaveBeenCalledExactlyOnceWith("Pago anulado");
    expect(actualizar).toHaveBeenCalledOnce();
  });

  it("CAJA_DE_AJUSTE_NO_ABIERTA: muestra el selector de cajas abiertas y reintenta el mismo pedido con caja_ajuste_id", async () => {
    let intentos = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/cajas") return respuesta(200, { data: { abiertas: [{ id: "caja-x", integrante: { id: "u", nombre_completo: "Ruiz, Marta" }, abierta_el: "", antiguedad_minutos: 30 }], cierres: { items: [], paginacion: {} } }, error: null });
      if (init?.method === "POST") {
        intentos += 1;
        return intentos === 1
          ? respuesta(409, { data: null, error: { code: "CAJA_DE_AJUSTE_NO_ABIERTA", message: "Para registrar este cambio tiene que haber una caja abierta en mesa de entrada." } })
          : respuesta(200, { data: {}, error: null });
      }
      throw new Error(url);
    });
    await render();
    await click(boton(container, "Anular"));
    await cambiar("#pago-pago-1-motivo", "Duplicado");
    await click(boton(alerta()!, "Anular pago"));
    expect(alerta()!.textContent).toContain("Para registrar este cambio tiene que haber una caja abierta en mesa de entrada.");
    expect(alerta()!.textContent).toContain("Ruiz, Marta · abierta hace");
    const reintentar = boton(alerta()!, "Reintentar con esta caja")!;
    expect(reintentar.disabled).toBe(true);
    await cambiar(`#${CSS.escape(alerta()!.querySelector("select")!.id)}`, "caja-x");
    await click(boton(alerta()!, "Reintentar con esta caja"));

    expect(posts()).toEqual([
      ["/api/pagos/pago-1/anulacion", { motivo: "Duplicado" }],
      ["/api/pagos/pago-1/anulacion", { motivo: "Duplicado", caja_ajuste_id: "caja-x" }],
    ]);
    expect(exito).toHaveBeenCalledExactlyOnceWith("Pago anulado");
    expect(actualizar).toHaveBeenCalledOnce();
    expect(alerta()).toBeNull();
  });

  it("Ver detalle abre el historial de cambios del pago", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/pagos/pago-1/historial") return respuesta(200, { data: { registro: { monto: "12000.00", forma_pago: { id: "f", nombre: "Efectivo" }, fecha_pago: "2026-10-08", registrado_por: { usuario_id: "u", nombre_completo: "Ruiz, Marta" }, registrado_en: "2026-10-08T10:00:00-03:00" }, cambios: [] }, error: null });
      throw new Error(url);
    });
    await render({ ...PAGO, puede_corregir: false });
    await click(boton(container, "Ver detalle"));
    expect(dialogo()!.textContent).toContain("Detalle del pago");
    expect(dialogo()!.textContent).toContain("Este pago no tiene correcciones ni anulaciones.");
  });
});
