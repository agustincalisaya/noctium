// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HistorialEstadoAlumno } from "@/types/alumno.types";
import { HistorialEstadosAlumno } from "./historial-estados-alumno";

// Sección «Historial de estados» de la ficha (HU-B-07): recibe la misma forma
// que devuelve `historial_estados` de la API.

let root: Root, container: HTMLDivElement;
const montar = (historial: HistorialEstadoAlumno[]) => act(async () => root.render(<HistorialEstadosAlumno historial={historial} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("HistorialEstadosAlumno", () => {
  it("sin bajas ni reactivaciones muestra el texto vacío", async () => {
    await montar([]);
    expect(container.textContent).toContain("Historial de estados");
    expect(container.textContent).toContain("Sin bajas ni reactivaciones.");
    expect(container.querySelector("ol")).toBeNull();
  });

  it("lista cada cambio en el orden recibido, con acción, fecha del centro, usuario y motivo", async () => {
    await montar([
      { fecha: "2026-10-12T14:03:00-03:00", accion: "REACTIVAR", usuario: { id: "u1", nombre_para_mostrar: "Ruiz, Marta" }, motivo: null },
      { fecha: "2026-10-05T12:00:00-03:00", accion: "DESACTIVAR", usuario: { id: "u1", nombre_para_mostrar: "Ruiz, Marta" }, motivo: "Se mudó" },
    ]);
    const filas = [...container.querySelectorAll("li")].map((li) => li.textContent);
    expect(filas).toEqual([
      "Reactivación12/10/2026, 14:03 · Ruiz, Marta",
      "Desactivación05/10/2026, 12:00 · Ruiz, MartaSe mudó",
    ]);
    expect(container.querySelector("time")!.getAttribute("datetime")).toBe("2026-10-12T14:03:00-03:00");
  });

  it("si no hay nombre para el usuario (proceso automático o ficha sin personal) usa el texto genérico", async () => {
    await montar([
      { fecha: "2026-10-05T12:00:00-03:00", accion: "DESACTIVAR", usuario: null, motivo: null },
      { fecha: "2026-10-04T12:00:00-03:00", accion: "DESACTIVAR", usuario: { id: "u2", nombre_para_mostrar: null }, motivo: null },
    ]);
    const filas = [...container.querySelectorAll("li")].map((li) => li.textContent!);
    expect(filas).toHaveLength(2);
    for (const fila of filas) expect(fila).toContain("· Usuario");
  });
});
