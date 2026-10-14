// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MisPagoItem, MisPagosData } from "@/types/pago.types";

// HU-I-05 «Mis pagos»: filtros, total, paginación, vacíos, carga/error,
// respuestas viejas, enlace al comprobante y ausencia de acciones de escritura.
// La API (fetchAutenticado) y la URL inicial (useSearchParams) están simuladas.

const m = vi.hoisted(() => ({ fetch: vi.fn(), params: new URLSearchParams(), exigir: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetch }));
vi.mock("next/navigation", () => ({ useSearchParams: () => m.params, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/server/shared/with-permission", () => ({ exigirPermiso: m.exigir }));
const { MisPagos } = await import("./mis-pagos");
const { default: MisPagosPage } = await import("./page");

const item = (n: number, extra: Partial<MisPagoItem> = {}): MisPagoItem => ({
  pago_id: `pago-${n}`, fecha_pago: "2026-10-06",
  clase: { fecha: "2026-10-13", hora_inicio: "16:00", materia: { id: "m-fis", nombre: "Física I" } },
  monto: "12000.00", forma_pago: { id: "f1", nombre: "Mercado Pago" }, anulado: false,
  comprobante: { id: `comp-${n}`, numero: `0001-0000243${n % 10}` }, ...extra,
});
const datos = (items: MisPagoItem[], extra: Partial<MisPagosData["paginacion"]> = {}, total = "253800.00"): MisPagosData => ({
  total_pagado: total, items,
  paginacion: { total: items.length, pagina_actual: 1, total_paginas: items.length ? 1 : 0, por_pagina: 10, ...extra },
});
const ok = (data: unknown) => ({ ok: true, json: async () => ({ data, error: null }) });
const OPCIONES = { materias: [{ id: "m-fis", nombre: "Física I" }, { id: "m-mat", nombre: "Matemática II" }] };

let root: Root;
let contenedor: HTMLDivElement;
let listado: (url: string) => unknown;
const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 15)); });
const montar = async () => { await act(async () => root.render(<MisPagos />)); await esperar(); };
const consultas = () => m.fetch.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith("/api/mis-pagos") && !u.includes("opciones"));
const cambiarValor = async (el: HTMLInputElement | HTMLSelectElement, valor: string) => {
  await act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, valor);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
  await esperar();
};
const campo = (etiqueta: string) => [...contenedor.querySelectorAll("label")].find((l) => l.querySelector("span")?.textContent === etiqueta)!
  .querySelector("input, select") as HTMLInputElement | HTMLSelectElement;
const boton = (texto: string) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent === texto);

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  root = createRoot(contenedor);
  m.params = new URLSearchParams();
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  m.fetch.mockReset();
  listado = () => datos([item(1)]);
  m.fetch.mockImplementation((url: string) => Promise.resolve(ok(url.includes("/opciones") ? OPCIONES : listado(url))));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  contenedor.remove();
});

describe("HU-I-05 página", () => {
  it("exige pagos:leer_propios en el servidor antes de renderizar", async () => {
    m.exigir.mockResolvedValue({ id: "u", rol: "ALUMNO" });
    await MisPagosPage();
    expect(m.exigir).toHaveBeenCalledWith("pagos:leer_propios");
  });
});

describe("HU-I-05 Mis pagos", () => {
  it("título, leyenda, columnas, total del resultado, fila con datos y enlace por pago_id; sin acciones de escritura", async () => {
    listado = () => datos([item(1), item(2, { anulado: true, monto: "11000.50", comprobante: { id: "comp-9", numero: "0001-00002376" } })], {}, "12000.00");
    await montar();
    const texto = contenedor.textContent!;
    expect(contenedor.querySelector("h1")!.textContent).toBe("Mis pagos");
    expect(texto).toContain("Los pagos que tenés registrados en el centro. Los anulados no suman al total.");
    expect([...contenedor.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Fecha de pago", "Clase", "Monto", "Forma de pago", "Comprobante"]);
    expect(texto).toContain("Total pagado del período: $ 12.000");
    const filas = contenedor.querySelectorAll("tbody tr");
    expect(filas[0]!.textContent).toBe("06/10/2026Física I Mar 13/10$ 12.000Mercado Pago0001-00002431");
    expect(filas[1]!.getAttribute("data-anulado")).toBe("true");
    expect(filas[1]!.textContent).toContain("Anulado");
    expect(filas[1]!.querySelector(".line-through")!.textContent).toBe("$ 11.000,50");
    const enlaces = [...contenedor.querySelectorAll("tbody a")].map((a) => [a.getAttribute("href"), a.getAttribute("aria-label")]);
    expect(enlaces).toEqual([
      ["/mis-pagos/pago-1/comprobante", "Ver comprobante 0001-00002431"],
      ["/mis-pagos/pago-2/comprobante", "Ver comprobante 0001-00002376"],
    ]);
    expect(texto).not.toMatch(/Registrar|Corregir|Anular pago|Ver detalle|Registrado por|Estado de pago/);
    expect(consultas()).toEqual(["/api/mis-pagos"]);
  });

  it("comprobante null se muestra «—» sin enlace (defensa)", async () => {
    listado = () => datos([item(1, { comprobante: null })]);
    await montar();
    expect(contenedor.querySelector("tbody a")).toBeNull();
    expect(contenedor.querySelector("tbody tr")!.lastElementChild!.textContent).toBe("—");
  });

  it("vacío sin filtros: «Todavía no tenés pagos registrados»; con filtros: el vacío de filtros", async () => {
    listado = () => datos([], {}, "0.00");
    await montar();
    expect(contenedor.textContent).toContain("Todavía no tenés pagos registrados");
    expect(contenedor.querySelector("nav")).toBeNull();
    await cambiarValor(campo("Materia"), "m-mat");
    expect(contenedor.textContent).toContain("No hay pagos para los filtros elegidos");
    expect(contenedor.textContent).not.toContain("Todavía no tenés pagos registrados");
  });

  it("cada filtro vuelve a la página 1, se combinan, actualiza la URL y «Limpiar filtros» restablece la consulta completa", async () => {
    m.params = new URLSearchParams("pagina=3");
    listado = (url) => datos(Array.from({ length: 10 }, (_, i) => item(i)), { total: 30, total_paginas: 3, pagina_actual: url.includes("pagina=3") ? 3 : 1 });
    await montar();
    expect(consultas()).toEqual(["/api/mis-pagos?pagina=3"]);
    await cambiarValor(campo("Desde"), "2026-10-01");
    await cambiarValor(campo("Hasta"), "2026-10-31");
    await cambiarValor(campo("Materia"), "m-fis");
    expect(consultas().slice(1)).toEqual([
      "/api/mis-pagos?desde=2026-10-01",
      "/api/mis-pagos?desde=2026-10-01&hasta=2026-10-31",
      "/api/mis-pagos?desde=2026-10-01&hasta=2026-10-31&materia_id=m-fis",
    ]);
    expect(window.history.replaceState).toHaveBeenLastCalledWith(window.history.state, "", "/?desde=2026-10-01&hasta=2026-10-31&materia_id=m-fis");
    await act(async () => boton("Limpiar filtros")!.click());
    await esperar();
    expect(consultas().at(-1)).toBe("/api/mis-pagos");
    expect(boton("Limpiar filtros")).toBeUndefined();
  });

  it("paginación: rango, Siguiente pide la página 2 conservando filtros; una sola página oculta el control", async () => {
    m.params = new URLSearchParams("materia_id=m-fis");
    listado = (url) => datos(Array.from({ length: url.includes("pagina=2") ? 1 : 10 }, (_, i) => item(i)),
      { total: 11, total_paginas: 2, pagina_actual: url.includes("pagina=2") ? 2 : 1 });
    await montar();
    expect(contenedor.textContent).toContain("Mostrando 1–10 de 11");
    await act(async () => boton("Siguiente")!.click());
    await esperar();
    expect(consultas().at(-1)).toBe("/api/mis-pagos?materia_id=m-fis&pagina=2");
    expect(contenedor.textContent).toContain("Mostrando 11–11 de 11");
    listado = () => datos([item(1)]);
    await cambiarValor(campo("Materia"), "m-mat");
    expect(contenedor.querySelector("nav")).toBeNull();
  });

  it("página fuera de rango: pide la última que informa el servidor", async () => {
    m.params = new URLSearchParams("pagina=9");
    listado = (url) => datos([item(1)], { total: 11, total_paginas: 2, pagina_actual: 2, ...(url.includes("pagina=2") ? {} : {}) });
    await montar();
    expect(consultas()).toEqual(["/api/mis-pagos?pagina=9", "/api/mis-pagos?pagina=2"]);
  });

  it("URL inicial normalizada: fecha inválida, rango invertido, página inválida y parámetros desconocidos se descartan", async () => {
    m.params = new URLSearchParams("desde=2026-02-31&hasta=2026-10-01&pagina=-4&alumno_id=otro&forma_pago_id=f1");
    await montar();
    expect(consultas()).toEqual(["/api/mis-pagos?hasta=2026-10-01"]);
    await act(async () => root.unmount());
    root = createRoot(contenedor);
    m.fetch.mockClear();
    m.params = new URLSearchParams("desde=2026-10-20&hasta=2026-10-01");
    await montar();
    expect(consultas()).toEqual(["/api/mis-pagos"]);
  });

  it("materia de la URL que no es propia se descarta al cargar las opciones", async () => {
    m.params = new URLSearchParams("materia_id=materia-de-otro");
    await montar();
    expect(consultas()).toEqual(["/api/mis-pagos?materia_id=materia-de-otro", "/api/mis-pagos"]);
    expect((campo("Materia") as HTMLSelectElement).value).toBe("");
  });

  it("rango invertido elegido en pantalla: aviso y no consulta", async () => {
    await montar();
    await cambiarValor(campo("Hasta"), "2026-10-01");
    const antes = consultas().length;
    await cambiarValor(campo("Desde"), "2026-10-05");
    expect(contenedor.textContent).toContain("«Desde» no puede ser posterior a «Hasta».");
    expect(consultas().length).toBe(antes);
    expect(contenedor.querySelector("table")).toBeNull();
  });

  it("carga visible; error inline (nunca como lista vacía) con el mensaje del servidor y Reintentar", async () => {
    let liberar!: () => void;
    m.fetch.mockImplementation((url: string) => url.includes("/opciones") ? Promise.resolve(ok(OPCIONES))
      : new Promise((r) => { liberar = () => r(ok(datos([item(1)]))); }));
    await act(async () => root.render(<MisPagos />));
    expect(contenedor.querySelector('[role="status"]')!.textContent).toBe("Cargando tus pagos…");
    await act(async () => liberar());
    await esperar();
    expect(contenedor.querySelector("table")).not.toBeNull();
    m.fetch.mockImplementation((url: string) => Promise.resolve(url.includes("/opciones") ? ok(OPCIONES)
      : { ok: false, json: async () => ({ data: null, error: { code: "ALUMNO_NO_ENCONTRADO", message: "No se encontró el alumno." } }) }));
    await cambiarValor(campo("Materia"), "m-mat");
    const alerta = contenedor.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain("No se encontró el alumno.");
    expect(contenedor.textContent).not.toContain("Todavía no tenés pagos registrados");
    expect(contenedor.textContent).not.toContain("No hay pagos para los filtros elegidos");
    m.fetch.mockImplementation((url: string) => Promise.resolve(ok(url.includes("/opciones") ? OPCIONES : datos([item(3)]))));
    await act(async () => boton("Reintentar")!.click());
    await esperar();
    expect(contenedor.querySelector("tbody tr")!.textContent).toContain("0001-00002433");
  });

  it("error de la respuesta sin cuerpo muestra el texto genérico", async () => {
    m.fetch.mockImplementation((url: string) => Promise.resolve(url.includes("/opciones") ? ok(OPCIONES) : { ok: false, json: async () => { throw new Error("x"); } }));
    await montar();
    expect(contenedor.querySelector('[role="alert"]')!.textContent).toContain("No se pudieron cargar tus pagos.");
  });

  it("error de opciones se distingue del listado y se reintenta", async () => {
    let fallar = true;
    m.fetch.mockImplementation((url: string) => Promise.resolve(url.includes("/opciones")
      ? (fallar ? { ok: false } : ok(OPCIONES)) : ok(datos([item(1)]))));
    await montar();
    expect(contenedor.textContent).toContain("No se pudieron cargar las materias del filtro.");
    expect(contenedor.querySelector("table")).not.toBeNull();
    fallar = false;
    await act(async () => boton("Reintentar")!.click());
    await esperar();
    expect(contenedor.textContent).not.toContain("No se pudieron cargar las materias del filtro.");
    expect([...(campo("Materia") as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["Todas", "Física I", "Matemática II"]);
  });

  it("descarta respuestas viejas: un cambio rápido aborta la consulta anterior", async () => {
    const pendientes: { url: string; signal: AbortSignal; resolver: (v: unknown) => void }[] = [];
    m.fetch.mockImplementation((url: string, init: RequestInit) => url.includes("/opciones") ? Promise.resolve(ok(OPCIONES))
      : new Promise((resolver) => { pendientes.push({ url, signal: init.signal!, resolver }); }));
    await act(async () => root.render(<MisPagos />));
    await cambiarValor(campo("Materia"), "m-fis");
    await cambiarValor(campo("Materia"), "m-mat");
    expect(pendientes.map((p) => p.signal.aborted)).toEqual([true, true, false]);
    await act(async () => { pendientes[1]!.resolver(ok(datos([item(7, { clase: { fecha: "2026-10-13", hora_inicio: "16:00", materia: { id: "m-fis", nombre: "VIEJA" } } })]))); });
    await act(async () => { pendientes[2]!.resolver(ok(datos([item(8, { clase: { fecha: "2026-10-13", hora_inicio: "16:00", materia: { id: "m-mat", nombre: "Matemática II" } } })]))); });
    await esperar();
    expect(contenedor.textContent).not.toContain("VIEJA");
    expect(contenedor.textContent).toContain("Matemática II Mar 13/10");
  });

  it("filtros con etiqueta asociada y cada consulta sin caché compartida", async () => {
    await montar();
    for (const etiqueta of ["Desde", "Hasta", "Materia"]) expect(campo(etiqueta).closest("label")).not.toBeNull();
    expect(m.fetch.mock.calls.every((c) => (c[1] as RequestInit).cache === "no-store")).toBe(true);
  });
});
