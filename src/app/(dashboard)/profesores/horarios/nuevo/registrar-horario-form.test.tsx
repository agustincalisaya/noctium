// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Paso 3 del wizard de alta: tras guardar un intervalo, día y horas vuelven
// en blanco y el dirty flag se apaga ("Finalizar" no debe pedir confirmar un
// descarte inexistente). Fuera del wizard el día se conserva (HU-D-04 c4).
// La Server Action y el toast están mockeados.

const { registrarHorarioProfesor, setDirty, notificarExito } = vi.hoisted(() => ({
  registrarHorarioProfesor: vi.fn(),
  setDirty: vi.fn(),
  notificarExito: vi.fn(),
}));
vi.mock("@/server/profesores/actions", () => ({ registrarHorarioProfesor }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty }) }));
vi.mock("@/components/sesion/link-protegido", () => ({ LinkProtegido: () => null }));
vi.mock("@/components/shared/confirmar-descarte-dialog", () => ({ ConfirmarDescarteDialog: () => null }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ notificarExito }) }));

const { RegistrarHorarioForm } = await import("./registrar-horario-form");

const PROFESOR = { id: "ckprofesor000000000000001", nombre: "Ana", apellido: "Gómez", dni: "28456789" };
const PARAMETROS = {
  diasOperativos: ["LUNES", "MARTES"] as ("LUNES" | "MARTES")[],
  apertura: "08:00",
  cierre: "20:00",
  granularidadMinutos: 30,
};

let contenedor: HTMLDivElement;
let root: Root;

async function montar(modoAlta: boolean) {
  await act(async () => {
    root.render(
      <RegistrarHorarioForm
        profesores={[PROFESOR as never]}
        profesorIdInicial={PROFESOR.id}
        parametros={PARAMETROS as never}
        modoAlta={modoAlta}
      />,
    );
  });
}

function select(nombre: string) {
  return contenedor.querySelector<HTMLSelectElement>(`select[name="${nombre}"]`)!;
}

async function elegir(nombre: string, valor: string) {
  await act(async () => {
    select(nombre).value = valor;
    select(nombre).dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function cargarYGuardar() {
  registrarHorarioProfesor.mockResolvedValue({
    status: "exito",
    horario: { id: "h1", diaSemana: "LUNES", horaInicio: "10:00", horaFin: "12:00" },
  });
  await elegir("diaSemana", "LUNES");
  await elegir("horaInicio", "10:00");
  await elegir("horaFin", "12:00");
  expect(setDirty).toHaveBeenLastCalledWith(true);
  await act(async () => {
    contenedor.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(registrarHorarioProfesor).toHaveBeenCalledOnce();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe("Registrar horario — después de guardar un intervalo", () => {
  it("wizard de alta: día y horas vuelven al placeholder, dirty en false y toast", async () => {
    await montar(true);
    await cargarYGuardar();

    expect(select("diaSemana").value).toBe("");
    expect(select("horaInicio").value).toBe("");
    expect(select("horaFin").value).toBe("");
    expect(setDirty).toHaveBeenLastCalledWith(false);
    expect(notificarExito).toHaveBeenCalledWith("Horario registrado correctamente");
  });

  it("fuera del wizard: el día se conserva (HU-D-04 c4) y las horas se limpian", async () => {
    await montar(false);
    await cargarYGuardar();

    expect(select("diaSemana").value).toBe("LUNES");
    expect(select("horaInicio").value).toBe("");
    expect(select("horaFin").value).toBe("");
    expect(notificarExito).not.toHaveBeenCalled();
  });
});
