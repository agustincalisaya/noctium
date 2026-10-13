// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CajaPropiaDto } from "@/types/caja.types";

// «Mi caja» con movimientos manuales (HU-I-12-b; foto `Caja abierta (arqueo
// ciego).png`): «Registrar movimiento» y «Anular» solo en movimientos no
// anulados de la caja propia; un anulado se ve «Anulado» y sin la acción.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: vi.fn(), fetchOLanzar: vi.fn() }));

import { MiCaja } from "./mi-caja";

let root: Root, container: HTMLDivElement;
const CAJA: CajaPropiaDto = {
  id: "c1", abierta_el: "2026-10-12T09:00:00-03:00", fondo_inicial: "5000.00", efectivo_declarado: null,
  items: [
    { tipo: "MOVIMIENTO", id: "mov2", momento: "2026-10-12T11:00:00-03:00", detalle: "Retiro para comprar insumos", movimiento: "EGRESO", monto: "1000.00", anulado: false },
    { tipo: "MOVIMIENTO", id: "mov1", momento: "2026-10-12T10:30:00-03:00", detalle: "Se cargó dos veces", movimiento: "INGRESO", monto: "300.00", anulado: true },
    { tipo: "COBRO", id: "p1", momento: "2026-10-12T10:00:00-03:00", detalle: "Acosta, Sofía · Física I", forma_pago: { id: "f1", nombre: "Efectivo" }, monto: "12000.00", anulado: false },
  ],
};
const filas = () => [...container.querySelectorAll("tbody tr")] as HTMLTableRowElement[];
const botones = (dentro: ParentNode, nombre: string) => [...dentro.querySelectorAll("button")].filter((b) => b.textContent?.trim() === nombre);
const render = (puedeMovimientos: boolean) =>
  act(async () => root.render(<MiCaja caja={CAJA} puedeAbrir puedeCerrar puedeMovimientos={puedeMovimientos} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-I-12-b Mi caja: movimientos manuales", () => {
  it("«Registrar movimiento» junto a «Cerrar caja» y abre el modal", async () => {
    await render(true);
    const [registrar] = botones(container, "Registrar movimiento");
    expect(registrar).toBeDefined();
    expect(botones(container, "Cerrar caja")).toHaveLength(1);
    await act(async () => registrar.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Ingresos o egresos de efectivo que no vienen de clases.");
  });

  it("«Anular» solo en el movimiento no anulado; el anulado muestra «Anulado», tachado y sin la acción; el cobro, nunca", async () => {
    await render(true);
    const [egreso, anulado, cobro] = filas();
    expect(botones(egreso, "Anular")).toHaveLength(1);
    expect(egreso.textContent).toContain("− $ 1.000");
    expect(botones(anulado, "Anular")).toHaveLength(0);
    expect(anulado.textContent).toContain("Anulado");
    expect(anulado.querySelector(".line-through")).not.toBeNull();
    expect(botones(cobro, "Anular")).toHaveLength(0);
  });

  it("«Anular» abre el modal del motivo con los datos del movimiento", async () => {
    await render(true);
    await act(async () => botones(filas()[0], "Anular")[0].click());
    const dialogo = document.querySelector('[role="dialog"]')!;
    expect(dialogo.textContent).toContain("Anular movimiento");
    expect(dialogo.textContent).toContain("Egreso manual · Retiro para comprar insumos · − $ 1.000");
  });

  it("sin cajas:movimiento: ni «Registrar movimiento» ni «Anular»", async () => {
    await render(false);
    expect(botones(container, "Registrar movimiento")).toHaveLength(0);
    expect(botones(container, "Anular")).toHaveLength(0);
  });
});
