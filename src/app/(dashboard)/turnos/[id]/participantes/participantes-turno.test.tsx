// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  return { Button: ({ children, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => React.createElement("button", { ...props, "data-variant": variant }, children), buttonVariants: () => "" };
});
vi.mock("@/components/ui/input", async () => {
  const React = await import("react");
  return { Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props) };
});

const { ParticipantesTurno } = await import("./participantes-turno");
const respuesta = (data: unknown) => ({ ok: true, json: async () => ({ data }) });
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockImplementation(async (url: string) => url.includes("/profesores?")
    ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }, { id: "profesor-2", nombre: "Berta", apellido: "Pérez" }])
    : respuesta({ id: "turno-1", fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", materia: "Física", materia_id: "materia-1", estado: "PENDIENTE", alumno_id: "alumno-1", alumnos: [{ id: "alumno-1", nombre: "López, Juan", dni: "30123456" }], profesor_id: "profesor-1" }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-04 formulario", () => {
  it("precarga participantes y Cancelar descarta cambios sin enviar PATCH", async () => {
    await act(async () => { root.render(<ParticipantesTurno id="turno-1" retorno="/turnos" />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(container.textContent).toContain("López, Juan · DNI 30123456");
    const select = container.querySelector("#profesor") as HTMLSelectElement;
    expect(select.value).toBe("profesor-1");
    await act(async () => { select.value = "profesor-2"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect((container.querySelector("#profesor") as HTMLSelectElement).value).toBe("profesor-2");
    expect(container.querySelector('a[href="/turnos/turno-1?volver=%2Fturnos"]')?.textContent).toBe("Cancelar");
    expect(fetch.mock.calls.some(([url, init]) => url.endsWith("/participantes") && init?.method === "PATCH")).toBe(false);
  });
  it("muestra exactamente el mensaje cuando no hay profesores activos", async () => {
    fetch.mockImplementation(async (url: string) => url.includes("/profesores?") ? respuesta([]) : respuesta({ id: "turno-1", fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", materia: "Física", materia_id: "materia-1", estado: "PENDIENTE", alumnos: [], profesor_id: null }));
    await act(async () => { root.render(<ParticipantesTurno id="turno-1" retorno="/turnos" />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(container.textContent).toContain("No hay profesores activos asociados a esta materia");
  });
  it("confirma con los IDs seleccionados y muestra el mensaje exacto de éxito", async () => {
    await act(async () => { root.render(<ParticipantesTurno id="turno-1" retorno="/turnos" />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    const form = container.querySelector("form")!;
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    const llamada = fetch.mock.calls.find(([url, init]) => url.endsWith("/participantes") && init?.method === "PATCH");
    expect(JSON.parse(llamada?.[1].body)).toEqual({ alumno_id: "alumno-1", profesor_id: "profesor-1" });
    expect(container.textContent).toContain("Alumno y profesor asignados correctamente");
    expect(container.querySelector('a[href="/turnos/turno-1/aula?volver=%2Fturnos"]')).not.toBeNull();
  });
});
