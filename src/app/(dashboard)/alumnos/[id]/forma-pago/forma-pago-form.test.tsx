// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ guardar: vi.fn(), dirty: vi.fn() }));
vi.mock("@/server/alumnos/actions", () => ({ actualizarFormaPagoPreferida: m.guardar }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty: m.dirty }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { FormaPagoForm } from "./forma-pago-form";
let root: Root;
let contenedor: HTMLDivElement;
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); contenedor = document.createElement("div"); document.body.append(contenedor); root = createRoot(contenedor);
  await act(async () => root.render(<FormaPagoForm alumnoId="al1" formasPagoActivas={[{ id: "activa", nombre: "Efectivo" }]} formaPagoIdActual="inactiva" nombrePreferidaActual="Cheque" />));
});
afterEach(() => { act(() => root.unmount()); contenedor.remove(); });
it("preferida inactiva visible y conservada: sin cambios no permite borrar accidentalmente", async () => {
  expect(contenedor.textContent).toContain("Cheque"); expect(contenedor.textContent).toContain("Inactiva");
  const select = contenedor.querySelector("select")!;
  expect(select.value).toBe("__elegir__"); expect([...select.options].some((o) => o.value === "inactiva")).toBe(false);
  expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  await act(async () => { contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(m.guardar).not.toHaveBeenCalled();
});
it("una elección explícita de activa permite guardar su id", async () => {
  m.guardar.mockResolvedValue({ data: { forma_pago_preferida_id: "activa" }, error: null });
  await act(async () => { const select=contenedor.querySelector("select")!; select.value="activa"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  await act(async () => { contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(m.guardar).toHaveBeenCalledOnce(); expect(m.guardar.mock.calls[0][1].get("forma_pago_id")).toBe("activa");
  expect(contenedor.textContent).toContain("Forma de pago preferida actualizada");
});
