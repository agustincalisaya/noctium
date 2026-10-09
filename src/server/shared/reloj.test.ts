import { afterEach, describe, expect, it, vi } from "vitest";
import { ahora, conReloj, RelojNoModificableError } from "@/server/shared/reloj";
import { fechaCentro, finDelDiaCentro, inicioDeTurno, inicioDelDiaCentro, instanteCentro, finDeTurno } from "@/server/shared/fechas-centro";

const fijo = new Date("2030-05-10T15:30:00.000Z");

describe("reloj inyectable (PR-0.md §2.16)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin contexto devuelve el instante real", () => {
    const antes = Date.now();
    const valor = ahora().getTime();
    expect(valor).toBeGreaterThanOrEqual(antes);
    expect(valor).toBeLessThanOrEqual(Date.now());
  });

  it("conReloj fija el momento para todo lo que corre adentro, también lo asincrónico", async () => {
    const visto = await conReloj(fijo, async () => {
      await new Promise((resolver) => setTimeout(resolver, 5));
      return ahora();
    });
    expect(visto.toISOString()).toBe(fijo.toISOString());
  });

  it("devuelve una copia: modificarla no cambia el reloj", () => {
    conReloj(fijo, () => {
      ahora().setUTCFullYear(1999);
      expect(ahora().toISOString()).toBe(fijo.toISOString());
    });
  });

  it("acepta una función para que el tiempo avance y se puede anidar (manda el más interno)", () => {
    let paso = 0;
    conReloj(() => new Date(fijo.getTime() + paso * 1000), () => {
      paso = 2;
      expect(ahora().getTime()).toBe(fijo.getTime() + 2000);
      const interno = new Date("2031-01-01T00:00:00.000Z");
      conReloj(interno, () => expect(ahora().toISOString()).toBe(interno.toISOString()));
      expect(ahora().getTime()).toBe(fijo.getTime() + 2000);
    });
  });

  it("dos contextos concurrentes no se pisan", async () => {
    const otro = new Date("2020-01-01T00:00:00.000Z");
    const esperar = () => new Promise((resolver) => setTimeout(resolver, 2));
    const [a, b] = await Promise.all([
      conReloj(fijo, async () => { await esperar(); return ahora(); }),
      conReloj(otro, async () => { await esperar(); return ahora(); }),
    ]);
    expect(a.toISOString()).toBe(fijo.toISOString());
    expect(b.toISOString()).toBe(otro.toISOString());
  });

  it("en producción no se puede cambiar", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => conReloj(fijo, () => ahora())).toThrow(RelojNoModificableError);
  });
});

describe("fechas del centro (UTC−3, PR-0.md §2.2)", () => {
  const turno = { fechaTurno: new Date("2030-05-10T00:00:00.000Z"), horaInicioTurno: new Date("1970-01-01T22:30:00.000Z"), duracionMinutosTurno: 120 };

  it("inicioDeTurno lee fecha y hora en la zona del centro (−03:00)", () => {
    expect(inicioDeTurno(turno).toISOString()).toBe("2030-05-11T01:30:00.000Z");
    expect(finDeTurno(turno).toISOString()).toBe("2030-05-11T03:30:00.000Z");
  });

  it("fechaCentro toma el día del centro, no el de UTC", () => {
    // 01:30 UTC del 11 es todavía el 10 a las 22:30 en el centro.
    expect(fechaCentro(new Date("2030-05-11T01:30:00.000Z")).toISOString()).toBe("2030-05-10T00:00:00.000Z");
    expect(fechaCentro(new Date("2030-05-11T03:00:00.000Z")).toISOString()).toBe("2030-05-11T00:00:00.000Z");
  });

  it("inicio y fin del día del centro", () => {
    const momento = new Date("2030-05-11T01:30:00.000Z");
    expect(inicioDelDiaCentro(momento).toISOString()).toBe("2030-05-10T03:00:00.000Z");
    expect(finDelDiaCentro(momento).toISOString()).toBe("2030-05-11T03:00:00.000Z");
  });

  it("instanteCentro arma un instante a una hora del centro", () => {
    expect(instanteCentro("2030-05-10", "12:00").toISOString()).toBe("2030-05-10T15:00:00.000Z");
    expect(instanteCentro("2030-05-10").toISOString()).toBe("2030-05-10T03:00:00.000Z");
  });
});
