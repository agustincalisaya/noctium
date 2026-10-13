import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

// HU-C-26 criterio 1: «Reservas» en el menú de mesa de entrada, enlace de
// primer nivel entre «Registrar pago» y «Mi caja» (foto del prototipo). La
// sesión está simulada.

const m = vi.hoisted(() => ({ sesion: null as { user: { rol: string } } | null }));
vi.mock("@/auth", () => ({ auth: async () => m.sesion }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

const { Sidebar } = await import("./Sidebar");

type Seccion = { label: string; href?: string; prefijoActivo?: string; items?: { label: string; href: string }[] };

async function seccionesDe(rol: string) {
  m.sesion = { user: { rol } };
  return ((await Sidebar()) as ReactElement<{ secciones: Seccion[] }>).props.secciones;
}
const hrefs = (secciones: Seccion[]) => secciones.flatMap((s) => [s.href, ...(s.items ?? []).map((i) => i.href)]).filter(Boolean);

beforeEach(() => { vi.clearAllMocks(); });

describe("HU-C-26 menú «Reservas»", () => {
  it("mesa de entrada ve «Reservas» → /reservas, entre «Registrar pago» y «Mi caja»", async () => {
    const secciones = await seccionesDe("MESA_ENTRADA");
    expect(secciones.find((s) => s.href === "/reservas")).toMatchObject({ label: "Reservas", prefijoActivo: "/reservas" });
    const primerNivel = secciones.map((s) => s.href);
    const indice = primerNivel.indexOf("/reservas");
    expect(primerNivel[indice - 1]).toBe("/pagos/registrar");
    expect(primerNivel[indice + 1]).toBe("/caja");
  });

  it.each(["GERENTE", "PROFESOR", "ALUMNO"])("%s no ve «Reservas»", async (rol) => {
    expect(hrefs(await seccionesDe(rol))).not.toContain("/reservas");
  });
});
