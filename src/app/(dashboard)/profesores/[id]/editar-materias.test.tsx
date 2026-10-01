// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HU-D-07: sección Materias del modo edición de la ficha, secuencia de
// guardado 2.7 → 2.6 y modal «Ver turnos». Server Actions, router y fetch
// mockeados.

const { actualizarMateriasProfesor, modificarProfesor, replace, setDirty, fetchAutenticado } = vi.hoisted(() => ({
  actualizarMateriasProfesor: vi.fn(),
  modificarProfesor: vi.fn(),
  replace: vi.fn(),
  setDirty: vi.fn(),
  fetchAutenticado: vi.fn(),
}));
vi.mock("@/server/profesores/actions", () => ({ actualizarMateriasProfesor, modificarProfesor }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }) }));
vi.mock("@/components/sesion/dirty-state-context", () => ({ useDirtyState: () => ({ dirty: false, setDirty }) }));
vi.mock("@/components/shared/confirmar-descarte-dialog", () => ({ ConfirmarDescarteDialog: () => null }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado }));

const { EditarProfesorForm } = await import("./editar-profesor-form");

const MAT = "ckmateria0000000000000001";
const FIS = "ckmateria0000000000000002";
const QUI = "ckmateria0000000000000003";
const HIS = "ckmateria0000000000000004";

const PROFESOR = {
  id: "ckprofesor000000000000001",
  nombre: "Laura",
  apellido: "Giménez",
  dni: "27100001",
  fechaNacimiento: new Date(Date.UTC(1979, 2, 12)),
  genero: "FEMENINO" as const,
  telefono: "+541155600001",
  email: "profesor1@noctium.local",
  activo: true,
  fechaAlta: new Date(Date.UTC(2026, 8, 1)),
  materias: [],
  horarios: [],
  version: 4,
};

const OPCIONES = [
  { id: FIS, nombre: "Física", codigo: "FIS101", activa: true, asociada: true },
  { id: HIS, nombre: "Historia de la Ciencia", codigo: "HIS101", activa: false, asociada: true },
  { id: MAT, nombre: "Matemática", codigo: "MAT101", activa: true, asociada: true },
  { id: QUI, nombre: "Química", codigo: null, activa: true, asociada: false },
];

const respuesta = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data, error: null }) });
const turno = (i: number) => ({
  turno_id: `turno-${i}`, fecha: "2026-10-06", hora_inicio: "08:00", hora_fin: "10:00",
  aula: "Aula 1", alumnos_inscriptos: "3/5", estado: i % 2 ? "COMPLETO" : "DISPONIBLE",
});

let contenedor: HTMLDivElement;
let root: Root;

async function montar(props: { activo?: boolean } = {}) {
  await act(async () => {
    root.render(
      <EditarProfesorForm
        profesor={{ ...PROFESOR, activo: props.activo ?? true }}
        dniLongitudMin={7}
        dniLongitudMax={8}
        fechaMaximaNacimiento="2008-01-01"
        rutaConsulta="/profesores/p"
        rutaTrasGuardar="/profesores/p?actualizada=1"
        rutaTrasGuardarMaterias="/profesores/p?actualizada=materias"
        opcionesMaterias={OPCIONES}
      />,
    );
  });
}

const casilla = (id: string) => document.getElementById(`materia-${id}`) as HTMLInputElement;
const boton = (texto: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;
const alternar = (id: string) => act(async () => casilla(id).click());
const guardar = () => act(async () => boton("Guardar cambios").click());
function escribir(id: string, valor: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  return act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  actualizarMateriasProfesor.mockResolvedValue({
    data: { agregadas: [], quitadas: [], pendientes_afectados: 0, sin_cambios: false }, error: null,
  });
  modificarProfesor.mockResolvedValue({ data: { id: PROFESOR.id, campos_modificados: ["telefono"], version: 5 }, error: null });
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe("HU-D-07 selector de materias en el modo edición", () => {
  it("AC1: asociadas tildadas y habilitadas, activas disponibles, inactiva asociada con etiqueta", async () => {
    await montar();
    expect(casilla(FIS).checked).toBe(true);
    expect(casilla(MAT).checked).toBe(true);
    expect(casilla(HIS).checked).toBe(true);
    expect(casilla(QUI).checked).toBe(false);
    expect([FIS, MAT, HIS, QUI].every((id) => !casilla(id).disabled)).toBe(true);
    expect(casilla(HIS).closest("label")!.textContent).toContain("Inactiva");
    expect(boton("Guardar cambios").disabled).toBe(true);
  });

  it("la sección es `relative`: el legend sr-only (absolute) no escapa del <main> que scrollea", async () => {
    await montar();
    const seccion = document.getElementById("materias")!;
    expect(seccion.className.split(" ")).toContain("relative");
    expect(seccion.querySelector("legend.sr-only")).not.toBeNull();
  });

  it("AC4: solo materias → guarda el conjunto final, no llama a 2.6 y vuelve con el banner de materias", async () => {
    await montar();
    await alternar(QUI);
    await alternar(HIS);
    expect(setDirty).toHaveBeenLastCalledWith(true);
    await guardar();
    expect(actualizarMateriasProfesor).toHaveBeenCalledWith(PROFESOR.id, expect.arrayContaining([FIS, MAT, QUI]));
    expect(actualizarMateriasProfesor.mock.calls[0]![1]).toHaveLength(3);
    expect(modificarProfesor).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/profesores/p?actualizada=materias");
  });

  it("pendientes afectados viajan al banner", async () => {
    actualizarMateriasProfesor.mockResolvedValue({
      data: { agregadas: [], quitadas: [MAT], pendientes_afectados: 2, sin_cambios: false }, error: null,
    });
    await montar();
    await alternar(MAT);
    await guardar();
    expect(replace).toHaveBeenCalledWith("/profesores/p?actualizada=materias&pendientes=2");
  });

  it("AC3: rechazo → la casilla vuelve a quedar tildada, aviso con N y «Ver turnos»; el resto sigue sin guardar", async () => {
    actualizarMateriasProfesor.mockResolvedValue({
      data: null,
      error: { code: "MATERIA_CON_TURNOS_FUTUROS", message: "x", detalle: [{ materia_id: MAT, cantidad: 3 }] },
    });
    await montar();
    await alternar(MAT);
    await alternar(QUI);
    await escribir("telefono", "0387154123456");
    await guardar();

    expect(casilla(MAT).checked).toBe(true);
    expect(casilla(QUI).checked).toBe(true); // cambio pendiente conservado
    const aviso = document.getElementById(`materia-${MAT}-bloqueo`)!;
    expect(aviso.textContent).toContain("No se puede quitar: el profesor tiene 3 turnos futuros de esta materia");
    expect(aviso.className).toContain("bg-destructive-soft");
    expect(aviso.querySelector("button")!.textContent).toBe("Ver turnos");
    expect(modificarProfesor).not.toHaveBeenCalled(); // 2.7 falló: los datos no se envían
    expect(replace).not.toHaveBeenCalled();
    expect(boton("Guardar cambios").disabled).toBe(false);
  });

  it("2.7 ok y 2.6 falla → banner de aviso y el reintento solo manda los datos", async () => {
    modificarProfesor.mockResolvedValueOnce({
      data: null, error: { code: "DNI_DUPLICADO", message: "Ya existe un profesor registrado con ese DNI" },
    });
    await montar();
    await alternar(QUI);
    await escribir("dni", "28100002");
    await guardar();
    expect(document.body.textContent).toContain(
      "Las materias se guardaron, pero los datos no: Ya existe un profesor registrado con ese DNI",
    );
    expect(replace).not.toHaveBeenCalled();

    await escribir("dni", "27100099");
    await guardar();
    expect(actualizarMateriasProfesor).toHaveBeenCalledOnce();
    expect(modificarProfesor).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/profesores/p?actualizada=1");
  });

  it("materias + datos → 2.7 y después 2.6 con la versión precargada; banner de profesor actualizado", async () => {
    await montar();
    await alternar(QUI);
    await escribir("telefono", "0387154123456");
    await guardar();
    expect(actualizarMateriasProfesor.mock.invocationCallOrder[0]).toBeLessThan(modificarProfesor.mock.invocationCallOrder[0]!);
    expect((modificarProfesor.mock.calls[0]![1] as FormData).get("version")).toBe("4");
    expect(replace).toHaveBeenCalledWith("/profesores/p?actualizada=1");
  });

  it("MATERIA_INACTIVA nombra la materia y la marca", async () => {
    actualizarMateriasProfesor.mockResolvedValue({
      data: null, error: { code: "MATERIA_INACTIVA", message: "x", materias: [{ id: QUI, nombre: "Química" }] },
    });
    await montar();
    await alternar(QUI);
    await guardar();
    expect(document.body.textContent).toContain("La materia Química dejó de estar activa");
    expect(casilla(QUI).getAttribute("aria-invalid")).toBe("true");
  });

  it("profesor inactivo: materias en solo lectura", async () => {
    await montar({ activo: false });
    expect(casilla(FIS)).toBeNull();
    expect(document.body.textContent).toContain("Solo pueden asociarse materias a profesores activos");
  });
});

describe("HU-D-07 modal «Ver turnos»", () => {
  async function abrirModal(total: number, items = Array.from({ length: Math.min(total, 10) }, (_, i) => turno(i))) {
    actualizarMateriasProfesor.mockResolvedValue({
      data: null,
      error: { code: "MATERIA_CON_TURNOS_FUTUROS", message: "x", detalle: [{ materia_id: MAT, cantidad: total }] },
    });
    fetchAutenticado.mockResolvedValue(respuesta({ items, total, pagina: 1, por_pagina: 10 }));
    await montar();
    await alternar(MAT);
    await guardar();
    await act(async () => document.getElementById(`materia-${MAT}-bloqueo`)!.querySelector("button")!.click());
  }
  const dialogo = () => document.querySelector('[role="dialog"]') as HTMLElement;

  it("muestra el mensaje con N y la lista con fecha, hora, aula, cupo, estado y link en pestaña nueva", async () => {
    await abrirModal(3);
    expect(fetchAutenticado).toHaveBeenCalledWith(
      `/api/profesores/${PROFESOR.id}/materias/${MAT}/turnos-futuros?pagina=1`,
      { cache: "no-store" },
    );
    const texto = dialogo().textContent!;
    expect(texto).toContain("El profesor tiene 3 turnos futuros de esta materia. Cancelá o resolvé estos turnos y volvé a intentar.");
    expect(texto).toContain("06/10/2026");
    expect(texto).toContain("08:00–10:00");
    expect(texto).toContain("Aula 1");
    expect(texto).toContain("3/5");
    expect(texto).toContain("Disponible");
    expect(texto).toContain("Completo");
    const link = dialogo().querySelector('a[href="/turnos/turno-0"]') as HTMLAnchorElement;
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
    expect(dialogo().querySelector('nav[aria-label="Paginación"]')).toBeNull(); // una sola página
  });

  it("pagina de a 10 y pide la página siguiente", async () => {
    await abrirModal(12);
    expect(dialogo().textContent).toContain("Mostrando 1–10 de 12");
    fetchAutenticado.mockResolvedValue(respuesta({ items: [turno(10), turno(11)], total: 12, pagina: 2, por_pagina: 10 }));
    await act(async () => (dialogo().querySelector('button[aria-label="Página 2"]') as HTMLButtonElement).click());
    expect(fetchAutenticado).toHaveBeenLastCalledWith(
      `/api/profesores/${PROFESOR.id}/materias/${MAT}/turnos-futuros?pagina=2`,
      { cache: "no-store" },
    );
    expect(dialogo().textContent).toContain("Mostrando 11–12 de 12");
  });

  it("error de carga con «Reintentar»; «Entendido» cierra sin modificar nada", async () => {
    actualizarMateriasProfesor.mockResolvedValue({
      data: null, error: { code: "MATERIA_CON_TURNOS_FUTUROS", message: "x", detalle: [{ materia_id: MAT, cantidad: 1 }] },
    });
    fetchAutenticado.mockResolvedValue({ ok: false, status: 500, json: async () => ({ data: null, error: {} }) });
    await montar();
    await alternar(MAT);
    await guardar();
    await act(async () => document.getElementById(`materia-${MAT}-bloqueo`)!.querySelector("button")!.click());
    expect(dialogo().textContent).toContain("No se pudieron cargar los turnos.");
    await act(async () => boton("Entendido").click());
    expect(actualizarMateriasProfesor).toHaveBeenCalledOnce();
  });
});
