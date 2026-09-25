// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-J-02 c2: bloque del evento en el calendario por materia.
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

const { EventoCalendarioMateria } = await import("./evento-calendario-materia");
const { EventoCalendario } = await import("./evento-calendario");

const ESTILO = { top: "0rem", height: "3rem", left: "0%", width: "100%" };
const VOLVER = "/calendario/materia?materiaId=ckmat&semana=2026-09-21";

const evento = (extra: Record<string, unknown> = {}) => ({
  turno_id: "ckturno1",
  fecha: "2026-09-22",
  hora_inicio: "10:00",
  hora_fin: "11:00",
  profesor: "Giménez, Laura",
  alumnos_inscriptos: "3/5",
  inscriptos: 3,
  cupo: 5,
  aula: "Aula 2",
  estado: "DISPONIBLE" as const,
  ...extra,
});

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

describe("EventoCalendarioMateria", () => {
  it("muestra hora, profesor, ocupación, aula y estado con texto, sin nombres de alumnos", async () => {
    await act(async () => root.render(<EventoCalendarioMateria evento={evento()} estilo={ESTILO} volverA={VOLVER} />));

    const link = container.querySelector("a")!;
    const lineas = [...link.querySelectorAll("span")].map((span) => span.textContent);
    expect(lineas).toContain("10:00–11:00");
    expect(lineas).toContain("Giménez, Laura");
    expect(lineas).toContain("Alumnos: 3/5");
    expect(lineas).toContain("Aula 2");
    expect(link.textContent).toContain("Disponible");
    expect(link.getAttribute("aria-label")).toBe(
      "Turno 10:00–11:00 · Giménez, Laura · 3 de 5 alumnos inscriptos · Aula 2 · Disponible. Ver detalle",
    );
  });

  it("abre el detalle con ?volver= apuntando al calendario de la materia", async () => {
    await act(async () => root.render(<EventoCalendarioMateria evento={evento()} estilo={ESTILO} volverA={VOLVER} />));

    expect(container.querySelector("a")!.getAttribute("href")).toBe(
      `/turnos/ckturno1?volver=${encodeURIComponent(VOLVER)}`,
    );
  });

  it("usa un ícono distinto por estado, además del texto", async () => {
    await act(async () => root.render(<EventoCalendarioMateria evento={evento()} estilo={ESTILO} volverA={VOLVER} />));
    const iconoDisponible = container.querySelector("svg")!.getAttribute("class");

    await act(async () =>
      root.render(
        <EventoCalendarioMateria
          evento={evento({ estado: "COMPLETO", alumnos_inscriptos: "5/5", inscriptos: 5 })}
          estilo={ESTILO}
          volverA={VOLVER}
        />,
      ),
    );
    const link = container.querySelector("a")!;

    expect(link.textContent).toContain("Completo");
    expect(link.textContent).toContain("Alumnos: 5/5");
    expect(container.querySelector("svg")!.getAttribute("class")).not.toBe(iconoDisponible);
  });
});

describe("EventoCalendario (HU-J-01, regresión del refactor)", () => {
  it("mantiene Alumno, Materia y Aula y la misma descripción accesible", async () => {
    await act(async () =>
      root.render(
        <EventoCalendario
          evento={{
            turno_id: "ckturno1",
            fecha: "2026-09-22",
            hora_inicio: "10:00",
            hora_fin: "11:00",
            alumno: "Pérez, Ana",
            materia: "Matemática",
            aula: "Aula 2",
            estado: "COMPLETO",
          }}
          estilo={ESTILO}
          volverA="/calendario/profesor?profesorId=ckprof"
        />,
      ),
    );

    const link = container.querySelector("a")!;
    expect(link.getAttribute("aria-label")).toBe(
      "Turno 10:00–11:00 · Pérez, Ana · Matemática · Aula 2 · Completo. Ver detalle",
    );
    expect(link.getAttribute("title")).toBe("10:00–11:00 · Pérez, Ana · Matemática · Aula 2 · Completo");
  });
});
