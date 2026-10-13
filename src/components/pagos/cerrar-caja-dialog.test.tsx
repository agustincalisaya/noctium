// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumenCajaDto } from "@/types/caja.types";

// «Cerrar caja» en dos pasos (HU-I-12 criterios 5 a 8; fotos `Cerrar caja ·
// paso 1/2.png` y `Cierre con un cobro que entró mientras tanto.png`). El
// fetch está simulado.

const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetch }));

import { CerrarCajaDialog, type ModoCierreCaja } from "./cerrar-caja-dialog";

const resumen = (esperado: string, declarado: string, diferencia: string, tipo: ResumenCajaDto["tipo_diferencia"]): ResumenCajaDto => ({
  fondo_inicial: "5000.00",
  cobros_por_forma: [
    { forma_pago: { id: "f1", nombre: "Efectivo", es_efectivo: true }, cantidad: 1, total: "12000.00" },
    { forma_pago: { id: "f2", nombre: "Transferencia", es_efectivo: false }, cantidad: 3, total: "42000.00" },
  ],
  ingresos_manuales: "0.00", egresos_manuales: "0.00", ajustes: [],
  efectivo_esperado: esperado, efectivo_declarado: declarado, diferencia, tipo_diferencia: tipo,
});
const paso2 = (r: ResumenCajaDto, huella: string) => ({ caja_id: "c1", abierta_el: "2026-10-06T19:18:00-03:00", integrante: { id: "u1", nombre_completo: "Ferreyra, Julián" }, resumen: r, huella });
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data, error: null }) });
const falla = (status: number, error: object) => ({ ok: false, status, json: async () => ({ data: null, error }) });

let root: Root, container: HTMLDivElement;
const onCerrar = vi.fn();
const onCerrada = vi.fn();

const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const confirmacion = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
const boton = (nombre: string, dentro: ParentNode | null = document) =>
  [...(dentro ?? document).querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement | undefined;
const click = (e: HTMLElement) => act(async () => e.click());
async function escribir(elemento: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const prototipo = elemento instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototipo, "value")!.set!.call(elemento, valor);
    elemento.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const montar = (props: { modo?: ModoCierreCaja; efectivoDeclarado?: string | null } = {}) => act(async () => root.render(
  <CerrarCajaDialog abierto modo={props.modo ?? { tipo: "propia" }} efectivoDeclarado={props.efectivoDeclarado ?? null}
    onCerrar={onCerrar} onCerrada={onCerrada} />,
));
const llamadas = () => m.fetch.mock.calls.map(([url, init]) => [url, init?.method ?? "GET", init?.body ? JSON.parse(init.body) : undefined]);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("paso 1: declarar el efectivo contado", () => {
  it("no muestra ningún total y no deja pasar al paso 2 sin un monto válido", async () => {
    await montar();
    expect(dialogo()!.textContent).toContain("Cerrar caja · paso 1 de 2");
    expect(dialogo()!.textContent).not.toContain("Efectivo esperado");
    await click(boton("Confirmar efectivo contado", dialogo())!);
    expect(dialogo()!.querySelector('[role="alert"]')?.textContent).toBe("Ingresá el efectivo contado: un monto igual o mayor a 0, con hasta 2 decimales.");
    await escribir(dialogo()!.querySelector("input")!, "-5");
    await click(boton("Confirmar efectivo contado", dialogo())!);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(dialogo()!.textContent).toContain("paso 1 de 2");
  });

  it("declara (acepta coma decimal) y pasa al paso 2 con el resumen; con diferencia pide el motivo obligatorio", async () => {
    m.fetch.mockResolvedValueOnce(ok(paso2(resumen("17000.00", "16000.50", "-999.50", "FALTANTE"), "h1")));
    await montar();
    await escribir(dialogo()!.querySelector("input")!, "16000,50");
    await click(boton("Confirmar efectivo contado", dialogo())!);
    expect(llamadas()).toEqual([["/api/cajas/mia/declaracion", "POST", { efectivo_declarado: "16000.50" }]]);
    const texto = dialogo()!.textContent!;
    expect(texto).toContain("Cerrar caja · paso 2 de 2");
    expect(texto).toContain("Cobros en Efectivo · 1 pago");
    expect(texto).toContain("Cobros en Transferencia · 3 pagos(no entra en el arqueo)");
    expect(texto).toContain("Efectivo esperado$ 17.000");
    expect(texto).toContain("Faltante de $ 999,50");
    expect(texto).toContain("Motivo de la diferencia");
    await click(boton("Cerrar caja", dialogo())!);
    expect(confirmacion()).toBeNull();
    expect(dialogo()!.textContent).toContain("Ingresá el motivo de la diferencia.");
  });

  it("EFECTIVO_YA_DECLARADO: pasa al paso 2 con el resumen del monto ya guardado", async () => {
    m.fetch
      .mockResolvedValueOnce(falla(409, { code: "EFECTIVO_YA_DECLARADO", message: "Ya declaraste el efectivo" }))
      .mockResolvedValueOnce(ok(paso2(resumen("100.00", "100.00", "0.00", "CUADRA"), "h1")));
    await montar();
    await escribir(dialogo()!.querySelector("input")!, "50");
    await click(boton("Confirmar efectivo contado", dialogo())!);
    expect(llamadas().map(([url]) => url)).toEqual(["/api/cajas/mia/declaracion", "/api/cajas/mia/resumen"]);
    expect(dialogo()!.textContent).toContain("La caja cuadra");
  });
});

describe("paso 2: confirmar el cierre", () => {
  it("con el efectivo ya declarado entra directo al paso 2; si cuadra, la observación es opcional y la confirmación es irreversible", async () => {
    m.fetch
      .mockResolvedValueOnce(ok(paso2(resumen("17000.00", "17000.00", "0.00", "CUADRA"), "h1")))
      .mockResolvedValueOnce(ok({ caja_id: "c1", estado: "CERRADA", cerrada_el: "x", diferencia: "0.00", tipo_diferencia: "CUADRA", por_ausencia: false }));
    await montar({ efectivoDeclarado: "17000.00" });
    expect(llamadas()).toEqual([["/api/cajas/mia/resumen", "GET", undefined]]);
    expect(dialogo()!.textContent).toContain("Observación");
    expect(dialogo()!.textContent).toContain("Opcional");
    await click(boton("Cerrar caja", dialogo())!);
    expect(confirmacion()!.textContent).toContain("¿Estás seguro de que querés cerrar tu caja sin diferencia?");
    expect(confirmacion()!.textContent).toContain("Esta acción no se puede deshacer.");
    await click(boton("Cerrar caja", confirmacion())!);
    expect(llamadas()[1]).toEqual(["/api/cajas/mia/cierre", "POST", { huella: "h1" }]);
    expect(onCerrada).toHaveBeenCalledWith(expect.objectContaining({ tipo_diferencia: "CUADRA" }));
  });

  it("CAJA_CAMBIO: reemplaza resumen y huella, avisa sin cerrar el diálogo y el motivo se vuelve a pedir", async () => {
    m.fetch
      .mockResolvedValueOnce(ok(paso2(resumen("17000.00", "17000.00", "0.00", "CUADRA"), "h1")))
      .mockResolvedValueOnce(falla(409, {
        code: "CAJA_CAMBIO", message: "La caja cambió mientras cerrabas. Revisá el resumen.",
        detalles: { resumen: resumen("19000.00", "17000.00", "-2000.00", "FALTANTE"), huella: "h2" },
      }))
      .mockResolvedValueOnce(ok({ caja_id: "c1", estado: "CERRADA", cerrada_el: "x", diferencia: "-2000.00", tipo_diferencia: "FALTANTE", por_ausencia: false }));
    await montar({ efectivoDeclarado: "17000.00" });
    await click(boton("Cerrar caja", dialogo())!);
    await click(boton("Cerrar caja", confirmacion())!);
    expect(onCerrada).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
    expect(confirmacion()).toBeNull();
    const texto = dialogo()!.textContent!;
    expect(texto).toContain("La caja cambió mientras cerrabas. Revisá el resumen.");
    expect(texto).toContain("Efectivo esperado$ 19.000");
    expect(texto).toContain("Efectivo declarado$ 17.000");
    expect(texto).toContain("Faltante de $ 2.000");
    expect(texto).toContain("Motivo de la diferencia");
    await click(boton("Cerrar caja", dialogo())!);
    expect(confirmacion()).toBeNull();
    await escribir(dialogo()!.querySelector("textarea")!, "  Se dio mal un vuelto ");
    await click(boton("Cerrar caja", dialogo())!);
    expect(confirmacion()!.textContent).toContain("¿Estás seguro de que querés cerrar tu caja con un faltante de $ 2.000?");
    await click(boton("Cerrar caja", confirmacion())!);
    expect(llamadas()[2]).toEqual(["/api/cajas/mia/cierre", "POST", { huella: "h2", motivo: "Se dio mal un vuelto" }]);
    expect(onCerrada).toHaveBeenCalledOnce();
  });

  it("otro rechazo (CAJA_YA_CERRADA) se muestra dentro de la confirmación", async () => {
    m.fetch
      .mockResolvedValueOnce(ok(paso2(resumen("1.00", "1.00", "0.00", "CUADRA"), "h1")))
      .mockResolvedValueOnce(falla(409, { code: "CAJA_YA_CERRADA", message: "La caja ya está cerrada." }));
    await montar({ efectivoDeclarado: "1.00" });
    await click(boton("Cerrar caja", dialogo())!);
    await click(boton("Cerrar caja", confirmacion())!);
    expect(confirmacion()!.querySelector('[role="alert"]')?.textContent).toBe("La caja ya está cerrada.");
    expect(onCerrada).not.toHaveBeenCalled();
  });
});

describe("cierre por ausencia (gerente)", () => {
  it("usa las rutas de ausencia de la caja y nombra al integrante en el título y la confirmación", async () => {
    m.fetch
      .mockResolvedValueOnce(ok(paso2(resumen("500.00", "600.00", "100.00", "SOBRANTE"), "h1")))
      .mockResolvedValueOnce(ok({ caja_id: "c9", estado: "CERRADA", cerrada_el: "x", diferencia: "100.00", tipo_diferencia: "SOBRANTE", por_ausencia: true }));
    await montar({ modo: { tipo: "ausencia", cajaId: "c9", integrante: "Ferreyra, Julián" } });
    expect(dialogo()!.textContent).toContain("Cierre por ausencia de Ferreyra, Julián · paso 1 de 2");
    await escribir(dialogo()!.querySelector("input")!, "600");
    await click(boton("Confirmar efectivo contado", dialogo())!);
    expect(dialogo()!.textContent).toContain("Sobrante de $ 100");
    await escribir(dialogo()!.querySelector("textarea")!, "Dejó el centro");
    await click(boton("Cerrar caja", dialogo())!);
    expect(confirmacion()!.textContent).toContain("¿Estás seguro de que querés cerrar la caja de Ferreyra, Julián con un sobrante de $ 100?");
    await click(boton("Cerrar caja", confirmacion())!);
    expect(llamadas().map(([url]) => url)).toEqual(["/api/cajas/c9/ausencia/declaracion", "/api/cajas/c9/ausencia/cierre"]);
    expect(onCerrada).toHaveBeenCalledWith(expect.objectContaining({ por_ausencia: true }));
  });
});
