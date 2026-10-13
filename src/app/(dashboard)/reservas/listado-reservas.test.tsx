// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListadoReservasPendientes, ListadoReservasVencidas, ReservaPendienteVista, ReservaVencidaVista } from "@/types/reserva.types";

// HU-C-26 (spec_modulo_C.md §2.20): pestañas, filtros combinables con debounce
// de 300 ms, paginación y las acciones «Registrar pago» y «Quitar», con
// `fetchAutenticado`/`fetchOLanzar` mockeados. Misma mecánica que HU-F-03.

const m = vi.hoisted(() => ({ fetchAutenticado: vi.fn(), fetchOLanzar: vi.fn(), refresh: vi.fn(), exito: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetchAutenticado, fetchOLanzar: m.fetchOLanzar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.exito } }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
      delete props.prefetch;
      return React.createElement("a", { href, ...props }, children);
    },
  };
});
vi.mock("@/components/shared/pagination", async () => {
  const React = await import("react");
  return {
    Pagination: ({ total, paginaActual, totalPaginas, buildHref }: { total: number; paginaActual: number; totalPaginas: number; buildHref: (p: number) => string }) =>
      totalPaginas > 1
        ? React.createElement("nav", { "data-paginador": "", "data-total": total, "data-siguiente": buildHref(paginaActual + 1) })
        : null,
  };
});

const { ListadoReservas } = await import("./listado-reservas");
const { ESPERA_BUSQUEDA_MS } = await import("@/components/shared/campo-busqueda");

const MATERIAS = [{ id: "mat-fisica", nombre: "Física I" }, { id: "mat-quimica", nombre: "Química I" }];

function pendiente(i: number, extra: Partial<ReservaPendienteVista> = {}): ReservaPendienteVista {
  return {
    inscripcion_id: `ins-${i}`,
    vence_el: "2026-10-06T22:04:00-03:00",
    faltan_min: 45,
    vence_pronto: true,
    alumno: { id: `alu-${i}`, nombre_para_mostrar: `Acosta, Sofía ${i}`, dni: `4534828${i}`, reservas_pendientes: 3 },
    clase: { turno_id: `clase-${i}`, fecha: "2026-10-20", hora_inicio: "15:00", hora_fin: "16:00", materia: { id: "mat-fisica", nombre: "Física I" }, aula: { id: "a1", nombre: "Aula 1" } },
    profesor: { id: "p1", nombre_para_mostrar: "Ríos, Martín" },
    precio: 12000,
    ...extra,
  };
}

function vencida(i: number, extra: Partial<ReservaVencidaVista> = {}): ReservaVencidaVista {
  return {
    inscripcion_id: `ven-${i}`,
    vencio_el: "2026-10-06T21:16:00-03:00",
    sin_marcar: false,
    alumno: { id: `alu-${i}`, nombre_para_mostrar: `Villalba, Tomás ${i}`, dni: `4646011${i}` },
    clase: { turno_id: `clase-${i}`, fecha: "2026-10-07", hora_inicio: "16:00", hora_fin: "17:00", materia: { id: "mat-prog", nombre: "Programación I" }, aula: { id: "a2", nombre: "Aula 2" } },
    profesor: { id: "p2", nombre_para_mostrar: "Correa, Pablo" },
    precio: 12000,
    ...extra,
  };
}

const paginacion = (total: number) => ({ total, pagina_actual: 1, total_paginas: Math.max(1, Math.ceil(total / 10)), por_pagina: 10 });
const pendientes = (items: ReservaPendienteVista[], total = items.length): ListadoReservasPendientes => ({ items, paginacion: paginacion(total) });
const vencidas = (items: ReservaVencidaVista[], total = items.length): ListadoReservasVencidas => ({ items, paginacion: paginacion(total) });
const respuesta = (datos: unknown) => ({ ok: true, json: async () => ({ data: datos, error: null }) });

let contenedor: HTMLDivElement;
let root: Root;
const replaceState = vi.spyOn(window.history, "replaceState");

type Props = React.ComponentProps<typeof ListadoReservas>;
async function montar(props: Partial<Props> = {}) {
  await act(async () => {
    root.render(<ListadoReservas
      listado={props.listado ?? { tab: "pendientes", datos: pendientes([pendiente(0), pendiente(1, { faltan_min: 240, vence_pronto: false, alumno: { id: "alu-1", nombre_para_mostrar: "Navarro, Thiago", dni: "43560711", reservas_pendientes: 1 } })], 23) }}
      filtrosIniciales={props.filtrosIniciales ?? {}}
      materias={props.materias ?? MATERIAS}
    />);
  });
}

async function escribir(valor: string) {
  const input = contenedor.querySelector("input")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function elegir(indice: number, valor: string) {
  const select = contenedor.querySelectorAll("select")[indice]!;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(select, valor);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function esperar(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

const filas = () => [...contenedor.querySelectorAll("tbody tr")];
const boton = (texto: string, raiz: ParentNode = contenedor) =>
  [...raiz.querySelectorAll("button")].find((b) => b.textContent === texto) as HTMLButtonElement | undefined;
const urlConsultada = () => String(m.fetchAutenticado.mock.calls.at(-1)?.[0]);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  replaceState.mockImplementation(() => {});
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
  vi.useRealTimers();
});

describe("HU-C-26 pestaña «Pendientes» (criterio 2)", () => {
  it("columnas, vencimiento con cuánto falta (en rojo si vence pronto), alumno, clase con enlace, profesor y precio", async () => {
    await montar();
    expect([...contenedor.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Vence", "Alumno", "Clase", "Profesor", "Precio", "Acciones"]);
    const [primera, segunda] = filas() as [HTMLElement, HTMLElement];
    expect(primera.textContent).toContain("Mar 06/10 22:04");
    expect(primera.textContent).toContain("en 45 min");
    expect(primera.querySelector(".text-destructive")?.textContent).toContain("Vence pronto");
    expect(primera.textContent).toContain("Sofía 0 Acosta");
    expect(primera.textContent).toContain("DNI 45348280 · 3 reservas pendientes");
    expect(primera.querySelector('a[href="/turnos/clase-0"]')?.textContent).toBe("Mar 20/10 15:00–16:00");
    expect(primera.textContent).toContain("Física I · Aula 1");
    expect(primera.textContent).toContain("Martín Ríos");
    expect(primera.textContent).toContain("$ 12.000");
    // Más de 3 horas: sin rojo, en singular.
    expect(segunda.textContent).toContain("en 4 h");
    expect(segunda.querySelector(".text-destructive")).toBeNull();
    expect(segunda.textContent).toContain("1 reserva pendiente");
  });

  it("«Registrar pago» navega a HU-I-10 con el alumno y la clase de la fila (criterio 5)", async () => {
    await montar();
    const enlace = filas()[0]!.querySelector('a[href^="/pagos/registrar"]');
    expect(enlace?.getAttribute("href")).toBe("/pagos/registrar?alumno=alu-0&clase=clase-0");
    expect(enlace?.textContent).toBe("Registrar pago");
  });

  it("pagina de a 10 conservando los filtros", async () => {
    await montar({ filtrosIniciales: { materiaId: "mat-fisica", vencen: "hoy" } });
    expect(contenedor.querySelector("[data-paginador]")?.getAttribute("data-siguiente")).toBe("/reservas?materia_id=mat-fisica&vencen=hoy&pagina=2");
  });

  it("pie de la tabla vacío sin filtros", async () => {
    await montar({ listado: { tab: "pendientes", datos: pendientes([]) } });
    expect(contenedor.textContent).toContain("No hay reservas pendientes.");
    expect(contenedor.querySelector("table")).toBeNull();
  });
});

describe("HU-C-26 filtros (criterio 4)", () => {
  it("el alumno se busca con debounce de 300 ms y no con 1 carácter", async () => {
    m.fetchAutenticado.mockResolvedValue(respuesta(pendientes([pendiente(5)])));
    await montar();
    await escribir("R");
    await esperar(ESPERA_BUSQUEDA_MS * 2);
    expect(m.fetchAutenticado).not.toHaveBeenCalled();
    await escribir("Ru");
    await esperar(ESPERA_BUSQUEDA_MS - 1);
    expect(m.fetchAutenticado).not.toHaveBeenCalled();
    await esperar(1);
    expect(m.fetchAutenticado).toHaveBeenCalledOnce();
    expect(urlConsultada()).toBe("/api/reservas/pendientes?pagina=1&alumno=Ru");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/reservas?alumno=Ru");
    expect(filas()).toHaveLength(1);
  });

  it("combina alumno, materia y vencen en una sola consulta, en la página 1", async () => {
    m.fetchAutenticado.mockResolvedValue(respuesta(pendientes([pendiente(5)])));
    await montar();
    await escribir("Acosta");
    await elegir(0, "mat-fisica");
    await elegir(1, "en_3_horas");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(m.fetchAutenticado).toHaveBeenCalledOnce();
    expect(urlConsultada()).toBe("/api/reservas/pendientes?pagina=1&alumno=Acosta&materia_id=mat-fisica&vencen=en_3_horas");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/reservas?alumno=Acosta&materia_id=mat-fisica&vencen=en_3_horas");
  });

  it("«Limpiar filtros» vuelve al listado completo", async () => {
    m.fetchAutenticado.mockResolvedValue(respuesta(pendientes([pendiente(0), pendiente(1), pendiente(2)])));
    await montar({ listado: { tab: "pendientes", datos: pendientes([]) }, filtrosIniciales: { alumno: "Zz", materiaId: "mat-quimica", vencen: "manana" } });
    expect(contenedor.textContent).toContain("No se encontraron reservas con los filtros aplicados.");
    await act(async () => boton("Limpiar filtros")!.click());
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(urlConsultada()).toBe("/api/reservas/pendientes?pagina=1");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/reservas");
    expect(filas()).toHaveLength(3);
    expect(boton("Limpiar filtros")).toBeUndefined();
  });

  it("sin resultados para un alumno muestra el texto buscado", async () => {
    m.fetchAutenticado.mockResolvedValue(respuesta(pendientes([])));
    await montar();
    await escribir("Inexistente");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(contenedor.textContent).toContain("No se encontraron reservas para «Inexistente».");
  });

  it("si la consulta falla, aviso inline con «Reintentar»", async () => {
    m.fetchAutenticado.mockResolvedValueOnce({ ok: false, json: async () => ({ data: null, error: { code: "X" } }) })
      .mockResolvedValueOnce(respuesta(pendientes([pendiente(7)])));
    await montar();
    await escribir("Acosta");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain("No se pudieron cargar las reservas.");
    await act(async () => boton("Reintentar")!.click());
    expect(filas()).toHaveLength(1);
  });
});

describe("HU-C-26 pestañas (criterios 2 y 3)", () => {
  it("las pestañas son enlaces que vuelven a la página 1 sin filtros", async () => {
    await montar({ filtrosIniciales: { alumno: "Acosta", vencen: "hoy" } });
    const enlaces = [...contenedor.querySelectorAll("nav a")];
    expect(enlaces.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("aria-current")])).toEqual([
      ["Pendientes", "/reservas", "page"],
      ["Vencidas · últimos 7 días", "/reservas?tab=vencidas", null],
    ]);
  });

  it("al cambiar de pestaña adopta los datos del servidor y resetea los filtros, sin «Vencen»", async () => {
    await montar({ filtrosIniciales: { alumno: "Acosta", vencen: "hoy" } });
    expect(contenedor.querySelectorAll("select")).toHaveLength(2);
    await montar({ listado: { tab: "vencidas", datos: vencidas([vencida(0), vencida(1, { sin_marcar: true })]) }, filtrosIniciales: {} });
    expect(contenedor.querySelector("input")!.value).toBe("");
    expect(contenedor.querySelectorAll("select")).toHaveLength(1);
    expect(m.fetchAutenticado).not.toHaveBeenCalled();
    expect([...contenedor.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Venció", "Alumno", "Clase", "Profesor", "Estado"]);
    const [marcada, sinMarcar] = filas() as [HTMLElement, HTMLElement];
    expect(marcada.textContent).toContain("Mar 06/10 21:16");
    expect(marcada.textContent).toContain("Programación I · Aula 2");
    expect(marcada.textContent).toContain("Pablo Correa");
    expect(marcada.textContent).toContain("Reserva vencida");
    expect(sinMarcar.textContent).toContain("Vencida · sin marcar todavía");
    // Solo consulta: sin acciones.
    expect(contenedor.querySelector('a[href^="/pagos/registrar"]')).toBeNull();
    expect(boton("Quitar")).toBeUndefined();
  });

  it("los filtros de Vencidas consultan su propio endpoint, sin `vencen`", async () => {
    m.fetchAutenticado.mockResolvedValue(respuesta(vencidas([vencida(3)])));
    await montar({ listado: { tab: "vencidas", datos: vencidas([vencida(0)]) } });
    await elegir(0, "mat-quimica");
    await esperar(ESPERA_BUSQUEDA_MS);
    expect(urlConsultada()).toBe("/api/reservas/vencidas?pagina=1&materia_id=mat-quimica");
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/reservas?tab=vencidas&materia_id=mat-quimica");
  });
});

describe("HU-C-26 «Quitar» (criterio 6)", () => {
  const dialogo = () => document.querySelector('[role="alertdialog"]');

  beforeEach(() => { vi.useRealTimers(); });

  it("abre la confirmación de HU-C-25 con los datos de la fila y el párrafo de la foto", async () => {
    await montar();
    await act(async () => boton("Quitar")!.click());
    expect(dialogo()?.textContent).toContain("¿Estás seguro de que querés quitar a Sofía 0 Acosta de Física I del Mar 20/10 a las 15:00?");
    expect(dialogo()?.textContent).toContain("La reserva no está pagada. La inscripción no se borra: queda como «Quitada por el centro» y se libera su lugar.");
    expect(dialogo()?.textContent).toContain("Esta acción no se puede deshacer.");
    expect(boton("Volver", dialogo()!)).toBeDefined();
  });

  it("al confirmar quita esa inscripción, informa con toast y refresca", async () => {
    m.fetchOLanzar.mockResolvedValue({ inscripcion_id: "ins-0" });
    await montar();
    await act(async () => boton("Quitar")!.click());
    await act(async () => boton("Quitar de la clase", dialogo()!)!.click());
    expect(m.fetchOLanzar).toHaveBeenCalledExactlyOnceWith("/api/reservas/ins-0/quitar", { method: "POST", cache: "no-store" });
    expect(m.exito).toHaveBeenCalledWith("Reserva quitada");
    expect(m.refresh).toHaveBeenCalled();
  });

  it("RESERVA_NO_PENDIENTE: mensaje dentro del diálogo, sin cerrarlo ni quitar la fila; al cerrar, refresca", async () => {
    m.fetchOLanzar.mockRejectedValue(new Error("Esta reserva ya no está pendiente: se pagó o venció."));
    await montar();
    await act(async () => boton("Quitar")!.click());
    await act(async () => boton("Quitar de la clase", dialogo()!)!.click());
    expect(dialogo()?.querySelector('[role="alert"]')?.textContent).toBe("Esta reserva ya no está pendiente: se pagó o venció.");
    expect(m.exito).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
    expect(filas()).toHaveLength(2);
    await act(async () => boton("Volver", dialogo()!)!.click());
    expect(m.refresh).toHaveBeenCalledOnce();
  });
});
