// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetchMock }));

const { HistorialCambiosDialog } = await import("./historial-cambios-dialog");

const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 400, status, json: async () => cuerpo });
const REGISTRO = {
  monto: "20000.00", forma_pago: { id: "f", nombre: "Transferencia" }, fecha_pago: "2026-10-07",
  registrado_por: { usuario_id: "u1", nombre_completo: "Ruiz, Marta" }, registrado_en: "2026-10-08T10:12:00-03:00",
};
const cerrar = vi.fn();
let root: Root;
let container: HTMLDivElement;
const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement;
const render = () => act(async () => root.render(<HistorialCambiosDialog pagoId="pago-1" titulo="Sofía Acosta · Física I del Jue 08/10" onCerrar={cerrar} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HistorialCambiosDialog (HU-I-06, DEC-27)", () => {
  it("muestra el registro y cada cambio con tipo, anterior → nuevo, motivo, usuario y fecha, en el orden del servidor", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { data: { registro: REGISTRO, cambios: [
      { tipo: "ANULACION", valor_anterior: "20000.00", valor_nuevo: null, motivo: "Reintegro", usuario: { usuario_id: "g", nombre_completo: "Pérez, Ana" }, fecha: "2026-10-10T09:00:00-03:00" },
      { tipo: "CORRECCION_FORMA", valor_anterior: "Efectivo", valor_nuevo: "Transferencia", motivo: "Era transferencia", usuario: { usuario_id: "u1", nombre_completo: "Ruiz, Marta" }, fecha: "2026-10-09T12:00:00-03:00" },
      { tipo: "CORRECCION_FECHA", valor_anterior: "2026-10-08", valor_nuevo: "2026-10-07", motivo: "Fecha", usuario: null, fecha: "2026-10-09T11:00:00-03:00" },
      { tipo: "CORRECCION_MONTO", valor_anterior: "24000.00", valor_nuevo: "20000.00", motivo: "Beca parcial", usuario: { usuario_id: "u1", nombre_completo: "Ruiz, Marta" }, fecha: "2026-10-09T10:00:00-03:00" },
    ] }, error: null }));
    await render();
    expect(fetchMock).toHaveBeenCalledWith("/api/pagos/pago-1/historial", expect.objectContaining({ cache: "no-store" }));
    const texto = dialogo().textContent!;
    expect(texto).toContain("Detalle del pago");
    expect(texto).toContain("Sofía Acosta · Física I del Jue 08/10");
    expect(texto).toContain("$ 20.000 · Transferencia · 07/10/2026");
    expect(texto).toContain("Registrado por Ruiz, Marta el 08/10/2026");
    const filas = [...dialogo().querySelectorAll("tbody tr")].map((fila) => [...fila.querySelectorAll("td")].slice(0, 4).map((celda) => celda.textContent));
    expect(filas).toEqual([
      ["Anulación", "$ 20.000", "Reintegro", "Pérez, Ana"],
      ["Corrección de forma de pago", "Efectivo → Transferencia", "Era transferencia", "Ruiz, Marta"],
      ["Corrección de fecha", "08/10/2026 → 07/10/2026", "Fecha", "Proceso automático"],
      ["Corrección de monto", "$ 24.000 → $ 20.000", "Beca parcial", "Ruiz, Marta"],
    ]);
  });

  it("sin cambios muestra el estado vacío", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { data: { registro: REGISTRO, cambios: [] }, error: null }));
    await render();
    expect(dialogo().textContent).toContain("Este pago no tiene correcciones ni anulaciones.");
    expect(dialogo().querySelector("table")).toBeNull();
  });

  it("si la consulta falla, avisa y permite reintentar; Cerrar llama a onCerrar", async () => {
    fetchMock.mockResolvedValueOnce(respuesta(500, { data: null, error: { code: "X", message: "x" } }));
    fetchMock.mockResolvedValueOnce(respuesta(200, { data: { registro: REGISTRO, cambios: [] }, error: null }));
    await render();
    expect(dialogo().textContent).toContain("No se pudo cargar el detalle del pago.");
    await act(async () => { [...dialogo().querySelectorAll("button")].find((b) => b.textContent === "Reintentar")!.click(); });
    expect(dialogo().textContent).toContain("Este pago no tiene correcciones ni anulaciones.");
    await act(async () => { [...dialogo().querySelectorAll("button")].find((b) => b.textContent === "Cerrar")!.click(); });
    expect(cerrar).toHaveBeenCalled();
  });
});
