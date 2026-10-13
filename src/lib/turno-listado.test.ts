import { describe, expect, it } from "vitest";
import { urlListadoTurnos } from "@/lib/turno-listado";

describe("urlListadoTurnos (HU-C-02)", () => {
  it("sin filtros conserva el formato de retorno: /turnos? con la página, sin `orden` (HU-C-27)", () => {
    expect(urlListadoTurnos({ pagina: 1 })).toBe("/turnos?pagina=1");
    expect(urlListadoTurnos({ q: "", pagina: 2 })).toBe("/turnos?pagina=2");
  });

  it("incluye la búsqueda y la página", () => {
    expect(urlListadoTurnos({ q: "rossi", pagina: 3 })).toBe("/turnos?q=rossi&pagina=3");
  });

  it("codifica espacios y tildes y siempre empieza con /turnos?", () => {
    const url = urlListadoTurnos({ q: "sofía matemática", pagina: 1 });
    expect(url).toBe("/turnos?q=sof%C3%ADa+matem%C3%A1tica&pagina=1");
    expect(url.startsWith("/turnos?")).toBe(true);
  });
});

describe("urlListadoTurnos (HU-C-08)", () => {
  it("suma profesor_id y conserva q, página y el prefijo /turnos?", () => {
    expect(urlListadoTurnos({ q: "fisica", profesorId: "ckprof1", pagina: 1 })).toBe("/turnos?q=fisica&profesor_id=ckprof1&pagina=1");
    expect(urlListadoTurnos({ profesorId: "", pagina: 1 })).toBe("/turnos?pagina=1");
  });
});

describe("urlListadoTurnos (HU-C-27)", () => {
  it("escribe todos los filtros en un orden fijo, con la página al final", () => {
    expect(urlListadoTurnos({ q: "fisica", profesorId: "ckprof1", periodo: "anteriores", materiaId: "ckmat1", pagina: 2 }))
      .toBe("/turnos?q=fisica&profesor_id=ckprof1&periodo=anteriores&materia_id=ckmat1&pagina=2");
  });

  it("escribe el período también cuando es «hoy»", () => {
    expect(urlListadoTurnos({ periodo: "hoy", pagina: 1 })).toBe("/turnos?periodo=hoy&pagina=1");
  });

  it("con rango no escribe el período (rango personalizado) y admite una sola fecha", () => {
    expect(urlListadoTurnos({ periodo: "hoy", desde: "2026-10-01", hasta: "2026-10-13", pagina: 1 })).toBe("/turnos?desde=2026-10-01&hasta=2026-10-13&pagina=1");
    expect(urlListadoTurnos({ hasta: "2026-10-13", pagina: 1 })).toBe("/turnos?hasta=2026-10-13&pagina=1");
  });

  it("nunca escribe `orden` y siempre empieza con /turnos? (lo exigen configuración y participantes)", () => {
    const url = urlListadoTurnos({ desde: "2026-10-01", materiaId: "ckmat1", pagina: 4 });
    expect(url).not.toContain("orden");
    expect(url.startsWith("/turnos?")).toBe(true);
  });
});
