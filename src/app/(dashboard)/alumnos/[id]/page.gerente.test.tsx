import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// HU-E-02 criterio 8 (spec_modulo_B.md §2.12): el Gerente abre la ficha en
// modo consulta, con las pestañas Datos, Clases, Historial académico y Pagos,
// sin ninguna acción de edición, de baja/reactivación, de inscripción ni de
// cobro. La cabecera y las secciones de Datos son las reales; las pestañas
// que cargan en el cliente se simulan exponiendo lo que reciben. Los permisos
// simulados son los del seed para cada rol.

const PERMISOS: Record<string, string[]> = {
  GERENTE: ["alumnos:leer", "historial:leer", "pagos:leer", "pagos:corregir"],
  MESA_ENTRADA: [
    "alumnos:leer", "alumnos:crear", "alumnos:editar", "alumnos:cambiar_estado", "historial:leer",
    "examenes:registrar", "indicaciones:registrar", "pagos:leer", "pagos:crear", "pagos:corregir",
  ],
};

const m = vi.hoisted(() => ({ rol: "GERENTE", detalle: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => {
  class PermisoError extends Error {
    constructor(readonly status: number) { super("permiso"); }
  }
  return {
    PermisoError,
    verificarPermiso: async (accion: string) => {
      if (!PERMISOS[m.rol]!.includes(accion)) throw new PermisoError(403);
      return { id: "u", rol: m.rol };
    },
    exigirPermiso: async (accion: string) => {
      if (!PERMISOS[m.rol]!.includes(accion)) throw new Error("REDIRECT:/sin-permiso");
      return { id: "u", rol: m.rol };
    },
  };
});
vi.mock("@/server/alumnos/alumno.service", () => ({ obtenerDetalleAlumno: m.detalle, obtenerCuentaDeAlumno: vi.fn() }));
vi.mock("@/server/alumnos/alumno.estado.service", () => ({ obtenerHistorialEstadosAlumno: vi.fn().mockResolvedValue([]) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn((destino: string) => { throw new Error(`REDIRECT:${destino}`); }),
}));
vi.mock("@/components/shared/cuenta-acceso-card", () => ({ CuentaAccesoCard: () => null }));
vi.mock("./historial-estados-alumno", () => ({ HistorialEstadosAlumno: () => null }));
vi.mock("./estado-alumno-dialog", () => ({
  EstadoAlumnoDialog: ({ alumno }: { alumno: { activo: boolean } }) => <button>{alumno.activo ? "Desactivar alumno" : "Reactivar"}</button>,
}));
vi.mock("./historial-clases", () => ({ HistorialClases: () => <div data-pestana="clases" /> }));
vi.mock("./historial-academico", () => ({
  HistorialAcademico: ({ puedeRegistrarExamen, puedeRegistrarIndicacion }: { puedeRegistrarExamen: boolean; puedeRegistrarIndicacion: boolean }) =>
    <div data-pestana="historial" data-examen={String(puedeRegistrarExamen)} data-indicacion={String(puedeRegistrarIndicacion)} />,
}));
vi.mock("./historial-pagos", () => ({
  HistorialPagos: ({ puedeRegistrarPago }: { puedeRegistrarPago: boolean }) =>
    <div data-pestana="pagos" data-registrar={String(puedeRegistrarPago)} />,
}));

const { default: Page } = await import("./page");
const { default: ClasesPage } = await import("./clases/page");
const { default: PagosPage } = await import("./pagos/page");

const ALUMNO = {
  id: "a", nombre: "Ana", apellido: "Pérez", dni: "30111222", email: "ana@mail.com", telefono: "1155550000",
  is_active: true, version: 1, created_at: "2026-03-01T12:00:00.000Z",
  forma_pago_preferida: "Efectivo", forma_pago_preferida_activa: true,
};
const params = Promise.resolve({ id: "a" });

async function ficha(tab?: string) {
  return renderToStaticMarkup(await Page({ params, searchParams: Promise.resolve(tab ? { tab } : {}) }));
}

const ACCIONES_DE_ESCRITURA = [
  "Modificar datos", "Editar contacto", "Cargar contacto", "Editar forma de pago", "Desactivar alumno", "Reactivar",
  "/alumnos/a/editar", "/alumnos/a/contacto", "/alumnos/a/forma-pago", "/pagos/registrar",
];

beforeEach(() => {
  vi.clearAllMocks();
  m.rol = "GERENTE";
  m.detalle.mockResolvedValue(ALUMNO);
});

describe("ficha del alumno: Gerente en modo consulta (HU-E-02 criterio 8)", () => {
  it("pestaña Datos: ve la ficha, las cuatro pestañas y el aviso, sin ninguna acción de edición", async () => {
    const html = await ficha();
    expect(html).toContain("Pérez, Ana");
    expect(html).toContain("DNI 30111222");
    expect(html).toContain("1155550000");
    expect(html).toContain("Efectivo");
    for (const href of ["/alumnos/a?tab=datos", "/alumnos/a/clases", "/alumnos/a?tab=historial", "/alumnos/a/pagos"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Modo consulta: no editás datos, no inscribís ni registrás pagos.");
    for (const accion of ACCIONES_DE_ESCRITURA) expect(html).not.toContain(accion);
  });

  it("un alumno inactivo tampoco ofrece «Reactivar»", async () => {
    m.detalle.mockResolvedValue({ ...ALUMNO, is_active: false });
    const html = await ficha();
    expect(html).toContain("Inactivo");
    expect(html).not.toContain("Reactivar");
  });

  it("pestaña Clases: la ve con el aviso y sin acciones", async () => {
    const html = renderToStaticMarkup(await ClasesPage({ params }));
    expect(html).toContain('data-pestana="clases"');
    expect(html).toContain("Modo consulta");
    for (const accion of ACCIONES_DE_ESCRITURA) expect(html).not.toContain(accion);
  });

  it("pestaña Historial académico: la ve sin registrar exámenes ni indicaciones", async () => {
    const html = await ficha("historial");
    expect(html).toContain('data-pestana="historial"');
    expect(html).toContain('data-examen="false"');
    expect(html).toContain('data-indicacion="false"');
    expect(html).toContain("Modo consulta");
  });

  it("pestaña Pagos: la ve sin «Registrar pago» ni cambio de estado", async () => {
    const html = renderToStaticMarkup(await PagosPage({ params, searchParams: Promise.resolve({}) }));
    expect(html).toContain('data-pestana="pagos"');
    expect(html).toContain('data-registrar="false"');
    expect(html).toContain("Modo consulta");
    for (const accion of ACCIONES_DE_ESCRITURA) expect(html).not.toContain(accion);
  });

  it("Mesa de Entrada conserva sus acciones y no ve el aviso de consulta", async () => {
    m.rol = "MESA_ENTRADA";
    const html = await ficha();
    for (const accion of ["Modificar datos", "Editar contacto", "Editar forma de pago", "Desactivar alumno"]) expect(html).toContain(accion);
    expect(html).not.toContain("Modo consulta");
  });
});
