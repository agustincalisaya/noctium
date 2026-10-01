// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-J-03 c2: vista mes del calendario.
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      prefetch,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
      void prefetch;
      return React.createElement("a", { href, ...props }, children);
    },
  };
});

const { GrillaMensual } = await import("./grilla-mensual");
const { grillaDelMes, construirUrlCalendarioProfesor } = await import("@/lib/calendario-semana");
type ResumenDiaCalendario = import("@/types/calendario.types").ResumenDiaCalendario;

const HOY = "2026-09-30";

function dias(conTurnos: Record<string, Partial<ResumenDiaCalendario>> = {}): ResumenDiaCalendario[] {
  return grillaDelMes(HOY)
    .semanas.flat()
    .map((fecha) => ({
      fecha,
      en_mes: fecha.startsWith("2026-09"),
      cantidad: 0,
      por_estado: { DISPONIBLE: 0, COMPLETO: 0 },
      estado_predominante: null,
      prioridad_maxima: null,
      ...conTurnos[fecha],
    }));
}

const hrefDia = (fecha: string) => construirUrlCalendarioProfesor({ profesorId: "ckprof", vista: "dia", fecha });

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const celda = (fecha: string) => container.querySelector<HTMLAnchorElement>(`a[href$="fecha=${fecha}"]`)!;

describe("GrillaMensual", () => {
  it("muestra LUN a DOM y un link por día de la grilla, que abre la vista día conservando el profesor", async () => {
    await act(async () => root.render(<GrillaMensual dias={dias()} hoy={HOY} hrefDia={hrefDia} />));

    expect(container.textContent).toContain("LUNMARMIÉJUEVIESÁBDOM");
    expect(container.querySelectorAll("a")).toHaveLength(35);
    expect(celda("2026-09-15").getAttribute("href")).toBe("/calendario/profesor?profesorId=ckprof&vista=dia&fecha=2026-09-15");
  });

  it("indicador compacto: '1 turno' / 'N turnos' y el estado predominante con texto e ícono", async () => {
    await act(async () =>
      root.render(
        <GrillaMensual
          dias={dias({
            "2026-09-15": { cantidad: 1, por_estado: { DISPONIBLE: 1, COMPLETO: 0 }, estado_predominante: "DISPONIBLE" },
            "2026-09-16": { cantidad: 3, por_estado: { DISPONIBLE: 1, COMPLETO: 2 }, estado_predominante: "COMPLETO" },
          })}
          hoy={HOY}
          hrefDia={hrefDia}
        />,
      ),
    );

    const uno = celda("2026-09-15");
    expect(uno.textContent).toContain("1 turno");
    expect(uno.textContent).toContain("Disponible");
    expect(uno.querySelector("svg")).not.toBeNull();
    expect(uno.querySelector(".bg-success")).not.toBeNull();
    expect(uno.getAttribute("aria-label")).toBe("Martes 15 de septiembre de 2026: 1 turno, mayoría Disponible. Ver día");

    const tres = celda("2026-09-16");
    expect(tres.textContent).toContain("3 turnos");
    expect(tres.textContent).toContain("Completo");
  });

  it("un día sin turnos muestra solo el número", async () => {
    await act(async () => root.render(<GrillaMensual dias={dias()} hoy={HOY} hrefDia={hrefDia} />));

    const vacio = celda("2026-09-15");
    expect(vacio.textContent).toBe("15");
    expect(vacio.getAttribute("aria-label")).toContain("sin turnos");
  });

  it("días de relleno atenuados (con sus turnos igual) y hoy resaltado", async () => {
    await act(async () =>
      root.render(
        <GrillaMensual
          dias={dias({
            "2026-10-02": { cantidad: 2, por_estado: { DISPONIBLE: 2, COMPLETO: 0 }, estado_predominante: "DISPONIBLE" },
          })}
          hoy={HOY}
          hrefDia={hrefDia}
        />,
      ),
    );

    const relleno = celda("2026-10-02");
    expect(relleno.className).toContain("bg-muted");
    expect(relleno.dataset.enMes).toBe("false");
    expect(relleno.textContent).toContain("2 turnos");
    expect(celda("2026-08-31").className).toContain("bg-muted");
    expect(celda("2026-09-15").className).toContain("bg-card");

    const hoy = celda(HOY);
    expect(hoy.getAttribute("aria-current")).toBe("date");
    expect(hoy.querySelector(".bg-brand-accent")?.textContent).toBe("30");
  });
});
