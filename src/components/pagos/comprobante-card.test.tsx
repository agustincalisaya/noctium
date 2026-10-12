// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComprobanteLeido } from "@/types/pago.types";

// Tarjeta del comprobante (HU-I-11, imagen 1 de la HU): muestra la copia fija
// y las marcas derivadas; el router y window.print están simulados.
const m = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: m.back }) }));

const { ComprobanteCard } = await import("./comprobante-card");

const BASE: ComprobanteLeido = {
  id: "comp-1", numero: "0001-00002433", emitido_el: "2026-10-06T12:42:00-03:00",
  centro: { nombre: "Noctium · Centro de Atención Académica", domicilio: "Av. Colón 1250, Córdoba", telefono: "351-4000000" },
  alumno: { nombre_completo: "Acosta, Sofía", dni: "45348288" },
  fecha_pago: "2026-10-06", forma_pago: { nombre: "Mercado Pago" }, registrado_por: "Ferreyra, Julián",
  clases: [
    { materia: "Física I", fecha: "2026-10-13", hora_inicio: "16:00", monto: "12000.00" },
    { materia: "Matemática II", fecha: "2026-10-21", hora_inicio: "17:00", monto: "11000.00" },
  ],
  total: "23000.00",
  marcas: { anulado: null, reemplazado_por: null, reemplaza_a: null },
};

let root: Root;
let container: HTMLDivElement;
const montar = (comprobante: ComprobanteLeido) => act(async () => { root.render(<ComprobanteCard comprobante={comprobante} />); });
const boton = (nombre: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === nombre) as HTMLButtonElement;

beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("ComprobanteCard", () => {
  it("vista completa: centro con teléfono, datos, tabla, total y leyenda; sin marcas", async () => {
    await montar(BASE);
    const texto = container.textContent!;
    expect(container.querySelector("[data-comprobante]")).not.toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Comprobante N.° 0001-00002433");
    expect(texto).toContain("Av. Colón 1250, Córdoba · Tel. 351-4000000");
    expect(texto).toContain("Fecha de pago: 06/10/2026");
    expect(texto).toContain("Emitido: 06/10/2026");
    expect(texto).toContain("Alumno: Acosta, Sofía");
    expect(texto).toContain("DNI: 45348288");
    expect(texto).toContain("Forma de pago: Mercado Pago");
    expect(texto).toContain("Registrado por: Ferreyra, Julián");
    expect([...container.querySelectorAll("tbody tr")].map((tr) => tr.textContent)).toEqual([
      "Física I13/10/202616:00$ 12.000", "Matemática II21/10/202617:00$ 11.000",
    ]);
    expect(container.querySelector("tfoot")?.textContent).toBe("Total$ 23.000");
    expect(texto).toContain("Comprobante interno. No válido como factura");
    expect(container.querySelector('[data-testid="marcas-comprobante"]')).toBeNull();
  });

  it("«Registrado por» sin dato muestra el guion", async () => {
    await montar({ ...BASE, registrado_por: null });
    expect(container.textContent).toContain("Registrado por: —");
  });

  it("ANULADO con fecha y motivo (vista completa)", async () => {
    await montar({ ...BASE, marcas: { ...BASE.marcas, anulado: { fecha: "2026-10-10", motivo: "Reintegro" } } });
    const marcas = container.querySelector('[data-testid="marcas-comprobante"]')!.textContent;
    expect(marcas).toContain("ANULADO");
    expect(marcas).toContain("Anulado el 10/10/2026");
    expect(marcas).toContain("Motivo: Reintegro");
  });

  it("Reemplazado por y reemplaza a", async () => {
    await montar({ ...BASE, marcas: { anulado: null, reemplazado_por: { id: "comp-2", numero: "0001-00002495" }, reemplaza_a: { numero: "0001-00002400" } } });
    const marcas = container.querySelector('[data-testid="marcas-comprobante"]')!.textContent;
    expect(marcas).toContain("Reemplazado por 0001-00002495");
    expect(marcas).toContain("Reemplaza al comprobante 0001-00002400");
  });

  it("vista del alumno: «Registrado en el centro», sin «Registrado por» ni motivo", async () => {
    const { registrado_por: _omitido, ...sinRegistrador } = BASE;
    void _omitido;
    await montar({ ...sinRegistrador, registrado_en_el_centro: true, marcas: { ...BASE.marcas, anulado: { fecha: "2026-10-10" } } });
    const texto = container.textContent!;
    expect(texto).toContain("Registrado en el centro");
    expect(texto).not.toContain("Registrado por");
    expect(texto).not.toContain("Motivo");
    expect(texto).toContain("Anulado el 10/10/2026");
  });

  it("Imprimir llama a window.print(); Cerrar y la X vuelven atrás", async () => {
    const print = vi.fn();
    Object.assign(window, { print });
    await montar(BASE);
    await act(async () => { boton("Imprimir").click(); });
    expect(print).toHaveBeenCalledTimes(1);
    await act(async () => { boton("Cerrar").click(); });
    await act(async () => { (container.querySelector('button[aria-label="Cerrar comprobante"]') as HTMLButtonElement).click(); });
    expect(m.back).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("«Imprimir» abre el diálogo de impresión del navegador");
  });
});
