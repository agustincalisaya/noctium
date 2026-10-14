// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: m.fetch }));
const { HistorialPagos } = await import("./historial-pagos");
let root: Root;
let contenedor: HTMLDivElement;
const vacio = (modo: "HISTORIAL" | "ESTADO_DE_PAGO" = "HISTORIAL") => ({
  modo, ...(modo === "HISTORIAL" ? { total_pagado: "0.00" } : {}),
  items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 },
});
const ok = (data: unknown) => ({ ok: true, json: async () => ({ data, error: null }) });
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); });
const elegir = async (selector: string | number, valor: string) => {
  const select = typeof selector === "number" ? contenedor.querySelectorAll<HTMLSelectElement>("select")[selector]! : contenedor.querySelector<HTMLSelectElement>(selector)!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(select, valor);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await esperar();
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  root = createRoot(contenedor);
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  m.fetch.mockReset();
  m.fetch.mockImplementation((url: string) => Promise.resolve(ok(url.includes("/opciones?")
    ? { formas_pago: [{ id: "f1", nombre: "Efectivo", is_active: false }], materias: [{ id: "m1", nombre: "Álgebra" }] }
    : vacio(url.includes("estado_pago") ? "ESTADO_DE_PAGO" : "HISTORIAL"))));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  contenedor.remove();
});

describe("HU-I-02 pestaña Pagos", () => {
  it("muestra el vacío literal, total y reintenta un error", async () => {
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago iniciales={{}} />));
    await esperar();
    expect(contenedor.textContent).toContain("Este alumno no tiene pagos registrados");
    expect(contenedor.textContent).toContain("Total pagado");
    m.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false }));
    await elegir(0, "f1");
    await esperar();
    expect(contenedor.textContent).toContain("No se pudo cargar el historial de pagos");
    await act(async () => Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent === "Reintentar")!.click());
    await esperar();
    expect(contenedor.textContent).toContain("No hay pagos para los filtros elegidos");
  });
  it("estado limpia y deshabilita forma/materia, cambia etiquetas y vuelve a página 1", async () => {
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago iniciales={{ pagina: "3" }} />));
    await esperar();
    await elegir('select', "f1");
    const selects = contenedor.querySelectorAll("select");
    expect(selects[0]!.value).toBe("f1");
    await elegir(2, "RESERVADA");
    const ultimos = contenedor.querySelectorAll("select");
    expect(ultimos[0]!.disabled).toBe(true);
    expect(ultimos[1]!.disabled).toBe(true);
    expect(ultimos[0]!.value).toBe("");
    expect(contenedor.textContent).toContain("Clase desde");
    const consultas = m.fetch.mock.calls.map((c) => String(c[0])).filter((url) => url.includes("/api/pagos/historial?"));
    expect(consultas.at(-1)).toContain("estado_pago=RESERVADA");
    expect(consultas.at(-1)).not.toContain("forma_pago_id");
    expect(consultas.at(-1)).not.toContain("pagina=");
    await elegir(2, "");
    expect(contenedor.querySelectorAll("select")[0]!.value).toBe("");
    expect(contenedor.textContent).toContain("Pago desde");
  });
  it("presenta comprobante y atajo solo con permiso", async () => {
    m.fetch.mockImplementation((url: string) => Promise.resolve(ok(url.includes("/opciones?") ? { formas_pago: [], materias: [] } : {
      modo: "ESTADO_DE_PAGO",
      items: [{ inscripcion_id: "i1", turno_id: "t1", fecha: "2026-10-14", hora_inicio: "16:00",
        materia: { id: "m1", nombre: "Álgebra" }, profesor: null, precio: 100,
        estado_pago: "RESERVADA", vence_el: "2026-10-14T14:00:00-03:00", puede_registrar_pago: true }],
      paginacion: { total: 1, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
    })));
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago={false} iniciales={{ estado_pago: "RESERVADA" }} />));
    await esperar();
    expect(contenedor.textContent).toContain("pagar antes del");
    expect(contenedor.querySelector('a[href="/pagos/registrar?alumno=a&clase=t1"]')).toBeNull();
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago iniciales={{ estado_pago: "RESERVADA" }} />));
    expect(contenedor.querySelector('a[href="/pagos/registrar?alumno=a&clase=t1"]')).not.toBeNull();
  });

  it("descarta una respuesta anterior después de cambiar filtro", async () => {
    let resolverVieja!: (response: ReturnType<typeof ok>) => void;
    m.fetch.mockImplementation((url: string) => {
      if (url.includes("/opciones?")) return Promise.resolve(ok({ formas_pago: [{ id: "f1", nombre: "Efectivo", is_active: true }], materias: [] }));
      if (url.includes("forma_pago_id=f1")) return Promise.resolve(ok({ ...vacio(), total_pagado: "123.45" }));
      return new Promise((resolve) => { resolverVieja = resolve; });
    });
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago iniciales={{}} />));
    await esperar();
    await elegir(0, "f1");
    expect(contenedor.textContent).toContain("$ 123,45");
    await act(async () => resolverVieja(ok({ ...vacio(), total_pagado: "999.99" })));
    await esperar();
    expect(contenedor.textContent).not.toContain("$ 999,99");
  });
  it("informa error de opciones y permite reintento", async () => {
    m.fetch.mockImplementationOnce(() => Promise.resolve({ ok: false }));
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago iniciales={{}} />));
    await esperar();
    expect(contenedor.textContent).toContain("No se pudieron cargar las opciones de filtros.");
    await act(async () => Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent === "Reintentar")!.click());
    await esperar();
    expect(contenedor.textContent).not.toContain("No se pudieron cargar las opciones de filtros.");
    expect(contenedor.querySelectorAll("select")[0]!.options.length).toBe(2);
  });
  it("enlaza clase y comprobante vigente, etiqueta anulado", async () => {
    const fila = {
      pago_id: "p1", fecha_pago: "2026-10-12", registrado_en: "2026-10-12T13:00:00Z",
      clase: { turno_id: "t1", fecha: "2026-10-14", hora_inicio: "16:00", materia: { id: "m1", nombre: "Álgebra" } },
      precio: 100, monto: "90.00", monto_original: null,
      forma_pago: { id: "f1", nombre: "Efectivo", is_active: false },
      registrado_por: { usuario_id: "u1", nombre_completo: "Pérez, Ana" },
      ajuste: { motivo: "Beca", ajustado_por: { usuario_id: "u1", nombre_completo: "Pérez, Ana" } },
      anulado: true, comprobante: { id: "c1", numero: "0001-00000001" },
      operacion: { id: "o1", clases: 0 }, cambios: 1, puede_corregir: false,
    };
    m.fetch.mockImplementation((url: string) => Promise.resolve(ok(url.includes("/opciones?")
      ? { formas_pago: [], materias: [] }
      : { modo: "HISTORIAL", total_pagado: "0.00", items: [fila],
        paginacion: { total: 1, pagina_actual: 1, total_paginas: 1, por_pagina: 10 } })));
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago iniciales={{}} />));
    await esperar();
    expect(contenedor.querySelector('a[href="/turnos/t1"]')).not.toBeNull();
    expect(contenedor.querySelector('a[href="/comprobantes/c1"]')).not.toBeNull();
    expect(contenedor.textContent).toContain("Anulado");
    expect(contenedor.textContent).toContain("Beca");
  });
});

describe("HU-I-06 acciones del historial de pagos", () => {
  const item = (extra: Record<string, unknown>) => ({
    pago_id: "p1", fecha_pago: "2026-10-08", registrado_en: "2026-10-08T10:00:00-03:00",
    clase: { turno_id: "t1", fecha: "2026-10-08", hora_inicio: "16:00", materia: { id: "m1", nombre: "Física I" } },
    precio: 12000, monto: "12000.00", monto_original: null, forma_pago: { id: "f1", nombre: "Efectivo", is_active: true },
    registrado_por: { usuario_id: "u1", nombre_completo: "Ferreyra, Julián" }, ajuste: null, anulado: false,
    comprobante: { id: "c1", numero: "0001-00002495" }, operacion: { id: "op1", clases: 2 }, cambios: 0, puede_corregir: true,
    ...extra,
  });

  it("columna «Acciones»: Corregir y Anular según puede_corregir, Ver detalle siempre; tras anular recarga el historial", async () => {
    let consultas = 0;
    m.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/opciones?")) return Promise.resolve(ok({ formas_pago: [], materias: [] }));
      if (init?.method === "POST") return Promise.resolve(ok({}));
      consultas += 1;
      return Promise.resolve(ok({
        modo: "HISTORIAL", total_pagado: "12000.00",
        items: [item({}), item({ pago_id: "p2", anulado: true, puede_corregir: false })],
        paginacion: { total: 2, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
      }));
    });
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago iniciales={{}} />));
    await esperar();
    expect([...contenedor.querySelectorAll("thead th")].map((th) => th.textContent)).toContain("Acciones");
    const filas = [...contenedor.querySelectorAll("tbody tr")];
    expect([...filas[0]!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Corregir", "Anular", "Ver detalle"]);
    expect([...filas[1]!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Ver detalle"]);

    await act(async () => [...filas[0]!.querySelectorAll("button")].find((b) => b.textContent === "Anular")!.click());
    const confirmacion = document.querySelector('[role="alertdialog"]')!;
    expect(confirmacion.textContent).toContain("¿Estás seguro de que querés anular el pago de $ 12.000 de Sofía Acosta (Física I del Jue 08/10)?");
    await act(async () => [...confirmacion.querySelectorAll("button")].find((b) => b.textContent === "Usar el motivo «Reintegro»")!.click());
    const antes = consultas;
    await act(async () => [...confirmacion.querySelectorAll("button")].find((b) => b.textContent === "Anular pago")!.click());
    await esperar();
    expect(m.fetch).toHaveBeenCalledWith("/api/pagos/p1/anulacion", expect.objectContaining({ method: "POST", body: JSON.stringify({ motivo: "Reintegro" }) }));
    expect(consultas).toBe(antes + 1);
  });

  it("Gerente en modo consulta (HU-E-02 criterio 8): sin «Registrar pago», pero corrige y anula según puede_corregir", async () => {
    let consultas = 0;
    m.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/opciones?")) return Promise.resolve(ok({ formas_pago: [{ id: "f1", nombre: "Efectivo", is_active: true }], materias: [] }));
      if (url === "/api/formas-pago/opciones") return Promise.resolve(ok([{ id: "f1", nombre: "Efectivo" }]));
      if (init?.method === "POST") return Promise.resolve(ok({}));
      consultas += 1;
      return Promise.resolve(ok({
        modo: "HISTORIAL", total_pagado: "12000.00",
        items: [item({}), item({ pago_id: "p2", anulado: true, puede_corregir: false })],
        paginacion: { total: 2, pagina_actual: 1, total_paginas: 1, por_pagina: 10 },
      }));
    });
    await act(async () => root.render(<HistorialPagos alumnoId="a" alumnoNombre="Sofía Acosta" puedeRegistrarPago={false} iniciales={{}} />));
    await esperar();
    expect(contenedor.querySelector('a[href^="/pagos/registrar"]')).toBeNull();
    const filas = () => [...contenedor.querySelectorAll("tbody tr")];
    expect([...filas()[0]!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Corregir", "Anular", "Ver detalle"]);
    expect([...filas()[1]!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Ver detalle"]);

    // Corregir el monto.
    await act(async () => [...filas()[0]!.querySelectorAll("button")].find((b) => b.textContent === "Corregir")!.click());
    const cambiar = async (selector: string, valor: string) => {
      const campo = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
      const prototipo = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototipo, "value")!.set!.call(campo, valor);
      await act(async () => { campo.dispatchEvent(new Event("input", { bubbles: true })); });
    };
    await cambiar("#pago-p1-monto", "11000");
    await cambiar("#pago-p1-motivo", "Se cargó mal");
    await act(async () => {
      document.querySelector('[role="dialog"]')!.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const confirmar = document.querySelector('[role="alertdialog"]')!;
    expect(confirmar.textContent).toContain("Monto: $ 12.000 → $ 11.000");
    await act(async () => [...confirmar.querySelectorAll("button")].find((b) => b.textContent === "Corregir pago")!.click());
    await esperar();
    const correccion = m.fetch.mock.calls.find(([url]) => url === "/api/pagos/p1/correccion");
    expect(correccion?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(correccion![1].body)).toEqual({ monto: "11000", motivo: "Se cargó mal" });

    // Anular.
    const antes = consultas;
    await act(async () => [...filas()[0]!.querySelectorAll("button")].find((b) => b.textContent === "Anular")!.click());
    const confirmacion = document.querySelector('[role="alertdialog"]')!;
    await act(async () => [...confirmacion.querySelectorAll("button")].find((b) => b.textContent === "Usar el motivo «Reintegro»")!.click());
    await act(async () => [...confirmacion.querySelectorAll("button")].find((b) => b.textContent === "Anular pago")!.click());
    await esperar();
    expect(m.fetch).toHaveBeenCalledWith("/api/pagos/p1/anulacion", expect.objectContaining({ method: "POST", body: JSON.stringify({ motivo: "Reintegro" }) }));
    expect(consultas).toBe(antes + 1);
  });
});
