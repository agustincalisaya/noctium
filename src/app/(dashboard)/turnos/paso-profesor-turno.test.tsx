// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasoProfesorTurno, type ProfesorOpcionTurno } from "./paso-profesor-turno";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("Paso 2: horarios de Profesor", () => {
  it("agrupa por día semanal y ordena las franjas sin alterar las opciones", async () => {
    const horarios: ProfesorOpcionTurno["horarios"] = [
      { horario_id: "viernes", dia_semana: "VIERNES", hora_inicio: "15:00", hora_fin: "17:00" },
      { horario_id: "lunes-tarde", dia_semana: "LUNES", hora_inicio: "15:00", hora_fin: "17:00" },
      { horario_id: "miercoles", dia_semana: "MIERCOLES", hora_inicio: "09:00", hora_fin: "10:30" },
      { horario_id: "lunes-manana", dia_semana: "LUNES", hora_inicio: "08:00", hora_fin: "10:00" },
      { horario_id: "martes", dia_semana: "MARTES", hora_inicio: "15:00", hora_fin: "17:00" },
      { horario_id: "lunes-mediodia", dia_semana: "LUNES", hora_inicio: "11:00", hora_fin: "12:00" },
    ];
    const ordenOriginal = horarios.map(({ horario_id }) => horario_id);
    const onSeleccionar = vi.fn();
    await act(async () => root.render(<PasoProfesorTurno profesores={[{ id: "profesor-1", nombre: "Ana", apellido: "Pérez", horarios }]}
      profesorId="" materiaNombre="Física" onSeleccionar={onSeleccionar} cargando={false} error="" mensajeVacio="" onReintentar={vi.fn()} />));

    const filas = [...container.querySelectorAll('input[name="profesor_turno"] + span > span:last-child > span')].map((fila) => fila.textContent?.replaceAll("\u00a0", " "));
    expect(filas).toEqual([
      "Lunes: 08:00–10:00 11:00–12:00 15:00–17:00",
      "Martes: 15:00–17:00",
      "Miércoles: 09:00–10:30",
      "Viernes: 15:00–17:00",
    ]);
    expect(horarios.map(({ horario_id }) => horario_id)).toEqual(ordenOriginal);
    await act(async () => { container.querySelector<HTMLInputElement>('input[name="profesor_turno"]')!.click(); });
    expect(onSeleccionar).toHaveBeenCalledWith("profesor-1");
  });
});
