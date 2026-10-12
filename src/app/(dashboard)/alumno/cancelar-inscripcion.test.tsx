// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { request, refresh, success } = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchOLanzar: request }));
vi.mock("sonner", () => ({ toast: { success } }));
import { CancelarInscripcion } from "./cancelar-inscripcion";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const click = async (texto: string, enDialogo = false) => {
  const raiz = enDialogo ? document.querySelector('[role="alertdialog"]')! : document;
  const boton = [...raiz.querySelectorAll("button")].find((elemento) => elemento.textContent === texto) as HTMLButtonElement;
  await act(async () => boton.click());
};

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  request.mockResolvedValue({});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<CancelarInscripcion turnoId="t1" materia="Física I" fecha="martes 13 de octubre" hora="16:00" conPagos />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("CancelarInscripcion", () => {
  it("confirma con datos reales, aviso irreversible y reintegro", async () => {
    await click("Cancelar mi inscripción");
    const dialogo = document.querySelector('[role="alertdialog"]')!;
    expect(dialogo.textContent).toContain("Física I del martes 13 de octubre a las 16:00");
    expect(dialogo.textContent).toContain("Esta acción no se puede deshacer.");
    expect(dialogo.textContent).toContain("consultá en el centro por el reintegro");
  });

  it("comparte la petición, informa éxito y refresca al cerrar", async () => {
    await click("Cancelar mi inscripción");
    await click("Cancelar inscripción", true);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/turnos/t1/inscripcion/cancelacion", { method: "POST", cache: "no-store" });
    expect(success).toHaveBeenCalledWith("Cancelaste tu inscripción");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("informa el reintegro según con_pagos de la respuesta, aunque el listado no lo indicara", async () => {
    await act(async () => root.render(<CancelarInscripcion turnoId="t1" materia="Física I" fecha="martes 13 de octubre" hora="16:00" conPagos={false} />));
    request.mockResolvedValueOnce({ con_pagos: true });
    await click("Cancelar mi inscripción");
    expect(document.querySelector('[role="alertdialog"]')?.textContent).not.toContain("reintegro");
    await click("Cancelar inscripción", true);
    expect(success).toHaveBeenCalledWith("Cancelaste tu inscripción", { description: "Si abonaste esta clase, consultá en el centro por el reintegro." });
  });

  it("mantiene abierto el diálogo cuando el servidor rechaza", async () => {
    request.mockRejectedValueOnce(new Error("Ya no podés cancelar en línea"));
    await click("Cancelar mi inscripción");
    await click("Cancelar inscripción", true);
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Ya no podés cancelar en línea");
    expect(refresh).not.toHaveBeenCalled();
  });
});
