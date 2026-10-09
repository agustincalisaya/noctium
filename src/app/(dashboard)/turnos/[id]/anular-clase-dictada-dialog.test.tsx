// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnularClaseDictadaDialog } from "./anular-clase-dictada-dialog";
import type { TurnoDetalle } from "@/types/turno.types";
const m = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchOLanzar: m.fetch }));
vi.mock("sonner", () => ({ toast: { success: m.toast } }));
let root: Root; let div: HTMLDivElement;
const turno = { id: "t", materia: "Matemática II", fecha: "2026-10-01", hora_inicio: "15:00" } as TurnoDetalle;
const onAnulada = vi.fn(async () => {});
const button = (name: string) => [...document.querySelectorAll("button")].find(b => b.textContent === name)!;
async function abrir() { await act(async () => { root.render(<AnularClaseDictadaDialog turno={turno} onAnulada={onAnulada} />); }); await act(async () => button("Anular registro de clase dictada").click()); }
async function escribir(value: string) {
 await act(async () => { const area = document.querySelector("textarea")!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, value); area.dispatchEvent(new Event("input", { bubbles: true })); });
}
beforeEach(() => { vi.clearAllMocks(); div = document.createElement("div"); document.body.append(div); root = createRoot(div); m.fetch.mockResolvedValue({}); });
afterEach(async () => { await act(async () => root.unmount()); div.remove(); });
describe("E11 modal", () => {
 it("muestra contexto/efectos, exige motivo y volver no escribe", async () => {
  await abrir(); const dialog = document.querySelector('[role="alertdialog"]')!;
  expect(dialog.textContent).toContain("Matemática II del Jue 01/10 a las 15:00"); expect(dialog.textContent).toContain("Esta acción no se puede deshacer");
  expect(button("Anular registro").disabled).toBe(true); expect(document.querySelector("textarea")!.maxLength).toBe(300);
  await act(async () => button("Volver").click()); expect(m.fetch).not.toHaveBeenCalled();
 });
 it("error conserva diálogo/motivo; reintento refresca y avisa", async () => {
  await abrir(); await escribir("No se dio"); m.fetch.mockRejectedValueOnce(new Error("Otra persona está modificando estos datos"));
  await act(async () => button("Anular registro").click()); expect(document.querySelector('[role="alert"]')!.textContent).toContain("Otra persona"); expect(document.querySelector("textarea")!.value).toBe("No se dio");
  await act(async () => button("Anular registro").click()); expect(m.fetch).toHaveBeenLastCalledWith("/api/turnos/t/clase-dictada/anulacion", expect.objectContaining({ method: "POST", body: JSON.stringify({ motivo: "No se dio" }) })); expect(onAnulada).toHaveBeenCalledOnce(); expect(m.toast).toHaveBeenCalledWith("Registro de clase dictada anulado");
 });
});
