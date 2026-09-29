// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { fetch, setDirty } = vi.hoisted(() => ({ fetch: vi.fn(), setDirty: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty, confirmarSalida: (salir: () => void) => salir() }) }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});

const { default: NuevoTurnoPage } = await import("./page");
const { TurnoWizard } = await import("./turno-wizard");
const materias = [{ id: "materia-1", nombre: "Física", codigo: "FIS" }, { id: "materia-2", nombre: "Matemática", codigo: null }];
let root: Root;
let container: HTMLDivElement;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const montar = async (elemento: React.ReactNode = <NuevoTurnoPage />) => {
  await act(async () => { root.render(elemento); });
  await esperar();
};
const boton = (texto: string) => [...container.querySelectorAll("button")].find((elemento) => elemento.textContent?.trim() === texto)!;

beforeEach(() => {
  vi.clearAllMocks();
  fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { materias, parametros: {} }, error: null }) });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("HU-C-18 etapa 2 /turnos/nuevo", () => {
  it("renderiza el wizard individual con cinco pasos ordenados y Materia inicial", async () => {
    await montar();
    expect(container.querySelector("h1")?.textContent).toBe("Nuevo turno");
    expect(container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).toContain("Turnos/Nuevo turno");
    const pasos = [...container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li')];
    expect(pasos.map((paso) => paso.textContent?.trim())).toEqual(["1.Materia", "2.Profesor", "3.Fecha y horario", "4.Aula", "5.Alumnos"]);
    expect(pasos[0]?.getAttribute("aria-current")).toBe("step");
    expect(pasos.map((paso) => paso.getAttribute("data-estado"))).toEqual(["actual", "futuro", "futuro", "futuro", "futuro"]);
    expect(container.querySelector("h2#titulo-paso-materia")?.textContent).toBe("Elegí una materia");
    expect(boton("Continuar").disabled).toBe(true);
    expect(boton("Atrás").disabled).toBe(true);
    expect(boton("Generar varios turnos").disabled).toBe(true);
  });

  it("selecciona Materia real, actualiza Resumen, avanza a Profesor y Atrás conserva la selección", async () => {
    await montar();
    expect([...container.querySelectorAll('aside[aria-labelledby="titulo-resumen-turno"] dd')].map((elemento) => elemento.textContent)).toEqual(Array(5).fill("Sin elegir"));
    await act(async () => { container.querySelector<HTMLInputElement>('input[name="materia_turno"][value="materia-1"]')!.click(); });
    expect(container.querySelector("aside")?.textContent).toContain("Física");
    expect(boton("Continuar").disabled).toBe(false);
    await act(async () => { boton("Continuar").click(); });
    const pasos = [...container.querySelectorAll('nav[aria-label="Progreso del nuevo turno"] li')];
    expect(pasos.map((paso) => paso.getAttribute("data-estado"))).toEqual(["completado", "actual", "futuro", "futuro", "futuro"]);
    expect(container.querySelector("h2#titulo-paso-profesor")?.textContent).toBe("Elegí un profesor");
    expect(boton("Continuar").disabled).toBe(true);
    expect(container.textContent).toContain("No es posible consultar profesores en este momento.");
    await act(async () => { boton("Atrás").click(); });
    expect(container.querySelector<HTMLInputElement>('input[name="materia_turno"][value="materia-1"]')?.checked).toBe(true);
    expect(container.querySelector("aside")?.textContent).toContain("Física");
    expect(boton("Continuar").disabled).toBe(false);
  });

  it("solo consulta configuración; no llama rutas legacy, C-07 ni persistencia", async () => {
    await montar();
    await act(async () => { container.querySelector<HTMLInputElement>('input[name="materia_turno"][value="materia-1"]')!.click(); boton("Continuar").click(); });
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/turnos/configuracion", { cache: "no-store" });
    expect(container.querySelectorAll('input[name="profesor_turno"]')).toHaveLength(0);
    expect(container.querySelector('nav[aria-label="Progreso del nuevo turno"] li[aria-current="step"]')?.textContent).toContain("Profesor");
  });

  it("acepta opciones de Profesor inyectadas sin fetch y conserva navegación local", async () => {
    await montar(<TurnoWizard profesores={[{ id: "profesor-1", nombre: "Ana", apellido: "Pérez" }]} />);
    await act(async () => { container.querySelector<HTMLInputElement>('input[name="materia_turno"][value="materia-1"]')!.click(); });
    await act(async () => { boton("Continuar").click(); });
    await act(async () => { container.querySelector<HTMLInputElement>('input[name="profesor_turno"][value="profesor-1"]')!.click(); });
    expect(container.querySelector("aside")?.textContent).toContain("Pérez, Ana");
    await act(async () => { boton("Continuar").click(); });
    expect(container.querySelector("h2#titulo-paso-pendiente")?.textContent).toBe("Elegí fecha y horario");
    expect(boton("Continuar a aula").disabled).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
