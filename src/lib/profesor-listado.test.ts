import { describe, expect, it } from "vitest";
import {
  clavesOrdenProfesor,
  formatearApellidoNombre,
  resumirMaterias,
} from "@/lib/profesor-listado";

// HU-D-05: helpers puros del listado de profesores.

describe("resumirMaterias (criterio 4)", () => {
  it("sin materias muestra —", () => {
    expect(resumirMaterias([])).toBe("—");
  });

  it("con una o dos materias las lista todas, sin contador", () => {
    expect(resumirMaterias(["Física"])).toBe("Física");
    expect(resumirMaterias(["Física", "Matemática"])).toBe("Física, Matemática");
  });

  it("con más de dos muestra las primeras 2 y el resto como contador", () => {
    expect(resumirMaterias(["Matemática", "Física", "Química"])).toBe("Matemática, Física +1");
    expect(resumirMaterias(["Matemática", "Física", "Química", "Programación I"])).toBe(
      "Matemática, Física +2",
    );
  });

  it("respeta el orden recibido (el servicio las entrega ordenadas)", () => {
    expect(resumirMaterias(["B", "A", "C"])).toBe("B, A +1");
  });
});

describe("formatearApellidoNombre (criterio 1)", () => {
  it('arma "Apellido, Nombre"', () => {
    expect(formatearApellidoNombre("Giménez", "Laura")).toBe("Giménez, Laura");
  });
});

describe("clavesOrdenProfesor (criterio 2)", () => {
  it("normaliza sin distinguir mayúsculas ni acentos", () => {
    expect(clavesOrdenProfesor({ nombre: "Lucía", apellido: "Álvarez" })).toEqual({
      nombreNormalizadoProfesor: "lucia",
      apellidoNormalizadoProfesor: "alvarez",
    });
    expect(clavesOrdenProfesor({ nombre: "PEDRO", apellido: "Ávila" })).toEqual(
      clavesOrdenProfesor({ nombre: "pedro", apellido: "avila" }),
    );
    expect(clavesOrdenProfesor({ nombre: "Andrea", apellido: "Núñez" }).apellidoNormalizadoProfesor).toBe(
      "nunez",
    );
  });

  it("quita cualquier diacrítico combinable, no solo los del español (igual que el backfill SQL)", () => {
    // La migración usa lower(regexp_replace(normalize(x, NFD), '[̀-ͯ]', '', 'g')).
    expect(clavesOrdenProfesor({ nombre: "Ōtsuka", apellido: "Dvořák Čapek-Gonçalves" })).toEqual({
      nombreNormalizadoProfesor: "otsuka",
      apellidoNormalizadoProfesor: "dvorak capek-goncalves",
    });
    // Letras sin descomposición NFD (ø, ł) quedan igual en ambos lados.
    expect(clavesOrdenProfesor({ nombre: "Søren", apellido: "Łukasik" }).nombreNormalizadoProfesor).toBe("søren");
  });

  it("ordenar por (apellido, nombre) normalizados + DNI da el orden esperado", () => {
    // Mismo criterio que ORDEN_PROFESORES en profesor.service.ts.
    const profesores = [
      { apellido: "Ybáñez", nombre: "Paula", dni: "32200021" },
      { apellido: "benítez", nombre: "Diego", dni: "32200010" },
      { apellido: "Ávila", nombre: "Pedro", dni: "32200009" },
      { apellido: "OLMEDO", nombre: "Gabriela", dni: "32200019" },
      { apellido: "Pérez", nombre: "Juan", dni: "33300002" },
      { apellido: "Avila", nombre: "Pedro", dni: "32200004" },
      { apellido: "Álvarez", nombre: "Lucía", dni: "32200001" },
      { apellido: "Pérez", nombre: "Juan", dni: "33300001" },
      { apellido: "Acuña", nombre: "Sergio", dni: "30100004" },
      { apellido: "Núñez", nombre: "Andrea", dni: "32200015" },
    ];
    const clave = (p: (typeof profesores)[number]) => {
      const { apellidoNormalizadoProfesor, nombreNormalizadoProfesor } = clavesOrdenProfesor(p);
      return [apellidoNormalizadoProfesor, nombreNormalizadoProfesor, p.dni] as const;
    };
    const comparar = (a: (typeof profesores)[number], b: (typeof profesores)[number]) => {
      const [ka, kb] = [clave(a), clave(b)];
      for (let i = 0; i < ka.length; i++) {
        if (ka[i]! < kb[i]!) return -1;
        if (ka[i]! > kb[i]!) return 1;
      }
      return 0;
    };

    const ordenados = [...profesores].sort(comparar).map((p) => `${p.apellido}, ${p.nombre} (${p.dni})`);

    expect(ordenados).toEqual([
      "Acuña, Sergio (30100004)",
      "Álvarez, Lucía (32200001)", // la tilde no la manda al final
      "Avila, Pedro (32200004)", // empate normalizado con "Ávila": desempata el DNI
      "Ávila, Pedro (32200009)",
      "benítez, Diego (32200010)", // la minúscula no la manda después de la "Z"
      "Núñez, Andrea (32200015)",
      "OLMEDO, Gabriela (32200019)",
      "Pérez, Juan (33300001)", // nombre idéntico: desempata el DNI
      "Pérez, Juan (33300002)",
      "Ybáñez, Paula (32200021)",
    ]);
  });
});
