import { describe, expect, it } from "vitest";
import { urlListadoTurnos } from "@/lib/turno-listado";

describe("urlListadoTurnos (HU-C-02)", () => {
  it("sin búsqueda conserva el formato de retorno de HU-C-01", () => {
    expect(urlListadoTurnos({ pagina: 1 })).toBe("/turnos?pagina=1&orden=fecha_hora_asc");
    expect(urlListadoTurnos({ q: "", pagina: 2 })).toBe("/turnos?pagina=2&orden=fecha_hora_asc");
  });

  it("incluye la búsqueda y la página", () => {
    expect(urlListadoTurnos({ q: "rossi", pagina: 3 })).toBe("/turnos?q=rossi&pagina=3&orden=fecha_hora_asc");
  });

  it("codifica espacios y tildes y siempre empieza con /turnos?", () => {
    const url = urlListadoTurnos({ q: "sofía matemática", pagina: 1 });
    expect(url).toBe("/turnos?q=sof%C3%ADa+matem%C3%A1tica&pagina=1&orden=fecha_hora_asc");
    expect(url.startsWith("/turnos?")).toBe(true);
  });
});
