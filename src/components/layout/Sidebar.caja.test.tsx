import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

// HU-I-12: «Mi caja» (mesa de entrada) y «Cierres de caja» (gerente) en el
// menú, como enlaces de primer nivel. La sesión está simulada.

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

describe("HU-I-12 menú de la caja", () => {
  it("mesa de entrada ve «Mi caja» → /caja (activo en /caja/…), y no «Cierres de caja»", async () => {
    const secciones = await seccionesDe("MESA_ENTRADA");
    expect(secciones.find((s) => s.href === "/caja")).toMatchObject({ label: "Mi caja", prefijoActivo: "/caja" });
    expect(hrefs(secciones)).not.toContain("/cajas");
  });
  it("el gerente ve «Cierres de caja» → /cajas, y no «Mi caja»", async () => {
    const secciones = await seccionesDe("GERENTE");
    expect(secciones.find((s) => s.href === "/cajas")).toMatchObject({ label: "Cierres de caja", prefijoActivo: "/cajas" });
    expect(hrefs(secciones)).not.toContain("/caja");
  });
  it.each(["PROFESOR", "ALUMNO"])("%s no ve ninguna entrada de caja", async (rol) => {
    const secciones = await seccionesDe(rol);
    expect(hrefs(secciones).filter((h) => h === "/caja" || h === "/cajas")).toEqual([]);
  });
});
