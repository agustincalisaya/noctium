// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetch, setDirty } = vi.hoisted(() => ({ fetch: vi.fn(), setDirty: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty, confirmarSalida: (salir: () => void) => salir() }) }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  return { Button: ({ children, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => React.createElement("button", { ...props, "data-variant": variant, "data-size": size }, children), buttonVariants: () => "" };
});
vi.mock("@/components/ui/input", async () => {
  const React = await import("react");
  return { Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props) };
});

const { ParticipantesTurno } = await import("./participantes-turno");
const respuesta = (data: unknown, ok = true, error?: unknown) => ({ ok, json: async () => ({ data, error }) });
const turno = (extra: Record<string, unknown> = {}) => ({
  id: "turno-1", fecha: "2026-10-01", hora_inicio: "10:00", hora_fin: "11:00", materia: "Física", materia_id: "materia-1", estado: "PENDIENTE", cupo_maximo: 2,
  alumnos: [{ id: "alumno-1", nombre: "López, Juan", dni: "30123456" }], profesor_id: "profesor-1", ...extra,
});
let root: Root;
let container: HTMLDivElement;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const montar = async () => { await act(async () => { root.render(<ParticipantesTurno id="turno-1" retorno="/turnos" />); }); await esperar(); };
const patch = () => fetch.mock.calls.find(([url, init]) => url.endsWith("/participantes") && init?.method === "PATCH");
const enviar = () => act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockImplementation(async (url: string) => url.includes("/profesores?")
    ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }, { id: "profesor-2", nombre: "Berta", apellido: "Pérez" }])
    : respuesta(turno()));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-04 formulario", () => {
  it("precarga participantes con contador de cupo y Cancelar no envía PATCH", async () => {
    await montar();
    expect(container.textContent).toContain("López, Juan · DNI 30123456");
    expect(container.textContent).toContain("(1/2)");
    const select = container.querySelector("#profesor") as HTMLSelectElement;
    expect(select.value).toBe("profesor-1");
    await act(async () => { select.value = "profesor-2"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(setDirty).toHaveBeenLastCalledWith(true);
    expect(container.querySelector('a[href="/turnos/turno-1?volver=%2Fturnos"]')?.textContent).toBe("Cancelar");
    expect(patch()).toBeUndefined();
  });
  it("muestra exactamente el mensaje cuando no hay profesores activos", async () => {
    fetch.mockImplementation(async (url: string) => url.includes("/profesores?") ? respuesta([]) : respuesta(turno({ alumnos: [], profesor_id: null })));
    await montar();
    expect(container.textContent).toContain("No hay profesores activos asociados a esta materia");
  });
  it("deshabilita el buscador al alcanzar el cupo e informa el motivo", async () => {
    fetch.mockImplementation(async (url: string) => url.includes("/profesores?") ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }]) : respuesta(turno({ cupo_maximo: 1 })));
    await montar();
    expect((container.querySelector("#alumno-busqueda") as HTMLInputElement).disabled).toBe(true);
    expect(container.textContent).toContain("El turno alcanzó su cupo máximo");
  });
  it("quitar un alumno antes de confirmar lo saca del envío", async () => {
    await montar();
    await act(async () => { (container.querySelector('button[aria-label="Quitar a López, Juan"]') as HTMLButtonElement).click(); });
    expect(container.textContent).toContain("(0/2)");
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });
  it("confirma con los IDs seleccionados y muestra el mensaje exacto de éxito", async () => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH" ? respuesta({}) : url.includes("/profesores?") ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }]) : respuesta(turno()));
    await montar();
    await enviar();
    expect(JSON.parse(patch()?.[1].body)).toEqual({ alumno_ids: ["alumno-1"], profesor_id: "profesor-1" });
    expect(container.textContent).toContain("Profesor y alumnos asignados correctamente");
    expect(container.querySelector('a[href="/turnos/turno-1/aula?volver=%2Fturnos"]')?.textContent).toBe("Continuar con aula");
  });
  it("marca el alumno en conflicto con el mensaje del servidor", async () => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH"
      ? respuesta(null, false, { code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario", detalles: { alumno_id: "alumno-1" } })
      : url.includes("/profesores?") ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }]) : respuesta(turno()));
    await montar();
    await enviar();
    const chip = container.querySelector('ul[aria-label="Alumnos agregados"] li')!;
    expect(chip.textContent).toContain("El alumno ya tiene un turno agendado en ese horario");
    expect(container.textContent).toContain("López, Juan · DNI 30123456");
  });
});
