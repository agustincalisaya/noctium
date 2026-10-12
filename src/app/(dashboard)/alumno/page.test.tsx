import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { texto } from "@/lib/textos";
import type { InscripcionPropia } from "@/types/turno.types";
import AlumnoPage from "@/app/(dashboard)/alumno/page";

const { permiso, listar, confirmar } = vi.hoisted(() => ({ permiso: vi.fn(), listar: vi.fn(), confirmar: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({ exigirPermiso: permiso }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/turnos/turno.service", () => ({ listarTurnosPropios: listar, obtenerConfirmacionReservaPropia: confirmar }));
const reserva: InscripcionPropia = { id: "inscripcion-propia", situacion: "RESERVADA", vence_el: "2026-10-10T12:05:00-03:00", precio: 26000, cancelacion: "NO_APLICA" };
const tarjeta = {
  turno_id: "clase-propia", fecha: "2026-10-13", hora_inicio: "16:00", hora_fin: "18:00",
  materia: "Física I", profesor: "Pérez, Ana", aula: "Aula 2", estado: "DISPONIBLE", clase_dictada: false,
  inscripcion: reserva,
};
const datos = (inscripcion = reserva, estado = "DISPONIBLE") => ({ items: [{ ...tarjeta, estado, inscripcion }],
  paginacion: { total: 1, pagina_actual: 1, total_paginas: 1, por_pagina: 10 }, totales: { proximos: 1, anteriores: 0 } });
const consultar = async (params: { inscripcion?: string; reserva?: string; vista?: string; pagina?: string } = {}) =>
  renderToStaticMarkup(await AlumnoPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({ id: "usuario-sesion" });
  listar.mockResolvedValue(datos());
  confirmar.mockResolvedValue(reserva);
});

describe("C-22 Mis clases — componente server real, servicios simulados", () => {
  it("muestra situación, precio guardado y vocabulario central en femenino", async () => {
    const html = await consultar();
    expect(permiso).toHaveBeenCalledExactlyOnceWith("turnos:leer_propios");
    expect(html).toContain("Mis clases");
    expect(html).toContain("Reservada · pagar antes del 10/10/2026, 12:05");
    expect(html).toContain("Precio de la clase: $ 26.000");
    expect(html).not.toMatch(/Mis turnos|Solicitar turno|Completo|Cancelado|Registrar pago/);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it.each([
    ["PAGADA", "Pagada", true], ["PAGO_PENDIENTE", "Pago pendiente · se abona en el centro", true],
    ["PAGO_SIN_REGISTRAR", "Pago sin registrar", true], ["RESERVA_VENCIDA", "Reserva vencida", false],
    ["CANCELADA_ALUMNO", "Cancelaste tu inscripción", false], ["QUITADA_CENTRO", "Inscripción quitada por el centro", false],
    ["BAJA_ALUMNO", "Inscripción dada de baja por el centro", false],
  ] as const)("situación %s y precio solo de inscripción vigente", async (situacion, mensaje, conPrecio) => {
    listar.mockResolvedValue(datos({ ...reserva, situacion }));
    const html = await consultar();
    expect(html).toContain(mensaje);
    expect(html.includes("$ 26.000")).toBe(conPrecio);
  });

  describe("C-14 acción de cancelar la inscripción", () => {
    const textoAccion = "Cancelar mi inscripción";
    const leyenda = "Ya no podés cancelar en línea. Comunicate con el centro.";
    const botonAccion = (html: string) => html.match(new RegExp(`<button[^>]*>${textoAccion}</button>`))?.[0];

    it("PERMITIDA: el botón de cancelar aparece habilitado y sin leyenda", async () => {
      listar.mockResolvedValue(datos({ ...reserva, situacion: "PAGADA", cancelacion: "PERMITIDA" }));
      const html = await consultar();
      const boton = botonAccion(html);
      expect(boton).toBeDefined();
      expect(boton).not.toMatch(/\sdisabled=/);
      expect(html).not.toContain(leyenda);
    });

    it("FUERA_DE_PLAZO: el botón aparece deshabilitado, asociado a la leyenda de contacto con el centro", async () => {
      listar.mockResolvedValue(datos({ ...reserva, situacion: "PAGADA", cancelacion: "FUERA_DE_PLAZO" }));
      const html = await consultar();
      const boton = botonAccion(html);
      expect(boton).toBeDefined();
      expect(boton).toMatch(/\sdisabled=/);
      expect(boton).toContain('aria-describedby="cancelacion-clase-propia"');
      expect(html).toContain(`<p id="cancelacion-clase-propia" class="text-sm text-muted-foreground">${leyenda}</p>`);
    });

    it("NO_APLICA: no hay acción ni leyenda", async () => {
      listar.mockResolvedValue(datos({ ...reserva, situacion: "PAGADA", cancelacion: "NO_APLICA" }));
      const html = await consultar();
      expect(html).not.toContain(textoAccion);
      expect(html).not.toContain(leyenda);
    });

    it("la acción solo se ofrece en la pestaña de próximas clases", async () => {
      listar.mockResolvedValue(datos({ ...reserva, situacion: "PAGADA", cancelacion: "PERMITIDA" }));
      expect(await consultar({ vista: "anteriores" })).not.toContain(textoAccion);
    });

  });

  it("confirmación y recarga usan id + sesión fuera de la página de resultados, con plazo definitivo", async () => {
    listar.mockResolvedValue({ ...datos(), items: [], paginacion: { total: 20, pagina_actual: 9, total_paginas: 2, por_pagina: 10 } });
    const params = { inscripcion: "exitosa", reserva: "inscripcion-propia", pagina: "9" };
    const html = await consultar(params);
    expect(confirmar).toHaveBeenCalledExactlyOnceWith("inscripcion-propia", "usuario-sesion");
    expect(html).toContain("Reservaste tu lugar. Acercate al centro a pagar antes del sábado 10 de octubre de 2026 a las 12:05. Si no, la reserva se cancela sola.");
    expect(await consultar(params)).toContain("12:05");
    expect(html).not.toContain("12:00");
  });

  it.each(["RESERVA_VENCIDA", "PAGO_SIN_REGISTRAR", "PAGADA"] as const)("recarga de enlace viejo %s no conserva invitación a pagar", async (situacion) => {
    confirmar.mockResolvedValue({ ...reserva, situacion });
    listar.mockResolvedValue(datos({ ...reserva, situacion }, "CANCELADO"));
    const html = await consultar({ inscripcion: "exitosa", reserva: reserva.id });
    expect(html).not.toMatch(/Acercate al centro a pagar|pagar antes|Pago pendiente/);
    expect(html).toContain("Cancelada");
  });

  it("id ajeno/inexistente y marcador sin id no presentan una confirmación", async () => {
    confirmar.mockResolvedValue(null);
    expect(await consultar({ inscripcion: "exitosa", reserva: "ajena" })).not.toContain("Tu inscripción");
    confirmar.mockClear();
    expect(await consultar({ inscripcion: "exitosa" })).not.toContain("Tu inscripción");
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("fallo de consulta muestra error y no anuncia una confirmación obsoleta", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const causa = new Error("BD no disponible");
      confirmar.mockRejectedValue(causa);
      const html = await consultar({ inscripcion: "exitosa", reserva: reserva.id });
      expect(html).toContain('role="alert"');
      expect(html).toContain(texto("ui.turnos.reserva.errorConsulta"));
      expect(html).not.toMatch(/Tu inscripción|Reservaste tu lugar|BD no disponible/);
      expect(log).toHaveBeenCalledExactlyOnceWith("AlumnoPage: no se pudo consultar la inscripción propia", causa);
    } finally { log.mockRestore(); }
  });
});
