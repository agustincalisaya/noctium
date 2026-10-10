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
  aula: "Aula 1", aula_id: "aula-1", alumnos: [{ id: "alumno-1", nombre: "López, Juan", dni: "30123456" }], profesor_id: "profesor-1", ...extra,
});
const OPCIONES = "/profesores/opciones?";
let root: Root;
let container: HTMLDivElement;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const montar = async () => { await act(async () => { root.render(<ParticipantesTurno id="turno-1" retorno="/turnos" />); }); await esperar(); };
const patch = () => fetch.mock.calls.find(([url, init]) => url.endsWith("/participantes") && init?.method === "PATCH");
/** HU-C-25: «Confirmar turno» abre la confirmación antes de guardar (C §2.18.3); el diálogo se porta fuera de `container`. */
const dialogoConfirmacion = () => document.querySelector('[role="alertdialog"]');
const botonDialogo = (texto: string) => [...dialogoConfirmacion()!.querySelectorAll("button")].find((elemento) => elemento.textContent?.trim() === texto) as HTMLButtonElement;
const pedirConfirmacion = () => act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
const enviar = async () => { await pedirConfirmacion(); await act(async () => { botonDialogo("Inscribir").click(); }); };

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockImplementation(async (url: string) => url.includes(OPCIONES)
    ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }, { id: "profesor-2", nombre: "Berta", apellido: "Pérez" }])
    : respuesta(turno()));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-04 formulario", () => {
  it("precarga participantes con resumen del aula y cupo, y Cancelar no envía PATCH", async () => {
    await montar();
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain("/api/turnos/profesores/opciones?turno_id=turno-1");
    expect(container.textContent).toContain("Aula: Aula 1 · Cupo máximo: 2");
    expect(container.textContent).toContain("Pendiente");
    expect(container.textContent).toContain("López, Juan · DNI 30123456");
    expect(container.textContent).toContain("(1/2)");
    expect(container.querySelector("#profesor")).toBeNull();
    expect(container.textContent).toContain("Profesor ya asignado al turno.");
    await act(async () => { (container.querySelector('button[aria-label="Quitar a López, Juan"]') as HTMLButtonElement).click(); });
    expect(setDirty).toHaveBeenLastCalledWith(true);
    expect(container.querySelector('a[href="/turnos/turno-1?volver=%2Fturnos"]')?.textContent).toBe("Cancelar");
    expect(patch()).toBeUndefined();
  });
  it("muestra exactamente el mensaje cuando la materia no tiene profesores activos", async () => {
    fetch.mockImplementation(async (url: string) => url.includes(OPCIONES)
      ? respuesta(null, false, { code: "SIN_PROFESORES_PARA_MATERIA", message: "No hay profesores activos asociados a esta materia" })
      : respuesta(turno({ alumnos: [], profesor_id: null })));
    await montar();
    expect(container.textContent).toContain("No hay profesores activos asociados a esta materia");
  });
  it("distingue cuando ningún profesor está disponible en ese horario (§2.6)", async () => {
    fetch.mockImplementation(async (url: string) => url.includes(OPCIONES) ? respuesta([]) : respuesta(turno({ alumnos: [], profesor_id: null })));
    await montar();
    expect(container.textContent).toContain("No hay profesores disponibles para este horario");
  });
  it("sin aula no ofrece el formulario y lleva a asignarla (TURNO_SIN_AULA)", async () => {
    fetch.mockImplementation(async () => respuesta(turno({ aula: "Sin asignar", aula_id: null, cupo_maximo: null, alumnos: [], profesor_id: null })));
    await montar();
    expect(container.textContent).toContain("Asigná un aula antes de confirmar el turno.");
    expect(container.querySelector('a[href="/turnos/turno-1/configuracion?volver=%2Fturnos"]')?.textContent).toBe("Asignar aula");
    expect(container.querySelector("form")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url.includes(OPCIONES))).toBe(false);
  });
  it("deshabilita el buscador al alcanzar el cupo e informa el motivo", async () => {
    fetch.mockImplementation(async (url: string) => url.includes(OPCIONES) ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }]) : respuesta(turno({ cupo_maximo: 1 })));
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
  it("HU-C-25: «Confirmar turno» pide confirmación con los datos concretos antes de guardar; «Volver» no inscribe", async () => {
    await montar();
    await pedirConfirmacion();
    expect(patch()).toBeUndefined();
    expect(dialogoConfirmacion()?.textContent).toContain("¿Estás seguro de que querés inscribir a Juan López en Física del 01/10/2026 a las 10:00?");
    await act(async () => { botonDialogo("Volver").click(); });
    expect(dialogoConfirmacion()).toBeNull();
    expect(patch()).toBeUndefined();
    expect(container.textContent).toContain("López, Juan · DNI 30123456");
  });
  it("confirma el turno con los IDs seleccionados, muestra el mensaje exacto de éxito y ofrece «Registrar pago» por cada alumno (C §2.18.3)", async () => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH"
      ? respuesta({ estado: "DISPONIBLE", inscripciones: [{ alumno_id: "alumno-1", inscripcion_id: "inscripcion-1", estado_pago: "RESERVADA", vence_el: "2026-09-30T10:00:00-03:00", precio: 24000 }] })
      : url.includes(OPCIONES) ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }]) : respuesta(turno()));
    await montar();
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe("Confirmar turno");
    await enviar();
    expect(JSON.parse(patch()?.[1].body)).toEqual({ alumno_ids: ["alumno-1"] });
    expect(container.textContent).toContain("Profesor y alumnos asignados correctamente");
    expect(container.textContent).toContain("Turno confirmado");
    expect(container.textContent).toContain("Disponible");
    expect(container.querySelector('a[href*="/aula"]')).toBeNull();
    const acceso = container.querySelector('a[aria-label^="Registrar pago de"]');
    expect(acceso?.getAttribute("href")).toBe("/pagos/registrar?alumno=alumno-1&clase=turno-1");
    expect(container.querySelector('a[href="/turnos/turno-1?volver=%2Fturnos"]')?.textContent).toBe("Ver detalle");
  });
  it("PENDIENTE antiguo sin profesor conserva el selector y envía profesor_id explícito", async () => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH" ? respuesta({ estado: "DISPONIBLE" })
      : url.includes(OPCIONES) ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }])
        : respuesta(turno({ profesor_id: null })));
    await montar();
    expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/turnos/profesores/opciones?turno_id=turno-1");
    const select = container.querySelector("#profesor") as HTMLSelectElement;
    await act(async () => { select.value = "profesor-1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await enviar();
    expect(JSON.parse(patch()?.[1].body)).toEqual({ alumno_ids: ["alumno-1"], profesor_id: "profesor-1" });
  });
  it("rechazo del servidor: se muestra en el diálogo y marca el alumno en conflicto", async () => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => init?.method === "PATCH"
      ? respuesta(null, false, { code: "ALUMNO_NO_DISPONIBLE", message: "El alumno ya tiene un turno agendado en ese horario", detalles: { alumno_id: "alumno-1" } })
      : url.includes(OPCIONES) ? respuesta([{ id: "profesor-1", nombre: "Ana", apellido: "Gómez" }]) : respuesta(turno()));
    await montar();
    await pedirConfirmacion();
    await act(async () => { botonDialogo("Inscribir").click(); });
    expect(dialogoConfirmacion()?.querySelector('[role="alert"]')?.textContent).toContain("El alumno ya tiene un turno agendado en ese horario");
    await act(async () => { botonDialogo("Volver").click(); });
    const chip = container.querySelector('ul[aria-label="Alumnos agregados"] li')!;
    expect(chip.textContent).toContain("El alumno ya tiene un turno agendado en ese horario");
    expect(container.textContent).toContain("López, Juan · DNI 30123456");
  });
});
